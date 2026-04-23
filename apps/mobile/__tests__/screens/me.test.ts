/**
 * Me tab — source-level tests.
 *
 * Same harness constraints as the atom-level tests: jest runs in Node with
 * a minimal `react-native` stub, so a full render isn't possible in this
 * wave. These cases therefore verify what *can* be checked cheaply today:
 *
 *   1. The screen wires the six `@/components/ui` atoms we want rendered
 *      on the hub (Card, Button, Icon, Inline, Stack, Tag, PageHeader).
 *      A silent regression that drops one surfaces here.
 *   2. The `testID` hooks used by downstream E2E (Maestro) are present —
 *      in particular, the level pill and the danger-zone CTA. Dropping
 *      either would break the recorded smoke flow.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '..', '..', 'app', '(tabs)', 'me.tsx'),
  'utf-8',
);

describe('Me tab (source-level)', () => {
  test('imports the atoms used by the hub layout', () => {
    expect(SRC).toMatch(/from '@\/components\/ui'/);
    // Spot-check the atoms the port touches. The import is destructured,
    // so a single regex covering the full list would be brittle across
    // formatter changes — check a representative subset instead.
    for (const atom of ['Button', 'Card', 'Icon', 'Inline', 'Stack', 'Tag', 'PageHeader']) {
      expect(SRC).toMatch(new RegExp(`\\b${atom}\\b`));
    }
  });

  test('exposes the level pill + danger CTA testIDs for E2E', () => {
    expect(SRC).toContain('testID="me-level-pill"');
    expect(SRC).toContain('testID="me-danger-cta"');
  });

  test('navigates to /me/danger and /privacy via router.push', () => {
    // Both destinations MUST come from Expo Router (not a stringly-typed
    // href), otherwise deep-linking + back-gesture behaviour diverges.
    expect(SRC).toMatch(/router\.push\('\/me\/danger'\)/);
    expect(SRC).toMatch(/router\.push\('\/privacy'\)/);
  });
});
