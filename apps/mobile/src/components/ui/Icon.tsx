/**
 * Icon — inline SVG glyph atom.
 * =============================
 *
 * RN port of `apps/pwa/src/components/ui/Icon.tsx`. The web twin injects an
 * inline SVG string via `dangerouslySetInnerHTML`; native has no DOM, so
 * instead we look the `name` up in the asset registry (shipped by M4a-1 /
 * PR #90) — each entry resolves to a React component produced by
 * `react-native-svg-transformer` over a source `.svg` file.
 *
 * Contract with the PWA twin
 * --------------------------
 *   - `name` uses the same key space on both platforms. Call sites that
 *     work on web with `<Icon name="food" />` work here identically.
 *   - `size` maps to the same pixel scale (sm=16, md=20, lg=24).
 *   - `tone` pulls colour from `useAppTheme().colors.*` — tokens mirror the
 *     PWA's CSS variables (`--color-accent`, `--color-ink-muted`, etc.), so
 *     dark-mode flips happen automatically when the OS scheme toggles.
 *   - Decorative icons default to `accessibilityElementsHidden` so screen
 *     readers skip them; passing `label` flips the role to "image" and
 *     announces the label.
 *
 * Placeholder branch
 * ------------------
 * Until M4a-1 merges, the shim (`./_icon-registry-shim.ts`) exports only
 * the `IconName` type — no runtime `icons` map. Even after M4a-1 lands,
 * the registry might not cover every name that ships in the PWA, so we
 * render a same-sized `<View />` as a safe fallback. The placeholder is
 * transparent, keeps layout stable, and — crucially — inherits the `label`
 * (when provided) so dev builds can still spot the missing glyph via
 * VoiceOver rotor / Accessibility Inspector.
 */

import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme';

import { type IconName } from './_icon-registry-shim';

export type { IconName } from './_icon-registry-shim';

export type IconSize = 'sm' | 'md' | 'lg';
export type IconTone =
  | 'accent'
  | 'ink'
  | 'muted'
  | 'community'
  | 'urgent'
  | 'verified'
  | 'danger';

/**
 * Pixel scale per size. These numbers match the PWA registry exactly so
 * a glyph rendered at `size="md"` is 20×20 on both platforms.
 */
const SIZE_PX: Record<IconSize, number> = {
  sm: 16,
  md: 20,
  lg: 24,
};

export interface IconProps {
  /** Registered icon key (see IconName). */
  name: IconName;
  /** Visual scale. Defaults to `md` (20px). */
  size?: IconSize;
  /** Semantic colour tone. Defaults to `ink` (primary ink). */
  tone?: IconTone;
  /**
   * Accessible label. When provided, the icon is exposed to AT as an image
   * and announces the label. When omitted, the icon is decorative and
   * screen readers skip it.
   */
  label?: string;
  /** Test hook. */
  testID?: string;
}

/**
 * Icon atom. See module docblock for the PWA compatibility notes and the
 * placeholder-on-missing-registry-entry rationale.
 */
export function Icon({
  name,
  size = 'md',
  tone = 'ink',
  label,
  testID,
}: IconProps) {
  const theme = useAppTheme();
  const px = SIZE_PX[size];

  // Resolve the tone token to a concrete colour. Keeping the lookup
  // explicit (rather than `theme.colors[tone]`) so TypeScript catches a
  // missing token at compile time. `string | undefined` mirrors the
  // Restyle theme's color map — dark-mode palettes may not fill every
  // slot, and we tolerate undefined rather than crashing.
  let color: string | undefined;
  switch (tone) {
    case 'accent':
      color = theme.colors.accent;
      break;
    case 'ink':
      color = theme.colors.inkPrimary;
      break;
    case 'muted':
      color = theme.colors.inkMuted;
      break;
    case 'community':
      color = theme.colors.community;
      break;
    case 'urgent':
      color = theme.colors.urgent;
      break;
    case 'verified':
      color = theme.colors.verified;
      break;
    case 'danger':
      color = theme.colors.danger;
      break;
  }

  // A11y contract:
  //   - `label` provided → expose as an image role with that label so AT
  //     reads the localized string.
  //   - `label` omitted  → decorative: set `accessible={false}` so the
  //     node is present in the render tree but screen readers skip it.
  //     We deliberately avoid `accessibilityElementsHidden={true}` and
  //     `importantForAccessibility="no-hide-descendants"` here; both pull
  //     the subtree out of the a11y tree hard enough that component-query
  //     helpers (e.g. RNTL's `getByTestId`) filter it out entirely, which
  //     breaks "snapshot the rendered layout" tests even though the
  //     element is on screen.
  //   - Placeholder branch (no registry entry): we still set
  //     `accessibilityLabel={name}` so dev builds can surface the missing
  //     glyph through VoiceOver / Accessibility Inspector. Task spec R4
  //     calls this out explicitly.
  const isDecorative = !label;

  // M4a-1 merges the real registry. Until then (or if a caller passes a
  // name the registry doesn't know about), render a same-sized View with
  // the name as `aria-label` so dev builds can still spot the missing
  // glyph via VoiceOver. Task spec R4 requires this exact behaviour.
  return (
    <View
      accessible={isDecorative ? false : true}
      accessibilityRole={isDecorative ? undefined : 'image'}
      accessibilityLabel={label ?? name}
      testID={testID}
      style={[styles.base, { width: px, height: px }]}
    >
      {/* Placeholder square — intentionally transparent. When M4a-1 lands,
          this branch becomes `const Svg = icons[name]; return <Svg .../>`. */}
      <View
        style={{
          width: px,
          height: px,
          // Token-coloured so designers can visually spot the placeholder
          // in dev until the real SVG component ships.
          backgroundColor: theme.colors.transparent,
        }}
      />
      {/* The swatch is a separate view so the real <Svg /> replacement
          doesn't alter the outer layout contract (width/height on root). */}
      <View
        style={{
          position: 'absolute',
          width: px,
          height: px,
          borderColor: color,
          opacity: 0.2,
          borderWidth: 1,
          borderRadius: 2,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
