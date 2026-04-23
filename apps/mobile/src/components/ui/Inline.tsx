/**
 * Inline — one-axis horizontal layout primitive.
 * ===============================================
 *
 * Port of `apps/pwa/src/components/ui/Inline.tsx` to React Native.
 * Same shape as `Stack` but `flexDirection: 'row'` plus a `wrap?` prop
 * that toggles `flexWrap: 'wrap' | 'nowrap'`.
 *
 * Default cross-axis alignment is `center` because horizontal rows almost
 * always want vertically-centred children (e.g. icon + label, pill + count,
 * avatar + name). That matches the PWA's default so screens ported from the
 * web don't visibly shift alignment when swapped onto mobile.
 *
 * Dark-mode: no colour tokens rendered — the atom has no surface or text
 * of its own, so the dark theme change is a no-op at the Inline layer.
 *
 * Usage:
 * ```tsx
 * <Inline gap="s" align="center" justify="between" wrap>
 *   <Text>Sunset Pantry</Text>
 *   <Pill>0.4 mi</Pill>
 * </Inline>
 * ```
 */

import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme, type Theme } from '@/theme';

export type InlineSpaceToken = keyof Theme['spacing'];

export type InlineAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline';

export type InlineJustify =
  | 'start'
  | 'center'
  | 'end'
  | 'between'
  | 'around'
  | 'evenly';

const ALIGN_MAP: Record<InlineAlign, ViewStyle['alignItems']> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
  baseline: 'baseline',
};

const JUSTIFY_MAP: Record<InlineJustify, ViewStyle['justifyContent']> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
  evenly: 'space-evenly',
};

export interface InlineProps {
  children: ReactNode;
  /** Horizontal gap between children, resolved against `theme.spacing`. */
  gap?: InlineSpaceToken;
  /** Cross-axis alignment (defaults to `center`). */
  align?: InlineAlign;
  /** Main-axis distribution (defaults to `start`). */
  justify?: InlineJustify;
  /** Allow children to wrap to a new line when overflowing. */
  wrap?: boolean;
  /** Escape hatch — merged AFTER the Inline-computed style. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

export function Inline({
  children,
  gap = 'sm',
  align = 'center',
  justify = 'start',
  wrap = false,
  style,
  testID,
  accessibilityLabel,
}: InlineProps) {
  const theme = useAppTheme();
  const gapValue = theme.spacing[gap];

  return (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          flexDirection: 'row',
          gap: gapValue,
          alignItems: ALIGN_MAP[align],
          justifyContent: JUSTIFY_MAP[justify],
          flexWrap: wrap ? 'wrap' : 'nowrap',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
