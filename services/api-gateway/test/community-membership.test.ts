import { afterEach, describe, expect, it } from 'vitest';

import { createTestApp, createUserRecord, InMemoryUserStore } from './helpers.js';

const community = {
  community_id: '44444444-4444-4444-8444-444444444444',
  name: 'Farmingdale Demo Community',
  center_zip: '11735',
  join_policy: 'invite_only' as const,
};

describe('community access routes', () => {
  const apps: Array<{ close: () => Promise<unknown> }> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((entry) => entry.close()));
  });

  it('resolves an invite code and joins idempotently', async () => {
    const userStore = new InMemoryUserStore();
    const user = createUserRecord();
    userStore.users.set(user.userId, user);

    const { app, postsService } = await createTestApp({ userStore });
    apps.push(app);
    postsService.communityAccessCodes.set('invite:FARMINGDALE-HELP', {
      community,
      join_token: 'ignored',
      entry: 'invite_code',
      expires_in_seconds: 600,
    });

    const token = app.jwt.sign(
      {
        sub: user.userId,
        level: user.level,
        role: user.role,
        community_ids: user.communityIds,
      },
      {
        algorithm: 'RS256',
        iss: app.config.jwt.issuer,
        expiresIn: app.config.jwt.accessTokenTtl,
      }
    );

    const resolveResponse = await app.inject({
      method: 'POST',
      url: '/v1/community-access/resolve',
      headers: { authorization: `Bearer ${token}` },
      payload: { invite_code: 'FARMINGDALE-HELP' },
    });

    expect(resolveResponse.statusCode).toBe(200);
    expect(resolveResponse.json().community).toMatchObject(community);

    const joinResponse = await app.inject({
      method: 'POST',
      url: `/v1/communities/${community.community_id}/join`,
      headers: { authorization: `Bearer ${token}` },
      payload: { join_token: resolveResponse.json().join_token },
    });

    expect(joinResponse.statusCode).toBe(200);
    expect(joinResponse.json().membership_status).toBe('joined');

    const joinAgainResponse = await app.inject({
      method: 'POST',
      url: `/v1/communities/${community.community_id}/join`,
      headers: { authorization: `Bearer ${token}` },
      payload: { join_token: resolveResponse.json().join_token },
    });

    expect(joinAgainResponse.statusCode).toBe(200);
    expect(joinAgainResponse.json().membership_status).toBe('already_joined');
  });

  it('rejects invalid join tokens', async () => {
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
        community_ids: user.communityIds,
      },
      {
        algorithm: 'RS256',
        iss: app.config.jwt.issuer,
        expiresIn: app.config.jwt.accessTokenTtl,
      }
    );

    const response = await app.inject({
      method: 'POST',
      url: `/v1/communities/${community.community_id}/join`,
      headers: { authorization: `Bearer ${token}` },
      payload: { join_token: 'invalid-join-token' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('prevents anchors from browsing community feeds outside their scoped communities', async () => {
    const userStore = new InMemoryUserStore();
    const anchor = createUserRecord({
      userId: '33333333-3333-4333-8333-333333333333',
      level: 'anchor',
      role: 'anchor',
      communityIds: ['55555555-5555-4555-8555-555555555555'],
    });
    userStore.users.set(anchor.userId, anchor);

    const { app } = await createTestApp({ userStore });
    apps.push(app);

    const token = app.jwt.sign(
      {
        sub: anchor.userId,
        level: anchor.level,
        role: anchor.role,
        community_ids: anchor.communityIds,
      },
      {
        algorithm: 'RS256',
        iss: app.config.jwt.issuer,
        expiresIn: app.config.jwt.accessTokenTtl,
      }
    );

    const response = await app.inject({
      method: 'GET',
      url: `/v1/posts?scope=community&community_id=${community.community_id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);
  });
});
