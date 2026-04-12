export type ChatUserLevel = "anonymous" | "verified" | "anchor";

export type ConversationStatus = "active" | "closed" | "blocked";

export type ChatReportReason =
  | "harassment"
  | "scam"
  | "misinformation"
  | "unsafe_behavior"
  | "other";

export type ChatReportTargetType = "post" | "user" | "message";

export type ChatSafetyFlag =
  | "sensitive_ssn"
  | "sensitive_phone"
  | "sensitive_address"
  | "sensitive_bank_account"
  | "keyword_passport"
  | "keyword_bank"
  | "keyword_wire"
  | "keyword_crypto"
  | "keyword_gift_card";

export type ChatActor = {
  userId: string;
  level: ChatUserLevel;
  alias?: string;
  communityIds?: string[];
};

export type ConversationParticipantPreview = {
  user_id: string;
  alias: string;
};

export type ConversationRecord = {
  conversation_id: string;
  contact_request_id: string;
  participant_user_ids: [string, string];
  participant_preview: [ConversationParticipantPreview, ConversationParticipantPreview];
  related_post_ids: string[];
  status: ConversationStatus;
  created_at: string;
  last_activity_at: string;
  closed_at: string | null;
  blocked_at: string | null;
  blocked_by_user_id: string | null;
  last_message_preview: string | null;
  last_message_at: string | null;
  unread_count: number;
};

export type ConversationSummary = ConversationRecord & {
  other_participant: ConversationParticipantPreview;
  can_send: boolean;
};

export type ConversationDetail = ConversationSummary;

export type ChatMessage = {
  message_id: string;
  conversation_id: string;
  sender_user_id: string;
  body: string;
  safety_flags: ChatSafetyFlag[];
  sent_at: string;
};

export type MessagePage = {
  conversation: ConversationDetail;
  items: ChatMessage[];
  next_cursor: string | null;
};

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};

export type SendMessageInput = {
  actor: ChatActor;
  conversationId: string;
  body: string;
};

export type SendMessageResult = {
  conversation: ConversationDetail;
  message: ChatMessage;
};

export type ListConversationInput = {
  actor: ChatActor;
  cursor?: string | null;
  limit?: number;
};

export type GetConversationInput = {
  actor: ChatActor;
  conversationId: string;
};

export type ListMessagesInput = {
  actor: ChatActor;
  conversationId: string;
  cursor?: string | null;
  limit?: number;
};

export type CloseConversationInput = {
  actor: ChatActor;
  conversationId: string;
};

export type BlockUserInput = {
  actor: ChatActor;
  conversationId: string;
  blockedUserId: string;
};

export type ListConversationIdsForPairInput = {
  actor: ChatActor;
  otherUserId: string;
};

export type BlockRecord = {
  block_id: string;
  blocker_user_id: string;
  blocked_user_id: string;
  conversation_id: string | null;
  created_at: string;
};

export type BlockUserResult = {
  block: BlockRecord;
  affectedConversations: ConversationDetail[];
};

export type ReportRecord = {
  report_id: string;
  community_id: string;
  target_type: ChatReportTargetType;
  target_id: string;
  reason: ChatReportReason;
  detail_text: string | null;
  reporter_user_id: string;
  created_at: string;
};

export type SubmitReportInput = {
  actor: ChatActor;
  conversationId?: string;
  targetType: ChatReportTargetType;
  targetId: string;
  reason: ChatReportReason;
  detailText?: string | null;
  targetCommunityIds?: string[];
};

export type ChatSafetyInspection = {
  blocked: boolean;
  blockingFlags: ChatSafetyFlag[];
  advisoryFlags: ChatSafetyFlag[];
  userMessage?: string;
};

export type ChatSafetyDetector = {
  inspectMessage(input: {
    actor: ChatActor;
    conversation: ConversationDetail;
    body: string;
  }): ChatSafetyInspection;
};

export type ChatServiceHooks = {
  onMessageAccepted?(event: {
    actor: ChatActor;
    conversationId: string;
    messageId: string;
    advisoryFlags: ChatSafetyFlag[];
  }): Promise<void> | void;
  onMessageBlocked?(event: {
    actor: ChatActor;
    conversationId: string;
    blockingFlags: ChatSafetyFlag[];
  }): Promise<void> | void;
  onConversationBlocked?(event: {
    actor: ChatActor;
    conversationId: string;
    blockedUserId: string;
    blockId: string;
  }): Promise<void> | void;
  onReportCreated?(event: {
    actor: ChatActor;
    conversationId?: string;
    reportId: string;
    reason: ChatReportReason;
  }): Promise<void> | void;
};

export type ChatRepositoryMessageRecord = ChatMessage;

export interface ChatRepository {
  close(): Promise<void>;
  listConversationsPage(input: {
    userId: string;
    cursor: string | null;
    limit: number;
  }): Promise<CursorPage<ConversationRecord>>;
  getConversation(conversationId: string, userId?: string | null): Promise<ConversationRecord | null>;
  listMessagesPage(input: {
    conversationId: string;
    cursor: string | null;
    limit: number;
  }): Promise<CursorPage<ChatRepositoryMessageRecord>>;
  countRecentMessagesByUser(userId: string, sinceIso: string): Promise<number>;
  saveMessage(input: {
    conversationId: string;
    senderUserId: string;
    body: string;
    safetyFlags: ChatSafetyFlag[];
    sentAt: string;
  }): Promise<ChatRepositoryMessageRecord>;
  markConversationRead(input: {
    conversationId: string;
    userId: string;
    messageId: string;
    readAt: string;
  }): Promise<void>;
  updateConversationState(input: {
    conversationId: string;
    status: ConversationStatus;
    changedAt: string;
    blockedByUserId?: string | null;
  }): Promise<ConversationRecord>;
  findBlockBetweenUsers(userA: string, userB: string): Promise<BlockRecord | null>;
  saveBlock(input: {
    blockerUserId: string;
    blockedUserId: string;
    conversationId: string | null;
    createdAt: string;
  }): Promise<BlockRecord>;
  saveReport(input: {
    communityId: string;
    targetType: ChatReportTargetType;
    targetId: string;
    reason: ChatReportReason;
    detailText: string | null;
    reporterUserId: string;
    createdAt: string;
  }): Promise<ReportRecord>;
  getMessage(messageId: string, conversationId: string): Promise<ChatMessage | null>;
  getMessageContext(messageId: string): Promise<{
    message: ChatMessage;
    participantUserIds: [string, string];
    communityId: string | null;
  } | null>;
  getPostCommunityId(postId: string): Promise<string | null>;
}

export interface ChatService {
  close(): Promise<void>;
  listConversations(input: ListConversationInput): Promise<CursorPage<ConversationSummary>>;
  listConversationIdsForPair(input: ListConversationIdsForPairInput): Promise<string[]>;
  getConversation(input: GetConversationInput): Promise<ConversationDetail>;
  listMessages(input: ListMessagesInput): Promise<MessagePage>;
  sendMessage(input: SendMessageInput): Promise<SendMessageResult>;
  closeConversation(input: CloseConversationInput): Promise<ConversationDetail>;
  blockUser(input: BlockUserInput): Promise<BlockUserResult>;
  submitReport(input: SubmitReportInput): Promise<ReportRecord>;
}

export class ChatServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "forbidden"
      | "not_found"
      | "invalid_input"
      | "conversation_closed"
      | "conversation_blocked"
      | "rate_limited"
      | "sensitive_content_detected",
    public readonly details?: {
      safetyFlags?: ChatSafetyFlag[];
    },
  ) {
    super(message);
    this.name = "ChatServiceError";
  }
}
