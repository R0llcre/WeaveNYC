import type { PostRecord } from '@weavenyc/posts';
import { afterEach, describe, expect, it } from 'vitest';

import { InMemoryChatRealtimeHub, type SocketLike } from '../src/lib/chat-realtime.js';
import { createTestApp, createUserRecord, InMemoryUserStore } from './helpers.js';

/**
 * Fake socket that records close() calls and buffers send() payloads so
 * tests can assert which user received which realtime event AFTER a
 * block. Mirrors the shape of a real @fastify/websocket socket at the
 * minimum subset the hub calls (SocketLike).
 */
function createFakeSocket(): SocketLike & {
  closed: boolean;
  closeCalls: Array<{ code?: number; reason?: string }>;
  sent: string[];
} {
  const sent: string[] = [];
  const closeCalls: Array<{ code?: number; reason?: string }> = [];
  let closed = false;
  const socket: SocketLike & {
    closed: boolean;
    closeCalls: Array<{ code?: number; reason?: string }>;
    sent: string[];
  } = {
    readyState: 1,
    get closed() {
      return closed;
    },
    set closed(value) {
      closed = value;
    },
    closeCalls,
    sent,
    send(data: string) {
      if (closed) {
        throw new Error('attempted to send on a closed fake socket');
      }
      sent.push(data);
    },
    close(code?: number, reason?: string) {
      closed = true;
      closeCalls.push({ code, reason });
    },
    terminate() {
      closed = true;
      closeCalls.push({ code: 1006, reason: 'terminate()' });
    },
  };
  return socket;
}

// Focused coverage for the P0-4 safety fix: when a participant blocks
// another user, the gateway must disconnect the blocked user's live
// socket instead of only publishing a `conversation.updated` event.

const communityId = '44444444-4444-4444-8444-444444444444';
const conversationId = '77777777-7777-4777-8777-777777777777';
const contactRequestId = '88888888-8888-4888-8888-888888888888';
const relatedPostId = '99999999-9999-4999-8999-999999999999';
const requesterId = '11111111-1111-4111-8111-111111111111';
const recipientId = '22222222-2222-4222-8222-222222222222';

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

describe('chat-safety routes — P0-4 block disconnects the blocked user', () => {
  const apps: Array<{ close: () => Promise<unknown> }> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((entry) => entry.close()));
  });

  async function createFixture() {
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
      related_post_ids: [relatedPostId],
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

    return {
      ...testApp,
      requesterToken: signUser(testApp.app, requester),
    };
  }

  it('calls chatRealtimeHub.disconnectUser with the blocked user id after /v1/blocks succeeds', async () => {
    const { app, chatRealtimeHub, requesterToken } = await createFixture();
    const hub = chatRealtimeHub as InMemoryChatRealtimeHub;

    // Pre-block sanity: nobody has been disconnected yet.
    expect(hub.disconnectedUsers).toHaveLength(0);

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

    // The safety route must have told the realtime hub to drop the
    // abuser's socket with a human-readable reason. We don't pin the
    // reason string tightly (may evolve in copy reviews) but it must
    // not be empty and the target must be the blocked user.
    expect(hub.disconnectedUsers).toHaveLength(1);
    expect(hub.disconnectedUsers[0]).toMatchObject({
      userId: recipientId,
    });
    expect(hub.disconnectedUsers[0].reason.length).toBeGreaterThan(0);
  });

  it('closes the blocked peer socket, leaves the blocker socket open, and fans out conversation.updated only to the blocker', async () => {
    const { app, chatRealtimeHub, requesterToken } = await createFixture();
    const hub = chatRealtimeHub as InMemoryChatRealtimeHub;

    // Both participants have a live socket attached to the hub at block
    // time — the realistic mid-conversation case.
    const requesterSocket = createFakeSocket();
    const recipientSocket = createFakeSocket();
    hub.attachConnection(requesterId, requesterSocket);
    hub.attachConnection(recipientId, recipientSocket);

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

    // The block path must sever the abuser's socket within the same
    // request tick. close() was called with a policy-violation code
    // (1008) so the browser surfaces a recoverable error rather than a
    // protocol error, and the reason string is the human copy.
    expect(recipientSocket.closed).toBe(true);
    expect(recipientSocket.closeCalls).toHaveLength(1);
    expect(recipientSocket.closeCalls[0]).toMatchObject({
      code: 1008,
    });
    expect(recipientSocket.closeCalls[0].reason).toBeTruthy();

    // The blocker's socket stays open — they still need to see the
    // conversation.updated event that flips status → blocked on their
    // own inbox. The hub must NOT have called close() on them.
    expect(requesterSocket.closed).toBe(false);
    expect(requesterSocket.closeCalls).toHaveLength(0);

    // After the close, the route publishes conversation.updated. Because
    // the blocked socket is severed + evicted, the fanout must only
    // reach the blocker. The hub's `publishedEvents` ledger confirms
    // the user-ids the event was addressed to (both peers, on purpose,
    // per the route code), but only the blocker's socket actually
    // received a payload via send().
    expect(requesterSocket.sent.length).toBeGreaterThan(0);
    const payloads = requesterSocket.sent.map((raw) => JSON.parse(raw));
    expect(payloads.some((p) => p.event_type === 'conversation.updated')).toBe(true);
    const conversationUpdate = payloads.find((p) => p.event_type === 'conversation.updated');
    expect(conversationUpdate.conversation.status).toBe('blocked');

    // The blocked peer's socket receives ZERO subsequent payloads. The
    // hub drops any send() attempt to an evicted socket (`connections`
    // map no longer has a bucket for the blocked user), and even if
    // the route tried to re-publish manually a second time, the guard
    // above (`closed === true`) would throw on send() — the test
    // setup specifically fails loud if a closed fake receives data.
    expect(recipientSocket.sent).toHaveLength(0);
  });
});
