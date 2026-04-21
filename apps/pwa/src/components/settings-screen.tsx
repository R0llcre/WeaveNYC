'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Banner,
  Button,
  Card,
  Checkbox,
  Field,
  Inline,
  PageHeader,
  Pill,
  Radio,
  Stack,
  Tag,
} from '@/components/ui';
import {
  confirmAccountDeletion,
  requestAccountDeletion,
  undeleteAccount,
} from '@/lib/api';
import { useAppDispatch, useAppSelector, useCommunityP2PSync } from '@/lib/hooks';
import {
  selectCommunity,
  selectPreferences,
  selectSession,
} from '@/lib/selectors';
import { clearSession, setSession } from '@/lib/slices/auth-slice';
import { useSignOut } from '@/lib/use-sign-out';
import {
  setDefaultPostVisibility,
  setLanguage,
  setLocationPrecision,
  toggleLowBandwidth,
} from '@/lib/slices/preferences-slice';
import type {
  AccountDeleteReason,
  DefaultPostVisibility,
  LocationPrecision,
  SupportedLanguage,
  UserLevel,
} from '@/lib/types';

type TranslationKey = Parameters<ReturnType<typeof useTranslations>>[0];
type TranslationValues = Record<string, string | number | Date>;

const languageOptions: Array<{ value: SupportedLanguage; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'zh', label: '中文' },
];

const visibilityOptions: Array<{
  value: DefaultPostVisibility;
  labelKey: TranslationKey;
  hintKey: TranslationKey;
}> = [
  {
    value: 'community_only',
    labelKey: 'settingsVisibilityCommunity',
    hintKey: 'settingsVisibilityCommunityHint',
  },
  {
    value: 'public',
    labelKey: 'settingsVisibilityPublic',
    hintKey: 'settingsVisibilityPublicHint',
  },
  {
    value: 'anchor_mediated',
    labelKey: 'settingsVisibilityAnchor',
    hintKey: 'settingsVisibilityAnchorHint',
  },
];

const precisionOptions: Array<{
  value: LocationPrecision;
  labelKey: TranslationKey;
  hintKey: TranslationKey;
}> = [
  {
    value: 'zip_only',
    labelKey: 'settingsPrecisionZip',
    hintKey: 'settingsPrecisionZipHint',
  },
  {
    value: 'zip_and_neighborhood',
    labelKey: 'settingsPrecisionNeighborhood',
    hintKey: 'settingsPrecisionNeighborhoodHint',
  },
];

const reasonOptions: Array<{
  value: AccountDeleteReason;
  labelKey: TranslationKey;
}> = [
  { value: 'no_longer_needed', labelKey: 'deleteReasonNoLonger' },
  { value: 'privacy_concerns', labelKey: 'deleteReasonPrivacy' },
  { value: 'moving_away', labelKey: 'deleteReasonMoving' },
  { value: 'safety_concerns', labelKey: 'deleteReasonSafety' },
  { value: 'other', labelKey: 'deleteReasonOther' },
];

const levelTranslationKey: Record<UserLevel, TranslationKey> = {
  anonymous: 'settingsAccountLevelAnonymous',
  verified: 'settingsAccountLevelVerified',
  anchor: 'settingsAccountLevelAnchor',
};

/**
 * Recovery token retention window. We keep it in sessionStorage for
 * 10 minutes matching the pilot UX spec so a refresh in the same tab does
 * not strand the user, but a hard tab/browser close still drops the token.
 * After 10 minutes the "Undo" button disappears and the user can still
 * recover via the token issued to their phone / email, but not from this
 * screen.
 *
 * sessionStorage is chosen (not localStorage) because the token is a
 * short-lived credential and should not outlive the browser session.
 */
const RECOVERY_WINDOW_MS = 10 * 60 * 1000;

const RECOVERY_TOKEN_STORAGE_KEY = 'weavenyc_undelete_token';
const RECOVERY_USER_ID_STORAGE_KEY = 'weavenyc_undelete_user_id';
const RECOVERY_EXPIRES_AT_STORAGE_KEY = 'weavenyc_undelete_expires_at';
const RECOVERY_PURGE_DATE_STORAGE_KEY = 'weavenyc_undelete_purge_date';

const ONE_MINUTE_MS = 60 * 1000;

type DeleteState =
  | { kind: 'idle' }
  | { kind: 'expanded' }
  | { kind: 'requesting' }
  | {
      kind: 'challenge-sent';
      challengeId: string;
      maskedDestination: string;
    }
  | {
      kind: 'submitting';
      challengeId: string;
      maskedDestination: string;
    }
  | {
      kind: 'scheduled';
      purgeDate: string;
      userId: string;
      recoveryToken: string | null;
      recoveryExpiresAt: number | null;
    }
  | {
      kind: 'undoing';
      purgeDate: string;
      userId: string;
      recoveryToken: string | null;
      recoveryExpiresAt: number | null;
    }
  | {
      kind: 'undone';
    }
  | {
      kind: 'error';
      previous:
        | 'idle'
        | 'expanded'
        | 'challenge-sent'
        | 'submitting'
        | 'scheduled';
      messageKey: TranslationKey;
      values?: TranslationValues;
      challengeId?: string;
      maskedDestination?: string;
      purgeDate?: string;
      userId?: string;
      recoveryToken?: string | null;
      recoveryExpiresAt?: number | null;
    };

/** Persist the one-shot recovery token + its expiry to sessionStorage. */
function persistRecoveryToken(input: {
  token: string;
  userId: string;
  expiresAt: number;
  purgeDate: string;
}) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.sessionStorage.setItem(RECOVERY_TOKEN_STORAGE_KEY, input.token);
    window.sessionStorage.setItem(RECOVERY_USER_ID_STORAGE_KEY, input.userId);
    window.sessionStorage.setItem(
      RECOVERY_EXPIRES_AT_STORAGE_KEY,
      String(input.expiresAt),
    );
    window.sessionStorage.setItem(
      RECOVERY_PURGE_DATE_STORAGE_KEY,
      input.purgeDate,
    );
  } catch {
    // sessionStorage may be disabled (Safari Private, quota) — proceed
    // gracefully; the recovery token is still usable in-memory.
  }
}

/** Remove any persisted recovery token from sessionStorage. */
function clearPersistedRecoveryToken() {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.sessionStorage.removeItem(RECOVERY_TOKEN_STORAGE_KEY);
    window.sessionStorage.removeItem(RECOVERY_USER_ID_STORAGE_KEY);
    window.sessionStorage.removeItem(RECOVERY_EXPIRES_AT_STORAGE_KEY);
    window.sessionStorage.removeItem(RECOVERY_PURGE_DATE_STORAGE_KEY);
  } catch {
    // no-op
  }
}

/** Read a still-valid recovery token from sessionStorage, or null. */
function readPersistedRecoveryToken(): {
  token: string;
  userId: string;
  expiresAt: number;
  purgeDate: string;
} | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const token = window.sessionStorage.getItem(RECOVERY_TOKEN_STORAGE_KEY);
    const userId = window.sessionStorage.getItem(RECOVERY_USER_ID_STORAGE_KEY);
    const expiresAtRaw = window.sessionStorage.getItem(
      RECOVERY_EXPIRES_AT_STORAGE_KEY,
    );
    const purgeDate = window.sessionStorage.getItem(
      RECOVERY_PURGE_DATE_STORAGE_KEY,
    );
    const expiresAt = Number(expiresAtRaw ?? 0);
    if (!token || !userId || !expiresAtRaw || !purgeDate) {
      return null;
    }
    if (!Number.isFinite(expiresAt) || Date.now() >= expiresAt) {
      // Expired — best-effort cleanup so subsequent mounts don't see it.
      clearPersistedRecoveryToken();
      return null;
    }
    return { token, userId, expiresAt, purgeDate };
  } catch {
    return null;
  }
}

/**
 * Map an HTTP-failure Error (thrown by `requestJson` as "path failed: HTTP
 * XXX body") onto the right i18n key. The server messages are not shown
 * directly because they are currently only in English.
 */
function mapDeleteError(error: unknown): TranslationKey {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('HTTP 401')) {
    return 'deleteAuthError';
  }
  if (message.includes('HTTP 429')) {
    return 'errorRateLimit';
  }
  if (message.includes('HTTP 400')) {
    return 'deleteOtpInvalid';
  }
  if (message.includes('last_anchor_blocks_delete') || message.includes('HTTP 409')) {
    return 'deleteLastAnchorError';
  }
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'errorNetwork';
  }
  return 'deleteGenericError';
}

export function SettingsScreen() {
  const t = useTranslations();
  const dispatch = useAppDispatch();
  const signOut = useSignOut();
  const preferences = useAppSelector(selectPreferences);
  const session = useAppSelector(selectSession);
  const communityState = useAppSelector(selectCommunity);

  const handleSignOutAllDevices = useCallback(() => {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(t('meSignOutAllDevicesConfirm'));
      if (!confirmed) {
        return;
      }
    }
    void signOut({ revokeAllDevices: true });
  }, [signOut, t]);

  // P6 UX — surface current-community P2P sync controls inside Settings
  // so users can enable/disable community sync from this screen (parity
  // with the `/community` toggle). If the user is not in any community,
  // the subsection renders a "Not in a community yet" line instead.
  const currentCommunity = useMemo(
    () =>
      communityState.joinedCommunities.find(
        (item) => item.community.community_id === communityState.currentCommunityId,
      )?.community ?? null,
    [communityState.currentCommunityId, communityState.joinedCommunities],
  );
  const p2pSync = useCommunityP2PSync(
    session?.access_token,
    currentCommunity?.community_id ?? null,
  );

  const [deleteState, setDeleteState] = useState<DeleteState>({ kind: 'idle' });
  const [otpCode, setOtpCode] = useState('');
  const [deleteReason, setDeleteReason] = useState<AccountDeleteReason | ''>('');
  const [now, setNow] = useState(() => Date.now());

  // F10: per-route document.title
  useEffect(() => {
    document.title = `${t('pageTitleSettings')} \u2014 WeaveNYC`;
  }, [t]);

  // Bug 1: restore persisted recovery token on mount so a tab refresh during
  // the 10-minute window still shows the "Undo" affordance. We only rehydrate
  // if the token is present AND the window has not yet elapsed; otherwise we
  // fall through to the normal idle state.
  useEffect(() => {
    const persisted = readPersistedRecoveryToken();
    if (!persisted) {
      return;
    }
    setDeleteState({
      kind: 'scheduled',
      purgeDate: persisted.purgeDate,
      userId: persisted.userId,
      recoveryToken: persisted.token,
      recoveryExpiresAt: persisted.expiresAt,
    });
  }, []);

  // Bug 2: tick every second while the recovery window is open so the visible
  // countdown stays in sync. Previously this was 15s which was fine for the
  // "hide the button at expiry" use case but too coarse for a live "X min Y
  // sec left" label. The timer only runs while a token is active.
  useEffect(() => {
    if (
      deleteState.kind !== 'scheduled' &&
      deleteState.kind !== 'undoing'
    ) {
      return;
    }
    if (!deleteState.recoveryExpiresAt) {
      return;
    }
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(id);
    };
  }, [deleteState]);

  // Bug 1: once the window elapses, drop the persisted token so the next
  // mount doesn't briefly show the stale state before the tick fires.
  useEffect(() => {
    if (
      (deleteState.kind === 'scheduled' || deleteState.kind === 'undoing') &&
      deleteState.recoveryExpiresAt &&
      deleteState.recoveryExpiresAt <= now
    ) {
      clearPersistedRecoveryToken();
    }
  }, [deleteState, now]);

  const recoveryWindowOpen = useMemo(() => {
    if (deleteState.kind !== 'scheduled' && deleteState.kind !== 'undoing') {
      return false;
    }
    if (!deleteState.recoveryToken || !deleteState.recoveryExpiresAt) {
      return false;
    }
    return deleteState.recoveryExpiresAt > now;
  }, [deleteState, now]);

  // Bug 2: derive visible countdown + warning tone when < 1 minute. When the
  // window has already closed we show the "expired" copy instead; the Undo
  // button itself is suppressed by `recoveryWindowOpen` above.
  const countdownView = useMemo<
    | { kind: 'open'; minutes: number; seconds: number; warning: boolean }
    | { kind: 'expired' }
    | null
  >(() => {
    if (
      (deleteState.kind !== 'scheduled' && deleteState.kind !== 'undoing') ||
      !deleteState.recoveryExpiresAt ||
      !deleteState.recoveryToken
    ) {
      return null;
    }
    const remaining = deleteState.recoveryExpiresAt - now;
    if (remaining <= 0) {
      return { kind: 'expired' };
    }
    const totalSeconds = Math.max(0, Math.floor(remaining / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return {
      kind: 'open',
      minutes,
      seconds,
      warning: remaining < ONE_MINUTE_MS,
    };
  }, [deleteState, now]);

  const handleExpandDangerZone = useCallback(() => {
    setDeleteState((prev) => (prev.kind === 'idle' ? { kind: 'expanded' } : prev));
  }, []);

  const handleStartDeletion = useCallback(async () => {
    if (!session?.access_token) {
      setDeleteState({
        kind: 'error',
        previous: 'expanded',
        messageKey: 'deleteAuthError',
      });
      return;
    }
    setDeleteState({ kind: 'requesting' });
    try {
      const challenge = await requestAccountDeletion(session.access_token);
      setDeleteState({
        kind: 'challenge-sent',
        challengeId: challenge.challenge_id,
        maskedDestination: challenge.masked_destination,
      });
    } catch (error) {
      setDeleteState({
        kind: 'error',
        previous: 'expanded',
        messageKey: mapDeleteError(error),
      });
    }
  }, [session?.access_token]);

  const handleConfirmDeletion = useCallback(async () => {
    if (!session?.access_token) {
      setDeleteState({
        kind: 'error',
        previous: 'challenge-sent',
        messageKey: 'deleteAuthError',
      });
      return;
    }
    if (deleteState.kind !== 'challenge-sent' && deleteState.kind !== 'error') {
      return;
    }
    const challengeId = deleteState.challengeId;
    const maskedDestination = deleteState.maskedDestination;
    if (!challengeId || !otpCode.trim()) {
      return;
    }

    setDeleteState({
      kind: 'submitting',
      challengeId,
      maskedDestination: maskedDestination ?? '',
    });
    try {
      const result = await confirmAccountDeletion(session.access_token, {
        challenge_id: challengeId,
        code: otpCode.trim(),
        ...(deleteReason ? { reason: deleteReason } : {}),
      });
      const recoveryToken = result.undelete_recovery_token ?? null;
      const recoveryExpiresAt = recoveryToken
        ? Date.now() + RECOVERY_WINDOW_MS
        : null;
      // Bug 1: persist to sessionStorage so a tab refresh within the 10-min
      // window rehydrates the Undo affordance. Missing token means the server
      // did not issue one (e.g. demo mode) — nothing to persist.
      if (recoveryToken && recoveryExpiresAt) {
        persistRecoveryToken({
          token: recoveryToken,
          userId: result.user_id,
          expiresAt: recoveryExpiresAt,
          purgeDate: result.purge_date,
        });
      }
      setDeleteState({
        kind: 'scheduled',
        purgeDate: result.purge_date,
        userId: result.user_id,
        recoveryToken,
        recoveryExpiresAt,
      });
      setOtpCode('');
      // The access token is now revoked server-side; drop it from the store
      // so subsequent renders don't show authenticated chrome.
      dispatch(clearSession());
    } catch (error) {
      setDeleteState({
        kind: 'error',
        previous: 'submitting',
        messageKey: mapDeleteError(error),
        challengeId,
        maskedDestination,
      });
    }
  }, [deleteReason, deleteState, dispatch, otpCode, session?.access_token]);

  const handleResendCode = useCallback(async () => {
    await handleStartDeletion();
  }, [handleStartDeletion]);

  const handleUndoDeletion = useCallback(async () => {
    if (deleteState.kind !== 'scheduled' || !deleteState.recoveryToken) {
      return;
    }
    const { userId, recoveryToken, purgeDate, recoveryExpiresAt } = deleteState;
    setDeleteState({
      kind: 'undoing',
      userId,
      purgeDate,
      recoveryToken,
      recoveryExpiresAt,
    });
    try {
      await undeleteAccount('', {
        user_id: userId,
        recovery_token: recoveryToken,
      });
      // Bug 1: once the token is consumed server-side, remove it from
      // sessionStorage so it is not replayed after a refresh.
      clearPersistedRecoveryToken();
      setDeleteState({ kind: 'undone' });
      // The user must sign in again — we can't restore the original access
      // token — but we restore the pre-delete session data that we kept so
      // the UI shell doesn't appear stranded.
      if (session) {
        dispatch(setSession(session));
      }
    } catch (error) {
      setDeleteState({
        kind: 'error',
        previous: 'scheduled',
        messageKey: mapDeleteError(error),
        userId,
        purgeDate,
        recoveryToken,
        recoveryExpiresAt,
      });
    }
  }, [deleteState, dispatch, session]);

  const handleRetryAfterError = useCallback(() => {
    if (deleteState.kind !== 'error') {
      return;
    }
    switch (deleteState.previous) {
      case 'expanded':
        setDeleteState({ kind: 'expanded' });
        return;
      case 'challenge-sent':
      case 'submitting':
        if (deleteState.challengeId && deleteState.maskedDestination) {
          setDeleteState({
            kind: 'challenge-sent',
            challengeId: deleteState.challengeId,
            maskedDestination: deleteState.maskedDestination,
          });
          return;
        }
        setDeleteState({ kind: 'expanded' });
        return;
      case 'scheduled':
        if (
          deleteState.purgeDate &&
          deleteState.userId &&
          deleteState.recoveryToken !== undefined
        ) {
          setDeleteState({
            kind: 'scheduled',
            purgeDate: deleteState.purgeDate,
            userId: deleteState.userId,
            recoveryToken: deleteState.recoveryToken,
            recoveryExpiresAt: deleteState.recoveryExpiresAt ?? null,
          });
          return;
        }
        setDeleteState({ kind: 'idle' });
        return;
      default:
        setDeleteState({ kind: 'idle' });
    }
  }, [deleteState]);

  const handleBackToIdle = useCallback(() => {
    setDeleteState({ kind: 'idle' });
    setOtpCode('');
  }, []);

  // Bug 6: the `undone` state now shows a detailed banner with a CTA to
  // /verify, so we no longer force-redirect to "/" after 1.5s. The user taps
  // through when they are ready.

  const accountLevelLabel = session
    ? t(levelTranslationKey[session.user.level])
    : t('settingsAccountLevelNone');

  const dangerZoneOpen = deleteState.kind !== 'idle';

  // Bug 5: localize the purge date using the active language. Falls back to
  // the default locale if the Intl runtime rejects the BCP-47 tag.
  const formattedPurgeDate = useMemo(() => {
    if (deleteState.kind !== 'scheduled' && deleteState.kind !== 'undoing') {
      return '';
    }
    const raw = new Date(deleteState.purgeDate);
    if (Number.isNaN(raw.getTime())) {
      return deleteState.purgeDate;
    }
    try {
      return raw.toLocaleDateString(preferences.language, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return raw.toLocaleDateString();
    }
  }, [deleteState, preferences.language]);

  return (
    <div className="page-content" data-screen="settings">
      <PageHeader
        eyebrow={t('settingsBackHome')}
        title={t('settingsTitle')}
        subtitle={t('settingsSafetyCopy')}
        backHref="/"
      />

        <div id="language" aria-hidden="true" />
        <Card aria-labelledby="settings-language-heading">
          <h2 id="settings-language-heading">{t('settingsLanguageTitle')}</h2>
          <div className="language-row">
            {languageOptions.map((option) => (
              <Pill
                key={option.value}
                data-testid={`settings-language-select-${option.value}`}
                active={preferences.language === option.value}
                onClick={() => dispatch(setLanguage(option.value))}
              >
                {option.label}
              </Pill>
            ))}
          </div>
          <p className="muted" data-testid="settings-language-select">
            {t('settingsLanguageHint')}
          </p>
        </Card>

        <div id="privacy" aria-hidden="true" />
        <Card aria-labelledby="settings-privacy-heading">
          <h2 id="settings-privacy-heading">{t('settingsPrivacyTitle')}</h2>

          <fieldset className="field">
            <legend>{t('settingsPostVisibilityLegend')}</legend>
            {visibilityOptions.map((option) => (
              <Radio
                key={option.value}
                name="default-visibility"
                value={option.value}
                label={t(option.labelKey)}
                hint={t(option.hintKey)}
                checked={preferences.defaultPostVisibility === option.value}
                onChange={() => dispatch(setDefaultPostVisibility(option.value))}
              />
            ))}
          </fieldset>

          <fieldset className="field">
            <legend>{t('settingsLocationPrecisionLegend')}</legend>
            {precisionOptions.map((option) => (
              <Radio
                key={option.value}
                name="location-precision"
                value={option.value}
                label={t(option.labelKey)}
                hint={t(option.hintKey)}
                checked={preferences.locationPrecision === option.value}
                onChange={() => dispatch(setLocationPrecision(option.value))}
              />
            ))}
          </fieldset>

          <Checkbox
            label={t('settingsLowBandwidthLabel')}
            hint={t('settingsLowBandwidthHint')}
            checked={preferences.lowBandwidth}
            onChange={() => dispatch(toggleLowBandwidth())}
          />

          {/*
            P6 UX — Community sync subsection. Mirrors the toggle that lives
            on `/community` so users can opt out from Settings (the spec
            `docs/03_User_Flows_And_Screens.md:241` promised a status note
            here but the earlier wave shipped without it — audit finding 4
            + 12). When the user is not in any community we show a short
            "not in a community yet" line instead of the toggle so the
            subsection is still informative.
          */}
          <Stack
            gap={3}
            as="section"
            aria-labelledby="settings-p2p-heading"
            data-testid="settings-p2p-section"
          >
            <Stack gap={1}>
              <h3 id="settings-p2p-heading" className="text-h3">
                {t('settingsP2PSectionTitle')}
              </h3>
              <p className="muted">{t('settingsP2PSectionCopy')}</p>
            </Stack>

            {currentCommunity ? (
              <>
                <Inline gap={2} align="center" wrap>
                  <span className="overline">{t('settingsP2PPhaseLabel')}</span>
                  <Tag tone={p2pSync.status.enabled ? 'verified' : 'muted'}>
                    {p2pSync.status.phase === 'auth_required' ||
                    p2pSync.status.phase === 'forbidden'
                      ? t('p2pPhase_offline')
                      : t(`p2pPhase_${p2pSync.status.phase}`)}
                  </Tag>
                </Inline>
                <Inline gap={3} wrap>
                  <Button
                    variant="secondary"
                    size="md"
                    data-testid="settings-p2p-toggle"
                    disabled={!session}
                    onClick={() => {
                      if (p2pSync.status.enabled) {
                        p2pSync.disable();
                        return;
                      }
                      p2pSync.enable();
                    }}
                  >
                    {p2pSync.status.enabled
                      ? t('p2pDisableAction')
                      : t('p2pEnableAction')}
                  </Button>
                </Inline>
              </>
            ) : (
              <p className="muted" data-testid="settings-p2p-not-in-community">
                {t('settingsP2PNotInCommunity')}
              </p>
            )}

            <details className="settings-p2p-explainer">
              <summary>{t('settingsP2PLearnMore')}</summary>
              <p>{t('p2pExplainerBody')}</p>
            </details>
          </Stack>
        </Card>

        <Card aria-labelledby="settings-safety-heading">
          <h2 id="settings-safety-heading">{t('settingsSafetyTitle')}</h2>
          <p className="muted">{t('settingsSafetyCopy')}</p>
          <div className="action-row">
            <Button as="a" variant="secondary" href="/inbox/">
              {t('settingsOpenInbox')}
            </Button>
          </div>
        </Card>

        <Card aria-labelledby="settings-account-heading">
          <h2 id="settings-account-heading">{t('settingsAccountTitle')}</h2>
          <dl className="meta-list">
            <div>
              <dt>{t('settingsAccountLevel')}</dt>
              <dd>{accountLevelLabel}</dd>
            </div>
            {session ? (
              <div>
                <dt>{t('settingsAccountUserId', { userId: session.user.user_id })}</dt>
                <dd className="muted">{session.user.user_id}</dd>
              </div>
            ) : null}
          </dl>

          {/* A1 P1-7 — "Clear all devices" revokes EVERY session family
              for this user on the gateway, not just the current tab. A
              user who suspects their refresh token has been copied uses
              this to force re-auth everywhere. `meSignOutHint` still
              documents the "this device only" default (/me screen);
              this action is the nuclear option. */}
          {session ? (
            <div className="action-row">
              <Button
                variant="secondary"
                size="md"
                data-testid="settings-sign-out-all-devices"
                onClick={handleSignOutAllDevices}
              >
                {t('meSignOutAllDevicesAction')}
              </Button>
            </div>
          ) : null}

          <details
            className="danger-zone"
            open={dangerZoneOpen}
            onToggle={(event) => {
              if (event.currentTarget.open) {
                handleExpandDangerZone();
              } else if (deleteState.kind === 'expanded') {
                handleBackToIdle();
              }
            }}
          >
            <summary>{t('deleteAccountSummary')}</summary>
            <p>{t('deleteAccountBody')}</p>
            {/*
              P6 UX finding 6 — the server purge flow hides posts server-side
              but peer devices still hold copies that refresh on their own
              cadence. Surface this so users have informed consent before
              scheduling a delete. Rendered as a small muted paragraph
              rather than a banner because it is a qualifier, not an alert.
            */}
            <p className="muted" data-testid="settings-delete-p2p-notice">
              {t('deleteAccountP2PNotice')}
            </p>

            {(deleteState.kind === 'idle' ||
              deleteState.kind === 'expanded' ||
              deleteState.kind === 'requesting') && (
              <>
                {/* Bug 3: wrap the reason select in <Field> so the label is
                    always visible (not only on focus) and the hint explains
                    that the field is optional. */}
                <Field
                  label={t('deleteAccountReasonLabel')}
                  hint={t('deleteAccountReasonHint')}
                >
                  <select
                    data-testid="settings-delete-reason"
                    onChange={(event) =>
                      setDeleteReason(
                        event.target.value as AccountDeleteReason | '',
                      )
                    }
                    value={deleteReason}
                  >
                    <option value="">{t('deleteAccountReasonPlaceholder')}</option>
                    {reasonOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="action-row">
                  <Button
                    data-testid="settings-delete-start"
                    variant="danger"
                    size="lg"
                    loading={deleteState.kind === 'requesting'}
                    disabled={!session?.access_token || deleteState.kind === 'requesting'}
                    onClick={handleStartDeletion}
                  >
                    {deleteState.kind === 'requesting'
                      ? t('deleteRequestSending')
                      : t('deleteRequestButton')}
                  </Button>
                </div>
              </>
            )}

            {(deleteState.kind === 'challenge-sent' ||
              deleteState.kind === 'submitting') && (
              <>
                <Banner
                  tone="info"
                  title={t('deleteOtpSent')}
                >
                  {deleteState.maskedDestination}
                </Banner>
                {/* Bug 4: previously this Field used `deleteAccountBody` as
                    its hint, which both duplicated the <p> above and confused
                    the key's role. The intended hint is the OTP-expiry copy
                    that lives on `deleteOtpSent`, which the Banner already
                    shows. No hint here is the correct fix. */}
                <Field label={t('deleteOtpCodeLabel')}>
                  <input
                    data-testid="settings-delete-otp-input"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={6}
                    onChange={(event) =>
                      setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    type="text"
                    value={otpCode}
                  />
                </Field>
                <div className="action-row">
                  <Button
                    data-testid="settings-delete-confirm"
                    variant="danger"
                    size="lg"
                    loading={deleteState.kind === 'submitting'}
                    disabled={deleteState.kind === 'submitting' || otpCode.length < 4}
                    onClick={handleConfirmDeletion}
                    // Wave 6C — destructive confirmation that cannot be
                    // undone deserves the strongest tactile cue on tap.
                    haptic
                  >
                    {deleteState.kind === 'submitting'
                      ? t('deleteOtpVerifying')
                      : t('deleteOtpVerifyButton')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="md"
                    disabled={deleteState.kind === 'submitting'}
                    onClick={handleResendCode}
                  >
                    {t('deleteOtpResend')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="md"
                    disabled={deleteState.kind === 'submitting'}
                    onClick={handleBackToIdle}
                  >
                    {t('buttonCancel')}
                  </Button>
                </div>
              </>
            )}

            {(deleteState.kind === 'scheduled' ||
              deleteState.kind === 'undoing') && (
              <>
                <Banner
                  tone="warning"
                  title={t('deleteScheduled')}
                >
                  {/* Bug 5: interpolate the localized purge date so the line
                      reads naturally in EN/ES/ZH. */}
                  {t('deleteScheduledPurge', { purgeDate: formattedPurgeDate })}
                </Banner>
                {/* Bug 2: live countdown + warning tone when < 1 min. */}
                {countdownView?.kind === 'open' ? (
                  <Banner
                    data-testid="settings-delete-countdown"
                    tone={countdownView.warning ? 'warning' : 'info'}
                    title={
                      countdownView.warning
                        ? t('undeleteCountdownShort')
                        : t('undeleteCountdownLong', {
                            minutes: countdownView.minutes,
                            seconds: countdownView.seconds,
                          })
                    }
                  />
                ) : null}
                {countdownView?.kind === 'expired' ? (
                  <Banner
                    data-testid="settings-delete-countdown-expired"
                    tone="info"
                    title={t('undeleteExpired')}
                  />
                ) : null}
                {recoveryWindowOpen ? (
                  <div className="action-row">
                    <Button
                      data-testid="settings-delete-undo"
                      variant="secondary"
                      size="lg"
                      loading={deleteState.kind === 'undoing'}
                      disabled={deleteState.kind === 'undoing'}
                      onClick={handleUndoDeletion}
                    >
                      {t('deleteUndeleteLink')}
                    </Button>
                  </div>
                ) : null}
              </>
            )}

            {deleteState.kind === 'undone' && (
              <>
                <Banner
                  data-testid="settings-delete-undone"
                  tone="success"
                  title={t('undeleteSuccessTitle')}
                >
                  {t('undeleteSuccessBody')}
                </Banner>
                {/* Bug 6: explicit re-bind CTA. We don't auto-redirect so the
                    user can read the banner before navigating. */}
                <div className="action-row">
                  <Button
                    as="a"
                    variant="primary"
                    data-testid="settings-delete-undone-reverify"
                    href="/verify/"
                  >
                    {t('undeleteReverifyCta')}
                  </Button>
                </div>
              </>
            )}

            {deleteState.kind === 'error' && (
              <Banner
                tone="danger"
                title={t(deleteState.messageKey, deleteState.values)}
                actionLabel={t('buttonRetry')}
                onAction={handleRetryAfterError}
              />
            )}
          </details>
        </Card>

        <Card aria-labelledby="settings-help-heading">
          <h2 id="settings-help-heading">{t('settingsHelpTitle')}</h2>
          <ul className="link-list">
            <li>
              <Link href="/inbox/">{t('settingsHelpReport')}</Link>
            </li>
            <li>{t('settingsVersion', { version: 'M8 pilot' })}</li>
          </ul>
        </Card>
    </div>
  );
}
