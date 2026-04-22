/**
 * Theme barrel — public surface for the mobile theme module.
 * ==========================================================
 *
 * Consumers:
 *
 *   import { AppThemeProvider, useAppTheme, loadAppFonts } from '~/theme';
 *
 * Do NOT import from `./tokens` directly in atoms / screens — prefer the
 * hook so values stay reactive to dark-mode flips. `theme` / `darkTheme`
 * are exported only for Storybook stories, screenshot tests, and design
 * tooling that needs the raw token payload.
 */

export { theme, darkTheme, palette } from './tokens';
export type { Theme } from './tokens';

export { AppThemeProvider, useAppTheme } from './provider';

export { loadAppFonts, listAppFontKeys } from './fonts';
