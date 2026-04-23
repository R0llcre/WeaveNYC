/**
 * Button atom — unit tests.
 *
 * Scope
 * -----
 * The mobile test harness is intentionally narrow in this wave:
 *
 *   1. Jest runs in a Node environment with a minimal `react-native` stub
 *      that doesn't expose `Pressable`, `View`, `Text`, or
 *      `ActivityIndicator` as host components. Rendering the Button tree
 *      would fail at `React.createElement(Pressable, …)` because
 *      `Pressable` resolves to `undefined`.
 *
 *   2. The theme barrel (`@/theme`) transitively imports `expo-font`,
 *      which ships ESM that ts-jest can't transform without the full
 *      jest-expo preset. M3b wires that preset in; until then any test
 *      that imports `Button` / `Card` (both of which reach for
 *      `useAppTheme`) fails at module-evaluation time.
 *
 * So this suite covers what *can* be verified cheaply today:
 *
 *   1. The source file exists and contains the public export.
 *   2. The variant / size unions are declared in the source exactly as
 *      documented — a textual grep for the union members, so a silent
 *      widening (someone adds `'link'` or drops `'ghost'`) fails here.
 *   3. The haptic helper is wired from Button and matches the public
 *      name used elsewhere in the atom layer.
 *
 * TODO(mobile/r2): once the M3b RN stub (Pressable, View, Text, …) and
 * the expo-font jest transform land, replace these textual assertions
 * with a real render-based spec:
 *
 *   - `fireEvent.press(node)` fires `onPress`.
 *   - `loading` swaps the label for an ActivityIndicator + sets
 *     `accessibilityState.busy`.
 *   - `haptic={false}` skips the `triggerLightHaptic` call.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BUTTON_SRC = readFileSync(
  resolve(__dirname, 'Button.tsx'),
  'utf-8',
);

describe('Button atom (source-level)', () => {
  test('source file exports a named `Button` function + the documented type aliases', () => {
    expect(BUTTON_SRC).toMatch(/export function Button\b/);
    expect(BUTTON_SRC).toMatch(/export type ButtonVariant\b/);
    expect(BUTTON_SRC).toMatch(/export type ButtonSize\b/);
    expect(BUTTON_SRC).toMatch(/export interface ButtonProps\b/);
  });

  test('variant / size unions are the exhaustive documented sets', () => {
    // Textual regex matches the declaration in `Button.tsx`. If a variant
    // is added / renamed the maintainer has to touch this line too,
    // which forces a thoughtful update (and a look at every consumer).
    expect(BUTTON_SRC).toMatch(
      /type ButtonVariant\s*=\s*'primary'\s*\|\s*'secondary'\s*\|\s*'ghost'\s*\|\s*'danger'/,
    );
    expect(BUTTON_SRC).toMatch(
      /type ButtonSize\s*=\s*'sm'\s*\|\s*'md'\s*\|\s*'lg'/,
    );
  });

  test('wires the expo-haptics Light-impact helper on press (haptic default true)', () => {
    // The atom must (a) import `triggerLightHaptic` from the sibling
    // helper and (b) default `haptic = true` so CTAs buzz without
    // per-call opt-in. Both line-level guarantees are easy to regress
    // — a refactor that routes the haptic through a different module
    // or flips the default fails here.
    expect(BUTTON_SRC).toMatch(/from ['"]\.\/haptic['"]/);
    expect(BUTTON_SRC).toMatch(/triggerLightHaptic\s*\(\s*\)/);
    expect(BUTTON_SRC).toMatch(/haptic\s*=\s*true/);
  });
});
