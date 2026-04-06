import { randomUUID } from 'node:crypto';

import type {
  CommunityAccessResolveResponse,
  CreatePostRequest,
  MyPostsResponse,
  PostDetail,
  PostsListResponse,
  ReviewQueueResponse,
} from '@weavenyc/shared';

import { canViewPost, ensureActorCanPublish, getPostActions, isCommunityMember } from './policy.js';
import { classifyPostRisk, requiresReview } from './risk.js';
import type {
  CommunityMembershipResult,
  PostActor,
  PostRecord,
  PostsService,
  ReviewDecisionInput,
  ReviewQueueInput,
} from './types.js';
import { PostsServiceError } from './types.js';

function nowPlus(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function decodeCursor(
  cursor: string | null | undefined,
): { createdAt: string; postId: string } | null {
  if (!cursor) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      createdAt?: string;
      postId?: string;
    };

    if (!parsed.createdAt || !parsed.postId) {
      throw new Error('invalid');
    }

    return {
      createdAt: parsed.createdAt,
      postId: parsed.postId,
    };
  } catch {
    throw new PostsServiceError('Cursor is not valid', 'invalid_cursor');
  }
}

function encodeCursor(post: PostRecord) {
  return Buffer.from(
    JSON.stringify({
      createdAt: post.createdAt,
      postId: post.postId,
    }),
    'utf8',
  ).toString('base64url');
}

function sortByNewest(posts: PostRecord[]) {
  return [...posts].sort((left, right) => {
    if (left.createdAt === right.createdAt) {
      return right.postId.localeCompare(left.postId);
    }

    return right.createdAt.localeCompare(left.createdAt);
  });
}

function afterCursor(posts: PostRecord[], cursor: ReturnType<typeof decodeCursor>) {
  if (!cursor) {
    return posts;
  }

  return posts.filter((post) => {
    if (post.createdAt < cursor.createdAt) {
      return true;
    }

    if (post.createdAt > cursor.createdAt) {
      return false;
    }

    return post.postId < cursor.postId;
  });
}

function toDetail(actor: PostActor, post: PostRecord): PostDetail {
  return {
    post_id: post.postId,
    community_id: post.communityId,
    post_type: post.postType,
    category: post.category,
    title: post.title,
    body: post.body,
    language: post.language,
    location_zip: post.locationZip,
    privacy: post.privacy,
    status: post.status,
    risk_level: post.riskLevel,
    created_at: post.createdAt,
    updated_at: post.updatedAt,
    expires_at: post.expiresAt,
    is_owner: actor.userId === post.createdBy,
    contact_pref: post.contactPref,
    actions: getPostActions(actor, post),
  };
}

function toSummary(detail: PostDetail) {
  return {
    post_id: detail.post_id,
    community_id: detail.community_id,
    post_type: detail.post_type,
    category: detail.category,
    title: detail.title,
    body: detail.body,
    language: detail.language,
    location_zip: detail.location_zip,
    privacy: detail.privacy,
    status: detail.status,
    risk_level: detail.risk_level,
    created_at: detail.created_at,
    updated_at: detail.updated_at,
    expires_at: detail.expires_at,
    is_owner: detail.is_owner,
  };
}

export class InMemoryPostsService implements PostsService {
  readonly communityAccessCodes = new Map<string, CommunityAccessResolveResponse>();
  readonly memberships = new Map<string, CommunityMembershipResult>();
  readonly posts = new Map<string, PostRecord>();

  async ping() {}
  async close() {}

  async resolveCommunityAccess(input: { userId: string; inviteCode?: string; qrToken?: string }) {
    void input.userId;
    const key = input.inviteCode ? `invite:${input.inviteCode}` : `qr:${input.qrToken}`;
    const result = this.communityAccessCodes.get(key);
    if (!result) {
      throw new PostsServiceError('Community access code not found', 'not_found');
    }

    return result;
  }

  async joinCommunity(input: { userId: string; communityId: string }) {
    const key = `${input.userId}:${input.communityId}`;
    const existing = this.memberships.get(key);
    if (existing) {
      return {
        ...existing,
        membership_status: 'already_joined' as const,
      };
    }

    const created = {
      community_id: input.communityId,
      membership_status: 'joined' as const,
      joined_at: new Date().toISOString(),
    };
    this.memberships.set(key, created);
    return created;
  }

  async createPost(input: { actor: PostActor; request: CreatePostRequest }) {
    const membership = this.memberships.get(`${input.actor.userId}:${input.request.community_id}`);
    if (!membership && !input.actor.communityIds.includes(input.request.community_id)) {
      throw new PostsServiceError('Join the community before publishing', 'membership_required');
    }

    const riskLevel = classifyPostRisk(input.request);
    if ((input.request.post_type === 'offer' || riskLevel === 'high') && input.actor.level === 'anonymous') {
      throw new PostsServiceError('Verification is required for this post', 'verified_required');
    }

    const now = new Date().toISOString();
    const postId = randomUUID();
    this.posts.set(postId, {
      postId,
      communityId: input.request.community_id,
      postType: input.request.post_type,
      category: input.request.category,
      title: input.request.title,
      body: input.request.body,
      language: input.request.language,
      locationZip: input.request.location_zip,
      privacy: input.request.privacy,
      status: requiresReview(riskLevel) ? 'pending_review' : 'active',
      riskLevel,
      expiresAt: input.request.expires_at || nowPlus(24),
      createdAt: now,
      updatedAt: now,
      createdBy: input.actor.userId,
      contactPref: input.request.contact_pref ?? null,
    });

    return {
      postId,
      status: this.posts.get(postId)!.status,
      riskLevel,
    };
  }

  async listPosts(input: { actor: PostActor; scope: 'community' | 'public'; communityId?: string; postType?: PostRecord['postType']; category?: PostRecord['category']; status?: PostRecord['status']; cursor?: string | null; limit?: number }) {
    const cursor = decodeCursor('cursor' in input ? (input as { cursor?: string | null }).cursor : null);
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);

    if (input.scope === 'community') {
      if (!input.communityId) {
        throw new PostsServiceError('community_id is required for community scope', 'invalid_scope');
      }

      if (!isCommunityMember(input.actor, input.communityId)) {
        throw new PostsServiceError('Community membership is required', 'membership_required');
      }
    }

    const records = afterCursor(
      sortByNewest(
        Array.from(this.posts.values()).filter((post) => {
          const notExpired = !post.expiresAt || post.expiresAt > new Date().toISOString();
          if (!notExpired) {
            return false;
          }

          if (input.scope === 'public') {
            if (post.status !== 'active' || post.privacy !== 'public') {
              return false;
            }

            if (input.communityId && post.communityId !== input.communityId) {
              return false;
            }
          } else {
            if (post.communityId !== input.communityId || post.privacy === 'anchor_mediated') {
              return false;
            }

            if (input.actor.role === 'anchor') {
              if ((input.status ?? 'active') !== post.status) {
                return false;
              }
            } else if (post.status !== 'active') {
              return false;
            }
          }

          if (input.postType && post.postType !== input.postType) {
            return false;
          }

          if (input.category && post.category !== input.category) {
            return false;
          }

          return true;
        }),
      ),
      cursor,
    ).slice(0, limit + 1);

    const items = records.map((post) => toDetail(input.actor, post));

    return {
      items: items.slice(0, limit).map((detail) => toSummary(detail)),
      next_cursor: records.length > limit ? encodeCursor(records[limit]!) : null,
    } satisfies PostsListResponse;
  }

  async getPostDetail(actor: PostActor, postId: string) {
    const post = this.posts.get(postId);
    if (!post) {
      throw new PostsServiceError('Post not found', 'not_found');
    }

    if (!canViewPost(actor, post)) {
      throw new PostsServiceError('Post is not visible to this viewer', 'forbidden');
    }

    return toDetail(actor, post);
  }

  async updatePost(input: { actor: PostActor; postId: string; request: Partial<Omit<CreatePostRequest, 'community_id' | 'post_type'>> }) {
    const post = this.posts.get(input.postId);
    if (!post) {
      throw new PostsServiceError('Post not found', 'not_found');
    }

    if (post.createdBy !== input.actor.userId) {
      throw new PostsServiceError('Only the author can update this post', 'forbidden');
    }

    if (post.status !== 'active' && post.status !== 'pending_review') {
      throw new PostsServiceError('Only active or pending review posts can be updated', 'invalid_state');
    }

    const updated: PostRecord = {
      ...post,
      category: input.request.category ?? post.category,
      title: input.request.title ?? post.title,
      body: input.request.body ?? post.body,
      language: input.request.language ?? post.language,
      locationZip: input.request.location_zip ?? post.locationZip,
      privacy: input.request.privacy ?? post.privacy,
      expiresAt: input.request.expires_at ?? post.expiresAt,
      contactPref: input.request.contact_pref ?? post.contactPref,
      updatedAt: new Date().toISOString(),
    };
    updated.riskLevel = classifyPostRisk(updated);
    const publishDecision = ensureActorCanPublish(input.actor, {
      communityId: updated.communityId,
      postType: updated.postType,
      riskLevel: updated.riskLevel,
    });

    if (publishDecision === 'membership_required') {
      throw new PostsServiceError('Join the community before publishing', 'membership_required');
    }

    if (publishDecision === 'verified_required') {
      throw new PostsServiceError('Verification is required for this post', 'verified_required');
    }

    updated.status = requiresReview(updated.riskLevel) ? 'pending_review' : 'active';
    this.posts.set(updated.postId, updated);
    return toDetail(input.actor, updated);
  }

  async closePost(actor: PostActor, postId: string) {
    const post = this.posts.get(postId);
    if (!post) {
      throw new PostsServiceError('Post not found', 'not_found');
    }
    if (post.createdBy !== actor.userId) {
      throw new PostsServiceError('Only the author can close this post', 'forbidden');
    }
    if (post.status !== 'active') {
      throw new PostsServiceError('Only active posts can be closed', 'invalid_state');
    }
    post.status = 'closed';
    post.updatedAt = new Date().toISOString();
    this.posts.set(postId, post);
    return toDetail(actor, post);
  }

  async removePost(actor: PostActor, postId: string) {
    const post = this.posts.get(postId);
    if (!post) {
      throw new PostsServiceError('Post not found', 'not_found');
    }
    if (post.createdBy !== actor.userId) {
      throw new PostsServiceError('Only the author can remove this post', 'forbidden');
    }
    post.status = 'removed';
    post.updatedAt = new Date().toISOString();
    this.posts.set(postId, post);
    return toDetail(actor, post);
  }

  async listMyPosts(input: { actor: PostActor; communityId?: string; status?: PostRecord['status']; cursor?: string | null; limit?: number }): Promise<MyPostsResponse> {
    const cursor = decodeCursor('cursor' in input ? (input as { cursor?: string | null }).cursor : null);
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);

    const records = afterCursor(
      sortByNewest(
        Array.from(this.posts.values()).filter((post) => {
          if (post.createdBy !== input.actor.userId) {
            return false;
          }

          if (input.communityId && post.communityId !== input.communityId) {
            return false;
          }

          if (input.status && post.status !== input.status) {
            return false;
          }

          return true;
        }),
      ),
      cursor,
    ).slice(0, limit + 1);

    return {
      items: records.slice(0, limit).map((post) => toSummary(toDetail(input.actor, post))),
      next_cursor: records.length > limit ? encodeCursor(records[limit]!) : null,
    };
  }

  async listReviewQueue(input: ReviewQueueInput): Promise<ReviewQueueResponse> {
    const cursor = decodeCursor(input.cursor);
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);

    if (input.actor.role !== 'anchor' || !input.actor.communityIds.includes(input.communityId)) {
      throw new PostsServiceError('Only anchors can access the review queue', 'forbidden');
    }

    const records = afterCursor(
      sortByNewest(
        Array.from(this.posts.values()).filter(
          (post) => post.communityId === input.communityId && post.status === 'pending_review',
        ),
      ),
      cursor,
    ).slice(0, limit + 1);

    const items = records.map((post) => ({
        ...toDetail(input.actor, post),
        review_actions: ['approve', 'reject', 'request_more_info'] as Array<
          'approve' | 'reject' | 'request_more_info'
        >,
      }))
      .map(({ actions, contact_pref, ...item }) => {
        void actions;
        void contact_pref;
        return item;
      });
    return {
      items: items.slice(0, limit),
      next_cursor: records.length > limit ? encodeCursor(records[limit]!) : null,
    };
  }

  async decideReview(input: ReviewDecisionInput) {
    const post = this.posts.get(input.postId);
    if (!post) {
      throw new PostsServiceError('Post not found', 'not_found');
    }

    if (input.actor.role !== 'anchor') {
      throw new PostsServiceError('Only anchors can review posts', 'forbidden');
    }

    if (!input.actor.communityIds.includes(post.communityId)) {
      throw new PostsServiceError('Anchor does not belong to this community', 'forbidden');
    }

    if (post.status !== 'pending_review') {
      throw new PostsServiceError('Only pending review posts can receive a review decision', 'invalid_state');
    }

    post.status =
      input.decision === 'approve'
        ? 'active'
        : input.decision === 'reject'
          ? 'removed'
          : 'pending_review';
    post.updatedAt = new Date().toISOString();
    this.posts.set(input.postId, post);
    return {
      post_id: post.postId,
      status: post.status,
      decided_at: new Date().toISOString(),
    };
  }
}
