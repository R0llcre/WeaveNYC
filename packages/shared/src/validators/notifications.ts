import { z } from "zod";

export const notificationSendScopeSchema = z.literal("notifications_send");

export const notificationInternalJwtClaimsSchema = z.object({
  sub: z.string().min(1),
  scope: notificationSendScopeSchema,
  service: z.string().min(1),
  iat: z.number().optional(),
  exp: z.number().optional(),
});

export const notificationOtpSendRequestSchema = z.object({
  phone: z.string().min(1),
  code: z.string().length(6),
  challenge_id: z.string().uuid(),
});

export const notificationOtpSendResponseSchema = z.object({
  provider: z.enum(["stub", "twilio"]),
  fallback: z.boolean(),
  demo_code: z.string().length(6).optional(),
});

export const notificationMagicLinkSendRequestSchema = z.object({
  email: z.string().email(),
  token: z.string().min(1),
  challenge_id: z.string().uuid(),
});

export const notificationMagicLinkSendResponseSchema = z.object({
  provider: z.enum(["stub", "resend"]),
  fallback: z.boolean(),
  demo_token: z.string().min(1).optional(),
  demo_url: z.string().url().optional(),
});

export const notificationSmsSendRequestSchema = notificationOtpSendRequestSchema;
export const notificationSmsSendResponseSchema = notificationOtpSendResponseSchema;
export const notificationEmailSendRequestSchema = notificationMagicLinkSendRequestSchema;
export const notificationEmailSendResponseSchema = notificationMagicLinkSendResponseSchema;
