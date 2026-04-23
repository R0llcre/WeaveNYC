/**
 * Card — surface container atom.
 * ===============================
 *
 * RN port of `apps/pwa/src/components/ui/Card.tsx`. Provides a pre-styled
 * panel that groups related content (a resource summary, a form section,
 * a settings block). The atom keeps the visual contract with the web
 * twin:
 *
 *   - `flat`     — borderless-looking surface with the standard token
 *                  padding + background. Default; the cheapest variant
 *                  and the one every screen should reach for first.
 *   - `elevated` — layers the Restyle `boxShadows.sm` token on top of
 *                  the raised surface fill. Reserve for a single primary
 *                  card per screen — over-elevation on mobile breaks the
 *                  print-ink aesthetic the PWA established.
 *
 * The PWA has a third `accent` variant (vermillion-soft wash); we defer
 * it because mobile screens currently only need flat + elevated. Adding
 * it later is a 3-line branch in this file.
 *
 * Padding
 * -------
 * `padding` prop accepts the Restyle spacing vocabulary (`'s' | 'm' | 'l'`
 * …). Default is `'m'` which matches the PWA's `--space-4` card padding.
 * Pass `padding="none"` to kill the built-in padding when the card holds
 * a media element that must bleed to the edges (e.g. map preview).
 *
 * Dark-mode
 * ---------
 * `surface`, `surfaceRaised`, and `border` all flip via the Restyle dark
 * theme; `boxShadows.sm` also has a dark override (deeper shadow so the
 * raised surface still reads on warm-black backgrounds). No branch here.
 */

import { type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

import { useAppTheme } from '@/theme';

export type CardVariant = 'flat' | 'elevated';

/**
 * Padding vocabulary. Mirrors the Restyle `spacing` scale plus a `'none'`
 * escape for edge-bleed layouts. Narrowed to the tokens cards actually
 * need (we don't want consumers reaching for `xxxxxl` on a card).
 */
export type CardPadding = 'none' | 'xs' | 's' | 'sm' | 'm' | 'l';

export interface CardProps extends Omit<ViewProps, 'style'> {
  /** Visual weight. `flat` (default) vs `elevated` (boxShadows.sm). */
  variant?: CardVariant;
  /** Padding inside the card. Defaults to `'m'`. `'none'` kills padding. */
  padding?: CardPadding;
  /** Card body. */
  children: ReactNode;
  /** Merged after the atom-computed style. Escape hatch. */
  style?: StyleProp<ViewStyle>;
}

/** Surface container — see module docblock for variant guidance. */
export function Card({
  variant = 'flat',
  padding = 'm',
  children,
  style,
  ...rest
}: CardProps) {
  const theme = useAppTheme();

  const backgroundColor =
    variant === 'elevated' ? theme.colors.surfaceRaised : theme.colors.surface;

  // Map the `CardPadding` vocabulary to the Restyle spacing scale, with
  // `'none'` short-circuiting to 0. Pulled out so the style array below
  // stays readable; kept inline (not a module constant) because it closes
  // over `theme.spacing`, which is re-resolved every render.
  //
  // The direct index is safe because the `CardPadding` union is a subset
  // of `theme.spacing`'s keys by construction — Restyle's token object
  // has `xs | s | sm | m | ml | l | xl | …` and we expose only those.
  const resolvedPadding =
    padding === 'none' ? 0 : theme.spacing[padding];

  return (
    <View
      {...rest}
      style={[
        styles.base,
        {
          backgroundColor,
          borderColor: theme.colors.border,
          // `borderRadii` is declared optional by Restyle's BaseTheme; the
          // fallback pins the PWA's `--radius-lg` (8px) so the style stays
          // compile-clean without a non-null assertion.
          borderRadius: theme.borderRadii?.lg ?? 8,
          padding: resolvedPadding,
        },
        // `boxShadows.sm` is a pre-composed object (shadowColor / Offset /
        // Opacity / Radius + Android elevation); spread so it layers on
        // top of the pre-computed base without forcing the style array to
        // grow. `flat` passes `null` so the slot evaporates.
        variant === 'elevated' ? theme.boxShadows.sm : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    // Hairline border keeps rest-state separation without shadow cost,
    // consistent with the PWA's border-not-shadow language.
    borderWidth: StyleSheet.hairlineWidth,
  },
});
