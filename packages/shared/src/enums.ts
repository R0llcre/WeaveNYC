export const userLevels = ["anonymous", "verified", "anchor"] as const;
export type UserLevel = (typeof userLevels)[number];

export const userRoles = ["user", "anchor"] as const;
export type UserRole = (typeof userRoles)[number];

export const supportedLanguages = ["en", "es", "zh"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

export const joinPolicies = ["invite_only", "open"] as const;
export type JoinPolicy = (typeof joinPolicies)[number];

export const communityAccessEntries = ["invite_code", "qr_token"] as const;
export type CommunityAccessEntry = (typeof communityAccessEntries)[number];

export const membershipStatuses = ["joined", "already_joined"] as const;
export type MembershipStatus = (typeof membershipStatuses)[number];

export const postTypes = ["request", "offer"] as const;
export type PostType = (typeof postTypes)[number];

export const postCategories = [
  "food",
  "goods",
  "childcare",
  "companionship",
  "translation",
  "transportation",
  "other",
] as const;
export type PostCategory = (typeof postCategories)[number];

export const privacyOptions = ["community_only", "public", "anchor_mediated"] as const;
export type PrivacyOption = (typeof privacyOptions)[number];

export const postStatuses = [
  "draft",
  "pending_review",
  "active",
  "fulfilled",
  "closed",
  "removed",
] as const;
export type PostStatus = (typeof postStatuses)[number];

export const riskLevels = ["low", "medium", "high"] as const;
export type RiskLevel = (typeof riskLevels)[number];

export const postScopes = ["community", "public"] as const;
export type PostScope = (typeof postScopes)[number];

export const reviewDecisions = ["approve", "reject", "request_more_info"] as const;
export type ReviewDecision = (typeof reviewDecisions)[number];

export const reviewPriorityLabels = ["P0", "P1", "P2"] as const;
export type ReviewPriorityLabel = (typeof reviewPriorityLabels)[number];

export const speechProviders = ["browser", "server_fallback"] as const;
export type SpeechProvider = (typeof speechProviders)[number];

export const matchCandidateTypes = ["neighbor_post", "official_resource"] as const;
export type MatchCandidateType = (typeof matchCandidateTypes)[number];

export const matchReasons = [
  "same_category",
  "same_language",
  "within_1_mile",
  "within_3_miles",
  "within_5_miles",
  "verified_user",
  "anchor_reviewed",
  "expires_soon",
  "open_now",
  "open_today",
  "nearby_resource",
  "language_supported",
] as const;
export type MatchReason = (typeof matchReasons)[number];

export const contactRequestStatuses = [
  "pending",
  "accepted",
  "rejected",
  "expired",
  "cancelled",
] as const;
export type ContactRequestStatus = (typeof contactRequestStatuses)[number];

export const conversationStatuses = ["active", "closed", "blocked"] as const;
export type ConversationStatus = (typeof conversationStatuses)[number];

export const reportTargetTypes = ["post", "user", "message"] as const;
export type ReportTargetType = (typeof reportTargetTypes)[number];

export const reportReasons = [
  "harassment",
  "scam",
  "misinformation",
  "unsafe_behavior",
  "other",
] as const;
export type ReportReason = (typeof reportReasons)[number];

export const reportStatuses = ["new", "resolved", "dismissed"] as const;
export type ReportStatus = (typeof reportStatuses)[number];

export const reportDecisions = ["dismiss", "warn", "remove_post", "suspend_user"] as const;
export type ReportDecision = (typeof reportDecisions)[number];

export const announcementStatuses = ["active", "deleted"] as const;
export type AnnouncementStatus = (typeof announcementStatuses)[number];

export const announcementPinStrategies = ["latest", "manual"] as const;
export type AnnouncementPinStrategy = (typeof announcementPinStrategies)[number];

export const p2pAggregateTypes = ["post", "announcement", "report", "moderation"] as const;
export type P2PAggregateType = (typeof p2pAggregateTypes)[number];

export const p2pEventTypes = [
  "post.published",
  "post.updated",
  "post.tombstoned",
  "announcement.published",
  "announcement.updated",
  "announcement.deleted",
  "report.created",
  "moderation.decision",
] as const;
export type P2PEventType = (typeof p2pEventTypes)[number];

export const p2pSyncTransports = ["bootstrap", "mdns-demo"] as const;
export type P2PSyncTransport = (typeof p2pSyncTransports)[number];

export const anchorSessionIssuedViaValues = ["anonymous", "otp", "magic_link", "refresh", "anchor_activate", "anchor_session"] as const;
export type AnchorSessionIssuedVia = (typeof anchorSessionIssuedViaValues)[number];

export const messageSafetyFlags = [
  "sensitive_ssn",
  "sensitive_phone",
  "sensitive_address",
  "sensitive_bank_account",
  "keyword_passport",
  "keyword_bank",
  "keyword_wire",
  "keyword_crypto",
  "keyword_gift_card",
] as const;
export type MessageSafetyFlag = (typeof messageSafetyFlags)[number];

export const chatRealtimeEventTypes = [
  "message.created",
  "conversation.updated",
  "heartbeat",
] as const;
export type ChatRealtimeEventType = (typeof chatRealtimeEventTypes)[number];
