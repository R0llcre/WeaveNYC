import { describe, expect, it } from 'vitest';

import { InMemoryPostsService, PostsServiceError } from '../src/index.js';
import type { PostActor } from '../src/index.js';

const community = {
  community_id: '44444444-4444-4444-8444-444444444444',
  name: 'Farmingdale Demo Community',
  center_zip: '11735',
  join_policy: 'invite_only' as const,
};

const anonymousActor: PostActor = {
  userId: '11111111-1111-4111-8111-111111111111',
  level: 'anonymous',
  role: 'user',
  communityIds: [],
};

const verifiedActor: PostActor = {
  userId: '22222222-2222-4222-8222-222222222222',
  level: 'verified',
  role: 'user',
  communityIds: [community.community_id],
};

const anchorActor: PostActor = {
  userId: '33333333-3333-4333-8333-333333333333',
  level: 'anchor',
  role: 'anchor',
  communityIds: [community.community_id],
};

const foreignAnchorActor: PostActor = {
  userId: '44444444-4444-4444-8444-444444444444',
  level: 'anchor',
  role: 'anchor',
  communityIds: ['55555555-5555-4555-8555-555555555555'],
};

function createService() {
  const service = new InMemoryPostsService();
  service.communityAccessCodes.set('invite:FARMINGDALE-HELP', {
    community,
    join_token: 'demo-invite-join-token',
    entry: 'invite_code',
    expires_in_seconds: 600,
  });
  service.communityAccessCodes.set('qr:FARMINGDALE-QR', {
    community,
    join_token: 'demo-qr-join-token',
    entry: 'qr_token',
    expires_in_seconds: 600,
  });
  return service;
}

function actorWithCommunity(actor: PostActor) {
  return {
    ...actor,
    communityIds: [community.community_id],
  } satisfies PostActor;
}

describe('InMemoryPostsService', () => {
  it('resolves invite codes and QR tokens', async () => {
    const service = createService();

    const invite = await service.resolveCommunityAccess({
      userId: anonymousActor.userId,
      inviteCode: 'FARMINGDALE-HELP',
    });
    const qr = await service.resolveCommunityAccess({
      userId: anonymousActor.userId,
      qrToken: 'FARMINGDALE-QR',
    });

    expect(invite.entry).toBe('invite_code');
    expect(qr.entry).toBe('qr_token');
    expect(invite.community.community_id).toBe(community.community_id);
  });

  it('joins a community idempotently', async () => {
    const service = createService();

    const first = await service.joinCommunity({
      userId: anonymousActor.userId,
      communityId: community.community_id,
    });
    const second = await service.joinCommunity({
      userId: anonymousActor.userId,
      communityId: community.community_id,
    });

    expect(first.membership_status).toBe('joined');
    expect(second.membership_status).toBe('already_joined');
  });

  it('requires community membership before publishing a request', async () => {
    const service = createService();

    await expect(
      service.createPost({
        actor: anonymousActor,
        request: {
          community_id: community.community_id,
          post_type: 'request',
          category: 'food',
          title: 'Need dinner',
          body: 'Need dinner for two tonight',
          language: 'en',
          location_zip: '11735',
          privacy: 'community_only',
          expires_at: new Date(Date.now() + 60_000).toISOString(),
        },
      })
    ).rejects.toThrowError(PostsServiceError);
  });

  it('does not treat anchors as members of unrelated communities', async () => {
    const service = createService();

    await expect(
      service.createPost({
        actor: foreignAnchorActor,
        request: {
          community_id: community.community_id,
          post_type: 'request',
          category: 'food',
          title: 'Need dinner',
          body: 'Need dinner for tonight',
          language: 'en',
          location_zip: '11735',
          privacy: 'community_only',
          expires_at: new Date(Date.now() + 60_000).toISOString(),
        },
      })
    ).rejects.toThrowError(PostsServiceError);
  });

  it('publishes low-risk requests as active after join', async () => {
    const service = createService();
    await service.joinCommunity({
      userId: anonymousActor.userId,
      communityId: community.community_id,
    });

    const created = await service.createPost({
      actor: actorWithCommunity(anonymousActor),
      request: {
        community_id: community.community_id,
        post_type: 'request',
        category: 'food',
        title: 'Need groceries',
        body: 'Need groceries for two days.',
        language: 'en',
        location_zip: '11735',
        privacy: 'community_only',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
    });

    expect(created.status).toBe('active');
    expect(created.riskLevel).toBe('low');
  });

  it('requires verified for offers and high-risk posts', async () => {
    const service = createService();
    await service.joinCommunity({
      userId: anonymousActor.userId,
      communityId: community.community_id,
    });

    await expect(
      service.createPost({
        actor: actorWithCommunity(anonymousActor),
        request: {
          community_id: community.community_id,
          post_type: 'offer',
          category: 'food',
          title: 'Can share groceries',
          body: 'I can share some groceries tonight.',
          language: 'en',
          location_zip: '11735',
          privacy: 'community_only',
          expires_at: new Date(Date.now() + 60_000).toISOString(),
        },
      })
    ).rejects.toThrowError(PostsServiceError);
  });

  it('routes high-risk verified offers to pending_review and review queue', async () => {
    const service = createService();

    const created = await service.createPost({
      actor: verifiedActor,
      request: {
        community_id: community.community_id,
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

    const queue = await service.listReviewQueue({
      actor: anchorActor,
      communityId: community.community_id,
    });

    expect(created.status).toBe('pending_review');
    expect(queue.items).toHaveLength(1);
    expect(queue.items[0]?.post_id).toBe(created.postId);
  });

  it('only allows review decisions for pending_review posts', async () => {
    const service = createService();

    const created = await service.createPost({
      actor: verifiedActor,
      request: {
        community_id: community.community_id,
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

    await expect(
      service.decideReview({
        actor: anchorActor,
        postId: created.postId,
        decision: 'approve',
      })
    ).rejects.toThrowError(PostsServiceError);
  });

  it('separates public feed from community feed', async () => {
    const service = createService();

    await service.createPost({
      actor: verifiedActor,
      request: {
        community_id: community.community_id,
        post_type: 'request',
        category: 'food',
        title: 'Need a pantry run',
        body: 'Need pantry help this week.',
        language: 'en',
        location_zip: '11735',
        privacy: 'public',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
    });

    await service.createPost({
      actor: verifiedActor,
      request: {
        community_id: community.community_id,
        post_type: 'request',
        category: 'goods',
        title: 'Need winter clothes',
        body: 'Looking for coats for two kids.',
        language: 'en',
        location_zip: '11735',
        privacy: 'community_only',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
    });

    const publicFeed = await service.listPosts({
      actor: anonymousActor,
      scope: 'public',
    });
    const communityFeed = await service.listPosts({
      actor: verifiedActor,
      scope: 'community',
      communityId: community.community_id,
    });

    expect(publicFeed.items).toHaveLength(1);
    expect(publicFeed.items[0]?.privacy).toBe('public');
    expect(communityFeed.items).toHaveLength(2);
  });

  it('updates and moderates posts', async () => {
    const service = createService();

    const created = await service.createPost({
      actor: verifiedActor,
      request: {
        community_id: community.community_id,
        post_type: 'request',
        category: 'food',
        title: 'Need dinner',
        body: 'Need dinner for two.',
        language: 'en',
        location_zip: '11735',
        privacy: 'community_only',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
    });

    const updated = await service.updatePost({
      actor: verifiedActor,
      postId: created.postId,
      request: {
        category: 'childcare',
        body: 'Need someone to watch my child after pickup.',
      },
    });

    const decided = await service.decideReview({
      actor: anchorActor,
      postId: updated.post_id,
      decision: 'approve',
      notes: 'Approved for demo',
    });

    expect(updated.status).toBe('pending_review');
    expect(decided.status).toBe('active');
  });

  it('blocks anonymous edits that would escalate a request into verified-only high risk', async () => {
    const service = createService();
    await service.joinCommunity({
      userId: anonymousActor.userId,
      communityId: community.community_id,
    });

    const created = await service.createPost({
      actor: actorWithCommunity(anonymousActor),
      request: {
        community_id: community.community_id,
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

    await expect(
      service.updatePost({
        actor: actorWithCommunity(anonymousActor),
        postId: created.postId,
        request: {
          category: 'childcare',
          body: 'Need someone to watch my child after pickup.',
        },
      }),
    ).rejects.toThrowError(PostsServiceError);
  });

  it('only allows closing active posts', async () => {
    const service = createService();

    const created = await service.createPost({
      actor: verifiedActor,
      request: {
        community_id: community.community_id,
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

    await expect(service.closePost(verifiedActor, created.postId)).rejects.toThrowError(PostsServiceError);
  });

  it('keeps anchor_mediated and non-active posts out of the default community feed', async () => {
    const service = createService();

    const mediated = await service.createPost({
      actor: verifiedActor,
      request: {
        community_id: community.community_id,
        post_type: 'request',
        category: 'food',
        title: 'Need mediated help',
        body: 'Need mediated help with groceries.',
        language: 'en',
        location_zip: '11735',
        privacy: 'anchor_mediated',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
    });

    const closable = await service.createPost({
      actor: verifiedActor,
      request: {
        community_id: community.community_id,
        post_type: 'request',
        category: 'food',
        title: 'Need visible groceries',
        body: 'Need groceries for tonight.',
        language: 'en',
        location_zip: '11735',
        privacy: 'community_only',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
    });

    await service.closePost(verifiedActor, closable.postId);

    const visible = await service.createPost({
      actor: verifiedActor,
      request: {
        community_id: community.community_id,
        post_type: 'request',
        category: 'food',
        title: 'Fresh visible request',
        body: 'Need groceries tomorrow morning.',
        language: 'en',
        location_zip: '11735',
        privacy: 'community_only',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
    });

    const feed = await service.listPosts({
      actor: anchorActor,
      scope: 'community',
      communityId: community.community_id,
    });

    expect(mediated.status).toBe('active');
    expect(feed.items.map((item) => item.post_id)).toEqual([visible.postId]);
  });

  it('only allows review decisions for pending-review posts', async () => {
    const service = createService();

    const created = await service.createPost({
      actor: verifiedActor,
      request: {
        community_id: community.community_id,
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

    await expect(
      service.decideReview({
        actor: anchorActor,
        postId: created.postId,
        decision: 'approve',
      })
    ).rejects.toThrowError(PostsServiceError);
  });
});
