/**
 * Post detail — source-level smoke tests.
 *
 * The detail screen branches on `post.is_owner`. Both branches need
 * entry points to the matchmaker (the owner to triage responses, the
 * non-owner to offer contact), so both routes must exist.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '..', '..', 'app', 'posts', '[postId].tsx'),
  'utf-8',
);

describe('Post detail screen (source-level)', () => {
  test('wires the post query + close/delete mutations', () => {
    expect(SRC).toMatch(/usePost\b/);
    expect(SRC).toMatch(/useClosePost\b/);
    expect(SRC).toMatch(/useDeletePost\b/);
    // Both action paths must navigate to the matches route — the owner's
    // "See matches" and the non-owner's "Contact" both link into the
    // matchmaker (which handles the contact-request creation flow).
    expect(SRC).toMatch(/\/posts\/\$\{post\.post_id\}\/matches/);
  });

  test('exposes owner + non-owner action testIDs', () => {
    expect(SRC).toContain('testID="see-matches"');
    expect(SRC).toContain('testID="close-post"');
    expect(SRC).toContain('testID="delete-post"');
    expect(SRC).toContain('testID="contact-owner"');
  });
});
