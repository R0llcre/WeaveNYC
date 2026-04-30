/**
 * Sentry RN initialization — deferred until after first interaction.
 *
 * Mirrors apps/pwa/sentry.client.config.ts (post-LCP wrap): the PWA defers
 * init until requestIdleCallback fires; on mobile the equivalent is
 * `InteractionManager.runAfterInteractions(...)`, which holds callbacks
 * until any active gesture/navigation animation settles. Net effect:
 * Sentry's SDK init never competes with the first screen paint.
 *
 * Graceful no-op when `EXPO_PUBLIC_SENTRY_DSN` is unset so `expo start`
 * works locally without any Sentry configuration. Production builds ship
 * with the DSN baked in via EAS build secrets (wave M8).
 *
 * `Sentry.wrap(RootLayout)` in app/_layout.tsx (applied there, not here)
 * gives us the profiling + error-boundary integration without each screen
 * having to opt in.
 *
 * sendDefaultPii: false — we handle sensitive community data; no IP, no
 * cookies, no emails in breadcrumbs.
 * beforeSend URL-sanitizer — strip querystrings so WebSocket tokens don't
 * leak into breadcrumbs (matches PWA behavior).
 */

import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { InteractionManager } from 'react-native';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

function parseTracesSampleRate(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 1) {
    return fallback;
  }
  return parsed;
}

function sanitizeUrl(url: unknown): unknown {
  if (typeof url !== 'string') {
    return url;
  }
  return url.split('?')[0];
}

let initialized = false;

export function initSentrySync(): void {
  if (initialized || !dsn) {
    return;
  }
  initialized = true;

  Sentry.init({
    dsn,
    environment:
      process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ??
      (__DEV__ ? 'development' : 'production'),
    release: process.env.EXPO_PUBLIC_SENTRY_RELEASE ?? Constants.expoConfig?.version,
    tracesSampleRate: parseTracesSampleRate(
      process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
      0.1,
    ),
    // Replays don't apply to RN; leave defaults.
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.url) {
        event.request.url = sanitizeUrl(event.request.url) as string;
      }
      if (event.extra && typeof event.extra.url === 'string') {
        event.extra.url = sanitizeUrl(event.extra.url) as string;
      }
      return event;
    },
  });
}

/**
 * Initialize Sentry after the first interaction settles.
 *
 * Used as a fallback when the synchronous module-level init is skipped
 * (no DSN). Kept for API compat with prior call sites. No-ops if DSN is
 * missing — keeps `expo start` friction-free locally.
 */
export function initSentryDeferred(): void {
  if (!dsn) {
    return;
  }
  InteractionManager.runAfterInteractions(() => {
    initSentrySync();
  });
}

// Synchronous init at module-load time when DSN is set. This is what
// satisfies `Sentry.wrap()` — wrap registers an error boundary that
// expects the client to already be initialized when the wrapped tree
// mounts. Previously init ran inside `useEffect` → `runAfterInteractions`
// which fired AFTER `Sentry.wrap(RootLayout)` had already been called at
// module eval, producing the "App Start Span could not be finished"
// warning. The DSN gate keeps dev (no DSN) friction-free.
if (dsn) {
  initSentrySync();
}

export { Sentry };
