/**
 * Shared helpers used by `sentry.client/server/edge.config.ts`.
 *
 * The helpers are intentionally framework-agnostic (no React / Next
 * imports) so they can run in the Edge runtime and the browser runtime
 * without a polyfill. The Sentry Next wrap loads every config at build
 * time in all three runtimes.
 */

/**
 * Parse a `SENTRY_TRACES_SAMPLE_RATE` / `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`
 * env var and clamp it into `[0, 1]`. Falls back to `fallback` when the
 * input is absent, non-numeric, `NaN`, `Infinity`, negative, or > 1.
 *
 * Keeping the clamp here (rather than trusting whatever shows up in the
 * env) means a misconfigured pipeline — e.g. CI writes the string `"10%"`
 * into the var — cannot accidentally hammer Sentry with 10× the expected
 * trace volume or silently disable tracing with a negative number.
 */
export function clampTracesSampleRate(
  raw: string | undefined,
  fallback: number,
): number {
  if (raw === undefined || raw === null || raw === '') {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  if (parsed < 0) return 0;
  if (parsed > 1) return 1;
  return parsed;
}
