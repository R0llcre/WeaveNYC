/**
 * Field — labelled text input wrapper.
 * =====================================
 *
 * Port of `apps/pwa/src/components/ui/Field.tsx` to React Native. The PWA
 * version clones its child control (input/select/textarea) and wires aria
 * describedby via React refs and `useId`. On mobile there's one control
 * shape (`TextInput`), so we own the input directly and expose the minimum
 * set of `TextInput` props callers need to drive it (`value`,
 * `onChangeText`, `keyboardType`, `autoCapitalize`, `secureTextEntry`).
 *
 * Accessibility:
 *   - `accessibilityLabel` defaults to the visible `label` so TalkBack /
 *     VoiceOver announce the field name even when the label text isn't a
 *     descendent of the input node (RN doesn't wire `htmlFor` the way the
 *     web does — the visible label and the input are siblings in the tree).
 *   - `hint` renders muted below the input and is attached via
 *     `accessibilityHint` so the screen reader reads it after the label.
 *   - `error` renders in the `danger` colour and is attached via
 *     `accessibilityLiveRegion="polite"` (Android) / `accessible` node
 *     (iOS announces the label+hint chain) so corrections are picked up
 *     by assistive tech on change.
 *
 * Dark-mode: `inkPrimary`, `inkSecondary`, `inkMuted`, `danger`, and
 * `border` / `borderStrong` all flip automatically via Restyle, so the
 * field renders legibly on both palettes without a branch here.
 *
 * Keyboard / capitalisation: the prop names match RN `TextInput` 1:1
 * instead of inventing WeaveNYC aliases — consumers already need to learn
 * RN's primitive surface, so adding a translation layer buys nothing.
 */

import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { useAppTheme } from '@/theme';

export interface FieldProps {
  /** Visible label above the input. Required. */
  label: string;
  /** Muted helper text shown below the input. Single line. */
  hint?: string;
  /** Error message shown below the input in the `danger` colour. */
  error?: string;
  /** Controlled text value. */
  value: string;
  /** Change handler — matches `TextInput`'s `onChangeText` signature. */
  onChangeText: (next: string) => void;
  /** Forwarded to `TextInput`. */
  keyboardType?: KeyboardTypeOptions;
  /** Forwarded to `TextInput`. */
  autoCapitalize?: TextInputProps['autoCapitalize'];
  /** Forwarded to `TextInput`. Hides entered characters. */
  secureTextEntry?: boolean;
  /** Visible placeholder inside the input. */
  placeholder?: string;
  /**
   * Override the derived `accessibilityLabel`. Defaults to `label`, which is
   * correct for the vast majority of cases — only override when the visible
   * label is ambiguous in isolation (e.g. `"Search"` inside a multi-search
   * screen might want `"Search resources"` for assistive tech).
   */
  accessibilityLabel?: string;
  /** Escape hatch on the outer container style. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Field({
  label,
  hint,
  error,
  value,
  onChangeText,
  keyboardType,
  autoCapitalize,
  secureTextEntry,
  placeholder,
  accessibilityLabel,
  style,
  testID,
}: FieldProps) {
  const theme = useAppTheme();
  const [focused, setFocused] = useState(false);

  // Derive a11y labels from visible text so assistive tech always has
  // context even when the label/hint/error sit in sibling nodes.
  const a11yLabel = accessibilityLabel ?? label;
  const a11yHint = error ? error : hint;

  const borderColor = (
    error
      ? theme.colors.danger
      : focused
        ? theme.colors.borderStrong
        : theme.colors.border
  ) as string;

  // Cast theme lookups at the boundary; see Toast.tsx for the same pattern
  // rationale (palette is `Record<string, string>` so every access is
  // typed as `string | undefined` despite always being defined at runtime).
  const labelDynamic: TextStyle = {
    color: theme.colors.inkSecondary as string,
    fontSize: theme.textVariants.label.fontSize as number,
    lineHeight: theme.textVariants.label.lineHeight as number,
    fontWeight: theme.textVariants.label.fontWeight as TextStyle['fontWeight'],
    marginBottom: theme.spacing.xs as number,
  };
  const inputDynamic: TextStyle = {
    color: theme.colors.inkPrimary as string,
    backgroundColor: theme.colors.surface as string,
    borderColor,
    borderRadius: theme.borderRadii!.md as number,
    paddingHorizontal: theme.spacing.sm as number,
    paddingVertical: theme.spacing.s as number,
    fontSize: theme.textVariants.body.fontSize as number,
    lineHeight: theme.textVariants.body.lineHeight as number,
  };
  const hintDynamic: TextStyle = {
    color: theme.colors.inkMuted as string,
    fontSize: theme.textVariants.micro.fontSize as number,
    lineHeight: theme.textVariants.micro.lineHeight as number,
    marginTop: theme.spacing.xs as number,
  };
  const errorDynamic: TextStyle = {
    color: theme.colors.danger as string,
    fontSize: theme.textVariants.micro.fontSize as number,
    lineHeight: theme.textVariants.micro.lineHeight as number,
    marginTop: theme.spacing.xs as number,
  };

  return (
    <View style={[styles.container, style]} testID={testID}>
      <Text style={[styles.label, labelDynamic]}>{label}</Text>

      <TextInput
        accessibilityLabel={a11yLabel}
        accessibilityHint={a11yHint}
        accessibilityState={{ disabled: false }}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        secureTextEntry={secureTextEntry}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.inkMuted as string}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, inputDynamic]}
      />

      {hint && !error ? (
        <Text style={[styles.hint, hintDynamic]}>{hint}</Text>
      ) : null}

      {error ? (
        <Text
          // `accessibilityLiveRegion` is the Android-specific knob for
          // announcing updates. iOS relies on the `accessibilityHint`
          // wiring on the input; both paths surface the error.
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={[styles.error, errorDynamic]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // no sizing — consumer owns width via Stack/layout parent
  },
  label: {
    // colour and metrics come from the theme at render time
  },
  input: {
    borderWidth: 1,
  },
  hint: {},
  error: {
    fontWeight: '500',
  },
});
