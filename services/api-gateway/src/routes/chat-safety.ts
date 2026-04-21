import {
  blockUserRequestSchema as blockUserBodyValidator,
  reportCreateRequestSchema as reportCreateBodyValidator,
} from "@weavenyc/shared";
import type { FastifyPluginAsync } from "fastify";

import {
  blockUserRequestSchema,
  blockUserResponseSchema,
  errorResponseSchema,
  reportCreateRequestSchema,
  reportCreateResponseSchema,
} from "../contracts.js";
import { withIdempotency } from "../lib/idempotency.js";
import {
  fanoutSyncEvents,
  publishModerationDecisionEvent,
  publishPostEvent,
  publishReportCreatedEvent,
} from "../lib/p2p-events.js";
import { loadCurrentActor } from "../lib/require-anchor.js";

type BlockUserBody = {
  blocked_user_id: string;
  conversation_id?: string;
};

type ReportCreateBody = {
  target_type: "post" | "user" | "message";
  target_id: string;
  reason: "harassment" | "scam" | "misinformation" | "unsafe_behavior" | "other";
  conversation_id?: string;
  evidence_description?: string;
};

export const chatSafetyRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: BlockUserBody }>(
    "/v1/blocks",
    {
      schema: {
        summary: "Block a user across all shared conversations",
        tags: ["safety"],
        security: [{ bearerAuth: [] }],
        body: blockUserRequestSchema,
        response: {
          200: blockUserResponseSchema,
          400: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
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

        const body = blockUserBodyValidator.parse(request.body);
        const actorIdentity = {
          userId: actor.userId,
          level: actor.level,
        };
        const affectedConversationIds = await listConversationIdsForBlockedUser(
          app,
          actorIdentity,
          body.blocked_user_id,
        );
        const conversationId = body.conversation_id ?? affectedConversationIds[0];

        if (!conversationId) {
          reply.code(404);
          return {
            message: "Conversation not found for this blocked user",
          };
        }

        if (!affectedConversationIds.includes(conversationId)) {
          reply.code(404);
          return {
            message: "Conversation not found for this blocked user",
          };
        }
        const result = await app.chatService.blockUser({
          actor: actorIdentity,
          conversationId,
          blockedUserId: body.blocked_user_id,
        });

        for (const affectedConversation of result.affectedConversations) {
          const updatedConversation = {
            ...affectedConversation,
            status: "blocked" as const,
            last_activity_at: result.block.created_at,
            unread_count: 0,
          };
          await app.chatRealtimeHub.publishToUsers(
            affectedConversation.participant_preview.map((participant) => participant.user_id),
            {
              event_type: "conversation.updated",
              occurred_at: result.block.created_at,
              conversation: {
                conversation_id: updatedConversation.conversation_id,
                contact_request_id: updatedConversation.contact_request_id,
                related_post_ids: updatedConversation.related_post_ids,
                participant_preview: updatedConversation.participant_preview,
                status: updatedConversation.status,
                created_at: updatedConversation.created_at,
                last_activity_at: updatedConversation.last_activity_at,
                last_message_preview: updatedConversation.last_message_preview,
                unread_count: updatedConversation.unread_count,
              },
            },
          );
        }

        return {
          blocked_user_id: result.block.blocked_user_id,
          status: "blocked",
          blocked_at: result.block.created_at,
          affected_conversation_ids: affectedConversationIds,
        };
      } catch (error) {
        return replyWithChatError(reply, error);
      }
    },
  );

  app.post<{ Body: ReportCreateBody }>(
    "/v1/reports",
    {
      schema: {
        summary: "Create a report for a post, user, or message",
        tags: ["safety"],
        security: [{ bearerAuth: [] }],
        body: reportCreateRequestSchema,
        response: {
          200: reportCreateResponseSchema,
          400: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
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

        // A7 P0-3: report submit is idempotent at the HTTP layer. Below the
        // gateway, the new partial unique index `uq_reports_reporter_target_active`
        // (migration 0014) enforces the same invariant at the database
        // layer so the same user cannot stack multiple 'new' reports
        // against the same target.
        return await withIdempotency({
          app,
          request,
          reply,
          routeName: "chatSafety.createReport",
          userId: actor.userId,
          handler: async () => {
            const body = reportCreateBodyValidator.parse(request.body);
            const targetUser =
              body.target_type === "user" && !body.conversation_id
                ? await loadCurrentActor(app, body.target_id)
                : null;

            if (body.target_type === "user" && !body.conversation_id && !targetUser) {
              reply.code(404);
              return {
                message: "Report target is not valid for this community",
              };
            }

            const submission = await app.chatService.submitReport({
              actor: {
                userId: actor.userId,
                level: actor.level,
                communityIds: actor.communityIds,
              },
              conversationId: body.conversation_id,
              targetType: body.target_type,
              targetId: body.target_id,
              reason: body.reason,
              detailText: body.evidence_description ?? null,
              targetCommunityIds: targetUser?.communityIds,
            });

            if (submission.syncEvents !== undefined) {
              await fanoutSyncEvents(app, submission.syncEvents, {
                reportId: submission.report.report_id,
              });
            } else {
              await publishReportCreatedEvent(app, {
                communityId: submission.communityId,
                actorUserId: actor.userId,
                report: submission.report,
              });
            }
            if (submission.syncEvents === undefined && submission.autoHiddenPostId) {
              const decidedAt = new Date().toISOString();
              for (const reportId of submission.autoHiddenReportIds) {
                await publishModerationDecisionEvent(app, {
                  communityId: submission.communityId,
                  aggregateId: submission.autoHiddenModerationActionIds[reportId] ?? reportId,
                  actorUserId: submission.autoHiddenActorUserId,
                  reportId,
                  targetType: "post",
                  targetId: submission.autoHiddenPostId,
                  reportTargetType: "post",
                  reportTargetId: submission.autoHiddenPostId,
                  resolution: "remove_post",
                  status: "resolved",
                  decidedAt,
                  affectedUserId: null,
                  conversationId: null,
                });
              }
              await publishPostEvent(app, {
                eventType: "post.tombstoned",
                actorUserId: submission.autoHiddenActorUserId,
                post: {
                  post_id: submission.autoHiddenPostId,
                  community_id: submission.communityId,
                  status: "removed",
                  updated_at: decidedAt,
                },
                reason: "auto_hide_report_threshold",
              });
            }

            return {
              report_id: submission.report.report_id,
              status: "new" as const,
              created_at: submission.report.created_at,
            };
          },
        });
      } catch (error) {
        return replyWithChatError(reply, error);
      }
    },
  );
};

async function listConversationIdsForBlockedUser(
  app: Parameters<typeof loadCurrentActor>[0] & {
    chatService: {
      listConversationIdsForPair(input: {
        actor: { userId: string; level: "anonymous" | "verified" | "anchor" };
        otherUserId: string;
      }): Promise<string[]>;
    };
  },
  actor: { userId: string; level: "anonymous" | "verified" | "anchor" },
  blockedUserId: string,
) {
  return app.chatService.listConversationIdsForPair({
    actor,
    otherUserId: blockedUserId,
  });
}

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

function replyWithChatError(reply: { code(statusCode: number): unknown }, error: unknown) {
  if (error && typeof error === "object" && "name" in error && error.name === "ChatServiceError") {
    const chatError = error as unknown as { code: string; message: string };
    const statusCode =
      chatError.code === "not_found"
        ? 404
        : chatError.code === "forbidden"
          ? 403
          : chatError.code === "conversation_closed" || chatError.code === "conversation_blocked"
            ? 409
            : 400;
    reply.code(statusCode);
    return {
      message: chatError.message,
    };
  }

  throw error;
}
