/**
 * Card atom — unit tests.
 *
 * Scope
 * -----
 * Same harness constraints as `Button.test.tsx`: jest runs in a Node
 * environment with a minimal `react-native` stub, and the theme barrel
 * transitively imports `expo-font` (ESM that ts-jest can't transform in
 * this wave). So these cases verify what's cheap to check without
 * touching the component tree:
 *
 *   1. The source exports `Card`, `CardProps`, `CardVariant`, and
 *      `CardPadding` — the four names the barrel re-exports.
 *   2. The variant union stays at `flat | elevated` — a silent widening
 *      (accent, tonal, raised) would bypass switch-exhaustiveness in
 *      screens that branch on variant.
 *   3. The padding vocabulary keeps the `'none'` escape. Bleed-to-edge
 *      layouts (map previews, hero imagery) rely on it to kill the
 *      default `theme.spacing.m` padding; if a refactor drops the
 *      sentinel those layouts gain unwanted padding silently.
 *
 * TODO(mobile/r2): once the M3b RN stub gains a real `View` host
 * component and the expo-font jest transform lands, replace with a
 * render-based spec that asserts:
 *
 *   - `elevated` spreads `theme.boxShadows.sm` onto the style array.
 *   - `padding="none"` → resolved `style.padding === 0`.
 *   - Children render inside the container.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CARD_SRC = readFileSync(
  resolve(__dirname, 'Card.tsx'),
  'utf-8',
);

describe('Card atom (source-level)', () => {
  test('source file exports a named `Card` function + the documented type aliases', () => {
    expect(CARD_SRC).toMatch(/export function Card\b/);
    expect(CARD_SRC).toMatch(/export type CardVariant\b/);
    expect(CARD_SRC).toMatch(/export type CardPadding\b/);
    expect(CARD_SRC).toMatch(/export interface CardProps\b/);
  });

  test('variant union stays at `flat | elevated`', () => {
    // Pin the exhaustive set so a widening forces every consumer
    // switch-on-variant to be reviewed.
    expect(CARD_SRC).toMatch(
      /type CardVariant\s*=\s*'flat'\s*\|\s*'elevated'/,
    );
  });

  test('padding vocabulary covers the expected spacing tokens + the `none` escape', () => {
    // The `'none'` sentinel is load-bearing — bleed-to-edge layouts
    // (map previews, hero imagery) rely on it to zero out the default
    // `theme.spacing.m` padding. Asserting its presence here guards
    // against a refactor that re-derives the token list from
    // `theme.spacing` (which doesn't have `'none'`) and silently
    // drops the escape hatch.
    expect(CARD_SRC).toMatch(
      /type CardPadding\s*=\s*'none'\s*\|\s*'xs'\s*\|\s*'s'\s*\|\s*'sm'\s*\|\s*'m'\s*\|\s*'l'/,
    );
  });
});
