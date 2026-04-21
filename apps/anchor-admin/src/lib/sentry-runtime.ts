/**
 * Shared helpers used by `sentry.client/server/edge.config.ts`.
 *
 * Kept framework-agnostic (no React/Next imports) so all three Sentry
 * runtimes can load this file.
 */

/**
 * Parse an env var carrying the Sentry traces sample rate and clamp it
 * into `[0, 1]`. Falls back when the value is absent, non-numeric,
 * `NaN`, `Infinity`, negative, or > 1 so a misconfigured pipeline
 * cannot silently overshoot the expected trace volume or disable
 * tracing with a negative number.
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
