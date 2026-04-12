import { randomUUID } from "node:crypto";

import {
  decodeConversationCursor,
  decodeMessageCursor,
  encodeConversationCursor,
  encodeMessageCursor,
  sortConversations,
  sortMessagesDescending,
} from "./repository.js";
import type {
  BlockRecord,
  ChatMessage,
  ChatReportReason,
  ChatReportTargetType,
  ChatRepository,
  ConversationRecord,
  CursorPage,
  ReportRecord,
} from "./types.js";

function applyConversationCursor(
  items: ConversationRecord[],
  cursor: ReturnType<typeof decodeConversationCursor>,
) {
  if (!cursor) {
    return items;
  }

  return items.filter((item) => {
    if (item.last_activity_at < cursor.lastActivityAt) {
      return true;
    }
    if (item.last_activity_at > cursor.lastActivityAt) {
      return false;
    }
    return item.conversation_id < cursor.conversationId;
  });
}

function applyMessageCursor<T extends { sent_at: string; message_id: string }>(
  items: T[],
  cursor: ReturnType<typeof decodeMessageCursor>,
) {
  if (!cursor) {
    return items;
  }

  return items.filter((item) => {
    if (item.sent_at < cursor.sentAt) {
      return true;
    }
    if (item.sent_at > cursor.sentAt) {
      return false;
    }
    return item.message_id < cursor.messageId;
  });
}

export class InMemoryChatRepository implements ChatRepository {
  readonly conversations = new Map<string, ConversationRecord>();
  readonly messages = new Map<string, ChatMessage>();
  readonly conversationMessages = new Map<string, string[]>();
  readonly reads = new Map<string, { messageId: string; readAt: string }>();
  readonly blocks = new Map<string, BlockRecord>();
  readonly reports = new Map<string, ReportRecord>();
  readonly postCommunityIds = new Map<string, string>();

  async close() {}

  seedConversation(record: ConversationRecord) {
    this.conversations.set(record.conversation_id, { ...record });
  }

  seedMessage(record: ChatMessage) {
    this.messages.set(record.message_id, { ...record });
    const list = this.conversationMessages.get(record.conversation_id) ?? [];
    list.push(record.message_id);
    this.conversationMessages.set(record.conversation_id, list);
  }

  seedPostCommunityId(postId: string, communityId: string) {
    this.postCommunityIds.set(postId, communityId);
  }

  async listConversationsPage(input: {
    userId: string;
    cursor: string | null;
    limit: number;
  }): Promise<CursorPage<ConversationRecord>> {
    const sorted = sortConversations(
      Array.from(this.conversations.values()).filter((conversation) =>
        conversation.participant_user_ids.includes(input.userId),
      ),
    );
    const sliced = applyConversationCursor(sorted, decodeConversationCursor(input.cursor)).slice(0, input.limit);
    const next = sorted.length > sliced.length ? sliced[sliced.length - 1] : undefined;

    return {
      items: sliced,
      nextCursor: next ? encodeConversationCursor(next) : null,
    };
  }

  async getConversation(conversationId: string, userId?: string | null) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return null;
    }

    return {
      ...conversation,
      unread_count: userId ? this.computeUnreadCount(conversation, userId) : conversation.unread_count,
    };
  }

  async listMessagesPage(input: {
    conversationId: string;
    cursor: string | null;
    limit: number;
  }): Promise<CursorPage<ChatMessage>> {
    const sorted = sortMessagesDescending(
      (this.conversationMessages.get(input.conversationId) ?? [])
        .map((messageId) => this.messages.get(messageId))
        .filter((message): message is ChatMessage => Boolean(message)),
    );
    const sliced = applyMessageCursor(sorted, decodeMessageCursor(input.cursor)).slice(0, input.limit);
    const next = sorted.length > sliced.length ? sliced[sliced.length - 1] : undefined;

    return {
      items: sliced,
      nextCursor: next ? encodeMessageCursor(next) : null,
    };
  }

  async countRecentMessagesByUser(userId: string, sinceIso: string) {
    return Array.from(this.messages.values()).filter(
      (message) => message.sender_user_id === userId && message.sent_at >= sinceIso,
    ).length;
  }

  async saveMessage(input: {
    conversationId: string;
    senderUserId: string;
    body: string;
    safetyFlags: ChatMessage["safety_flags"];
    sentAt: string;
  }) {
    const message: ChatMessage = {
      message_id: randomUUID(),
      conversation_id: input.conversationId,
      sender_user_id: input.senderUserId,
      body: input.body,
      safety_flags: [...input.safetyFlags],
      sent_at: input.sentAt,
    };
    this.seedMessage(message);

    const conversation = this.conversations.get(input.conversationId);
    if (conversation) {
      conversation.last_activity_at = input.sentAt;
      conversation.last_message_preview = input.body;
      conversation.last_message_at = input.sentAt;
      const otherParticipant = conversation.participant_user_ids.find(
        (userId) => userId !== input.senderUserId,
      );
      if (otherParticipant) {
        const key = `${conversation.conversation_id}:${otherParticipant}`;
        const existing = this.reads.get(key);
        if (existing && existing.readAt > input.sentAt) {
          return message;
        }
      }
      this.conversations.set(input.conversationId, { ...conversation });
    }

    return message;
  }

  async markConversationRead(input: {
    conversationId: string;
    userId: string;
    messageId: string;
    readAt: string;
  }) {
    const key = `${input.conversationId}:${input.userId}`;
    const existing = this.reads.get(key);
    if (existing && existing.readAt > input.readAt) {
      return;
    }

    this.reads.set(key, {
      messageId: input.messageId,
      readAt: input.readAt,
    });

    const conversation = this.conversations.get(input.conversationId);
    if (conversation) {
      const unreadCount = this.computeUnreadCount(conversation, input.userId);
      this.conversations.set(input.conversationId, {
        ...conversation,
        unread_count: unreadCount,
      });
    }
  }

  async updateConversationState(input: {
    conversationId: string;
    status: ConversationRecord["status"];
    changedAt: string;
    blockedByUserId?: string | null;
  }) {
    const existing = this.conversations.get(input.conversationId);
    if (!existing) {
      throw new Error("Conversation not found");
    }
    const updated: ConversationRecord = {
      ...existing,
      status: input.status,
      closed_at: input.status === "closed" ? input.changedAt : existing.closed_at,
      blocked_at: input.status === "blocked" ? input.changedAt : existing.blocked_at,
      blocked_by_user_id:
        input.status === "blocked" ? input.blockedByUserId ?? existing.blocked_by_user_id : null,
      last_activity_at: input.changedAt,
    };
    this.conversations.set(updated.conversation_id, updated);
    return updated;
  }

  async findBlockBetweenUsers(userA: string, userB: string) {
    return (
      this.blocks.get(`${userA}:${userB}`) ??
      this.blocks.get(`${userB}:${userA}`) ??
      null
    );
  }

  async saveBlock(input: {
    blockerUserId: string;
    blockedUserId: string;
    conversationId: string | null;
    createdAt: string;
  }) {
    const key = `${input.blockerUserId}:${input.blockedUserId}`;
    const existing = this.blocks.get(key);
    if (existing) {
      return existing;
    }
    const created: BlockRecord = {
      block_id: randomUUID(),
      blocker_user_id: input.blockerUserId,
      blocked_user_id: input.blockedUserId,
      conversation_id: input.conversationId,
      created_at: input.createdAt,
    };
    this.blocks.set(key, created);
    return created;
  }

  async saveReport(input: {
    communityId: string;
    targetType: ChatReportTargetType;
    targetId: string;
    reason: ChatReportReason;
    detailText: string | null;
    reporterUserId: string;
    createdAt: string;
  }) {
    const report: ReportRecord = {
      report_id: randomUUID(),
      community_id: input.communityId,
      target_type: input.targetType,
      target_id: input.targetId,
      reason: input.reason,
      detail_text: input.detailText,
      reporter_user_id: input.reporterUserId,
      created_at: input.createdAt,
    };
    this.reports.set(report.report_id, report);
    return report;
  }

  async getMessage(messageId: string, conversationId: string) {
    const message = this.messages.get(messageId);
    if (!message || message.conversation_id !== conversationId) {
      return null;
    }
    return message;
  }

  async getMessageContext(messageId: string) {
    const message = this.messages.get(messageId);
    if (!message) {
      return null;
    }

    const conversation = this.conversations.get(message.conversation_id);
    if (!conversation) {
      return null;
    }

    return {
      message,
      participantUserIds: conversation.participant_user_ids,
      communityId: this.postCommunityIds.get(conversation.related_post_ids[0] ?? "") ?? null,
    };
  }

  async getPostCommunityId(postId: string) {
    return this.postCommunityIds.get(postId) ?? null;
  }

  private computeUnreadCount(conversation: ConversationRecord, userId: string) {
    const read = this.reads.get(`${conversation.conversation_id}:${userId}`);
    return (this.conversationMessages.get(conversation.conversation_id) ?? [])
      .map((messageId) => this.messages.get(messageId))
      .filter((message): message is ChatMessage => Boolean(message))
      .filter(
        (message) =>
          message.sender_user_id !== userId &&
          (!read ||
            message.sent_at > read.readAt ||
            (message.sent_at === read.readAt && message.message_id !== read.messageId)),
      ).length;
  }
}
