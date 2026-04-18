// Sentry Node SDK initialization for the WeaveNYC Anchor Admin server
// runtime. Static-export build path only uses this during `next build`.
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
