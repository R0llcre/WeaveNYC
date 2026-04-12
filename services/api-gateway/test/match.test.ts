import { afterEach, describe, expect, it } from 'vitest';

import { createTestApp, createUserRecord, InMemoryResourceDirectory, InMemoryUserStore } from './helpers.js';

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
    },
  );
}

function futureIso(hours = 24) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

async function createPost(app: Awaited<ReturnType<typeof createTestApp>>['app'], token: string, payload: Record<string, unknown>) {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/posts',
    headers: { authorization: `Bearer ${token}` },
    payload,
  });
  expect(response.statusCode).toBe(200);
  return response.json().post_id as string;
}

describe('match and contact-request routes', () => {
  const apps: Array<{ close: () => Promise<unknown> }> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((entry) => entry.close()));
  });

  it('creates initial batch and only advances one refresh batch', async () => {
    const userStore = new InMemoryUserStore();
    const requester = createUserRecord({
      userId: '11111111-1111-4111-8111-111111111111',
      level: 'verified',
      communityIds: [communityId],
    });
    const helperA = createUserRecord({
      userId: '22222222-2222-4222-8222-222222222222',
      level: 'verified',
      communityIds: [communityId],
    });
    const helperB = createUserRecord({
      userId: '33333333-3333-4333-8333-333333333333',
      level: 'anchor',
      role: 'anchor',
      communityIds: [communityId],
    });
    const helperC = createUserRecord({
      userId: '44444444-4444-4444-8444-444444444444',
      level: 'verified',
      communityIds: [communityId],
    });
    userStore.users.set(requester.userId, requester);
    userStore.users.set(helperA.userId, helperA);
    userStore.users.set(helperB.userId, helperB);
    userStore.users.set(helperC.userId, helperC);

    const { app } = await createTestApp({ userStore });
    apps.push(app);

    const requesterToken = signUser(app, requester);
    const helperAToken = signUser(app, helperA);
    const helperBToken = signUser(app, helperB);
    const helperCToken = signUser(app, helperC);

    const requestPostId = await createPost(app, requesterToken, {
      community_id: communityId,
      post_type: 'request',
      category: 'food',
      title: 'Need dinner',
      body: 'Need dinner tonight.',
      language: 'en',
      location_zip: '11735',
      privacy: 'community_only',
      expires_at: futureIso(),
    });

    const helperAPostId = await createPost(app, helperAToken, {
      community_id: communityId,
      post_type: 'offer',
      category: 'food',
      title: 'Can share groceries',
      body: 'Groceries available tonight.',
      language: 'en',
      location_zip: '11735',
      privacy: 'community_only',
      expires_at: futureIso(),
    });

    const helperBPostId = await createPost(app, helperBToken, {
      community_id: communityId,
      post_type: 'offer',
      category: 'food',
      title: 'Can share pantry staples',
      body: 'Pantry staples ready for pickup.',
      language: 'en',
      location_zip: '11735',
      privacy: 'community_only',
      expires_at: futureIso(),
    });

    const helperCPostId = await createPost(app, helperCToken, {
      community_id: communityId,
      post_type: 'offer',
      category: 'food',
      title: 'Can share snacks',
      body: 'Snacks and canned goods.',
      language: 'es',
      location_zip: '11714',
      privacy: 'community_only',
      expires_at: futureIso(),
    });

    const first = await app.inject({
      method: 'GET',
      url: `/v1/posts/${requestPostId}/matches`,
      headers: { authorization: `Bearer ${requesterToken}` },
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().batch_number).toBe(1);
    expect(first.json().items).toHaveLength(3);
    const firstNeighborIds = new Set(
      (first.json().items as Array<{ candidate_type: string; candidate_id: string }>)
        .filter((item) => item.candidate_type === 'neighbor_post')
        .map((item) => item.candidate_id),
    );
    expect(firstNeighborIds.size).toBeGreaterThan(0);
    expect(firstNeighborIds.has(helperAPostId) || firstNeighborIds.has(helperBPostId) || firstNeighborIds.has(helperCPostId)).toBe(true);

    const second = await app.inject({
      method: 'GET',
      url: `/v1/posts/${requestPostId}/matches?refresh=true`,
      headers: { authorization: `Bearer ${requesterToken}` },
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().batch_number).toBe(2);
    expect(second.json().refreshes_used).toBe(1);
    const secondNeighborIds = new Set(
      (second.json().items as Array<{ candidate_type: string; candidate_id: string }>)
        .filter((item) => item.candidate_type === 'neighbor_post')
        .map((item) => item.candidate_id),
    );
    const staleNeighborId = [...firstNeighborIds].find((candidateId) => !secondNeighborIds.has(candidateId));
    expect(staleNeighborId).toBeTruthy();

    const third = await app.inject({
      method: 'GET',
      url: `/v1/posts/${requestPostId}/matches?refresh=true`,
      headers: { authorization: `Bearer ${requesterToken}` },
    });
    expect(third.statusCode).toBe(200);
    expect(third.json().batch_number).toBe(2);
    expect(third.json().advanced).toBe(false);

    const staleContact = await app.inject({
      method: 'POST',
      url: '/v1/match/contact',
      headers: { authorization: `Bearer ${requesterToken}` },
      payload: {
        from_post_id: requestPostId,
        to_post_id: staleNeighborId,
      },
    });

    expect(staleContact.statusCode).toBe(400);
  });

  it('rejects malformed refresh query values with 400', async () => {
    const userStore = new InMemoryUserStore();
    const requester = createUserRecord({
      userId: '56565656-5656-4565-8565-565656565656',
      level: 'verified',
      communityIds: [communityId],
    });
    userStore.users.set(requester.userId, requester);

    const { app } = await createTestApp({ userStore });
    apps.push(app);

    const requesterToken = signUser(app, requester);
    const requestPostId = await createPost(app, requesterToken, {
      community_id: communityId,
      post_type: 'request',
      category: 'food',
      title: 'Need dinner',
      body: 'Need dinner tonight.',
      language: 'en',
      location_zip: '11735',
      privacy: 'community_only',
      expires_at: futureIso(),
    });

    const response = await app.inject({
      method: 'GET',
      url: `/v1/posts/${requestPostId}/matches?refresh=abc`,
      headers: { authorization: `Bearer ${requesterToken}` },
    });

    expect(response.statusCode).toBe(400);
  });

  it('fails closed when official resource fallback is unavailable', async () => {
    const userStore = new InMemoryUserStore();
    const requester = createUserRecord({
      userId: '57575757-5757-4575-8575-575757575757',
      level: 'verified',
      communityIds: [communityId],
    });
    const helper = createUserRecord({
      userId: '58585858-5858-4585-8585-585858585858',
      level: 'verified',
      communityIds: [communityId],
    });
    userStore.users.set(requester.userId, requester);
    userStore.users.set(helper.userId, helper);

    const { app } = await createTestApp({
      userStore,
      resourceDirectory: new InMemoryResourceDirectory([]),
    });
    apps.push(app);

    const requesterToken = signUser(app, requester);
    const helperToken = signUser(app, helper);

    const requestPostId = await createPost(app, requesterToken, {
      community_id: communityId,
      post_type: 'request',
      category: 'food',
      title: 'Need dinner',
      body: 'Need dinner tonight.',
      language: 'en',
      location_zip: '11735',
      privacy: 'community_only',
      expires_at: futureIso(),
    });

    await createPost(app, helperToken, {
      community_id: communityId,
      post_type: 'offer',
      category: 'food',
      title: 'Can share groceries',
      body: 'Groceries available tonight.',
      language: 'en',
      location_zip: '11735',
      privacy: 'community_only',
      expires_at: futureIso(),
    });

    const response = await app.inject({
      method: 'GET',
      url: `/v1/posts/${requestPostId}/matches`,
      headers: { authorization: `Bearer ${requesterToken}` },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain('Official resource fallback');
  });

  it('rejects anonymous contact requests even when a match exists', async () => {
    const userStore = new InMemoryUserStore();
    const requester = createUserRecord({
      userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      level: 'anonymous',
      communityIds: [communityId],
    });
    const helper = createUserRecord({
      userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      level: 'verified',
      communityIds: [communityId],
    });
    userStore.users.set(requester.userId, requester);
    userStore.users.set(helper.userId, helper);

    const { app } = await createTestApp({ userStore });
    apps.push(app);

    const requesterToken = signUser(app, requester);
    const helperToken = signUser(app, helper);

    const requestPostId = await createPost(app, requesterToken, {
      community_id: communityId,
      post_type: 'request',
      category: 'goods',
      title: 'Need a stroller',
      body: 'Need one for this week.',
      language: 'en',
      location_zip: '11735',
      privacy: 'community_only',
      expires_at: futureIso(),
    });

    const offerPostId = await createPost(app, helperToken, {
      community_id: communityId,
      post_type: 'offer',
      category: 'goods',
      title: 'Can share a stroller',
      body: 'Available now.',
      language: 'en',
      location_zip: '11735',
      privacy: 'community_only',
      expires_at: futureIso(),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/match/contact',
      headers: { authorization: `Bearer ${requesterToken}` },
      payload: {
        from_post_id: requestPostId,
        to_post_id: offerPostId,
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it('creates pending contact requests idempotently and accepts into one active conversation', async () => {
    const userStore = new InMemoryUserStore();
    const requester = createUserRecord({
      userId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      level: 'verified',
      communityIds: [communityId],
    });
    const helper = createUserRecord({
      userId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      level: 'verified',
      communityIds: [communityId],
    });
    userStore.users.set(requester.userId, requester);
    userStore.users.set(helper.userId, helper);

    const { app } = await createTestApp({ userStore });
    apps.push(app);

    const requesterToken = signUser(app, requester);
    const helperToken = signUser(app, helper);

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

    const offerPostId = await createPost(app, helperToken, {
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

    const firstContact = await app.inject({
      method: 'POST',
      url: '/v1/match/contact',
      headers: { authorization: `Bearer ${requesterToken}` },
      payload: {
        from_post_id: requestPostId,
        to_post_id: offerPostId,
      },
    });
    expect(firstContact.statusCode).toBe(200);

    const secondContact = await app.inject({
      method: 'POST',
      url: '/v1/match/contact',
      headers: { authorization: `Bearer ${requesterToken}` },
      payload: {
        from_post_id: requestPostId,
        to_post_id: offerPostId,
      },
    });
    expect(secondContact.statusCode).toBe(200);
    expect(secondContact.json().contact_request_id).toBe(firstContact.json().contact_request_id);

    const inbox = await app.inject({
      method: 'GET',
      url: '/v1/contact-requests/inbox',
      headers: { authorization: `Bearer ${helperToken}` },
    });
    expect(inbox.statusCode).toBe(200);
    expect(inbox.json().items).toHaveLength(1);

    const accepted = await app.inject({
      method: 'POST',
      url: `/v1/contact-requests/${firstContact.json().contact_request_id as string}/accept`,
      headers: { authorization: `Bearer ${helperToken}` },
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().conversation_id).toBeTruthy();

    const acceptedAgain = await app.inject({
      method: 'POST',
      url: `/v1/contact-requests/${firstContact.json().contact_request_id as string}/accept`,
      headers: { authorization: `Bearer ${helperToken}` },
    });
    expect(acceptedAgain.statusCode).toBe(200);
    expect(acceptedAgain.json().conversation_id).toBe(accepted.json().conversation_id);

    const conversation = await app.inject({
      method: 'GET',
      url: `/v1/conversations/${accepted.json().conversation_id as string}`,
      headers: { authorization: `Bearer ${requesterToken}` },
    });
    expect(conversation.statusCode).toBe(200);
    expect(conversation.json().status).toBe('active');
  });

  it('reuses an existing contact request after refresh rotates that match out of the current batch', async () => {
    const userStore = new InMemoryUserStore();
    const requester = createUserRecord({
      userId: 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
      level: 'verified',
      communityIds: [communityId],
    });
    const helperA = createUserRecord({
      userId: 'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2',
      level: 'verified',
      communityIds: [communityId],
    });
    const helperB = createUserRecord({
      userId: 'c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c3c3',
      level: 'verified',
      communityIds: [communityId],
    });
    const helperC = createUserRecord({
      userId: 'c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4',
      level: 'verified',
      communityIds: [communityId],
    });
    userStore.users.set(requester.userId, requester);
    userStore.users.set(helperA.userId, helperA);
    userStore.users.set(helperB.userId, helperB);
    userStore.users.set(helperC.userId, helperC);

    const { app } = await createTestApp({ userStore });
    apps.push(app);

    const requesterToken = signUser(app, requester);
    const helperAToken = signUser(app, helperA);
    const helperBToken = signUser(app, helperB);
    const helperCToken = signUser(app, helperC);

    const requestPostId = await createPost(app, requesterToken, {
      community_id: communityId,
      post_type: 'request',
      category: 'food',
      title: 'Need dinner',
      body: 'Need dinner tonight.',
      language: 'en',
      location_zip: '11735',
      privacy: 'community_only',
      expires_at: futureIso(),
    });

    await createPost(app, helperAToken, {
      community_id: communityId,
      post_type: 'offer',
      category: 'food',
      title: 'Can share groceries',
      body: 'Groceries available tonight.',
      language: 'en',
      location_zip: '11735',
      privacy: 'community_only',
      expires_at: futureIso(),
    });

    await createPost(app, helperBToken, {
      community_id: communityId,
      post_type: 'offer',
      category: 'food',
      title: 'Can share pantry staples',
      body: 'Pantry staples ready for pickup.',
      language: 'en',
      location_zip: '11735',
      privacy: 'community_only',
      expires_at: futureIso(),
    });

    await createPost(app, helperCToken, {
      community_id: communityId,
      post_type: 'offer',
      category: 'food',
      title: 'Can share snacks',
      body: 'Snacks and canned goods.',
      language: 'es',
      location_zip: '11714',
      privacy: 'community_only',
      expires_at: futureIso(),
    });

    const firstMatches = await app.inject({
      method: 'GET',
      url: `/v1/posts/${requestPostId}/matches`,
      headers: { authorization: `Bearer ${requesterToken}` },
    });
    expect(firstMatches.statusCode).toBe(200);
    const firstNeighborId = (firstMatches.json().items as Array<{ candidate_type: string; candidate_id: string }>)
      .find((item) => item.candidate_type === 'neighbor_post')?.candidate_id;
    expect(firstNeighborId).toBeTruthy();

    const firstContact = await app.inject({
      method: 'POST',
      url: '/v1/match/contact',
      headers: { authorization: `Bearer ${requesterToken}` },
      payload: {
        from_post_id: requestPostId,
        to_post_id: firstNeighborId,
      },
    });
    expect(firstContact.statusCode).toBe(200);

    const refreshed = await app.inject({
      method: 'GET',
      url: `/v1/posts/${requestPostId}/matches?refresh=true`,
      headers: { authorization: `Bearer ${requesterToken}` },
    });
    expect(refreshed.statusCode).toBe(200);
    expect(
      (refreshed.json().items as Array<{ candidate_id: string }>).some((item) => item.candidate_id === firstNeighborId),
    ).toBe(false);

    const replayed = await app.inject({
      method: 'POST',
      url: '/v1/match/contact',
      headers: { authorization: `Bearer ${requesterToken}` },
      payload: {
        from_post_id: requestPostId,
        to_post_id: firstNeighborId,
      },
    });
    expect(replayed.statusCode).toBe(200);
    expect(replayed.json().contact_request_id).toBe(firstContact.json().contact_request_id);
    expect(replayed.json().status).toBe('pending');
  });

  it('rejects contact requests idempotently and blocks conversation access for non-participants', async () => {
    const userStore = new InMemoryUserStore();
    const requester = createUserRecord({
      userId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      level: 'verified',
      communityIds: [communityId],
    });
    const helper = createUserRecord({
      userId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      level: 'verified',
      communityIds: [communityId],
    });
    const stranger = createUserRecord({
      userId: '12121212-1212-4212-8212-121212121212',
      level: 'verified',
      communityIds: [communityId],
    });
    userStore.users.set(requester.userId, requester);
    userStore.users.set(helper.userId, helper);
    userStore.users.set(stranger.userId, stranger);

    const { app } = await createTestApp({ userStore });
    apps.push(app);

    const requesterToken = signUser(app, requester);
    const helperToken = signUser(app, helper);
    const strangerToken = signUser(app, stranger);

    const requestPostId = await createPost(app, requesterToken, {
      community_id: communityId,
      post_type: 'request',
      category: 'translation',
      title: 'Need translation help',
      body: 'Need Spanish interpretation.',
      language: 'es',
      location_zip: '11735',
      privacy: 'community_only',
      expires_at: futureIso(),
    });

    const offerPostId = await createPost(app, helperToken, {
      community_id: communityId,
      post_type: 'offer',
      category: 'translation',
      title: 'Can interpret in Spanish',
      body: 'Happy to help.',
      language: 'es',
      location_zip: '11735',
      privacy: 'community_only',
      expires_at: futureIso(),
    });

    const contact = await app.inject({
      method: 'POST',
      url: '/v1/match/contact',
      headers: { authorization: `Bearer ${requesterToken}` },
      payload: {
        from_post_id: requestPostId,
        to_post_id: offerPostId,
      },
    });
    const contactRequestId = contact.json().contact_request_id as string;

    const strangerAccept = await app.inject({
      method: 'POST',
      url: `/v1/contact-requests/${contactRequestId}/accept`,
      headers: { authorization: `Bearer ${strangerToken}` },
    });
    expect(strangerAccept.statusCode).toBe(403);

    const strangerReject = await app.inject({
      method: 'POST',
      url: `/v1/contact-requests/${contactRequestId}/reject`,
      headers: { authorization: `Bearer ${strangerToken}` },
    });
    expect(strangerReject.statusCode).toBe(403);

    const rejected = await app.inject({
      method: 'POST',
      url: `/v1/contact-requests/${contactRequestId}/reject`,
      headers: { authorization: `Bearer ${helperToken}` },
    });
    expect(rejected.statusCode).toBe(200);
    expect(rejected.json().status).toBe('rejected');

    const rejectedAgain = await app.inject({
      method: 'POST',
      url: `/v1/contact-requests/${contactRequestId}/reject`,
      headers: { authorization: `Bearer ${helperToken}` },
    });
    expect(rejectedAgain.statusCode).toBe(200);
    expect(rejectedAgain.json().status).toBe('rejected');

    const secondContact = await app.inject({
      method: 'POST',
      url: '/v1/match/contact',
      headers: { authorization: `Bearer ${requesterToken}` },
      payload: {
        from_post_id: requestPostId,
        to_post_id: offerPostId,
      },
    });
    expect(secondContact.statusCode).toBe(200);

    const accepted = await app.inject({
      method: 'POST',
      url: `/v1/contact-requests/${secondContact.json().contact_request_id as string}/accept`,
      headers: { authorization: `Bearer ${helperToken}` },
    });
    expect(accepted.statusCode).toBe(200);

    const conversation = await app.inject({
      method: 'GET',
      url: `/v1/conversations/${accepted.json().conversation_id as string}`,
      headers: { authorization: `Bearer ${strangerToken}` },
    });
    expect(conversation.statusCode).toBe(403);
  });
});
