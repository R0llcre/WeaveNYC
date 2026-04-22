/**
 * Restyle theme entry point.
 *
 * `useAppTheme()` reads the OS-level colour scheme via React Native's
 * `useColorScheme()` hook and returns the matching theme variant. Consumers
 * should use this hook rather than importing `theme`/`darkTheme` directly so
 * that a single source decides "light vs dark" (matching the PWA's
 * `prefers-color-scheme` media-query behavior).
 *
 * `useTheme()` (from @shopify/restyle) is the hook that restyle-built
 * components (Box, Text) use internally — we re-export it verbatim so
 * downstream files don't need to import from two packages.
 */

import { useTheme } from '@shopify/restyle';
import { useColorScheme } from 'react-native';

import { darkTheme, theme } from './tokens';
import type { Theme } from './tokens';

export { theme, darkTheme };
export type { Theme };
export { useTheme };

export function useAppTheme(): Theme {
  const colorScheme = useColorScheme();
  return colorScheme === 'dark' ? darkTheme : theme;
}
