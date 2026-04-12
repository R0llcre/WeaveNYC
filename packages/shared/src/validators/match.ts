import { z } from "zod";

import {
  contactRequestStatuses,
  matchCandidateTypes,
  matchReasons,
} from "../enums";
import { postCategorySchema, postSummarySchema } from "./posts";
import { resourceSummarySchema } from "./resources";

const cursorSchema = z.string().regex(/^[A-Za-z0-9_-]+$/);

export const matchCandidateTypeSchema = z.enum(matchCandidateTypes);
export const matchReasonSchema = z.enum(matchReasons);
export const contactRequestStatusSchema = z.enum(contactRequestStatuses);

export const matchSuggestionSchema = z.object({
  suggestion_id: z.string().uuid(),
  batch_number: z.number().int().positive(),
  position: z.number().int().positive(),
  candidate_type: matchCandidateTypeSchema,
  candidate_id: z.string().uuid(),
  score: z.number().min(0).max(1),
  reasons: z.array(matchReasonSchema),
  distance_miles: z.number().nullable(),
  neighbor_post: postSummarySchema.nullable(),
  official_resource: resourceSummarySchema.nullable(),
});

export const matchResultsResponseSchema = z.object({
  post_id: z.string().uuid(),
  batch_number: z.number().int().positive(),
  advanced: z.boolean(),
  refreshes_used: z.number().int().min(0).max(1),
  max_refreshes: z.literal(1),
  items: z.array(matchSuggestionSchema).max(3),
});

export const matchResultsQuerySchema = z.object({
  refresh: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((value) => value === true || value === "true")
    .optional(),
});

export const matchContactRequestSchema = z.object({
  from_post_id: z.string().uuid(),
  to_post_id: z.string().uuid(),
});

export const matchContactResponseSchema = z.object({
  contact_request_id: z.string().uuid(),
  status: z.enum(["pending", "accepted"]),
  conversation_id: z.string().uuid().optional(),
});

export const contactRequestInboxItemSchema = z.object({
  contact_request_id: z.string().uuid(),
  from_post_id: z.string().uuid(),
  to_post_id: z.string().uuid(),
  requester_user_id: z.string().uuid(),
  requester_alias: z.string().min(1),
  status: contactRequestStatusSchema,
  created_at: z.string().datetime(),
  expires_at: z.string().datetime(),
  from_post_title: z.string().min(1),
  to_post_title: z.string().min(1),
  from_post_category: postCategorySchema,
  to_post_category: postCategorySchema,
});

export const contactRequestInboxQuerySchema = z.object({
  cursor: cursorSchema.nullable().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

export const contactRequestInboxResponseSchema = z.object({
  items: z.array(contactRequestInboxItemSchema),
  next_cursor: z.string().min(1).nullable(),
});

export const contactRequestParamsSchema = z.object({
  contact_request_id: z.string().uuid(),
});

export const contactRequestDecisionResponseSchema = z.object({
  contact_request_id: z.string().uuid(),
  status: z.enum(["accepted", "rejected"]),
  responded_at: z.string().datetime(),
  conversation_id: z.string().uuid().optional(),
});

export const conversationParamsSchema = z.object({
  conversation_id: z.string().uuid(),
});
