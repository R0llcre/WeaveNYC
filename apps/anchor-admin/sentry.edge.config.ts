// Sentry edge runtime initialization for the Anchor Admin console.
// Static-export builds never reach the edge runtime, but Next.js requires
// the file to be present when `@sentry/nextjs` is installed.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'production',
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: 0.2,
    sendDefaultPii: false,
  });
}
