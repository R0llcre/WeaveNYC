/**
 * Radio + RadioGroup — single-choice selection atoms.
 * ====================================================
 *
 * RN port of `apps/pwa/src/components/ui/Radio.tsx`. The web twin is a
 * forwarded `<input type="radio">` wrapped in a `<label>`; on native we
 * need to build both the individual Radio *and* a RadioGroup wrapper
 * because Android/iOS don't have a built-in radio primitive — the a11y
 * + mutual-exclusion semantics have to live at the atom level.
 *
 * Design
 * ------
 *   - `RadioGroup` owns the selected-value state and fans it out through
 *     a React Context. Each child `Radio` reads `selectedValue` + the
 *     group's `onChange` via `useRadioGroup()` and decides its own
 *     `checked` state by comparing its `value` prop. This mirrors the
 *     HTML `<input name="x" value="...">` grouping model exactly and
 *     means consumers don't have to thread `selected === value`
 *     everywhere.
 *   - Standalone usage (no RadioGroup parent) falls back to the controlled
 *     `checked` + `onChange(next)` props. This matches how the PWA lets
 *     you render a lone radio inside a non-grouped form field.
 *   - `accessibilityRole="radio"` + `accessibilityState.checked` on every
 *     Radio so VoiceOver / TalkBack announce "selected" / "not selected".
 *     The **group** itself carries `accessibilityRole="radiogroup"` so AT
 *     users hear the set boundary when swiping into the form.
 *
 * Haptic
 * ------
 * A Light impact fires on every selection change. Like Checkbox, this is
 * always-on — radios represent a commitment to a choice and tactile
 * feedback is load-bearing for clarity. Consumers that need silent
 * toggles can compose raw `Pressable` rows themselves.
 *
 * Dark mode
 * ---------
 * Every token routes through `theme.colors.*`, with dark overrides
 * already wired in the Restyle theme. No per-mode branching at this atom.
 */

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
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

// See Checkbox/Pill for the rationale: `noUncheckedIndexedAccess` widens every
// theme token lookup to `T | undefined`. We coerce each group to a narrow
// literal record whose values the compiler treats as always-present.
type RadioColors = {
  [K in
    | 'accent'
    | 'borderStrong'
    | 'inkPrimary'
    | 'inkMuted'
    | 'transparent']: string;
};
type RadioSpace = { [K in 'xs' | 's']: number };
type RadioFonts = { [K in 'body' | 'bodySemiBold']: string };
type RadioWeights = { [K in 'semibold']: string };
type RadioVariants = {
  body: { fontSize: number; lineHeight: number };
  label: { fontSize: number; lineHeight: number };
};

// ---------------------------------------------------------------------------
// RadioGroup context — the plumbing between a group wrapper and its kids.
// ---------------------------------------------------------------------------

interface RadioGroupContextValue {
  /** Currently selected value within this group. `null` means no selection. */
  selectedValue: string | null;
  /** Group-level change handler — fires with the newly selected value. */
  onChange: (next: string) => void;
  /** Disables every radio in the group; per-radio `disabled` can add to this. */
  groupDisabled: boolean;
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

/** Hook — Radio uses this to detect whether it's inside a group. */
function useRadioGroup(): RadioGroupContextValue | null {
  return useContext(RadioGroupContext);
}

// ---------------------------------------------------------------------------
// RadioGroup wrapper.
// ---------------------------------------------------------------------------

export interface RadioGroupProps {
  /** Currently selected value, or `null` for "none". */
  value: string | null;
  /** Fires with the new value when the selection changes. */
  onChange: (next: string) => void;
  /** Disables every Radio in the group. Defaults to false. */
  disabled?: boolean;
  /** Accessible label for the whole group — read once as AT enters the set. */
  accessibilityLabel?: string;
  /** Group children (the individual Radio elements). */
  children: ReactNode;
  /** Escape hatch on the outer View style. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * RadioGroup — mutual-exclusion wrapper around a set of Radio atoms.
 * Manages selected state via context; passes `onChange` down so children
 * don't each need their own controlled-state plumbing.
 */
export function RadioGroup({
  value,
  onChange,
  disabled = false,
  accessibilityLabel,
  children,
  style,
  testID,
}: RadioGroupProps) {
  // Memoise so consumers that forget to useCallback their `onChange` still
  // get a stable context identity across re-renders with unchanged value.
  const ctx = useMemo<RadioGroupContextValue>(
    () => ({
      selectedValue: value,
      onChange,
      groupDisabled: disabled,
    }),
    [value, onChange, disabled],
  );

  return (
    <RadioGroupContext.Provider value={ctx}>
      <View
        testID={testID}
        // radiogroup is the proper ARIA-style role; RN maps the string to the
        // platform equivalent on iOS/Android so VO/TalkBack announce the set.
        accessibilityRole="radiogroup"
        accessibilityLabel={accessibilityLabel}
        style={style}
      >
        {children}
      </View>
    </RadioGroupContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Radio atom.
// ---------------------------------------------------------------------------

export interface RadioProps
  extends Omit<PressableProps, 'children' | 'style' | 'onPress'> {
  /**
   * This radio's value. When inside a RadioGroup, the group compares
   * `value === selectedValue` to decide if this radio renders checked.
   */
  value: string;
  /** Bold primary label — read by AT as the radio's accessible name. */
  label?: string;
  /** Muted secondary line. */
  hint?: string;
  /**
   * Controlled checked state — ONLY used when this Radio is rendered
   * outside a RadioGroup. Inside a group, the group's `selectedValue`
   * wins and this prop is ignored.
   */
  checked?: boolean;
  /**
   * Standalone change handler — ONLY used when outside a RadioGroup.
   * Inside a group, the group's `onChange(value)` fires instead.
   */
  onChange?: (next: boolean) => void;
  /** Escape hatch — merged after atom-computed style. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const OUTER_SIZE = 20;
const INNER_SIZE = 10; // inner dot when checked — 50% of outer for classic radio feel

/**
 * Radio atom. Renders as a circular ring with an inner dot when checked.
 * Inside a RadioGroup, pressing this radio fires the group's onChange with
 * this radio's `value`. Outside a group, falls back to local `checked` +
 * `onChange(bool)` (matches the PWA's standalone contract).
 */
export function Radio({
  value,
  label,
  hint,
  checked: checkedProp,
  onChange,
  disabled,
  accessibilityLabel,
  style,
  testID,
  ...rest
}: RadioProps) {
  const theme = useAppTheme();
  const c = theme.colors as unknown as RadioColors;
  const space = theme.spacing as unknown as RadioSpace;
  const fonts = theme.fontFamilies as unknown as RadioFonts;
  const weights = theme.fontWeights as unknown as RadioWeights;
  const variants = theme.textVariants as unknown as RadioVariants;
  const group = useRadioGroup();

  // Derive the effective checked state + handler: group-driven when a group
  // is present, local otherwise.
  const isInGroup = group !== null;
  const isChecked = isInGroup ? group.selectedValue === value : Boolean(checkedProp);
  const isDisabled = Boolean(disabled) || Boolean(group?.groupDisabled);

  const handlePress = () => {
    if (isDisabled) return;
    // Haptic fires on EVERY tap (even when re-selecting the already-selected
    // option) so users always get confirmation the tap registered. Mirrors
    // iOS native radio-row behaviour.
    triggerHaptic(30); // Light impact per haptic.ts mapping table.
    if (isInGroup) {
      // Group owns state; only fire if the value actually changes (avoids
      // spurious re-renders on double-tap of the selected option).
      if (group.selectedValue !== value) group.onChange(value);
      return;
    }
    onChange?.(!isChecked);
  };

  const borderColor = isChecked ? c.accent : c.borderStrong;
  const resolvedA11yLabel = accessibilityLabel ?? label;

  return (
    <Pressable
      {...rest}
      testID={testID}
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: isChecked, disabled: isDisabled }}
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
        // Ring is purely visual; AT reads the Pressable's role + state. Using
        // `accessible={false}` (not `accessibilityElementsHidden`) keeps the
        // subtree queryable for tests.
        accessible={false}
        style={[
          styles.outer,
          {
            width: OUTER_SIZE,
            height: OUTER_SIZE,
            borderRadius: OUTER_SIZE / 2,
            borderColor,
            backgroundColor: c.transparent,
          },
        ]}
      >
        {isChecked ? (
          <View
            testID={testID ? `${testID}-dot` : undefined}
            style={{
              width: INNER_SIZE,
              height: INNER_SIZE,
              borderRadius: INNER_SIZE / 2,
              backgroundColor: c.accent,
            }}
          />
        ) : null}
      </View>

      {label || hint ? (
        <View style={{ flex: 1, marginLeft: space.s }}>
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
  outer: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
