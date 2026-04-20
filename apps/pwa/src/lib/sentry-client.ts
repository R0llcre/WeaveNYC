'use client';

/**
 * Thin wrapper around `@sentry/nextjs` that degrades gracefully when the SDK
 * isn't installed or `NEXT_PUBLIC_SENTRY_DSN` is unset. Consumers call
 * `captureClientException` / `captureClientMessage` without having to worry
 * about whether Sentry is actually wired up — if it isn't, this is a no-op.
 *
 * We dynamic-import the SDK so:
 *   1. Bundles don't include the Sentry runtime when DSN is unset (the
 *      sentry.client.config.ts file handles init conditionally, but the SDK
 *      itself still ships if we static-import).
 *   2. Unit tests can run without needing to mock `@sentry/nextjs`.
 */

type CaptureTags = Record<string, string | number | boolean | undefined>;

let cachedSdk: Promise<typeof import('@sentry/nextjs') | null> | null = null;

function hasDsn(): boolean {
  if (typeof process === 'undefined') {
    return false;
  }
  return Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);
}

async function loadSentry(): Promise<typeof import('@sentry/nextjs') | null> {
  if (!hasDsn()) {
    return null;
  }
  if (!cachedSdk) {
    cachedSdk = import('@sentry/nextjs').catch(() => null);
  }
  return cachedSdk;
}

function filterTags(tags?: CaptureTags) {
  if (!tags) {
    return undefined;
  }
  const filtered: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(tags)) {
    if (value === undefined) continue;
    filtered[key] = value;
  }
  return filtered;
}

export function captureClientException(
  error: unknown,
  options: { tags?: CaptureTags } = {},
) {
  void (async () => {
    const sdk = await loadSentry();
    if (!sdk) return;
    try {
      sdk.captureException(error, { tags: filterTags(options.tags) });
    } catch {
      // Swallow — we never want monitoring to break the app.
    }
  })();
}

export function captureClientMessage(
  message: string,
  options: { tags?: CaptureTags; level?: 'info' | 'warning' | 'error' } = {},
) {
  void (async () => {
    const sdk = await loadSentry();
    if (!sdk) return;
    try {
      sdk.captureMessage(message, {
        level: options.level ?? 'info',
        tags: filterTags(options.tags),
      });
    } catch {
      // Swallow.
    }
  })();
}
