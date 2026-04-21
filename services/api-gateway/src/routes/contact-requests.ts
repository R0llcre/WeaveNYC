import {
  contactRequestInboxQuerySchema as inboxQueryValidator,
  contactRequestParamsSchema as contactRequestParamsValidator,
} from "@weavenyc/shared";
import { MatchServiceError } from "@weavenyc/match";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import {
  contactRequestDecisionResponseSchema,
  contactRequestInboxResponseSchema,
  contactRequestInboxQuerySchema,
  contactRequestParamsSchema,
  errorResponseSchema,
} from "../contracts.js";
import { recordVerifiedMatch } from "../lib/metrics.js";
import { loadCurrentActor } from "../lib/require-anchor.js";

type ContactRequestParams = {
  contact_request_id: string;
};

type InboxQuery = {
  cursor?: string;
  limit?: number;
};

export const contactRequestRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: InboxQuery }>(
    "/v1/contact-requests/inbox",
    {
      schema: {
        summary: "List pending contact requests for the current user",
        tags: ["contact-requests"],
        security: [{ bearerAuth: [] }],
        querystring: contactRequestInboxQuerySchema,
        response: {
          200: contactRequestInboxResponseSchema,
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

        const query = inboxQueryValidator.parse(request.query);
        return await app.matchService.listInbox({
          actor: {
            userId: actor.userId,
            level: actor.level,
            communityIds: actor.communityIds,
          },
          cursor: query.cursor ?? null,
          limit: query.limit,
        });
      } catch (error) {
        return replyWithMatchError(reply, error);
      }
    },
  );

  app.post<{ Params: ContactRequestParams }>(
    "/v1/contact-requests/:contact_request_id/accept",
    {
      schema: {
        summary: "Accept a pending contact request and create a live conversation",
        tags: ["contact-requests"],
        security: [{ bearerAuth: [] }],
        params: contactRequestParamsSchema,
        response: {
          200: contactRequestDecisionResponseSchema,
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

        const params = contactRequestParamsValidator.parse(request.params);
        const decision = await app.matchService.acceptContactRequest({
          actor: {
            userId: actor.userId,
            level: actor.level,
            communityIds: actor.communityIds,
          },
          contactRequestId: params.contact_request_id,
        });

        // A3 P0-1: only fire analytics + increment the Prometheus counter
        // when the call transitioned the request from pending → accepted.
        // Re-accepting an already-accepted request returns the same payload
        // but with `is_new_accept: false`, and must NOT double-count the
        // match. Legacy builds that don't emit the flag default to `true`
        // so behaviour is preserved for in-flight clients.
        if (
          decision.status === "accepted" &&
          decision.conversation_id &&
          decision.is_new_accept !== false
        ) {
          try {
            const conversation = await app.matchService.getAcceptedConversation({
              actor: {
                userId: actor.userId,
                level: actor.level,
                communityIds: actor.communityIds,
              },
              conversationId: decision.conversation_id,
            });
            const [fromPostId, toPostId] = conversation.related_post_ids;
            const communityId = await getPostCommunityId(app, actor, toPostId ?? fromPostId ?? null);

            await app.analyticsRecorder.recordEvent({
              event_type: "contact_accepted",
              community_id: communityId ?? undefined,
              actor_user_id: actor.userId,
              payload: {
                from_post_id: fromPostId,
                to_post_id: toPostId,
                conversation_id: decision.conversation_id,
                candidate_type: "neighbor_post",
              },
            });

            // Verified matches are neighbor-to-neighbor accepted contacts,
            // excluding official resource bounces. Only neighbor_post
            // candidates can progress to an accepted contact request via
            // `MatchService.createContactRequest`, so every accepted contact
            // here qualifies as a verified match.
            await app.analyticsRecorder.recordEvent({
              event_type: "verified_match_created",
              community_id: communityId ?? undefined,
              actor_user_id: actor.userId,
              payload: {
                from_post_id: fromPostId,
                to_post_id: toPostId,
                conversation_id: decision.conversation_id,
              },
            });
            recordVerifiedMatch(app);
          } catch (error) {
            app.log.warn(
              { err: error, contactRequestId: params.contact_request_id },
              "Failed to record contact_accepted analytics event",
            );
          }
        }

        // Don't leak the internal is_new_accept flag to the HTTP response.
        // The shared validator makes it optional so legacy clients that
        // ignore it stay compatible; omitting from the HTTP payload keeps
        // the wire format unchanged.
        const { is_new_accept: _isNewAccept, ...responsePayload } = decision;
        void _isNewAccept;
        return responsePayload;
      } catch (error) {
        return replyWithMatchError(reply, error);
      }
    },
  );

  app.post<{ Params: ContactRequestParams }>(
    "/v1/contact-requests/:contact_request_id/reject",
    {
      schema: {
        summary: "Reject a pending contact request",
        tags: ["contact-requests"],
        security: [{ bearerAuth: [] }],
        params: contactRequestParamsSchema,
        response: {
          200: contactRequestDecisionResponseSchema,
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

        const params = contactRequestParamsValidator.parse(request.params);
        return await app.matchService.rejectContactRequest({
          actor: {
            userId: actor.userId,
            level: actor.level,
            communityIds: actor.communityIds,
          },
          contactRequestId: params.contact_request_id,
        });
      } catch (error) {
        return replyWithMatchError(reply, error);
      }
    },
  );
};

async function requireActor(
  app: Parameters<typeof loadCurrentActor>[0],
  userId: string,
  reply: { code(statusCode: number): unknown },
) {
  const actor = await loadCurrentActor(app, userId);
  if (!actor) {
    reply.code(404);
    return null;
  }

  return actor;
}

async function getPostCommunityId(
  app: FastifyInstance,
  actor: Awaited<ReturnType<typeof loadCurrentActor>>,
  postId: string | null,
): Promise<string | null> {
  if (!postId || !actor) {
    return null;
  }
  try {
    const detail = await app.postsService.getPostDetail(actor, postId);
    return detail.community_id;
  } catch {
    return null;
  }
}

function replyWithMatchError(reply: { code(statusCode: number): unknown }, error: unknown) {
  if (error instanceof MatchServiceError) {
    const matchError = error;
    const statusCode =
      matchError.code === "not_found"
        ? 404
        : matchError.code === "forbidden" || matchError.code === "verified_required"
          ? 403
          : 400;
    reply.code(statusCode);
    return {
      message: matchError.message,
    };
  }

  throw error;
}
