import { afterEach, describe, expect, it } from 'vitest';

import { InMemoryUserStore, createTestApp, createUserRecord } from './helpers.js';

describe('GET /v1/me', () => {
  const apps: Array<{ close: () => Promise<unknown> }> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((entry) => entry.close()));
  });

  it('rejects requests without a bearer token', async () => {
    const { app } = await createTestApp();
    apps.push(app);

    const response = await app.inject({
      method: 'GET',
      url: '/v1/me'
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns the authenticated user for a valid bearer token', async () => {
    const userStore = new InMemoryUserStore();
    const user = createUserRecord();
    userStore.users.set(user.userId, user);

    const { app } = await createTestApp({ userStore });
    apps.push(app);

    const token = app.jwt.sign(
      {
        sub: user.userId,
        level: user.level,
        role: user.role,
        community_ids: user.communityIds
      },
      {
        algorithm: 'RS256',
        iss: app.config.jwt.issuer,
        expiresIn: app.config.jwt.accessTokenTtl
      }
    );

    const response = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      user: {
        user_id: user.userId,
        level: user.level,
        role: user.role,
        community_ids: user.communityIds
      }
    });
  });
});
