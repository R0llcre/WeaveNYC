'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Banner,
  Button,
  Card,
  Checkbox,
  Field,
  PageHeader,
  Pill,
  Radio,
} from '@/components/ui';
import {
  confirmAccountDeletion,
  requestAccountDeletion,
  undeleteAccount,
} from '@/lib/api';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { clearSession, setSession } from '@/lib/slices/auth-slice';
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
 * Recovery token retention window. We deliberately keep it only in memory for
 * 10 minutes matching the pilot UX spec — after that the "Undo" button
 * disappears and the user can still recover via the token issued to their
 * phone / email, but not from this screen. Never persisted to storage.
 */
const RECOVERY_WINDOW_MS = 10 * 60 * 1000;

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
  const router = useRouter();
  const preferences = useAppSelector((state) => state.preferences);
  const session = useAppSelector((state) => state.auth.session);

  const [deleteState, setDeleteState] = useState<DeleteState>({ kind: 'idle' });
  const [otpCode, setOtpCode] = useState('');
  const [deleteReason, setDeleteReason] = useState<AccountDeleteReason | ''>('');
  const [now, setNow] = useState(() => Date.now());

  // Tick every 15s so the recovery window can disappear without a re-render
  // from unrelated state. The timer is only running while a token is active.
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
    }, 15_000);
    return () => {
      window.clearInterval(id);
    };
  }, [deleteState]);

  const recoveryWindowOpen = useMemo(() => {
    if (deleteState.kind !== 'scheduled' && deleteState.kind !== 'undoing') {
      return false;
    }
    if (!deleteState.recoveryToken || !deleteState.recoveryExpiresAt) {
      return false;
    }
    return deleteState.recoveryExpiresAt > now;
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
      setDeleteState({
        kind: 'scheduled',
        purgeDate: result.purge_date,
        userId: result.user_id,
        recoveryToken,
        recoveryExpiresAt: recoveryToken ? Date.now() + RECOVERY_WINDOW_MS : null,
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

  useEffect(() => {
    if (deleteState.kind === 'undone') {
      const id = window.setTimeout(() => {
        router.replace('/');
      }, 1500);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [deleteState.kind, router]);

  const accountLevelLabel = session
    ? t(levelTranslationKey[session.user.level])
    : t('settingsAccountLevelNone');

  const dangerZoneOpen = deleteState.kind !== 'idle';

  return (
    <main className="shell">
      <div className="shell__inner">
        <PageHeader
          eyebrow={t('settingsBackHome')}
          title={t('settingsTitle')}
          subtitle={t('settingsSafetyCopy')}
          backHref="/"
        />

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
        </Card>

        <Card aria-labelledby="settings-safety-heading">
          <h2 id="settings-safety-heading">{t('settingsSafetyTitle')}</h2>
          <p className="muted">{t('settingsSafetyCopy')}</p>
          <div className="action-row">
            <Link className="button button--secondary" href="/inbox">
              {t('settingsOpenInbox')}
            </Link>
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

            {(deleteState.kind === 'idle' ||
              deleteState.kind === 'expanded' ||
              deleteState.kind === 'requesting') && (
              <>
                <Field label={t('deleteAccountReasonLabel')}>
                  <select
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
                    disabled={!session || deleteState.kind === 'requesting'}
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
                <Field
                  label={t('deleteOtpCodeLabel')}
                  hint={t('deleteAccountBody')}
                >
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
                  {t('deleteScheduledPurge', {
                    purgeDate: new Date(deleteState.purgeDate).toLocaleDateString(),
                  })}
                </Banner>
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
              <Banner tone="success" title={t('undeleteSuccess')} />
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
              <Link href="/inbox">{t('settingsHelpReport')}</Link>
            </li>
            <li>{t('settingsVersion', { version: 'M8 pilot' })}</li>
          </ul>
        </Card>
      </div>
    </main>
  );
}
