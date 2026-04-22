/**
 * WeaveNYC — Design Token System port for React Native (Restyle).
 * Source of truth: apps/pwa/src/app/globals.css (Editorial 朱砂 palette).
 *
 * SCOPE: this is the M1 scaffold slice — ~50 tokens that the 5-tab shell
 * and the first wave of atoms (wave B) will consume. It is NOT the full
 * 500+ CSS-variable surface of the PWA. Missing tokens get added as
 * atoms get ported.
 *
 * TODO(wave-B):
 *   - semantic banner/chip variants (verified/urgent/danger soft+strong)
 *   - map overlay colours, activity ticker stripe colour
 *   - shadow tokens (RN needs iOS+Android shape; CSS shadow strings
 *     don't translate 1:1). Use Restyle's `shadowVariants` when needed.
 *
 * Dark mode: we expose a `theme` (light) and `darkTheme` that shares
 * everything but overrides colors. Consumers pick via `useAppTheme()`
 * (see ./index.ts) which reads `useColorScheme()`.
 */

import { createTheme } from '@shopify/restyle';

// ---------------------------------------------------------------------------
// Palette — light (canonical brand surface)
// ---------------------------------------------------------------------------

const lightPalette = {
  // Surfaces — warm paper cream, layered white.
  bg: '#f4ece0',
  surface: '#faf6ed',
  surfaceRaised: '#ffffff',
  surfaceSunken: '#ecdfca',
  surfaceSolid: '#ffffff',
  overlay: 'rgba(26, 31, 36, 0.48)',
  illustrationSoft: 'rgba(199, 61, 61, 0.06)',

  // Ink — warm grey-browns, NOT true black.
  inkPrimary: '#1a1f24',
  inkSecondary: '#4a4a4e',
  inkMuted: '#6e6157',
  inkInverse: '#ffffff',

  // Borders replace shadows as the primary separation tool.
  border: 'rgba(26, 31, 36, 0.14)',
  borderStrong: 'rgba(26, 31, 36, 0.28)',
  divider: 'rgba(26, 31, 36, 0.08)',

  // Vermillion accent — ONE signal colour for every primary CTA + link.
  accent: '#c73d3d',
  accentStrong: '#9d2c2c',
  accentSoft: 'rgba(199, 61, 61, 0.08)',
  accentInk: '#ffffff',

  // Semantic siblings — 3 tonal siblings. Verified/community share family.
  verified: '#4a7c5e',
  verifiedSoft: 'rgba(74, 124, 94, 0.12)',
  verifiedStrong: '#2f5a3f',
  community: '#4a7c5e',
  communitySoft: 'rgba(74, 124, 94, 0.08)',
  urgent: '#c8871f',
  urgentSoft: 'rgba(200, 135, 31, 0.12)',
  urgentStrong: '#8f5d0f',
  danger: '#8b2a2a',
  dangerStrong: '#6b1e1e',
  dangerSoft: 'rgba(139, 42, 42, 0.10)',
  info: '#3a5b7c',
  infoSoft: 'rgba(58, 91, 124, 0.10)',

  // Focus ring (neutral deep-ink — see V2-E rationale in globals.css).
  focusRing: 'rgba(26, 31, 36, 0.72)',

  // Transparent constant — Restyle requires a real value for named uses.
  transparent: 'transparent',
};

// ---------------------------------------------------------------------------
// Palette — dark (warm-black, accommodating; NOT a separate brand theme).
// ---------------------------------------------------------------------------

const darkPalette = {
  ...lightPalette,
  bg: '#1a1511',
  surface: '#251e18',
  surfaceRaised: '#2e2620',
  surfaceSunken: '#1f1914',
  surfaceSolid: '#2e2620',
  overlay: 'rgba(0, 0, 0, 0.66)',
  illustrationSoft: 'rgba(232, 90, 90, 0.08)',

  inkPrimary: '#f0e8dc',
  inkSecondary: '#c8bfae',
  inkMuted: '#a39888',

  border: 'rgba(240, 232, 220, 0.12)',
  borderStrong: 'rgba(240, 232, 220, 0.24)',
  divider: 'rgba(240, 232, 220, 0.08)',

  accent: '#e85a5a',
  accentStrong: '#f07878',
  accentSoft: 'rgba(232, 90, 90, 0.14)',
  accentInk: '#1a1511',

  verified: '#6aa07f',
  verifiedSoft: 'rgba(106, 160, 127, 0.18)',
  verifiedStrong: '#8cbfa1',
  community: '#6aa07f',
  communitySoft: 'rgba(106, 160, 127, 0.14)',
  urgent: '#d89c3f',
  urgentSoft: 'rgba(216, 156, 63, 0.18)',
  urgentStrong: '#e8b566',
  danger: '#b93838',
  dangerStrong: '#8f2525',
  dangerSoft: 'rgba(185, 56, 56, 0.18)',
  info: '#6a8fb3',
  infoSoft: 'rgba(106, 143, 179, 0.16)',

  focusRing: 'rgba(240, 232, 220, 0.8)',
};

// ---------------------------------------------------------------------------
// Font families — V2-E rule: Fraunces for display/h1 only, Inter elsewhere.
// React Native cannot auto-load Google webfonts; a wave-B task ships the
// actual .ttf files via expo-font. For now we use the POSTSCRIPT names that
// will resolve once the fonts are loaded; the system sans-serif fallback
// keeps the shell readable pre-font-load.
// ---------------------------------------------------------------------------

const fonts = {
  display: 'Fraunces-SemiBold',
  displayFallback: 'System',
  body: 'Inter-Regular',
  bodyMedium: 'Inter-Medium',
  bodySemibold: 'Inter-SemiBold',
  bodyFallback: 'System',
};

// ---------------------------------------------------------------------------
// Base theme (shared between light + dark; dark overrides `colors` only).
// ---------------------------------------------------------------------------

const baseTheme = {
  // Restyle requires us to EXPOSE the palette under `colors` — that's how
  // component props like `color="accent"` resolve.
  colors: lightPalette,

  // 4px base scale — mirrors --space-1..12 from globals.css, condensed to
  // the t-shirt sizes Restyle components idiomatically consume.
  spacing: {
    none: 0,
    xs: 4, // --space-1
    s: 8, // --space-2
    m: 12, // --space-3
    l: 16, // --space-4
    xl: 20, // --space-5
    xxl: 24, // --space-6
    xxxl: 32, // --space-8
    xxxxl: 40, // --space-10
    xxxxxl: 48, // --space-12
  },

  borderRadii: {
    none: 0,
    sm: 2, // --radius-sm
    md: 4, // --radius-md
    lg: 8, // --radius-lg
    xl: 12, // --radius-xl
    pill: 9999, // --radius-pill
  },

  // Breakpoints — tablet support is on (ios.supportsTablet: true); wave B
  // will add responsive variants for iPad split view. For M1 we keep a
  // single breakpoint so Restyle's ResponsiveValue<> types compile.
  breakpoints: {
    phone: 0,
    tablet: 768,
  },

  // Text variants — mirrors --type-* from globals.css. Sizes are NUMBERS
  // (React Native doesn't understand rem). Rem conversion uses 16px base:
  //   1rem  = 16
  //   1.0625rem = 17
  //   1.25rem = 20
  //   1.625rem = 26
  //   2rem  = 32
  //   2.5rem = 40
  textVariants: {
    defaults: {
      fontFamily: fonts.body,
      fontSize: 16,
      lineHeight: 26, // 1.65
      color: 'inkPrimary',
    },
    display: {
      fontFamily: fonts.display,
      fontSize: 32,
      lineHeight: 38, // 1.2
      color: 'inkPrimary',
    },
    h1: {
      fontFamily: fonts.display,
      fontSize: 28,
      lineHeight: 32, // 1.15
      color: 'inkPrimary',
    },
    h2: {
      fontFamily: fonts.display,
      fontSize: 22,
      lineHeight: 28, // 1.25
      color: 'inkPrimary',
    },
    h3: {
      // V2-E — h3 switches to Inter semibold.
      fontFamily: fonts.bodySemibold,
      fontSize: 20,
      lineHeight: 28, // 1.4
      color: 'inkPrimary',
    },
    h4: {
      fontFamily: fonts.bodySemibold,
      fontSize: 17,
      lineHeight: 24, // 1.4
      color: 'inkPrimary',
    },
    body: {
      fontFamily: fonts.body,
      fontSize: 16,
      lineHeight: 26, // 1.65
      color: 'inkPrimary',
    },
    small: {
      fontFamily: fonts.body,
      fontSize: 15,
      lineHeight: 24, // 1.6
      color: 'inkSecondary',
    },
    micro: {
      fontFamily: fonts.body,
      fontSize: 12,
      lineHeight: 17, // 1.4
      color: 'inkMuted',
    },
  },
};

export const theme = createTheme(baseTheme);

// Dark theme — only `colors` differ. Everything downstream (spacing, radii,
// text variants) is identical, so we spread the base and swap palette.
export const darkTheme: Theme = {
  ...theme,
  colors: darkPalette,
};

export type Theme = typeof theme;
