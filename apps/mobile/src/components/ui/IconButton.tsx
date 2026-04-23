/**
 * IconButton — icon-only touch target atom.
 * =========================================
 *
 * RN port of `apps/pwa/src/components/ui/IconButton.tsx`. Guarantees a 44×44
 * minimum tap target (per iOS HIG + WCAG 2.5.5 Target Size) regardless of
 * the visual `size` variant, and enforces a TypeScript-level requirement
 * for `accessibilityLabel` so screen readers always have something to
 * announce — icon-only buttons without a label are an a11y bug we refuse
 * to let type-check.
 *
 * Size variants
 * -------------
 * `sm` | `md` | `lg` control the **visible chrome** (28 / 36 / 44 px) but
 * `hitSlop` expands the press region so even the `sm` variant clears the
 * 44×44 minimum. That way a row of small icon buttons (e.g. toolbar)
 * stays compact visually while still being thumb-friendly.
 *
 * Haptic
 * ------
 * On press, fire a Light impact haptic. The PWA twin defaults `haptic`
 * to `false` on IconButton (most icon-only affordances are secondary:
 * back, dismiss, refresh), but native defaults to `true` because a button
 * press on iOS without tactile feedback feels broken. Consumers can opt
 * out via `haptic={false}` for rapid-fire toggles where repeat haptics
 * would be noisy.
 *
 * Contract with the PWA twin
 * --------------------------
 *   - Required `accessibilityLabel` — enforced at the type level, so
 *     `<IconButton onPress={..}>{<Icon .. />}</IconButton>` fails to
 *     compile.
 *   - `accessibilityRole="button"` mirrors the web's `<button>` semantics.
 *   - Disabled buttons skip the haptic (pressing an unresponsive control
 *     should not buzz, which would falsely signal success).
 */

import { type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useAppTheme } from '@/theme';
import { triggerHaptic } from './haptic';

export type IconButtonSize = 'sm' | 'md' | 'lg';

/**
 * Visible chrome size per variant. `md` matches the 44×44 HIG minimum so
 * the hit region equals the visible target — no hitSlop needed.
 */
const SIZE_PX: Record<IconButtonSize, number> = {
  sm: 28,
  md: 36,
  lg: 44,
};

/**
 * Per-size hit-slop padding. The goal is a >=44 effective touch area at
 * every size: 28 + 2*8 = 44, 36 + 2*4 = 44, 44 + 0 = 44.
 */
const SIZE_HIT_SLOP: Record<IconButtonSize, number> = {
  sm: 8,
  md: 4,
  lg: 0,
};

export interface IconButtonProps
  extends Omit<PressableProps, 'children' | 'style' | 'accessibilityLabel'> {
  /**
   * Required. Announced by screen readers in place of visible text.
   * Enforced at the type level so icon-only buttons can't ship without
   * an accessible name — that would be an a11y bug. Never hardcode
   * English here; callers pass a localized string from `useTranslation()`.
   */
  accessibilityLabel: string;
  /** Touch target chrome size. Defaults to `md` (36×36 visible, 44×44 hit). */
  size?: IconButtonSize;
  /**
   * Emit a Light impact haptic on press. Default `true` on native because
   * a press without tactile feedback feels broken on iOS. Opt out for
   * rapid-fire toggles (e.g. +/- steppers) where repeat haptics would
   * drain battery / feel noisy.
   */
  haptic?: boolean;
  /** Icon glyph. Typically `<Icon name="..." />`. Hidden from AT. */
  children: ReactNode;
  /** Merged after the atom-computed style. Escape hatch. */
  style?: StyleProp<ViewStyle>;
}

/**
 * IconButton atom. See module docblock for the 44×44 / required-label
 * / haptic conventions and the compatibility notes with the PWA twin.
 */
export function IconButton({
  accessibilityLabel,
  size = 'md',
  haptic = true,
  children,
  onPress,
  disabled,
  style,
  ...rest
}: IconButtonProps) {
  const theme = useAppTheme();
  const px = SIZE_PX[size];
  const slop = SIZE_HIT_SLOP[size];

  const handlePress = (
    event: Parameters<NonNullable<PressableProps['onPress']>>[0],
  ) => {
    // Skip haptic when press is a no-op — buzzing a disabled control
    // would falsely signal that the action succeeded.
    if (disabled) return;
    if (haptic) triggerHaptic(30); // Light impact per haptic.ts mapping.
    onPress?.(event);
  };

  return (
    <Pressable
      {...rest}
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      hitSlop={slop}
      style={({ pressed }) => [
        styles.base,
        {
          width: px,
          height: px,
          borderRadius: px / 2,
          backgroundColor: theme.colors.transparent,
          opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      {/* Hide the glyph from AT — the button itself already owns the
          accessibilityLabel. Otherwise VoiceOver would announce both
          the label and any nested Icon's label, doubling up. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
      >
        {children}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
