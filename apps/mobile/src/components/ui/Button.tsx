/**
 * Button — primary action atom.
 * ==============================
 *
 * RN port of `apps/pwa/src/components/ui/Button.tsx`. Keeps the PWA's
 * variant × size vocabulary identical so copy-paste from web screens to
 * native screens stays literal, but swaps every DOM-only concern for its
 * native equivalent:
 *
 *   - Dual `<button>` / `<a>` render on web → single `Pressable`. When a
 *     native screen needs a "link-styled CTA" it pairs this atom with
 *     `router.push()` from expo-router instead of a click handler.
 *   - `className="button button--primary"` → Restyle-token-driven style
 *     values resolved off `useAppTheme()`. No CSS, no className prop.
 *   - `triggerHaptic(10)` (web vibration) → `expo-haptics` Light impact
 *     via `triggerLightHaptic()`. The helper respects the OS-level
 *     reduce-motion flag so accessibility toggles propagate into every
 *     atom press without per-call plumbing.
 *
 * Variants
 * --------
 *   primary   — filled vermillion accent (the brand CTA).
 *   secondary — transparent fill + token border + ink label (supporting).
 *   ghost     — no fill, no border, ink label only (tertiary).
 *   danger    — filled danger tone for destructive actions.
 *
 * Sizes
 * -----
 * `sm | md | lg` map to explicit touch-target heights + typography
 * sizes. `md` is the default and defends the iOS HIG 44×44 minimum.
 *
 * Loading
 * -------
 * When `loading=true` we render a tiny `ActivityIndicator` in place of
 * the label and flag the press handler as a no-op. `accessibilityState
 * .busy` is set so VoiceOver announces "loading" instead of the label.
 *
 * Disabled
 * --------
 * `disabled=true` dims the surface to 50% opacity and blocks the press.
 * Haptic is also suppressed (firing on an unresponsive button would
 * incorrectly signal "that worked").
 *
 * Dark-mode
 * ---------
 * All colour tokens resolve through `useAppTheme()`, which re-resolves
 * on `useColorScheme()` flips — no branch in this atom.
 */

import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useAppTheme } from '@/theme';
import { triggerLightHaptic } from './haptic';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps
  extends Omit<PressableProps, 'children' | 'style' | 'disabled'> {
  /** Visual weight. Defaults to `primary`. */
  variant?: ButtonVariant;
  /** Touch-target / typography scale. Defaults to `md`. */
  size?: ButtonSize;
  /** Render an ActivityIndicator + flag the button as busy for AT. */
  loading?: boolean;
  /** Block the press + dim the surface. */
  disabled?: boolean;
  /** Label. Required for a11y — never ship a Button with no accessible name. */
  children: ReactNode;
  /**
   * Emit a Light-impact haptic on press. Default `true`. Disable for
   * rapid-fire toggles (e.g. +/- steppers) where repeat haptics are noisy.
   * The helper itself short-circuits if OS reduce-motion is enabled.
   */
  haptic?: boolean;
  /** Merged after the atom-computed style. Escape hatch. */
  style?: StyleProp<ViewStyle>;
}

/**
 * Per-size minimum touch-target height. `md` defends the iOS HIG 44×44
 * minimum; `sm` is reserved for high-density toolbars where 36px is
 * acceptable because the surrounding row carries the hit area.
 */
const SIZE_HEIGHT: Record<ButtonSize, number> = {
  sm: 36,
  md: 44,
  lg: 52,
};

const SIZE_FONT: Record<ButtonSize, number> = {
  sm: 14,
  md: 16,
  lg: 18,
};

/**
 * Coerce a Restyle spacing token to a DimensionValue number. The theme
 * typing widens `spacing.m` to `string | number | undefined` (Restyle's
 * BaseTheme contract); our tokens are always numeric in `@/theme/tokens`
 * so this narrow cast is safe. Centralised here so the padding math
 * inside the Pressable `style` callback stays readable.
 */
function px(value: string | number | undefined, fallback: number): number {
  return typeof value === 'number' ? value : fallback;
}

/** Primary CTA atom. See module docblock for variant / size semantics. */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  children,
  haptic = true,
  onPress,
  style,
  ...rest
}: ButtonProps) {
  const theme = useAppTheme();

  const isDisabled = disabled || loading;

  // Resolve colours up front so the style array below stays readable. The
  // switch is deliberately explicit (not a keyed object) so TS reports a
  // missing variant the moment someone extends the union.
  //
  // Types widened to `string | undefined` because Restyle's `BaseTheme`
  // declares `colors` as optional — atoms elsewhere (PlaceholderScreen,
  // TokenPreview) hit the same widening. RN's style props accept `undefined`
  // at the callsite so the widening is harmless at runtime.
  let backgroundColor: string | undefined;
  let borderColor: string | undefined;
  let labelColor: string | undefined;
  switch (variant) {
    case 'primary':
      backgroundColor = theme.colors.accent;
      borderColor = theme.colors.accent;
      labelColor = theme.colors.accentInk;
      break;
    case 'secondary':
      backgroundColor = theme.colors.transparent;
      borderColor = theme.colors.border;
      labelColor = theme.colors.inkPrimary;
      break;
    case 'ghost':
      backgroundColor = theme.colors.transparent;
      borderColor = theme.colors.transparent;
      labelColor = theme.colors.inkPrimary;
      break;
    case 'danger':
      backgroundColor = theme.colors.danger;
      borderColor = theme.colors.danger;
      labelColor = theme.colors.inkInverse;
      break;
  }

  const handlePress: NonNullable<PressableProps['onPress']> = (event) => {
    // Disabled / loading press must NOT buzz — firing haptic on an
    // unresponsive button incorrectly signals "that worked" to the user.
    if (isDisabled) return;
    if (haptic) triggerLightHaptic();
    onPress?.(event);
  };

  return (
    <Pressable
      {...rest}
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={(state: PressableStateCallbackType): StyleProp<ViewStyle> => [
        styles.base,
        {
          minHeight: SIZE_HEIGHT[size],
          paddingHorizontal:
            size === 'sm'
              ? px(theme.spacing.sm, 12)
              : size === 'lg'
                ? px(theme.spacing.l, 24)
                : px(theme.spacing.m, 16),
          paddingVertical:
            size === 'sm'
              ? px(theme.spacing.xs, 4)
              : size === 'lg'
                ? px(theme.spacing.sm, 12)
                : px(theme.spacing.s, 8),
          // `borderRadii` is declared optional by Restyle's BaseTheme even
          // though `@/theme` always ships it. Fallback pins the PWA's
          // `--radius-md` (4px) so the style stays compile-clean without a
          // non-null assertion.
          borderRadius: theme.borderRadii?.md ?? 4,
          backgroundColor,
          borderColor,
          // 0.5 disabled / 0.85 pressed / 1 rest. The pressed factor is
          // subtler than iOS's default so the vermillion CTA doesn't
          // strobe visibly under rapid taps.
          opacity: isDisabled ? 0.5 : state.pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator testID="button-loading" color={labelColor} />
        ) : (
          <Text
            style={{
              color: labelColor,
              fontSize: SIZE_FONT[size],
              fontFamily: theme.fontFamilies.bodySemiBold,
              fontWeight: theme.fontWeights.semibold,
            }}
          >
            {children}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
