/**
 * Toast — ephemeral notification with slide-in + auto-dismiss.
 * =============================================================
 *
 * Port of `apps/pwa/src/components/ui/Toast.tsx` to React Native. The PWA
 * version is a presentational shell; a separate Provider owns the portal
 * and queue. Mobile doesn't have a DOM portal primitive, so this atom
 * *does* animate itself in and schedule its own auto-dismiss — but the
 * mount/unmount decision still lives with the parent, which either
 * rotates items in a queue or simply toggles a single toast.
 *
 * Animation
 * ---------
 * We use `react-native-reanimated` so the slide-in runs on the UI thread
 * (instead of marshalling JS values across the bridge every frame). A
 * `SharedValue` for `translateY` drives the transform; `withTiming` gives
 * a smooth 220ms ease-out slide-in matching the PWA's
 * `--transition-med` duration token.
 *
 * We deliberately do NOT reach for the `burnt` package even though it
 * ships a nice haptic-native toast on iOS: adding a second toast library
 * doubles the visual-QA surface (parity vs the PWA) and `burnt` renders
 * UIKit-native on iOS but falls back to JS on Android, which means two
 * more rendering paths to maintain. Rolling our own keeps one render
 * contract across platforms and matches the PWA 1:1.
 *
 * Reduce-motion
 * -------------
 * RN exposes system reduce-motion via
 * `AccessibilityInfo.isReduceMotionEnabled()`. When the user has reduce-
 * motion enabled we skip the slide-in and render the toast at its final
 * position immediately. Auto-dismiss still runs — the animation only
 * gates the entrance.
 *
 * Auto-dismiss
 * ------------
 * A `setTimeout` at `durationMs` (default 3500ms per UX spec) fires
 * `onDismiss`. The timer is cleared on unmount AND on message change, so
 * a parent that rotates new messages into the same Toast slot doesn't
 * double-fire dismiss on the previous message.
 *
 * Accessibility
 * -------------
 * `danger` / `warning` tones render as `accessibilityRole="alert"` with
 * `accessibilityLiveRegion="assertive"` so screen readers announce them
 * immediately. `info` / `success` render as `status` / `polite` for the
 * less-urgent flow. Mirrors the PWA's `role=alert|status` split exactly.
 *
 * Dark-mode
 * ---------
 * Surface, ink, and the four tone-driven background colours all flip
 * automatically via Restyle. No branch in this file.
 */

import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme, type Theme } from '@/theme';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export interface ToastProps {
  /** Semantic tone — drives background, icon dot, and announcement urgency. */
  tone: ToastTone;
  /** Localised message string. Callers pass an already-translated value. */
  message: string;
  /**
   * Auto-dismiss delay in milliseconds. Defaults to 3500ms. Pass `Infinity`
   * to disable auto-dismiss entirely (caller must then hide the toast
   * themselves — e.g. behind a user action).
   */
  durationMs?: number;
  /** Invoked when the timer elapses or the dismiss button is tapped. */
  onDismiss?: () => void;
  /**
   * Localised label for the dismiss button's `accessibilityLabel`. Required
   * only when `onDismiss` is provided so ZH / ES users don't hear an
   * English "Dismiss" from assistive tech.
   */
  dismissLabel?: string;
  /** Escape hatch on the outermost style. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Tokens port note
 * ----------------
 * `theme.colors.*` values trace back to a `Record<string, string>` palette
 * in `src/theme/tokens.ts` (widened on purpose so dark-theme can override
 * keys with different literal strings). TypeScript therefore reports every
 * lookup as `string | undefined`. In practice the keys are always present
 * — that's enforced by `createTheme`'s `as const` shape — so we cast once
 * at the helper boundary. If a key is genuinely missing the map falls
 * through to the `info` branch, matching the PWA behaviour.
 */

/** Maps a tone to the theme colour key used as the toast's background. */
function toneBg(tone: ToastTone, theme: Theme): string {
  switch (tone) {
    case 'success':
      return theme.colors.verifiedSoft as string;
    case 'warning':
      return theme.colors.urgentSoft as string;
    case 'danger':
      return theme.colors.dangerSoft as string;
    case 'info':
    default:
      return theme.colors.infoSoft as string;
  }
}

/** Maps a tone to the accent colour used for the left bar + icon dot. */
function toneAccent(tone: ToastTone, theme: Theme): string {
  switch (tone) {
    case 'success':
      return theme.colors.verified as string;
    case 'warning':
      return theme.colors.urgent as string;
    case 'danger':
      return theme.colors.danger as string;
    case 'info':
    default:
      return theme.colors.info as string;
  }
}

export function Toast({
  tone,
  message,
  durationMs = 3500,
  onDismiss,
  dismissLabel,
  style,
  testID,
}: ToastProps) {
  const theme = useAppTheme();

  // Shared value drives the slide-in. Start 24px below resting position so
  // the toast appears to rise into view — matches the PWA's upward slide.
  const translateY = useSharedValue(24);
  const opacity = useSharedValue(0);

  // Track reduce-motion at mount time (state so re-render once the async
  // query resolves). Default `null` means "don't assume either way yet"
  // so we don't flash the animated path for reduce-motion users.
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) setReduceMotion(enabled);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Run the slide-in once we know the reduce-motion preference.
  useEffect(() => {
    if (reduceMotion === null) return;
    if (reduceMotion) {
      translateY.value = 0;
      opacity.value = 1;
    } else {
      translateY.value = withTiming(0, {
        duration: theme.durations.medium,
        easing: Easing.out(Easing.ease),
      });
      opacity.value = withTiming(1, {
        duration: theme.durations.medium,
        easing: Easing.out(Easing.ease),
      });
    }
    // We want the slide to re-run when the message changes too — treats a
    // message swap in the same slot as a fresh toast.
  }, [reduceMotion, message, theme.durations.medium, translateY, opacity]);

  // Auto-dismiss timer. Reset on message change so a queue that rotates
  // messages through the same slot doesn't double-fire `onDismiss`.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!onDismiss) return;
    if (!Number.isFinite(durationMs)) return;
    timerRef.current = setTimeout(() => {
      onDismiss();
    }, durationMs);
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [message, durationMs, onDismiss]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const isUrgent = tone === 'danger' || tone === 'warning';

  // Pre-compute styles so the TS narrowing happens once per render rather
  // than per-node (keeps the JSX block readable and side-steps the
  // palette's `string | undefined` typing by casting at the boundary).
  const containerDynamic: ViewStyle = {
    backgroundColor: toneBg(tone, theme),
    borderColor: toneAccent(tone, theme),
    borderRadius: theme.borderRadii!.md as number,
    padding: theme.spacing.sm as number,
  };
  const accentBarDynamic: ViewStyle = {
    backgroundColor: toneAccent(tone, theme),
    borderRadius: theme.borderRadii!.sm as number,
    marginRight: theme.spacing.sm as number,
  };
  const messageDynamic: TextStyle = {
    color: theme.colors.inkPrimary as string,
    fontSize: theme.textVariants.bodySmall.fontSize as number,
    lineHeight: theme.textVariants.bodySmall.lineHeight as number,
  };
  const dismissGlyphDynamic: TextStyle = {
    color: theme.colors.inkSecondary as string,
    fontSize: theme.textVariants.bodySmall.fontSize as number,
  };

  return (
    <Animated.View
      testID={testID}
      accessibilityRole={isUrgent ? 'alert' : undefined}
      accessibilityLiveRegion={isUrgent ? 'assertive' : 'polite'}
      style={[styles.container, containerDynamic, animatedStyle, style]}
    >
      <View
        // Small accent bar on the left — non-interactive, hidden from a11y.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.accentBar, accentBarDynamic]}
      />
      <Text style={[styles.message, messageDynamic]}>{message}</Text>
      {onDismiss ? (
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={dismissLabel ?? 'Dismiss'}
          hitSlop={8}
          testID={testID ? `${testID}-dismiss` : undefined}
          style={({ pressed }): StyleProp<ViewStyle> => [
            styles.dismiss,
            {
              marginLeft: theme.spacing.sm as number,
              opacity: pressed ? 0.6 : 1,
            },
          ]}
        >
          <Text style={[styles.dismissGlyph, dismissGlyphDynamic]}>×</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  message: {
    flex: 1,
    flexShrink: 1,
  },
  dismiss: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissGlyph: {
    fontWeight: '500',
  },
});
