/**
 * Privacy screen — source-level tests.
 *
 * This screen is intentionally minimal (per the PWA twin) — a title + a
 * single lede paragraph. We guard the two things that can silently
 * regress:
 *
 *   1. The `privacy:privacyLede` key is read via `useTranslation` so the
 *      copy stays localised. A refactor that inlined an English string
 *      would skip the ZH / ES bundles.
 *   2. The `PageHeader` uses `onBack` wired to `router.back()` so the
 *      native back-gesture, hardware-back button, and header tap all pop
 *      the same way.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '..', '..', 'app', 'privacy.tsx'),
  'utf-8',
);

describe('Privacy screen (source-level)', () => {
  test('reads the localised lede + eyebrow copy via i18n', () => {
    expect(SRC).toMatch(/privacy:privacyLede/);
    expect(SRC).toMatch(/privacy:privacyEyebrow/);
    expect(SRC).toMatch(/privacy:privacyTitle/);
  });

  test('PageHeader owns the back affordance via router.back', () => {
    expect(SRC).toMatch(/PageHeader\b/);
    expect(SRC).toMatch(/router\.back\(\)/);
  });
});
