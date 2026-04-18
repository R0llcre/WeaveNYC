import { z } from "zod";

import {
  anchorSessionIssuedViaValues,
  magicLinkChallengeTtlSeconds,
  otpChallengeTtlSeconds,
  userLevels,
} from "../auth";

export const userLevelSchema = z.enum(userLevels);

export const sessionUserSchema = z.object({
  user_id: z.string().uuid(),
  level: userLevelSchema,
  role: z.enum(["user", "anchor"]),
  community_ids: z.array(z.string().uuid()),
  anchor_community_id: z.string().uuid().optional(),
  mfa_verified_at: z.string().datetime().optional(),
});

export const anonymousAuthRequestSchema = z.object({
  device_id: z.string().uuid(),
});

export const anonymousAuthResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  issued_via: z.enum(anchorSessionIssuedViaValues).optional(),
  fallback: z.boolean().optional(),
  user: sessionUserSchema.pick({
    user_id: true,
    level: true,
  }),
});

export const refreshSessionRequestSchema = z.object({
  refresh_token: z.string().min(1),
});

export const refreshSessionResponseSchema = anonymousAuthResponseSchema;

export const otpStartRequestSchema = z.object({
  phone: z.string().min(7).max(32),
});

export const otpStartResponseSchema = z.object({
  challenge_id: z.string().uuid(),
  masked_destination: z.string().min(1),
  delivery_channel: z.literal("sms"),
  expires_in_seconds: z.literal(otpChallengeTtlSeconds),
  fallback: z.boolean(),
  demo_code: z.string().length(6).optional(),
});

export const otpVerifyRequestSchema = z.object({
  challenge_id: z.string().uuid(),
  code: z.string().length(6),
});

export const otpVerifyResponseSchema = anonymousAuthResponseSchema;

export const magicLinkStartRequestSchema = z.object({
  email: z.string().email(),
});

export const magicLinkStartResponseSchema = z.object({
  challenge_id: z.string().uuid(),
  masked_destination: z.string().min(1),
  delivery_channel: z.literal("email"),
  expires_in_seconds: z.literal(magicLinkChallengeTtlSeconds),
  fallback: z.boolean(),
  demo_token: z.string().min(1).optional(),
  demo_url: z.string().url().optional(),
});

export const magicLinkVerifyRequestSchema = z.object({
  challenge_id: z.string().uuid(),
  token: z.string().min(1),
});

export const magicLinkVerifyResponseSchema = anonymousAuthResponseSchema;

export const anchorSessionRecoveryRequestSchema = z.object({
  community_id: z.string().uuid(),
  recovery_code: z.string().min(6).max(64),
});
export type AnchorSessionRecoveryRequest = z.infer<
  typeof anchorSessionRecoveryRequestSchema
>;

export const anchorSessionRecoveryResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  issued_via: z.enum(anchorSessionIssuedViaValues).optional(),
  fallback: z.boolean().optional(),
  user: sessionUserSchema.pick({
    user_id: true,
    level: true,
  }),
  remaining_attempts: z.number().int().min(0),
});
export type AnchorSessionRecoveryResponse = z.infer<
  typeof anchorSessionRecoveryResponseSchema
>;

export const anchorSessionRecoveryErrorResponseSchema = z.object({
  message: z.string().min(1),
  remaining_attempts: z.number().int().min(0).optional(),
});
export type AnchorSessionRecoveryErrorResponse = z.infer<
  typeof anchorSessionRecoveryErrorResponseSchema
>;

export const meResponseSchema = z.object({
  user: sessionUserSchema,
});

export const accountDeleteReasons = [
  "no_longer_needed",
  "privacy_concerns",
  "moving_away",
  "safety_concerns",
  "other",
] as const;
export type AccountDeleteReason = (typeof accountDeleteReasons)[number];

export const accountLifecycleDeliveryChannels = ["sms", "email"] as const;
export type AccountLifecycleDeliveryChannel =
  (typeof accountLifecycleDeliveryChannels)[number];

export const accountDeleteRequestRequestSchema = z.object({}).strict();
export type AccountDeleteRequestRequest = z.infer<
  typeof accountDeleteRequestRequestSchema
>;

export const accountDeleteRequestResponseSchema = z.object({
  challenge_id: z.string().uuid(),
  masked_destination: z.string().min(1),
  delivery_channel: z.enum(accountLifecycleDeliveryChannels),
  expires_in_seconds: z.number().int().positive(),
  fallback: z.boolean().optional(),
  demo_code: z.string().optional(),
  demo_token: z.string().optional(),
  demo_url: z.string().url().optional(),
});
export type AccountDeleteRequestResponse = z.infer<
  typeof accountDeleteRequestResponseSchema
>;

export const accountDeleteConfirmRequestSchema = z.object({
  challenge_id: z.string().uuid(),
  code: z.string().min(1).max(128),
  reason: z.enum(accountDeleteReasons).optional(),
});
export type AccountDeleteConfirmRequest = z.infer<
  typeof accountDeleteConfirmRequestSchema
>;

export const accountDeleteConfirmResponseSchema = z.object({
  status: z.literal("deletion_scheduled"),
  purge_date: z.string().datetime(),
  user_id: z.string().uuid(),
});
export type AccountDeleteConfirmResponse = z.infer<
  typeof accountDeleteConfirmResponseSchema
>;

export const accountUndeleteRequestRequestSchema = z.object({}).strict();
export type AccountUndeleteRequestRequest = z.infer<
  typeof accountUndeleteRequestRequestSchema
>;

export const accountUndeleteRequestResponseSchema =
  accountDeleteRequestResponseSchema;
export type AccountUndeleteRequestResponse = z.infer<
  typeof accountUndeleteRequestResponseSchema
>;

export const accountUndeleteConfirmRequestSchema = z.object({
  challenge_id: z.string().uuid(),
  code: z.string().min(1).max(128),
});
export type AccountUndeleteConfirmRequest = z.infer<
  typeof accountUndeleteConfirmRequestSchema
>;

export const accountUndeleteConfirmResponseSchema = z.object({
  status: z.literal("restored"),
  user_id: z.string().uuid(),
});
export type AccountUndeleteConfirmResponse = z.infer<
  typeof accountUndeleteConfirmResponseSchema
>;

/**
 * @deprecated Use the three-step flow (request/confirm) from M8 onwards.
 * Retained temporarily for backwards compatibility in tests that reference the
 * legacy single-step `POST /v1/account/delete` payload.
 */
export const accountDeleteRequestSchema = z.object({
  confirmation: z.literal("DELETE_MY_ACCOUNT"),
  reason: z.enum(accountDeleteReasons).optional(),
});

/**
 * @deprecated Alias retained for backwards compatibility with consumers still
 * referencing the legacy single-step response shape.
 */
export const accountDeleteResponseSchema = accountDeleteConfirmResponseSchema;

export const authErrorResponseSchema = z.object({
  message: z.string().min(1),
});

export const jwtClaimsSchema = z.object({
  sub: z.string().uuid(),
  level: userLevelSchema,
  role: z.enum(["user", "anchor"]),
  community_ids: z.array(z.string().uuid()),
  anchor_community_id: z.string().uuid().optional(),
  mfa_verified_at: z.string().datetime().optional(),
  iat: z.number().optional(),
  exp: z.number().optional(),
});
