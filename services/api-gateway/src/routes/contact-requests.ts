import {
  contactRequestInboxQuerySchema as inboxQueryValidator,
  contactRequestParamsSchema as contactRequestParamsValidator,
} from "@weavenyc/shared";
import { MatchServiceError } from "@weavenyc/match";
import type { FastifyPluginAsync } from "fastify";

import {
  contactRequestDecisionResponseSchema,
  contactRequestInboxResponseSchema,
  contactRequestInboxQuerySchema,
  contactRequestParamsSchema,
  errorResponseSchema,
} from "../contracts.js";
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
        return await app.matchService.acceptContactRequest({
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
