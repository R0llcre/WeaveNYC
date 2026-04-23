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

  // Push is a local-only preference in Phase 2 (APNs registration ships in
  // Phase 3). We persist under a local state hook; wiring this into Redux
  // would waste a slot that Phase 3 will rename to `pushRegistrationId`.
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    void loadNamespace('me');
  }, []);

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

        {/* Push notifications (Phase 2 stub) — the copy here is intentionally
            inline English because Phase 3 renames this preference to
            `pushRegistrationId` and will add the locale-tree keys alongside.
            Adding keys now would leak a half-built i18n surface into the
            shipped bundle. */}
        <Card testID="settings-push-card">
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
              onValueChange={setPushEnabled}
              thumbColor={colors.surface}
            />
          </Inline>
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
