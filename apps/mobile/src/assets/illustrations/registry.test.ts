/**
 * Illustration registry parity test.
 *
 * The mobile registry mirrors the PWA registry byte-for-byte today.
 * This test pins the set of keys so a PR that adds an illustration on
 * one side but forgets the other cannot slip through review.
 */

import { illustrations, illustrationNames } from './index';

const EXPECTED_KEYS = [
  'inbox-empty',
  'posts-empty',
  'matches-empty',
  'search-empty',
  'error',
  'weave-hero',
] as const;

describe('illustrations registry', () => {
  it('exposes the 6 documented illustrations', () => {
    expect(Object.keys(illustrations).sort()).toEqual(
      [...EXPECTED_KEYS].sort(),
    );
  });

  it('exposes a matching illustrationNames array', () => {
    expect([...illustrationNames].sort()).toEqual([...EXPECTED_KEYS].sort());
  });

  it('every entry is non-empty SVG markup', () => {
    for (const key of illustrationNames) {
      const raw = illustrations[key];
      expect(typeof raw).toBe('string');
      expect(raw.startsWith('<svg')).toBe(true);
      expect(raw.endsWith('</svg>')).toBe(true);
    }
  });
});
