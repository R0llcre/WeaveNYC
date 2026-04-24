/**
 * Map unknown errors (from fetch, React Query, our api client, etc.) to a
 * stable i18n key so ZH/ES users never see raw English backend text.
 *
 * Ported verbatim from `apps/pwa/src/lib/error-i18n.ts`. Keeps the same
 * heuristics (business code → HTTP status → network fallback → generic) so
 * both surfaces map identical failures to identical copy.
 *
 * Usage:
 *   const { t } = useTranslation('errors');
 *   const key = resolveErrorKey(err);
 *   const copy = t(key);
 *
 * The `errors` namespace is loaded eagerly (see `apps/mobile/src/i18n/index.ts`)
 * so this never has to wait for a lazy-load round-trip even at boot time.
 */

export type ErrorKey =
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
 * api client error message. The api client embeds the response body into the
 * `Error.message` via `throw new Error(\`${path} failed: HTTP ${status} ${body}\`)`,
 * so when the body is JSON like `{"error":"rate_limited"}` we can pull the
 * code with a cheap regex rather than re-parsing the whole string.
 */
function extractBusinessCode(message: string): string | null {
  const match = message.match(/"(?:error|code)"\s*:\s*"([a-z_][a-z0-9_]*)"/i);
  // `match[1]` under `noUncheckedIndexedAccess` is `string | undefined`
  // even when `match` is truthy — guard explicitly so the return type
  // stays `string | null`.
  if (!match || match[1] === undefined) return null;
  return match[1].toLowerCase();
}

function extractHttpStatus(message: string): number | null {
  const match = message.match(/HTTP\s+(\d{3})/);
  if (!match || match[1] === undefined) return null;
  return Number.parseInt(match[1], 10);
}

function isNetworkError(err: unknown): boolean {
  if (typeof TypeError !== 'undefined' && err instanceof TypeError) {
    const message = err.message || '';
    if (
      /fetch/i.test(message) ||
      /network\s*error/i.test(message) ||
      /load failed/i.test(message)
    ) {
      return true;
    }
  }
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
