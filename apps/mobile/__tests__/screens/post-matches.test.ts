/**
 * Match results — source-level smoke tests.
 *
 * The matches screen is the other half of the post-contact flow. The
 * match list drives off `useMatchSuggestions` (query) +
 * `useCreateMatchContact` (mutation); a silent drop of either would ship
 * a list that renders but can't actually contact anyone.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '..', '..', 'app', 'posts', '[postId]', 'matches.tsx'),
  'utf-8',
);

describe('Post matches screen (source-level)', () => {
  test('wires the query, refresh, and contact mutations', () => {
    expect(SRC).toMatch(/useMatchSuggestions\b/);
    expect(SRC).toMatch(/useRefreshMatchSuggestions\b/);
    expect(SRC).toMatch(/useCreateMatchContact\b/);
    // Uses FlatList for the match list — the PWA's `.map(…)` render
    // swap hurts perf on a 20-match scroll, so this pins the primitive.
    expect(SRC).toMatch(/FlatList/);
  });

  test('exposes refresh + contact testIDs per match row', () => {
    expect(SRC).toContain('testID="refresh-matches"');
    expect(SRC).toContain('testID="match-list"');
    // Per-row contact button uses the suggestion_id as a suffix; pin the
    // template so a future refactor can't silently rename it.
    expect(SRC).toMatch(/testID=\{`contact-\$\{item\.suggestion_id\}`\}/);
  });
});
