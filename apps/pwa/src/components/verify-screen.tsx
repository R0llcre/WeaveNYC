'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import Link from 'next/link';

import { Banner, Button, Card, Field, Pill } from '@/components/ui';
import {
  useAppDispatch,
  useAppSelector,
  useMagicLinkStart,
  useMagicLinkVerify,
  useOtpStart,
  useOtpVerify,
} from '@/lib/hooks';
import { loadMatchContactIntent } from '@/lib/match-intent';
import { setSession } from '@/lib/slices/auth-slice';

export function VerifyScreen() {
  const t = useTranslations();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const session = useAppSelector((state) => state.auth.session);
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'otp' | 'magic'>('otp');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [magicToken, setMagicToken] = useState('');
  const [autoConsumedMagicLink, setAutoConsumedMagicLink] = useState(false);
  const [redirectedAfterVerify, setRedirectedAfterVerify] = useState(false);

  const otpStart = useOtpStart(session?.access_token);
  const otpVerify = useOtpVerify(session?.access_token);
  const magicLinkStart = useMagicLinkStart(session?.access_token);
  const magicLinkVerify = useMagicLinkVerify(session?.access_token);

  const alreadyVerified = session?.user.level === 'verified' || session?.user.level === 'anchor';
  const magicLinkChallengeId = searchParams.get('challenge_id') ?? searchParams.get('challengeId');
  const magicLinkQueryToken = searchParams.get('token');
  const hasMagicLinkQuery = Boolean(magicLinkChallengeId && magicLinkQueryToken);
  const returnTo = searchParams.get('return_to');

  const finishVerification = (nextSession: NonNullable<typeof session>) => {
    dispatch(setSession(nextSession));
    const intent = loadMatchContactIntent();
    const target = returnTo ?? intent?.returnTo ?? '/inbox';
    setRedirectedAfterVerify(true);
    router.replace(target);
  };

  useEffect(() => {
    if (!magicLinkChallengeId || !magicLinkQueryToken) {
      return;
    }

    setMode('magic');
    setMagicToken(magicLinkQueryToken);

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

  const errors = [otpStart.error, otpVerify.error, magicLinkStart.error, magicLinkVerify.error].filter(
    (err): err is Error => err instanceof Error,
  );

  return (
    <main className="shell">
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
