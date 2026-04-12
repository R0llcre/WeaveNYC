import { afterEach, describe, expect, it } from 'vitest';

import { createTestApp, createUserRecord, InMemoryUserStore } from './helpers.js';

const communityId = '44444444-4444-4444-8444-444444444444';
const freshMfa = '2026-04-12T08:00:00.000Z';

function signUser(app: Awaited<ReturnType<typeof createTestApp>>['app'], user: ReturnType<typeof createUserRecord>) {
  return app.jwt.sign(
    {
      sub: user.userId,
      level: user.level,
      role: user.role,
      community_ids: user.communityIds,
      anchor_community_id: user.anchorCommunityId ?? undefined,
      mfa_verified_at: user.mfaVerifiedAt,
    },
    {
      algorithm: 'RS256',
      iss: app.config.jwt.issuer,
      expiresIn: app.config.jwt.accessTokenTtl,
    }
  );
}

describe('review queue routes', () => {
  const apps: Array<{ close: () => Promise<unknown> }> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((entry) => entry.close()));
  });

  it('shows pending review posts to anchors and applies decisions', async () => {
    const userStore = new InMemoryUserStore();
    const verifiedUser = createUserRecord({
      userId: '22222222-2222-4222-8222-222222222222',
      level: 'verified',
      communityIds: [communityId],
    });
    const anchorUser = createUserRecord({
      userId: '33333333-3333-4333-8333-333333333333',
      level: 'anchor',
      role: 'anchor',
      communityIds: [communityId],
      mfaVerifiedAt: freshMfa,
    });
    userStore.users.set(verifiedUser.userId, verifiedUser);
    userStore.users.set(anchorUser.userId, anchorUser);

    const { app } = await createTestApp({ userStore });
    apps.push(app);

    const verifiedToken = signUser(app, verifiedUser);
    const anchorToken = signUser(app, anchorUser);

    const createResponse = await app.inject({
      method: 'POST',
      url: '/v1/posts',
      headers: { authorization: `Bearer ${verifiedToken}` },
      payload: {
        community_id: communityId,
        post_type: 'offer',
        category: 'transportation',
        title: 'Can drive someone',
        body: 'Can drive a neighbor to the pantry after school pickup.',
        language: 'en',
        location_zip: '11735',
        privacy: 'community_only',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
    });

    expect(createResponse.statusCode).toBe(200);
    expect(createResponse.json().status).toBe('pending_review');

    const queueResponse = await app.inject({
      method: 'GET',
      url: `/v1/admin/review_queue?community_id=${communityId}`,
      headers: { authorization: `Bearer ${anchorToken}` },
    });

    expect(queueResponse.statusCode).toBe(200);
    expect(queueResponse.json().items).toHaveLength(1);

    const postId = queueResponse.json().items[0].post_id as string;
    const decisionResponse = await app.inject({
      method: 'POST',
      url: `/v1/admin/review_queue/${postId}/decision`,
      headers: { authorization: `Bearer ${anchorToken}` },
      payload: {
        decision: 'approve',
        notes: 'Looks safe',
      },
    });

    expect(decisionResponse.statusCode).toBe(200);
    expect(decisionResponse.json().status).toBe('active');
  });

  it('rejects non-anchor access to the review queue', async () => {
    const userStore = new InMemoryUserStore();
    const user = createUserRecord({
      communityIds: [communityId],
    });
    userStore.users.set(user.userId, user);

    const { app } = await createTestApp({ userStore });
    apps.push(app);
    const token = signUser(app, user);

    const response = await app.inject({
      method: 'GET',
      url: `/v1/admin/review_queue?community_id=${communityId}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it('rejects anchor review access without a fresh MFA step-up', async () => {
    const userStore = new InMemoryUserStore();
    const anchorUser = createUserRecord({
      userId: '99999999-9999-4999-8999-999999999999',
      level: 'anchor',
      role: 'anchor',
      communityIds: [communityId],
    });
    userStore.users.set(anchorUser.userId, anchorUser);

    const { app } = await createTestApp({ userStore });
    apps.push(app);

    const anchorToken = signUser(app, anchorUser);
    const response = await app.inject({
      method: 'GET',
      url: `/v1/admin/review_queue?community_id=${communityId}`,
      headers: { authorization: `Bearer ${anchorToken}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it('rejects malformed review queue cursors with 400s', async () => {
    const userStore = new InMemoryUserStore();
    const anchorUser = createUserRecord({
      userId: '33333333-3333-4333-8333-333333333333',
      level: 'anchor',
      role: 'anchor',
      communityIds: [communityId],
      mfaVerifiedAt: freshMfa,
    });
    userStore.users.set(anchorUser.userId, anchorUser);

    const { app } = await createTestApp({ userStore });
    apps.push(app);

    const anchorToken = signUser(app, anchorUser);
    const response = await app.inject({
      method: 'GET',
      url: `/v1/admin/review_queue?community_id=${communityId}&cursor=abc`,
      headers: { authorization: `Bearer ${anchorToken}` },
    });

    expect(response.statusCode).toBe(400);
  });

  it('rejects review decisions for posts that are not pending review', async () => {
    const userStore = new InMemoryUserStore();
    const verifiedUser = createUserRecord({
      userId: '22222222-2222-4222-8222-222222222222',
      level: 'verified',
      communityIds: [communityId],
    });
    const anchorUser = createUserRecord({
      userId: '33333333-3333-4333-8333-333333333333',
      level: 'anchor',
      role: 'anchor',
      communityIds: [communityId],
      mfaVerifiedAt: freshMfa,
    });
    userStore.users.set(verifiedUser.userId, verifiedUser);
    userStore.users.set(anchorUser.userId, anchorUser);

    const { app } = await createTestApp({ userStore });
    apps.push(app);

    const verifiedToken = signUser(app, verifiedUser);
    const anchorToken = signUser(app, anchorUser);

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
        privacy: 'community_only',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
    });

    expect(createResponse.statusCode).toBe(200);
    expect(createResponse.json().status).toBe('active');

    const decisionResponse = await app.inject({
      method: 'POST',
      url: `/v1/admin/review_queue/${createResponse.json().post_id as string}/decision`,
      headers: { authorization: `Bearer ${anchorToken}` },
      payload: {
        decision: 'approve',
      },
    });

    expect(decisionResponse.statusCode).toBe(400);
  });

  it('rejects malformed post ids for review decisions', async () => {
    const userStore = new InMemoryUserStore();
    const anchorUser = createUserRecord({
      userId: '33333333-3333-4333-8333-333333333333',
      level: 'anchor',
      role: 'anchor',
      communityIds: [communityId],
      mfaVerifiedAt: freshMfa,
    });
    userStore.users.set(anchorUser.userId, anchorUser);

    const { app } = await createTestApp({ userStore });
    apps.push(app);

    const anchorToken = signUser(app, anchorUser);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/admin/review_queue/not-a-uuid/decision',
      headers: { authorization: `Bearer ${anchorToken}` },
      payload: {
        decision: 'approve',
      },
    });

    expect(response.statusCode).toBe(400);
  });
});
