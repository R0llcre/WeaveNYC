import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

/**
 * V2-E — build-time snapshot metadata for the Home freshness footer.
 *
 * The resources API doesn't (yet) expose `snapshot_date` on every
 * `ResourcesResponse`, so until it does we fall back to a compile-time
 * constant read from the public-ingest snapshot JSON. The two fields we
 * surface — `generatedAt` and `totalRows` — power:
 *   "Last updated {date} · Covering {count} places"
 * at the bottom of the Home screen.
 *
 * The file is committed (`packages/db/seed/generated/public-resources.snapshot.json`)
 * so this read always succeeds in CI as well as on a fresh clone. If the
 * file is missing (contributor who hasn't run the ingest step) we fall
 * back to empty strings so the footer gracefully hides rather than
 * rendering "Last updated undefined".
 */
function readSnapshotMeta(): { generatedAt: string; totalRows: string } {
  try {
    const path = resolve(
      process.cwd(),
      '..',
      '..',
      'packages/db/seed/generated/public-resources.snapshot.json',
    );
    const raw = readFileSync(path, 'utf8');
    const parsed: { generatedAt?: string; totalRows?: number } = JSON.parse(raw);
    return {
      generatedAt: parsed.generatedAt ?? '',
      totalRows: typeof parsed.totalRows === 'number' ? String(parsed.totalRows) : '',
    };
  } catch {
    return { generatedAt: '', totalRows: '' };
  }
}

const snapshotMeta = readSnapshotMeta();

const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  reactStrictMode: true,
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_DATA_SNAPSHOT_DATE: snapshotMeta.generatedAt,
    NEXT_PUBLIC_DATA_SNAPSHOT_COUNT: snapshotMeta.totalRows,
  },
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
