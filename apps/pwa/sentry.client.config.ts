// Sentry browser SDK initialization for the WeaveNYC consumer PWA. Uses the
// public DSN (`NEXT_PUBLIC_SENTRY_DSN`). If the env var is unset — the current
// state of the project, pre-DSN provisioning — this module MUST no-op rather
// than fail to import, so `next build` and local dev both keep working.
import * as Sentry from '@sentry/nextjs';

import { clampTracesSampleRate } from './src/lib/sentry-runtime';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'production',
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    tracesSampleRate: clampTracesSampleRate(
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ??
        process.env.SENTRY_TRACES_SAMPLE_RATE,
      0.1,
    ),
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 0.1,
    // The PWA handles sensitive community data — never let Sentry auto-capture
    // PII fields like emails, IPs, or Authorization headers.
    sendDefaultPii: false,
    // `beforeSend` — strip `?querystring` from `request.url` and any
    // `extra.url` we attach on manual captures. Client-side fetches to
    // `/v1/ws/chat?token=JWT` would otherwise publish the JWT alongside
    // every error event.
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
