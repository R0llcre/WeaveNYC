// Sentry Node SDK initialization for the WeaveNYC Anchor Admin server
// runtime. Static-export build path only uses this during `next build`.
// Prefers the admin-scoped DSN so admin errors stay isolated from the
// consumer PWA project.
import * as Sentry from '@sentry/nextjs';

import { clampTracesSampleRate } from './src/lib/sentry-runtime';

const dsn =
  process.env.SENTRY_ADMIN_DSN ??
  process.env.NEXT_PUBLIC_SENTRY_ADMIN_DSN ??
  process.env.SENTRY_DSN ??
  process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'production',
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: clampTracesSampleRate(
      process.env.SENTRY_TRACES_SAMPLE_RATE ??
        process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
      0.2,
    ),
    sendDefaultPii: false,
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
