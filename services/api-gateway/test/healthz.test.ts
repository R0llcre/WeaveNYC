import { afterEach, describe, expect, it } from 'vitest';

import { InMemoryChatRealtimeHub } from '../src/lib/chat-realtime.js';
import { InMemoryP2PSyncRuntime } from '../src/lib/sync-runtime.js';
import {
  createTestApp,
  InMemoryRefreshTokenStore,
  InMemoryUserStore,
} from './helpers.js';

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

describe('GET /readyz', () => {
  const apps: Array<{ close: () => Promise<unknown> }> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((entry) => entry.close()));
  });

  it('returns 200 with every probe ok on a healthy app', async () => {
    const { app } = await createTestApp();
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/readyz' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      status: string;
      checks: Array<{ name: string; status: string }>;
    };
    expect(body.status).toBe('ok');
    const names = new Set(body.checks.map((c) => c.name));
    expect(names).toContain('postgres');
    expect(names).toContain('redis');
    expect(names).toContain('chat_realtime');
    expect(names).toContain('p2p_sync');
    expect(names).toContain('jwt_sign_verify');
    expect(body.checks.every((check) => check.status === 'ok')).toBe(true);
  });

  it('returns 503 when userStore.ping throws (postgres degraded)', async () => {
    const userStore = new InMemoryUserStore();
    userStore.ping = async () => {
      throw new Error('postgres cluster unreachable');
    };
    const { app } = await createTestApp({ userStore });
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/readyz' });
    expect(response.statusCode).toBe(503);
    const body = response.json() as {
      status: string;
      checks: Array<{ name: string; status: string; detail?: string }>;
    };
    expect(body.status).toBe('degraded');
    const postgres = body.checks.find((check) => check.name === 'postgres');
    expect(postgres?.status).toBe('degraded');
    expect(postgres?.detail).toContain('postgres cluster unreachable');
  });

  it('returns 503 when refreshTokenStore.ping throws (redis degraded)', async () => {
    const refreshTokenStore = new InMemoryRefreshTokenStore();
    refreshTokenStore.ping = async () => {
      throw new Error('redis timeout');
    };
    const { app } = await createTestApp({ refreshTokenStore });
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/readyz' });
    expect(response.statusCode).toBe(503);
    const body = response.json() as {
      checks: Array<{ name: string; status: string; detail?: string }>;
    };
    const redis = body.checks.find((check) => check.name === 'redis');
    expect(redis?.status).toBe('degraded');
    expect(redis?.detail).toContain('redis timeout');
  });

  it('returns 503 when chatRealtimeHub.ping throws', async () => {
    const chatRealtimeHub = new InMemoryChatRealtimeHub();
    chatRealtimeHub.ping = async () => {
      throw new Error('chat pub/sub broken');
    };
    const { app } = await createTestApp({ chatRealtimeHub });
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/readyz' });
    expect(response.statusCode).toBe(503);
    const body = response.json() as {
      checks: Array<{ name: string; status: string; detail?: string }>;
    };
    const chat = body.checks.find((check) => check.name === 'chat_realtime');
    expect(chat?.status).toBe('degraded');
    expect(chat?.detail).toContain('chat pub/sub broken');
  });

  it('returns 503 when syncRuntime.ping throws', async () => {
    const syncRuntime = new InMemoryP2PSyncRuntime();
    syncRuntime.ping = async () => {
      throw new Error('p2p runtime down');
    };
    const { app } = await createTestApp({ syncRuntime });
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/readyz' });
    expect(response.statusCode).toBe(503);
    const body = response.json() as {
      checks: Array<{ name: string; status: string; detail?: string }>;
    };
    const sync = body.checks.find((check) => check.name === 'p2p_sync');
    expect(sync?.status).toBe('degraded');
    expect(sync?.detail).toContain('p2p runtime down');
  });
});
