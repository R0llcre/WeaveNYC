'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Banner, Button, Card, Field, PageHeader, Pill } from '@/components/ui';
import { createAnonymousSession } from '@/lib/api';
import { useAppDispatch, useAppSelector, useCommunityAccessResolve, useJoinCommunity } from '@/lib/hooks';
import { parseScannedQrPayload, scanQrFromImageFile, scanQrFromVideo, supportsBarcodeDetector } from '@/lib/qr';
import { selectJoinPreview, selectSession } from '@/lib/selectors';
import { setSession } from '@/lib/slices/auth-slice';
import {
  clearJoinPreview,
  setJoinPreview,
  upsertJoinedCommunity,
} from '@/lib/slices/community-slice';

// Bug 6: the gateway reports invalid invite codes / qr tokens as HTTP 404 from
// requestJson(). We extract that to a typed signal so the UI can swap in the
// "code not recognized" copy + Start over button instead of the raw stack.
function isInvalidCodeError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return /HTTP 404|HTTP 400/i.test(error.message);
}

// Bug 3: on join-mutation failure we show an explicit "code expired, resolve
// again" banner. Auth / permission errors get a different copy so the user is
// not told to reuse the same code.
function isExpiredJoinError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return /HTTP 401|HTTP 403|HTTP 404|HTTP 409|HTTP 410/i.test(error.message);
}

export function CommunityJoinScreen() {
  const t = useTranslations();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const session = useAppSelector(selectSession);
  const joinPreview = useAppSelector(selectJoinPreview);
  const [mode, setMode] = useState<'invite' | 'qr'>('invite');
  const [inviteCode, setInviteCode] = useState('');
  const [qrToken, setQrToken] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [isCreatingSession, setCreatingSession] = useState(false);

  // F10: per-route document.title
  useEffect(() => {
    document.title = `${t('pageTitleCommunityJoin')} \u2014 WeaveNYC`;
  }, [t]);
  const [joinStaleError, setJoinStaleError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const resolveMutation = useCommunityAccessResolve(session?.access_token);
  const joinMutation = useJoinCommunity(session?.access_token);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const handleCreateSession = async () => {
    setCreatingSession(true);
    try {
      const nextSession = await createAnonymousSession();
      dispatch(setSession(nextSession));
    } finally {
      setCreatingSession(false);
    }
  };

  const handleModeChange = (nextMode: 'invite' | 'qr') => {
    setMode(nextMode);
    setJoinStaleError(null);
    dispatch(clearJoinPreview());
  };

  const handleInviteCodeChange = (value: string) => {
    setInviteCode(value);
    setJoinStaleError(null);
    dispatch(clearJoinPreview());
  };

  const handleQrTokenChange = (value: string) => {
    setQrToken(value);
    setJoinStaleError(null);
    dispatch(clearJoinPreview());
  };

  // Bug 6: a single place to reset all join state when the user asks to
  // "Start over" after an invalid-code error. Clears input, preview, and
  // cached mutation state so the form looks fresh.
  const handleStartOver = () => {
    setInviteCode('');
    setQrToken('');
    setCameraError(null);
    setJoinStaleError(null);
    resolveMutation.reset();
    joinMutation.reset();
    dispatch(clearJoinPreview());
  };

  const handleResolve = async () => {
    if (!session?.access_token) {
      return;
    }

    setJoinStaleError(null);
    dispatch(clearJoinPreview());
    try {
      const resolved = await resolveMutation.mutateAsync(
        mode === 'invite' ? { inviteCode } : { qrToken },
      );
      dispatch(
        setJoinPreview({
          community: resolved.community,
          joinToken: resolved.join_token,
          entry: resolved.entry,
          expiresInSeconds: resolved.expires_in_seconds,
        }),
      );
    } catch {
      // The mutation already exposes a user-facing error state; keep the stale preview cleared.
    }
  };

  // Bug 3 + Bug 4: wrap mutateAsync in try/catch so a join failure clears the
  // now-stale preview (the server considers the join_token consumed or the
  // invite expired) and surfaces a dedicated banner. React Query already
  // populates `joinMutation.error` before mutateAsync rejects, so we do not
  // need to re-throw — swallowing the rejection here keeps the click handler
  // (`void handleJoin()`) from leaking an unhandled rejection.
  const handleJoin = async () => {
    if (!session?.access_token || !joinPreview || joinMutation.isPending) {
      return;
    }

    try {
      const joined = await joinMutation.mutateAsync({
        communityId: joinPreview.community.community_id,
        joinToken: joinPreview.joinToken,
      });

      dispatch(
        upsertJoinedCommunity({
          community: joinPreview.community,
          joinedAt: joined.joined_at,
        }),
      );
      router.push('/community');
    } catch (error) {
      // Clear the stale preview so the user cannot click "Confirm join" again
      // with a spent join_token. The resolve flow has to be re-run to mint a
      // fresh one.
      dispatch(clearJoinPreview());
      const staleMessage = isExpiredJoinError(error)
        ? t('joinCodeExpiredBody')
        : error instanceof Error
          ? error.message
          : t('joinCodeExpiredBody');
      setJoinStaleError(staleMessage);
      // Do not re-throw; React Query's mutation state already tracks the
      // error via useMutation's internal onError handler.
    }
  };

  const startCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : t('qrUnsupported'));
    }
  };

  const captureFromCamera = async () => {
    if (!videoRef.current) {
      return;
    }

    try {
      const raw = await scanQrFromVideo(videoRef.current);
      const parsed = parseScannedQrPayload(raw);
      if (!parsed) {
        throw new Error(t('qrUnsupported'));
      }
      dispatch(clearJoinPreview());
      setMode(parsed.inviteCode ? 'invite' : 'qr');
      setInviteCode(parsed.inviteCode ?? '');
      setQrToken(parsed.qrToken ?? '');
      setCameraError(null);
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : t('qrUnsupported'));
    }
  };

  const handleUploadScan = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    try {
      const raw = await scanQrFromImageFile(file);
      const parsed = parseScannedQrPayload(raw);
      if (!parsed) {
        throw new Error(t('qrUnsupported'));
      }
      dispatch(clearJoinPreview());
      setMode(parsed.inviteCode ? 'invite' : 'qr');
      setInviteCode(parsed.inviteCode ?? '');
      setQrToken(parsed.qrToken ?? '');
      setCameraError(null);
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : t('qrUnsupported'));
    }
  };

  // Bug 5: derive the current step (1 enter code / 2 review community / 3
  // joining) from state so the visual progress tracks the real flow. We do
  // not persist step in state because it is a pure function of the other
  // flags below.
  const currentStep = useMemo<1 | 2 | 3>(() => {
    if (joinMutation.isPending) {
      return 3;
    }
    if (joinPreview) {
      return 2;
    }
    return 1;
  }, [joinMutation.isPending, joinPreview]);

  // Bug 6: show the "invalid code" empty state when resolve returned 404 /
  // 400. `joinMutation.error` does not trigger this path because that renders
  // a different banner (code expired). Only a fresh resolve failure counts.
  const showInvalidCodeEmpty = Boolean(
    resolveMutation.error && isInvalidCodeError(resolveMutation.error) && !joinPreview,
  );

  return (
    <main className="shell" id="main-content" tabIndex={-1}>
      <div className="shell__inner">
        <PageHeader
          eyebrow={t('joinCommunityCta')}
          title={t('joinTitle')}
          subtitle={t('joinCopy')}
          backHref="/community"
        />

        {!session ? (
          <Card as="section" className="card--verify">
            <div className="result-empty">
              <p>{t('joinNeedsSession')}</p>
              <div className="actions">
                <Button
                  variant="primary"
                  size="md"
                  data-testid="create-session"
                  disabled={isCreatingSession}
                  loading={isCreatingSession}
                  onClick={() => void handleCreateSession()}
                >
                  {isCreatingSession ? t('creatingSession') : t('createSession')}
                </Button>
                <Button as="a" variant="ghost" size="md" href="/">
                  {t('backHome')}
                </Button>
              </div>
            </div>
          </Card>
        ) : null}

        <Card as="section" className="card--verify">
          {/* Bug 5: step progress indicator. aria-label wraps the row so screen
              readers announce it as a single landmark. */}
          <nav
            className="tab-row"
            aria-label={t('joinStepsAriaLabel')}
            data-testid="join-step-progress"
          >
            <Pill active={currentStep === 1} data-testid="join-step-1" aria-current={currentStep === 1 ? 'step' : undefined}>
              {t('joinStep1Label')}
            </Pill>
            <Pill active={currentStep === 2} data-testid="join-step-2" aria-current={currentStep === 2 ? 'step' : undefined}>
              {t('joinStep2Label')}
            </Pill>
            <Pill active={currentStep === 3} data-testid="join-step-3" aria-current={currentStep === 3 ? 'step' : undefined}>
              {t('joinStep3Label')}
            </Pill>
          </nav>

          <div className="tab-row">
            <Pill
              active={mode === 'invite'}
              data-testid="join-mode-invite"
              onClick={() => handleModeChange('invite')}
            >
              {t('joinInviteMode')}
            </Pill>
            <Pill
              active={mode === 'qr'}
              data-testid="join-mode-qr"
              onClick={() => handleModeChange('qr')}
            >
              {t('joinQrMode')}
            </Pill>
          </div>

          {mode === 'invite' ? (
            <Field label={t('inviteCodeLabel')}>
              <input
                autoComplete="off"
                onChange={(event) => handleInviteCodeChange(event.target.value)}
                value={inviteCode}
              />
            </Field>
          ) : (
            <div className="verify-grid">
              <Field label={t('qrTokenLabel')}>
                <textarea
                  onChange={(event) => handleQrTokenChange(event.target.value)}
                  rows={3}
                  value={qrToken}
                />
              </Field>

              <div className="actions">
                <Button
                  variant="secondary"
                  size="md"
                  disabled={!supportsBarcodeDetector()}
                  onClick={() => void startCamera()}
                >
                  {t('qrScanCamera')}
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {t('qrScanUpload')}
                </Button>
                <input
                  ref={fileInputRef}
                  accept="image/*"
                  hidden
                  onChange={(event) => void handleUploadScan(event.target.files?.[0])}
                  type="file"
                />
              </div>

              {cameraReady ? (
                <div className="camera-panel">
                  <video
                    ref={videoRef}
                    className="camera-panel__video"
                    muted
                    playsInline
                    aria-label={t('joinCameraLabel')}
                  />
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => void captureFromCamera()}
                  >
                    {t('qrCapture')}
                  </Button>
                </div>
              ) : null}

              {cameraError ? (
                <Banner tone="warning" title={t('qrUnsupported')}>
                  {cameraError}
                </Banner>
              ) : null}
            </div>
          )}

          <div className="actions">
            {/* Bug 4: explicit disabled + loading for every submit path. */}
            <Button
              variant="primary"
              size="md"
              data-testid="resolve-community"
              disabled={
                !session?.access_token ||
                resolveMutation.isPending ||
                joinMutation.isPending ||
                (mode === 'invite' ? !inviteCode.trim() : !qrToken.trim())
              }
              loading={resolveMutation.isPending}
              onClick={() => void handleResolve()}
            >
              {t('resolveCommunityAction')}
            </Button>
            {joinPreview ? (
              <Button
                variant="ghost"
                size="md"
                disabled={joinMutation.isPending}
                onClick={() => dispatch(clearJoinPreview())}
              >
                {t('clearJoinPreview')}
              </Button>
            ) : null}
          </div>

          {/* Bug 6: invalid invite code / qr token gets a friendly empty-state
              with a "Start over" button instead of the raw HTTP 404 text. */}
          {showInvalidCodeEmpty ? (
            <Banner
              tone="warning"
              title={t('joinInvalidCodeTitle')}
              actionLabel={t('joinStartOver')}
              onAction={handleStartOver}
              data-testid="join-invalid-code"
            >
              {t('joinInvalidCodeBody')}
            </Banner>
          ) : resolveMutation.error ? (
            <Banner tone="danger" title={t('resourceLoadError')}>
              {resolveMutation.error instanceof Error ? resolveMutation.error.message : null}
            </Banner>
          ) : null}

          {/* Bug 3: stale preview / expired code banner after a failed join.
              This is a recoverable state (the user can start over and mint a
              fresh join token), so it fits the `warning` tone — `danger` is
              reserved for unrecoverable system errors. */}
          {joinStaleError ? (
            <Banner
              tone="warning"
              title={t('joinCodeExpiredTitle')}
              actionLabel={t('joinStartOver')}
              onAction={handleStartOver}
              data-testid="join-stale-error"
            >
              {joinStaleError}
            </Banner>
          ) : null}

          {joinPreview ? (
            <div className="result-block">
              <strong>{joinPreview.community.name}</strong>
              <p className="status-copy">
                {t('zipChip', { zip: joinPreview.community.center_zip })} · {joinPreview.entry}
              </p>
              <div className="actions">
                {/* Bug 4: extra guard for session token so a disconnected
                    tab cannot double-submit when the token was dropped. */}
                <Button
                  variant="primary"
                  size="md"
                  data-testid="confirm-join"
                  disabled={joinMutation.isPending || !session?.access_token}
                  loading={joinMutation.isPending}
                  onClick={() => void handleJoin()}
                >
                  {t('confirmJoinAction')}
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      </div>
    </main>
  );
}
