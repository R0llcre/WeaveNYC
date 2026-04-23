/**
 * RouteLoadingFallback — Suspense boundary placeholder.
 * =====================================================
 *
 * Mobile port of `apps/pwa/src/components/ui/RouteLoadingFallback.tsx`.
 *
 * The PWA component is a localized wrapper used inside every route's
 * `<Suspense fallback>` so ZH / ES users never see a split-second of
 * English "Loading…" during hydration. The React Native equivalent
 * serves the same purpose for Expo Router's screen-level Suspense
 * boundaries.
 *
 * Composition: renders a single `Skeleton` stand-in and the localized
 * `chrome:loading` string below it, centered in the safe area. Kept
 * tiny on purpose — this is a placeholder, not a brand moment.
 *
 * i18n
 * ----
 * Reads the string from the `chrome` bundle via `react-i18next`. The
 * key is `loading` with an English fallback of "Loading…" so the atom
 * can be dropped into screens before the translator has filed their
 * PR.
 *
 * Dark-mode
 * ---------
 * Surface + text colours flow from `useAppTheme()`.
 */

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAppTheme } from '@/theme';

import { Skeleton } from './Skeleton';

export interface RouteLoadingFallbackProps {
  /**
   * Override the localized label. Useful for tests and for one-off
   * screens that want a more specific message ("Loading nearby
   * resources…" etc.).
   */
  label?: string;
  testID?: string;
}

export function RouteLoadingFallback({
  label,
  testID,
}: RouteLoadingFallbackProps) {
  const theme = useAppTheme();
  const { t } = useTranslation('chrome');
  // i18next returns the key itself when the translation is missing.
  // We treat that as "no translation yet" and fall back to English.
  const translated = t('loading');
  const resolved =
    label ?? (translated === 'loading' ? 'Loading\u2026' : translated);

  return (
    <View
      testID={testID ?? 'route-loading-fallback'}
      accessibilityRole="progressbar"
      accessibilityLabel={resolved}
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.bg,
          padding: theme.spacing.l,
          gap: theme.spacing.sm,
        },
      ]}
    >
      <Skeleton variant="rect" height={96} />
      <Text
        style={[
          styles.label,
          {
            color: theme.colors.inkSecondary,
            fontFamily: theme.textVariants.body.fontFamily,
            fontSize: theme.textVariants.body.fontSize,
            lineHeight: theme.textVariants.body.lineHeight,
            fontWeight: theme.textVariants.body.fontWeight,
          },
        ]}
      >
        {resolved}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  label: {
    textAlign: 'center',
  },
});
