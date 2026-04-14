import { z } from "zod";

import {
  communityAccessEntries,
  joinPolicies,
  membershipStatuses,
  postCategories,
  postScopes,
  postStatuses,
  postTypes,
  privacyOptions,
  reviewDecisions,
  riskLevels,
  speechProviders,
  supportedLanguages,
} from "../enums";

const zipSchema = z.string().regex(/^\d{5}$/);
const cursorSchema = z.string().regex(/^[A-Za-z0-9_-]+$/);

export const joinPolicySchema = z.enum(joinPolicies);
export const communityAccessEntrySchema = z.enum(communityAccessEntries);
export const membershipStatusSchema = z.enum(membershipStatuses);
export const postTypeSchema = z.enum(postTypes);
export const postCategorySchema = z.enum(postCategories);
export const privacySchema = z.enum(privacyOptions);
export const postStatusSchema = z.enum(postStatuses);
export const riskLevelSchema = z.enum(riskLevels);
export const postScopeSchema = z.enum(postScopes);
export const reviewDecisionSchema = z.enum(reviewDecisions);
export const speechProviderSchema = z.enum(speechProviders);
export const supportedLanguageSchema = z.enum(supportedLanguages);

export const communitySummarySchema = z.object({
  community_id: z.string().uuid(),
  name: z.string().min(1),
  center_zip: zipSchema,
  join_policy: joinPolicySchema,
});

export const communityAccessResolveRequestSchema = z
  .object({
    invite_code: z.string().min(1).optional(),
    qr_token: z.string().min(1).optional(),
  })
  .refine(
    (input) => Number(Boolean(input.invite_code)) + Number(Boolean(input.qr_token)) === 1,
    {
      message: "Provide exactly one of invite_code or qr_token.",
    },
  );

export const communityAccessResolveResponseSchema = z.object({
  community: communitySummarySchema,
  join_token: z.string().min(1),
  entry: communityAccessEntrySchema,
  expires_in_seconds: z.number().int().positive(),
});

export const joinCommunityRequestSchema = z.object({
  join_token: z.string().min(1),
});

export const joinCommunityResponseSchema = z.object({
  community_id: z.string().uuid(),
  membership_status: membershipStatusSchema,
  joined_at: z.string().datetime(),
});

export const contactPreferenceSchema = z
  .object({
    in_app_chat: z.boolean().optional(),
    call: z.boolean().optional(),
    text: z.boolean().optional(),
    notes: z.string().min(1).max(280).optional(),
  })
  .strict();

export const createPostRequestSchema = z.object({
  community_id: z.string().uuid(),
  post_type: postTypeSchema,
  category: postCategorySchema,
  title: z.string().trim().min(1).max(60),
  body: z.string().trim().min(1).max(3000),
  language: supportedLanguageSchema,
  location_zip: zipSchema,
  privacy: privacySchema,
  expires_at: z.string().datetime(),
  contact_pref: contactPreferenceSchema.optional(),
});

export const createPostResponseSchema = z.object({
  post_id: z.string().uuid(),
  status: postStatusSchema,
  risk_level: riskLevelSchema,
});

export const updatePostRequestSchema = z
  .object({
    category: postCategorySchema.optional(),
    title: z.string().trim().min(1).max(60).optional(),
    body: z.string().trim().min(1).max(3000).optional(),
    language: supportedLanguageSchema.optional(),
    location_zip: zipSchema.optional(),
    privacy: privacySchema.optional(),
    expires_at: z.string().datetime().optional(),
    contact_pref: contactPreferenceSchema.optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "Provide at least one field to update.",
  });

export const postActionsSchema = z.object({
  can_edit: z.boolean(),
  can_close: z.boolean(),
  can_delete: z.boolean(),
  can_review: z.boolean(),
});

export const postSummarySchema = z.object({
  post_id: z.string().uuid(),
  community_id: z.string().uuid(),
  post_type: postTypeSchema,
  category: postCategorySchema,
  title: z.string().min(1),
  body: z.string().min(1),
  language: supportedLanguageSchema,
  location_zip: zipSchema,
  privacy: privacySchema,
  status: postStatusSchema,
  risk_level: riskLevelSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  expires_at: z.string().datetime(),
  is_owner: z.boolean(),
  p2p_version: z.number().int().positive().optional(),
  ipfs_cid: z.string().min(1).nullable().optional(),
});

export const postDetailSchema = postSummarySchema.extend({
  contact_pref: contactPreferenceSchema.nullable(),
  actions: postActionsSchema,
});

export const postParamsSchema = z.object({
  post_id: z.string().uuid(),
});

export const postsListQuerySchema = z.object({
  scope: postScopeSchema,
  community_id: z.string().uuid().optional(),
  post_type: postTypeSchema.optional(),
  category: postCategorySchema.optional(),
  status: postStatusSchema.optional(),
  cursor: cursorSchema.nullable().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

export const postMineQuerySchema = z.object({
  community_id: z.string().uuid().optional(),
  status: postStatusSchema.optional(),
  cursor: cursorSchema.nullable().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

export const postsListResponseSchema = z.object({
  items: z.array(postSummarySchema),
  next_cursor: z.string().min(1).nullable(),
});

export const myPostsResponseSchema = postsListResponseSchema;

export const reviewQueueQuerySchema = z.object({
  community_id: z.string().uuid(),
  cursor: cursorSchema.nullable().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

export const reviewQueueItemSchema = postSummarySchema.extend({
  review_actions: z.array(reviewDecisionSchema),
});

export const reviewQueueResponseSchema = z.object({
  items: z.array(reviewQueueItemSchema),
  next_cursor: z.string().min(1).nullable(),
});

export const reviewDecisionRequestSchema = z.object({
  decision: reviewDecisionSchema,
  notes: z.string().trim().min(1).max(500).optional(),
});

export const reviewDecisionResponseSchema = z.object({
  post_id: z.string().uuid(),
  status: postStatusSchema,
  decided_at: z.string().datetime(),
});

export const speechTranscribeResponseSchema = z.object({
  transcript: z.string(),
  language: supportedLanguageSchema,
  provider: speechProviderSchema,
});
