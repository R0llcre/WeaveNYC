import { ttfvSampleRequestSchema } from "@weavenyc/shared";
import type { FastifyPluginAsync } from "fastify";

import { errorResponseSchema } from "../contracts.js";

const ttfvRequestJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["milliseconds_since_bootstrap"],
  properties: {
    milliseconds_since_bootstrap: {
      type: "integer",
      minimum: 0,
      maximum: 5 * 60 * 1000,
    },
  },
} as const;

const ttfvResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["accepted"],
  properties: {
    accepted: { type: "boolean" },
  },
} as const;

// Per-session rate limiter: 1/min per (actor + ip) key.
const TTFV_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const ttfvLastSeenAt = new Map<string, number>();

function sessionKey(actorUserId: string | null, ip: string): string {
  return `${actorUserId ?? "anon"}::${ip}`;
}

function ttfvRateLimitAllow(key: string, now: number): boolean {
  const last = ttfvLastSeenAt.get(key);
  if (last && now - last < TTFV_RATE_LIMIT_WINDOW_MS) {
    return false;
  }
  ttfvLastSeenAt.set(key, now);
  // Sweep stale entries periodically to avoid unbounded growth.
  if (ttfvLastSeenAt.size > 1000) {
    for (const [storedKey, storedAt] of ttfvLastSeenAt) {
      if (now - storedAt > TTFV_RATE_LIMIT_WINDOW_MS * 5) {
        ttfvLastSeenAt.delete(storedKey);
      }
    }
  }
  return true;
}

export const analyticsRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/v1/analytics/ttfv",
    {
      schema: {
        summary: "Record a Time To First Value sample for the current session",
        tags: ["analytics"],
        body: ttfvRequestJsonSchema,
        response: {
          200: ttfvResponseJsonSchema,
          400: errorResponseSchema,
          429: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const body = ttfvSampleRequestSchema.safeParse(request.body);
      if (!body.success) {
        reply.code(400);
        return { message: "Invalid ttfv payload" };
      }

      let actorUserId: string | null = null;
      const authorization = request.headers.authorization;
      if (authorization) {
        try {
          await request.jwtVerify();
          actorUserId = typeof request.user.sub === "string" ? request.user.sub : null;
        } catch {
          actorUserId = null;
        }
      }

      const ip = request.ip ?? "unknown";
      const key = sessionKey(actorUserId, ip);
      const allowed = ttfvRateLimitAllow(key, Date.now());
      if (!allowed) {
        reply.code(429);
        return { message: "ttfv rate limit exceeded" };
      }

      await app.analyticsRecorder.recordEvent({
        event_type: "ttfv_sample",
        actor_user_id: actorUserId ?? undefined,
        payload: {
          milliseconds_since_bootstrap: body.data.milliseconds_since_bootstrap,
        },
      });

      return { accepted: true };
    },
  );
};

export function __resetTtfvRateLimitForTesting(): void {
  ttfvLastSeenAt.clear();
}
