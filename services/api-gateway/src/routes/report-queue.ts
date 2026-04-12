import {
  adminReportQueueStatusSchema as adminReportQueueStatusValidator,
  reportDecisionRequestSchema as adminReportDecisionBodyValidator,
} from "@weavenyc/shared";
import type { FastifyPluginAsync } from "fastify";

import {
  adminReportDecisionRequestSchema,
  adminReportDecisionResponseSchema,
  adminReportQueueQuerySchema,
  adminReportQueueResponseSchema,
  errorResponseSchema,
} from "../contracts.js";
import { isAnchorForCommunity, loadCurrentActor } from "../lib/require-anchor.js";

type ReportQueueQuery = {
  community_id: string;
  status?: "new" | "resolved" | "dismissed";
  cursor?: string;
  limit?: number;
};

type ReportDecisionParams = {
  report_id: string;
};

type ReportDecisionBody = {
  decision: "dismiss" | "warn" | "remove_post" | "suspend_user";
  notes?: string;
};

export const reportQueueRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: ReportQueueQuery }>(
    "/v1/admin/report_queue",
    {
      schema: {
        summary: "List report queue items for an anchor-managed community",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        querystring: adminReportQueueQuerySchema,
        response: {
          200: adminReportQueueResponseSchema,
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
          return { message: "User not found" };
        }

        const { community_id, status, cursor, limit } = request.query;
        if (!isAnchorForCommunity(actor, community_id)) {
          reply.code(403);
          return { message: "Only anchors can access this report queue" };
        }

        return await app.chatService.listReportQueue({
          actor,
          communityId: community_id,
          status: status ? adminReportQueueStatusValidator.parse(status) : undefined,
          cursor: cursor ?? null,
          limit,
        });
      } catch (error) {
        return replyWithChatError(reply, error);
      }
    },
  );

  app.post<{ Params: ReportDecisionParams; Body: ReportDecisionBody }>(
    "/v1/admin/report_queue/:report_id/decision",
    {
      schema: {
        summary: "Apply an anchor moderation decision to a report",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          additionalProperties: false,
          required: ["report_id"],
          properties: {
            report_id: { type: "string", format: "uuid" },
          },
        },
        body: adminReportDecisionRequestSchema,
        response: {
          200: adminReportDecisionResponseSchema,
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
          return { message: "User not found" };
        }

        const communityId =
          actor.anchorCommunityId ??
          (actor.communityIds.length === 1 ? actor.communityIds[0] : null);
        if (!communityId || !isAnchorForCommunity(actor, communityId)) {
          reply.code(403);
          return { message: "Only anchors can manage report decisions" };
        }

        const body = adminReportDecisionBodyValidator.parse(request.body);
        const decision = await app.chatService.decideReport({
          actor,
          communityId,
          reportId: request.params.report_id,
          decision: body.decision,
          notes: body.notes,
        });
        if (decision.resolution === "suspend_user" && decision.affected_user_id) {
          app.chatRealtimeHub.disconnectUser(decision.affected_user_id, "Suspended user");
        }
        return decision;
      } catch (error) {
        return replyWithChatError(reply, error);
      }
    },
  );
};

function replyWithChatError(reply: { code(statusCode: number): unknown }, error: unknown) {
  if (error && typeof error === "object" && "name" in error && error.name === "ChatServiceError") {
    const chatError = error as unknown as { code: string; message: string };
    const statusCode =
      chatError.code === "not_found"
        ? 404
        : chatError.code === "forbidden"
          ? 403
          : 400;
    reply.code(statusCode);
    return { message: chatError.message };
  }

  throw error;
}
