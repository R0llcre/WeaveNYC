import { afterEach, describe, expect, it } from 'vitest';

import { createTestApp, createUserRecord, InMemoryAnalyticsRecorder, InMemoryUserStore } from './helpers.js';

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

function futureIso(hours = 24) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

async function createPost(
  app: Awaited<ReturnType<typeof createTestApp>>['app'],
  token: string,
  payload: Record<string, unknown>,
) {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/posts',
    headers: { authorization: `Bearer ${token}` },
    payload,
  });
  expect(response.statusCode).toBe(200);
  return response.json().post_id as string;
}

describe('POST /v1/contact-requests/:id/accept', () => {
  const apps: Array<{ close: () => Promise<unknown> }> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((entry) => entry.close()));
  });

  it('re-accept does NOT inflate the verified_matches_total metric (A3 P0-1)', async () => {
    // Full flow: requester files a contact request, recipient accepts
    // twice. The first accept should fire the
    // `verified_match_created` + `contact_accepted` analytics events AND
    // bump `verified_matches_total`; the second (idempotent replay) must
    // not re-fire either.
    const userStore = new InMemoryUserStore();
    const requester = createUserRecord({
      userId: '11111111-1111-4111-8111-111111111111',
      level: 'verified',
      communityIds: [communityId],
    });
    const recipient = createUserRecord({
      userId: '22222222-2222-4222-8222-222222222222',
      level: 'verified',
      communityIds: [communityId],
    });
    userStore.users.set(requester.userId, requester);
    userStore.users.set(recipient.userId, recipient);

    const analyticsRecorder = new InMemoryAnalyticsRecorder();
    const { app } = await createTestApp({ userStore, analyticsRecorder });
    apps.push(app);

    const requesterToken = signUser(app, requester);
    const recipientToken = signUser(app, recipient);

    const requestPostId = await createPost(app, requesterToken, {
      community_id: communityId,
      post_type: 'request',
      category: 'food',
      title: 'Need groceries',
      body: 'Need groceries for tonight.',
      language: 'en',
      location_zip: '11735',
      privacy: 'community_only',
      expires_at: futureIso(),
    });

    const offerPostId = await createPost(app, recipientToken, {
      community_id: communityId,
      post_type: 'offer',
      category: 'food',
      title: 'Can share groceries',
      body: 'Available after 6pm.',
      language: 'en',
      location_zip: '11735',
      privacy: 'community_only',
      expires_at: futureIso(),
    });

    const contactResponse = await app.inject({
      method: 'POST',
      url: '/v1/match/contact',
      headers: { authorization: `Bearer ${requesterToken}` },
      payload: {
        from_post_id: requestPostId,
        to_post_id: offerPostId,
      },
    });
    expect(contactResponse.statusCode).toBe(200);
    const contactRequestId = contactResponse.json().contact_request_id as string;

    const beforeMetric = await app.metrics.verifiedMatchesTotal
      .get()
      .then((snapshot) => snapshot.values[0]?.value ?? 0);

    const firstAccept = await app.inject({
      method: 'POST',
      url: `/v1/contact-requests/${contactRequestId}/accept`,
      headers: { authorization: `Bearer ${recipientToken}` },
    });
    expect(firstAccept.statusCode).toBe(200);
    expect(firstAccept.json().conversation_id).toBeTruthy();
    // HTTP response must not leak the internal is_new_accept flag.
    expect(firstAccept.json()).not.toHaveProperty('is_new_accept');

    const afterFirstMetric = await app.metrics.verifiedMatchesTotal
      .get()
      .then((snapshot) => snapshot.values[0]?.value ?? 0);
    expect(afterFirstMetric - beforeMetric).toBe(1);

    const firstAnalyticsTypes = analyticsRecorder.events.map((event) => event.event_type);
    expect(firstAnalyticsTypes).toContain('contact_accepted');
    expect(firstAnalyticsTypes).toContain('verified_match_created');

    const firstVerifiedEvents = analyticsRecorder.events.filter(
      (event) => event.event_type === 'verified_match_created',
    );
    expect(firstVerifiedEvents).toHaveLength(1);

    // Second accept (idempotent replay). Same payload, same
    // conversation_id, but MUST NOT increment the metric or re-emit
    // analytics — that would double-count verified matches in dashboards.
    const secondAccept = await app.inject({
      method: 'POST',
      url: `/v1/contact-requests/${contactRequestId}/accept`,
      headers: { authorization: `Bearer ${recipientToken}` },
    });
    expect(secondAccept.statusCode).toBe(200);
    expect(secondAccept.json().conversation_id).toBe(firstAccept.json().conversation_id);
    expect(secondAccept.json().status).toBe('accepted');

    const afterSecondMetric = await app.metrics.verifiedMatchesTotal
      .get()
      .then((snapshot) => snapshot.values[0]?.value ?? 0);
    expect(afterSecondMetric).toBe(afterFirstMetric);

    const verifiedEventsAfterReplay = analyticsRecorder.events.filter(
      (event) => event.event_type === 'verified_match_created',
    );
    expect(verifiedEventsAfterReplay).toHaveLength(1);
  });

  it('serves HTTP idempotency replays from the store without re-running the handler', async () => {
    // When the caller sends the same `Idempotency-Key` twice, the second
    // call returns the stored response verbatim plus an
    // `idempotent-replay` header. The handler only runs once (so analytics
    // / metrics only fire once).
    const userStore = new InMemoryUserStore();
    const requester = createUserRecord({
      userId: '33333333-3333-4333-8333-333333333333',
      level: 'verified',
      communityIds: [communityId],
    });
    const recipient = createUserRecord({
      userId: '44444444-4444-4444-8444-444444444444',
      level: 'verified',
      communityIds: [communityId],
    });
    userStore.users.set(requester.userId, requester);
    userStore.users.set(recipient.userId, recipient);

    const { app } = await createTestApp({ userStore });
    apps.push(app);

    const requesterToken = signUser(app, requester);

    const idempotencyKey = 'test-composer-publish-0001';
    const payload = {
      community_id: communityId,
      post_type: 'request',
      category: 'food',
      title: 'Idempotent',
      body: 'Twice sent, once stored.',
      language: 'en',
      location_zip: '11735',
      privacy: 'community_only',
      expires_at: futureIso(),
    };

    const first = await app.inject({
      method: 'POST',
      url: '/v1/posts',
      headers: {
        authorization: `Bearer ${requesterToken}`,
        'idempotency-key': idempotencyKey,
      },
      payload,
    });
    expect(first.statusCode).toBe(200);
    const firstPostId = first.json().post_id as string;

    const second = await app.inject({
      method: 'POST',
      url: '/v1/posts',
      headers: {
        authorization: `Bearer ${requesterToken}`,
        'idempotency-key': idempotencyKey,
      },
      payload,
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().post_id).toBe(firstPostId);
    expect(second.headers['idempotent-replay']).toBe('true');

    // A third call WITHOUT the header creates a fresh post. This locks in
    // the opt-in semantics — legacy clients that don't send the header
    // must still see normal write behaviour.
    const third = await app.inject({
      method: 'POST',
      url: '/v1/posts',
      headers: {
        authorization: `Bearer ${requesterToken}`,
      },
      payload,
    });
    expect(third.statusCode).toBe(200);
    expect(third.json().post_id).not.toBe(firstPostId);
  });
});
