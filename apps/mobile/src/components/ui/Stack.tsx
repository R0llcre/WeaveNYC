/**
 * Stack — one-axis vertical layout primitive.
 * ============================================
 *
 * Port of `apps/pwa/src/components/ui/Stack.tsx` to React Native.
 * Provides a vertical flex container whose gap is a Restyle spacing token,
 * so every screen reaches for the same vertical rhythm instead of magic
 * `marginBottom` values. The PWA version accepts a numeric `--space-*`
 * index (1..12); the mobile version accepts Restyle semantic names
 * (`xs`..`xxxxxxl`) directly. The crosswalk is documented in
 * `src/theme/TOKENS.md`.
 *
 * The component stays a thin `View` wrapper:
 *   - Only writes `flexDirection: 'column'` once at mount.
 *   - Resolves `gap` via `useAppTheme().spacing[gap]`.
 *   - Leaves the rest of the style surface open via `style` so layouts
 *     that need `flex: 1`, `padding`, etc. don't have to fork the atom.
 *
 * Dark-mode: no colour tokens rendered — the atom has no surface or text
 * of its own, so the dark theme change is a no-op at the Stack layer.
 *
 * Usage:
 * ```tsx
 * <Stack gap="m" align="center">
 *   <Field label="Email" value={email} onChangeText={setEmail} />
 *   <Field label="Password" value={pwd} onChangeText={setPwd} secureTextEntry />
 * </Stack>
 * ```
 */

import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme, type Theme } from '@/theme';

/**
 * Mirrors the Restyle theme spacing keys so consumers get IDE autocomplete
 * when typing `gap="m"` and can never pass `gap="7"` or another ad-hoc
 * value that would drift off the token scale.
 */
export type StackSpaceToken = keyof Theme['spacing'];

/** Cross-axis alignment. Named to match CSS flex semantics minus the `flex-` prefix. */
export type StackAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline';

/** Main-axis distribution. Mirrors the PWA Inline/Stack vocabulary. */
export type StackJustify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';

const ALIGN_MAP: Record<StackAlign, ViewStyle['alignItems']> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
  baseline: 'baseline',
};

const JUSTIFY_MAP: Record<StackJustify, ViewStyle['justifyContent']> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
  evenly: 'space-evenly',
};

export interface StackProps {
  children: ReactNode;
  /** Vertical gap between children, resolved against `theme.spacing`. */
  gap?: StackSpaceToken;
  /** Cross-axis alignment (defaults to `stretch` per native flex default). */
  align?: StackAlign;
  /** Main-axis distribution (defaults to `start`). */
  justify?: StackJustify;
  /** Escape hatch — merged AFTER the Stack-computed style. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

export function Stack({
  children,
  gap = 'sm',
  align = 'stretch',
  justify = 'start',
  style,
  testID,
  accessibilityLabel,
}: StackProps) {
  const theme = useAppTheme();
  const gapValue = theme.spacing[gap];

  return (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          flexDirection: 'column',
          gap: gapValue,
          alignItems: ALIGN_MAP[align],
          justifyContent: JUSTIFY_MAP[justify],
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
