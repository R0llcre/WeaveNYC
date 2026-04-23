/**
 * PageHeader — screen-top title strip with optional back button.
 * ==============================================================
 *
 * Mobile port of `apps/pwa/src/components/ui/PageHeader.tsx`.
 *
 * The PWA version was a `<section class="hero">` with an optional
 * back link and an actions slot. The mobile version shrinks the surface
 * area: a title + an optional back button is the smallest useful thing
 * on a phone screen, and the other slots (eyebrow / subtitle / actions)
 * are handled elsewhere in the layout on native (nav bar chrome, search
 * bar, etc.).
 *
 * Prop surface
 * ------------
 * - `title` (required): the screen title. Rendered with the theme's `h2`
 *   text variant so it matches the Fraunces display scale without going
 *   as large as `h1` (which we reserve for hero / feature pages).
 * - `onBack?`: when provided, a tappable chevron appears on the left,
 *   labeled for VoiceOver / TalkBack. Omit to get a title-only header.
 * - `testID?`: stable ID for Maestro / E2E. The back button also exposes
 *   `${testID}-back` so it can be targeted separately.
 *
 * Dark-mode
 * ---------
 * Text colour resolves against `theme.colors.inkPrimary` which is
 * already flipped by `darkTheme`. Back chevron is a pure
 * `currentColor`-style glyph drawn with a `Text` arrow, no SVG needed.
 *
 * Accessibility
 * -------------
 * - The title uses `accessibilityRole="header"` so assistive tech
 *   announces it as a heading.
 * - The back button uses `accessibilityRole="button"` with
 *   `accessibilityLabel="Back"` and a decent touch target (44×44 per
 *   iOS HIG).
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

export interface PageHeaderProps {
  /** Screen title. Rendered with the `h2` text variant. */
  title: string;
  /**
   * When provided, a back chevron is rendered to the left of the title.
   * Omit to get a title-only header (useful for root tab screens where
   * "back" has no meaning).
   */
  onBack?: () => void;
  /**
   * Stable ID for E2E targeting. The back button exposes
   * `${testID}-back` when present.
   */
  testID?: string;
  /**
   * Localized label for the back button. Defaults to the English word
   * "Back" so atoms can be dropped into screens before i18n lands.
   * Callers SHOULD pass a translated string via `t('back')` in
   * production code.
   */
  backAccessibilityLabel?: string;
}

export function PageHeader({
  title,
  onBack,
  testID,
  backAccessibilityLabel = 'Back',
}: PageHeaderProps) {
  // The M1 scaffold types `theme.colors.X` as `string | undefined` and
  // `theme.borderRadii` as possibly `undefined` (`createTheme` from
  // restyle 2.4 doesn't narrow custom keys). We know every semantic
  // token is populated at module load so narrow once here — every
  // downstream read is guaranteed non-null.
  const theme = useAppTheme();
  const colors = theme.colors as Record<string, string>;
  const spacing = theme.spacing as Record<string, number>;
  const borderRadii = theme.borderRadii as Record<string, number>;
  const fontFamilies = theme.fontFamilies as Record<string, string>;
  const h2 = theme.textVariants.h2 as Record<string, string | number>;

  return (
    <View
      testID={testID}
      accessibilityRole="header"
      style={[
        styles.container,
        {
          paddingHorizontal: spacing.l,
          paddingVertical: spacing.m,
          gap: spacing.sm,
        },
      ]}
    >
      {onBack ? (
        <Pressable
          testID={testID ? `${testID}-back` : undefined}
          accessibilityRole="button"
          accessibilityLabel={backAccessibilityLabel}
          onPress={onBack}
          hitSlop={10}
          style={({ pressed }) => [
            styles.back,
            {
              borderRadius: borderRadii.pill,
              backgroundColor: pressed ? colors.surfaceSunken : 'transparent',
            },
          ]}
        >
          <Text
            style={[
              styles.backGlyph,
              {
                color: colors.inkPrimary,
                fontFamily: fontFamilies.body,
              },
            ]}
          >
            {'\u2190'}
          </Text>
        </Pressable>
      ) : null}
      <Text
        style={[
          styles.title,
          {
            color: colors.inkPrimary,
            fontFamily: h2.fontFamily as string,
            fontSize: h2.fontSize as number,
            lineHeight: h2.lineHeight as number,
            fontWeight: h2.fontWeight as '500',
          },
        ]}
      >
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  back: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: {
    fontSize: 22,
    lineHeight: 22,
  },
  title: {
    flexShrink: 1,
  },
});
