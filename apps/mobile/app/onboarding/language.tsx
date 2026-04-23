/**
 * Onboarding · Language picker — S6.
 *
 * Port of `apps/pwa/src/components/language-picker-screen.tsx`. Three big
 * tappable rows labelled IN THEIR OWN TARGET LANGUAGE so the user
 * recognises the script they'll see once they tap — a well-known pattern
 * for multilingual first-run flows (iOS Setup, Google Maps, Duolingo).
 *
 * On select:
 *   1. `i18n.changeLanguage(code)` — swap the active locale so every
 *      subsequent string (trust bullets, location copy) renders in the
 *      picked language without waiting for a re-mount.
 *   2. `dispatch(setLanguage(code))` — persist to the preferences slice.
 *      The slice's reducer also flips `hasUserChosenLanguage=true`, which
 *      is the signal the root layout guard reads to fast-forward past the
 *      picker on auto-detected locales.
 *   3. `router.push('/onboarding/trust')` — advance to the trust step.
 *      Using `push` (not `replace`) keeps the back button active on the
 *      trust screen so a user who mis-taps can correct the language
 *      choice in one tap.
 *
 * testid preservation (§7 of the PWA Wave 5A plan):
 *   - `onboarding-language-en|es|zh` — stable E2E hook. iOS Detox specs
 *     added later in Phase 2 (S9+) will reuse these values, so keep the
 *     codes literal.
 *
 * V1-B Task 1 — the PWA auto-skips this screen when the browser locale
 * was already detected. On mobile the equivalent hook is the root layout
 * redirect: if `hasUserChosenLanguage === true` the guard in
 * `app/_layout.tsx` sends the user straight to `/onboarding/trust`, so
 * this screen only ever renders when the user genuinely needs to pick.
 */

import { router } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, Stack } from '@/components/ui';
import i18n, { loadNamespace, setLocale, type AppLocale } from '@/i18n';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { selectPreferencesLanguage } from '@/lib/selectors';
import { setLanguage } from '@/lib/slices/preferences-slice';
import type { SupportedLanguage } from '@/lib/types';
import { useAppTheme } from '@/theme';

import { OnboardingPressableRow } from './_components';

/**
 * Each option carries:
 *   - `value`: the Redux language code that `setLanguage` dispatches.
 *     Note: the Redux SupportedLanguage union is `'en' | 'es' | 'zh'`,
 *     while the i18n locale ids are `'en' | 'es' | 'zh-Hans'`. The
 *     helper below maps between them.
 *   - `i18nLocale`: the locale passed to `i18n.changeLanguage`.
 *   - `nativeLabel`: rendered verbatim on the row. Intentionally NOT
 *     translated because the whole point of a language picker is that
 *     each label appears in the language it represents.
 *   - `descriptionKey`: i18n key for the micro description under the
 *     native label. This string IS translated into the CURRENT UI
 *     language so a Spanish-speaking user reading the picker in Spanish
 *     sees "Continuar en inglés" under the English card.
 */
type LanguageOption = {
  value: SupportedLanguage;
  i18nLocale: AppLocale;
  nativeLabel: string;
  descriptionKey:
    | 'onboardingLanguageContinueEn'
    | 'onboardingLanguageContinueEs'
    | 'onboardingLanguageContinueZh';
};

const LANGUAGE_OPTIONS: ReadonlyArray<LanguageOption> = [
  {
    value: 'en',
    i18nLocale: 'en',
    nativeLabel: 'English',
    descriptionKey: 'onboardingLanguageContinueEn',
  },
  {
    value: 'es',
    i18nLocale: 'es',
    nativeLabel: 'Español',
    descriptionKey: 'onboardingLanguageContinueEs',
  },
  {
    value: 'zh',
    i18nLocale: 'zh-Hans',
    nativeLabel: '中文',
    descriptionKey: 'onboardingLanguageContinueZh',
  },
];

export default function OnboardingLanguageScreen() {
  const { t } = useTranslation('onboarding');
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const currentLanguage = useAppSelector(selectPreferencesLanguage);

  // Ensure the onboarding bundle is loaded before rendering any key.
  // i18next returns the key itself on a miss, which would show the user
  // the literal `obLangTitle` string if we rendered before hydration.
  useEffect(() => {
    void loadNamespace('onboarding');
  }, []);

  const handleSelect = async (option: LanguageOption) => {
    // Swap the active i18n locale BEFORE navigating so the next screen
    // renders in the picked language on its first frame.
    await setLocale(option.i18nLocale);
    // Keep the Redux flag in sync — the setLanguage reducer also flips
    // `hasUserChosenLanguage=true`, which is what the root layout guard
    // uses to bypass this screen on subsequent launches.
    dispatch(setLanguage(option.value));
    router.push('/onboarding/trust');
  };

  const colors = theme.colors as Record<string, string>;
  // Resolve spacing values up front with numeric fallbacks so arithmetic
  // (`insets.top + spacing.l`) stays `number + number` under TS's
  // `noUncheckedIndexedAccess`. The fallbacks match `theme.spacing`
  // on light + dark so they're only ever touched if the theme loader
  // is still pending on the very first frame.
  const spaceXs = (theme.spacing.xs as number | undefined) ?? 4;
  const spaceS = (theme.spacing.s as number | undefined) ?? 8;
  const spaceSm = (theme.spacing.sm as number | undefined) ?? 12;
  const spaceL = (theme.spacing.l as number | undefined) ?? 24;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: insets.top + spaceL,
          paddingBottom: insets.bottom + spaceL,
          paddingHorizontal: spaceL,
        },
      ]}
    >
      <Stack gap="l">
        <View>
          <Text
            style={[
              styles.eyebrow,
              { color: colors.accent, marginBottom: spaceXs },
            ]}
          >
            {t('onboardingStepLanguage')}
          </Text>
          <Text
            style={[
              styles.title,
              {
                color: colors.inkPrimary,
                fontSize: theme.textVariants.h1.fontSize as number,
                lineHeight: theme.textVariants.h1.lineHeight as number,
              },
            ]}
          >
            {t('obLangTitle')}
          </Text>
          <Text
            style={[
              styles.subtitle,
              {
                color: colors.inkSecondary,
                fontSize: theme.textVariants.body.fontSize as number,
                lineHeight: theme.textVariants.body.lineHeight as number,
                marginTop: spaceS,
              },
            ]}
          >
            {t('obLangSubtitle')}
          </Text>
        </View>

        <Stack gap="sm">
          {LANGUAGE_OPTIONS.map((option) => {
            const isActive = currentLanguage === option.value;
            return (
              <OnboardingPressableRow
                key={option.value}
                testID={`onboarding-language-${option.value}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                onPress={() => {
                  void handleSelect(option);
                }}
              >
                <Card variant={isActive ? 'elevated' : 'flat'} padding="m">
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.nativeLabel,
                          {
                            color: colors.inkPrimary,
                            fontSize: theme.textVariants.h2.fontSize as number,
                            lineHeight: theme.textVariants.h2
                              .lineHeight as number,
                          },
                        ]}
                      >
                        {option.nativeLabel}
                      </Text>
                      <Text
                        style={[
                          styles.desc,
                          {
                            color: colors.inkSecondary,
                            fontSize: theme.textVariants.body
                              .fontSize as number,
                            lineHeight: theme.textVariants.body
                              .lineHeight as number,
                            marginTop: spaceXs,
                          },
                        ]}
                      >
                        {t(option.descriptionKey)}
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: colors.inkMuted,
                        fontSize: 22,
                      }}
                      accessibilityElementsHidden
                    >
                      {'\u2192'}
                    </Text>
                  </View>
                </Card>
              </OnboardingPressableRow>
            );
          })}
        </Stack>
      </Stack>
    </ScrollView>
  );
}

// Suppress the "unused" hint for i18n — keeping the import documents
// the locale-swap contract and lets us switch to a richer helper later
// without another diff.
void i18n;

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  title: {
    fontWeight: '600',
  },
  subtitle: {
    // marginTop comes from the theme at render time
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nativeLabel: {
    fontWeight: '600',
  },
  desc: {
    // sizing comes from the theme at render time
  },
});
