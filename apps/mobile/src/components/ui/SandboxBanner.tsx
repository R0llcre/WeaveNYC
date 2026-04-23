/**
 * SandboxBanner — persistent "DEMO MODE" strip for the demo build.
 * ================================================================
 *
 * Mobile port of `apps/pwa/src/components/ui/SandboxBanner.tsx`.
 *
 * The web version gates on `isDemoSandbox()` (hostname + `?demo=1`
 * query). On native there are no hostnames or query strings — the app
 * was built from a specific EAS profile and baked a known-good flag
 * into `app.json -> expo.extra.isDemo`. This atom reads that flag from
 * `expo-constants` and renders nothing unless it's literally `true`.
 *
 * Why the strict equality
 * -----------------------
 * A string `"true"` (from an env-var interpolation) would also be
 * truthy, and we absolutely do not want the banner to accidentally
 * ship in a production `APP_VARIANT=preview` build where `extra.isDemo`
 * might be undefined and coerced wrong elsewhere. Pinning to `=== true`
 * means only the explicit `"isDemo": true` entry enables the chip.
 *
 * Placement
 * ---------
 * Meant to be mounted once from the root layout (`app/_layout.tsx`) so
 * it survives every navigation. Absolute-positioned at the top of the
 * screen, respecting the safe-area inset so it doesn't collide with
 * the notch / status bar.
 *
 * Accessibility
 * -------------
 * Uses `accessibilityRole="alert"` so VoiceOver announces it when the
 * app foregrounds in demo mode. The banner is decorative after that —
 * `pointerEvents="none"` so it never absorbs a tap.
 */

import Constants from 'expo-constants';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme';

export interface SandboxBannerProps {
  /**
   * Localized "DEMO MODE" label. Defaults to uppercase English so the
   * atom works before i18n lands; production callers should pass
   * `t('demoSandboxPill')` from the chrome bundle.
   */
  label?: string;
  testID?: string;
}

/**
 * Reads `expo.extra.isDemo` from the resolved expo config. Kept as a
 * named helper (rather than inline in the component) so tests can
 * import it in isolation once jest-expo is wired.
 */
export function isDemoSandboxBuild(): boolean {
  const extra = Constants.expoConfig?.extra as
    | Record<string, unknown>
    | undefined;
  return extra?.isDemo === true;
}

export function SandboxBanner({
  label = 'DEMO MODE',
  testID,
}: SandboxBannerProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  if (!isDemoSandboxBuild()) {
    return null;
  }

  return (
    <View
      testID={testID ?? 'sandbox-pill'}
      accessible
      accessibilityRole="alert"
      accessibilityLabel={label}
      pointerEvents="none"
      style={[
        styles.container,
        {
          top: insets.top + theme.spacing.xs,
          right: theme.spacing.s,
          backgroundColor: theme.colors.urgent,
          borderRadius: theme.borderRadii.pill,
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: theme.spacing.xs,
        },
        theme.boxShadows.md,
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            color: theme.colors.inkInverse,
            fontFamily: theme.fontFamilies.bodyBold,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
