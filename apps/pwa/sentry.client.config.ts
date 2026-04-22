// Sentry browser SDK initialization for the WeaveNYC consumer PWA. Uses the
// public DSN (`NEXT_PUBLIC_SENTRY_DSN`). If the env var is unset — the current
// state of the project, pre-DSN provisioning — this module MUST no-op rather
// than fail to import, so `next build` and local dev both keep working.
//
// V2-B win #2 — defer the actual `Sentry.init` call past LCP AND defer the
// entire SDK import. Previously `import * as Sentry from '@sentry/nextjs'`
// at the top of this file pulled the 550KB browser SDK into the critical
// path even when `init()` was deferred, because Turbopack resolves static
// imports eagerly. Converting to a dynamic `await import(...)` inside the
// idle callback moves the SDK into its own async chunk that only downloads
// after the browser reports main-thread idle (or 3s have elapsed). First
// paint therefore no longer competes with Sentry's module evaluation, and
// the orphan ~550KB wrapped-chunk artefact disappears from the initial
// route bundle.
//
// Note: `sentry.client.config.ts` is still the file the Next Sentry
// integration looks for at build time, and it still gets wrapped into the
// client bootstrap. The async-import trick keeps the module itself trivial
// (no `@sentry/nextjs` at top-level) so nothing gets pulled in eagerly.

import { clampTracesSampleRate } from './src/lib/sentry-runtime';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

type IdleDeadline = { timeRemaining(): number; didTimeout: boolean };
type IdleCallbackWindow = Window & {
  requestIdleCallback?: (callback: (deadline: IdleDeadline) => void, options?: { timeout?: number }) => number;
};

async function initSentry(): Promise<void> {
  if (!dsn) {
    return;
  }
  // Dynamic import keeps the SDK out of the first-paint JS graph. The
  // returned promise resolves after Sentry's chunk has been fetched and
  // parsed — under the idle-callback scheduler that's after LCP on every
  // connection we care about.
  const Sentry = await import('@sentry/nextjs');
  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'production',
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    tracesSampleRate: clampTracesSampleRate(
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ??
        process.env.SENTRY_TRACES_SAMPLE_RATE,
      0.1,
    ),
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 0.1,
    // The PWA handles sensitive community data — never let Sentry auto-capture
    // PII fields like emails, IPs, or Authorization headers.
    sendDefaultPii: false,
    // `beforeSend` — strip `?querystring` from `request.url` and any
    // `extra.url` we attach on manual captures. Client-side fetches to
    // `/v1/ws/chat?token=JWT` would otherwise publish the JWT alongside
    // every error event.
    beforeSend(event) {
      if (event.request?.url) {
        event.request.url = event.request.url.split('?')[0];
      }
      if (event.extra && typeof event.extra.url === 'string') {
        event.extra.url = event.extra.url.split('?')[0];
      }
      return event;
    },
  });
}

if (typeof window !== 'undefined' && dsn) {
  // `requestIdleCallback` with a 3s timeout guarantees Sentry comes up even
  // if the browser never reports idle (long-running scripts on low-end
  // Android). On Safari (no rIC) we fall back to a setTimeout — 2s is long
  // enough to put us past LCP on a median mobile connection but short
  // enough that errors during the initial session still get captured.
  const idleWindow = window as IdleCallbackWindow;
  if (typeof idleWindow.requestIdleCallback === 'function') {
    idleWindow.requestIdleCallback(() => {
      void initSentry();
    }, { timeout: 3000 });
  } else {
    setTimeout(() => {
      void initSentry();
    }, 2000);
  }
}
