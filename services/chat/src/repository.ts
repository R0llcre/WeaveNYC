import type { ConversationDetail, ConversationRecord, ConversationSummary } from "./types.js";

export function encodeConversationCursor(record: ConversationRecord) {
  return Buffer.from(
    JSON.stringify({
      lastActivityAt: record.last_activity_at,
      conversationId: record.conversation_id,
    }),
    "utf8",
  ).toString("base64url");
}

export function decodeConversationCursor(
  cursor: string | null | undefined,
): { lastActivityAt: string; conversationId: string } | null {
  if (!cursor) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      lastActivityAt?: string;
      conversationId?: string;
    };

    if (!parsed.lastActivityAt || !parsed.conversationId) {
      throw new Error("invalid");
    }

    return {
      lastActivityAt: parsed.lastActivityAt,
      conversationId: parsed.conversationId,
    };
  } catch {
    throw new Error("Conversation cursor is not valid");
  }
}

export function encodeMessageCursor(message: { sent_at: string; message_id: string }) {
  return Buffer.from(
    JSON.stringify({
      sentAt: message.sent_at,
      messageId: message.message_id,
    }),
    "utf8",
  ).toString("base64url");
}

export function decodeMessageCursor(
  cursor: string | null | undefined,
): { sentAt: string; messageId: string } | null {
  if (!cursor) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      sentAt?: string;
      messageId?: string;
    };

    if (!parsed.sentAt || !parsed.messageId) {
      throw new Error("invalid");
    }

    return {
      sentAt: parsed.sentAt,
      messageId: parsed.messageId,
    };
  } catch {
    throw new Error("Message cursor is not valid");
  }
}

export function sortConversations(records: ConversationRecord[]) {
  return [...records].sort((left, right) => {
    if (left.last_activity_at === right.last_activity_at) {
      return right.conversation_id.localeCompare(left.conversation_id);
    }

    return right.last_activity_at.localeCompare(left.last_activity_at);
  });
}

export function sortMessagesDescending<T extends { sent_at: string; message_id: string }>(messages: T[]) {
  return [...messages].sort((left, right) => {
    if (left.sent_at === right.sent_at) {
      return right.message_id.localeCompare(left.message_id);
    }

    return right.sent_at.localeCompare(left.sent_at);
  });
}

export function conversationCanSend(conversation: Pick<ConversationDetail, "status">) {
  return conversation.status === "active";
}

export function toConversationSummary(
  conversation: ConversationRecord,
  actorUserId: string,
): ConversationSummary {
  const otherParticipant =
    conversation.participant_preview.find((participant) => participant.user_id !== actorUserId) ??
    conversation.participant_preview[0];

  return {
    ...conversation,
    other_participant: otherParticipant,
    can_send: conversationCanSend(conversation),
  };
}
