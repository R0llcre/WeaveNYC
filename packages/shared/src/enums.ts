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

export const speechProviders = ["browser", "server_fallback"] as const;
export type SpeechProvider = (typeof speechProviders)[number];
