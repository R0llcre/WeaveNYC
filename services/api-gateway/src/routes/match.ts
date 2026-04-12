import {
  matchContactRequestSchema as matchContactBodyValidator,
  matchResultsQuerySchema as matchResultsQueryValidator,
  postParamsSchema as postParamsValidator,
} from "@weavenyc/shared";
import { MatchServiceError } from "@weavenyc/match";
import type { FastifyPluginAsync } from "fastify";

import {
  errorResponseSchema,
  matchContactRequestSchema,
  matchContactResponseSchema,
  matchResultsQuerySchema,
  matchResultsResponseSchema,
  postParamsSchema,
} from "../contracts.js";
import { loadCurrentActor } from "../lib/require-anchor.js";

type MatchParams = {
  post_id: string;
};

type MatchQuery = {
  refresh?: boolean;
};

type MatchContactBody = {
  from_post_id: string;
  to_post_id: string;
};

export const matchRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: MatchParams; Querystring: MatchQuery }>(
    "/v1/posts/:post_id/matches",
    {
      schema: {
        summary: "Get action-plan matches for an active request post",
        tags: ["match"],
        security: [{ bearerAuth: [] }],
        params: postParamsSchema,
        querystring: matchResultsQuerySchema,
        response: {
          200: matchResultsResponseSchema,
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
        const query = matchResultsQueryValidator.parse(request.query);
        return await app.matchService.getSuggestions({
          actor: {
            userId: actor.userId,
            level: actor.level,
            communityIds: actor.communityIds,
          },
          postId: params.post_id,
          refresh: query.refresh ?? false,
        });
      } catch (error) {
        return replyWithMatchError(reply, error);
      }
    },
  );

  app.post<{ Body: MatchContactBody }>(
    "/v1/match/contact",
    {
      schema: {
        summary: "Create or reuse a contact request for a matched offer",
        tags: ["match"],
        security: [{ bearerAuth: [] }],
        body: matchContactRequestSchema,
        response: {
          200: matchContactResponseSchema,
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

        const body = matchContactBodyValidator.parse(request.body);
        return await app.matchService.createContactRequest(
          {
            userId: actor.userId,
            level: actor.level,
            communityIds: actor.communityIds,
          },
          body,
        );
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
