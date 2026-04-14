import { createHmac, timingSafeEqual } from "node:crypto";

import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { Pool } from "pg";

import { ResourceQueryRepository } from "@weavenyc/resource-directory";

import type { MatchConfig } from "./config.js";
import { loadMatchConfig } from "./config.js";
import { PgMatchRepository } from "./pg-repository.js";
import { createMatchService } from "./service.js";
import type {
  MatchActor,
  MatchContactRequest,
} from "./types.js";
import { MatchServiceError as MatchDomainError } from "./types.js";

type InternalServiceActor = {
  sub: string;
  level: MatchActor["level"];
  role?: "user" | "anchor";
  community_ids: string[];
  anchor_community_id?: string | null;
  mfa_verified_at?: string;
  status?: "active" | "suspended" | "deleted";
};

type InternalServiceClaims = {
  iss: string;
  aud: string;
  scope: "internal_service";
  request_id: string;
  actor?: InternalServiceActor;
  iat?: number;
  exp?: number;
};

declare module "fastify" {
  interface FastifyRequest {
    internalClaims?: InternalServiceClaims;
  }
}

export interface MatchApp extends FastifyInstance {
  config: MatchConfig;
}

function buildMetricsText(input: { service: string; version: string; uptimeSeconds: number }) {
  return [
    "# HELP weavenyc_runtime_up Runtime process availability.",
    "# TYPE weavenyc_runtime_up gauge",
    `weavenyc_runtime_up{service="${input.service}",version="${input.version}"} 1`,
    "# HELP weavenyc_runtime_uptime_seconds Runtime uptime in seconds.",
    "# TYPE weavenyc_runtime_uptime_seconds gauge",
    `weavenyc_runtime_uptime_seconds{service="${input.service}"} ${input.uptimeSeconds.toFixed(3)}`,
    "# HELP weavenyc_runtime_memory_rss_bytes Resident set size in bytes.",
    "# TYPE weavenyc_runtime_memory_rss_bytes gauge",
    `weavenyc_runtime_memory_rss_bytes{service="${input.service}"} ${process.memoryUsage().rss}`,
    "",
  ].join("\n");
}

function base64UrlToUtf8(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function readBearerToken(request: FastifyRequest) {
  const authorization = request.headers.authorization ?? "";
  const [scheme, token] = authorization.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token.trim();
}

function verifyInternalToken(token: string, expectedAudience: string, config: MatchConfig) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid service token");
  }

  const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];
  const header = JSON.parse(base64UrlToUtf8(headerPart)) as { alg?: string };
  if (header.alg !== "HS256") {
    throw new Error("Invalid service token");
  }

  const expectedSignature = createHmac("sha256", config.internalJwt.secret)
    .update(`${headerPart}.${payloadPart}`)
    .digest("base64url");
  const provided = Buffer.from(signaturePart);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new Error("Invalid service token");
  }

  const payload = JSON.parse(base64UrlToUtf8(payloadPart)) as InternalServiceClaims;
  if (
    payload.scope !== "internal_service" ||
    payload.aud !== expectedAudience ||
    payload.iss !== config.internalJwt.issuer
  ) {
    throw new Error("Invalid service token");
  }

  if (typeof payload.exp === "number" && Date.now() / 1000 >= payload.exp) {
    throw new Error("Service token expired");
  }

  if (payload.actor?.status && payload.actor.status !== "active") {
    throw new Error("User account is not active");
  }

  return payload;
}

function toMatchActor(actor: InternalServiceActor | undefined): MatchActor {
  if (!actor) {
    throw new Error("Internal actor is required");
  }

  return {
    userId: actor.sub,
    level: actor.level,
    alias: undefined,
    communityIds: actor.community_ids,
  };
}

function mapMatchError(error: unknown) {
  if (error instanceof MatchDomainError) {
    const statusCode =
      error.code === "not_found"
        ? 404
        : error.code === "forbidden" || error.code === "verified_required"
          ? 403
          : error.code === "invalid_state"
            ? 409
            : error.code === "resource_fallback_unavailable"
              ? 503
              : 400;
    return {
      statusCode,
      message: error.message,
    };
  }

  return null;
}

export async function buildMatchApp(options: { config?: MatchConfig; logger?: boolean } = {}): Promise<MatchApp> {
  const config = options.config ?? loadMatchConfig();
  const app = Fastify({
    logger: options.logger ?? false,
  }) as unknown as MatchApp;
  const pool = new Pool({ connectionString: config.databaseUrl });
  const resourceQuery = new ResourceQueryRepository(pool);
  const repository = new PgMatchRepository(pool, async (zip) =>
    (await resourceQuery.searchResources({ zip, limit: 50 }, { lat: null, lng: null })).items,
  );
  const service = createMatchService(repository);
  const startedAt = new Date().toISOString();

  app.decorate("config", config);
  app.decorateRequest("internalClaims", undefined);

  app.setErrorHandler((error, _request, reply) => {
    const mapped = mapMatchError(error);
    if (mapped) {
      reply.code(mapped.statusCode);
      return reply.send({ message: mapped.message });
    }

    reply.code(500);
    return reply.send({ message: error instanceof Error ? error.message : "Internal server error" });
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.code(404);
    return reply.send({ message: "Not found" });
  });

  app.get("/healthz", async () => ({
    status: "ok",
    service: config.runtime.serviceName,
    timestamp: new Date().toISOString(),
  }));

  app.get("/readyz", async (_request, reply) => {
    try {
      await repository.getPost("00000000-0000-0000-0000-000000000000");
      return reply.code(200).send({
        status: "ok",
        service: config.runtime.serviceName,
        timestamp: new Date().toISOString(),
        checks: [
          {
            name: "postgres",
            status: "ok" as const,
          },
        ],
      });
    } catch (error) {
      return reply.code(503).send({
        status: "unavailable",
        service: config.runtime.serviceName,
        timestamp: new Date().toISOString(),
        checks: [
          {
            name: "postgres",
            status: "unavailable" as const,
            detail: error instanceof Error ? error.message : "database unavailable",
          },
        ],
      });
    }
  });

  app.get("/versionz", async () => ({
    status: "ok",
    service: config.runtime.serviceName,
    version: config.runtime.version,
    started_at: startedAt,
    node_version: process.version,
    pid: process.pid,
  }));

  app.get("/metrics", async (_request, reply) => {
    reply.type("text/plain; charset=utf-8");
    return buildMetricsText({
      service: config.runtime.serviceName,
      version: config.runtime.version,
      uptimeSeconds: process.uptime(),
    });
  });

  app.addHook("onClose", async () => {
    await service.close();
  });

  await app.register(async (internal) => {
    internal.addHook("onRequest", async (request, reply) => {
      const token = readBearerToken(request);
      if (!token) {
        reply.code(401);
        return reply.send({ message: "Missing internal service token" });
      }

      try {
        request.internalClaims = verifyInternalToken(token, config.runtime.serviceName, config);
      } catch (error) {
        reply.code(403);
        return reply.send({ message: error instanceof Error ? error.message : "Invalid service token" });
      }
    });

    internal.post<{ Body: { postId: string; refresh?: boolean } }>("/internal/v1/match/get-suggestions", async (request) =>
      service.getSuggestions({
        actor: toMatchActor(request.internalClaims?.actor),
        postId: request.body.postId,
        refresh: request.body.refresh ?? false,
      }),
    );

    internal.post<{ Body: MatchContactRequest }>("/internal/v1/match/create-contact-request", async (request) =>
      service.createContactRequest(toMatchActor(request.internalClaims?.actor), request.body),
    );

    internal.post<{ Body: { cursor?: string | null; limit?: number } }>("/internal/v1/match/list-inbox", async (request) =>
      service.listInbox({
        actor: toMatchActor(request.internalClaims?.actor),
        cursor: request.body.cursor ?? null,
        limit: request.body.limit,
      }),
    );

    internal.post<{ Body: { contactRequestId: string } }>("/internal/v1/match/accept-contact-request", async (request) =>
      service.acceptContactRequest({
        actor: toMatchActor(request.internalClaims?.actor),
        contactRequestId: request.body.contactRequestId,
      }),
    );

    internal.post<{ Body: { contactRequestId: string } }>("/internal/v1/match/reject-contact-request", async (request) =>
      service.rejectContactRequest({
        actor: toMatchActor(request.internalClaims?.actor),
        contactRequestId: request.body.contactRequestId,
      }),
    );

    internal.post<{ Body: { conversationId: string } }>("/internal/v1/match/get-accepted-conversation", async (request) =>
      service.getAcceptedConversation({
        actor: toMatchActor(request.internalClaims?.actor),
        conversationId: request.body.conversationId,
      }),
    );

    internal.post<{ Body: { postId: string } }>("/internal/v1/match/ensure-initial-suggestions", async (request) =>
      service.ensureInitialSuggestions(request.body.postId).then(() => ({ ok: true })),
    );
  });

  return app;
}
