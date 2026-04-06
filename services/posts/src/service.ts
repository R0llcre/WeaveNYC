import type { PostsListResponse, ReviewQueueResponse } from '@weavenyc/shared';

import { normalizeCommunityAccessInput } from './community.js';
import { canViewPost, deriveVerificationState, ensureActorCanPublish, isCommunityMember } from './policy.js';
import { PostsRepository, toPostDetail } from './repository.js';
import { classifyPostRisk, requiresReview } from './risk.js';
import type {
  CreatePostInput,
  CreatePostResult,
  ListMyPostsInput,
  ListPostsInput,
  PostActor,
  PostsService,
  ResolveCommunityAccessInput,
  ReviewDecisionInput,
  ReviewQueueInput,
  UpdatePostInput,
} from './types.js';

import { PostsServiceError as PostsDomainError } from './types.js';

export class DefaultPostsService implements PostsService {
  constructor(private readonly repository: PostsRepository) {}

  async ping() {
    await this.repository.ping();
  }

  async close() {
    await this.repository.close();
  }

  async resolveCommunityAccess(input: ResolveCommunityAccessInput) {
    const normalized = normalizeCommunityAccessInput(input);
    const result = await this.repository.findCommunityAccessCode(normalized);
    if (!result) {
      throw new PostsDomainError('Community access code not found', 'not_found');
    }

    return {
      community: result.community,
      join_token: '',
      entry: result.entry,
      expires_in_seconds: 0,
    };
  }

  async joinCommunity(input: { userId: string; communityId: string }) {
    const result = await this.repository.joinCommunity(input.userId, input.communityId);
    if (!result) {
      throw new PostsDomainError('Community not found', 'not_found');
    }

    return result;
  }

  async createPost(input: CreatePostInput): Promise<CreatePostResult> {
    const riskLevel = classifyPostRisk(input.request);
    const publishDecision = ensureActorCanPublish(input.actor, {
      communityId: input.request.community_id,
      postType: input.request.post_type,
      riskLevel,
    });

    if (publishDecision === 'membership_required') {
      throw new PostsDomainError('Join the community before publishing', 'membership_required');
    }

    if (publishDecision === 'verified_required') {
      throw new PostsDomainError('Verification is required for this post', 'verified_required');
    }

    const created = await this.repository.insertPost({
      actor: input.actor,
      request: input.request,
      riskLevel,
      status: requiresReview(riskLevel) ? 'pending_review' : 'active',
      verificationState: deriveVerificationState(input.actor.level),
    });

    return {
      postId: created.postId,
      status: created.status,
      riskLevel: created.riskLevel,
    };
  }

  async listPosts(input: ListPostsInput): Promise<PostsListResponse> {
    if (input.scope === 'community') {
      if (!input.communityId) {
        throw new PostsDomainError('community_id is required for community scope', 'invalid_scope');
      }

      if (!isCommunityMember(input.actor, input.communityId)) {
        throw new PostsDomainError('Community membership is required', 'membership_required');
      }

      if (input.actor.role !== 'anchor' && input.status && input.status !== 'active') {
        throw new PostsDomainError('Only anchors can request non-active community feed states', 'forbidden');
      }
    }

    const page = await this.repository.listPosts(input);
    return {
      items: page.items.map((item) => ({
        post_id: item.post_id,
        community_id: item.community_id,
        post_type: item.post_type,
        category: item.category,
        title: item.title,
        body: item.body,
        language: item.language,
        location_zip: item.location_zip,
        privacy: item.privacy,
        status: item.status,
        risk_level: item.risk_level,
        created_at: item.created_at,
        updated_at: item.updated_at,
        expires_at: item.expires_at,
        is_owner: item.is_owner,
      })),
      next_cursor: page.nextCursor,
    };
  }

  async getPostDetail(actor: PostActor, postId: string) {
    const post = await this.repository.findPost(postId);
    if (!post) {
      throw new PostsDomainError('Post not found', 'not_found');
    }

    if (!canViewPost(actor, post)) {
      throw new PostsDomainError('Post is not visible to this viewer', 'forbidden');
    }

    return toPostDetail(actor, post);
  }

  async updatePost(input: UpdatePostInput) {
    const post = await this.repository.findPost(input.postId);
    if (!post) {
      throw new PostsDomainError('Post not found', 'not_found');
    }

    if (post.createdBy !== input.actor.userId) {
      throw new PostsDomainError('Only the author can update this post', 'forbidden');
    }

    if (post.status !== 'active' && post.status !== 'pending_review') {
      throw new PostsDomainError('Only active or pending review posts can be updated', 'invalid_state');
    }

    const nextRisk = classifyPostRisk({
      category: input.request.category ?? post.category,
      title: input.request.title ?? post.title,
      body: input.request.body ?? post.body,
    });
    const publishDecision = ensureActorCanPublish(input.actor, {
      communityId: post.communityId,
      postType: post.postType,
      riskLevel: nextRisk,
    });

    if (publishDecision === 'membership_required') {
      throw new PostsDomainError('Join the community before publishing', 'membership_required');
    }

    if (publishDecision === 'verified_required') {
      throw new PostsDomainError('Verification is required for this post', 'verified_required');
    }

    const updated = await this.repository.updatePost({
      postId: input.postId,
      request: input.request,
      riskLevel: nextRisk,
      status: requiresReview(nextRisk) ? 'pending_review' : 'active',
    });

    if (!updated) {
      throw new PostsDomainError('Post not found', 'not_found');
    }

    return toPostDetail(input.actor, updated);
  }

  async closePost(actor: PostActor, postId: string) {
    const post = await this.repository.findPost(postId);
    if (!post) {
      throw new PostsDomainError('Post not found', 'not_found');
    }

    if (post.createdBy !== actor.userId) {
      throw new PostsDomainError('Only the author can close this post', 'forbidden');
    }

    if (post.status !== 'active') {
      throw new PostsDomainError('Only active posts can be closed', 'invalid_state');
    }

    const updated = await this.repository.setPostStatus(postId, 'closed');
    if (!updated) {
      throw new PostsDomainError('Post not found', 'not_found');
    }

    return toPostDetail(actor, updated);
  }

  async removePost(actor: PostActor, postId: string) {
    const post = await this.repository.findPost(postId);
    if (!post) {
      throw new PostsDomainError('Post not found', 'not_found');
    }

    if (post.createdBy !== actor.userId) {
      throw new PostsDomainError('Only the author can remove this post', 'forbidden');
    }

    const updated = await this.repository.setPostStatus(postId, 'removed');
    if (!updated) {
      throw new PostsDomainError('Post not found', 'not_found');
    }

    return toPostDetail(actor, updated);
  }

  async listMyPosts(input: ListMyPostsInput) {
    const page = await this.repository.listMyPosts(input);
    return {
      items: page.items.map((item) => ({
        post_id: item.post_id,
        community_id: item.community_id,
        post_type: item.post_type,
        category: item.category,
        title: item.title,
        body: item.body,
        language: item.language,
        location_zip: item.location_zip,
        privacy: item.privacy,
        status: item.status,
        risk_level: item.risk_level,
        created_at: item.created_at,
        updated_at: item.updated_at,
        expires_at: item.expires_at,
        is_owner: item.is_owner,
      })),
      next_cursor: page.nextCursor,
    };
  }

  async listReviewQueue(input: ReviewQueueInput): Promise<ReviewQueueResponse> {
    if (input.actor.role !== 'anchor' || !input.actor.communityIds.includes(input.communityId)) {
      throw new PostsDomainError('Only anchors can access the review queue', 'forbidden');
    }

    const page = await this.repository.listReviewQueue(input);
    return {
      items: page.items,
      next_cursor: page.nextCursor,
    };
  }

  async decideReview(input: ReviewDecisionInput) {
    if (input.actor.role !== 'anchor') {
      throw new PostsDomainError('Only anchors can review posts', 'forbidden');
    }

    const post = await this.repository.findPost(input.postId);
    if (!post) {
      throw new PostsDomainError('Post not found', 'not_found');
    }

    if (!input.actor.communityIds.includes(post.communityId)) {
      throw new PostsDomainError('Anchor does not belong to this community', 'forbidden');
    }

    if (post.status !== 'pending_review') {
      throw new PostsDomainError('Only pending review posts can receive a review decision', 'invalid_state');
    }

    const status =
      input.decision === 'approve'
        ? 'active'
        : input.decision === 'reject'
          ? 'removed'
          : 'pending_review';
    const updated = await this.repository.setPostStatus(input.postId, status);
    if (!updated) {
      throw new PostsDomainError('Post not found', 'not_found');
    }

    await this.repository.recordModerationDecision(input, updated);

    return {
      post_id: updated.postId,
      status: updated.status,
      decided_at: new Date().toISOString(),
    };
  }
}

export function createPostsService(repository: PostsRepository) {
  return new DefaultPostsService(repository);
}

export { PostsDomainError as PostsServiceError };
