/**
 * Font loader — RN equivalent of `next/font` from the PWA.
 * ========================================================
 *
 * The PWA self-hosts Fraunces + Inter via `next/font`. RN has no equivalent
 * so we use `expo-font` to register the same families under the *exact*
 * names that `./tokens.ts` `textVariants` reference (`Fraunces`, `Inter`,
 * `Inter-Medium`, `Inter-SemiBold`, `Inter-Bold`).
 *
 * Call `loadAppFonts()` once at app boot (root layout, before first render).
 * Returns a promise resolving when all fonts are registered. Wrap the app
 * shell in a SplashScreen or loading sentinel until the promise resolves;
 * otherwise the first paint will flash system fonts (Flash of Unstyled Text).
 *
 * Asset placement
 * ---------------
 * Fonts live under `apps/mobile/assets/fonts/`. The sources we target are
 * Google Fonts' OFL-licensed originals:
 *
 *   Fraunces-Variable.ttf       (variable axis, covers 300-900 weights)
 *   Inter-Regular.ttf           (400)
 *   Inter-Medium.ttf            (500)
 *   Inter-SemiBold.ttf          (600)
 *   Inter-Bold.ttf              (700)
 *
 * Chinese glyph coverage (Noto Sans/Serif SC) is *not* bundled in this port
 * — see `TOKENS.md` § Unported for the rationale. The system falls back to
 * iOS's "PingFang SC" / Android's "Noto Sans CJK SC" which are pre-installed
 * on the OS and render the same glyphs at slightly different weights. The
 * PWA's chain listed Noto Sans SC first for pixel parity, but bundling it
 * costs ~1.3MB per weight and blows our install-size budget.
 *
 * Sourcing
 * --------
 * Fonts are vendored (committed to the repo) rather than downloaded at
 * build time because Expo bundles assets via `expo-asset` and we want
 * deterministic, offline-capable builds. Licence: SIL Open Font Licence
 * v1.1 — included in `apps/mobile/assets/fonts/LICENSE.txt` (to be added
 * by whoever actually drops the ttf files; the M7 PR ships only the loader
 * wiring, not the binary assets, to keep PR size sane).
 *
 * Stub note
 * ---------
 * The `require('../../assets/fonts/...')` calls below fail at bundle time
 * if the ttf files aren't present. A parallel M1/M5 agent (or a follow-up
 * PR) will add the actual assets + update `app.json` `expo.assetBundle`.
 * For the theme PR, the function signature and the font-name keys are the
 * contract — consumers depend on those, not the binaries.
 */

import * as Font from 'expo-font';

/**
 * Font-key → asset-module map. Keys MUST match the `fontFamily` strings
 * used in `./tokens.ts` `textVariants` and `fontFamilies`.
 */
const FONT_ASSETS = {
  // Display — Fraunces (variable font). iOS renders variable axis
  // correctly; Android 9+ also supports it. We request 'Fraunces' as the
  // single family so `fontWeight` resolution at the RN side picks the right
  // weight along the axis.
  Fraunces: require('../../assets/fonts/Fraunces-Variable.ttf'),
  'Fraunces-Variable': require('../../assets/fonts/Fraunces-Variable.ttf'),

  // Body — Inter, one file per weight. We deliberately ship 4 static files
  // (not a variable Inter) because Android's variable-font support for
  // weights < 9 is inconsistent. Static weights render crisply everywhere.
  Inter: require('../../assets/fonts/Inter-Regular.ttf'),
  'Inter-Medium': require('../../assets/fonts/Inter-Medium.ttf'),
  'Inter-SemiBold': require('../../assets/fonts/Inter-SemiBold.ttf'),
  'Inter-Bold': require('../../assets/fonts/Inter-Bold.ttf'),

  // Mono — IBM Plex Mono is optional (no variants ship in M7). If not
  // present, consumers of the mono variant fall back to OS mono (iOS Menlo,
  // Android DroidSansMono). Leaving the key commented out signals intent
  // without failing the bundle.
  // IBMPlexMono: require('../../assets/fonts/IBMPlexMono-Regular.ttf'),
} as const;

/**
 * Load every app font via expo-font. Idempotent — `expo-font` caches by
 * key. Safe to call multiple times; subsequent calls are no-ops.
 */
export async function loadAppFonts(): Promise<void> {
  await Font.loadAsync(FONT_ASSETS as Record<string, Font.FontSource>);
}

/**
 * Diagnostic: returns the keys that were attempted. Useful in
 * tests / Storybook to assert that tokens.ts and fonts.ts stay in sync.
 */
export function listAppFontKeys(): ReadonlyArray<string> {
  return Object.keys(FONT_ASSETS);
}
