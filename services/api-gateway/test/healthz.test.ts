import { afterEach, describe, expect, it } from 'vitest';

import { createTestApp } from './helpers.js';

describe('GET /healthz', () => {
  const apps: Array<{ close: () => Promise<unknown> }> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((entry) => entry.close()));
  });

  it('returns 200 ok', async () => {
    const { app } = await createTestApp();
    apps.push(app);

    const response = await app.inject({
      method: 'GET',
      url: '/healthz'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'ok',
      service: 'api-gateway'
    });
  });

  it('returns runtime version metadata', async () => {
    const { app } = await createTestApp();
    apps.push(app);

    const response = await app.inject({
      method: 'GET',
      url: '/versionz'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      service: 'api-gateway',
      version: expect.any(String),
      runtime: expect.stringMatching(/^v\d+\./),
    });
  });

  it('returns Prometheus exposition text on /metrics', async () => {
    const { app } = await createTestApp();
    apps.push(app);

    // Exercise at least one non-metrics route so the HTTP counters have
    // real labels to scrape.
    await app.inject({ method: 'GET', url: '/healthz' });

    const response = await app.inject({
      method: 'GET',
      url: '/metrics'
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/text\/plain/);
    const body = response.body;
    expect(body).toContain('# HELP http_requests_total');
    expect(body).toContain('# TYPE http_requests_total counter');
    expect(body).toContain('# HELP http_request_duration_seconds');
    expect(body).toContain('# TYPE http_request_duration_seconds histogram');
    expect(body).toContain('# HELP auth_challenges_total');
    expect(body).toContain('# HELP verified_matches_total');
    expect(body).toContain('# HELP account_deletions_total');
    expect(body).toContain('route="/healthz"');
  });

  it('returns legacy JSON metrics on /metrics.json', async () => {
    const { app } = await createTestApp();
    apps.push(app);

    const response = await app.inject({
      method: 'GET',
      url: '/metrics.json'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      service: 'api-gateway',
      version: expect.any(String),
      node_env: expect.any(String),
    });
    expect(response.json().uptime_seconds).toEqual(expect.any(Number));
  });
});
