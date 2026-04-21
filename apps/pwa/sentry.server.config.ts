// Sentry Node SDK initialization for the WeaveNYC PWA server runtime.
// The PWA is built with `output: 'export'` (see `next.config.ts`), so the
// server runtime only runs during `next build`. Even so, `@sentry/nextjs`
// expects this file to exist — otherwise the sentry webpack plugin throws on
// build. Unset DSN → no-op init.
import * as Sentry from '@sentry/nextjs';

import { clampTracesSampleRate } from './src/lib/sentry-runtime';

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'production',
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: clampTracesSampleRate(
      process.env.SENTRY_TRACES_SAMPLE_RATE ??
        process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
      0.1,
    ),
    sendDefaultPii: false,
    // Strip `?querystring` from request / extra URLs so JWTs embedded
    // as query-string tokens do not land in Sentry.
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
