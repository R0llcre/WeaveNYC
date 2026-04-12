import { z } from "zod";

import {
  chatRealtimeEventTypes,
  conversationStatuses,
  messageSafetyFlags,
  reportReasons,
  reportTargetTypes,
} from "../enums";

const cursorSchema = z.string().regex(/^[A-Za-z0-9_-]+$/);
const uuidSchema = z.string().uuid();

export const conversationStatusSchema = z.enum(conversationStatuses);
export const reportTargetTypeSchema = z.enum(reportTargetTypes);
export const reportReasonSchema = z.enum(reportReasons);
export const messageSafetyFlagSchema = z.enum(messageSafetyFlags);
export const chatRealtimeEventTypeSchema = z.enum(chatRealtimeEventTypes);

export const conversationParamsSchema = z.object({
  conversation_id: uuidSchema,
});

export const conversationMessageQuerySchema = z.object({
  cursor: cursorSchema.nullable().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

export const conversationsListQuerySchema = z.object({
  cursor: cursorSchema.nullable().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

export const conversationParticipantPreviewSchema = z.object({
  user_id: uuidSchema,
  alias: z.string().min(1),
});

export const conversationSummarySchema = z.object({
  conversation_id: uuidSchema,
  contact_request_id: uuidSchema,
  related_post_ids: z.array(uuidSchema),
  participant_preview: z.array(conversationParticipantPreviewSchema).length(2),
  status: conversationStatusSchema,
  created_at: z.string().datetime(),
  last_activity_at: z.string().datetime(),
  last_message_preview: z.string().nullable(),
  unread_count: z.number().int().min(0),
});

export const conversationDetailSchema = conversationSummarySchema.extend({
  other_user_id: uuidSchema,
  actions: z.object({
    can_send: z.boolean(),
    can_close: z.boolean(),
    can_block: z.boolean(),
    can_report: z.boolean(),
  }),
});

export const conversationsListResponseSchema = z.object({
  items: z.array(conversationSummarySchema),
  next_cursor: z.string().min(1).nullable(),
});

export const conversationMessageSchema = z.object({
  message_id: uuidSchema,
  conversation_id: uuidSchema,
  sender_user_id: uuidSchema,
  sender_alias: z.string().min(1),
  body: z.string().min(1),
  sent_at: z.string().datetime(),
  is_mine: z.boolean(),
  safety_flags: z.array(messageSafetyFlagSchema),
});

export const conversationMessagesResponseSchema = z.object({
  items: z.array(conversationMessageSchema),
  next_cursor: z.string().min(1).nullable(),
});

export const sendConversationMessageRequestSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export const sendConversationMessageResponseSchema = z.object({
  conversation_id: uuidSchema,
  message: conversationMessageSchema,
});

export const closeConversationResponseSchema = z.object({
  conversation_id: uuidSchema,
  status: z.literal("closed"),
  closed_at: z.string().datetime(),
});

export const blockUserRequestSchema = z.object({
  blocked_user_id: uuidSchema,
  conversation_id: uuidSchema.optional(),
});

export const blockUserResponseSchema = z.object({
  blocked_user_id: uuidSchema,
  status: z.literal("blocked"),
  blocked_at: z.string().datetime(),
  affected_conversation_ids: z.array(uuidSchema),
});

export const reportCreateRequestSchema = z.object({
  target_type: reportTargetTypeSchema,
  target_id: uuidSchema,
  reason: reportReasonSchema,
  conversation_id: uuidSchema.optional(),
  evidence_description: z.string().trim().min(1).max(1000).optional(),
});

export const reportCreateResponseSchema = z.object({
  report_id: uuidSchema,
  status: z.literal("new"),
  created_at: z.string().datetime(),
});

export const messageSafetyErrorResponseSchema = z.object({
  message: z.string().min(1),
  blocked: z.literal(true),
  safety_flags: z.array(messageSafetyFlagSchema).min(1),
});

export const chatRealtimeMessageCreatedEventSchema = z.object({
  event_type: z.literal("message.created"),
  occurred_at: z.string().datetime(),
  conversation_id: uuidSchema,
  message: conversationMessageSchema,
});

export const chatRealtimeConversationUpdatedEventSchema = z.object({
  event_type: z.literal("conversation.updated"),
  occurred_at: z.string().datetime(),
  conversation: conversationSummarySchema,
});

export const chatRealtimeHeartbeatEventSchema = z.object({
  event_type: z.literal("heartbeat"),
  occurred_at: z.string().datetime(),
});

export const chatRealtimeEventSchema = z.discriminatedUnion("event_type", [
  chatRealtimeMessageCreatedEventSchema,
  chatRealtimeConversationUpdatedEventSchema,
  chatRealtimeHeartbeatEventSchema,
]);
