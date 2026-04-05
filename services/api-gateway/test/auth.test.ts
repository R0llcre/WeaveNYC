import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';

import type { AuthTokenClaims } from '../src/types.js';
import {
  InMemoryRefreshTokenStore,
  InMemoryUserStore,
  createTestApp
} from './helpers.js';

describe('POST /v1/auth/anonymous', () => {
  const apps: Array<{ close: () => Promise<unknown> }> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((entry) => entry.close()));
  });

  it('creates an anonymous user row and returns signed tokens', async () => {
    const userStore = new InMemoryUserStore();
    const refreshTokenStore = new InMemoryRefreshTokenStore();
    const { app } = await createTestApp({
      userStore,
      refreshTokenStore
    });
    apps.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/anonymous',
      payload: {
        device_id: randomUUID()
      }
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.refresh_token).toMatch(/^rt_/);
    expect(body.user.level).toBe('anonymous');
    expect(userStore.users.size).toBe(1);
    expect(refreshTokenStore.sessions.has(body.refresh_token)).toBe(true);

    const claims = await app.jwt.verify<AuthTokenClaims>(body.access_token);
    expect(claims.level).toBe('anonymous');
    expect(claims.role).toBe('user');
    expect(claims.sub).toBe(body.user.user_id);
  });
});
