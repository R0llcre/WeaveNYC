import { afterEach, describe, expect, it } from 'vitest';

import { createTestApp, createUserRecord, InMemoryUserStore } from './helpers.js';

const communityId = '44444444-4444-4444-8444-444444444444';

function signUser(app: Awaited<ReturnType<typeof createTestApp>>['app'], user: ReturnType<typeof createUserRecord>) {
  return app.jwt.sign(
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
}

describe('post routes', () => {
  const apps: Array<{ close: () => Promise<unknown> }> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((entry) => entry.close()));
  });

  it('allows anonymous community members to publish low-risk requests', async () => {
    const userStore = new InMemoryUserStore();
    const user = createUserRecord({ communityIds: [communityId] });
    userStore.users.set(user.userId, user);

    const { app } = await createTestApp({ userStore });
    apps.push(app);
    const token = signUser(app, user);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/posts',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        community_id: communityId,
        post_type: 'request',
        category: 'food',
        title: 'Need dinner',
        body: 'Need dinner for two tonight.',
        language: 'en',
        location_zip: '11735',
        privacy: 'community_only',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'active',
      risk_level: 'low',
    });
  });

  it('rejects anonymous offers and supports owner lifecycle actions', async () => {
    const userStore = new InMemoryUserStore();
    const anonymousUser = createUserRecord({ communityIds: [communityId] });
    userStore.users.set(anonymousUser.userId, anonymousUser);
    const verifiedUser = createUserRecord({
      userId: '22222222-2222-4222-8222-222222222222',
      level: 'verified',
      communityIds: [communityId],
    });
    userStore.users.set(verifiedUser.userId, verifiedUser);

    const { app } = await createTestApp({ userStore });
    apps.push(app);

    const anonymousToken = signUser(app, anonymousUser);
    const verifiedToken = signUser(app, verifiedUser);

    const offerResponse = await app.inject({
      method: 'POST',
      url: '/v1/posts',
      headers: { authorization: `Bearer ${anonymousToken}` },
      payload: {
        community_id: communityId,
        post_type: 'offer',
        category: 'food',
        title: 'Can share groceries',
        body: 'I can share groceries.',
        language: 'en',
        location_zip: '11735',
        privacy: 'community_only',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
    });

    expect(offerResponse.statusCode).toBe(403);

    const createResponse = await app.inject({
      method: 'POST',
      url: '/v1/posts',
      headers: { authorization: `Bearer ${verifiedToken}` },
      payload: {
        community_id: communityId,
        post_type: 'request',
        category: 'food',
        title: 'Need groceries',
        body: 'Need groceries for tonight.',
        language: 'en',
        location_zip: '11735',
        privacy: 'public',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
    });

    const postId = createResponse.json().post_id as string;
    expect(createResponse.statusCode).toBe(200);

    const updateResponse = await app.inject({
      method: 'PATCH',
      url: `/v1/posts/${postId}`,
      headers: { authorization: `Bearer ${verifiedToken}` },
      payload: {
        body: 'Updated need: groceries for Friday evening.',
      },
    });
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().body).toContain('Friday evening');

    const detailResponse = await app.inject({
      method: 'GET',
      url: `/v1/posts/${postId}`,
      headers: { authorization: `Bearer ${verifiedToken}` },
    });
    expect(detailResponse.statusCode).toBe(200);

    const mineResponse = await app.inject({
      method: 'GET',
      url: '/v1/posts/mine',
      headers: { authorization: `Bearer ${verifiedToken}` },
    });
    expect(mineResponse.statusCode).toBe(200);
    expect(mineResponse.json().items).toHaveLength(1);

    const closeResponse = await app.inject({
      method: 'POST',
      url: `/v1/posts/${postId}/close`,
      headers: { authorization: `Bearer ${verifiedToken}` },
    });
    expect(closeResponse.statusCode).toBe(200);
    expect(closeResponse.json().status).toBe('closed');

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/v1/posts/${postId}`,
      headers: { authorization: `Bearer ${verifiedToken}` },
    });
    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.json().status).toBe('removed');
  });

  it('rejects anonymous edits that escalate a request into high-risk content', async () => {
    const userStore = new InMemoryUserStore();
    const anonymousUser = createUserRecord({ communityIds: [communityId] });
    userStore.users.set(anonymousUser.userId, anonymousUser);

    const { app } = await createTestApp({ userStore });
    apps.push(app);

    const anonymousToken = signUser(app, anonymousUser);

    const createResponse = await app.inject({
      method: 'POST',
      url: '/v1/posts',
      headers: { authorization: `Bearer ${anonymousToken}` },
      payload: {
        community_id: communityId,
        post_type: 'request',
        category: 'food',
        title: 'Need dinner',
        body: 'Need dinner for tonight.',
        language: 'en',
        location_zip: '11735',
        privacy: 'community_only',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
    });

    expect(createResponse.statusCode).toBe(200);

    const updateResponse = await app.inject({
      method: 'PATCH',
      url: `/v1/posts/${createResponse.json().post_id as string}`,
      headers: { authorization: `Bearer ${anonymousToken}` },
      payload: {
        category: 'childcare',
        body: 'Need someone to watch my child after pickup.',
      },
    });

    expect(updateResponse.statusCode).toBe(403);
  });

  it('rejects malformed post ids with 400s before reaching the repository', async () => {
    const userStore = new InMemoryUserStore();
    const user = createUserRecord({ communityIds: [communityId] });
    userStore.users.set(user.userId, user);

    const { app } = await createTestApp({ userStore });
    apps.push(app);

    const token = signUser(app, user);

    const detailResponse = await app.inject({
      method: 'GET',
      url: '/v1/posts/not-a-uuid',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(detailResponse.statusCode).toBe(400);

    const updateResponse = await app.inject({
      method: 'PATCH',
      url: '/v1/posts/not-a-uuid',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        body: 'Updated body',
      },
    });
    expect(updateResponse.statusCode).toBe(400);

    const closeResponse = await app.inject({
      method: 'POST',
      url: '/v1/posts/not-a-uuid/close',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(closeResponse.statusCode).toBe(400);
  });
});
