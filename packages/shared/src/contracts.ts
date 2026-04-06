import { z } from "zod";

export const healthcheckResponseSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  service: z.string().min(1),
  timestamp: z.string().datetime(),
  checks: z
    .object({
      postgres: z.boolean().optional(),
      redis: z.boolean().optional(),
    })
    .optional(),
});

export type HealthcheckResponse = z.infer<typeof healthcheckResponseSchema>;

export {
  anonymousAuthRequestSchema,
  anonymousAuthResponseSchema,
  magicLinkStartRequestSchema,
  magicLinkStartResponseSchema,
  magicLinkVerifyRequestSchema,
  magicLinkVerifyResponseSchema,
  meResponseSchema,
  otpStartRequestSchema,
  otpStartResponseSchema,
  otpVerifyRequestSchema,
  otpVerifyResponseSchema,
  refreshSessionRequestSchema,
  refreshSessionResponseSchema,
  sessionUserSchema,
} from "./validators/auth";
export {
  resourceDetailQuerySchema,
  resourceDetailSchema,
  resourceListResponseSchema,
  resourceSearchRequestSchema,
  resourceSummarySchema,
} from "./validators/resources";
