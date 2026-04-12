'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

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

  return (
    <main className="shell">
      <div className="shell__inner">
        <section className="hero hero--detail">
          <div className="hero__topbar">
            <span className="hero__eyebrow">{t('verifyTitle')}</span>
            <Link className="hero__link" href="/">
              {t('backHome')}
            </Link>
          </div>
          <h1 data-testid="verify-title">{t('verifyTitle')}</h1>
          <p>{t('verifyCopy')}</p>
        </section>

        <section className="card card--verify">
          {!session && !hasMagicLinkQuery ? <div className="result-empty">{t('verifyNeedsSession')}</div> : null}

          {alreadyVerified ? (
            <div className="result-empty">
              <p className="status-copy">{t('verificationDone')}</p>
            </div>
          ) : (
            <>
              <div className="tab-row">
                <button
                  className={`pill ${mode === 'otp' ? 'pill--active' : ''}`}
                  onClick={() => setMode('otp')}
                  type="button"
                >
                  {t('otpTab')}
                </button>
                <button
                  className={`pill ${mode === 'magic' ? 'pill--active' : ''}`}
                  onClick={() => setMode('magic')}
                  type="button"
                >
                  {t('magicLinkTab')}
                </button>
              </div>

              {mode === 'otp' ? (
                <div className="verify-grid">
                  <label className="field">
                    <span>{t('phoneLabel')}</span>
                    <input onChange={(event) => setPhone(event.target.value)} placeholder="+15165550101" value={phone} />
                  </label>
                  <div className="actions">
                    <button
                      className="button button--primary"
                      data-testid="send-code"
                      disabled={!session || otpStart.isPending}
                      onClick={() => otpStart.mutate({ phone })}
                      type="button"
                    >
                      {t('sendCode')}
                    </button>
                  </div>
                  {otpStart.data?.demo_code ? (
                    <p className="status-copy">
                      {t('demoCodeLabel')}: <strong>{otpStart.data.demo_code}</strong>
                    </p>
                  ) : null}
                  <label className="field">
                    <span>{t('codeLabel')}</span>
                    <input onChange={(event) => setOtpCode(event.target.value)} value={otpCode} />
                  </label>
                  <button
                    className="button button--primary"
                    data-testid="verify-code"
                    disabled={!session || otpVerify.isPending || !otpStart.data}
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
                    type="button"
                  >
                    {t('verifyCode')}
                  </button>
                </div>
              ) : (
                <div className="verify-grid">
                  <label className="field">
                    <span>{t('emailLabel')}</span>
                    <input
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="neighbor@example.com"
                      value={email}
                    />
                  </label>
                  <div className="actions">
                  <button
                    className="button button--primary"
                    disabled={!session || magicLinkStart.isPending}
                    onClick={() => magicLinkStart.mutate({ email })}
                    type="button"
                  >
                      {t('sendLink')}
                    </button>
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
                  <label className="field">
                    <span>{t('tokenLabel')}</span>
                    <input onChange={(event) => setMagicToken(event.target.value)} value={magicToken} />
                  </label>
                  <button
                    className="button button--primary"
                    disabled={magicLinkVerify.isPending || (!magicLinkStart.data && !hasMagicLinkQuery)}
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
                    type="button"
                  >
                    {t('useDemoLink')}
                  </button>
                </div>
              )}
            </>
          )}

          {[otpStart.error, otpVerify.error, magicLinkStart.error, magicLinkVerify.error].map((error, index) =>
            error ? (
              <p className="status-copy status-copy--error" key={index}>
                {error instanceof Error ? error.message : t('verifyError')}
              </p>
            ) : null,
          )}
        </section>
      </div>
    </main>
  );
}
