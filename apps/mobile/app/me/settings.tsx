/**
 * Settings screen — user preferences + "delete my data" entry.
 *
 * Mobile port of `apps/pwa/src/components/settings-screen.tsx` (the ~1k LOC
 * version is the PWA's union of settings + full delete-flow). On mobile we
 * split responsibilities: this screen owns only the preferences surface
 * (ZIP, language, push, low-bandwidth, location precision, post visibility)
 * and links out to `/me/danger` for the actual delete flow. Phase 2 keeps
 * the push toggle as a local preference; Phase 3 wires APNs registration.
 */

import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Banner,
  Button,
  Card,
  Field,
  Inline,
  PageHeader,
  Radio,
  RadioGroup,
  Stack,
} from '@/components/ui';
import { loadNamespace, setLocale, type AppLocale } from '@/i18n';
import type { Resources } from '@/i18n/types';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import {
  disablePushLocally,
  loadPersistedPushToken,
  registerForPushNotifications,
} from '@/lib/push-notifications';
import { selectPreferences, selectSession } from '@/lib/selectors';
import {
  setDefaultPostVisibility,
  setLanguage,
  setLocationPrecision,
  setZipCode,
  toggleLowBandwidth,
} from '@/lib/slices/preferences-slice';
import { useAppTheme } from '@/theme';
import type {
  DefaultPostVisibility,
  LocationPrecision,
  SupportedLanguage,
  UserLevel,
} from '@/lib/types';

const LANG_OPTIONS: Array<{
  value: SupportedLanguage;
  locale: AppLocale;
  label: string;
}> = [
  { value: 'en', locale: 'en', label: 'English' },
  { value: 'es', locale: 'es', label: 'Español' },
  { value: 'zh', locale: 'zh-Hans', label: '中文' },
];

type MeKey = keyof Resources['me'];

const VISIBILITY_OPTIONS: Array<{
  value: DefaultPostVisibility;
  labelKey: MeKey;
  hintKey: MeKey;
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

const PRECISION_OPTIONS: Array<{
  value: LocationPrecision;
  labelKey: MeKey;
  hintKey: MeKey;
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

const LEVEL_KEY: Record<UserLevel, MeKey> = {
  anonymous: 'settingsAccountLevelAnonymous',
  verified: 'settingsAccountLevelVerified',
  anchor: 'settingsAccountLevelAnchor',
};

/** ZIP validation — 5-digit US format. Empty string is allowed (clears). */
function validateZip(value: string): string | null {
  if (!value) return null;
  if (!/^\d{5}$/.test(value)) return 'invalidZip';
  return null;
}

export default function SettingsScreen() {
  // Two hook instances so each `t` keeps compile-time autocomplete narrow
  // to its own namespace. A single `useTranslation(['me','chrome'])` call
  // would widen keys to the union of both bundles, defeating the type guard.
  const { t } = useTranslation('me');
  const { t: tChrome } = useTranslation('chrome');
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const prefs = useAppSelector(selectPreferences);
  const session = useAppSelector(selectSession);

  // Local draft for the ZIP field so typing doesn't thrash Redux on every
  // keystroke. We only commit on blur or when the 5-digit pattern matches.
  const [zipDraft, setZipDraft] = useState(prefs.zipCode ?? '');
  const [zipError, setZipError] = useState<string | null>(null);

  // P3-A — push toggle now wires through to the real APNs pipeline.
  // We hydrate from the persisted MMKV row on mount so toggling off in
  // one session stays off after a cold start.
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushPending, setPushPending] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  useEffect(() => {
    void loadNamespace('me');
  }, []);

  // Restore the persisted push state on mount so a returning user whose
  // token is already registered sees the toggle in the right position.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const persisted = await loadPersistedPushToken();
      if (cancelled) return;
      setPushEnabled(
        persisted?.pushPermissionStatus === 'granted' &&
          persisted.pushToken.length > 0,
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePushToggle = useCallback(
    async (next: boolean) => {
      if (pushPending) return;
      if (!next) {
        setPushPending(true);
        setPushError(null);
        try {
          await disablePushLocally();
          setPushEnabled(false);
        } catch (error) {
          setPushError(
            error instanceof Error ? error.message : 'Could not disable push',
          );
        } finally {
          setPushPending(false);
        }
        return;
      }

      if (!session?.access_token) {
        setPushError('Sign in to enable notifications.');
        return;
      }

      setPushPending(true);
      setPushError(null);
      try {
        const token = await registerForPushNotifications(session.access_token, {
          deviceId: session.user.user_id,
          locale: prefs.language,
        });
        setPushEnabled(Boolean(token));
        if (!token) {
          // Permission denied or native module unavailable — leave the
          // toggle off and tell the user they need to flip it in iOS
          // Settings > Notifications. Hard-coded English here matches the
          // rest of the push card (Phase 3-D will move these to a locale
          // namespace).
          setPushError(
            'Notifications are off in iOS Settings. Open Settings > WeaveNYC > Notifications to allow.',
          );
        }
      } catch (error) {
        setPushError(
          error instanceof Error ? error.message : 'Could not enable push',
        );
      } finally {
        setPushPending(false);
      }
    },
    [prefs.language, pushPending, session?.access_token, session?.user.user_id],
  );

  // Re-sync the ZIP draft if the store value changes from elsewhere
  // (e.g. onboarding writes it back after we mount).
  useEffect(() => {
    setZipDraft(prefs.zipCode ?? '');
  }, [prefs.zipCode]);

  const handleZipChange = useCallback((next: string) => {
    const digits = next.replace(/\D/g, '').slice(0, 5);
    setZipDraft(digits);
    setZipError(null);
  }, []);

  const handleZipCommit = useCallback(() => {
    const err = validateZip(zipDraft);
    if (err) {
      setZipError(err);
      return;
    }
    dispatch(setZipCode(zipDraft));
  }, [dispatch, zipDraft]);

  const handleLanguageChange = useCallback(
    (next: string) => {
      const option = LANG_OPTIONS.find((o) => o.value === next);
      if (!option) return;
      dispatch(setLanguage(option.value));
      void setLocale(option.locale);
    },
    [dispatch],
  );

  const handleVisibilityChange = useCallback(
    (next: string) => {
      dispatch(setDefaultPostVisibility(next as DefaultPostVisibility));
    },
    [dispatch],
  );

  const handlePrecisionChange = useCallback(
    (next: string) => {
      dispatch(setLocationPrecision(next as LocationPrecision));
    },
    [dispatch],
  );

  const level: UserLevel = session?.user.level ?? 'anonymous';
  const levelLabel = t(LEVEL_KEY[level]);

  const colors = theme.colors as Record<string, string>;
  // `noUncheckedIndexedAccess` widens every lookup to `T | undefined`. Cast
  // to a narrow literal record so the three keys this screen actually reads
  // are guaranteed-present at the type level.
  const spacing = theme.spacing as unknown as Record<
    'xs' | 's' | 'sm' | 'm' | 'l' | 'xl',
    number
  >;

  return (
    <ScrollView
      testID="settings-screen"
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        paddingTop: insets.top,
        paddingBottom: insets.bottom + spacing.xl,
        paddingHorizontal: spacing.l,
      }}
    >
      <PageHeader
        title={t('settingsTitle')}
        onBack={() => router.back()}
        backAccessibilityLabel={t('settingsBackHome')}
        testID="settings-header"
      />

      <Stack gap="l">
        {/* Account summary */}
        <Card testID="settings-account-card">
          <Stack gap="xs">
            <Text style={[styles.cardTitle, { color: colors.inkPrimary }]}>
              {t('settingsAccountTitle')}
            </Text>
            <Text style={[styles.caption, { color: colors.inkSecondary }]}>
              {t('settingsAccountLevel')}: {levelLabel}
            </Text>
          </Stack>
        </Card>

        {/* ZIP */}
        <Card testID="settings-zip-card">
          <Stack gap="s">
            <Text style={[styles.cardTitle, { color: colors.inkPrimary }]}>
              {t('settingsPrecisionZip')}
            </Text>
            <Field
              testID="settings-zip-input"
              label={t('settingsPrecisionZip')}
              hint={t('settingsPrecisionZipHint')}
              error={zipError ? t('settingsPrecisionZipHint') : undefined}
              value={zipDraft}
              onChangeText={handleZipChange}
              keyboardType="number-pad"
              placeholder="10001"
            />
            <Button
              testID="settings-zip-save"
              variant="secondary"
              size="md"
              onPress={handleZipCommit}
              disabled={zipDraft === (prefs.zipCode ?? '') || zipDraft.length !== 5}
            >
              {tChrome('buttonContinue')}
            </Button>
          </Stack>
        </Card>

        {/* Language */}
        <Card testID="settings-language-card">
          <Stack gap="s">
            <Text style={[styles.cardTitle, { color: colors.inkPrimary }]}>
              {t('settingsLanguageTitle')}
            </Text>
            <Text style={[styles.caption, { color: colors.inkSecondary }]}>
              {t('settingsLanguageHint')}
            </Text>
            <RadioGroup
              testID="settings-language-group"
              value={prefs.language}
              onChange={handleLanguageChange}
              accessibilityLabel={t('settingsLanguageTitle')}
            >
              <Stack gap="xs">
                {LANG_OPTIONS.map((option) => (
                  <Radio
                    key={option.value}
                    testID={`settings-language-select-${option.value}`}
                    value={option.value}
                    label={option.label}
                  />
                ))}
              </Stack>
            </RadioGroup>
          </Stack>
        </Card>

        {/* Push notifications (P3-A) — wired through to the real APNs
            pipeline. Copy intentionally stays inline English; when the
            Phase 3-D polish wave lands the rest of the settings copy in
            `me.*`, these strings move into that namespace alongside. */}
        <Card testID="settings-push-card">
          <Stack gap="s">
            <Inline gap="s" justify="between" align="center">
              <Stack gap="xs" style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.inkPrimary }]}>
                  Push notifications
                </Text>
                <Text style={[styles.caption, { color: colors.inkSecondary }]}>
                  Let WeaveNYC send you a buzz when a new post matches your needs.
                </Text>
              </Stack>
              <Switch
                testID="settings-push-toggle"
                value={pushEnabled}
                disabled={pushPending}
                onValueChange={(next) => {
                  void handlePushToggle(next);
                }}
                thumbColor={colors.surface}
              />
            </Inline>
            {pushError ? (
              <Banner tone="warning" title="Push notifications">
                {pushError}
              </Banner>
            ) : null}
          </Stack>
        </Card>

        {/* Low bandwidth */}
        <Card testID="settings-bandwidth-card">
          <Inline gap="s" justify="between" align="center">
            <Stack gap="xs" style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.inkPrimary }]}>
                {t('settingsLowBandwidthLabel')}
              </Text>
              <Text style={[styles.caption, { color: colors.inkSecondary }]}>
                {t('settingsLowBandwidthHint')}
              </Text>
            </Stack>
            <Switch
              testID="settings-bandwidth-toggle"
              value={prefs.lowBandwidth}
              onValueChange={() => {
                dispatch(toggleLowBandwidth());
              }}
              thumbColor={colors.surface}
            />
          </Inline>
        </Card>

        {/* Location precision */}
        <Card testID="settings-precision-card">
          <Stack gap="s">
            <Text style={[styles.cardTitle, { color: colors.inkPrimary }]}>
              {t('settingsLocationPrecisionLegend')}
            </Text>
            <RadioGroup
              testID="settings-precision-group"
              value={prefs.locationPrecision}
              onChange={handlePrecisionChange}
              accessibilityLabel={t('settingsLocationPrecisionLegend')}
            >
              <Stack gap="xs">
                {PRECISION_OPTIONS.map((option) => (
                  <Radio
                    key={option.value}
                    testID={`settings-precision-${option.value}`}
                    value={option.value}
                    label={t(option.labelKey)}
                    hint={t(option.hintKey)}
                  />
                ))}
              </Stack>
            </RadioGroup>
          </Stack>
        </Card>

        {/* Post visibility */}
        <Card testID="settings-visibility-card">
          <Stack gap="s">
            <Text style={[styles.cardTitle, { color: colors.inkPrimary }]}>
              {t('settingsPostVisibilityLegend')}
            </Text>
            <RadioGroup
              testID="settings-visibility-group"
              value={prefs.defaultPostVisibility}
              onChange={handleVisibilityChange}
              accessibilityLabel={t('settingsPostVisibilityLegend')}
            >
              <Stack gap="xs">
                {VISIBILITY_OPTIONS.map((option) => (
                  <Radio
                    key={option.value}
                    testID={`settings-visibility-${option.value}`}
                    value={option.value}
                    label={t(option.labelKey)}
                    hint={t(option.hintKey)}
                  />
                ))}
              </Stack>
            </RadioGroup>
          </Stack>
        </Card>

        {/* Safety advisory */}
        <Banner tone="info" title={t('settingsSafetyTitle')}>
          {t('settingsSafetyCopy')}
        </Banner>

        {/* Delete my data */}
        <Card testID="settings-delete-card">
          <Stack gap="s">
            <Text style={[styles.cardTitle, { color: colors.inkPrimary }]}>
              {t('meDangerTitle')}
            </Text>
            <Text style={[styles.caption, { color: colors.inkSecondary }]}>
              {t('meDangerSubtitle')}
            </Text>
            <View style={{ alignSelf: 'flex-start' }}>
              <Button
                testID="settings-delete-link"
                variant="danger"
                size="md"
                onPress={() => router.push('/me/danger')}
              >
                {t('meActionDeleteAccount')}
              </Button>
            </View>
          </Stack>
        </Card>
      </Stack>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
  },
});
