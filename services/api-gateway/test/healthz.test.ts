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

  it('returns minimal runtime metrics', async () => {
    const { app } = await createTestApp();
    apps.push(app);

    const response = await app.inject({
      method: 'GET',
      url: '/metrics'
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
