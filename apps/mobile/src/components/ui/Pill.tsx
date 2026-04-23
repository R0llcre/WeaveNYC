/**
 * Pill — selectable chip atom.
 * ============================
 *
 * RN port of `apps/pwa/src/components/ui/Pill.tsx`. Used for tag / filter /
 * toggle rows where a single chip represents on/off state. The canonical
 * contract with the web twin is:
 *
 *   - `accessibilityRole="button"` so AT treats the pill as a toggle.
 *     (The PWA uses `aria-pressed` on `<button>`; RN's closest analogue is
 *     `accessibilityState.selected` hung off a button-role Pressable, which
 *     VoiceOver reads as "selected" / "not selected" — semantic parity.)
 *   - `accessibilityState.selected` mirrors the `selected` prop so
 *     VoiceOver / TalkBack announce the toggle state.
 *   - `hitSlop: 8` extends the tappable area to at least 44x44 without
 *     growing the visible chrome; dense horizontal rows (language picker,
 *     filter chips) keep their compact look yet clear the iOS HIG minimum.
 *   - A selection-level haptic fires on press (via `triggerHaptic(10)`),
 *     which is the mobile-native counterpart to the PWA's focus-ring
 *     chop-mark confirmation — the user gets a physical ack that their
 *     toggle registered before the visual fill repaint.
 *
 * The PWA version dual-renders as an anchor when used as a navigation link.
 * Mobile navigation routes through expo-router's `router.push(...)`, so the
 * anchor branch is dropped — call sites that need link-pill semantics just
 * wire `onPress` to a router call.
 */

import { type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useAppTheme } from '@/theme';

import { triggerHaptic } from './haptic';

export interface PillProps
  extends Omit<PressableProps, 'children' | 'style'> {
  /** Toggle state. Announced by AT via `accessibilityState.selected`. */
  selected?: boolean;
  /** Label (string) or a simple inline node (icon + string). Required. */
  children: ReactNode;
  /** Merged after the atom-computed style. Escape hatch. */
  style?: StyleProp<ViewStyle>;
}

/**
 * Pill atom. See docblock for the a11y + hitSlop + haptic contract.
 * Visually, an unselected pill reads as a transparent-filled chip with a
 * border; a selected pill flips to the accent-soft fill + accent-strong
 * label so the state is obvious even without the AT announcement.
 */
export function Pill({
  selected = false,
  children,
  style,
  onPress,
  disabled,
  ...rest
}: PillProps) {
  const theme = useAppTheme();

  // `noUncheckedIndexedAccess` in the monorepo's tsconfig.base.json widens
  // every theme lookup to `T | undefined` regardless of the underlying type
  // (even on `Record<string, string>`). Restyle's own typings don't propagate
  // the literal shape out of `createTheme` either. The token keys below are
  // exhaustively defined in `src/theme/tokens.ts`, so coerce each group to a
  // specific `Record<LiteralUnion, T>` whose values the compiler then treats
  // as always-present. The narrow unions double as compile-time guards that
  // an atom can only reach for tokens the theme actually declares.
  type Colors = { [K in
    | 'accent'
    | 'accentSoft'
    | 'accentStrong'
    | 'border'
    | 'inkPrimary'
    | 'transparent']: string };
  type Space = { [K in 'xs' | 'sm']: number };
  type Radii = { [K in 'pill']: number };
  type Fonts = { [K in 'bodyMedium']: string };
  type Weights = { [K in 'medium']: '500' };
  type Variants = { label: { fontSize: number; lineHeight: number } };

  const c = theme.colors as unknown as Colors;
  const space = theme.spacing as unknown as Space;
  const radii = theme.borderRadii as unknown as Radii;
  const fonts = theme.fontFamilies as unknown as Fonts;
  const weights = theme.fontWeights as unknown as Weights;
  const variants = theme.textVariants as unknown as Variants;

  const backgroundColor = selected ? c.accentSoft : c.transparent;
  const borderColor = selected ? c.accent : c.border;
  const labelColor = selected ? c.accentStrong : c.inkPrimary;

  // Wrap onPress so every toggle fires a selection-level haptic before the
  // consumer's handler runs. The haptic is a no-op on unsupported devices
  // (see `./haptic.ts`) so this is safe to chain unconditionally.
  const handlePress = (event: GestureResponderEvent) => {
    if (disabled) return;
    triggerHaptic(10);
    onPress?.(event);
  };

  return (
    <Pressable
      {...rest}
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: Boolean(disabled) }}
      // 44x44 minimum tap target — chrome stays compact (~32px tall) but
      // the hitSlop expands the press region so finger taps don't miss.
      hitSlop={8}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor,
          borderColor,
          borderRadius: radii.pill,
          paddingVertical: space.xs,
          paddingHorizontal: space.sm,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {/* Wrap string children in Text so the host component is a leaf and
          consumers who pass a React node (e.g. an Icon + label) still get
          the token-driven colour without double-wrapping. */}
      {typeof children === 'string' ? (
        <Text
          style={{
            color: labelColor,
            fontSize: variants.label.fontSize,
            lineHeight: variants.label.lineHeight,
            fontFamily: fonts.bodyMedium,
            fontWeight: weights.medium,
          }}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
});
