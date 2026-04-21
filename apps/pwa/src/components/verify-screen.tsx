'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import { TopBar } from '@/components/shell/TopBar';
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Field,
  Inline,
  Pill,
  Stack,
  Toast,
} from '@/components/ui';
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

/**
 * VerifyScreen — W5C redesign of `/me/verify` inside the 5-tab AppShell IA.
 *
 * Layout (top → bottom):
 *
 *   <TopBar backHref="/me" title="Sign in to prove who you are">
 *   ── Intro Card            (overline + h1 + body + "Why verify?" benefits)
 *   ── Method Card           (mode Pill switcher + phone/email Field + send CTA)
 *   ── Code Card             (OTP / token Field + verify CTA + resend link)
 *   ── Success EmptyState    (alreadyVerified branch — illustration + back-to-Me CTA)
 *   ── Error Banner(s)       (danger tone for any mutation error, warning for
 *                              session-bootstrap in-flight)
 *
 * This file is a pure *presentation* rewrite. The state machine —
 * session bootstrap, OTP start/verify, magic-link start/verify,
 * auto-consume on ?challenge_id=... query arrival, finishVerification
 * routing — is copied verbatim from the W4 implementation. The only
 * behavioural change is that `<main>` is no longer rendered here because
 * AppShell already wraps every non-onboarding route in its own <main>.
 *
 * testid contract (load-bearing for e2e):
 *   - `verify-title` on the visible h1
 *   - `send-code`    on the OTP "send" primary button
 *   - `verify-code`  on the OTP "verify" primary button
 *
 * All copy derives from `useTranslations()` — no English string literals.
 */
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
  // Success toast shown briefly after verification completes. We delay the
  // router.replace by ~800ms so the user sees the confirmation before the
  // tab navigates to /inbox (or the honored return_to). The toast lives on
  // this screen so it unmounts automatically with the route transition.
  const [verifySuccessToast, setVerifySuccessToast] = useState<string | null>(null);

  const otpStart = useOtpStart(session?.access_token);
  const otpVerify = useOtpVerify(session?.access_token);
  const magicLinkStart = useMagicLinkStart(session?.access_token);
  const magicLinkVerify = useMagicLinkVerify(session?.access_token);

  // F10: per-route document.title so the browser tab reads "Sign in —
  // WeaveNYC" once the client-side translation hydrates.
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
      const target = returnTo ?? intent?.returnTo ?? '/inbox/';
      setRedirectedAfterVerify(true);
      // Surface a success toast so the user sees the verification confirmation
      // before the route transition; we delay the replace briefly so the
      // toast is actually visible (screen readers still announce instantly
      // via `role=status`).
      setVerifySuccessToast(t('verifySuccessTitle'));
      window.setTimeout(() => {
        router.replace(target);
      }, 800);
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
      t,
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

  // The OTP send button becomes "Resend" once a challenge is in flight, so the
  // primary CTA has a coherent second-tap affordance rather than a greyed
  // "Send code" that still works. Label derivation is a local concern because
  // the i18n bundle exposes the two strings (`sendCode` / `verifyResendCode`)
  // and the Button atom itself is stateless.
  const otpChallengeActive = Boolean(otpStart.data);
  const magicLinkChallengeActive = Boolean(magicLinkStart.data);
  const codeStageActive = otpChallengeActive || magicLinkChallengeActive || hasMagicLinkQuery;

  const needsSessionBanner = !session && !hasMagicLinkQuery;
  const bootstrapInProgress = hasMagicLinkQuery && !session && isBootstrappingSession;

  return (
    <>
      <TopBar backHref="/me/" title={t('verifyTitle')} eyebrow={t('verifyOverline')} />
      <Stack as="div" gap={5} className="page-content">
        {/* -------------------------------------------------------------- */}
        {/* Intro — overline, h1 (testid-hook), body copy, benefits.       */}
        {/* The h1 sits inside the first Card (not the TopBar) so the      */}
        {/* e2e spec's `getByTestId('verify-title')` resolves to a visible */}
        {/* heading regardless of whether the TopBar title is truncated.   */}
        {/* -------------------------------------------------------------- */}
        <Card>
          <Stack gap={3}>
            {/* W5 R3/L1 → Wave 6D: the overline already ships via TopBar's
                eyebrow slot (see `eyebrow={t('verifyOverline')}` above).
                The Card title used to be emitted as a second <h1>, which
                duplicated the TopBar's <h1> in the accessibility tree
                (axe-core "page-has-heading-one" + nvda announcing the
                same string twice). Demoting to <h2> keeps the visible
                "verify-title" testid + heading flow (h1 → h2 → h3) and
                lets TopBar remain the single h1 source of truth. */}
            <h2 className="text-h3" data-testid="verify-title">
              {t('verifyTitle')}
            </h2>
            <p className="text-body ink-secondary">{t('verifyCopy')}</p>
            <section aria-labelledby="verify-benefits-heading">
              <h3 id="verify-benefits-heading" className="overline ink-secondary">
                {t('verifyBenefitsTitle')}
              </h3>
              <ul className="verify-benefits">
                <li>{t('verifyBenefit1')}</li>
                <li>{t('verifyBenefit2')}</li>
                <li>{t('verifyBenefit3')}</li>
              </ul>
            </section>
          </Stack>
        </Card>

        {/* Session-bootstrap advisory banners. These render OUTSIDE the
            success branch below so even a freshly-opened magic link sees
            the "getting a session ready" affordance while the anonymous
            session is being minted. */}
        {needsSessionBanner ? (
          <Banner tone="warning" title={t('verifyNeedsSession')} />
        ) : null}

        {bootstrapInProgress ? (
          <Banner tone="info" title={t('creatingSession')} />
        ) : null}

        {/* -------------------------------------------------------------- */}
        {/* SUCCESS state — the session is already verified/anchor. We    */}
        {/* swap the entry form for an EmptyState so users who land here  */}
        {/* after the finishVerification redirect don't see an editable   */}
        {/* form they can't use. The CTA sends them back to /me, which is */}
        {/* the IA parent.                                                */}
        {/* -------------------------------------------------------------- */}
        {alreadyVerified ? (
          <Card>
            <EmptyState
              illustrationName="matches-empty"
              title={t('verifySuccessTitle')}
              subtitle={t('verifySuccessSubtitle')}
              cta={{
                label: t('verifySuccessCta'),
                href: '/me/',
                variant: 'primary',
              }}
            />
          </Card>
        ) : (
          <>
            {/* -------------------------------------------------------- */}
            {/* Method card — Pill switch + phone/email Field + send CTA */}
            {/* -------------------------------------------------------- */}
            <section aria-labelledby="verify-choose-heading">
              <h2 id="verify-choose-heading" className="overline">
                {t('verifySectionChoose')}
              </h2>
              <Card>
                <Stack gap={4}>
                  <Inline gap={2} wrap role="tablist" aria-label={t('verifySectionChoose')}>
                    <Pill
                      active={mode === 'otp'}
                      onClick={() => setMode('otp')}
                      role="tab"
                      aria-selected={mode === 'otp'}
                    >
                      {t('otpTab')}
                    </Pill>
                    <Pill
                      active={mode === 'magic'}
                      onClick={() => setMode('magic')}
                      role="tab"
                      aria-selected={mode === 'magic'}
                    >
                      {t('magicLinkTab')}
                    </Pill>
                  </Inline>

                  <p className="text-body-sm ink-muted">{t('verifyMethodHelper')}</p>

                  {mode === 'otp' ? (
                    <Stack gap={3}>
                      <Field label={t('phoneLabel')}>
                        <input
                          inputMode="tel"
                          autoComplete="tel"
                          placeholder="+15165550101"
                          value={phone}
                          onChange={(event) => setPhone(event.target.value)}
                        />
                      </Field>
                      <Button
                        variant="primary"
                        size="md"
                        data-testid="send-code"
                        disabled={!session?.access_token || otpStart.isPending}
                        loading={otpStart.isPending}
                        onClick={() => otpStart.mutate({ phone })}
                        // Wave 6C — sending the OTP fires a server request;
                        // confirm the commitment tactilely.
                        haptic
                      >
                        {otpChallengeActive ? t('verifyResendCode') : t('sendCode')}
                      </Button>
                      {otpStart.data?.demo_code ? (
                        <p className="text-body-sm ink-muted">
                          {t('demoCodeLabel')}:{' '}
                          <strong>{otpStart.data.demo_code}</strong>
                        </p>
                      ) : null}
                    </Stack>
                  ) : (
                    <Stack gap={3}>
                      <Field label={t('emailLabel')}>
                        <input
                          inputMode="email"
                          autoComplete="email"
                          placeholder="neighbor@example.com"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                        />
                      </Field>
                      <Button
                        variant="primary"
                        size="md"
                        disabled={!session?.access_token || magicLinkStart.isPending}
                        loading={magicLinkStart.isPending}
                        onClick={() => magicLinkStart.mutate({ email })}
                      >
                        {magicLinkChallengeActive ? t('verifyResendCode') : t('sendLink')}
                      </Button>
                      {magicLinkStart.data?.demo_token ? (
                        <p className="text-body-sm ink-muted">
                          {t('demoTokenLabel')}:{' '}
                          <strong>{magicLinkStart.data.demo_token}</strong>
                        </p>
                      ) : null}
                      {magicLinkStart.data?.demo_url ? (
                        <p className="text-body-sm ink-muted">
                          <a href={magicLinkStart.data.demo_url}>
                            {magicLinkStart.data.demo_url}
                          </a>
                        </p>
                      ) : null}
                    </Stack>
                  )}
                </Stack>
              </Card>
            </section>

            {/* -------------------------------------------------------- */}
            {/* Code card — 6-digit OTP input OR magic-link token input. */}
            {/* We keep both forms mounted behind the `mode` switch so   */}
            {/* form state doesn't get blown away on tab flip.           */}
            {/* -------------------------------------------------------- */}
            <section aria-labelledby="verify-code-heading">
              <h2 id="verify-code-heading" className="overline">
                {t('verifySectionCode')}
              </h2>
              <Card>
                <Stack gap={3}>
                  {codeStageActive ? (
                    <Banner tone="info" title={t('verifyCodeSentTitle')}>
                      {t('verifyCodeSentBody')}
                    </Banner>
                  ) : null}

                  {mode === 'otp' ? (
                    <>
                      <Field label={t('codeLabel')}>
                        <input
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          value={otpCode}
                          onChange={(event) => setOtpCode(event.target.value)}
                        />
                      </Field>
                      <Button
                        variant="primary"
                        size="md"
                        data-testid="verify-code"
                        disabled={!session?.access_token || otpVerify.isPending || !otpStart.data}
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
                        // Wave 6C — verifying the code is the commitment
                        // step that flips the account to verified; a
                        // subtle buzz confirms the tap before the mutation
                        // returns.
                        haptic
                      >
                        {t('verifyCode')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Field label={t('tokenLabel')}>
                        <input
                          value={magicToken}
                          onChange={(event) => setMagicToken(event.target.value)}
                        />
                      </Field>
                      <Button
                        variant="primary"
                        size="md"
                        disabled={
                          magicLinkVerify.isPending ||
                          (!magicLinkStart.data && !hasMagicLinkQuery)
                        }
                        loading={magicLinkVerify.isPending}
                        onClick={() =>
                          magicLinkVerify.mutate(
                            {
                              challengeId:
                                magicLinkStart.data?.challenge_id ??
                                magicLinkChallengeId!,
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
                    </>
                  )}
                </Stack>
              </Card>
            </section>
          </>
        )}

        {/* -------------------------------------------------------------- */}
        {/* Error banners — shown as a stack below every state so a       */}
        {/* rate-limit or network error is always visible at the bottom   */}
        {/* of the scroll area, with role="alert" semantics inherited     */}
        {/* from the Banner atom (tone="danger").                          */}
        {/* -------------------------------------------------------------- */}
        {errors.length > 0 ? (
          <Stack gap={2}>
            {errors.map((error, index) => (
              <Banner key={index} tone="danger" title={t('verifyError')}>
                {error.message}
              </Banner>
            ))}
          </Stack>
        ) : null}

        {/* Success toast — role=status polite announcement that verification
            completed. Renders just above the fold for the ~800ms window
            between mutation success and router.replace. */}
        {verifySuccessToast ? (
          <Toast
            tone="success"
            title={verifySuccessToast}
            data-testid="verify-success-toast"
          />
        ) : null}
      </Stack>
    </>
  );
}
