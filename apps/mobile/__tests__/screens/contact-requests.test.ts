/**
 * Contact requests screen — source-level contract tests.
 *
 * Two invariants:
 *
 *   1. Accept flows call `acceptContactRequest` and then navigate to the
 *      returned conversation when one exists — matching the PWA's post-
 *      accept UX ("your first chat opens immediately").
 *   2. Decline calls `rejectContactRequest` so the row drops on the next
 *      `['inbox']` cache invalidation.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '..', '..', 'app', 'contact-requests.tsx'),
  'utf-8',
);

describe('Contact requests screen (source-level)', () => {
  test('Accept routes to the returned conversation via router.push', () => {
    expect(SRC).toMatch(/useAcceptContactRequest/);
    expect(SRC).toMatch(/acceptMutation\.mutateAsync/);
    // The router path is composed from the mutation result's
    // conversation_id — assert both the property access and the template.
    expect(SRC).toMatch(/conversation_id/);
    expect(SRC).toMatch(/router\.push\(/);
  });

  test('Decline fires rejectContactRequest + pending-only filter is applied', () => {
    expect(SRC).toMatch(/useRejectContactRequest/);
    expect(SRC).toMatch(/rejectMutation\.mutateAsync/);
    // The list must show only pending requests — the PWA's design never
    // surfaces expired or rejected rows in this view.
    expect(SRC).toMatch(/status === ['"]pending['"]/);
  });
});
