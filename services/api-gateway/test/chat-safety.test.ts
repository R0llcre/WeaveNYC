import type { PostRecord } from '@weavenyc/posts';
import { afterEach, describe, expect, it } from 'vitest';

import { InMemoryChatRealtimeHub } from '../src/lib/chat-realtime.js';
import { createTestApp, createUserRecord, InMemoryUserStore } from './helpers.js';

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
});
