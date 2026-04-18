// Sentry browser SDK initialization for the WeaveNYC Anchor Admin
// console. Uses a separate DSN (`NEXT_PUBLIC_SENTRY_ADMIN_DSN`) so the
// internal admin error stream stays isolated from the consumer PWA.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'production',
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    tracesSampleRate: 0.2,
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 0.25,
    sendDefaultPii: false,
  });
}
