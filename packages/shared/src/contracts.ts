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
  meResponseSchema,
  sessionUserSchema,
} from "./validators/auth";
