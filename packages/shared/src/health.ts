import { z } from "zod";

export const healthResponseSchema = z.object({
  ok: z.boolean(),
  service: z.string(),
  timestamp: z.string().datetime(),
  detail: z.string().optional()
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const readyResponseSchema = healthResponseSchema.extend({
  checks: z.object({
    database: z.boolean(),
    redis: z.boolean()
  })
});
export type ReadyResponse = z.infer<typeof readyResponseSchema>;
