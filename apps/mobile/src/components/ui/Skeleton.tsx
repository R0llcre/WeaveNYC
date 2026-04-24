/**
 * Skeleton — low-fidelity placeholder for loading states.
 * =======================================================
 *
 * Mobile port of `apps/pwa/src/components/ui/Skeleton.tsx`.
 *
 * The PWA atom used a CSS `@keyframes skeleton-pulse` animation on a
 * linear-gradient background. RN has neither CSS gradients nor CSS
 * keyframes, so the mobile version uses `react-native-reanimated` to
 * animate the opacity of a solid muted fill. The effect reads as a
 * gentle pulse rather than a sliding gradient but preserves the "this
 * is loading content" affordance.
 *
 * Variants
 * --------
 * - `text` (default): inline-block strip, height tied to the body
 *   text line-height so it sits cleanly inside a `<Text>` column.
 * - `rect`: rectangular card-ish placeholder (`borderRadii.md`).
 * - `circle`: avatar/icon placeholder (`borderRadii.pill`).
 *
 * Reduced motion
 * --------------
 * `AccessibilityInfo.isReduceMotionEnabled()` is polled on mount and
 * subscribed to via the `reduceMotionChanged` event. When the user has
 * enabled "Reduce Motion" (iOS) / "Remove animations" (Android) we skip
 * the reanimated loop and render a static 70% opacity fill — same
 * "something is loading" signal with no motion.
 *
 * Accessibility
 * -------------
 * Passing `label` flips the element into a `progressbar` with a live
 * announcement. Without `label` the skeleton is decorative chrome
 * (`accessibilityElementsHidden` on iOS, `importantForAccessibility` on
 * Android) so it doesn't spam screen reader output in regions that
 * already have their own loading state message.
 */

import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from '@/theme';

export type SkeletonVariant = 'text' | 'rect' | 'circle';

export interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: number | `${number}%`;
  height?: number;
  /**
   * Accessible loading label. When provided the element reports itself
   * as a progressbar; otherwise it's hidden from assistive tech
   * (treated as decorative chrome). Consumers should usually set this
   * on the outermost skeleton of a loading region and leave inner
   * lines decorative.
   */
  label?: string;
  /** Style escape hatch (merged AFTER computed style). */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Skeleton({
  variant = 'text',
  width,
  height,
  label,
  style,
  testID,
}: SkeletonProps) {
  // Narrow the Restyle-inferred "possibly undefined" tokens once (see
  // PageHeader.tsx for rationale — M1's `createTheme` widens custom
  // keys).
  const theme = useAppTheme();
  const colors = theme.colors as Record<string, string>;
  const borderRadii = theme.borderRadii as Record<string, number>;
  const bodyVariant = theme.textVariants.body as Record<
    string,
    number | string | undefined
  >;
  const [reduceMotion, setReduceMotion] = useState(false);

  // Subscribe to reduced-motion preference. The initial read is async,
  // so render static-gray on first paint and flip in when the answer
  // comes back. The event subscription keeps us in sync if the user
  // toggles the setting while the app is foregrounded.
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduceMotion(value);
      })
      .catch(() => {
        // Some platforms (older Android) throw here; treat as "motion OK".
        if (mounted) setReduceMotion(false);
      });
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (value: boolean) => {
        if (mounted) setReduceMotion(value);
      },
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const opacity = useSharedValue(0.7);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(opacity);
      opacity.value = 0.7;
      return;
    }
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: 700 }),
        withTiming(0.7, { duration: 700 }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(opacity);
    };
  }, [reduceMotion, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const resolvedWidth: number | `${number}%` | undefined =
    width ?? (variant === 'circle' ? 40 : '100%');
  const resolvedHeight =
    height ??
    (variant === 'text'
      ? (bodyVariant.fontSize as number | undefined) ?? 16
      : variant === 'circle'
        ? 40
        : 16);

  const resolvedRadius =
    variant === 'circle' ? borderRadii.pill : borderRadii.md;

  const a11yProps = label
    ? {
        accessible: true,
        accessibilityRole: 'progressbar' as const,
        accessibilityLabel: label,
        accessibilityValue: { text: label },
      }
    : Platform.OS === 'ios'
      ? {
          accessible: false,
          accessibilityElementsHidden: true,
          importantForAccessibility: 'no-hide-descendants' as const,
        }
      : {
          accessible: false,
          importantForAccessibility: 'no-hide-descendants' as const,
        };

  return (
    <Animated.View
      {...a11yProps}
      testID={testID}
      style={[
        styles.base,
        {
          width: resolvedWidth,
          height: resolvedHeight,
          borderRadius: resolvedRadius,
          backgroundColor: colors.surfaceSunken,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});
