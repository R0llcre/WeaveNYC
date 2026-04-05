import { z } from "zod";

export const serviceStatusSchema = z.enum(["ok", "degraded", "unavailable"]);

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.string().min(1),
  timestamp: z.string().datetime()
});

export const readinessDependencySchema = z.object({
  name: z.enum(["postgres", "redis"]),
  status: serviceStatusSchema,
  latency_ms: z.number().nonnegative().optional(),
  detail: z.string().min(1).optional()
});

export const readinessResponseSchema = z.object({
  status: serviceStatusSchema,
  service: z.string().min(1),
  timestamp: z.string().datetime(),
  checks: z.array(readinessDependencySchema)
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ReadinessDependency = z.infer<typeof readinessDependencySchema>;
export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;
