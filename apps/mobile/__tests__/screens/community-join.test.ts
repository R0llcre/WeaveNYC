/**
 * Community join screen — source-level smoke tests.
 *
 * Two intents matter to downstream flows: the invite-code resolve and
 * the QR camera primer. Both routes converge on the same
 * `useCommunityAccessResolve → useJoinCommunity` mutation pair, so
 * verifying their imports + testIDs is enough to keep the wiring honest
 * without a full RNTL render.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '..', '..', 'app', 'community', 'join.tsx'),
  'utf-8',
);

describe('Community join screen (source-level)', () => {
  test('wires the resolve + join mutations and the QR helper', () => {
    expect(SRC).toMatch(/useCommunityAccessResolve\b/);
    expect(SRC).toMatch(/useJoinCommunity\b/);
    // `parseScannedQrPayload` is the sole shared QR helper — the camera
    // callback must feed its scanned raw string through it so the
    // invite_code / qr_token discriminator matches the PWA.
    expect(SRC).toMatch(/parseScannedQrPayload\b/);
    // expo-camera is the native primitive; dropping it means QR mode
    // silently no-ops.
    expect(SRC).toMatch(/from 'expo-camera'/);
  });

  test('exposes mode + confirm testIDs that E2E hangs off', () => {
    expect(SRC).toContain('testID="join-mode-invite"');
    expect(SRC).toContain('testID="join-mode-qr"');
    expect(SRC).toContain('testID="resolve-community"');
    expect(SRC).toContain('testID="confirm-join"');
  });
});
