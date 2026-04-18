import { describe, expect, it } from 'vitest';

import { safeReturnTo } from './safe-return-to';

describe('safeReturnTo', () => {
  const fallback = '/onboarding/location';

  it('falls back when raw is null/undefined/empty', () => {
    expect(safeReturnTo(null, fallback)).toBe(fallback);
    expect(safeReturnTo(undefined, fallback)).toBe(fallback);
    expect(safeReturnTo('', fallback)).toBe(fallback);
  });

  it('accepts same-origin absolute paths', () => {
    expect(safeReturnTo('/', fallback)).toBe('/');
    expect(safeReturnTo('/inbox', fallback)).toBe('/inbox');
    expect(safeReturnTo('/posts/abc', fallback)).toBe('/posts/abc');
    expect(safeReturnTo('/posts/abc?x=1', fallback)).toBe('/posts/abc?x=1');
    expect(safeReturnTo('/posts/abc#frag', fallback)).toBe('/posts/abc#frag');
  });

  it('rejects full URLs (http, https, mailto)', () => {
    expect(safeReturnTo('https://attacker.com', fallback)).toBe(fallback);
    expect(safeReturnTo('http://attacker.com/path', fallback)).toBe(fallback);
    expect(safeReturnTo('mailto:attacker@example.com', fallback)).toBe(fallback);
    expect(safeReturnTo('javascript:alert(1)', fallback)).toBe(fallback);
  });

  it('rejects protocol-relative URLs', () => {
    expect(safeReturnTo('//attacker.com/path', fallback)).toBe(fallback);
    expect(safeReturnTo('//attacker.com', fallback)).toBe(fallback);
  });

  it('rejects path-traversal fragments', () => {
    expect(safeReturnTo('/inbox/../../../../etc/passwd', fallback)).toBe(fallback);
    expect(safeReturnTo('/..', fallback)).toBe(fallback);
    expect(safeReturnTo('/posts/../admin', fallback)).toBe(fallback);
  });

  it('rejects paths that do not start with a slash', () => {
    expect(safeReturnTo('inbox', fallback)).toBe(fallback);
    expect(safeReturnTo('attacker.com', fallback)).toBe(fallback);
  });
});
