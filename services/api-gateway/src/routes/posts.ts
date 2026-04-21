import {
  createPostRequestSchema as createPostBodySchema,
  postMineQuerySchema as myPostsQueryValidator,
  postParamsSchema as postParamsValidator,
  postsListQuerySchema as postsQueryValidator,
  updatePostRequestSchema as updatePostBodySchema,
} from '@weavenyc/shared';
import { MatchServiceError } from '@weavenyc/match';
import { PostsServiceError } from '@weavenyc/posts';
import type { FastifyPluginAsync } from 'fastify';

import {
  createPostRequestSchema,
  createPostResponseSchema,
  errorResponseSchema,
  myPostsQuerySchema,
  postDetailSchema,
  postParamsSchema,
  postsListResponseSchema,
  postsQuerySchema,
  updatePostRequestSchema,
} from '../contracts.js';
import { withIdempotency } from '../lib/idempotency.js';
import { fanoutSyncEvents, publishPostEvent } from '../lib/p2p-events.js';
import { loadCurrentActor } from '../lib/require-anchor.js';

type PostParams = {
  post_id: string;
};

type PostsQuery = {
  scope: 'community' | 'public';
  community_id?: string;
  post_type?: 'request' | 'offer';
  category?: 'food' | 'goods' | 'childcare' | 'companionship' | 'translation' | 'transportation' | 'other';
  status?: 'draft' | 'pending_review' | 'active' | 'fulfilled' | 'closed' | 'removed';
  cursor?: string;
  limit?: number;
};

type MyPostsQuery = {
  community_id?: string;
  status?: 'draft' | 'pending_review' | 'active' | 'fulfilled' | 'closed' | 'removed';
  cursor?: string;
  limit?: number;
};

export const postRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/v1/posts',
    {
      schema: {
        summary: 'Create a new community request or offer post',
        tags: ['posts'],
        security: [{ bearerAuth: [] }],
        body: createPostRequestSchema,
        response: {
          200: createPostResponseSchema,
          400: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      try {
        const actor = await requireActor(app, request.user.sub, reply);
        if (!actor) {
          return;
        }

        // A7 P0-2: wrap post-create with HTTP idempotency. Clients that send
        // `Idempotency-Key` (typically the draft's client_id from PR #47's
        // outbox, or a fresh randomUUID() on publish-button-tap) see the
        // original response replayed verbatim on retry. Legacy clients that
        // omit the header fall through to the normal handler.
        return await withIdempotency({
          app,
          request,
          reply,
          routeName: 'posts.create',
          userId: actor.userId,
          handler: async () => {
            const body = createPostBodySchema.parse(request.body);
            const created = await app.postsService.createPost({
              actor,
              request: body,
            });

            if (body.post_type === 'request' && created.status === 'active') {
              await tryPrecomputeMatches(app.matchService, created.postId);
            }

            if (created.syncEvents !== undefined) {
              await fanoutSyncEvents(app, created.syncEvents, { postId: created.postId });
            } else {
              const detail = await app.postsService.getPostDetail(actor, created.postId);
              await publishPostEvent(app, {
                eventType: 'post.published',
                post: detail,
                actorUserId: actor.userId,
              });
            }

            if (created.status === 'active') {
              await app.analyticsRecorder.recordEvent({
                event_type: 'post_published',
                community_id: body.community_id,
                actor_user_id: actor.userId,
                payload: {
                  post_id: created.postId,
                  post_type: body.post_type,
                  category: body.category,
                  risk_level: created.riskLevel,
                },
              });
            }

            return {
              post_id: created.postId,
              status: created.status,
              risk_level: created.riskLevel,
            };
          },
        });
      } catch (error) {
        return replyWithPostsError(reply, error);
      }
    }
  );

  app.get<{ Querystring: PostsQuery }>(
    '/v1/posts',
    {
      schema: {
        summary: 'List community or public posts visible to the current user',
        tags: ['posts'],
        security: [{ bearerAuth: [] }],
        querystring: postsQuerySchema,
        response: {
          200: postsListResponseSchema,
          400: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      try {
        const actor = await requireActor(app, request.user.sub, reply);
        if (!actor) {
          return;
        }

        const query = postsQueryValidator.parse(request.query);
        return await app.postsService.listPosts({
          actor,
          scope: query.scope,
          communityId: query.community_id,
          postType: query.post_type,
          category: query.category,
          status: query.status,
          cursor: query.cursor ?? null,
          limit: query.limit,
        });
      } catch (error) {
        return replyWithPostsError(reply, error);
      }
    }
  );

  app.get<{ Querystring: MyPostsQuery }>(
    '/v1/posts/mine',
    {
      schema: {
        summary: 'List posts created by the current user',
        tags: ['posts'],
        security: [{ bearerAuth: [] }],
        querystring: myPostsQuerySchema,
        response: {
          200: postsListResponseSchema,
          400: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      try {
        const actor = await requireActor(app, request.user.sub, reply);
        if (!actor) {
          return;
        }

        const query = myPostsQueryValidator.parse(request.query);
        return await app.postsService.listMyPosts({
          actor,
          communityId: query.community_id,
          status: query.status,
          cursor: query.cursor ?? null,
          limit: query.limit,
        });
      } catch (error) {
        return replyWithPostsError(reply, error);
      }
    }
  );

  app.get<{ Params: PostParams }>(
    '/v1/posts/:post_id',
    {
      schema: {
        summary: 'Get the detail view for a post',
        tags: ['posts'],
        security: [{ bearerAuth: [] }],
        params: postParamsSchema,
        response: {
          200: postDetailSchema,
          400: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      try {
        const actor = await requireActor(app, request.user.sub, reply);
        if (!actor) {
          return;
        }

        const params = postParamsValidator.parse(request.params);
        return await app.postsService.getPostDetail(actor, params.post_id);
      } catch (error) {
        return replyWithPostsError(reply, error);
      }
    }
  );

  app.patch<{ Params: PostParams }>(
    '/v1/posts/:post_id',
    {
      schema: {
        summary: 'Update an existing post owned by the current user',
        tags: ['posts'],
        security: [{ bearerAuth: [] }],
        params: postParamsSchema,
        body: updatePostRequestSchema,
        response: {
          200: postDetailSchema,
          400: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      try {
        const actor = await requireActor(app, request.user.sub, reply);
        if (!actor) {
          return;
        }

        const params = postParamsValidator.parse(request.params);
        const body = updatePostBodySchema.parse(request.body);
        const updated = await app.postsService.updatePost({
          actor,
          postId: params.post_id,
          request: body,
        });

        if (updated.post_type === 'request' && updated.status === 'active') {
          await tryPrecomputeMatches(app.matchService, updated.post_id);
        }

        if (updated.syncEvents !== undefined) {
          await fanoutSyncEvents(app, updated.syncEvents, { postId: updated.post_id });
        } else {
          await publishPostEvent(app, {
            eventType: updated.status === 'removed' ? 'post.tombstoned' : 'post.updated',
            post: updated,
            actorUserId: actor.userId,
          });
        }

        const response = { ...updated };
        delete response.syncEvents;
        return response;
      } catch (error) {
        return replyWithPostsError(reply, error);
      }
    }
  );

  app.post<{ Params: PostParams }>(
    '/v1/posts/:post_id/close',
    {
      schema: {
        summary: 'Close a post owned by the current user',
        tags: ['posts'],
        security: [{ bearerAuth: [] }],
        params: postParamsSchema,
        response: {
          200: postDetailSchema,
          400: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      try {
        const actor = await requireActor(app, request.user.sub, reply);
        if (!actor) {
          return;
        }

        const params = postParamsValidator.parse(request.params);
        const updated = await app.postsService.closePost(actor, params.post_id);
        if (updated.syncEvents !== undefined) {
          await fanoutSyncEvents(app, updated.syncEvents, { postId: updated.post_id });
        } else {
          await publishPostEvent(app, {
            eventType: 'post.updated',
            post: updated,
            actorUserId: actor.userId,
          });
        }
        const response = { ...updated };
        delete response.syncEvents;
        return response;
      } catch (error) {
        return replyWithPostsError(reply, error);
      }
    }
  );

  app.delete<{ Params: PostParams }>(
    '/v1/posts/:post_id',
    {
      schema: {
        summary: 'Soft delete a post owned by the current user',
        tags: ['posts'],
        security: [{ bearerAuth: [] }],
        params: postParamsSchema,
        response: {
          200: postDetailSchema,
          400: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      try {
        const actor = await requireActor(app, request.user.sub, reply);
        if (!actor) {
          return;
        }

        const params = postParamsValidator.parse(request.params);
        const removed = await app.postsService.removePost(actor, params.post_id);
        if (removed.syncEvents !== undefined) {
          await fanoutSyncEvents(app, removed.syncEvents, { postId: removed.post_id });
        } else {
          await publishPostEvent(app, {
            eventType: 'post.tombstoned',
            post: removed,
            actorUserId: actor.userId,
          });
        }
        const response = { ...removed };
        delete response.syncEvents;
        return response;
      } catch (error) {
        return replyWithPostsError(reply, error);
      }
    }
  );
};

async function requireActor(
  app: Parameters<typeof loadCurrentActor>[0],
  userId: string,
  reply: { code(statusCode: number): unknown }
) {
  const actor = await loadCurrentActor(app, userId);
  if (!actor) {
    reply.code(404);
    return null;
  }

  return actor;
}

async function tryPrecomputeMatches(
  matchService: { ensureInitialSuggestions(postId: string): Promise<void> },
  postId: string
) {
  try {
    await matchService.ensureInitialSuggestions(postId);
  } catch (error) {
    if (error instanceof MatchServiceError && error.code === 'resource_fallback_unavailable') {
      return;
    }
    throw error;
  }
}

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
