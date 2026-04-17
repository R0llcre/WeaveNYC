// Sentry Node SDK initialization for the WeaveNYC PWA server runtime.
// With `output: 'export'` the PWA ships as a static bundle, so this file
// only runs during `next build` / `next dev` — it is still required by
// `@sentry/nextjs` for source-map uploads and build-time instrumentation.
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
