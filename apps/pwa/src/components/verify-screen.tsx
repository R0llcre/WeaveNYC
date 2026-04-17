'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import Link from 'next/link';

import { Banner, Button, Card, Field, Pill } from '@/components/ui';
import { createAnonymousSession } from '@/lib/api';
import {
  useAppDispatch,
  useAppSelector,
  useMagicLinkStart,
  useMagicLinkVerify,
  useOtpStart,
  useOtpVerify,
} from '@/lib/hooks';
import { loadMatchContactIntent } from '@/lib/match-intent';
import { safeReturnTo } from '@/lib/safe-return-to';
import { selectSession } from '@/lib/selectors';
import { setSession } from '@/lib/slices/auth-slice';

export function VerifyScreen() {
  const t = useTranslations();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const session = useAppSelector(selectSession);
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'otp' | 'magic'>('otp');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [magicToken, setMagicToken] = useState('');
  const [autoConsumedMagicLink, setAutoConsumedMagicLink] = useState(false);
  const [redirectedAfterVerify, setRedirectedAfterVerify] = useState(false);
  const [isBootstrappingSession, setIsBootstrappingSession] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<Error | null>(null);

  const otpStart = useOtpStart(session?.access_token);
  const otpVerify = useOtpVerify(session?.access_token);
  const magicLinkStart = useMagicLinkStart(session?.access_token);
  const magicLinkVerify = useMagicLinkVerify(session?.access_token);

  // F10: per-route document.title
  useEffect(() => {
    document.title = `${t('pageTitleVerify')} \u2014 WeaveNYC`;
  }, [t]);

  const alreadyVerified = session?.user.level === 'verified' || session?.user.level === 'anchor';
  const magicLinkChallengeId = searchParams.get('challenge_id') ?? searchParams.get('challengeId');
  const magicLinkQueryToken = searchParams.get('token');
  const hasMagicLinkQuery = Boolean(magicLinkChallengeId && magicLinkQueryToken);
  // `return_to` is attacker-controlled. Validate it against a same-origin
  // whitelist so `?return_to=https://evil.com` can't redirect the user off
  // the origin after verification completes. When the raw param is unsafe
  // we treat it as absent (fall through to intent / default `/inbox`),
  // so silent fall-through preserves the existing chain.
  const rawReturnTo = searchParams.get('return_to');
  const returnTo =
    rawReturnTo === null ? null : safeReturnTo(rawReturnTo, '') || null;

  // Bug 1 fix: `finishVerification` must cancel any in-flight mutations tied to
  // the old access token before dispatching the new session. Otherwise retry /
  // stale mutations keep the pre-verify token in their closure and hit the
  // gateway with a token that the reducer has already replaced. We also reset
  // the auth-scoped mutations so their closed-over `accessToken` is not reused.
  const finishVerification = useCallback(
    (nextSession: NonNullable<typeof session>) => {
      // Synchronously cancel anything still using the previous token. This is
      // the key race-safe step: no mutation fn can run with the stale token
      // after this point because the state replacement below happens on the
      // same tick.
      void queryClient.cancelQueries();
      otpStart.reset();
      otpVerify.reset();
      magicLinkStart.reset();
      magicLinkVerify.reset();

      // Session replacement — synchronous reducer dispatch, single source of
      // truth. Any render triggered after this will pick up the new token.
      dispatch(setSession(nextSession));

      const intent = loadMatchContactIntent();
      const target = returnTo ?? intent?.returnTo ?? '/inbox';
      setRedirectedAfterVerify(true);
      router.replace(target);
    },
    [
      dispatch,
      magicLinkStart,
      magicLinkVerify,
      otpStart,
      otpVerify,
      queryClient,
      returnTo,
      router,
    ],
  );

  // Bug 2 fix: a magic link that arrives without an existing session has no
  // access token to present to the verify endpoint. Bootstrap an anonymous
  // session first so the magic-link verify effect can consume it on the next
  // render.
  useEffect(() => {
    if (!hasMagicLinkQuery) {
      return;
    }

    if (session?.access_token || isBootstrappingSession || alreadyVerified) {
      return;
    }

    let cancelled = false;
    setIsBootstrappingSession(true);
    setBootstrapError(null);
    void (async () => {
      try {
        const anonymousSession = await createAnonymousSession();
        if (cancelled) {
          return;
        }
        dispatch(setSession(anonymousSession));
      } catch (error) {
        if (cancelled) {
          return;
        }
        setBootstrapError(error instanceof Error ? error : new Error('Session bootstrap failed'));
      } finally {
        if (!cancelled) {
          setIsBootstrappingSession(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [alreadyVerified, isBootstrappingSession, dispatch, hasMagicLinkQuery, session?.access_token]);

  useEffect(() => {
    if (!magicLinkChallengeId || !magicLinkQueryToken) {
      return;
    }

    setMode('magic');
    setMagicToken(magicLinkQueryToken);

    // Bug 2 fix continued: do not fire the auto-consume until an anonymous
    // session exists. The next render (triggered by the bootstrap effect
    // above) will re-enter this effect with `session?.access_token` populated.
    if (!session?.access_token) {
      return;
    }

    if (autoConsumedMagicLink || magicLinkVerify.isPending || alreadyVerified) {
      return;
    }

    setAutoConsumedMagicLink(true);
    magicLinkVerify.mutate(
      {
        challengeId: magicLinkChallengeId,
        token: magicLinkQueryToken,
      },
      {
        onSuccess: (nextSession) => finishVerification(nextSession),
      },
    );
  }, [
    alreadyVerified,
    autoConsumedMagicLink,
    finishVerification,
    magicLinkChallengeId,
    magicLinkQueryToken,
    magicLinkVerify,
    session?.access_token,
  ]);

  useEffect(() => {
    if (!alreadyVerified || redirectedAfterVerify) {
      return;
    }

    const intent = loadMatchContactIntent();
    const target = returnTo ?? intent?.returnTo;
    if (!target) {
      return;
    }

    setRedirectedAfterVerify(true);
    router.replace(target);
  }, [alreadyVerified, redirectedAfterVerify, returnTo, router]);

  const errors = [
    otpStart.error,
    otpVerify.error,
    magicLinkStart.error,
    magicLinkVerify.error,
    bootstrapError,
  ].filter((err): err is Error => err instanceof Error);

  return (
    <main className="shell" id="main-content" tabIndex={-1}>
      <div className="shell__inner">
        {/* Hero rendered inline (not via PageHeader) so the h1 can keep its
            verify-title data-testid exactly where the smoke spec expects it. */}
        <section className="hero">
          <div className="hero__topbar">
            <Link href="/" className="hero__link">
              {t('backHome')}
            </Link>
            <span className="hero__eyebrow">{t('verifyTitle')}</span>
          </div>
          <h1 data-testid="verify-title">{t('verifyTitle')}</h1>
          <p>{t('verifyCopy')}</p>
        </section>

        <Card as="section" className="card--verify">
          {!session && !hasMagicLinkQuery ? (
            <Banner tone="warning" title={t('verifyNeedsSession')} />
          ) : null}

          {hasMagicLinkQuery && !session && isBootstrappingSession ? (
            <Banner tone="info" title={t('creatingSession')} />
          ) : null}

          {alreadyVerified ? (
            <Banner tone="success" title={t('verificationDone')} />
          ) : (
            <>
              <div className="tab-row">
                <Pill active={mode === 'otp'} onClick={() => setMode('otp')}>
                  {t('otpTab')}
                </Pill>
                <Pill active={mode === 'magic'} onClick={() => setMode('magic')}>
                  {t('magicLinkTab')}
                </Pill>
              </div>

              {mode === 'otp' ? (
                <div className="verify-grid">
                  <Field label={t('phoneLabel')}>
                    <input
                      inputMode="tel"
                      autoComplete="tel"
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="+15165550101"
                      value={phone}
                    />
                  </Field>
                  <div className="actions">
                    <Button
                      variant="primary"
                      size="md"
                      data-testid="send-code"
                      disabled={!session || otpStart.isPending}
                      loading={otpStart.isPending}
                      onClick={() => otpStart.mutate({ phone })}
                    >
                      {t('sendCode')}
                    </Button>
                  </div>
                  {otpStart.data?.demo_code ? (
                    <p className="status-copy">
                      {t('demoCodeLabel')}: <strong>{otpStart.data.demo_code}</strong>
                    </p>
                  ) : null}
                  <Field label={t('codeLabel')}>
                    <input
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      onChange={(event) => setOtpCode(event.target.value)}
                      value={otpCode}
                    />
                  </Field>
                  <Button
                    variant="primary"
                    size="md"
                    data-testid="verify-code"
                    disabled={!session || otpVerify.isPending || !otpStart.data}
                    loading={otpVerify.isPending}
                    onClick={() =>
                      otpVerify.mutate(
                        {
                          challengeId: otpStart.data!.challenge_id,
                          code: otpCode,
                        },
                        {
                          onSuccess: (nextSession) => finishVerification(nextSession),
                        },
                      )
                    }
                  >
                    {t('verifyCode')}
                  </Button>
                </div>
              ) : (
                <div className="verify-grid">
                  <Field label={t('emailLabel')}>
                    <input
                      inputMode="email"
                      autoComplete="email"
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="neighbor@example.com"
                      value={email}
                    />
                  </Field>
                  <div className="actions">
                    <Button
                      variant="primary"
                      size="md"
                      disabled={!session || magicLinkStart.isPending}
                      loading={magicLinkStart.isPending}
                      onClick={() => magicLinkStart.mutate({ email })}
                    >
                      {t('sendLink')}
                    </Button>
                  </div>
                  {magicLinkStart.data?.demo_token ? (
                    <p className="status-copy">
                      {t('demoTokenLabel')}: <strong>{magicLinkStart.data.demo_token}</strong>
                    </p>
                  ) : null}
                  {magicLinkStart.data?.demo_url ? (
                    <p className="status-copy">
                      <a href={magicLinkStart.data.demo_url}>{magicLinkStart.data.demo_url}</a>
                    </p>
                  ) : null}
                  <Field label={t('tokenLabel')}>
                    <input onChange={(event) => setMagicToken(event.target.value)} value={magicToken} />
                  </Field>
                  <Button
                    variant="primary"
                    size="md"
                    disabled={magicLinkVerify.isPending || (!magicLinkStart.data && !hasMagicLinkQuery)}
                    loading={magicLinkVerify.isPending}
                    onClick={() =>
                      magicLinkVerify.mutate(
                        {
                          challengeId: magicLinkStart.data?.challenge_id ?? magicLinkChallengeId!,
                          token: magicToken,
                        },
                        {
                          onSuccess: (nextSession) => finishVerification(nextSession),
                        },
                      )
                    }
                  >
                    {t('useDemoLink')}
                  </Button>
                </div>
              )}
            </>
          )}

          {errors.map((error, index) => (
            <Banner
              key={index}
              tone="danger"
              title={t('verifyError')}
            >
              {error.message}
            </Banner>
          ))}
        </Card>
      </div>
    </main>
  );
}
