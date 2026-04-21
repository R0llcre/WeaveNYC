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
export default withSentryConfig(nextConfig, {
  silent: true,
  org: 'weavenyc',
  project: 'weavenyc-pwa',
  widenClientFileUpload: true,
  disableLogger: true,
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
});
