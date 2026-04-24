/**
 * Danger zone — 3-step account deletion flow.
 *
 * Mobile port of `apps/pwa/src/components/me-screen.tsx` danger block +
 * `apps/pwa/src/app/me/danger/page.tsx`. The screen owns the three steps
 * sequentially:
 *
 *   1. confirm — explanatory copy + "Start delete" CTA.
 *   2. verify  — OTP input posted to `/v1/account/delete/confirm`.
 *   3. done    — success banner with 30-day undo notice + "Back" CTA.
 *
 * API wiring goes straight through `requestAccountDeletion` and
 * `confirmAccountDeletion` from `@/lib/api` (both already ported to the
 * mobile app). Error handling maps HTTP-status strings (`HTTP 401` / `HTTP
 * 400` / `HTTP 429` / `last_anchor_blocks_delete`) to dedicated i18n keys.
 * The PWA's 10-minute in-memory recovery-token + undo UX is intentionally
 * NOT ported: we direct the user to the email link for undo, which keeps
 * the mobile flow tight.
 */

import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Banner,
  Button,
  Card,
  Field,
  Inline,
  PageHeader,
  Stack,
  Toast,
} from '@/components/ui';
import { loadNamespace } from '@/i18n';
import type { Resources } from '@/i18n/types';
import { confirmAccountDeletion, requestAccountDeletion } from '@/lib/api';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { getBiometricLockEnabled } from '@/lib/persistence';
import { selectSession } from '@/lib/selectors';
import { clearSession } from '@/lib/slices/auth-slice';
import {
  authenticateBiometric,
  useBiometricSupport,
} from '@/lib/use-biometric-unlock';
import { useAppTheme } from '@/theme';

type MeKey = keyof Resources['me'];

type Step =
  | { kind: 'confirm' }
  | { kind: 'requesting' }
  | {
      kind: 'otp';
      challengeId: string;
      maskedDestination: string;
    }
  | {
      kind: 'submitting';
      challengeId: string;
      maskedDestination: string;
    }
  | { kind: 'done'; purgeDate: string }
  | {
      kind: 'error';
      previous: 'confirm' | 'otp' | 'done';
      messageKey: MeKey;
      challengeId?: string;
      maskedDestination?: string;
      purgeDate?: string;
    };

/**
 * Map a thrown Error's `message` onto the right i18n key. Mirrors the PWA
 * mapping; anything we don't recognise falls back to the generic error.
 */
function mapDeleteError(error: unknown): MeKey {
  const message = error instanceof Error ? error.message : '';
  if (/HTTP 401/i.test(message)) return 'deleteAuthError';
  if (/HTTP 400/i.test(message)) return 'deleteOtpInvalid';
  if (/HTTP 429/i.test(message)) return 'deleteRateLimitError';
  if (/last_anchor_blocks_delete|HTTP 409/i.test(message)) {
    return 'deleteLastAnchorError';
  }
  return 'deleteGenericError';
}

export default function DangerScreen() {
  // Split namespaces so each `t` keeps autocomplete narrow to its bundle.
  // A combined `useTranslation(['me','chrome'])` widens keys and defeats
  // the compile-time guard on i18n key names.
  const { t } = useTranslation('me');
  const { t: tChrome } = useTranslation('chrome');
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const session = useAppSelector(selectSession);

  const [step, setStep] = useState<Step>({ kind: 'confirm' });
  const [otpCode, setOtpCode] = useState('');
  const biometric = useBiometricSupport();

  useEffect(() => {
    void loadNamespace('me');
  }, []);

  const handleStart = useCallback(async () => {
    if (!session?.access_token) {
      setStep({
        kind: 'error',
        previous: 'confirm',
        messageKey: 'deleteAuthError',
      });
      return;
    }

    // Gate the destructive OTP request behind Face ID / Touch ID when the
    // user has both (a) turned the biometric lock on and (b) enrolled a
    // biometric on this device. Unenrolled users fall through to the
    // existing OTP-only flow so we don't lock them out of their own
    // deletion path.
    if (biometric.enrolled) {
      const enabled = await getBiometricLockEnabled();
      if (enabled) {
        const ok = await authenticateBiometric(t('dangerUnlockReason'));
        if (!ok) {
          setStep({
            kind: 'error',
            previous: 'confirm',
            messageKey: 'deleteAuthError',
          });
          return;
        }
      }
    }

    setStep({ kind: 'requesting' });
    try {
      const challenge = await requestAccountDeletion(session.access_token);
      setStep({
        kind: 'otp',
        challengeId: challenge.challenge_id,
        maskedDestination: challenge.masked_destination,
      });
    } catch (error) {
      setStep({
        kind: 'error',
        previous: 'confirm',
        messageKey: mapDeleteError(error),
      });
    }
  }, [biometric.enrolled, session?.access_token, t]);

  const handleConfirm = useCallback(async () => {
    if (step.kind !== 'otp' && step.kind !== 'error') return;
    if (!session?.access_token) {
      setStep({
        kind: 'error',
        previous: 'otp',
        messageKey: 'deleteAuthError',
      });
      return;
    }
    const challengeId =
      step.kind === 'otp' ? step.challengeId : step.challengeId;
    const maskedDestination =
      step.kind === 'otp' ? step.maskedDestination : step.maskedDestination;
    if (!challengeId || otpCode.trim().length < 4) return;

    setStep({
      kind: 'submitting',
      challengeId,
      maskedDestination: maskedDestination ?? '',
    });
    try {
      const result = await confirmAccountDeletion(session.access_token, {
        challenge_id: challengeId,
        code: otpCode.trim(),
      });
      setOtpCode('');
      // Server has revoked our access token — clear the session so the rest
      // of the app renders the signed-out shell when the user returns.
      dispatch(clearSession());
      setStep({ kind: 'done', purgeDate: result.purge_date });
    } catch (error) {
      setStep({
        kind: 'error',
        previous: 'otp',
        messageKey: mapDeleteError(error),
        challengeId,
        maskedDestination,
      });
    }
  }, [dispatch, otpCode, session?.access_token, step]);

  const handleRetry = useCallback(() => {
    if (step.kind !== 'error') return;
    switch (step.previous) {
      case 'confirm':
        setStep({ kind: 'confirm' });
        return;
      case 'otp':
        if (step.challengeId) {
          setStep({
            kind: 'otp',
            challengeId: step.challengeId,
            maskedDestination: step.maskedDestination ?? '',
          });
          return;
        }
        setStep({ kind: 'confirm' });
        return;
      default:
        setStep({ kind: 'confirm' });
    }
  }, [step]);

  const handleCancel = useCallback(() => {
    setStep({ kind: 'confirm' });
    setOtpCode('');
  }, []);

  const handleExit = useCallback(() => {
    router.back();
  }, []);

  const colors = theme.colors as Record<string, string>;
  const spacing = theme.spacing as unknown as Record<
    'xs' | 's' | 'sm' | 'm' | 'l' | 'xl',
    number
  >;

  return (
    <ScrollView
      testID="danger-screen"
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        paddingTop: insets.top,
        paddingBottom: insets.bottom + spacing.xl,
        paddingHorizontal: spacing.l,
      }}
    >
      <PageHeader
        title={t('meDangerTitle')}
        onBack={() => router.back()}
        backAccessibilityLabel={tChrome('shellBackButton')}
        testID="danger-header"
      />

      <Stack gap="l">
        {/* Step 1 — confirm */}
        {(step.kind === 'confirm' ||
          step.kind === 'requesting' ||
          (step.kind === 'error' && step.previous === 'confirm')) && (
          <Card testID="danger-step-confirm">
            <Stack gap="s">
              <Text style={[styles.h3, { color: colors.inkPrimary }]}>
                {t('meDeleteStep1Title')}
              </Text>
              <Text style={[styles.body, { color: colors.inkSecondary }]}>
                {t('meDeleteStep1Subtitle')}
              </Text>
              <Banner tone="warning" title={t('deleteAccountSummary')}>
                {t('deleteAccountBody')}
              </Banner>
              {step.kind === 'error' ? (
                <Banner
                  testID="danger-step-confirm-error"
                  tone="danger"
                  title={t(step.messageKey)}
                  actionLabel={tChrome('buttonRetry')}
                  onAction={handleRetry}
                />
              ) : null}
              <Inline gap="s" wrap>
                <Button
                  testID="danger-start"
                  variant="danger"
                  size="lg"
                  loading={step.kind === 'requesting'}
                  disabled={step.kind === 'requesting' || !session?.access_token}
                  onPress={() => {
                    void handleStart();
                  }}
                >
                  {step.kind === 'requesting'
                    ? t('deleteRequestSending')
                    : t('meDeleteStep1Cta')}
                </Button>
                <Button
                  testID="danger-cancel"
                  variant="ghost"
                  size="md"
                  onPress={handleExit}
                >
                  {tChrome('buttonCancel')}
                </Button>
              </Inline>
            </Stack>
          </Card>
        )}

        {/* Step 2 — OTP verify */}
        {(step.kind === 'otp' ||
          step.kind === 'submitting' ||
          (step.kind === 'error' && step.previous === 'otp')) && (
          <Card testID="danger-step-otp">
            <Stack gap="s">
              <Text style={[styles.h3, { color: colors.inkPrimary }]}>
                {t('meDeleteStep2Title')}
              </Text>
              <Banner tone="info" title={t('deleteOtpSent')}>
                {step.kind === 'error'
                  ? step.maskedDestination ?? ''
                  : step.maskedDestination}
              </Banner>
              <Field
                testID="danger-otp-input"
                label={t('deleteOtpCodeLabel')}
                value={otpCode}
                onChangeText={(next) => setOtpCode(next.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                placeholder="123456"
              />
              {step.kind === 'error' ? (
                <Banner
                  testID="danger-step-otp-error"
                  tone="danger"
                  title={t(step.messageKey)}
                  actionLabel={tChrome('buttonRetry')}
                  onAction={handleRetry}
                />
              ) : null}
              <Inline gap="s" wrap>
                <Button
                  testID="danger-confirm"
                  variant="danger"
                  size="lg"
                  loading={step.kind === 'submitting'}
                  disabled={step.kind === 'submitting' || otpCode.length < 4}
                  onPress={() => {
                    void handleConfirm();
                  }}
                  haptic
                >
                  {step.kind === 'submitting'
                    ? t('deleteOtpVerifying')
                    : t('meDeleteStep2Cta')}
                </Button>
                <Button
                  testID="danger-otp-cancel"
                  variant="ghost"
                  size="md"
                  disabled={step.kind === 'submitting'}
                  onPress={handleCancel}
                >
                  {tChrome('buttonCancel')}
                </Button>
              </Inline>
            </Stack>
          </Card>
        )}

        {/* Step 3 — done.
            `deleteScheduled` is the "account hidden, 30-day undo still
            available" banner copy already shipped in the `me` namespace;
            `deleteScheduledPurge` interpolates the purge date. We reuse
            these instead of introducing step3-specific keys so the i18n
            parity check stays green without a locale tree update. */}
        {step.kind === 'done' ? (
          <>
            <Card testID="danger-step-done">
              <Stack gap="s">
                <Text style={[styles.h3, { color: colors.inkPrimary }]}>
                  {t('deleteScheduled')}
                </Text>
                <Banner tone="success" title={t('deleteScheduled')}>
                  {t('deleteScheduledPurge', { purgeDate: step.purgeDate })}
                </Banner>
                <Text style={[styles.body, { color: colors.inkSecondary }]}>
                  {t('deleteAccountBody')}
                </Text>
                <Button
                  testID="danger-done-exit"
                  variant="primary"
                  size="md"
                  onPress={handleExit}
                >
                  {tChrome('buttonClose')}
                </Button>
              </Stack>
            </Card>
            <Toast
              tone="success"
              message={t('deleteOtpSent')}
              testID="danger-toast"
              dismissLabel={tChrome('commonDismiss')}
            />
          </>
        ) : null}
      </Stack>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h3: {
    fontSize: 18,
    fontWeight: '600',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
});
