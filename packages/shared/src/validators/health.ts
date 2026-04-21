import { z } from "zod";

export const serviceStatusSchema = z.enum(["ok", "degraded", "unavailable"]);

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.string().min(1),
  timestamp: z.string().datetime()
});

export const readinessDependencySchema = z.object({
  // F4-D observability hardening: /readyz now probes the chat realtime
  // hub, P2P sync runtime, and a JWT sign/verify round-trip in
  // addition to the legacy postgres + redis probes.
  name: z.enum([
    "postgres",
    "redis",
    "chat_realtime",
    "p2p_sync",
    "jwt_sign_verify",
  ]),
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
