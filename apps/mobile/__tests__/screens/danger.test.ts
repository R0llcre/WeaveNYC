/**
 * Danger screen — source-level tests.
 *
 * The 3-step delete flow is a destructive surface; the most useful thing a
 * Node-only test can guard is that the wiring contract matches the spec.
 * Concretely:
 *
 *   1. All three steps (confirm → otp → done) are present as testIDs. If
 *      a refactor collapses one into another the spec's 30-day undo notice
 *      stops rendering, which is a silent downgrade.
 *   2. Both API calls — `requestAccountDeletion` (step 1) and
 *      `confirmAccountDeletion` (step 2) — are wired through `@/lib/api`.
 *      A port that accidentally routed the OTP submit through `deleteAccount`
 *      would skip the "last anchor" safeguard on the server.
 *   3. The HTTP-status → i18n-key mapping covers the four cases the PWA
 *      maps (401, 400, 429, 409 / last_anchor). A subset regress would
 *      leave users with the generic error instead of the specific copy.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '..', '..', 'app', 'me', 'danger.tsx'),
  'utf-8',
);

describe('Danger screen (source-level)', () => {
  test('all three flow steps are present as testIDs', () => {
    expect(SRC).toContain('testID="danger-step-confirm"');
    expect(SRC).toContain('testID="danger-step-otp"');
    expect(SRC).toContain('testID="danger-step-done"');
  });

  test('wires requestAccountDeletion + confirmAccountDeletion from api.ts', () => {
    // The two-call flow is load-bearing: step 1 asks the server for an OTP
    // challenge; step 2 verifies it and triggers the soft-delete. Swapping
    // either for the legacy `deleteAccount` would skip the safeguards.
    expect(SRC).toMatch(/import[^;]+requestAccountDeletion[^;]+from '@\/lib\/api'/s);
    expect(SRC).toMatch(/import[^;]+confirmAccountDeletion[^;]+from '@\/lib\/api'/s);
    expect(SRC).toMatch(/requestAccountDeletion\(/);
    expect(SRC).toMatch(/confirmAccountDeletion\(/);
  });

  test('maps the four documented HTTP failure modes to dedicated i18n keys', () => {
    expect(SRC).toMatch(/HTTP 401/);
    expect(SRC).toMatch(/HTTP 400/);
    expect(SRC).toMatch(/HTTP 429/);
    expect(SRC).toMatch(/last_anchor_blocks_delete|HTTP 409/);
    // And the keys themselves — a refactor that kept the regex but dropped
    // the return values would be a silent downgrade to the generic error.
    for (const key of [
      'deleteAuthError',
      'deleteOtpInvalid',
      'deleteRateLimitError',
      'deleteLastAnchorError',
    ]) {
      expect(SRC).toContain(key);
    }
  });
});
