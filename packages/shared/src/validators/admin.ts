import { z } from "zod";

import {
  anchorActivationChallengeTtlSeconds,
  anchorSessionChallengeTtlSeconds,
  otpCodeLength,
} from "../auth";
import {
  announcementPinStrategies,
  announcementStatuses,
  postCategories,
  reportDecisions,
  reportReasons,
  reportStatuses,
  reportTargetTypes,
  reviewPriorityLabels,
  supportedLanguages,
} from "../enums";

export const anchorActivateRequestSchema = z.object({
  invite_code: z.string().min(6).max(120),
});

export const anchorActivateResponseSchema = z.object({
  activation_id: z.string().uuid(),
  community: z.object({
    community_id: z.string().uuid(),
    name: z.string().min(1),
    center_zip: z.string().min(1),
    join_policy: z.enum(["invite_only", "open"]),
  }),
  otpauth_uri: z.string().url(),
  recovery_codes: z.array(z.string().min(1)).length(8),
  expires_in_seconds: z.literal(anchorActivationChallengeTtlSeconds),
});

export const anchorActivateConfirmRequestSchema = z.object({
  activation_id: z.string().uuid(),
  totp_code: z.string().length(otpCodeLength),
});

export const anchorSessionStartRequestSchema = z.object({
  community_id: z.string().uuid(),
});

export const anchorSessionStartResponseSchema = z.object({
  challenge_id: z.string().uuid(),
  expires_in_seconds: z.literal(anchorSessionChallengeTtlSeconds),
});

export const anchorSessionVerifyRequestSchema = z.object({
  challenge_id: z.string().uuid(),
  totp_code: z.string().length(otpCodeLength),
});

export const adminReportQueueStatusSchema = z.enum(reportStatuses);
export const reportDecisionSchema = z.enum(reportDecisions);
export const reviewPriorityLabelSchema = z.enum(reviewPriorityLabels);

export const adminReportTargetSummarySchema = z.object({
  title: z.string().min(1),
  body_preview: z.string().nullable(),
  related_user_id: z.string().uuid().nullable(),
});

export const adminReportQueueItemSchema = z.object({
  report_id: z.string().uuid(),
  community_id: z.string().uuid(),
  target_type: z.enum(reportTargetTypes),
  target_id: z.string().uuid(),
  reason: z.enum(reportReasons),
  status: adminReportQueueStatusSchema,
  created_at: z.string().datetime(),
  reporter_user_id: z.string().uuid(),
  reporter_alias: z.string().min(1),
  priority: reviewPriorityLabelSchema,
  conversation_id: z.string().uuid().nullable(),
  target_summary: adminReportTargetSummarySchema,
  evidence_description: z.string().nullable(),
});

export const adminReportQueueResponseSchema = z.object({
  items: z.array(adminReportQueueItemSchema),
  next_cursor: z.string().nullable(),
});

export const reportDecisionRequestSchema = z.object({
  decision: reportDecisionSchema,
  notes: z.string().min(1).max(1000).optional(),
});

export const reportDecisionResponseSchema = z.object({
  report_id: z.string().uuid(),
  status: adminReportQueueStatusSchema,
  resolution: z.enum(["remove_post", "suspend_user", "warn", "none"]),
  decided_at: z.string().datetime(),
  affected_user_id: z.string().uuid().nullable().optional(),
});

export const communityRulesSchema = z.object({
  community_id: z.string().uuid(),
  review_categories: z.array(z.enum(postCategories)),
  auto_hide_report_threshold: z.number().int().min(1).max(20),
  keyword_blocklist: z.array(z.string().min(1).max(120)).max(100),
  language_preferences: z.array(z.enum(supportedLanguages)),
  announcement_pin_strategy: z.enum(announcementPinStrategies),
  updated_at: z.string().datetime(),
});

export const announcementSchema = z.object({
  announcement_id: z.string().uuid(),
  community_id: z.string().uuid(),
  title: z.string().min(1).max(140),
  body: z.string().min(1).max(4000),
  status: z.enum(announcementStatuses),
  is_pinned: z.boolean(),
  published_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  created_by: z.string().uuid(),
});

export const announcementCreateRequestSchema = z.object({
  title: z.string().min(1).max(140),
  body: z.string().min(1).max(4000),
  is_pinned: z.boolean().optional(),
});

export const announcementUpdateRequestSchema = announcementCreateRequestSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one announcement field must be provided"
);

export const announcementsResponseSchema = z.object({
  items: z.array(announcementSchema),
});

export const adminDashboardResponseSchema = z.object({
  community_id: z.string().uuid(),
  posts_this_week_request_count: z.number().int().min(0),
  posts_this_week_offer_count: z.number().int().min(0),
  accepted_contacts_this_week_count: z.number().int().min(0),
  reports_this_week_count: z.number().int().min(0),
  pending_post_review_count: z.number().int().min(0),
  pending_report_count: z.number().int().min(0),
});
