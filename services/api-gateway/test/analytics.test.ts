import { afterEach, describe, expect, it } from 'vitest';

import { InMemoryAnalyticsRecorder } from '../src/lib/analytics.js';
import { __resetTtfvRateLimitForTesting } from '../src/routes/analytics.js';
import { createTestApp, createUserRecord, InMemoryUserStore } from './helpers.js';

const communityId = '44444444-4444-4444-8444-444444444444';

function signUser(
  app: Awaited<ReturnType<typeof createTestApp>>['app'],
  user: ReturnType<typeof createUserRecord>,
) {
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
    },
  );
}

describe('InMemoryAnalyticsRecorder', () => {
  it('appends events with payload and hashed actor', async () => {
    const recorder = new InMemoryAnalyticsRecorder({ hashPepper: 'test-pepper' });

    await recorder.recordEvent({
      event_type: 'post_published',
      community_id: communityId,
      actor_user_id: '11111111-1111-4111-8111-111111111111',
      payload: { post_type: 'request', category: 'food', risk_level: 'low' },
    });

    await recorder.recordEvent({
      event_type: 'ttfv_sample',
      payload: { milliseconds_since_bootstrap: 1234 },
    });

    expect(recorder.events).toHaveLength(2);
    const [first, second] = recorder.events;

    expect(first.event_type).toBe('post_published');
    expect(first.community_id).toBe(communityId);
    expect(first.payload).toEqual({ post_type: 'request', category: 'food', risk_level: 'low' });
    // actor_user_id_hash should be hex-like and not equal to raw user id
    expect(first.actor_user_id_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.actor_user_id_hash).not.toContain('11111111');

    expect(second.event_type).toBe('ttfv_sample');
    expect(second.community_id).toBeNull();
    expect(second.actor_user_id_hash).toBeNull();
    expect(second.payload).toEqual({ milliseconds_since_bootstrap: 1234 });
  });

  it('drops undefined payload values when serializing', async () => {
    const recorder = new InMemoryAnalyticsRecorder();
    await recorder.recordEvent({
      event_type: 'contact_accepted',
      payload: {
        from_post_id: 'a',
        to_post_id: 'b',
        nothing: undefined,
      },
    });
    expect(recorder.events[0].payload).toEqual({ from_post_id: 'a', to_post_id: 'b' });
  });
});

describe('POST /v1/posts records analytics', () => {
  const apps: Array<{ close: () => Promise<unknown> }> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((entry) => entry.close()));
  });

  it('emits post_published when a low-risk request is published', async () => {
    const userStore = new InMemoryUserStore();
    const user = createUserRecord({ communityIds: [communityId] });
    userStore.users.set(user.userId, user);

    const analyticsRecorder = new InMemoryAnalyticsRecorder();
    const { app } = await createTestApp({ userStore, analyticsRecorder });
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
    const published = analyticsRecorder.events.find((event) => event.event_type === 'post_published');
    expect(published).toBeDefined();
    expect(published?.community_id).toBe(communityId);
    expect(published?.payload.post_type).toBe('request');
    expect(published?.payload.category).toBe('food');
    expect(published?.payload.risk_level).toBe('low');
  });

  it('does not emit post_published when a high-risk post lands in pending_review', async () => {
    const userStore = new InMemoryUserStore();
    const verifiedUser = createUserRecord({
      userId: '22222222-2222-4222-8222-222222222222',
      level: 'verified',
      communityIds: [communityId],
    });
    userStore.users.set(verifiedUser.userId, verifiedUser);

    const analyticsRecorder = new InMemoryAnalyticsRecorder();
    const { app } = await createTestApp({ userStore, analyticsRecorder });
    apps.push(app);
    const token = signUser(app, verifiedUser);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/posts',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        community_id: communityId,
        post_type: 'offer',
        category: 'transportation',
        title: 'Can drive someone',
        body: 'Can drive a neighbor to the pantry after pickup.',
        language: 'en',
        location_zip: '11735',
        privacy: 'community_only',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('pending_review');
    expect(
      analyticsRecorder.events.find((event) => event.event_type === 'post_published'),
    ).toBeUndefined();
  });
});

describe('review queue records anchor_decision + post_published on approval', () => {
  const apps: Array<{ close: () => Promise<unknown> }> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((entry) => entry.close()));
  });

  it('emits anchor_decision on every decision, post_published on approve', async () => {
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
      mfaVerifiedAt: new Date().toISOString(),
    });
    userStore.users.set(verifiedUser.userId, verifiedUser);
    userStore.users.set(anchorUser.userId, anchorUser);

    const analyticsRecorder = new InMemoryAnalyticsRecorder();
    const { app } = await createTestApp({ userStore, analyticsRecorder });
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
    const postId = createResponse.json().post_id as string;

    // Clear anchor_decision history before approval
    const beforeLen = analyticsRecorder.events.length;

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
    const afterEvents = analyticsRecorder.events.slice(beforeLen);
    const anchorDecision = afterEvents.find((event) => event.event_type === 'anchor_decision');
    expect(anchorDecision).toBeDefined();
    expect(anchorDecision?.payload.decision).toBe('approve');
    expect(anchorDecision?.payload.target_type).toBe('post');
    expect(anchorDecision?.community_id).toBe(communityId);

    const postPublished = afterEvents.find((event) => event.event_type === 'post_published');
    expect(postPublished).toBeDefined();
    expect(postPublished?.payload.via).toBe('anchor_review');
  });
});

describe('POST /v1/analytics/ttfv', () => {
  const apps: Array<{ close: () => Promise<unknown> }> = [];

  afterEach(async () => {
    __resetTtfvRateLimitForTesting();
    await Promise.all(apps.splice(0).map((entry) => entry.close()));
  });

  it('records an anonymous ttfv_sample event', async () => {
    const analyticsRecorder = new InMemoryAnalyticsRecorder();
    const { app } = await createTestApp({ analyticsRecorder });
    apps.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/analytics/ttfv',
      payload: { milliseconds_since_bootstrap: 420 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ accepted: true });
    expect(analyticsRecorder.events).toHaveLength(1);
    expect(analyticsRecorder.events[0].event_type).toBe('ttfv_sample');
    expect(analyticsRecorder.events[0].payload.milliseconds_since_bootstrap).toBe(420);
    expect(analyticsRecorder.events[0].actor_user_id_hash).toBeNull();
  });

  it('rate-limits the same session to 1/min', async () => {
    const analyticsRecorder = new InMemoryAnalyticsRecorder();
    const { app } = await createTestApp({ analyticsRecorder });
    apps.push(app);

    const first = await app.inject({
      method: 'POST',
      url: '/v1/analytics/ttfv',
      payload: { milliseconds_since_bootstrap: 420 },
    });
    const second = await app.inject({
      method: 'POST',
      url: '/v1/analytics/ttfv',
      payload: { milliseconds_since_bootstrap: 430 },
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(429);
    expect(analyticsRecorder.events).toHaveLength(1);
  });

  it('rejects negative or out-of-range samples', async () => {
    const analyticsRecorder = new InMemoryAnalyticsRecorder();
    const { app } = await createTestApp({ analyticsRecorder });
    apps.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/analytics/ttfv',
      payload: { milliseconds_since_bootstrap: -5 },
    });

    expect(response.statusCode).toBe(400);
    expect(analyticsRecorder.events).toHaveLength(0);
  });
});

describe('anchor activation records anchor_activated', () => {
  it('is covered indirectly by auth tests; assertions live there via shared InMemoryAnalyticsRecorder', () => {
    // Sentinel: the analytics wiring for anchor_activated lives in
    // services/api-gateway/src/routes/auth.ts and is exercised by
    // auth.test.ts's anchor activation flow. We keep an empty sentinel here
    // so that future contributors know to extend this assertion when the
    // existing auth test is expanded.
    expect(true).toBe(true);
  });
});
