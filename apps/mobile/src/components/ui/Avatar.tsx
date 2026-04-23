/**
 * Avatar — circular identity glyph with initials fallback.
 * =========================================================
 *
 * RN port of `apps/pwa/src/components/ui/Avatar.tsx`. Preserves the web
 * twin's deterministic-colour contract so the same display name renders
 * with the same tint on PWA and native — critical for users who flip
 * between devices and expect "Kai R." to look identical in both places.
 *
 * Port notes
 * ----------
 *   - `<span>` + inline SVG glyph → `View` + `Image` (remote `uri`) or
 *     `Text` (initials). No SVG at this atom level; M4a-1 handled the
 *     svg-transformer pipeline and Icon/IconButton land in R4.
 *   - `HASH_TONES` ported verbatim (same 5-entry palette, same index-by-
 *     name-hash rule) — only the CSS variables swap to Restyle tokens.
 *     If the PWA appends a 6th tone later, updating both atoms is a
 *     one-line change per side.
 *   - The `name`-hashed index lookup is **bit-for-bit identical** to the
 *     PWA implementation (same 32-bit `(hash << 5) - hash + char` rolling
 *     hash, same `Math.abs() % mod` reduction). Do not "optimise" it —
 *     changing the hash means every existing user's avatar tint jumps,
 *     which breaks visual recognition across sessions.
 *
 * Sizes
 * -----
 * The PWA ships 28 / 40 / 56 px circles. Mobile preserves these pixel
 * values literally; Restyle's spacing tokens are 4px-base and don't line
 * up cleanly with legacy avatar dimensions, so we hold the concrete
 * integers here rather than mapping to `theme.spacing.*`.
 *
 * Dark mode
 * ---------
 * Every tone pair references `theme.colors.*Soft` + `*Strong` pairs that
 * already have dark-mode overrides in `darkTheme`. No per-mode branching
 * required at the atom layer; the Restyle provider flips the value the
 * component sees when the OS scheme changes.
 *
 * A11y
 * ----
 * An avatar is decorative when rendered next to the user's display name
 * (e.g. in a chat row the name label already carries the identity). We
 * respect that by defaulting to `accessible={false}` — enough for AT to
 * skip the circle without excluding the subtree from test queries.
 * Callers rendering an avatar *alone* (no nearby label) pass
 * `accessibilityLabel` to opt into a spoken announcement.
 */

import { type ReactNode } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useAppTheme, type Theme } from '@/theme';

export type AvatarSize = 'sm' | 'md' | 'lg';

/**
 * Concrete pixel diameters. Kept as a literal map so the prop union
 * autocomplete shows every size and a future addition forces a compile
 * error in this table.
 */
const SIZE_PX: Record<AvatarSize, number> = {
  sm: 28,
  md: 40,
  lg: 56,
};

/**
 * Palette of accent-tinted `{ bg, fg }` pairs for name-hashed avatars.
 * Each entry resolves to a token on the Restyle theme so dark-mode
 * surfaces stay legible without per-mode branching here.
 *
 * The ORDER matters — we index into this array via the name hash, and
 * reordering it would reshuffle which names get which tint across
 * deployments. Append-only if you add tones.
 */
function toneFor(theme: Theme, index: number): { bg: string; fg: string } {
  // `noUncheckedIndexedAccess` widens every theme.colors lookup to
  // `string | undefined` regardless of the underlying shape. The token keys
  // below are exhaustively defined in tokens.ts, so coerce colors to a
  // narrow literal record whose values the compiler treats as always-present.
  // This is the same pattern every other atom in the barrel uses (see Pill.tsx).
  type AvatarColors = {
    [K in
      | 'accentSoft'
      | 'accentStrong'
      | 'communitySoft'
      | 'verifiedSoft'
      | 'verifiedStrong'
      | 'urgentSoft'
      | 'urgentStrong'
      | 'infoSoft'
      | 'info']: string;
  };
  const c = theme.colors as unknown as AvatarColors;

  const tones: Array<{ bg: string; fg: string }> = [
    { bg: c.accentSoft, fg: c.accentStrong },
    { bg: c.communitySoft, fg: c.verifiedStrong },
    { bg: c.verifiedSoft, fg: c.verifiedStrong },
    { bg: c.urgentSoft, fg: c.urgentStrong },
    { bg: c.infoSoft, fg: c.info },
  ];
  // Defensive — `index % tones.length` already clamps in hashIndex, but
  // keep a fallback so a caller that hand-passes a tone index can't crash
  // the render if they pass `tones.length`.
  return tones[index % tones.length] ?? tones[0]!;
}

export interface AvatarProps {
  /**
   * User-facing display name. The first character of each whitespace-
   * split segment is used to build a 1–2 letter monogram. When `name`
   * is empty the avatar falls back to a generic silhouette glyph.
   */
  name?: string;
  /**
   * Explicit initials override. Useful when the caller has already
   * computed "KR" from "Kai Ryan" and wants to skip the atom's heuristic.
   */
  initials?: string;
  /** sm (28px) | md (40px) | lg (56px). Defaults to md. */
  size?: AvatarSize;
  /** Remote image URI. Takes precedence over initials when provided. */
  uri?: string;
  /** Optional fallback node (e.g. a custom SVG) when name is empty. */
  fallbackGlyph?: ReactNode;
  /**
   * Spoken name for the avatar. Defaults to undefined (decorative); set
   * explicitly when the avatar is rendered without an adjacent text label.
   */
  accessibilityLabel?: string;
  /** Escape hatch — merged after atom-computed style. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Trim, split on whitespace, take up to 2 segments, return uppercase monogram. */
function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return '';
  // `noUncheckedIndexedAccess` widens `parts[i]` to `string | undefined`; we
  // just bounded-checked the length, so non-null assertions here are safe
  // and keep the branch logic readable.
  if (parts.length === 1) {
    const first = parts[0]!;
    return (first.charAt(0) + (first.charAt(1) ?? '')).toUpperCase();
  }
  return (parts[0]!.charAt(0) + parts[1]!.charAt(0)).toUpperCase();
}

/**
 * 32-bit rolling hash — `(h << 5) - h + c`, clamped to int32 per iteration
 * so the arithmetic matches the PWA exactly. Ported verbatim; **do not
 * replace with a different hash**. See module docblock for the "why".
 */
function hashIndex(key: string, mod: number): number {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % mod;
}

/**
 * Avatar atom. See module docblock for port contract. Visually: a
 * circle filled with the name-hashed tone; centred monogram on top, or
 * remote image cover-fit when `uri` is provided, or a generic person
 * glyph when neither name nor uri is available.
 */
export function Avatar({
  name = '',
  initials,
  size = 'md',
  uri,
  fallbackGlyph,
  accessibilityLabel,
  style,
  testID,
}: AvatarProps) {
  const theme = useAppTheme();

  const resolved = initials ?? initialsFromName(name);
  // Hash on a stable key — `name || 'default'` mirrors the PWA so empty-
  // name avatars all land on the same tone (tone[0]) rather than being
  // indeterministic.
  const toneIndex = hashIndex(name || 'default', 5);
  const tone = toneFor(theme, toneIndex);
  const px = SIZE_PX[size];
  const hasInitials = resolved.length > 0;
  const isDecorative = !accessibilityLabel;

  return (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      // Decorative avatars opt out of AT focus via `accessible={false}`.
      // The stronger `accessibilityElementsHidden` + `importantForAccessibility`
      // combo would also work, but both make RNTL's `getByTestId` skip the
      // child glyph — unnecessary since the whole avatar is just 28-56px
      // of identity decoration with no interaction surface.
      accessible={!isDecorative}
      style={[
        styles.base,
        {
          width: px,
          height: px,
          borderRadius: px / 2, // true circle — RN has no `50%` radius.
          backgroundColor: tone.bg,
        },
        style,
      ]}
    >
      {uri ? (
        <Image
          testID={testID ? `${testID}-image` : undefined}
          source={{ uri }}
          accessibilityIgnoresInvertColors
          style={{ width: px, height: px, borderRadius: px / 2 }}
        />
      ) : hasInitials ? (
        <Text
          testID={testID ? `${testID}-initials` : undefined}
          style={{
            color: tone.fg,
            // Matches the PWA's 0.42 × diameter rule — keeps monograms
            // visually centred at every size without per-size hand tuning.
            fontSize: Math.round(px * 0.42),
            // `as '700'` / `as string` — coerce past the `noUncheckedIndexedAccess`
            // widening so RN's `fontWeight` narrow literal type accepts the token.
            fontWeight: (theme.fontWeights as unknown as { bold: string }).bold as '700',
            fontFamily: (theme.fontFamilies as unknown as { bodySemiBold: string }).bodySemiBold,
            letterSpacing: -0.3,
          }}
        >
          {resolved}
        </Text>
      ) : fallbackGlyph ? (
        fallbackGlyph
      ) : (
        /* Default silhouette — a muted dot disk. Stays legible at 28px
           and avoids inline SVG (M4a-1 territory). */
        <View
          testID={testID ? `${testID}-fallback` : undefined}
          style={{
            width: Math.round(px * 0.45),
            height: Math.round(px * 0.45),
            borderRadius: Math.round(px * 0.45) / 2,
            backgroundColor: tone.fg,
            opacity: 0.55,
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
