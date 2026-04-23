/**
 * Checkbox — binary toggle atom.
 * ==============================
 *
 * RN port of `apps/pwa/src/components/ui/Checkbox.tsx`. The web version
 * uses a real `<input type="checkbox">` for free a11y/keyboard support;
 * on native we build the same affordance from `Pressable` + a custom
 * tick glyph, exposing the proper `accessibilityRole="checkbox"` +
 * `accessibilityState.checked` contract so VoiceOver / TalkBack announce
 * "selected" / "not selected" identically.
 *
 * Port notes
 * ----------
 *   - `<label>` wrapper + `<input>` → single `Pressable` with a row of
 *     [box] [label + optional hint]. Tapping anywhere on the row toggles
 *     the state (matches native iOS/Android checkbox rows).
 *   - Haptic: a Light impact fires on every toggle. The Checkbox is an
 *     explicit commitment affordance (saving a preference, consenting to
 *     a policy) so tactile confirmation is important — unlike Button,
 *     Checkbox does NOT accept a `haptic={false}` opt-out at this atom
 *     level; if a caller needs silent toggles they can compose a custom
 *     Pressable + Text pair rather than bending the atom's contract.
 *   - Controlled only: `checked` is required + `onChange(next)` fires with
 *     the new boolean. This matches the PWA's contract where the parent
 *     owns the state (form libs wire into React Hook Form via the `checked`
 *     prop). We deliberately don't support an uncontrolled "defaultChecked"
 *     — one fewer footgun for i18n/RTL state resets.
 *
 * Dark mode
 * ---------
 * Box background, border, and check glyph all route through `theme.colors`,
 * so the Restyle provider's dark override flips everything automatically
 * when the OS scheme changes.
 *
 * Touch target
 * ------------
 * The visible box is 20×20 px, but `hitSlop` expands the Pressable to at
 * least 44×44 (per iOS HIG). When a `label` is present the label itself
 * pushes the row's tap region well past 44px vertically, so hitSlop only
 * matters for the rare box-without-label case.
 */

import { type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useAppTheme } from '@/theme';
import { triggerHaptic } from './haptic';

// `noUncheckedIndexedAccess` widens every theme token lookup to `T | undefined`
// regardless of the underlying record shape. The keys below are exhaustively
// defined in `src/theme/tokens.ts`, so we coerce each group into a narrow
// literal record whose values the compiler treats as always-present. Same
// pattern the rest of the atoms use (see Pill.tsx).
type CheckboxColors = {
  [K in
    | 'accent'
    | 'accentInk'
    | 'border'
    | 'borderStrong'
    | 'inkPrimary'
    | 'inkMuted'
    | 'transparent']: string;
};
type CheckboxSpace = { [K in 'xs' | 's']: number };
type CheckboxRadii = { [K in 'sm']: number };
type CheckboxFonts = { [K in 'body' | 'bodySemiBold']: string };
type CheckboxWeights = { [K in 'semibold' | 'bold']: string };
type CheckboxVariants = {
  body: { fontSize: number; lineHeight: number };
  label: { fontSize: number; lineHeight: number };
};

export interface CheckboxProps
  extends Omit<PressableProps, 'children' | 'style' | 'onPress'> {
  /** Current state. Required — the atom is controlled only. */
  checked: boolean;
  /** Fires with the *next* boolean on tap. */
  onChange: (next: boolean) => void;
  /**
   * Bolded primary label. Read by AT as the checkbox's accessible name
   * (unless an explicit `accessibilityLabel` is provided). A Checkbox
   * without either a `label` or an `accessibilityLabel` would ship an
   * unlabelled toggle — callers using `labelNode` must supply the latter.
   */
  label?: string;
  /** Optional secondary line — rendered in the muted ink token. */
  hint?: string;
  /**
   * Optional richer label node, used in place of the plain string label.
   * When both are provided, `labelNode` wins. Useful when the label
   * contains an inline link or formatted segment.
   */
  labelNode?: ReactNode;
  /** Escape hatch — merged after atom-computed style. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const BOX_SIZE = 20;

/**
 * Checkbox atom. See module docblock for the controlled-only contract and
 * the a11y promise (role="checkbox", state.checked mirrors prop).
 */
export function Checkbox({
  checked,
  onChange,
  label,
  hint,
  labelNode,
  disabled,
  style,
  testID,
  accessibilityLabel,
  ...rest
}: CheckboxProps) {
  const theme = useAppTheme();
  const c = theme.colors as unknown as CheckboxColors;
  const space = theme.spacing as unknown as CheckboxSpace;
  const radii = theme.borderRadii as unknown as CheckboxRadii;
  const fonts = theme.fontFamilies as unknown as CheckboxFonts;
  const weights = theme.fontWeights as unknown as CheckboxWeights;
  const variants = theme.textVariants as unknown as CheckboxVariants;

  const isDisabled = Boolean(disabled);
  const borderColor = checked ? c.accent : c.borderStrong;
  const backgroundColor = checked ? c.accent : c.transparent;

  const handlePress = () => {
    if (isDisabled) return;
    triggerHaptic(30); // Light impact per haptic.ts mapping table.
    onChange(!checked);
  };

  // Screen readers need a stable string; prefer an explicit accessibilityLabel,
  // fall back to the label string. Callers using `labelNode` should pass
  // accessibilityLabel explicitly.
  const resolvedA11yLabel = accessibilityLabel ?? label;

  return (
    <Pressable
      {...rest}
      testID={testID}
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: isDisabled }}
      accessibilityLabel={resolvedA11yLabel}
      accessibilityHint={hint}
      hitSlop={8}
      style={({ pressed }) => [
        styles.row,
        {
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          paddingVertical: space.xs,
        },
        style,
      ]}
    >
      <View
        // Box is purely visual — AT reads the Pressable's role + state
        // instead. We use `accessible={false}` (not the stronger
        // `accessibilityElementsHidden`) so RNTL test queries can still
        // walk into the box if they need to inspect the tick glyph.
        accessible={false}
        style={[
          styles.box,
          {
            width: BOX_SIZE,
            height: BOX_SIZE,
            borderRadius: radii.sm,
            borderColor,
            backgroundColor,
          },
        ]}
      >
        {checked ? (
          /* Tick: rendered as a Text glyph rather than SVG so this atom
             stays outside the SVG transformer pipeline (M4a-1). The ✓
             character is in every system font; size is pinned to 14 so
             it visually centres inside the 20×20 box. */
          <Text
            testID={testID ? `${testID}-check` : undefined}
            style={{
              color: c.accentInk,
              fontSize: 14,
              lineHeight: 14,
              fontWeight: weights.bold as '700',
              textAlign: 'center',
            }}
          >
            {'\u2713'}
          </Text>
        ) : null}
      </View>

      {labelNode ?? (label || hint) ? (
        <View style={{ flex: 1, marginLeft: space.s }}>
          {labelNode ? (
            labelNode
          ) : (
            <>
              {label ? (
                <Text
                  style={{
                    color: c.inkPrimary,
                    fontSize: variants.body.fontSize,
                    lineHeight: variants.body.lineHeight,
                    fontFamily: fonts.bodySemiBold,
                    fontWeight: weights.semibold as '600',
                  }}
                >
                  {label}
                </Text>
              ) : null}
              {hint ? (
                <Text
                  style={{
                    color: c.inkMuted,
                    fontSize: variants.label.fontSize,
                    lineHeight: variants.label.lineHeight,
                    fontFamily: fonts.body,
                    marginTop: 2,
                  }}
                >
                  {hint}
                </Text>
              ) : null}
            </>
          )}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  box: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
