import {
  postParamsSchema as postParamsValidator,
  reviewDecisionRequestSchema as reviewDecisionBodySchema,
  reviewQueueQuerySchema as reviewQueueQueryValidator,
} from '@weavenyc/shared';
import { PostsServiceError } from '@weavenyc/posts';
import type { FastifyPluginAsync } from 'fastify';

import {
  errorResponseSchema,
  postParamsSchema,
  reviewDecisionRequestSchema,
  reviewDecisionResponseSchema,
  reviewQueueListResponseSchema,
  reviewQueueQuerySchema,
} from '../contracts.js';
import { fanoutSyncEvents, publishModerationDecisionEvent, publishPostEvent } from '../lib/p2p-events.js';
import { isAnchorForCommunity, loadCurrentActor } from '../lib/require-anchor.js';

type ReviewQueueQuery = {
  community_id: string;
  cursor?: string;
  limit?: number;
};

type ReviewDecisionParams = {
  post_id: string;
};

export const reviewQueueRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: ReviewQueueQuery }>(
    '/v1/admin/review_queue',
    {
      schema: {
        summary: 'List pending-review posts for an anchor-managed community',
        tags: ['admin'],
        security: [{ bearerAuth: [] }],
        querystring: reviewQueueQuerySchema,
        response: {
          200: reviewQueueListResponseSchema,
          403: errorResponseSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      try {
        const actor =
          request.currentUser ??
          (await loadCurrentActor(app, request.user.sub, request.user.mfa_verified_at));
        if (!actor) {
          reply.code(404);
          return { message: 'User not found' };
        }

        const query = reviewQueueQueryValidator.parse(request.query);
        if (!isAnchorForCommunity(actor, query.community_id)) {
          reply.code(403);
          return { message: 'Only anchors can access this review queue' };
        }

        return await app.postsService.listReviewQueue({
          actor,
          communityId: query.community_id,
          cursor: query.cursor ?? null,
          limit: query.limit,
        });
      } catch (error) {
        return replyWithPostsError(reply, error);
      }
    }
  );

  app.post<{ Params: ReviewDecisionParams }>(
    '/v1/admin/review_queue/:post_id/decision',
    {
      schema: {
        summary: 'Apply an anchor review decision to a pending post',
        tags: ['admin'],
        security: [{ bearerAuth: [] }],
        params: postParamsSchema,
        body: reviewDecisionRequestSchema,
        response: {
          200: reviewDecisionResponseSchema,
          400: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      try {
        const actor =
          request.currentUser ??
          (await loadCurrentActor(app, request.user.sub, request.user.mfa_verified_at));
        if (!actor) {
          reply.code(404);
          return { message: 'User not found' };
        }

        if (!isAnchorForCommunity(actor, actor.anchorCommunityId ?? '')) {
          reply.code(403);
          return { message: 'Only anchors can review posts' };
        }

        const params = postParamsValidator.parse(request.params);
        const body = reviewDecisionBodySchema.parse(request.body);
        const decision = await app.postsService.decideReview({
          actor,
          postId: params.post_id,
          decision: body.decision,
          notes: body.notes,
        });
        const postDetail = await app.postsService.getPostDetail(actor, params.post_id);
        if (decision.syncEvents !== undefined) {
          await fanoutSyncEvents(app, decision.syncEvents, { postId: decision.post_id });
        } else {
          await publishPostEvent(app, {
            eventType: postDetail.status === 'removed' ? 'post.tombstoned' : 'post.updated',
            post: postDetail,
            actorUserId: actor.userId,
            reason: body.decision,
          });
          await publishModerationDecisionEvent(app, {
            communityId: postDetail.community_id,
            aggregateId: decision.moderationActionId ?? postDetail.post_id,
            actorUserId: actor.userId,
            reportId: `post-review:${decision.post_id}:${decision.decided_at}`,
            targetType: 'post',
            targetId: decision.post_id,
            reportTargetType: 'post',
            reportTargetId: decision.post_id,
            resolution: body.decision,
            status: decision.status,
            decidedAt: decision.decided_at,
          });
        }

        await app.analyticsRecorder.recordEvent({
          event_type: 'anchor_decision',
          community_id: postDetail.community_id,
          actor_user_id: actor.userId,
          payload: {
            decision: body.decision,
            target_type: 'post',
            post_id: decision.post_id,
            status: decision.status,
          },
        });

        if (body.decision === 'approve' && decision.status === 'active') {
          await app.analyticsRecorder.recordEvent({
            event_type: 'post_published',
            community_id: postDetail.community_id,
            actor_user_id: postDetail.is_owner ? actor.userId : undefined,
            payload: {
              post_id: decision.post_id,
              post_type: postDetail.post_type,
              category: postDetail.category,
              risk_level: postDetail.risk_level,
              via: 'anchor_review',
            },
          });
        }

        const response = { ...decision };
        delete response.moderationActionId;
        delete response.syncEvents;
        return response;
      } catch (error) {
        return replyWithPostsError(reply, error);
      }
    }
  );
};

function replyWithPostsError(
  reply: { code(statusCode: number): unknown },
  error: unknown
) {
  if (error instanceof PostsServiceError) {
    const statusCode =
      error.code === 'not_found'
        ? 404
        : error.code === 'membership_required' || error.code === 'verified_required' || error.code === 'forbidden'
          ? 403
          : 400;
    reply.code(statusCode);
    return {
      message: error.message,
    };
  }

  throw error;
}
