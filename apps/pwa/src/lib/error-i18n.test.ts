import { describe, expect, it } from 'vitest';

import { resolveErrorKey } from './error-i18n';
import { messages, supportedLanguages } from './i18n';

describe('resolveErrorKey', () => {
  // Table-driven — each row asserts that a particular error shape the PWA
  // actually produces in the wild collapses to the expected i18n key.
  const cases: Array<{ label: string; input: unknown; expected: string }> = [
    // ---- api.ts error strings (see apps/pwa/src/lib/api.ts#requestJson) ----
    {
      label: 'HTTP 429 rate limit from api.ts throw',
      input: new Error('/v1/auth/otp/start failed: HTTP 429 {"error":"rate_limited"}'),
      expected: 'errorRateLimited',
    },
    {
      label: 'HTTP 401 unauth from api.ts throw (no body)',
      input: new Error('/v1/me/verify failed: HTTP 401'),
      expected: 'errorAuth',
    },
    {
      label: 'HTTP 403 forbidden',
      input: new Error('/v1/conversations/abc failed: HTTP 403 {"error":"forbidden"}'),
      expected: 'errorForbidden',
    },
    {
      label: 'HTTP 404 not-found',
      input: new Error('/v1/posts/missing failed: HTTP 404'),
      expected: 'errorNotFound',
    },
    {
      label: 'HTTP 409 conflict (idempotency)',
      input: new Error('/v1/posts failed: HTTP 409 {"error":"conflict"}'),
      expected: 'errorConflict',
    },
    {
      label: 'HTTP 422 validation',
      input: new Error('/v1/posts failed: HTTP 422 {"error":"validation_error"}'),
      expected: 'errorValidation',
    },
    {
      label: 'HTTP 400 (treated as validation)',
      input: new Error('/v1/posts failed: HTTP 400 {"error":"bad_request"}'),
      expected: 'errorValidation',
    },
    {
      label: 'HTTP 500 server error',
      input: new Error('/v1/resources failed: HTTP 500 {"error":"internal_error"}'),
      expected: 'errorServer',
    },
    {
      label: 'HTTP 503 unavailable',
      input: new Error('/v1/resources failed: HTTP 503'),
      expected: 'errorServer',
    },

    // ---- Network-level failures ----
    {
      label: 'Chrome TypeError "Failed to fetch"',
      input: new TypeError('Failed to fetch'),
      expected: 'errorNetwork',
    },
    {
      label: 'Firefox "NetworkError when attempting to fetch resource."',
      input: new TypeError('NetworkError when attempting to fetch resource.'),
      expected: 'errorNetwork',
    },
    {
      label: 'Safari "Load failed"',
      input: new TypeError('Load failed'),
      expected: 'errorNetwork',
    },

    // ---- Backend payloads (object shape) ----
    {
      label: 'plain-object { error: "rate_limited" }',
      input: { error: 'rate_limited' },
      expected: 'errorRateLimited',
    },
    {
      label: 'plain-object { code: "session_expired" } → auth',
      input: { code: 'session_expired' },
      expected: 'errorAuth',
    },
    {
      label: 'plain-object { status: 404 }',
      input: { status: 404 },
      expected: 'errorNotFound',
    },

    // ---- Business-code extraction precedence ----
    // When a message embeds BOTH a status and an explicit business code,
    // the business code should win (more specific).
    {
      label: 'embedded business code beats status code',
      input: new Error('/v1/x failed: HTTP 500 {"error":"rate_limited"}'),
      expected: 'errorRateLimited',
    },

    // ---- Fallback ----
    {
      label: 'unknown thrown string → generic',
      input: 'something weird happened',
      expected: 'errorGeneric',
    },
    {
      label: 'null → generic',
      input: null,
      expected: 'errorGeneric',
    },
    {
      label: 'Error with no status/body → generic',
      input: new Error('Something went wrong'),
      expected: 'errorGeneric',
    },
  ];

  for (const c of cases) {
    it(c.label, () => {
      expect(resolveErrorKey(c.input)).toBe(c.expected);
    });
  }

  it('every resolved key is defined in all supported languages', () => {
    const uniqueKeys = new Set(cases.map((c) => c.expected));
    // Sanity: the test suite must cover every possible returned key at
    // least once, or we risk i18n.ts drifting from this helper.
    expect(Array.from(uniqueKeys).sort()).toEqual(
      [
        'errorAuth',
        'errorConflict',
        'errorForbidden',
        'errorGeneric',
        'errorNetwork',
        'errorNotFound',
        'errorRateLimited',
        'errorServer',
        'errorValidation',
      ].sort(),
    );

    // Every language must contain every key with a non-empty string.
    for (const lang of supportedLanguages) {
      const bundle = messages[lang] as Record<string, string>;
      for (const key of uniqueKeys) {
        expect(typeof bundle[key], `${lang}.${key}`).toBe('string');
        expect(bundle[key].length, `${lang}.${key} non-empty`).toBeGreaterThan(0);
      }
    }
  });
});
