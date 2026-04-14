import {
  MatchServiceError,
  type AcceptContactRequestInput,
  type GetAcceptedConversationInput,
  type GetSuggestionsInput,
  type ListInboxInput,
  type MatchContactRequest,
  type MatchContactResponse,
  type MatchResultsResponse,
  type MatchService,
  type RejectContactRequestInput,
} from '@weavenyc/match';
import {
  PostsServiceError,
  type AdminDashboardInput,
  type CommunityRulesInput,
  type CreateAnnouncementInput,
  type CreatePostInput,
  type DeleteAnnouncementInput,
  type ListAnnouncementsInput,
  type ListMyPostsInput,
  type ListPostsInput,
  type PostsService,
  type ResolveCommunityAccessInput,
  type ReviewDecisionInput,
  type ReviewQueueInput,
  type UpdateAnnouncementInput,
  type UpdateCommunityRulesInput,
  type UpdatePostInput,
} from '@weavenyc/posts';
import type { ResourceListItem, ResourceSearchResult } from '@weavenyc/resource-directory';
import {
  ChatServiceError,
  type AdminReportQueueInput,
  type BlockUserInput,
  type ChatService,
  type CloseConversationInput,
  type GetConversationInput,
  type ListConversationInput,
  type ListConversationIdsForPairInput,
  type ListMessagesInput,
  type ReportDecisionInput,
  type SendMessageInput,
  type SubmitReportInput,
} from '@weavenyc/chat';

import { requestInternalJson, type InternalServiceError } from './internal-service-client.js';
import type { AppConfig } from '../config.js';
import type { ResourceDirectoryService } from './resource-directory.js';
import type { InternalServiceTokenClaims } from '../types.js';

type InternalClientContext = {
  config: AppConfig;
  serviceJwt: {
    sign: (payload: InternalServiceTokenClaims) => string;
  };
};

function toInternalActor(input: {
  userId: string;
  level: 'anonymous' | 'verified' | 'anchor';
  role?: 'user' | 'anchor';
  communityIds?: string[];
  anchorCommunityId?: string | null;
  mfaVerifiedAt?: string;
  status?: 'active' | 'suspended' | 'deleted';
}) {
  return {
    sub: input.userId,
    level: input.level,
    role: input.role ?? 'user',
    community_ids: input.communityIds ?? [],
    anchor_community_id: input.anchorCommunityId ?? undefined,
    mfa_verified_at: input.mfaVerifiedAt,
    status: input.status,
  };
}

function mapPostsError(error: InternalServiceError) {
  const code =
    error.statusCode === 404
      ? 'not_found'
      : error.statusCode === 403
        ? 'forbidden'
        : error.statusCode === 400
          ? 'invalid_input'
          : 'invalid_scope';
  return new PostsServiceError(error.message, code);
}

function mapMatchError(error: InternalServiceError) {
  const code =
    error.statusCode === 404
      ? 'not_found'
      : error.statusCode === 403
        ? 'forbidden'
        : error.statusCode === 400
          ? 'invalid_scope'
          : 'invalid_state';
  return new MatchServiceError(error.message, code);
}

function mapChatError(error: InternalServiceError) {
  const code =
    error.statusCode === 404
      ? 'not_found'
      : error.statusCode === 403
        ? 'forbidden'
        : error.statusCode === 409
          ? 'conversation_blocked'
          : error.statusCode === 429
            ? 'rate_limited'
            : 'invalid_input';
  return new ChatServiceError(error.message, code);
}

export function createHttpPostsService(context: InternalClientContext): PostsService {
  return {
    async ping() {
      await requestInternalJson<{ status: string }>(context, 'posts', {
        path: '/readyz',
      });
    },
    async close() {},
    async resolveCommunityAccess(input: ResolveCommunityAccessInput) {
      try {
        return await requestInternalJson(context, 'posts', {
          path: '/internal/v1/posts/resolve-community-access',
          method: 'POST',
          actor: toInternalActor({ userId: input.userId, level: 'anonymous', role: 'user' }),
          body: {
            invite_code: input.inviteCode,
            qr_token: input.qrToken,
          },
        });
      } catch (error) {
        throw mapPostsError(error as InternalServiceError);
      }
    },
    async joinCommunity(input) {
      try {
        return await requestInternalJson(context, 'posts', {
          path: '/internal/v1/posts/join-community',
          method: 'POST',
          actor: toInternalActor({ userId: input.userId, level: 'anonymous', role: 'user' }),
          body: {
            community_id: input.communityId,
          },
        });
      } catch (error) {
        throw mapPostsError(error as InternalServiceError);
      }
    },
    async createPost(input: CreatePostInput) {
      try {
        return await requestInternalJson(context, 'posts', {
          path: '/internal/v1/posts/create-post',
          method: 'POST',
          actor: toInternalActor({
            userId: input.actor.userId,
            level: input.actor.level,
            role: input.actor.role,
            communityIds: input.actor.communityIds,
            anchorCommunityId: input.actor.anchorCommunityId,
            mfaVerifiedAt: input.actor.mfaVerifiedAt,
          }),
          body: input,
        });
      } catch (error) {
        throw mapPostsError(error as InternalServiceError);
      }
    },
    async listPosts(input: ListPostsInput) {
      try {
        return await requestInternalJson(context, 'posts', {
          path: '/internal/v1/posts/list-posts',
          method: 'POST',
          actor: toInternalActor({
            userId: input.actor.userId,
            level: input.actor.level,
            role: input.actor.role,
            communityIds: input.actor.communityIds,
            anchorCommunityId: input.actor.anchorCommunityId,
            mfaVerifiedAt: input.actor.mfaVerifiedAt,
          }),
          body: input,
        });
      } catch (error) {
        throw mapPostsError(error as InternalServiceError);
      }
    },
    async getPostDetail(actor, postId) {
      try {
        return await requestInternalJson(context, 'posts', {
          path: '/internal/v1/posts/get-post-detail',
          method: 'POST',
          actor: toInternalActor({
            userId: actor.userId,
            level: actor.level,
            role: actor.role,
            communityIds: actor.communityIds,
            anchorCommunityId: actor.anchorCommunityId,
            mfaVerifiedAt: actor.mfaVerifiedAt,
          }),
          body: { post_id: postId },
        });
      } catch (error) {
        throw mapPostsError(error as InternalServiceError);
      }
    },
    async updatePost(input: UpdatePostInput) {
      try {
        return await requestInternalJson(context, 'posts', {
          path: '/internal/v1/posts/update-post',
          method: 'POST',
          actor: toInternalActor({
            userId: input.actor.userId,
            level: input.actor.level,
            role: input.actor.role,
            communityIds: input.actor.communityIds,
            anchorCommunityId: input.actor.anchorCommunityId,
            mfaVerifiedAt: input.actor.mfaVerifiedAt,
          }),
          body: {
            post_id: input.postId,
            request: input.request,
          },
        });
      } catch (error) {
        throw mapPostsError(error as InternalServiceError);
      }
    },
    async closePost(actor, postId) {
      try {
        return await requestInternalJson(context, 'posts', {
          path: '/internal/v1/posts/close-post',
          method: 'POST',
          actor: toInternalActor({
            userId: actor.userId,
            level: actor.level,
            role: actor.role,
            communityIds: actor.communityIds,
            anchorCommunityId: actor.anchorCommunityId,
            mfaVerifiedAt: actor.mfaVerifiedAt,
          }),
          body: { post_id: postId },
        });
      } catch (error) {
        throw mapPostsError(error as InternalServiceError);
      }
    },
    async removePost(actor, postId) {
      try {
        return await requestInternalJson(context, 'posts', {
          path: '/internal/v1/posts/remove-post',
          method: 'POST',
          actor: toInternalActor({
            userId: actor.userId,
            level: actor.level,
            role: actor.role,
            communityIds: actor.communityIds,
            anchorCommunityId: actor.anchorCommunityId,
            mfaVerifiedAt: actor.mfaVerifiedAt,
          }),
          body: { post_id: postId },
        });
      } catch (error) {
        throw mapPostsError(error as InternalServiceError);
      }
    },
    async listMyPosts(input: ListMyPostsInput) {
      try {
        return await requestInternalJson(context, 'posts', {
          path: '/internal/v1/posts/list-my-posts',
          method: 'POST',
          actor: toInternalActor({
            userId: input.actor.userId,
            level: input.actor.level,
            role: input.actor.role,
            communityIds: input.actor.communityIds,
            anchorCommunityId: input.actor.anchorCommunityId,
            mfaVerifiedAt: input.actor.mfaVerifiedAt,
          }),
          body: input,
        });
      } catch (error) {
        throw mapPostsError(error as InternalServiceError);
      }
    },
    async listReviewQueue(input: ReviewQueueInput) {
      try {
        return await requestInternalJson(context, 'posts', {
          path: '/internal/v1/posts/list-review-queue',
          method: 'POST',
          actor: toInternalActor({
            userId: input.actor.userId,
            level: input.actor.level,
            role: input.actor.role,
            communityIds: input.actor.communityIds,
            anchorCommunityId: input.actor.anchorCommunityId,
            mfaVerifiedAt: input.actor.mfaVerifiedAt,
          }),
          body: input,
        });
      } catch (error) {
        throw mapPostsError(error as InternalServiceError);
      }
    },
    async decideReview(input: ReviewDecisionInput) {
      try {
        return await requestInternalJson(context, 'posts', {
          path: '/internal/v1/posts/decide-review',
          method: 'POST',
          actor: toInternalActor({
            userId: input.actor.userId,
            level: input.actor.level,
            role: input.actor.role,
            communityIds: input.actor.communityIds,
            anchorCommunityId: input.actor.anchorCommunityId,
            mfaVerifiedAt: input.actor.mfaVerifiedAt,
          }),
          body: input,
        });
      } catch (error) {
        throw mapPostsError(error as InternalServiceError);
      }
    },
    async getAdminDashboard(input: AdminDashboardInput) {
      try {
        return await requestInternalJson(context, 'posts', {
          path: '/internal/v1/posts/admin-dashboard',
          method: 'POST',
          actor: toInternalActor({
            userId: input.actor.userId,
            level: input.actor.level,
            role: input.actor.role,
            communityIds: input.actor.communityIds,
            anchorCommunityId: input.actor.anchorCommunityId,
            mfaVerifiedAt: input.actor.mfaVerifiedAt,
          }),
          body: input,
        });
      } catch (error) {
        throw mapPostsError(error as InternalServiceError);
      }
    },
    async getCommunityRules(input: CommunityRulesInput) {
      try {
        return await requestInternalJson(context, 'posts', {
          path: '/internal/v1/posts/get-community-rules',
          method: 'POST',
          actor: toInternalActor({
            userId: input.actor.userId,
            level: input.actor.level,
            role: input.actor.role,
            communityIds: input.actor.communityIds,
            anchorCommunityId: input.actor.anchorCommunityId,
            mfaVerifiedAt: input.actor.mfaVerifiedAt,
          }),
          body: input,
        });
      } catch (error) {
        throw mapPostsError(error as InternalServiceError);
      }
    },
    async updateCommunityRules(input: UpdateCommunityRulesInput) {
      try {
        return await requestInternalJson(context, 'posts', {
          path: '/internal/v1/posts/update-community-rules',
          method: 'POST',
          actor: toInternalActor({
            userId: input.actor.userId,
            level: input.actor.level,
            role: input.actor.role,
            communityIds: input.actor.communityIds,
            anchorCommunityId: input.actor.anchorCommunityId,
            mfaVerifiedAt: input.actor.mfaVerifiedAt,
          }),
          body: input,
        });
      } catch (error) {
        throw mapPostsError(error as InternalServiceError);
      }
    },
    async listAnnouncements(input: ListAnnouncementsInput) {
      try {
        return await requestInternalJson(context, 'posts', {
          path: '/internal/v1/posts/list-announcements',
          method: 'POST',
          actor: input.actor
            ? toInternalActor({
                userId: input.actor.userId,
                level: input.actor.level,
                role: input.actor.role,
                communityIds: input.actor.communityIds,
                anchorCommunityId: input.actor.anchorCommunityId,
                mfaVerifiedAt: input.actor.mfaVerifiedAt,
              })
            : undefined,
          body: input,
        });
      } catch (error) {
        throw mapPostsError(error as InternalServiceError);
      }
    },
    async createAnnouncement(input: CreateAnnouncementInput) {
      try {
        return await requestInternalJson(context, 'posts', {
          path: '/internal/v1/posts/create-announcement',
          method: 'POST',
          actor: toInternalActor({
            userId: input.actor.userId,
            level: input.actor.level,
            role: input.actor.role,
            communityIds: input.actor.communityIds,
            anchorCommunityId: input.actor.anchorCommunityId,
            mfaVerifiedAt: input.actor.mfaVerifiedAt,
          }),
          body: input,
        });
      } catch (error) {
        throw mapPostsError(error as InternalServiceError);
      }
    },
    async updateAnnouncement(input: UpdateAnnouncementInput) {
      try {
        return await requestInternalJson(context, 'posts', {
          path: '/internal/v1/posts/update-announcement',
          method: 'POST',
          actor: toInternalActor({
            userId: input.actor.userId,
            level: input.actor.level,
            role: input.actor.role,
            communityIds: input.actor.communityIds,
            anchorCommunityId: input.actor.anchorCommunityId,
            mfaVerifiedAt: input.actor.mfaVerifiedAt,
          }),
          body: input,
        });
      } catch (error) {
        throw mapPostsError(error as InternalServiceError);
      }
    },
    async deleteAnnouncement(input: DeleteAnnouncementInput) {
      try {
        return await requestInternalJson(context, 'posts', {
          path: '/internal/v1/posts/delete-announcement',
          method: 'POST',
          actor: toInternalActor({
            userId: input.actor.userId,
            level: input.actor.level,
            role: input.actor.role,
            communityIds: input.actor.communityIds,
            anchorCommunityId: input.actor.anchorCommunityId,
            mfaVerifiedAt: input.actor.mfaVerifiedAt,
          }),
          body: input,
        });
      } catch (error) {
        throw mapPostsError(error as InternalServiceError);
      }
    },
  };
}

export function createHttpMatchService(context: InternalClientContext): MatchService {
  return {
    async close() {},
    async ensureInitialSuggestions(postId: string) {
      try {
        await requestInternalJson(context, 'match', {
          path: '/internal/v1/match/ensure-initial-suggestions',
          method: 'POST',
          body: { post_id: postId },
        });
      } catch (error) {
        throw mapMatchError(error as InternalServiceError);
      }
    },
    async getSuggestions(input: GetSuggestionsInput): Promise<MatchResultsResponse> {
      try {
        return await requestInternalJson(context, 'match', {
          path: '/internal/v1/match/get-suggestions',
          method: 'POST',
          actor: toInternalActor({
            userId: input.actor.userId,
            level: input.actor.level,
            communityIds: input.actor.communityIds,
          }),
          body: {
            post_id: input.postId,
            refresh: input.refresh,
          },
        });
      } catch (error) {
        throw mapMatchError(error as InternalServiceError);
      }
    },
    async createContactRequest(actor, request: MatchContactRequest): Promise<MatchContactResponse> {
      try {
        return await requestInternalJson(context, 'match', {
          path: '/internal/v1/match/create-contact-request',
          method: 'POST',
          actor: toInternalActor({
            userId: actor.userId,
            level: actor.level,
            communityIds: actor.communityIds,
          }),
          body: request,
        });
      } catch (error) {
        throw mapMatchError(error as InternalServiceError);
      }
    },
    async listInbox(input: ListInboxInput) {
      try {
        return await requestInternalJson(context, 'match', {
          path: '/internal/v1/match/list-inbox',
          method: 'POST',
          actor: toInternalActor({
            userId: input.actor.userId,
            level: input.actor.level,
            communityIds: input.actor.communityIds,
          }),
          body: { cursor: input.cursor, limit: input.limit },
        });
      } catch (error) {
        throw mapMatchError(error as InternalServiceError);
      }
    },
    async acceptContactRequest(input: AcceptContactRequestInput) {
      try {
        return await requestInternalJson(context, 'match', {
          path: '/internal/v1/match/accept-contact-request',
          method: 'POST',
          actor: toInternalActor({
            userId: input.actor.userId,
            level: input.actor.level,
            communityIds: input.actor.communityIds,
          }),
          body: { contact_request_id: input.contactRequestId },
        });
      } catch (error) {
        throw mapMatchError(error as InternalServiceError);
      }
    },
    async rejectContactRequest(input: RejectContactRequestInput) {
      try {
        return await requestInternalJson(context, 'match', {
          path: '/internal/v1/match/reject-contact-request',
          method: 'POST',
          actor: toInternalActor({
            userId: input.actor.userId,
            level: input.actor.level,
            communityIds: input.actor.communityIds,
          }),
          body: { contact_request_id: input.contactRequestId },
        });
      } catch (error) {
        throw mapMatchError(error as InternalServiceError);
      }
    },
    async getAcceptedConversation(input: GetAcceptedConversationInput) {
      try {
        return await requestInternalJson(context, 'match', {
          path: '/internal/v1/match/get-accepted-conversation',
          method: 'POST',
          actor: toInternalActor({
            userId: input.actor.userId,
            level: input.actor.level,
            communityIds: input.actor.communityIds,
          }),
          body: { conversation_id: input.conversationId },
        });
      } catch (error) {
        throw mapMatchError(error as InternalServiceError);
      }
    },
  };
}

export function createHttpChatService(context: InternalClientContext): ChatService {
  return {
    async close() {},
    async listConversations(input: ListConversationInput) {
      try {
        return await requestInternalJson(context, 'chat', {
          path: '/internal/v1/chat/list-conversations',
          method: 'POST',
          actor: toInternalActor({
            userId: input.actor.userId,
            level: input.actor.level,
            role: input.actor.role,
            communityIds: input.actor.communityIds,
            anchorCommunityId: input.actor.anchorCommunityId,
            mfaVerifiedAt: input.actor.mfaVerifiedAt,
          }),
          body: { cursor: input.cursor, limit: input.limit },
        });
      } catch (error) {
        throw mapChatError(error as InternalServiceError);
      }
    },
    async listConversationIdsForPair(input: ListConversationIdsForPairInput) {
      try {
        return await requestInternalJson(context, 'chat', {
          path: '/internal/v1/chat/list-conversation-ids-for-pair',
          method: 'POST',
          actor: toInternalActor({
            userId: input.actor.userId,
            level: input.actor.level,
          }),
          body: { other_user_id: input.otherUserId },
        });
      } catch (error) {
        throw mapChatError(error as InternalServiceError);
      }
    },
    async getConversation(input: GetConversationInput) {
      try {
        return await requestInternalJson(context, 'chat', {
          path: '/internal/v1/chat/get-conversation',
          method: 'POST',
          actor: toInternalActor({
            userId: input.actor.userId,
            level: input.actor.level,
            role: input.actor.role,
            communityIds: input.actor.communityIds,
            anchorCommunityId: input.actor.anchorCommunityId,
            mfaVerifiedAt: input.actor.mfaVerifiedAt,
          }),
          body: { conversation_id: input.conversationId },
        });
      } catch (error) {
        throw mapChatError(error as InternalServiceError);
      }
    },
    async listMessages(input: ListMessagesInput) {
      try {
        return await requestInternalJson(context, 'chat', {
          path: '/internal/v1/chat/list-messages',
          method: 'POST',
          actor: toInternalActor({
            userId: input.actor.userId,
            level: input.actor.level,
            role: input.actor.role,
            communityIds: input.actor.communityIds,
            anchorCommunityId: input.actor.anchorCommunityId,
            mfaVerifiedAt: input.actor.mfaVerifiedAt,
          }),
          body: {
            conversation_id: input.conversationId,
            cursor: input.cursor,
            limit: input.limit,
          },
        });
      } catch (error) {
        throw mapChatError(error as InternalServiceError);
      }
    },
    async sendMessage(input: SendMessageInput) {
      try {
        return await requestInternalJson(context, 'chat', {
          path: '/internal/v1/chat/send-message',
          method: 'POST',
          actor: toInternalActor({
            userId: input.actor.userId,
            level: input.actor.level,
            role: input.actor.role,
            communityIds: input.actor.communityIds,
            anchorCommunityId: input.actor.anchorCommunityId,
            mfaVerifiedAt: input.actor.mfaVerifiedAt,
          }),
          body: {
            conversation_id: input.conversationId,
            body: input.body,
          },
        });
      } catch (error) {
        throw mapChatError(error as InternalServiceError);
      }
    },
    async closeConversation(input: CloseConversationInput) {
      try {
        return await requestInternalJson(context, 'chat', {
          path: '/internal/v1/chat/close-conversation',
          method: 'POST',
          actor: toInternalActor({
            userId: input.actor.userId,
            level: input.actor.level,
            role: input.actor.role,
            communityIds: input.actor.communityIds,
            anchorCommunityId: input.actor.anchorCommunityId,
            mfaVerifiedAt: input.actor.mfaVerifiedAt,
          }),
          body: {
            conversation_id: input.conversationId,
          },
        });
      } catch (error) {
        throw mapChatError(error as InternalServiceError);
      }
    },
    async blockUser(input: BlockUserInput) {
      try {
        return await requestInternalJson(context, 'chat', {
          path: '/internal/v1/chat/block-user',
          method: 'POST',
          actor: toInternalActor({
            userId: input.actor.userId,
            level: input.actor.level,
            role: input.actor.role,
            communityIds: input.actor.communityIds,
            anchorCommunityId: input.actor.anchorCommunityId,
            mfaVerifiedAt: input.actor.mfaVerifiedAt,
          }),
          body: {
            conversation_id: input.conversationId,
            blocked_user_id: input.blockedUserId,
          },
        });
      } catch (error) {
        throw mapChatError(error as InternalServiceError);
      }
    },
    async submitReport(input: SubmitReportInput) {
      try {
        return await requestInternalJson(context, 'chat', {
          path: '/internal/v1/chat/submit-report',
          method: 'POST',
          actor: toInternalActor({
            userId: input.actor.userId,
            level: input.actor.level,
            role: input.actor.role,
            communityIds: input.actor.communityIds,
            anchorCommunityId: input.actor.anchorCommunityId,
            mfaVerifiedAt: input.actor.mfaVerifiedAt,
          }),
          body: {
            conversation_id: input.conversationId,
            target_type: input.targetType,
            target_id: input.targetId,
            reason: input.reason,
            detail_text: input.detailText,
            target_community_ids: input.targetCommunityIds,
          },
        });
      } catch (error) {
        throw mapChatError(error as InternalServiceError);
      }
    },
    async listReportQueue(input: AdminReportQueueInput) {
      try {
        return await requestInternalJson(context, 'chat', {
          path: '/internal/v1/chat/list-report-queue',
          method: 'POST',
          actor: toInternalActor({
            userId: input.actor.userId,
            level: input.actor.level,
            role: input.actor.role,
            communityIds: input.actor.communityIds,
            anchorCommunityId: input.actor.anchorCommunityId,
            mfaVerifiedAt: input.actor.mfaVerifiedAt,
          }),
          body: {
            community_id: input.communityId,
            status: input.status,
            cursor: input.cursor,
            limit: input.limit,
          },
        });
      } catch (error) {
        throw mapChatError(error as InternalServiceError);
      }
    },
    async decideReport(input: ReportDecisionInput) {
      try {
        return await requestInternalJson(context, 'chat', {
          path: '/internal/v1/chat/decide-report',
          method: 'POST',
          actor: toInternalActor({
            userId: input.actor.userId,
            level: input.actor.level,
            role: input.actor.role,
            communityIds: input.actor.communityIds,
            anchorCommunityId: input.actor.anchorCommunityId,
            mfaVerifiedAt: input.actor.mfaVerifiedAt,
          }),
          body: {
            community_id: input.communityId,
            report_id: input.reportId,
            decision: input.decision,
            notes: input.notes,
          },
        });
      } catch (error) {
        throw mapChatError(error as InternalServiceError);
      }
    },
  };
}

export function createHttpResourceDirectoryService(context: InternalClientContext): ResourceDirectoryService {
  return {
    async searchResources(input): Promise<ResourceSearchResult> {
      try {
        return await requestInternalJson(context, 'resource-directory', {
          path: '/internal/v1/resource-directory/search-resources',
          method: 'POST',
          body: input,
        });
      } catch (error) {
        const internalError = error as InternalServiceError;
        if (internalError.statusCode === 400 && internalError.message === 'Cursor is not valid') {
          const cursorError = new Error(internalError.message);
          cursorError.name = 'InvalidCursorError';
          throw cursorError;
        }
        throw internalError;
      }
    },
    async getResourceDetail(providerId: string, zip?: string): Promise<ResourceListItem | null> {
      return await requestInternalJson(context, 'resource-directory', {
        path: '/internal/v1/resource-directory/get-resource-detail',
        method: 'POST',
        body: { provider_id: providerId, zip },
      });
    },
    async close() {},
  };
}
