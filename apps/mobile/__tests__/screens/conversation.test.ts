/**
 * Conversation thread — source-level contract tests.
 *
 * Guards the three invariants that a lossy refactor would silently break:
 *
 *   1. The message list is an `inverted` FlatList so newest-at-bottom
 *      behaviour is preserved even when the caller stops passing messages
 *      in the "newest-first" order the server currently returns.
 *   2. The chat WebSocket is bounced on AppState change so a backgrounded
 *      → foregrounded transition re-establishes the socket (and, via the
 *      hook's onReconnect callback, refetches missed messages).
 *   3. Blocking safety flags hide the message body behind a "Show anyway"
 *      disclosure — matches the PWA V1-C safety_flags UI.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(
    __dirname,
    '..',
    '..',
    'app',
    'conversations',
    '[conversationId].tsx',
  ),
  'utf-8',
);

describe('Conversation thread screen (source-level)', () => {
  test('uses an inverted FlatList + wires WebSocket reconnect to AppState', () => {
    // `inverted` is the S4-contracted orientation (newest-at-bottom).
    expect(SRC).toMatch(/inverted/);
    // useChatWebSocket must still be the reconnect source of truth.
    expect(SRC).toMatch(/useChatWebSocket\(/);
    // AppState.addEventListener('change', …) is the RN bridge the spec
    // pins for the reconnect-on-foreground behaviour.
    expect(SRC).toMatch(/AppState\.addEventListener\(\s*['"]change['"]/);
  });

  test('safety flags gate body reveal via Show-anyway disclosure + Block routes back', () => {
    // Blocking flags are the hate_speech / harassment set — they must
    // hide the body until the user reveals it.
    expect(SRC).toMatch(/chatSafetyHidden/);
    expect(SRC).toMatch(/chatSafetyShowAnyway/);
    // The block button fires `blockUser` + pops back to the inbox.
    expect(SRC).toMatch(/blockUserMutation\.mutateAsync/);
    expect(SRC).toMatch(/router\.back\(\)/);
  });
});
