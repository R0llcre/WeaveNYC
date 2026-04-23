/**
 * Community tab — source-level smoke tests.
 *
 * Node-env jest with the minimal RN stub can't render the expo-router
 * subtree; these checks confirm the atom wiring + key testIDs the
 * downstream Maestro flow (`community-join`, `new-post-cta`) depends
 * on are present. A later wave swaps to a real RNTL render.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '..', '..', 'app', '(tabs)', 'community.tsx'),
  'utf-8',
);

describe('Community tab (source-level)', () => {
  test('imports the atoms + hooks the screen needs', () => {
    expect(SRC).toMatch(/from '@\/components\/ui'/);
    expect(SRC).toMatch(/from '@\/lib\/hooks'/);
    // The screen must wire both the joined-feed query AND the
    // announcements query — a silent drop would ship a broken
    // membership branch.
    expect(SRC).toMatch(/usePosts\b/);
    expect(SRC).toMatch(/useCommunityAnnouncements\b/);
    expect(SRC).toMatch(/SEED_PUBLIC_POSTS\b/);
  });

  test('exposes the join + new-post testIDs for E2E', () => {
    // `join-community` is the button the first-run flow taps; a rename
    // breaks the recorded community-join smoke test.
    expect(SRC).toContain('testID="join-community"');
    expect(SRC).toContain('testID="new-post-cta"');
    expect(SRC).toContain('testID="community-screen"');
  });
});
