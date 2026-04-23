/**
 * Post composer — source-level smoke tests.
 *
 * The composer is the most intricate screen in this wave (three-stage
 * flow + offline outbox fallback). A full render needs jest-expo; these
 * tests lock in the critical contracts: the atoms present, the outbox
 * fallback wired, and the testIDs downstream flows tap.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '..', '..', 'app', 'posts', 'new.tsx'),
  'utf-8',
);

describe('Post composer screen (source-level)', () => {
  test('routes publish failures to the offline outbox', () => {
    // The happy path goes through `createPost`. The failure branch must
    // call `enqueuePendingPost` — dropping that silently loses drafts
    // on the subway / elevator.
    expect(SRC).toMatch(/from '@\/lib\/api'/);
    expect(SRC).toMatch(/createPost\b/);
    expect(SRC).toMatch(/enqueuePendingPost\b/);
    // The composer must render all 6 category options (drop one and the
    // preview step silently rejects an otherwise valid draft).
    for (const cat of ['food', 'goods', 'childcare', 'translation', 'transportation', 'other']) {
      expect(SRC).toMatch(new RegExp(`'${cat}'`));
    }
  });

  test('exposes the request/offer + publish testIDs', () => {
    expect(SRC).toContain('testID="select-request"');
    expect(SRC).toContain('testID="select-offer"');
    expect(SRC).toContain('testID="publish-post"');
    expect(SRC).toContain('testID="post-composer-screen"');
  });
});
