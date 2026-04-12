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

export const meResponseSchema = z.object({
  user: sessionUserSchema,
});

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
