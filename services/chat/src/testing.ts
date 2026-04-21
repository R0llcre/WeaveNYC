import { randomUUID } from "node:crypto";

import { createCommunitySyncEvent } from "@weavenyc/p2p";

import type { AdminReportQueueItem } from "@weavenyc/shared";

import {
  decodeConversationCursor,
  decodeMessageCursor,
  encodeConversationCursor,
  encodeMessageCursor,
  sortConversations,
  sortMessagesDescending,
} from "./repository.js";
import { ChatServiceError } from "./types.js";
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
  readonly messagesByClientId = new Map<string, string>();
  readonly reads = new Map<string, { messageId: string; readAt: string }>();
  readonly blocks = new Map<string, BlockRecord>();
  readonly reports = new Map<string, ReportRecord>();
  readonly postCommunityIds = new Map<string, string>();
  readonly postOwners = new Map<string, string>();
  readonly activeAnchorUserIds = new Map<string, string>();
  readonly userStatuses = new Map<string, "active" | "suspended" | "deleted">();

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

  seedPostOwner(postId: string, userId: string) {
    this.postOwners.set(postId, userId);
  }

  seedActiveAnchorUserId(communityId: string, userId: string) {
    this.activeAnchorUserIds.set(communityId, userId);
  }

  seedUserStatus(userId: string, status: "active" | "suspended" | "deleted") {
    this.userStatuses.set(userId, status);
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
    clientMessageId?: string;
  }): Promise<ChatMessage> {
    // (1) Dedup first (F1-β): a retry with the same client_message_id
    // returns the original row regardless of current conversation state.
    // This matches HTTP idempotency semantics — a retry must not start
    // failing just because a peer blocked between the first attempt and
    // the retry. Mirrors the Postgres `uq_messages_client_dedup` partial
    // unique index.
    if (input.clientMessageId) {
      const dedupKey = `${input.senderUserId}:${input.clientMessageId}`;
      const existingId = this.messagesByClientId.get(dedupKey);
      if (existingId) {
        const existing = this.messages.get(existingId);
        if (existing) {
          return existing;
        }
      }
    }

    // (2) Atomic check-and-insert (F1-γ): evaluate all predicates against
    // current state before writing, raise ChatServiceError when the
    // conversation was closed/blocked between the service-level pre-check
    // and this write. Tests for the send-while-block race rely on this to
    // model the TOCTOU closure.
    const conversation = this.conversations.get(input.conversationId);
    if (!conversation) {
      throw new ChatServiceError("Conversation not found", "not_found");
    }
    if (!conversation.participant_user_ids.includes(input.senderUserId)) {
      throw new ChatServiceError("Conversation is not available to this user", "forbidden");
    }

    const participantPair = conversation.participant_user_ids;
    const activeBlock =
      this.blocks.get(`${participantPair[0]}:${participantPair[1]}`) ??
      this.blocks.get(`${participantPair[1]}:${participantPair[0]}`);
    if (activeBlock) {
      throw new ChatServiceError("Conversation is blocked", "conversation_blocked");
    }
    if (conversation.status === "blocked") {
      throw new ChatServiceError("Conversation is blocked", "conversation_blocked");
    }
    if (conversation.status !== "active") {
      throw new ChatServiceError("Conversation is closed", "conversation_closed");
    }


    const message: ChatMessage = {
      message_id: randomUUID(),
      conversation_id: input.conversationId,
      sender_user_id: input.senderUserId,
      body: input.body,
      safety_flags: [...input.safetyFlags],
      sent_at: input.sentAt,
    };
    this.seedMessage(message);
    if (input.clientMessageId) {
      this.messagesByClientId.set(`${input.senderUserId}:${input.clientMessageId}`, message.message_id);
    }

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
    conversationId: string | null;
    reporterUserId: string;
    createdAt: string;
  }) {
    // Mirror the partial unique index added in migration 0014
    // `uq_reports_reporter_target_active`: a single user cannot stack
    // multiple 'new' reports against the same target. Re-submitting returns
    // the existing row instead of creating a duplicate, preventing the
    // single-user-auto-hide griefing vector (A2 P1-7).
    const existingReport = Array.from(this.reports.values()).find(
      (row) =>
        row.target_type === input.targetType &&
        row.target_id === input.targetId &&
        row.reporter_user_id === input.reporterUserId &&
        row.status === "new",
    );
    const report: ReportRecord = existingReport ?? {
      report_id: randomUUID(),
      community_id: input.communityId,
      target_type: input.targetType,
      target_id: input.targetId,
      reason: input.reason,
      detail_text: input.detailText,
      conversation_id: input.conversationId,
      reporter_user_id: input.reporterUserId,
      status: "new",
      resolution: null,
      created_at: input.createdAt,
      resolved_at: null,
    };
    this.reports.set(report.report_id, report);
    return {
      report,
      syncEvents:
        report.target_type === "post"
          ? [
              {
                sync_event_id: randomUUID(),
                community_id: report.community_id,
                topic: `weavenyc/${report.community_id}/reports`,
                event_type: "report.created" as const,
                aggregate_type: "report" as const,
                aggregate_id: report.report_id,
                occurred_at: report.created_at,
                actor_p2p_id: `actor_${report.reporter_user_id.slice(0, 8)}`,
                cid: null,
                payload: {
                  report_id: report.report_id,
                  target_type: "post" as const,
                  target_id: report.target_id,
                  reason: report.reason,
                  status: report.status,
                  created_at: report.created_at,
                },
                signature: null,
              },
            ]
          : [],
    };
  }

  async listReportQueuePage(input: {
    communityId: string;
    status?: "new" | "resolved" | "dismissed";
    cursor: string | null;
    limit: number;
  }): Promise<CursorPage<AdminReportQueueItem>> {
    const items = Array.from(this.reports.values())
      .filter((report) => report.community_id === input.communityId)
      .filter((report) => (input.status ? report.status === input.status : report.status === "new"))
      .sort((left, right) => {
        if (left.created_at === right.created_at) {
          return right.report_id.localeCompare(left.report_id);
        }
        return right.created_at.localeCompare(left.created_at);
      });

    const sliced = items.slice(0, input.limit);
    return {
      items: sliced.map((report) => ({
        report_id: report.report_id,
        community_id: report.community_id,
        target_type: report.target_type,
        target_id: report.target_id,
        reason: report.reason,
        status: report.status,
        created_at: report.created_at,
        reporter_user_id: report.reporter_user_id,
        reporter_alias: "Neighbor",
        priority:
          report.reason === "unsafe_behavior" || report.reason === "scam" || report.reason === "harassment"
            ? "P0"
            : report.reason === "misinformation"
              ? "P1"
              : "P2",
        conversation_id: report.conversation_id,
        target_summary: {
          title: report.target_type === "post" ? "Reported post" : report.target_type === "user" ? "Reported user" : "Reported message",
          body_preview: report.detail_text,
          related_user_id:
            report.target_type === "post"
              ? this.postOwners.get(report.target_id) ?? null
              : report.target_type === "user"
                ? report.target_id
                : null,
        },
        evidence_description: report.detail_text,
      })),
      nextCursor: items.length > sliced.length ? sliced[sliced.length - 1]?.report_id ?? null : null,
    };
  }

  async decideReport(input: {
    communityId: string;
    reportId: string;
    decision: "dismiss" | "warn" | "remove_post" | "suspend_user";
    notes: string | null;
    anchorUserId: string;
    decidedAt: string;
  }): Promise<import("./types.js").ReportDecisionResult | null> {
    void input.notes;
    void input.anchorUserId;
    const report = this.reports.get(input.reportId);
    if (!report || report.community_id !== input.communityId) {
      return null;
    }

    if (report.status === "resolved" || report.status === "dismissed") {
      return {
        report_id: report.report_id,
        status: report.status,
        resolution: report.resolution ?? "none",
        decided_at: report.resolved_at ?? report.created_at,
        communityId: report.community_id,
        targetType: report.target_type,
        targetId: report.target_id,
        moderationTargetType: report.target_type,
        moderationTargetId:
          input.decision === "suspend_user"
            ? report.target_type === "post"
              ? this.postOwners.get(report.target_id) ?? report.target_id
              : report.target_id
            : report.target_id,
        reportTargetType: report.target_type,
        reportTargetId: report.target_id,
        conversationId: report.conversation_id,
        moderationActionId: null,
        syncEvents: [],
      };
    }

    if (input.decision === "remove_post" && report.target_type !== "post") {
      throw new ChatServiceError("remove_post is only valid for post reports", "invalid_input");
    }

    report.status = input.decision === "dismiss" ? "dismissed" : "resolved";
    report.resolution = input.decision === "dismiss" ? "none" : input.decision;
    report.resolved_at = input.decidedAt;
    this.reports.set(report.report_id, report);

    let affectedUserId: string | null = null;
    if (input.decision === "suspend_user") {
      affectedUserId =
        report.target_type === "post"
          ? this.postOwners.get(report.target_id) ?? report.target_id
          : report.target_id;
      this.userStatuses.set(affectedUserId, "suspended");
    }

    const moderationActionId = randomUUID();
    const syncEvents =
      report.target_type === "post"
        ? [
            createCommunitySyncEvent({
              communityId: report.community_id,
              topicKey: "reports",
              eventType: "moderation.decision",
              aggregateType: "moderation",
              aggregateId: moderationActionId,
              actorUserId: input.anchorUserId,
              occurredAt: input.decidedAt,
              payload: {
                report_id: report.report_id,
                target_type: "post",
                target_id: report.target_id,
                report_target_type: "post",
                report_target_id: report.target_id,
                resolution: report.resolution ?? "none",
                status: report.status,
                decided_at: input.decidedAt,
              },
            }),
            ...(report.resolution === "remove_post"
              ? [
                  createCommunitySyncEvent({
                    communityId: report.community_id,
                    topicKey: "posts",
                    eventType: "post.tombstoned",
                    aggregateType: "post",
                    aggregateId: report.target_id,
                    actorUserId: input.anchorUserId,
                    occurredAt: input.decidedAt,
                    payload: {
                      post: {
                        post_id: report.target_id,
                      },
                      reason: "report_queue_remove_post",
                    },
                  }),
                ]
              : []),
          ]
        : [];

    return {
      report_id: report.report_id,
      status: report.status,
      resolution: report.resolution ?? "none",
      decided_at: input.decidedAt,
      affected_user_id: affectedUserId,
      communityId: report.community_id,
      targetType: report.target_type,
      targetId: report.target_id,
      moderationTargetType: input.decision === "suspend_user" ? "user" : report.target_type,
      moderationTargetId: input.decision === "suspend_user" ? affectedUserId ?? report.target_id : report.target_id,
      reportTargetType: report.target_type,
      reportTargetId: report.target_id,
      conversationId: report.conversation_id,
      moderationActionId,
      syncEvents,
    };
  }

  async autoHidePostIfThresholdReached(input: { communityId: string; postId: string }) {
    // Distinct reporters, not rows (A2 P1-7). See pg-repository.ts for the
    // full rationale.
    const reporterCount = new Set(
      Array.from(this.reports.values())
        .filter(
          (report) =>
            report.community_id === input.communityId &&
            report.target_type === "post" &&
            report.target_id === input.postId &&
            report.status !== "dismissed" &&
            report.status !== "resolved",
        )
        .map((report) => report.reporter_user_id),
    ).size;
    if (reporterCount < 3) {
      return null;
    }

    const moderationActionIds: Record<string, string> = {};
    const resolvedAt = new Date().toISOString();
    for (const report of this.reports.values()) {
      if (
        report.community_id === input.communityId &&
        report.target_type === "post" &&
        report.target_id === input.postId &&
        report.status !== "dismissed" &&
        report.status !== "resolved"
      ) {
        report.status = "resolved";
        report.resolution = "remove_post";
        report.resolved_at = resolvedAt;
        this.reports.set(report.report_id, report);
        moderationActionIds[report.report_id] = randomUUID();
      }
    }

    const reportIds = Array.from(this.reports.values())
      .filter(
        (report) =>
          report.community_id === input.communityId &&
          report.target_type === 'post' &&
          report.target_id === input.postId,
      )
      .map((report) => report.report_id);

    const syncEvents = [
      ...reportIds.map((reportId) =>
        createCommunitySyncEvent({
          communityId: input.communityId,
          topicKey: "reports",
          eventType: "moderation.decision",
          aggregateType: "moderation",
          aggregateId: moderationActionIds[reportId] ?? randomUUID(),
          actorUserId: this.activeAnchorUserIds.get(input.communityId) ?? null,
          occurredAt: resolvedAt,
          payload: {
            report_id: reportId,
            target_type: "post",
            target_id: input.postId,
            report_target_type: "post",
            report_target_id: input.postId,
            resolution: "remove_post",
            status: "resolved",
            decided_at: resolvedAt,
          },
        }),
      ),
      createCommunitySyncEvent({
        communityId: input.communityId,
        topicKey: "posts",
        eventType: "post.tombstoned",
        aggregateType: "post",
        aggregateId: input.postId,
        actorUserId: this.activeAnchorUserIds.get(input.communityId) ?? null,
        occurredAt: resolvedAt,
        payload: {
          post: {
            post_id: input.postId,
          },
          reason: "auto_hide_report_threshold",
        },
      }),
    ];

    return {
      postId: input.postId,
      communityId: input.communityId,
      anchorUserId: this.activeAnchorUserIds.get(input.communityId) ?? null,
      reportIds,
      moderationActionIds,
      syncEvents,
    };
  }

  async getMessage(messageId: string, conversationId: string) {
    const message = this.messages.get(messageId);
    if (!message || message.conversation_id !== conversationId) {
      return null;
    }
    return message;
  }

  async findMessageByClientId(input: { senderUserId: string; clientMessageId: string }) {
    const messageId = this.messagesByClientId.get(`${input.senderUserId}:${input.clientMessageId}`);
    if (!messageId) {
      return null;
    }
    return this.messages.get(messageId) ?? null;
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
