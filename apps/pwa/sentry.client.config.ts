// Sentry browser SDK initialization for the WeaveNYC PWA.
//
// No-op when the `NEXT_PUBLIC_SENTRY_DSN` env var is empty so preview /
// dev builds never ping Sentry. Next.js loads this file automatically when
// `@sentry/nextjs` is installed — we intentionally do not use
// `sentry.init()` at module top level because the DSN may not be present.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'production',
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 0.1,
    sendDefaultPii: false,
    integrations: [
      // Defer to Sentry defaults — we do not install browserTracing or
      // replay when the DSN is unset to keep the unused bundle cost zero.
    ],
  });
}
