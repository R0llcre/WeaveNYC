import { afterEach, describe, expect, it } from 'vitest';

import { normalizeRouteLabel } from '../src/lib/metrics.js';
import { createTestApp } from './helpers.js';

describe('normalizeRouteLabel', () => {
  it('returns the route template when Fastify matched a route', () => {
    expect(normalizeRouteLabel('/v1/posts/:post_id', '/v1/posts/abc-123')).toBe(
      '/v1/posts/:post_id',
    );
  });

  it('strips querystring from the route template defensively', () => {
    expect(normalizeRouteLabel('/v1/posts/:post_id?debug=1', '/v1/posts/abc')).toBe(
      '/v1/posts/:post_id',
    );
  });

  it('collapses unknown routes to a single "unknown" bucket', () => {
    // Without a matched route we never let the raw URL through — it
    // would explode cardinality on 404s / malformed URLs / pre-route
    // errors.
    expect(normalizeRouteLabel(undefined, '/something/random/a92f?token=abc')).toBe('unknown');
    expect(normalizeRouteLabel('', '/else/another')).toBe('unknown');
    expect(normalizeRouteLabel(undefined, '')).toBe('unknown');
  });
});

describe('http_requests_total cardinality', () => {
  const apps: Array<{ close: () => Promise<unknown> }> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((entry) => entry.close()));
  });

  it('does not explode on 100 requests to random unknown paths', async () => {
    const { app } = await createTestApp();
    apps.push(app);

    // Fire 100 requests to URLs Fastify cannot match, each with a unique
    // token in the querystring and a unique UUID-like path segment. If
    // the normalizer fell back to the raw URL we'd mint 100 distinct
    // series.
    for (let i = 0; i < 100; i += 1) {
      await app.inject({
        method: 'GET',
        url: `/does-not-exist/${i}/${Math.random().toString(36).slice(2)}?token=jwt-${i}`,
      });
    }

    const response = await app.inject({ method: 'GET', url: '/metrics' });
    expect(response.statusCode).toBe(200);
    const body = response.body;

    // Extract every `http_requests_total{…}` line and parse the `route`
    // label. We tolerate the counter being suffixed with a trailing
    // space + value so the regex stays a single pass.
    const routeLabels = new Set<string>();
    for (const line of body.split('\n')) {
      if (!line.startsWith('http_requests_total{')) {
        continue;
      }
      const match = line.match(/route="([^"]*)"/);
      if (match) {
        routeLabels.add(match[1]);
      }
    }

    // `unknown` must be present because 100 unmatched requests all flow
    // through the same bucket. Matched routes (e.g. `/metrics` itself)
    // may also appear once.
    expect(routeLabels.has('unknown')).toBe(true);

    // No raw token/UUID/query string should have leaked through as a
    // label.
    for (const label of routeLabels) {
      expect(label).not.toMatch(/token=/);
      expect(label).not.toMatch(/does-not-exist/);
      expect(label).not.toMatch(/\?/);
    }

    // Total route labels should be bounded by a handful of matched
    // routes plus the single `unknown` bucket — definitely not 100.
    expect(routeLabels.size).toBeLessThan(10);
  });
});
