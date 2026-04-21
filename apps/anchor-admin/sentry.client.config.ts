// Sentry browser SDK initialization for the WeaveNYC Anchor Admin
// console. Uses a separate DSN (`NEXT_PUBLIC_SENTRY_ADMIN_DSN`) so the
// internal admin error stream stays isolated from the consumer PWA. We
// fall back to the PWA's DSN only when the admin-specific DSN is unset
// so a partially-provisioned environment keeps working; in any
// production deployment both values should be set and distinct.
import * as Sentry from '@sentry/nextjs';

import { clampTracesSampleRate } from './src/lib/sentry-runtime';

const dsn = process.env.NEXT_PUBLIC_SENTRY_ADMIN_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'production',
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    tracesSampleRate: clampTracesSampleRate(
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ??
        process.env.SENTRY_TRACES_SAMPLE_RATE,
      0.2,
    ),
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 0.25,
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
