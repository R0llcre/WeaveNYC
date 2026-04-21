// Sentry edge runtime initialization for the WeaveNYC PWA. Static-export
// builds never reach the edge runtime, but @sentry/nextjs requires this file
// to be present when the SDK is installed. Unset DSN → no-op init.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'production',
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}
