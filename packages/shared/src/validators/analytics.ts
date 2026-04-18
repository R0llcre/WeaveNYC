import { z } from "zod";

export const analyticsEventTypes = [
  "verified_match_created",
  "contact_accepted",
  "post_published",
  "anchor_decision",
  "account_deleted",
  "account_undeleted",
  "account_purged",
  "anchor_activated",
  "ttfv_sample",
] as const;
export type AnalyticsEventType = (typeof analyticsEventTypes)[number];

export const analyticsEventTypeSchema = z.enum(analyticsEventTypes);

export const analyticsEventInputSchema = z.object({
  event_type: analyticsEventTypeSchema,
  community_id: z.string().uuid().optional(),
  actor_user_id: z.string().uuid().optional(),
  payload: z.record(z.any()).optional(),
});
export type AnalyticsEventInput = z.infer<typeof analyticsEventInputSchema>;

export const ttfvSampleRequestSchema = z.object({
  milliseconds_since_bootstrap: z.number().int().min(0).max(5 * 60 * 1000),
});
export type TtfvSampleRequest = z.infer<typeof ttfvSampleRequestSchema>;

export const ttfvSampleResponseSchema = z.object({
  accepted: z.boolean(),
});
export type TtfvSampleResponse = z.infer<typeof ttfvSampleResponseSchema>;
