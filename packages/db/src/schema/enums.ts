import { pgEnum } from "drizzle-orm/pg-core";

export const userStatusEnum = pgEnum("user_status", ["active", "suspended", "deleted"]);
export const userLevelEnum = pgEnum("user_level", ["anonymous", "verified", "anchor"]);
export const joinPolicyEnum = pgEnum("join_policy", ["invite_only", "open"]);
export const communityAccessChannelEnum = pgEnum("community_access_channel", [
  "invite_code",
  "qr_token"
]);
export const communityAccessCodeStatusEnum = pgEnum("community_access_code_status", [
  "active",
  "revoked"
]);
export const postTypeEnum = pgEnum("post_type", ["request", "offer"]);
export const categoryEnum = pgEnum("category", [
  "food",
  "goods",
  "childcare",
  "companionship",
  "translation",
  "transportation",
  "other"
]);
export const privacyEnum = pgEnum("privacy", ["community_only", "public", "anchor_mediated"]);
export const postStatusEnum = pgEnum("post_status", [
  "draft",
  "pending_review",
  "active",
  "fulfilled",
  "closed",
  "removed"
]);
export const riskLevelEnum = pgEnum("risk_level", ["low", "medium", "high"]);
export const verificationStateEnum = pgEnum("verification_state", [
  "unverified",
  "verified_by_anchor",
  "verified_by_witnesses"
]);
export const languageEnum = pgEnum("language", ["en", "es", "zh"]);
export const datasetVersionStatusEnum = pgEnum("dataset_version_status", [
  "importing",
  "active",
  "superseded",
  "failed"
]);
export const resourceStatusEnum = pgEnum("resource_status", ["active", "inactive"]);
export const contactRequestStatusEnum = pgEnum("contact_request_status", [
  "pending",
  "accepted",
  "rejected",
  "expired",
  "cancelled"
]);
export const reportStatusEnum = pgEnum("report_status", ["new", "in_review", "resolved", "dismissed"]);
export const reportReasonEnum = pgEnum("report_reason", [
  "harassment",
  "scam",
  "misinformation",
  "unsafe_behavior",
  "other"
]);
export const resolutionEnum = pgEnum("resolution", ["remove_post", "suspend_user", "warn", "none"]);
