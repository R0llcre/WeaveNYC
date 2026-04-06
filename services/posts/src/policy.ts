import type { PostDetail, UserLevel } from '@weavenyc/shared';

import type { PostActor, PostRecord } from './types.js';

export function isCommunityMember(actor: PostActor, communityId: string) {
  return actor.communityIds.includes(communityId) || actor.role === 'anchor';
}

export function ensureActorCanPublish(actor: PostActor, post: Pick<PostRecord, 'communityId' | 'postType' | 'riskLevel'>) {
  if (!isCommunityMember(actor, post.communityId)) {
    return 'membership_required' as const;
  }

  if (post.postType === 'offer' && actor.level === 'anonymous') {
    return 'verified_required' as const;
  }

  if (post.riskLevel === 'high' && actor.level === 'anonymous') {
    return 'verified_required' as const;
  }

  return null;
}

export function deriveVerificationState(level: UserLevel) {
  if (level === 'anonymous') {
    return 'unverified' as const;
  }

  return 'verified_by_anchor' as const;
}

export function canViewPost(actor: PostActor, post: PostRecord) {
  if (actor.role === 'anchor' && actor.communityIds.includes(post.communityId)) {
    return true;
  }

  if (post.createdBy === actor.userId) {
    return true;
  }

  if (post.status !== 'active') {
    return false;
  }

  if (post.privacy === 'public') {
    return true;
  }

  if (post.privacy === 'community_only') {
    return actor.communityIds.includes(post.communityId);
  }

  return false;
}

export function getPostActions(actor: PostActor, post: PostRecord): PostDetail['actions'] {
  const isOwner = actor.userId === post.createdBy;
  const canReview = actor.role === 'anchor' && actor.communityIds.includes(post.communityId);

  return {
    can_edit: isOwner && (post.status === 'active' || post.status === 'pending_review'),
    can_close: isOwner && post.status === 'active',
    can_delete: isOwner && post.status !== 'removed',
    can_review: canReview && post.status === 'pending_review',
  };
}
