/**
 * AppThemeProvider — Restyle ThemeProvider bound to OS colour scheme.
 * ===================================================================
 *
 * Mirrors the PWA's `@media (prefers-color-scheme: dark)` switch. When the
 * system flips to dark, RN's `useColorScheme()` emits `'dark'` and we swap
 * in `darkTheme`. Light remains the canonical brand; dark is the reader-
 * comfort accommodation.
 *
 * Placement: wrap the root layout (e.g. `app/_layout.tsx` in Expo Router)
 * so every screen downstream resolves `useAppTheme()` tokens correctly.
 *
 * Manual override (future): if we ship an in-app theme toggle, accept an
 * `override?: 'light' | 'dark' | 'system'` prop and bypass the hook. Not
 * wired yet — shipping in M7 is the token port only.
 */

import React from 'react';
import { useColorScheme } from 'react-native';
import { ThemeProvider, useTheme } from '@shopify/restyle';

import { theme, darkTheme, type Theme } from './tokens';

type AppThemeProviderProps = {
  children: React.ReactNode;
  /**
   * Manual theme override. `'system'` (default) follows `useColorScheme()`.
   * Useful for Storybook stories that pin a specific variant.
   */
  override?: 'light' | 'dark' | 'system';
};

export function AppThemeProvider({
  children,
  override = 'system',
}: AppThemeProviderProps) {
  const colorScheme = useColorScheme();

  const resolved =
    override === 'light'
      ? 'light'
      : override === 'dark'
        ? 'dark'
        : colorScheme ?? 'light';

  const activeTheme = resolved === 'dark' ? darkTheme : theme;

  return <ThemeProvider theme={activeTheme}>{children}</ThemeProvider>;
}

/**
 * Typed hook — prefer this over `useTheme` from Restyle directly so every
 * consumer gets the full Theme shape without an explicit type argument.
 *
 *   const theme = useAppTheme();
 *   const bg = theme.colors.bg; // fully typed
 */
export const useAppTheme = useTheme<Theme>;

/**
 * Re-export Theme type so callers that need the shape for prop typing can
 * import it from the provider module without reaching into ./tokens.
 */
export type { Theme };
