import { WebSocket } from 'ws';
import { afterEach, describe, expect, it } from 'vitest';

import type { PostRecord } from '@weavenyc/posts';
import { InMemoryChatRealtimeHub } from '../src/lib/chat-realtime.js';
import { createTestApp, createUserRecord, InMemoryUserStore } from './helpers.js';

const communityId = '44444444-4444-4444-8444-444444444444';
const conversationId = '77777777-7777-4777-8777-777777777777';
const contactRequestId = '88888888-8888-4888-8888-888888888888';
const relatedPostId = '99999999-9999-4999-8999-999999999999';
const requesterId = '11111111-1111-4111-8111-111111111111';
const recipientId = '22222222-2222-4222-8222-222222222222';

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
    },
  );
}

describe('chat routes', () => {
  const apps: Array<{ close: () => Promise<unknown> }> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((entry) => entry.close()));
  });

  async function createChatFixture() {
    const userStore = new InMemoryUserStore();
    const requester = createUserRecord({
      userId: requesterId,
      level: 'verified',
      communityIds: [communityId],
    });
    const recipient = createUserRecord({
      userId: recipientId,
      level: 'verified',
      communityIds: [communityId],
    });
    userStore.users.set(requester.userId, requester);
    userStore.users.set(recipient.userId, recipient);

    const testApp = await createTestApp({ userStore });
    apps.push(testApp.app);

    testApp.chatRepository.seedConversation({
      conversation_id: conversationId,
      contact_request_id: contactRequestId,
      participant_user_ids: [requesterId, recipientId],
      participant_preview: [
        { user_id: requesterId, alias: 'Requester' },
        { user_id: recipientId, alias: 'Recipient' },
      ],
      related_post_ids: ['99999999-9999-4999-8999-999999999999'],
      status: 'active',
      created_at: '2026-04-10T12:00:00.000Z',
      last_activity_at: '2026-04-10T12:05:00.000Z',
      closed_at: null,
      blocked_at: null,
      blocked_by_user_id: null,
      last_message_preview: 'Can we meet tomorrow morning?',
      last_message_at: '2026-04-10T12:05:00.000Z',
      unread_count: 1,
    });
    testApp.postsService.posts.set(relatedPostId, {
      postId: relatedPostId,
      communityId,
      postType: 'request',
      category: 'food',
      title: 'Need pantry pickup',
      body: 'Looking for help with pantry pickup.',
      language: 'en',
      locationZip: '11735',
      privacy: 'community_only',
      status: 'active',
      riskLevel: 'low',
      expiresAt: '2026-04-11T12:00:00.000Z',
      createdAt: '2026-04-10T12:00:00.000Z',
      updatedAt: '2026-04-10T12:00:00.000Z',
      createdBy: requesterId,
      contactPref: null,
    } satisfies PostRecord);
    testApp.chatRepository.seedMessage({
      message_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      conversation_id: conversationId,
      sender_user_id: recipientId,
      body: 'Can we meet tomorrow morning?',
      safety_flags: [],
      sent_at: '2026-04-10T12:05:00.000Z',
    });

    return {
      ...testApp,
      requesterToken: signUser(testApp.app, requester),
      recipientToken: signUser(testApp.app, recipient),
    };
  }

  it('lists conversations and returns conversation detail/messages', async () => {
    const { app, requesterToken } = await createChatFixture();

    const listResponse = await app.inject({
      method: 'GET',
      url: '/v1/conversations',
      headers: { authorization: `Bearer ${requesterToken}` },
    });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().items).toHaveLength(1);
    expect(listResponse.json().items[0].conversation_id).toBe(conversationId);

    const detailResponse = await app.inject({
      method: 'GET',
      url: `/v1/conversations/${conversationId}`,
      headers: { authorization: `Bearer ${requesterToken}` },
    });
    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json().other_user_id).toBe(recipientId);

    const messagesResponse = await app.inject({
      method: 'GET',
      url: `/v1/conversations/${conversationId}/messages`,
      headers: { authorization: `Bearer ${requesterToken}` },
    });
    expect(messagesResponse.statusCode).toBe(200);
    expect(messagesResponse.json().items[0].sender_alias).toBe('Recipient');
    expect(messagesResponse.json().items[0].is_mine).toBe(false);
  });

  it('sends a message and publishes websocket events', async () => {
    const { app, chatRealtimeHub, requesterToken } = await createChatFixture();
    const realtimeHub = chatRealtimeHub as InMemoryChatRealtimeHub;

    const response = await app.inject({
      method: 'POST',
      url: `/v1/conversations/${conversationId}/messages`,
      headers: { authorization: `Bearer ${requesterToken}` },
      payload: {
        body: 'I can meet at the library at 3pm.',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().message.is_mine).toBe(true);
    expect(realtimeHub.publishedEvents).toHaveLength(4);
    const messageEvents = realtimeHub.publishedEvents.filter(
      (entry): entry is (typeof realtimeHub.publishedEvents)[number] & { event: { event_type: 'message.created'; message: { is_mine: boolean } } } =>
        entry.event.event_type === 'message.created',
    );
    const conversationEvents = realtimeHub.publishedEvents.filter(
      (entry): entry is (typeof realtimeHub.publishedEvents)[number] & { event: { event_type: 'conversation.updated'; conversation: { unread_count: number } } } =>
        entry.event.event_type === 'conversation.updated',
    );
    expect(messageEvents).toHaveLength(2);
    expect(conversationEvents).toHaveLength(2);
    expect(messageEvents[0]?.userIds).toEqual([requesterId]);
    expect(messageEvents[0]?.event.message.is_mine).toBe(true);
    expect(messageEvents[1]?.userIds).toEqual([recipientId]);
    expect(messageEvents[1]?.event.message.is_mine).toBe(false);
    const recipientConversationEvent = conversationEvents.find((entry) => entry.userIds[0] === recipientId);
    expect(recipientConversationEvent?.event.conversation.unread_count).toBe(1);
  });

  it('blocks sensitive messages before delivery', async () => {
    const { app, requesterToken } = await createChatFixture();

    const response = await app.inject({
      method: 'POST',
      url: `/v1/conversations/${conversationId}/messages`,
      headers: { authorization: `Bearer ${requesterToken}` },
      payload: {
        body: 'My SSN is 123-45-6789.',
      },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().blocked).toBe(true);
    expect(response.json().safety_flags).toContain('sensitive_ssn');
  });

  it('rejects websocket attachment for suspended users', async () => {
    const { app, requesterToken, userStore } = await createChatFixture();
    const requester = (userStore as InMemoryUserStore).users.get(requesterId);
    if (!requester) {
      throw new Error('expected requester fixture');
    }
    requester.status = 'suspended';

    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('expected a bound server address');
    }

    const socket = new WebSocket(
      `ws://127.0.0.1:${address.port}/v1/ws/chat?token=${encodeURIComponent(requesterToken)}`,
      // F4-A Fix #3: handshake requires an allow-listed Origin before
      // the JWT is evaluated. `http://localhost:*` is in the test
      // config allow-list so this test — which asserts the "Inactive
      // user" close reason — still exercises that downstream branch.
      { origin: 'http://localhost:3000' },
    );
    const closeEvent = await new Promise<{ code: number; reason: string }>((resolve, reject) => {
      socket.once('close', (code: number, reason: Buffer) =>
        resolve({ code, reason: reason.toString() }),
      );
      socket.once('error', () => reject(new Error('expected websocket close event')));
    });

    expect(closeEvent.code).toBe(1008);
    expect(closeEvent.reason).toBe('Inactive user');
  });

  it('blocks the other user across all shared conversations and prevents future reads', async () => {
    const { app, chatRealtimeHub, chatRepository, requesterToken } = await createChatFixture();
    const realtimeHub = chatRealtimeHub as InMemoryChatRealtimeHub;
    const secondConversationId = '66666666-6666-4666-8666-666666666666';
    chatRepository.seedConversation({
      conversation_id: secondConversationId,
      contact_request_id: '55555555-5555-4555-8555-555555555555',
      participant_user_ids: [requesterId, recipientId],
      participant_preview: [
        { user_id: requesterId, alias: 'Requester' },
        { user_id: recipientId, alias: 'Recipient' },
      ],
      related_post_ids: ['44444444-4444-4444-8444-444444444444'],
      status: 'active',
      created_at: '2026-04-10T11:00:00.000Z',
      last_activity_at: '2026-04-10T11:30:00.000Z',
      closed_at: null,
      blocked_at: null,
      blocked_by_user_id: null,
      last_message_preview: 'Backup thread',
      last_message_at: '2026-04-10T11:30:00.000Z',
      unread_count: 0,
    });

    const blockResponse = await app.inject({
      method: 'POST',
      url: '/v1/blocks',
      headers: { authorization: `Bearer ${requesterToken}` },
      payload: {
        blocked_user_id: recipientId,
        conversation_id: conversationId,
      },
    });

    expect(blockResponse.statusCode).toBe(200);
    expect(blockResponse.json().status).toBe('blocked');
    expect(blockResponse.json().affected_conversation_ids).toEqual(
      expect.arrayContaining([conversationId, secondConversationId]),
    );
    const repeatedBlockResponse = await app.inject({
      method: 'POST',
      url: '/v1/blocks',
      headers: { authorization: `Bearer ${requesterToken}` },
      payload: {
        blocked_user_id: recipientId,
        conversation_id: conversationId,
      },
    });
    expect(repeatedBlockResponse.statusCode).toBe(200);
    expect(repeatedBlockResponse.json().status).toBe('blocked');
    expect(repeatedBlockResponse.json().affected_conversation_ids).toEqual(
      expect.arrayContaining([conversationId, secondConversationId]),
    );

    const detailResponse = await app.inject({
      method: 'GET',
      url: `/v1/conversations/${conversationId}`,
      headers: { authorization: `Bearer ${requesterToken}` },
    });

    expect(detailResponse.statusCode).toBe(409);
    const secondDetailResponse = await app.inject({
      method: 'GET',
      url: `/v1/conversations/${secondConversationId}`,
      headers: { authorization: `Bearer ${requesterToken}` },
    });
    expect(secondDetailResponse.statusCode).toBe(409);
    const blockedUpdates = realtimeHub.publishedEvents.filter(
      (entry): entry is (typeof realtimeHub.publishedEvents)[number] & {
        event: { event_type: 'conversation.updated'; conversation: { conversation_id: string; status: string } };
      } => entry.event.event_type === 'conversation.updated',
    );
    expect(blockedUpdates).toHaveLength(4);
    expect(
      blockedUpdates.filter((entry) => entry.event.conversation.conversation_id === conversationId),
    ).toHaveLength(2);
    expect(
      blockedUpdates.filter((entry) => entry.event.conversation.conversation_id === secondConversationId),
    ).toHaveLength(2);
    expect(blockedUpdates.every((entry) => entry.event.conversation.status === 'blocked')).toBe(true);
  });

  it('creates a report for a message inside the conversation', async () => {
    const { app, chatRepository, requesterToken } = await createChatFixture();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/reports',
      headers: { authorization: `Bearer ${requesterToken}` },
      payload: {
        target_type: 'message',
        target_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        reason: 'unsafe_behavior',
        conversation_id: conversationId,
        evidence_description: 'Asking for unsafe meetup details.',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('new');
    expect(Array.from(chatRepository.reports.values()).at(-1)).toMatchObject({
      target_type: 'message',
      community_id: communityId,
      reporter_user_id: requesterId,
    });
  });

  it('creates a broad report without conversation context and links the community', async () => {
    const { app, chatRepository, requesterToken } = await createChatFixture();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/reports',
      headers: { authorization: `Bearer ${requesterToken}` },
      payload: {
        target_type: 'post',
        target_id: relatedPostId,
        reason: 'other',
        evidence_description: 'Needs moderator review.',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('new');
    expect(Array.from(chatRepository.reports.values()).at(-1)).toMatchObject({
      target_type: 'post',
      target_id: relatedPostId,
      community_id: communityId,
      reporter_user_id: requesterId,
    });
  });

  it('creates a user report without conversation context when the community is unambiguous', async () => {
    const { app, chatRepository, requesterToken } = await createChatFixture();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/reports',
      headers: { authorization: `Bearer ${requesterToken}` },
      payload: {
        target_type: 'user',
        target_id: recipientId,
        reason: 'harassment',
        evidence_description: 'Unsafe coordination outside the app.',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('new');
    expect(Array.from(chatRepository.reports.values()).at(-1)).toMatchObject({
      target_type: 'user',
      target_id: recipientId,
      community_id: communityId,
      reporter_user_id: requesterId,
    });
  });

  it('allows reporting a blocked conversation when the target context remains valid', async () => {
    const { app, chatRepository, requesterToken } = await createChatFixture();

    const blockResponse = await app.inject({
      method: 'POST',
      url: '/v1/blocks',
      headers: { authorization: `Bearer ${requesterToken}` },
      payload: {
        blocked_user_id: recipientId,
        conversation_id: conversationId,
      },
    });

    expect(blockResponse.statusCode).toBe(200);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/reports',
      headers: { authorization: `Bearer ${requesterToken}` },
      payload: {
        target_type: 'message',
        target_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        reason: 'unsafe_behavior',
        conversation_id: conversationId,
        evidence_description: 'Asking for unsafe meetup details after a block.',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('new');
    expect(Array.from(chatRepository.reports.values()).at(-1)).toMatchObject({
      target_type: 'message',
      target_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      community_id: communityId,
      reporter_user_id: requesterId,
    });
  });

  it('closes a conversation through the API and broadcasts the updated state', async () => {
    const { app, chatRealtimeHub, requesterToken } = await createChatFixture();
    const realtimeHub = chatRealtimeHub as InMemoryChatRealtimeHub;

    const response = await app.inject({
      method: 'POST',
      url: `/v1/conversations/${conversationId}/close`,
      headers: { authorization: `Bearer ${requesterToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('closed');
    const detailResponse = await app.inject({
      method: 'GET',
      url: `/v1/conversations/${conversationId}`,
      headers: { authorization: `Bearer ${requesterToken}` },
    });
    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json().status).toBe('closed');
    expect(realtimeHub.publishedEvents.filter((entry) => entry.event.event_type === 'conversation.updated')).toHaveLength(2);
  });

  it('dedupes a duplicate chat send via client_message_id at the DB layer (A2 P0-4)', async () => {
    // Even without `Idempotency-Key` on the HTTP envelope, the same
    // `client_message_id` from the same sender collapses to a single row.
    // This is the second line of defense behind the HTTP-layer cache:
    // the cache entry can age out, but the `uq_messages_client_dedup`
    // index still prevents duplicate submissions.
    const { app, chatRepository, requesterToken } = await createChatFixture();

    const payload = {
      body: 'Can I bring my kid?',
      client_message_id: 'composer-tap-42',
    };

    const first = await app.inject({
      method: 'POST',
      url: `/v1/conversations/${conversationId}/messages`,
      headers: { authorization: `Bearer ${requesterToken}` },
      payload,
    });
    expect(first.statusCode).toBe(200);
    const firstMessageId = first.json().message.message_id as string;

    const second = await app.inject({
      method: 'POST',
      url: `/v1/conversations/${conversationId}/messages`,
      headers: { authorization: `Bearer ${requesterToken}` },
      payload,
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().message.message_id).toBe(firstMessageId);

    // And the repository actually has one row, not two — proving dedup
    // landed at the data layer.
    const rows = Array.from(chatRepository.messages.values()).filter(
      (row) => row.conversation_id === conversationId && row.sender_user_id === requesterId,
    );
    expect(rows).toHaveLength(1);
  });

  it('replays the same send response when Idempotency-Key is reused (A7 P0-4)', async () => {
    const { app, chatRepository, requesterToken } = await createChatFixture();

    const headers = {
      authorization: `Bearer ${requesterToken}`,
      'idempotency-key': 'send-retry-key-1',
    };
    const payload = {
      body: 'I can meet at 3pm.',
      client_message_id: 'cap-send-retry-1',
    };

    const first = await app.inject({
      method: 'POST',
      url: `/v1/conversations/${conversationId}/messages`,
      headers,
      payload,
    });
    expect(first.statusCode).toBe(200);

    const retry = await app.inject({
      method: 'POST',
      url: `/v1/conversations/${conversationId}/messages`,
      headers,
      payload,
    });
    expect(retry.statusCode).toBe(200);
    expect(retry.headers['idempotent-replay']).toBe('true');
    expect(retry.json().message.message_id).toBe(first.json().message.message_id);

    const ownedMessages = Array.from(chatRepository.messages.values()).filter(
      (row) => row.sender_user_id === requesterId && row.conversation_id === conversationId,
    );
    expect(ownedMessages).toHaveLength(1);
  });

  it('replays the same report response when Idempotency-Key is reused (A7 P0-3)', async () => {
    const { app, chatRepository, requesterToken } = await createChatFixture();

    const headers = {
      authorization: `Bearer ${requesterToken}`,
      'idempotency-key': 'report-tap-1',
    };
    const payload = {
      target_type: 'post' as const,
      target_id: relatedPostId,
      reason: 'misinformation' as const,
      evidence_description: 'Double-tap of the same report button.',
    };

    const first = await app.inject({
      method: 'POST',
      url: '/v1/reports',
      headers,
      payload,
    });
    expect(first.statusCode).toBe(200);
    const reportId = first.json().report_id as string;

    const retry = await app.inject({
      method: 'POST',
      url: '/v1/reports',
      headers,
      payload,
    });
    expect(retry.statusCode).toBe(200);
    expect(retry.headers['idempotent-replay']).toBe('true');
    expect(retry.json().report_id).toBe(reportId);

    // Even without the header, the DB-level partial index would dedup:
    // same reporter + same target + status='new' must collapse to one row.
    const ownedReports = Array.from(chatRepository.reports.values()).filter(
      (row) =>
        row.reporter_user_id === requesterId &&
        row.target_id === relatedPostId &&
        row.status === 'new',
    );
    expect(ownedReports).toHaveLength(1);
  });
});
