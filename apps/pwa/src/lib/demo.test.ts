/**
 * demo.ts coverage — verifies the sandbox-mode activation gate, with
 * particular focus on the production-origin kill-switch that prevents
 * weavenyc.org from ever rendering the sandbox banner.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { isDemoSandbox } from './demo';

const originalEnv = process.env.NEXT_PUBLIC_DEMO_SANDBOX;

afterEach(() => {
  if (originalEnv === undefined) {
    delete process.env.NEXT_PUBLIC_DEMO_SANDBOX;
  } else {
    process.env.NEXT_PUBLIC_DEMO_SANDBOX = originalEnv;
  }
});

describe('isDemoSandbox', () => {
  it('returns false by default (no env, no URL param)', () => {
    expect(
      isDemoSandbox({ hostname: 'localhost', search: '', env: undefined })
    ).toBe(false);
  });

  it('returns true when env flag is set on localhost', () => {
    expect(
      isDemoSandbox({ hostname: 'localhost', search: '', env: '1' })
    ).toBe(true);
  });

  it('returns true when ?demo=1 is present on localhost', () => {
    expect(
      isDemoSandbox({ hostname: 'localhost', search: '?demo=1', env: undefined })
    ).toBe(true);
  });

  it('returns true on preview host with env flag', () => {
    expect(
      isDemoSandbox({
        hostname: 'feature-branch.pages.dev',
        search: '',
        env: '1'
      })
    ).toBe(true);
  });

  it('returns false on production weavenyc.org even with ?demo=1 + env flag', () => {
    // This is the critical safety case: the production origin must never
    // activate sandbox mode. An attacker who tricks a user into following
    // `https://weavenyc.org/?demo=1` must not see the banner.
    expect(
      isDemoSandbox({ hostname: 'weavenyc.org', search: '?demo=1', env: '1' })
    ).toBe(false);
  });

  it('returns false on www.weavenyc.org too', () => {
    expect(
      isDemoSandbox({
        hostname: 'www.weavenyc.org',
        search: '?demo=1',
        env: '1'
      })
    ).toBe(false);
  });

  it('reads from process.env by default when env opt is omitted', () => {
    process.env.NEXT_PUBLIC_DEMO_SANDBOX = '1';
    expect(isDemoSandbox({ hostname: 'localhost', search: '' })).toBe(true);
  });
});
