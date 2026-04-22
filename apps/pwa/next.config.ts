import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  reactStrictMode: true,
  trailingSlash: true,
};

// Sentry wraps the config so that `next build` uploads sourcemaps to
// Sentry when SENTRY_AUTH_TOKEN is present in the build environment.
// With no token (local dev, forks, PRs from contributors without
// secret access) the wrap is inert — the build still succeeds and just
// skips the upload. See `apps/pwa/SENTRY.md` for provisioning.
//
// `sourcemaps.deleteSourcemapsAfterUpload: true` replaces the v9-era
// `hideSourceMaps` option — after upload to Sentry the `.map` files are
// deleted from `.next/` so we never ship them to CF Pages. Minified
// stack traces still symbolicate in Sentry's UI.
// V2-B win #2 — `widenClientFileUpload: false` stops the Sentry webpack
// plugin from wrapping every `_next/*` chunk with its error-instrumentation
// shim. That shim was responsible for the 553KB orphan chunk (seen as
// `0y~9actfbel_i.js` in prior builds) plus ~40KB of overhead sprinkled
// across every route bundle. We still upload sourcemaps for the files
// Sentry wraps by default (pages / app routes) so stack traces symbolicate
// correctly in the Sentry UI — we just stop instrumenting the static
// chunks the user never triggers an error from.
export default withSentryConfig(nextConfig, {
  silent: true,
  org: 'weavenyc',
  project: 'weavenyc-pwa',
  widenClientFileUpload: false,
  disableLogger: true,
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
});
