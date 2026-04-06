'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

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
        <section className="hero hero--detail">
          <div className="hero__topbar">
            <span className="hero__eyebrow">{t('joinCommunityCta')}</span>
            <Link className="hero__link" href="/community">
              {t('backHome')}
            </Link>
          </div>
          <h1>{t('joinTitle')}</h1>
          <p>{t('joinCopy')}</p>
        </section>

        {!session ? (
          <section className="card card--verify">
            <div className="result-empty">
              <p>{t('joinNeedsSession')}</p>
              <div className="actions">
                <button className="button button--primary" disabled={creatingSession} onClick={() => void handleCreateSession()} type="button">
                  {creatingSession ? t('creatingSession') : t('createSession')}
                </button>
                <Link className="button button--secondary" href="/">
                  {t('backHome')}
                </Link>
              </div>
            </div>
          </section>
        ) : null}

        <section className="card card--verify">
          <div className="tab-row">
            <button className={`pill ${mode === 'invite' ? 'pill--active' : ''}`} onClick={() => handleModeChange('invite')} type="button">
              {t('joinInviteMode')}
            </button>
            <button className={`pill ${mode === 'qr' ? 'pill--active' : ''}`} onClick={() => handleModeChange('qr')} type="button">
              {t('joinQrMode')}
            </button>
          </div>

          {mode === 'invite' ? (
            <label className="field">
              <span>{t('inviteCodeLabel')}</span>
              <input onChange={(event) => handleInviteCodeChange(event.target.value)} value={inviteCode} />
            </label>
          ) : (
            <div className="verify-grid">
              <label className="field">
                <span>{t('qrTokenLabel')}</span>
                <textarea onChange={(event) => handleQrTokenChange(event.target.value)} rows={3} value={qrToken} />
              </label>

              <div className="actions">
                <button className="button button--secondary" disabled={!supportsBarcodeDetector()} onClick={() => void startCamera()} type="button">
                  {t('qrScanCamera')}
                </button>
                <label className="button button--secondary file-button">
                  <input accept="image/*" hidden onChange={(event) => void handleUploadScan(event.target.files?.[0])} type="file" />
                  {t('qrScanUpload')}
                </label>
              </div>

              {cameraReady ? (
                <div className="camera-panel">
                  <video ref={videoRef} className="camera-panel__video" muted playsInline />
                  <button className="button button--primary" onClick={() => void captureFromCamera()} type="button">
                    {t('qrCapture')}
                  </button>
                </div>
              ) : null}

              {cameraError ? <p className="status-copy status-copy--error">{cameraError}</p> : null}
            </div>
          )}

          <div className="actions">
            <button
              className="button button--primary"
              disabled={!session?.access_token || resolveMutation.isPending || (mode === 'invite' ? !inviteCode.trim() : !qrToken.trim())}
              onClick={() => void handleResolve()}
              type="button"
            >
              {t('resolveCommunityAction')}
            </button>
            {joinPreview ? (
              <button className="button button--secondary" onClick={() => dispatch(clearJoinPreview())} type="button">
                {t('clearJoinPreview')}
              </button>
            ) : null}
          </div>

          {resolveMutation.error ? (
            <p className="status-copy status-copy--error">
              {resolveMutation.error instanceof Error ? resolveMutation.error.message : t('resourceLoadError')}
            </p>
          ) : null}

          {joinPreview ? (
            <div className="result-block">
              <strong>{joinPreview.community.name}</strong>
              <p className="status-copy">
                {t('zipChip', { zip: joinPreview.community.center_zip })} · {joinPreview.entry}
              </p>
              <div className="actions">
                <button className="button button--primary" disabled={joinMutation.isPending} onClick={() => void handleJoin()} type="button">
                  {t('confirmJoinAction')}
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
