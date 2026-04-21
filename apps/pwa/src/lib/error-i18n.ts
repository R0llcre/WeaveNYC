/**
 * Map unknown errors (from fetch, React Query, our api client, etc.) to a
 * stable i18n key so ZH/ES users never see raw English backend text.
 *
 * Prior to F4-C, ~12 screens rendered `error.message` directly into
 * <Banner> / status text. That text comes from `apps/pwa/src/lib/api.ts`
 * (`"/v1/... failed: HTTP 429 {json}"`) or native DOM strings like
 * `"Failed to fetch"` — both of which are always English. Non-English
 * pilot users ended up with a jarring mix of localized UI + untranslated
 * backend copy whenever anything went wrong.
 *
 * This module replaces that pattern with:
 *
 *   const errorKey = resolveErrorKey(err);
 *   const copy = t(errorKey);
 *
 * Callers pass an already-typed `t` from `useTranslations()` and the
 * returned key is guaranteed to exist in every locale (see
 * i18n.test.ts — key-set parity test).
 *
 * Heuristics (in priority order):
 *   1. Explicit backend `{ error: 'rate_limited' }` / `{ code: '...' }`
 *      payload — we use the business code directly.
 *   2. HTTP status from the api.ts error string (`"... HTTP 429"`) —
 *      covers 401 / 403 / 404 / 409 / 429 / 5xx.
 *   3. `TypeError` with a `fetch`-ish message — browser network failure.
 *   4. Fallback to `errorGeneric`.
 */

type ErrorKey =
  | 'errorRateLimited'
  | 'errorAuth'
  | 'errorForbidden'
  | 'errorServer'
  | 'errorNetwork'
  | 'errorGeneric'
  | 'errorValidation'
  | 'errorConflict'
  | 'errorNotFound';

/**
 * Extract a backend business-code string (e.g. `"rate_limited"`) from a raw
 * api.ts error message. The api client embeds the response body into the
 * `Error.message` via `throw new Error(\`${path} failed: HTTP ${status} ${body}\`)`,
 * so when the body is JSON like `{"error":"rate_limited"}` we can pull the
 * code with a cheap regex rather than re-parsing the whole string.
 */
function extractBusinessCode(message: string): string | null {
  // Match either `"error":"<code>"` or `"code":"<code>"` in an embedded body.
  const match = message.match(/"(?:error|code)"\s*:\s*"([a-z_][a-z0-9_]*)"/i);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Extract the HTTP status code from an api.ts error message:
 *   "/v1/foo failed: HTTP 429 { ... }" → 429
 */
function extractHttpStatus(message: string): number | null {
  const match = message.match(/HTTP\s+(\d{3})/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function isNetworkError(err: unknown): boolean {
  if (typeof TypeError !== 'undefined' && err instanceof TypeError) {
    // `fetch()` surfaces "Failed to fetch" (Chrome), "Load failed" (Safari),
    // and "NetworkError when attempting to fetch resource." (Firefox) as
    // TypeError. Any TypeError that mentions "fetch" or the common
    // Safari/FF strings is safe to treat as a network error.
    const message = err.message || '';
    if (
      /fetch/i.test(message) ||
      /network\s*error/i.test(message) ||
      /load failed/i.test(message)
    ) {
      return true;
    }
  }
  // offline event / no-connection may surface as `Error` with message
  // "Network request failed" in a few environments (e.g. native wrappers).
  if (err instanceof Error && /network request failed/i.test(err.message)) {
    return true;
  }
  return false;
}

export function resolveErrorKey(err: unknown): ErrorKey {
  if (err == null) {
    return 'errorGeneric';
  }

  // Plain object shape from the api client or a manual { error: '...' } throw.
  if (typeof err === 'object' && err !== null && !(err instanceof Error)) {
    const record = err as Record<string, unknown>;
    const code =
      typeof record.error === 'string'
        ? record.error
        : typeof record.code === 'string'
          ? record.code
          : null;
    if (code) {
      const mapped = mapBusinessCode(code.toLowerCase());
      if (mapped) return mapped;
    }
    if (typeof record.status === 'number') {
      const mapped = mapHttpStatus(record.status);
      if (mapped) return mapped;
    }
  }

  if (isNetworkError(err)) {
    return 'errorNetwork';
  }

  if (err instanceof Error) {
    const businessCode = extractBusinessCode(err.message);
    if (businessCode) {
      const mapped = mapBusinessCode(businessCode);
      if (mapped) return mapped;
    }
    const status = extractHttpStatus(err.message);
    if (status !== null) {
      const mapped = mapHttpStatus(status);
      if (mapped) return mapped;
    }
  }

  return 'errorGeneric';
}

function mapBusinessCode(code: string): ErrorKey | null {
  switch (code) {
    case 'rate_limited':
    case 'too_many_requests':
      return 'errorRateLimited';
    case 'unauthorized':
    case 'unauthenticated':
    case 'token_expired':
    case 'session_expired':
      return 'errorAuth';
    case 'forbidden':
    case 'access_denied':
      return 'errorForbidden';
    case 'not_found':
      return 'errorNotFound';
    case 'conflict':
    case 'already_exists':
    case 'duplicate':
      return 'errorConflict';
    case 'validation_error':
    case 'invalid_request':
    case 'bad_request':
      return 'errorValidation';
    case 'internal_error':
    case 'server_error':
    case 'service_unavailable':
      return 'errorServer';
    default:
      return null;
  }
}

function mapHttpStatus(status: number): ErrorKey | null {
  if (status === 401) return 'errorAuth';
  if (status === 403) return 'errorForbidden';
  if (status === 404) return 'errorNotFound';
  if (status === 409) return 'errorConflict';
  if (status === 422 || status === 400) return 'errorValidation';
  if (status === 429) return 'errorRateLimited';
  if (status >= 500 && status < 600) return 'errorServer';
  return null;
}
