/**
 * EmptyState — reusable zero-data surface.
 *
 * Port of `apps/pwa/src/components/ui/EmptyState.tsx`. Used when a list /
 * tab / search returns nothing. Copy is constrained to `title` plus a
 * one-sentence `subtitle` plus a single CTA so the screen stays focused;
 * consumers own translation and the atom never ships English strings.
 *
 * Illustration placeholder
 * ------------------------
 * The PWA renders an inline `<svg>` from an illustration registry via
 * `dangerouslySetInnerHTML`. On RN we need `react-native-svg-transformer`
 * (see M4a) to import `.svg` files as components. Until that lands this
 * atom renders a *placeholder*: the illustration *name* is exposed (so
 * tests and layout reviewers can see which illustration belongs where)
 * and a softly-tinted square is drawn below it. Once M4a lands, the
 * placeholder renders (name + tinted square) should be swapped for the
 * actual SVG component lookup — the prop shape (`illustrationName:
 * string`) stays identical so no consumer has to change.
 *
 * Announcement semantics
 * ----------------------
 * `info` (default) renders silent so static empty states don't announce
 * on every mount. `error` sets `accessibilityLiveRegion="polite"` and
 * `accessibilityRole="alert"` so screen readers surface failure states.
 *
 * Dark-mode
 * ---------
 * `inkPrimary`, `inkSecondary`, and `illustrationSoft` all flip via the
 * Restyle dark theme without a branch here. The placeholder tint uses
 * `accentSoft` which also flips palettes correctly.
 */

import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { useAppTheme } from '@/theme';

export type EmptyStateTone = 'info' | 'error';

export interface EmptyStateCta {
  /** CTA button label. Keep to three words or fewer. */
  label: string;
  /** Tap handler. */
  onPress?: () => void;
  /** Styling variant — matches the PWA shape. Only `primary` | `secondary` are
   * honoured visually in the placeholder renderer; `ghost` falls back to
   * secondary until Button is ported. */
  variant?: 'primary' | 'secondary' | 'ghost';
  testID?: string;
}

export interface EmptyStateProps {
  /**
   * Name of the registered illustration. Renders as text + a tinted
   * placeholder square until M4a wires `react-native-svg-transformer`.
   * The name is exposed as a `testID` suffix so layout tests can assert
   * "this empty state is showing the right illustration slot" without
   * needing pixel-level snapshots.
   */
  illustrationName?: string;
  /** h2-sized headline. Required. */
  title: string;
  /** Body-sm, muted supporting line. Keep to one sentence. */
  subtitle?: string;
  /** Optional primary CTA. */
  cta?: EmptyStateCta;
  /**
   * Announcement semantics. `info` (default) is silent. `error` sets
   * `accessibilityLiveRegion` + `accessibilityRole="alert"`.
   */
  tone?: EmptyStateTone;
  /** Escape hatch on the outer container style. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function EmptyState({
  illustrationName,
  title,
  subtitle,
  cta,
  tone = 'info',
  style,
  testID,
}: EmptyStateProps) {
  const theme = useAppTheme();

  const isError = tone === 'error';
  const secondary = cta?.variant === 'secondary' || cta?.variant === 'ghost';

  // Cast theme lookups at the boundary; see Toast.tsx for the rationale.
  const containerDynamic: ViewStyle = {
    paddingVertical: theme.spacing.xl as number,
  };
  const illustrationSquareDynamic: ViewStyle = {
    backgroundColor: theme.colors.accentSoft as string,
    borderColor: theme.colors.accent as string,
    borderRadius: theme.borderRadii!.lg as number,
    marginBottom: theme.spacing.s as number,
  };
  const illustrationNameDynamic: TextStyle = {
    color: theme.colors.inkMuted as string,
    fontSize: theme.textVariants.micro.fontSize as number,
    lineHeight: theme.textVariants.micro.lineHeight as number,
  };
  const titleDynamic: TextStyle = {
    color: theme.colors.inkPrimary as string,
    fontSize: theme.textVariants.h2.fontSize as number,
    lineHeight: theme.textVariants.h2.lineHeight as number,
    fontWeight: theme.textVariants.h2.fontWeight as TextStyle['fontWeight'],
    marginBottom: (subtitle ? theme.spacing.s : theme.spacing.m) as number,
  };
  const subtitleDynamic: TextStyle = {
    color: theme.colors.inkSecondary as string,
    fontSize: theme.textVariants.bodySmall.fontSize as number,
    lineHeight: theme.textVariants.bodySmall.lineHeight as number,
    marginBottom: theme.spacing.m as number,
  };
  const ctaBackgroundColor = (
    secondary ? theme.colors.transparent : theme.colors.accent
  ) as string;
  const ctaBorderColor = theme.colors.accent as string;
  const ctaBorderRadius = theme.borderRadii!.md as number;
  const ctaPaddingHorizontal = theme.spacing.m as number;
  const ctaPaddingVertical = theme.spacing.s as number;
  const ctaLabelDynamic: TextStyle = {
    color: (secondary
      ? theme.colors.accent
      : theme.colors.accentInk) as string,
    fontSize: theme.textVariants.body.fontSize as number,
    lineHeight: theme.textVariants.body.lineHeight as number,
  };

  return (
    <View
      testID={testID}
      accessibilityRole={isError ? 'alert' : undefined}
      accessibilityLiveRegion={isError ? 'polite' : 'none'}
      style={[styles.container, containerDynamic, style]}
    >
      {illustrationName ? (
        <View
          testID={testID ? `${testID}-illustration-${illustrationName}` : undefined}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.illustrationWrap}
        >
          {/* Placeholder tinted square — replace with SVG component when
              `react-native-svg-transformer` lands in M4a. */}
          <View style={[styles.illustrationSquare, illustrationSquareDynamic]} />
          {/* The illustration *name* is visible by design — layout reviewers
              need to see which registered art slot an empty state occupies,
              and it costs nothing to ship with the production bundle because
              M4a will swap this placeholder for the real SVG. */}
          <Text style={[styles.illustrationName, illustrationNameDynamic]}>
            {illustrationName}
          </Text>
        </View>
      ) : null}

      <Text style={[styles.title, titleDynamic]}>{title}</Text>

      {subtitle ? (
        <Text style={[styles.subtitle, subtitleDynamic]}>{subtitle}</Text>
      ) : null}

      {cta ? (
        <Pressable
          onPress={cta.onPress}
          accessibilityRole="button"
          accessibilityLabel={cta.label}
          testID={cta.testID}
          style={({ pressed }): StyleProp<ViewStyle> => [
            styles.cta,
            {
              backgroundColor: ctaBackgroundColor,
              borderColor: ctaBorderColor,
              borderRadius: ctaBorderRadius,
              paddingHorizontal: ctaPaddingHorizontal,
              paddingVertical: ctaPaddingVertical,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Text style={[styles.ctaLabel, ctaLabelDynamic]}>{cta.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationWrap: {
    alignItems: 'center',
  },
  illustrationSquare: {
    width: 96,
    height: 96,
    borderWidth: 1,
  },
  illustrationName: {
    textAlign: 'center',
    fontStyle: 'italic',
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    maxWidth: 360,
  },
  cta: {
    borderWidth: 1,
    alignSelf: 'center',
  },
  ctaLabel: {
    textAlign: 'center',
    fontWeight: '500',
  },
});
