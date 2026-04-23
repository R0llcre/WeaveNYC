/**
 * Settings screen — source-level tests.
 *
 * Same Node-only harness as the atom tests: no render, no i18n init, just
 * textual assertions on the source. We guard:
 *
 *   1. The six surface pieces the spec calls out (ZIP field, language
 *      radios, push toggle, low-bandwidth toggle, location precision,
 *      post visibility) all appear as testIDs. A future refactor that
 *      drops one fails here before it lands in a release build.
 *   2. Language-change dispatches both `setLanguage` (Redux) and `setLocale`
 *      (i18n runtime). Either alone would be a silent regression — the
 *      Redux state would drift from the active i18next language.
 *   3. The "Delete my data" CTA routes to `/me/danger` (not the internal
 *      3-step flow), matching the PR spec.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '..', '..', 'app', 'me', 'settings.tsx'),
  'utf-8',
);

describe('Settings screen (source-level)', () => {
  test('exposes the six preference testIDs for E2E', () => {
    for (const id of [
      'settings-zip-input',
      'settings-language-group',
      'settings-push-toggle',
      'settings-bandwidth-toggle',
      'settings-precision-group',
      'settings-visibility-group',
    ]) {
      expect(SRC).toContain(`testID="${id}"`);
    }
  });

  test('language change dispatches setLanguage AND setLocale', () => {
    // Both calls must be present — `setLanguage` updates Redux so
    // selectors see the new value; `setLocale` swaps the active i18next
    // bundle so the UI re-renders translated copy.
    expect(SRC).toMatch(/setLanguage\(/);
    expect(SRC).toMatch(/setLocale\(/);
  });

  test('delete-my-data CTA pushes to /me/danger', () => {
    expect(SRC).toMatch(/router\.push\('\/me\/danger'\)/);
  });
});
