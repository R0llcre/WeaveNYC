function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Kept in sync with `packages/db/package.json#version`. Hardcoded rather than
 * imported so the compiled dist does not drag the full `package.json` into the
 * module graph (and so unit tests do not require `resolveJsonModule` gymnastics).
 */
export const PUBLIC_INGEST_VERSION = "0.1.0";
const DEFAULT_USER_AGENT = `weavenyc-seed/${PUBLIC_INGEST_VERSION} (classroom-demo)`;

export interface FetchWithRetryOptions {
  etag?: string | null;
  signal?: AbortSignal;
  userAgent?: string;
  attempts?: number;
  /** Base retry delay in ms. Each successive retry multiplies this by (attempt + 1). */
  retryBaseMs?: number;
  accept?: string;
  headers?: Record<string, string>;
}

/**
 * Thin wrapper around `fetch` with exponential-backoff retry on 5xx/network
 * errors and an explicit, stable User-Agent. Exists so every public source
 * identifies itself politely to upstream providers (USDA FNS, NYC Open Data,
 * HRSA) and so class-day WiFi hiccups don't blow up the ingest pipeline.
 */
export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const attempts = options.attempts ?? 3;
  const retryBaseMs = options.retryBaseMs ?? 500;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;

  const headers: Record<string, string> = {
    "user-agent": userAgent,
    accept: options.accept ?? "application/json",
    ...(options.headers ?? {}),
  };
  if (options.etag) {
    headers["if-none-match"] = options.etag;
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers,
        signal: options.signal,
      });
      if (response.status >= 500 && attempt < attempts - 1) {
        await delay(retryBaseMs * (attempt + 1));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) {
        break;
      }
      await delay(retryBaseMs * (attempt + 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("fetch failed");
}

/**
 * Minimal token-bucket rate limiter. Returns a function that resolves when
 * the caller may make the next request without exceeding `rps`, after an
 * initial burst of `burst` requests. We ship our own rather than pulling in
 * `p-limit`/`bottleneck` to keep the db package install footprint tiny.
 */
export function createRateLimiter(opts: { rps: number; burst: number }): () => Promise<void> {
  const { rps, burst } = opts;
  const intervalMs = 1000 / Math.max(1, rps);
  let tokens = burst;
  let lastRefill = Date.now();

  async function waitSlot(): Promise<void> {
    const now = Date.now();
    const elapsed = now - lastRefill;
    if (elapsed > 0) {
      const refill = (elapsed / 1000) * rps;
      tokens = Math.min(burst, tokens + refill);
      lastRefill = now;
    }

    if (tokens >= 1) {
      tokens -= 1;
      return;
    }

    const deficit = 1 - tokens;
    const waitMs = Math.ceil((deficit / rps) * 1000);
    await delay(waitMs);
    return waitSlot();
  }

  return waitSlot;
}

export { DEFAULT_USER_AGENT };
