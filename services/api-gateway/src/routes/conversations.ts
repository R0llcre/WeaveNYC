import {
  conversationMessageQuerySchema as conversationMessageQueryValidator,
  conversationParamsSchema as conversationParamsValidator,
  conversationsListQuerySchema as conversationsListQueryValidator,
  sendConversationMessageRequestSchema as sendConversationMessageBodyValidator,
} from "@weavenyc/shared";
import type {
  ChatMessage,
  ChatServiceError,
  ConversationDetail as DomainConversationDetail,
  ConversationSummary as DomainConversationSummary,
} from "@weavenyc/chat";
import type { FastifyPluginAsync } from "fastify";

import {
  closeConversationResponseSchema,
  conversationDetailSchema,
  conversationMessageQuerySchema,
  conversationMessagesResponseSchema,
  conversationParamsSchema,
  conversationsListQuerySchema,
  conversationsListResponseSchema,
  errorResponseSchema,
  messageSafetyErrorResponseSchema,
  sendConversationMessageRequestSchema,
  sendConversationMessageResponseSchema,
} from "../contracts.js";
import { withIdempotency } from "../lib/idempotency.js";
import { recordChatMessageSent } from "../lib/metrics.js";
import { loadCurrentActor } from "../lib/require-anchor.js";

type ConversationParams = {
  conversation_id: string;
};

type ConversationsQuery = {
  cursor?: string | null;
  limit?: number;
};

type ConversationMessageBody = {
  body: string;
  client_message_id?: string;
};

export const conversationRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: ConversationsQuery }>(
    "/v1/conversations",
    {
      schema: {
        summary: "List conversations visible to the current user",
        tags: ["conversations"],
        security: [{ bearerAuth: [] }],
        querystring: conversationsListQuerySchema,
        response: {
          200: conversationsListResponseSchema,
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

        const query = conversationsListQueryValidator.parse(request.query);
        const page = await app.chatService.listConversations({
          actor: {
            userId: actor.userId,
            level: actor.level,
          },
          cursor: query.cursor ?? null,
          limit: query.limit,
        });

        return {
          items: page.items.map(mapConversationSummary),
          next_cursor: page.nextCursor,
        };
      } catch (error) {
        return replyWithChatError(reply, error);
      }
    },
  );

  app.get<{ Params: ConversationParams }>(
    "/v1/conversations/:conversation_id",
    {
      schema: {
        summary: "Get conversation detail for the current user",
        tags: ["conversations"],
        security: [{ bearerAuth: [] }],
        params: conversationParamsSchema,
        response: {
          200: conversationDetailSchema,
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

        const params = conversationParamsValidator.parse(request.params);
        const conversation = await app.chatService.getConversation({
          actor: {
            userId: actor.userId,
            level: actor.level,
          },
          conversationId: params.conversation_id,
        });

        return mapConversationDetail(conversation);
      } catch (error) {
        return replyWithChatError(reply, error);
      }
    },
  );

  app.get<{ Params: ConversationParams; Querystring: ConversationsQuery }>(
    "/v1/conversations/:conversation_id/messages",
    {
      schema: {
        summary: "List paginated messages for a conversation",
        tags: ["conversations"],
        security: [{ bearerAuth: [] }],
        params: conversationParamsSchema,
        querystring: conversationMessageQuerySchema,
        response: {
          200: conversationMessagesResponseSchema,
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

        const params = conversationParamsValidator.parse(request.params);
        const query = conversationMessageQueryValidator.parse(request.query);
        const page = await app.chatService.listMessages({
          actor: {
            userId: actor.userId,
            level: actor.level,
          },
          conversationId: params.conversation_id,
          cursor: query.cursor ?? null,
          limit: query.limit,
        });

        return {
          items: page.items.map((message) => mapConversationMessage(message, page.conversation, actor.userId)),
          next_cursor: page.next_cursor,
        };
      } catch (error) {
        return replyWithChatError(reply, error);
      }
    },
  );

  app.post<{ Params: ConversationParams; Body: ConversationMessageBody }>(
    "/v1/conversations/:conversation_id/messages",
    {
      schema: {
        summary: "Send a message in a conversation",
        tags: ["conversations"],
        security: [{ bearerAuth: [] }],
        params: conversationParamsSchema,
        body: sendConversationMessageRequestSchema,
        response: {
          200: sendConversationMessageResponseSchema,
          400: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          422: messageSafetyErrorResponseSchema,
          429: errorResponseSchema,
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

        const params = conversationParamsValidator.parse(request.params);
        const body = sendConversationMessageBodyValidator.parse(request.body);

        // A7 P0-4 + A2 P0-4: message send is idempotent at the HTTP layer.
        // Clients generate `Idempotency-Key` per tap; if the request retries
        // (network flap, user-double-tap), the same response + message_id
        // come back. `client_message_id` serves as a redundant dedup key at
        // the database layer via `uq_messages_client_dedup`, so the server
        // remains safe even if the HTTP idempotency cache has been purged.
        return await withIdempotency({
          app,
          request,
          reply,
          routeName: "conversations.sendMessage",
          userId: actor.userId,
          handler: async () => {
            const result = await app.chatService.sendMessage({
              actor: {
                userId: actor.userId,
                level: actor.level,
              },
              conversationId: params.conversation_id,
              body: body.body,
              clientMessageId: body.client_message_id,
            });

            // Bump `chat_messages_sent_total` after the send succeeded
            // so the counter tracks durable, post-idempotency writes —
            // paired with `chat_messages_delivered_total` by the
            // `ChatDeliveryRateFloor` alert rule.
            recordChatMessageSent(app);

            const participantIds = result.conversation.participant_preview.map((participant) => participant.user_id);
            const participantConversations = await Promise.all(
              participantIds.map(async (participantId) => {
                const participantConversation = await loadConversationForParticipant(app, participantId, params.conversation_id);
                if (!participantConversation) {
                  return null;
                }

                return {
                  participantId,
                  conversation: participantConversation,
                };
              }),
            );
            const realtimeTargets = participantConversations.filter(
              (entry): entry is { participantId: string; conversation: DomainConversationDetail } => Boolean(entry),
            );
            const senderMessage = mapConversationMessage(result.message, result.conversation, actor.userId);
            await Promise.all([
              ...realtimeTargets.map(({ participantId, conversation }) =>
                app.chatRealtimeHub.publishToUsers([participantId], {
                  event_type: "message.created",
                  occurred_at: senderMessage.sent_at,
                  conversation_id: params.conversation_id,
                  message: mapConversationMessage(result.message, conversation, participantId),
                }),
              ),
              ...realtimeTargets.map(({ participantId, conversation }) =>
                app.chatRealtimeHub.publishToUsers([participantId], {
                  event_type: "conversation.updated",
                  occurred_at: conversation.last_activity_at,
                  conversation: mapConversationSummary(conversation),
                }),
              ),
            ]);

            return {
              conversation_id: params.conversation_id,
              message: senderMessage,
            };
          },
        });
      } catch (error) {
        return replyWithChatError(reply, error);
      }
    },
  );

  app.post<{ Params: ConversationParams }>(
    "/v1/conversations/:conversation_id/close",
    {
      schema: {
        summary: "Close a conversation for both participants",
        tags: ["conversations"],
        security: [{ bearerAuth: [] }],
        params: conversationParamsSchema,
        response: {
          200: closeConversationResponseSchema,
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

        const params = conversationParamsValidator.parse(request.params);
        const conversation = await app.chatService.closeConversation({
          actor: {
            userId: actor.userId,
            level: actor.level,
          },
          conversationId: params.conversation_id,
        });
        const participantIds = conversation.participant_preview.map((participant) => participant.user_id);
        const participantConversations = await Promise.all(
          participantIds.map(async (participantId) => {
            const participantConversation = await loadConversationForParticipant(app, participantId, params.conversation_id);
            if (!participantConversation) {
              return null;
            }

            return {
              participantId,
              conversation: participantConversation,
            };
          }),
        );
        await Promise.all(
          participantConversations
            .filter((entry): entry is { participantId: string; conversation: DomainConversationDetail } => Boolean(entry))
            .map(({ participantId, conversation: participantConversation }) =>
              app.chatRealtimeHub.publishToUsers([participantId], {
                event_type: "conversation.updated",
                occurred_at: participantConversation.last_activity_at,
                conversation: mapConversationSummary(participantConversation),
              }),
            ),
        );

        return {
          conversation_id: conversation.conversation_id,
          status: "closed",
          closed_at: conversation.closed_at ?? conversation.last_activity_at,
        };
      } catch (error) {
        return replyWithChatError(reply, error);
      }
    },
  );
};

async function loadConversationForParticipant(
  app: Parameters<typeof loadCurrentActor>[0] & {
    chatService: {
      getConversation(input: {
        actor: { userId: string; level: "anonymous" | "verified" | "anchor" };
        conversationId: string;
      }): Promise<DomainConversationDetail>;
    };
  },
  userId: string,
  conversationId: string,
) {
  const actor = await loadCurrentActor(app, userId);
  if (!actor) {
    return null;
  }

  return app.chatService.getConversation({
    actor: {
      userId: actor.userId,
      level: actor.level,
    },
    conversationId,
  });
}

function mapConversationSummary(conversation: DomainConversationSummary) {
  return {
    conversation_id: conversation.conversation_id,
    contact_request_id: conversation.contact_request_id,
    related_post_ids: conversation.related_post_ids,
    participant_preview: conversation.participant_preview,
    status: conversation.status,
    created_at: conversation.created_at,
    last_activity_at: conversation.last_activity_at,
    last_message_preview: conversation.last_message_preview,
    unread_count: conversation.unread_count,
  };
}

function mapConversationDetail(conversation: DomainConversationDetail) {
  return {
    ...mapConversationSummary(conversation),
    other_user_id: conversation.other_participant.user_id,
    actions: {
      can_send: conversation.can_send,
      can_close: conversation.status === "active",
      can_block: conversation.status !== "blocked",
      can_report: true,
    },
  };
}

function mapConversationMessage(
  message: ChatMessage,
  conversation: Pick<DomainConversationDetail, "participant_preview">,
  actorUserId: string,
) {
  return {
    message_id: message.message_id,
    conversation_id: message.conversation_id,
    sender_user_id: message.sender_user_id,
    sender_alias:
      conversation.participant_preview.find((participant) => participant.user_id === message.sender_user_id)?.alias ??
      "Neighbor",
    body: message.body,
    sent_at: message.sent_at,
    is_mine: message.sender_user_id === actorUserId,
    safety_flags: message.safety_flags,
  };
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
    const chatError = error as ChatServiceError;
    if (chatError.code === "sensitive_content_detected") {
      reply.code(422);
      return {
        message: chatError.message,
        blocked: true,
        safety_flags: chatError.details?.safetyFlags ?? [],
      };
    }

    const statusCode =
      chatError.code === "not_found"
        ? 404
        : chatError.code === "forbidden"
          ? 403
          : chatError.code === "rate_limited"
            ? 429
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
