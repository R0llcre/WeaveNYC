/**
 * WeaveNYC Mobile — Design Tokens (Restyle port)
 * ==============================================
 *
 * Direct port of the PWA's CSS variable system from
 * `apps/pwa/src/app/globals.css` (Editorial 朱砂 system) into a
 * strongly-typed `@shopify/restyle` theme.
 *
 * Port rules
 * ----------
 * 1. Every `--color-*`, `--space-*`, `--radius-*`, `--shadow-*`, and
 *    `--type-*` token from the PWA is represented here. The *names* mirror
 *    the PWA's semantic names (e.g. `ink.primary`, `accent`, `verified`) so
 *    designer handoff docs and cross-platform screenshots can reference the
 *    same tokens.
 * 2. Values resolved to concrete primitives: CSS `rgba(...)` alpha strings
 *    become RN-friendly `rgba(...)` literals (RN accepts these on iOS +
 *    Android). `var(--foo)` references collapse to their resolved value.
 * 3. The light palette lives in this file under `theme`. The dark overrides
 *    mirror `@media (prefers-color-scheme: dark)` exactly — same keys, new
 *    values — and live in `darkTheme`.
 * 4. Typography: the PWA's `font: weight size/line-height family` shorthand
 *    is split into RN-native props (`fontFamily`, `fontSize`, `lineHeight`,
 *    `fontWeight`). `clamp()` responsive values are pinned to the iPhone
 *    ceiling (widest viewport hit in mobile) because RN has no fluid typo
 *    primitive. `rem`-based sizes converted at 16px = 1rem.
 * 5. Shadows: RN shadow props are platform-specific. We store IOS shadow
 *    props (`shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius`)
 *    plus Android `elevation` together inside `boxShadows`. Consumers spread
 *    the token into a style object.
 * 6. Spacing: renamed to semantic `xs..xxxxxl` to match Restyle idioms while
 *    preserving the PWA's 4px base scale (1-12). See TOKENS.md for the
 *    full crosswalk.
 *
 * Assumption
 * ----------
 * `@shopify/restyle` is installed in this worktree's local sibling (M1's
 * scaffold). If it is not, the import below resolves via workspace after
 * M1 lands. To verify standalone we shim the `createTheme` helper locally
 * if the import fails — see `./restyle-shim.ts`.
 */

import { createTheme } from '@shopify/restyle';

// ---------------------------------------------------------------------------
// Palette — raw, named colour primitives. Every semantic token downstream
// references this object so we can retune a hue without touching consumers.
//
// Typing is done via `widenPalette` rather than `Record<string, string>` on
// purpose. Under `noUncheckedIndexedAccess`, a plain `Record<string, string>`
// makes every lookup `string | undefined`, which then cascades into `theme`
// / `darkTheme` assignments — Restyle's generic sees `string | undefined`
// and rejects `string`-only color tokens. `widenPalette` preserves the
// *known keys* (so IDE autocomplete still lights up every name) AND widens
// each value to `string`, so `darkTheme` can override `inkPaper` with a
// different literal than the light palette. We can't get both properties
// from `Record<string, string>` alone. The object below is still the single
// source of truth — only the type flow changed.
// ---------------------------------------------------------------------------
const widenPalette = <T extends Record<string, string>>(
  p: T,
): { [K in keyof T]: string } => p;
const palette = widenPalette({
  // Warm paper-cream surfaces (light)
  cream: '#f4ece0', //           --color-bg light
  creamSoft: '#faf6ed', //       --color-surface light
  creamSunken: '#ecdfca', //     --color-surface-sunken light
  white: '#ffffff', //           --color-surface-raised / ink-inverse / accent-ink light

  // Warm near-black surfaces (dark). NOT cold gray — the brand is
  // paper/ink, not carbon-fiber tech.
  inkPaper: '#1a1511', //        --color-bg dark
  inkPaperSoft: '#251e18', //    --color-surface dark
  inkPaperRaised: '#2e2620', //  --color-surface-raised dark
  inkPaperSunken: '#1f1914', //  --color-surface-sunken dark

  // Ink (near-black warm greys)
  inkPrimary: '#1a1f24', //      --color-ink-primary light
  inkSecondary: '#4a4a4e', //    --color-ink-secondary light
  inkMuted: '#6e6157', //        --color-ink-muted light

  // Ink on dark (warm cream tones)
  inkPrimaryDark: '#f0e8dc', //  --color-ink-primary dark
  inkSecondaryDark: '#c8bfae', // --color-ink-secondary dark
  inkMutedDark: '#a39888', //    --color-ink-muted dark

  // Vermillion accent (chop-mark)
  vermillion: '#c73d3d', //      --color-accent light
  vermillionStrong: '#9d2c2c', // --color-accent-strong light
  vermillionSoft: 'rgba(199, 61, 61, 0.08)', // --color-accent-soft light
  vermillionBright: '#e85a5a', // --color-accent dark
  vermillionBrightStrong: '#f07878', // --color-accent-strong dark
  vermillionBrightSoft: 'rgba(232, 90, 90, 0.14)', // --color-accent-soft dark

  // 苔绿 moss green (verified / community)
  moss: '#4a7c5e', //             --color-verified light
  mossStrong: '#2f5a3f', //       --color-verified-strong light
  mossSoft: 'rgba(74, 124, 94, 0.12)', // --color-verified-soft light
  mossCommunitySoft: 'rgba(74, 124, 94, 0.08)', // --color-community-soft light
  mossBright: '#6aa07f', //       --color-verified dark
  mossBrightStrong: '#8cbfa1', // --color-verified-strong dark
  mossBrightSoft: 'rgba(106, 160, 127, 0.18)', // --color-verified-soft dark
  mossBrightCommunitySoft: 'rgba(106, 160, 127, 0.14)', // --color-community-soft dark

  // 琥珀 amber (urgent / warning)
  amber: '#c8871f', //            --color-urgent light
  amberStrong: '#8f5d0f', //      --color-urgent-strong light
  amberSoft: 'rgba(200, 135, 31, 0.12)', // --color-urgent-soft light
  amberBright: '#d89c3f', //      --color-urgent dark
  amberBrightStrong: '#e8b566', // --color-urgent-strong dark
  amberBrightSoft: 'rgba(216, 156, 63, 0.18)', // --color-urgent-soft dark

  // 沉红 deep red (danger)
  deepRed: '#8b2a2a', //          --color-danger light
  deepRedStrong: '#6b1e1e', //    --color-danger-strong light
  deepRedSoft: 'rgba(139, 42, 42, 0.10)', // --color-danger-soft light
  deepRedDark: '#b93838', //      --color-danger dark
  deepRedDarkStrong: '#8f2525', // --color-danger-strong dark
  deepRedDarkSoft: 'rgba(185, 56, 56, 0.18)', // --color-danger-soft dark

  // Info blue
  info: '#3a5b7c', //             --color-info light
  infoSoft: 'rgba(58, 91, 124, 0.10)', // --color-info-soft light
  infoBright: '#6a8fb3', //       --color-info dark
  infoBrightSoft: 'rgba(106, 143, 179, 0.16)', // --color-info-soft dark

  // Border / divider alphas on light (warm-ink on cream)
  borderLight: 'rgba(26, 31, 36, 0.14)', //         --color-border light
  borderStrongLight: 'rgba(26, 31, 36, 0.28)', //   --color-border-strong light
  dividerLight: 'rgba(26, 31, 36, 0.08)', //        --color-divider light
  overlayLight: 'rgba(26, 31, 36, 0.48)', //        --color-overlay light

  // Border / divider alphas on dark (cream-ink on warm-black)
  borderDark: 'rgba(240, 232, 220, 0.12)', //       --color-border dark
  borderStrongDark: 'rgba(240, 232, 220, 0.24)', // --color-border-strong dark
  dividerDark: 'rgba(240, 232, 220, 0.08)', //      --color-divider dark
  overlayDark: 'rgba(0, 0, 0, 0.66)', //            --color-overlay dark

  // Illustration soft fill (accent alpha, very low)
  illustrationSoftLight: 'rgba(199, 61, 61, 0.06)', // --illustration-soft light
  illustrationSoftDark: 'rgba(232, 90, 90, 0.08)', //  --illustration-soft dark

  // Focus ring alphas
  focusRingLight: 'rgba(26, 31, 36, 0.72)', //      --focus-ring-color light
  focusRingDark: 'rgba(240, 232, 220, 0.8)', //     --focus-ring-color dark

  // Transparent (explicit token so consumers don't hardcode)
  transparent: 'transparent',
});

// ---------------------------------------------------------------------------
// Font stacks. RN uses a single font family name; the PWA's `font-family`
// chain is flattened here because RN has no CSS font fallback cascade and
// picks the first installed family. Noto Sans SC is requested via system
// "PingFang SC" fallback at the OS level on iOS / Android respectively.
// The named families below must match the keys loaded in `./fonts.ts`.
// ---------------------------------------------------------------------------
const fontFamilies: Record<string, string> = {
  display: 'Fraunces', //    matches --font-family-display head
  displayVariable: 'Fraunces-Variable',
  body: 'Inter', //          matches --font-family-base head
  bodyMedium: 'Inter-Medium',
  bodySemiBold: 'Inter-SemiBold',
  bodyBold: 'Inter-Bold',
  mono: 'IBMPlexMono', //    matches --font-family-mono head
};

// ---------------------------------------------------------------------------
// Shared token groups — values identical between light and dark unless
// overridden in `darkTheme` below.
// ---------------------------------------------------------------------------

// Spacing (4px base, 1-12 in PWA → xs..xxxxxl semantic in Restyle).
// Crosswalk documented in TOKENS.md.
const spacing = {
  none: 0,
  xs: 4, //      --space-1
  s: 8, //       --space-2
  sm: 12, //     --space-3
  m: 16, //      --space-4
  ml: 20, //     --space-5
  l: 24, //      --space-6
  xl: 28, //     --space-7
  xxl: 32, //    --space-8
  xxxl: 36, //   --space-9
  xxxxl: 40, //  --space-10
  xxxxxl: 44, // --space-11
  xxxxxxl: 48, // --space-12
} as const;

// Radii — tighter, print-like. Pill kept for chips/tags.
const borderRadii = {
  none: 0,
  sm: 2, //     --radius-sm
  md: 4, //     --radius-md
  lg: 8, //     --radius-lg
  xl: 12, //    --radius-xl
  pill: 9999, // --radius-pill
} as const;

// Font weight numerics (string-valued because RN only accepts string weights
// on Android and "100".."900" on iOS; Restyle normalises).
const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

// Motion tokens — RN Animated uses ms integers, not CSS strings.
const durations = {
  fast: 120, //   --transition-fast (120ms ease-out)
  medium: 220, // --transition-med  (220ms ease-out)
} as const;

// Z-index scale. PWA sets `z-index: 999` for the skip-link and an overlay
// overlay layer. We lift these into named tokens so atoms don't guess.
const zIndices = {
  base: 0,
  dropdown: 10,
  sticky: 100,
  overlay: 500,
  modal: 800,
  toast: 900,
  skipLink: 999,
} as const;

// Focus-ring geometry (RN borders emulate the CSS outline).
const focusRing = {
  width: 3, //   --focus-ring-width
  offset: 2, //  --focus-ring-offset
} as const;

// ---------------------------------------------------------------------------
// LIGHT theme (the canonical brand).
// ---------------------------------------------------------------------------
export const theme = createTheme({
  colors: {
    // Surfaces
    bg: palette.cream, //                    --color-bg
    surface: palette.creamSoft, //           --color-surface
    surfaceRaised: palette.white, //         --color-surface-raised
    surfaceSunken: palette.creamSunken, //   --color-surface-sunken
    surfaceSolid: palette.white, //          --color-surface-solid (alias)
    overlay: palette.overlayLight, //        --color-overlay
    illustrationSoft: palette.illustrationSoftLight, // --illustration-soft

    // Ink (text)
    inkPrimary: palette.inkPrimary, //       --color-ink-primary
    inkSecondary: palette.inkSecondary, //   --color-ink-secondary
    inkMuted: palette.inkMuted, //           --color-ink-muted
    inkInverse: palette.white, //            --color-ink-inverse
    // Semantic alias so consumers can write `color="ink"` for body copy.
    ink: palette.inkPrimary, //              --color-ink (legacy alias)

    // Borders / dividers
    border: palette.borderLight, //          --color-border
    borderStrong: palette.borderStrongLight, // --color-border-strong
    divider: palette.dividerLight, //        --color-divider

    // Accent (vermillion chop-mark)
    accent: palette.vermillion, //           --color-accent
    accentStrong: palette.vermillionStrong, // --color-accent-strong
    accentSoft: palette.vermillionSoft, //   --color-accent-soft
    accentInk: palette.white, //             --color-accent-ink
    // Legacy aliases kept for cross-platform consistency with PWA.
    paper: palette.cream, //                 --color-paper (legacy alias)
    chopmark: palette.vermillion, //         --color-chopmark (legacy alias)

    // Semantic siblings — verified / community / urgent / danger / info
    verified: palette.moss, //               --color-verified
    verifiedStrong: palette.mossStrong, //   --color-verified-strong
    verifiedSoft: palette.mossSoft, //       --color-verified-soft
    community: palette.moss, //              --color-community (alias verified)
    communitySoft: palette.mossCommunitySoft, // --color-community-soft

    urgent: palette.amber, //                --color-urgent
    urgentStrong: palette.amberStrong, //    --color-urgent-strong
    urgentSoft: palette.amberSoft, //        --color-urgent-soft

    danger: palette.deepRed, //              --color-danger
    dangerStrong: palette.deepRedStrong, //  --color-danger-strong
    dangerSoft: palette.deepRedSoft, //      --color-danger-soft

    info: palette.info, //                   --color-info
    infoSoft: palette.infoSoft, //           --color-info-soft

    // Legacy status aliases (PWA kept these for backwards compat)
    success: palette.moss, //                --color-success → verified
    successSoft: palette.mossSoft, //        --color-success-soft → verified-soft
    warning: palette.amber, //               --color-warning → urgent
    warningSoft: palette.amberSoft, //       --color-warning-soft → urgent-soft

    // Focus ring fill colour
    focusRing: palette.focusRingLight, //    --focus-ring-color

    // Utility
    transparent: palette.transparent,
  },

  spacing,
  borderRadii,

  /**
   * Text variants. Each matches one `--type-*` CSS shorthand from the PWA.
   * The `defaults` variant is what Restyle falls back to when a consumer
   * omits `variant`, and doubles as the body copy token.
   *
   * `lineHeight` is given in absolute pixels (RN's API). Values converted
   * from the PWA's unitless multipliers:
   *   lineHeight = round(fontSize * cssLineHeight)
   */
  textVariants: {
    defaults: {
      fontFamily: fontFamilies.body,
      fontSize: 16, //     1rem
      lineHeight: 26, //   1.65 × 16 ≈ 26
      fontWeight: fontWeights.regular,
      color: 'inkPrimary',
    },
    // --type-display — Fraunces display, clamp ceiling = 2rem (32px).
    // Weight 500 per PWA.
    display: {
      fontFamily: fontFamilies.display,
      fontSize: 32,
      lineHeight: 38, // 1.2 × 32
      fontWeight: fontWeights.medium,
      color: 'inkPrimary',
    },
    // --type-h1 — Fraunces display, clamp ceiling = 2.5rem (40px), weight 600.
    h1: {
      fontFamily: fontFamilies.display,
      fontSize: 40,
      lineHeight: 46, // 1.15 × 40
      fontWeight: fontWeights.semibold,
      color: 'inkPrimary',
    },
    // --type-h2 — Fraunces display 1.625rem (26px), weight 500.
    h2: {
      fontFamily: fontFamilies.display,
      fontSize: 26,
      lineHeight: 32, // 1.25 × 26 ≈ 32
      fontWeight: fontWeights.medium,
      color: 'inkPrimary',
    },
    // --type-h3 — V2-E: switched to Inter weight 600 at 1.25rem (20px).
    h3: {
      fontFamily: fontFamilies.bodySemiBold,
      fontSize: 20,
      lineHeight: 28, // 1.4 × 20
      fontWeight: fontWeights.semibold,
      color: 'inkPrimary',
    },
    // --type-h4 — V2-E: Inter weight 600 at 1.0625rem (17px).
    h4: {
      fontFamily: fontFamilies.bodySemiBold,
      fontSize: 17,
      lineHeight: 24, // 1.4 × 17 ≈ 24
      fontWeight: fontWeights.semibold,
      color: 'inkPrimary',
    },
    // --type-overline — Inter 0.75rem (12px), weight 500.
    overline: {
      fontFamily: fontFamilies.bodyMedium,
      fontSize: 12,
      lineHeight: 17, // 1.4 × 12
      fontWeight: fontWeights.medium,
      color: 'inkSecondary',
    },
    // --type-body — Inter 1rem (16px), weight 400.
    body: {
      fontFamily: fontFamilies.body,
      fontSize: 16,
      lineHeight: 26, // 1.65 × 16
      fontWeight: fontWeights.regular,
      color: 'inkPrimary',
    },
    // --type-body-sm — Inter 0.9375rem (15px), weight 400.
    bodySmall: {
      fontFamily: fontFamilies.body,
      fontSize: 15,
      lineHeight: 24, // 1.6 × 15
      fontWeight: fontWeights.regular,
      color: 'inkPrimary',
    },
    // --type-label — Inter 0.8125rem (13px), weight 500.
    label: {
      fontFamily: fontFamilies.bodyMedium,
      fontSize: 13,
      lineHeight: 18, // 1.35 × 13
      fontWeight: fontWeights.medium,
      color: 'inkSecondary',
    },
    // --type-micro — Inter 0.75rem (12px), weight 400.
    micro: {
      fontFamily: fontFamilies.body,
      fontSize: 12,
      lineHeight: 17, // 1.4 × 12
      fontWeight: fontWeights.regular,
      color: 'inkMuted',
    },
    // Alias of body for semantic parity with PWA --type-small.
    small: {
      fontFamily: fontFamilies.body,
      fontSize: 15,
      lineHeight: 24,
      fontWeight: fontWeights.regular,
      color: 'inkPrimary',
    },
    // Alias of h2 for semantic parity with PWA --type-title.
    title: {
      fontFamily: fontFamilies.display,
      fontSize: 26,
      lineHeight: 32,
      fontWeight: fontWeights.medium,
      color: 'inkPrimary',
    },
  },

  /**
   * Box shadows. RN shadow props are platform-specific, so each entry holds
   * the full set (iOS: shadowColor/Offset/Opacity/Radius + Android elevation).
   * Consumers spread the token into their style:
   *
   *   const theme = useAppTheme();
   *   <View style={[styles.card, theme.boxShadows.md]} />
   *
   * A dedicated `shadow-0` / `shadow-1` "none" entry exists because the PWA
   * design language uses borders (not shadows) for rest elevation, and atoms
   * need a way to request "explicitly no shadow".
   */
  boxShadows: {
    none: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    sm: {
      // --shadow-sm → --shadow-1 (none at rest; border handles sep)
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    md: {
      // --shadow-md → --shadow-2: 0 2px 6px rgba(26,31,36,0.06)
      shadowColor: '#1a1f24',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
    lg: {
      // --shadow-lg → --shadow-3: 0 8px 24px rgba(26,31,36,0.10)
      shadowColor: '#1a1f24',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 24,
      elevation: 6,
    },
    xl: {
      // --shadow-4: 0 16px 40px rgba(26,31,36,0.14)
      shadowColor: '#1a1f24',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.14,
      shadowRadius: 40,
      elevation: 12,
    },
    focusRing: {
      // --shadow-ring-focus: 0 0 0 3px rgba(26,31,36,0.32)
      // Emulated with shadow spread on iOS (no native spread, so we use
      // a 3px shadowRadius + high opacity to approximate). Android uses
      // borderColor/borderWidth on the atom itself instead.
      shadowColor: '#1a1f24',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.32,
      shadowRadius: 3,
      elevation: 0,
    },
    focusRingDanger: {
      // --focus-ring-danger: 0 0 0 3px rgba(139,42,42,0.35)
      shadowColor: '#8b2a2a',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 3,
      elevation: 0,
    },
  },

  // -------------------------------------------------------------------------
  // Non-Restyle-standard groups. These are pass-through custom fields so the
  // theme stays the single source of truth. Restyle's `createTheme` accepts
  // arbitrary extra keys — they just aren't transformed by any built-in
  // prop parser. Atoms access them via `useAppTheme()` directly.
  // -------------------------------------------------------------------------
  fontFamilies,
  fontWeights,
  durations,
  zIndices,
  focusRing,
});

export type Theme = typeof theme;

// ---------------------------------------------------------------------------
// DARK theme — mirrors `@media (prefers-color-scheme: dark)` overrides.
//
// Only surface / ink / border / accent / semantic / illustration / shadow /
// focus-ring tokens change. Spacing, radii, typography size scale, and
// motion values are identical to `theme`.
// ---------------------------------------------------------------------------
export const darkTheme: Theme = {
  ...theme,
  colors: {
    ...theme.colors,

    // Surfaces — warm near-black.
    bg: palette.inkPaper, //                     --color-bg dark
    surface: palette.inkPaperSoft, //            --color-surface dark
    surfaceRaised: palette.inkPaperRaised, //    --color-surface-raised dark
    surfaceSunken: palette.inkPaperSunken, //    --color-surface-sunken dark
    surfaceSolid: palette.inkPaperRaised, //     --color-surface-solid dark
    overlay: palette.overlayDark, //             --color-overlay dark
    illustrationSoft: palette.illustrationSoftDark, // --illustration-soft dark

    // Cream ink on warm-black.
    inkPrimary: palette.inkPrimaryDark, //       --color-ink-primary dark
    inkSecondary: palette.inkSecondaryDark, //   --color-ink-secondary dark
    inkMuted: palette.inkMutedDark, //           --color-ink-muted dark
    inkInverse: palette.inkPaper, //             --color-ink-inverse dark
    ink: palette.inkPrimaryDark, //              --color-ink dark (alias)
    paper: palette.inkPaper, //                  --color-paper dark (alias)

    // Borders — cream at low alpha.
    border: palette.borderDark, //               --color-border dark
    borderStrong: palette.borderStrongDark, //   --color-border-strong dark
    divider: palette.dividerDark, //             --color-divider dark

    // Accent — vermillion brightened so it still signals against warm-black.
    accent: palette.vermillionBright, //         --color-accent dark
    accentStrong: palette.vermillionBrightStrong, // --color-accent-strong dark
    accentSoft: palette.vermillionBrightSoft, // --color-accent-soft dark
    accentInk: palette.inkPaper, //              --color-accent-ink dark
    chopmark: palette.vermillionBright, //       --color-chopmark dark (alias)

    // Semantic siblings — re-tuned for legibility on dark.
    verified: palette.mossBright, //             --color-verified dark
    verifiedStrong: palette.mossBrightStrong, // --color-verified-strong dark
    verifiedSoft: palette.mossBrightSoft, //     --color-verified-soft dark
    community: palette.mossBright, //            --color-community dark
    communitySoft: palette.mossBrightCommunitySoft, // --color-community-soft dark

    urgent: palette.amberBright, //              --color-urgent dark
    urgentStrong: palette.amberBrightStrong, //  --color-urgent-strong dark
    urgentSoft: palette.amberBrightSoft, //      --color-urgent-soft dark

    danger: palette.deepRedDark, //              --color-danger dark
    dangerStrong: palette.deepRedDarkStrong, //  --color-danger-strong dark
    dangerSoft: palette.deepRedDarkSoft, //      --color-danger-soft dark

    info: palette.infoBright, //                 --color-info dark
    infoSoft: palette.infoBrightSoft, //         --color-info-soft dark

    // Legacy status aliases in dark.
    success: palette.mossBright, //              --color-success dark → verified
    successSoft: palette.mossBrightSoft, //      --color-success-soft dark
    warning: palette.amberBright, //             --color-warning dark → urgent
    warningSoft: palette.amberBrightSoft, //     --color-warning-soft dark

    // Focus ring flips to cream-on-ink.
    focusRing: palette.focusRingDark, //         --focus-ring-color dark
  },

  // Shadows need much deeper black on dark because the mid-range border
  // trick loses its separation. Keep the elevation hierarchy (sm < md < lg).
  boxShadows: {
    ...theme.boxShadows,
    md: {
      // --shadow-md dark: 0 2px 8px rgba(0,0,0,0.4)
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      // --shadow-lg dark: 0 4px 16px rgba(0,0,0,0.5)
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 16,
      elevation: 8,
    },
    xl: {
      // --shadow-4 dark: 0 8px 24px rgba(0,0,0,0.6)
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.6,
      shadowRadius: 24,
      elevation: 16,
    },
    focusRing: {
      // --shadow-ring-focus dark: 0 0 0 3px rgba(240,232,220,0.4)
      shadowColor: '#f0e8dc',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 3,
      elevation: 0,
    },
  },
};

/**
 * Palette is exported so theme-preview / storybook can display the raw
 * primitives alongside their semantic names.
 */
export { palette };
