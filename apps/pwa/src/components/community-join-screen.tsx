'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { Banner, Button, Card, Field, PageHeader, Pill } from '@/components/ui';
import { createAnonymousSession } from '@/lib/api';
import { useAppDispatch, useAppSelector, useCommunityAccessResolve, useJoinCommunity } from '@/lib/hooks';
import { parseScannedQrPayload, scanQrFromImageFile, scanQrFromVideo, supportsBarcodeDetector } from '@/lib/qr';
import { setSession } from '@/lib/slices/auth-slice';
import {
  clearJoinPreview,
  setJoinPreview,
  upsertJoinedCommunity,
} from '@/lib/slices/community-slice';

export function CommunityJoinScreen() {
  const t = useTranslations();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const session = useAppSelector((state) => state.auth.session);
  const joinPreview = useAppSelector((state) => state.community.joinPreview);
  const [mode, setMode] = useState<'invite' | 'qr'>('invite');
  const [inviteCode, setInviteCode] = useState('');
  const [qrToken, setQrToken] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
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
    dispatch(clearJoinPreview());
  };

  const handleInviteCodeChange = (value: string) => {
    setInviteCode(value);
    dispatch(clearJoinPreview());
  };

  const handleQrTokenChange = (value: string) => {
    setQrToken(value);
    dispatch(clearJoinPreview());
  };

  const handleResolve = async () => {
    if (!session?.access_token) {
      return;
    }

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

  const handleJoin = async () => {
    if (!session?.access_token || !joinPreview) {
      return;
    }

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

  return (
    <main className="shell">
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
                  disabled={creatingSession}
                  loading={creatingSession}
                  onClick={() => void handleCreateSession()}
                >
                  {creatingSession ? t('creatingSession') : t('createSession')}
                </Button>
                <Link className="button button--ghost button--md" href="/">
                  {t('backHome')}
                </Link>
              </div>
            </div>
          </Card>
        ) : null}

        <Card as="section" className="card--verify">
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
                <label className="button button--secondary button--md file-button">
                  <input
                    accept="image/*"
                    hidden
                    onChange={(event) => void handleUploadScan(event.target.files?.[0])}
                    type="file"
                  />
                  {t('qrScanUpload')}
                </label>
              </div>

              {cameraReady ? (
                <div className="camera-panel">
                  <video ref={videoRef} className="camera-panel__video" muted playsInline />
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
            <Button
              variant="primary"
              size="md"
              data-testid="resolve-community"
              disabled={
                !session?.access_token ||
                resolveMutation.isPending ||
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
                onClick={() => dispatch(clearJoinPreview())}
              >
                {t('clearJoinPreview')}
              </Button>
            ) : null}
          </div>

          {resolveMutation.error ? (
            <Banner tone="danger" title={t('resourceLoadError')}>
              {resolveMutation.error instanceof Error ? resolveMutation.error.message : null}
            </Banner>
          ) : null}

          {joinPreview ? (
            <div className="result-block">
              <strong>{joinPreview.community.name}</strong>
              <p className="status-copy">
                {t('zipChip', { zip: joinPreview.community.center_zip })} · {joinPreview.entry}
              </p>
              <div className="actions">
                <Button
                  variant="primary"
                  size="md"
                  data-testid="confirm-join"
                  disabled={joinMutation.isPending}
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
