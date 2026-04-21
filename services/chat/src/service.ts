import { defaultChatSafetyDetector } from "./safety.js";
import {
  decodeConversationCursor,
  decodeMessageCursor,
  toConversationSummary,
} from "./repository.js";
import { anchorSessionIdleTtlSeconds } from "@weavenyc/shared";
import type {
  AdminReportQueueInput,
  BlockUserResult,
  ChatRepository,
  ChatSafetyDetector,
  ChatService,
  ChatServiceHooks,
  CloseConversationInput,
  ConversationDetail,
  ConversationSummary,
  GetConversationInput,
  ListConversationInput,
  ListMessagesInput,
  MessagePage,
  ReportDecisionInput,
  SendMessageInput,
  SendMessageResult,
  SubmitReportInput,
  ConversationRecord,
} from "./types.js";
import { ChatServiceError } from "./types.js";

function coerceLimit(limit: number | null | undefined, max: number, fallback: number) {
  return Math.min(Math.max(limit ?? fallback, 1), max);
}

function trimMessageBody(body: string) {
  return body.replace(/\s+/g, " ").trim();
}

export class DefaultChatService implements ChatService {
  constructor(
    private readonly repository: ChatRepository,
    private readonly detector: ChatSafetyDetector = defaultChatSafetyDetector,
    private readonly hooks: ChatServiceHooks = {},
    private readonly now: () => Date = () => new Date(),
    private readonly maxMessagesPerMinute = 20,
  ) {}

  async close() {
    await this.repository.close();
  }

  async listConversations(input: ListConversationInput) {
    const cursor = (() => {
      try {
        return decodeConversationCursor(input.cursor);
      } catch {
        throw new ChatServiceError("Conversation cursor is not valid", "invalid_input");
      }
    })();
    const limit = coerceLimit(input.limit, 50, 20);
    const page = await this.repository.listConversationsPage({
      userId: input.actor.userId,
      cursor: input.cursor ?? null,
      limit,
    });

    const visibleItems: ConversationSummary[] = [];
    for (const record of page.items) {
      void cursor;
      this.ensureParticipant(record, input.actor.userId);
      const otherUserId = this.getOtherParticipantId(record, input.actor.userId);
      const activeBlock = await this.repository.findBlockBetweenUsers(input.actor.userId, otherUserId);
      if (activeBlock) {
        continue;
      }
      visibleItems.push(toConversationSummary(record, input.actor.userId));
    }

    return {
      items: visibleItems,
      nextCursor: page.nextCursor,
    };
  }

  async listConversationIdsForPair(input: { actor: { userId: string }; otherUserId: string }) {
    return this.collectConversationIdsForPair(input.actor.userId, input.otherUserId);
  }

  async getConversation(input: GetConversationInput): Promise<ConversationDetail> {
    const conversation = await this.repository.getConversation(input.conversationId, input.actor.userId);
    if (!conversation) {
      throw new ChatServiceError("Conversation not found", "not_found");
    }

    this.ensureParticipant(conversation, input.actor.userId);
    const otherUserId = this.getOtherParticipantId(conversation, input.actor.userId);
    const activeBlock = await this.repository.findBlockBetweenUsers(input.actor.userId, otherUserId);
    if (activeBlock) {
      throw new ChatServiceError("Conversation is blocked", "conversation_blocked");
    }

    return toConversationSummary(conversation, input.actor.userId);
  }

  async listMessages(input: ListMessagesInput): Promise<MessagePage> {
    const conversation = await this.getConversation({
      actor: input.actor,
      conversationId: input.conversationId,
    });
    try {
      decodeMessageCursor(input.cursor);
    } catch {
      throw new ChatServiceError("Message cursor is not valid", "invalid_input");
    }
    const limit = coerceLimit(input.limit, 100, 30);
    const page = await this.repository.listMessagesPage({
      conversationId: input.conversationId,
      cursor: input.cursor ?? null,
      limit,
    });

    const newest = !input.cursor ? page.items[0] : null;
    if (newest) {
      await this.repository.markConversationRead({
        conversationId: input.conversationId,
        userId: input.actor.userId,
        messageId: newest.message_id,
        readAt: newest.sent_at,
      });
    }

    return {
      conversation,
      items: page.items,
      next_cursor: page.nextCursor,
    };
  }

  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    // Pre-check conversation state so we can short-circuit early for the
    // common case where the peer has already blocked or closed. This keeps
    // ergonomics (skip the safety scan + DB work when we already know the
    // answer) without relying on it for correctness — the repository's
    // saveMessage performs the authoritative atomic check-and-insert that
    // closes the TOCTOU window (A2 P0-8). If a peer blocks between the check
    // below and the INSERT, saveMessage raises conversation_blocked and no
    // realtime fanout fires.
    const conversation = await this.getConversation({
      actor: input.actor,
      conversationId: input.conversationId,
    });
    if (conversation.status === "blocked") {
      throw new ChatServiceError("Conversation is blocked", "conversation_blocked");
    }
    if (conversation.status === "closed") {
      throw new ChatServiceError("Conversation is closed", "conversation_closed");
    }

    const body = trimMessageBody(input.body);
    if (!body) {
      throw new ChatServiceError("Message body is required", "invalid_input");
    }

    const now = this.now().toISOString();
    const recentCount = await this.repository.countRecentMessagesByUser(
      input.actor.userId,
      new Date(this.now().getTime() - 60_000).toISOString(),
    );
    if (recentCount >= this.maxMessagesPerMinute) {
      throw new ChatServiceError("Too many messages sent recently", "rate_limited");
    }

    const inspection = this.detector.inspectMessage({
      actor: input.actor,
      conversation,
      body,
    });
    if (inspection.blocked) {
      await this.hooks.onMessageBlocked?.({
        actor: input.actor,
        conversationId: input.conversationId,
        blockingFlags: inspection.blockingFlags,
      });
      throw new ChatServiceError(
        inspection.userMessage ?? "Detected personal information in the message",
        "sensitive_content_detected",
        {
          safetyFlags: inspection.blockingFlags,
        },
      );
    }

    // Atomic check-and-insert. If this throws conversation_blocked /
    // conversation_closed, the caller's realtime fanout never runs — both
    // because we bail before calling the accepted hook and because the caller
    // only fans out after sendMessage returns successfully.
    const message = await this.repository.saveMessage({
      conversationId: input.conversationId,
      senderUserId: input.actor.userId,
      body,
      safetyFlags: inspection.advisoryFlags,
      sentAt: now,
    });
    await this.repository.markConversationRead({
      conversationId: input.conversationId,
      userId: input.actor.userId,
      messageId: message.message_id,
      readAt: message.sent_at,
    });
    await this.hooks.onMessageAccepted?.({
      actor: input.actor,
      conversationId: input.conversationId,
      messageId: message.message_id,
      advisoryFlags: inspection.advisoryFlags,
    });

    // Re-read via the repository (not service.getConversation) so that a
    // block inserted between our atomic INSERT above and this read doesn't
    // turn a successful send into a thrown conversation_blocked. The message
    // is already persisted — the caller needs a coherent response.
    const refreshed = await this.repository.getConversation(input.conversationId, input.actor.userId);
    if (!refreshed) {
      throw new ChatServiceError("Conversation not found", "not_found");
    }
    this.ensureParticipant(refreshed, input.actor.userId);
    return {
      conversation: toConversationSummary(refreshed, input.actor.userId),
      message,
    };
  }

  async closeConversation(input: CloseConversationInput): Promise<ConversationDetail> {
    const conversation = await this.getConversation({
      actor: input.actor,
      conversationId: input.conversationId,
    });
    if (conversation.status === "blocked") {
      throw new ChatServiceError("Conversation is blocked", "conversation_blocked");
    }
    if (conversation.status === "closed") {
      return conversation;
    }

    await this.repository.updateConversationState({
      conversationId: input.conversationId,
      status: "closed",
      changedAt: this.now().toISOString(),
      blockedByUserId: null,
    });

    return this.getConversation({
      actor: input.actor,
      conversationId: input.conversationId,
    });
  }

  async blockUser(input: {
    actor: CloseConversationInput["actor"];
    conversationId: string;
    blockedUserId: string;
  }): Promise<BlockUserResult> {
    const conversation = await this.repository.getConversation(input.conversationId, input.actor.userId);
    if (!conversation) {
      throw new ChatServiceError("Conversation not found", "not_found");
    }
    this.ensureParticipant(conversation, input.actor.userId);
    const otherUserId = this.getOtherParticipantId(conversation, input.actor.userId);
    if (input.blockedUserId !== otherUserId) {
      throw new ChatServiceError("Only the other participant can be blocked", "forbidden");
    }

    const existing = await this.repository.findBlockBetweenUsers(input.actor.userId, input.blockedUserId);
    const block =
      existing ??
      (await this.repository.saveBlock({
        blockerUserId: input.actor.userId,
        blockedUserId: input.blockedUserId,
        conversationId: input.conversationId,
        createdAt: this.now().toISOString(),
      }));

    const affectedConversationIds = await this.collectConversationIdsForPair(
      input.actor.userId,
      input.blockedUserId,
    );

    const affectedConversations: ConversationDetail[] = [];
    for (const conversationId of affectedConversationIds) {
      await this.repository.updateConversationState({
        conversationId,
        status: "blocked",
        changedAt: block.created_at,
        blockedByUserId: block.blocker_user_id,
      });
      const updatedConversation = await this.repository.getConversation(
        conversationId,
        input.actor.userId,
      );
      if (updatedConversation) {
        affectedConversations.push(toConversationSummary(updatedConversation, input.actor.userId));
      }
      await this.hooks.onConversationBlocked?.({
        actor: input.actor,
        conversationId,
        blockedUserId: input.blockedUserId,
        blockId: block.block_id,
      });
    }

    return {
      block,
      affectedConversations,
    };
  }

  async submitReport(input: SubmitReportInput) {
    const { communityId } = await this.resolveReportContext(input);

    const savedReport = await this.repository.saveReport({
      communityId,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      detailText: input.detailText ?? null,
      conversationId: input.conversationId ?? null,
      reporterUserId: input.actor.userId,
      createdAt: this.now().toISOString(),
    });
    const report = savedReport.report;

    let autoHiddenPostId: string | null = null;
    let autoHiddenActorUserId: string | null = null;
    let autoHiddenReportIds: string[] = [];
    let autoHiddenModerationActionIds: Record<string, string> = {};
    const syncEvents = [...(savedReport.syncEvents ?? [])];
    if (input.targetType === "post") {
      const autoHidden = await this.repository.autoHidePostIfThresholdReached({
        communityId,
        postId: input.targetId,
      });
      autoHiddenPostId = autoHidden ? autoHidden.postId : null;
      autoHiddenActorUserId = autoHidden?.anchorUserId ?? null;
      autoHiddenReportIds = autoHidden?.reportIds ?? [];
      autoHiddenModerationActionIds = autoHidden?.moderationActionIds ?? {};
      syncEvents.push(...(autoHidden?.syncEvents ?? []));
    }

    await this.hooks.onReportCreated?.({
      actor: input.actor,
      conversationId: input.conversationId,
      reportId: report.report_id,
      reason: input.reason,
    });

    return {
      report,
      communityId,
      autoHiddenPostId,
      autoHiddenActorUserId,
      autoHiddenReportIds,
      autoHiddenModerationActionIds,
      syncEvents,
    };
  }

  async listReportQueue(input: AdminReportQueueInput) {
    this.ensureAnchorForCommunity(input.actor, input.communityId);
    const limit = coerceLimit(input.limit, 50, 20);
    return this.repository.listReportQueuePage({
      communityId: input.communityId,
      status: input.status,
      cursor: input.cursor ?? null,
      limit,
    }).then((page) => ({
      items: page.items,
      next_cursor: page.nextCursor,
    }));
  }

  async decideReport(input: ReportDecisionInput) {
    this.ensureAnchorForCommunity(input.actor, input.communityId);
    const decision = await this.repository.decideReport({
      communityId: input.communityId,
      reportId: input.reportId,
      decision: input.decision,
      notes: input.notes ?? null,
      anchorUserId: input.actor.userId,
      decidedAt: this.now().toISOString(),
    });
    if (!decision) {
      throw new ChatServiceError("Report not found", "not_found");
    }

    return decision;
  }

  private async resolveReportContext(input: SubmitReportInput): Promise<{
    conversation: ConversationRecord | null;
    communityId: string;
  }> {
    const conversation = input.conversationId
      ? await this.repository.getConversation(input.conversationId, null)
      : null;

    if (conversation) {
      this.ensureParticipant(conversation, input.actor.userId);
    }

    if (input.targetType === "post") {
      if (input.conversationId && !conversation) {
        throw new ChatServiceError("Conversation not found", "not_found");
      }

      const communityId = await this.repository.getPostCommunityId(input.targetId);
      if (!communityId) {
        throw new ChatServiceError("Report target is not valid for this community", "not_found");
      }

      if (conversation && !conversation.related_post_ids.includes(input.targetId)) {
        throw new ChatServiceError("Report target is not valid for this conversation", "forbidden");
      }

      return {
        conversation,
        communityId,
      };
    }

    if (input.targetType === "user") {
      if (!conversation) {
        const sharedCommunityIds = Array.from(
          new Set(
            (input.actor.communityIds ?? []).filter((communityId) =>
              input.targetCommunityIds?.includes(communityId),
            ),
          ),
        );

        if (sharedCommunityIds.length === 0) {
          throw new ChatServiceError("Report target is not valid for this community", "forbidden");
        }

        if (sharedCommunityIds.length > 1) {
          throw new ChatServiceError(
            "Report target belongs to multiple communities; provide conversation_id context",
            "invalid_input",
          );
        }

        return {
          conversation: null,
          communityId: sharedCommunityIds[0]!,
        };
      }

      const communityId = await this.resolveConversationCommunityId(conversation);
      const otherUserId = this.getOtherParticipantId(conversation, input.actor.userId);
      if (input.targetId !== otherUserId) {
        throw new ChatServiceError("Report target is not valid for this conversation", "forbidden");
      }

      return {
        conversation,
        communityId,
      };
    }

    if (!conversation) {
      const messageContext = await this.repository.getMessageContext(input.targetId);
      if (!messageContext) {
        throw new ChatServiceError("Message not found", "not_found");
      }

      if (!messageContext.participantUserIds.includes(input.actor.userId)) {
        throw new ChatServiceError("Report target is not valid for this conversation", "forbidden");
      }

      if (!messageContext.communityId) {
        throw new ChatServiceError("Message does not have a reportable community", "not_found");
      }

      return {
        conversation: null,
        communityId: messageContext.communityId,
      };
    }

    const communityId = await this.resolveConversationCommunityId(conversation);
    const message = await this.repository.getMessage(input.targetId, input.conversationId!);
    if (!message) {
        throw new ChatServiceError("Message not found", "not_found");
    }

    return {
      conversation,
      communityId,
    };
  }

  private async resolveConversationCommunityId(conversation: ConversationRecord) {
    const relatedPostId = conversation.related_post_ids[0];
    if (!relatedPostId) {
      throw new ChatServiceError("Conversation does not have a reportable community", "invalid_input");
    }

    const communityId = await this.repository.getPostCommunityId(relatedPostId);
    if (!communityId) {
      throw new ChatServiceError("Conversation does not have a reportable community", "not_found");
    }

    return communityId;
  }

  private ensureParticipant(
    conversation: Pick<ConversationRecord, "participant_user_ids">,
    userId: string,
  ) {
    if (!conversation.participant_user_ids.includes(userId)) {
      throw new ChatServiceError("Conversation is not available to this user", "forbidden");
    }
  }

  private getOtherParticipantId(
    conversation: Pick<ConversationDetail, "participant_user_ids">,
    actorUserId: string,
  ) {
    const otherUserId = conversation.participant_user_ids.find((userId) => userId !== actorUserId);
    if (!otherUserId) {
      throw new ChatServiceError("Conversation is not available to this user", "forbidden");
    }
    return otherUserId;
  }

  private async collectConversationIdsForPair(userId: string, otherUserId: string) {
    const conversationIds = new Set<string>();
    let cursor: string | null = null;

    do {
      const page = await this.repository.listConversationsPage({
        userId,
        cursor,
        limit: 100,
      });

      for (const conversation of page.items) {
        if (conversation.participant_user_ids.includes(otherUserId)) {
          conversationIds.add(conversation.conversation_id);
        }
      }

      cursor = page.nextCursor;
    } while (cursor);

    return [...conversationIds];
  }

  private ensureAnchorForCommunity(
    actor: {
      role?: string;
      communityIds?: string[];
      anchorCommunityId?: string | null;
      mfaVerifiedAt?: string;
    },
    communityId: string,
  ) {
    const occurredAt = actor.mfaVerifiedAt ? Date.parse(actor.mfaVerifiedAt) : Number.NaN;
    const hasFreshMfa =
      !Number.isNaN(occurredAt) &&
      Date.now() - occurredAt <= anchorSessionIdleTtlSeconds * 1000;
    const isAnchor =
      actor.role === "anchor" && actor.anchorCommunityId === communityId && hasFreshMfa;
    if (!isAnchor) {
      throw new ChatServiceError("Only anchors can manage reports for this community", "forbidden");
    }
  }
}
