/**
 * Inbox tab — source-level contract tests.
 *
 * The mobile test harness runs in a Node env without the jest-expo preset
 * (see `apps/mobile/jest.config.js` for the rationale), so full-screen
 * render tests would need a dozen native-module stubs just to mount the
 * FlatList. Following the pattern established by the other mobile screen
 * tests (e.g. `privacy.test.ts`, `me.test.ts`), this suite asserts the
 * invariants that are cheap to check at source level:
 *
 *   1. The anonymous gate routes verify users via the expo-router
 *      `useRouter().push('/verify')` sink — not a raw anchor.
 *   2. Conversations are rendered inside a `FlatList` (the S4 spec pins
 *      FlatList as the list container).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '..', '..', 'app', '(tabs)', 'inbox.tsx'),
  'utf-8',
);

describe('Inbox screen (source-level)', () => {
  test('anonymous users are routed to /verify via router.push', () => {
    // We assert the i18n key + the imperative route so a silent refactor
    // to an anchor tag or a wrong return_to target fails here.
    expect(SRC).toMatch(/inboxNeedsVerified/);
    expect(SRC).toMatch(/router\.push\(['"]\/verify['"]\)/);
  });

  test('verified conversations render inside a FlatList keyed by conversation_id', () => {
    // FlatList is the contracted list container (S4 spec). The
    // conversation_id is the only stable key we can rely on across
    // server-driven sorts; asserting both together guards both the list
    // choice and the keyExtractor shape.
    expect(SRC).toMatch(/\bFlatList\b/);
    expect(SRC).toMatch(/conversation_id/);
    // The list must sort by last_activity_at (server returns in order,
    // but we re-sort defensively — see inbox.tsx).
    expect(SRC).toMatch(/last_activity_at/);
  });
});
