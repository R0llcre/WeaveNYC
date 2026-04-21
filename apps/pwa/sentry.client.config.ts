// Sentry browser SDK initialization for the WeaveNYC consumer PWA. Uses the
// public DSN (`NEXT_PUBLIC_SENTRY_DSN`). If the env var is unset — the current
// state of the project, pre-DSN provisioning — this module MUST no-op rather
// than fail to import, so `next build` and local dev both keep working.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'production',
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 0.1,
    // The PWA handles sensitive community data — never let Sentry auto-capture
    // PII fields like emails, IPs, or Authorization headers.
    sendDefaultPii: false,
  });
}
