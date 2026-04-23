/**
 * Tag — non-interactive categorical label.
 * =========================================
 *
 * RN port of `apps/pwa/src/components/ui/Tag.tsx`. Visually close to `Pill`
 * but deliberately NOT interactive: a Tag never has press semantics and
 * never changes app state. Use it for resource categories, post status, or
 * verification badges — things the user can't toggle.
 *
 * Mobile tone palette (aligned with PWA):
 *   - `neutral`   — soft grey/ink-muted surface. Default.
 *   - `verified`  — moss-green soft. Used for trust markers.
 *   - `community` — moss-green *lighter* soft (alias of verified with a
 *                    calmer alpha for non-officiality).
 *   - `urgent`    — amber soft. Used when a resource is time-sensitive.
 *   - `info`      — blue soft. Used for neutral meta (languages offered,
 *                    age group).
 *
 * The PWA also ships `accent`, `warning`, `danger`, and `muted`; we pulled
 * the subset most used by the 5-tab shell. Adding the rest later is a
 * single-object-entry change in `toneTokens()`.
 *
 * Dark-mode: every *Soft token has a dark override in `darkTheme.colors`
 * so surface washes stay legible on warm-black without contrast shifts.
 * The component itself is colour-scheme-agnostic — it reads from the
 * active theme via `useAppTheme()` and Restyle does the scheme switch.
 */

import { type ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useAppTheme, type Theme } from '@/theme';

export type TagTone =
  | 'neutral'
  | 'verified'
  | 'community'
  | 'urgent'
  | 'info';

export interface TagProps {
  /** Semantic tone. Defaults to `neutral`. */
  tone?: TagTone;
  /** Label text or a small inline node. */
  children: ReactNode;
  /** Escape hatch on the outer container style. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Map a tone to the `{ surface, label }` token pair. Lives outside the
 * component so the object is allocated once per module load, not per
 * render. Keys match `TagTone`; TypeScript's exhaustive-check ensures a
 * future tone addition also updates this map.
 */
// `noUncheckedIndexedAccess` in the monorepo's tsconfig.base.json widens
// every theme lookup to `T | undefined` regardless of the underlying type
// (even on `Record<string, string>`). Restyle's own typings don't propagate
// the literal shape out of `createTheme` either. The token keys below are
// exhaustively defined in `src/theme/tokens.ts`, so coerce each group to a
// specific `Record<LiteralUnion, T>` whose values the compiler then treats
// as always-present. The narrow unions double as compile-time guards that
// this atom can only reach for tokens the theme actually declares.
type TagColors = { [K in
  | 'verifiedSoft'
  | 'verifiedStrong'
  | 'communitySoft'
  | 'urgentSoft'
  | 'urgentStrong'
  | 'infoSoft'
  | 'info'
  | 'surfaceSunken'
  | 'inkSecondary']: string };
type TagSpace = { [K in 'none' | 's']: number };
type TagRadii = { [K in 'pill']: number };
type TagFonts = { [K in 'bodyMedium']: string };
type TagWeights = { [K in 'medium']: '500' };
type TagVariants = { micro: { fontSize: number; lineHeight: number } };

function toneTokens(
  theme: Theme,
  tone: TagTone,
): { surface: string; label: string } {
  const c = theme.colors as unknown as TagColors;
  switch (tone) {
    case 'verified':
      return { surface: c.verifiedSoft, label: c.verifiedStrong };
    case 'community':
      return { surface: c.communitySoft, label: c.verifiedStrong };
    case 'urgent':
      return { surface: c.urgentSoft, label: c.urgentStrong };
    case 'info':
      return { surface: c.infoSoft, label: c.info };
    case 'neutral':
    default:
      return { surface: c.surfaceSunken, label: c.inkSecondary };
  }
}

/** Non-interactive categorical label. See module docblock. */
export function Tag({
  tone = 'neutral',
  children,
  style,
  testID,
}: TagProps) {
  const theme = useAppTheme();
  const { surface, label } = toneTokens(theme, tone);
  const space = theme.spacing as unknown as TagSpace;
  const radii = theme.borderRadii as unknown as TagRadii;
  const fonts = theme.fontFamilies as unknown as TagFonts;
  const weights = theme.fontWeights as unknown as TagWeights;
  const variants = theme.textVariants as unknown as TagVariants;

  return (
    <View
      testID={testID}
      // Read-only: no role, no accessibilityState. Screen readers announce
      // the child text as part of the parent's context, which matches a
      // Tag's semantic — "label attached to this resource", not a UI
      // control. Hanging a role on a View here would train AT to treat
      // tags as buttons; regression tests below lock this out.
      style={[
        styles.base,
        {
          backgroundColor: surface,
          borderRadius: radii.pill,
          paddingVertical: space.none,
          paddingHorizontal: space.s,
          height: 22,
        },
        style,
      ]}
    >
      {typeof children === 'string' ? (
        <Text
          style={{
            color: label,
            fontSize: variants.micro.fontSize,
            lineHeight: variants.micro.lineHeight,
            fontFamily: fonts.bodyMedium,
            fontWeight: weights.medium,
          }}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
});
