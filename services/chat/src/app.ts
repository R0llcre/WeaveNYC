import { createHmac, timingSafeEqual } from "node:crypto";

import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { Pool } from "pg";

import type { ChatConfig } from "./config.js";
import { loadChatConfig } from "./config.js";
import { DefaultChatService } from "./service.js";
import type {
  AdminReportQueueInput,
  BlockUserInput,
  ChatActor,
  CloseConversationInput,
  GetConversationInput,
  ListConversationInput,
  ListMessagesInput,
  ReportDecisionInput,
  SubmitReportInput,
} from "./types.js";
import { ChatServiceError as ChatDomainError } from "./types.js";
import { PgChatRepository } from "./pg-repository.js";

type InternalServiceActor = {
  sub: string;
  level: ChatActor["level"];
  role?: "user" | "anchor";
  community_ids?: string[];
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

export interface ChatApp extends FastifyInstance {
  config: ChatConfig;
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

function verifyInternalToken(token: string, expectedAudience: string, config: ChatConfig) {
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

function toChatActor(actor: InternalServiceActor | undefined): ChatActor {
  if (!actor) {
    throw new Error("Internal actor is required");
  }

  return {
    userId: actor.sub,
    level: actor.level,
    role: actor.role ?? "user",
    communityIds: actor.community_ids ?? [],
    anchorCommunityId: actor.anchor_community_id ?? null,
    mfaVerifiedAt: actor.mfa_verified_at,
  };
}

function mapChatError(error: unknown) {
  if (error instanceof ChatDomainError) {
    const statusCode =
      error.code === "not_found"
        ? 404
        : error.code === "forbidden"
          ? 403
          : error.code === "rate_limited"
            ? 429
            : error.code === "conversation_closed" || error.code === "conversation_blocked"
              ? 409
              : 400;
    return {
      statusCode,
      message: error.message,
    };
  }

  return null;
}

export async function buildChatApp(options: { config?: ChatConfig; logger?: boolean } = {}): Promise<ChatApp> {
  const config = options.config ?? loadChatConfig();
  const app = Fastify({
    logger: options.logger ?? false,
  }) as unknown as ChatApp;
  const pool = new Pool({ connectionString: config.databaseUrl });
  const repository = new PgChatRepository(pool);
  const service = new DefaultChatService(repository);
  const startedAt = new Date().toISOString();

  app.decorate("config", config);
  app.decorateRequest("internalClaims", undefined);

  app.setErrorHandler((error, _request, reply) => {
    const mapped = mapChatError(error);
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
      await repository.getConversation("00000000-0000-0000-0000-000000000000");
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

    internal.post<{ Body: ListConversationInput }>("/internal/v1/chat/list-conversations", async (request) =>
      service.listConversations({
        actor: toChatActor(request.internalClaims?.actor),
        cursor: request.body.cursor ?? null,
        limit: request.body.limit,
      }),
    );

    internal.post<{ Body: GetConversationInput }>("/internal/v1/chat/get-conversation", async (request) =>
      service.getConversation({
        actor: toChatActor(request.internalClaims?.actor),
        conversationId: request.body.conversationId,
      }),
    );

    internal.post<{ Body: ListMessagesInput }>("/internal/v1/chat/list-messages", async (request) =>
      service.listMessages({
        actor: toChatActor(request.internalClaims?.actor),
        conversationId: request.body.conversationId,
        cursor: request.body.cursor ?? null,
        limit: request.body.limit,
      }),
    );

    internal.post<{
      Body: { conversationId?: string; conversation_id?: string; body: string; clientMessageId?: string; client_message_id?: string };
    }>("/internal/v1/chat/send-message", async (request) => {
      const conversationId = request.body.conversationId ?? request.body.conversation_id;
      if (!conversationId) {
        throw new ChatDomainError("conversationId is required", "invalid_input");
      }
      return service.sendMessage({
        actor: toChatActor(request.internalClaims?.actor),
        conversationId,
        body: request.body.body,
        clientMessageId: request.body.clientMessageId ?? request.body.client_message_id,
      });
    });

    internal.post<{ Body: CloseConversationInput }>("/internal/v1/chat/close-conversation", async (request) =>
      service.closeConversation({
        actor: toChatActor(request.internalClaims?.actor),
        conversationId: request.body.conversationId,
      }),
    );

    internal.post<{ Body: BlockUserInput }>("/internal/v1/chat/block-user", async (request) =>
      service.blockUser({
        actor: toChatActor(request.internalClaims?.actor),
        conversationId: request.body.conversationId,
        blockedUserId: request.body.blockedUserId,
      }),
    );

    internal.post<{ Body: SubmitReportInput }>("/internal/v1/chat/submit-report", async (request) =>
      service.submitReport({
        actor: toChatActor(request.internalClaims?.actor),
        conversationId: request.body.conversationId,
        targetType: request.body.targetType,
        targetId: request.body.targetId,
        reason: request.body.reason,
        detailText: request.body.detailText ?? null,
      }),
    );

    internal.post<{ Body: AdminReportQueueInput }>("/internal/v1/chat/list-report-queue", async (request) =>
      service.listReportQueue({
        actor: toChatActor(request.internalClaims?.actor),
        communityId: request.body.communityId,
        status: request.body.status,
        cursor: request.body.cursor ?? null,
        limit: request.body.limit,
      }),
    );

    internal.post<{ Body: ReportDecisionInput }>("/internal/v1/chat/decide-report", async (request) =>
      service.decideReport({
        actor: toChatActor(request.internalClaims?.actor),
        communityId: request.body.communityId,
        reportId: request.body.reportId,
        decision: request.body.decision,
        notes: request.body.notes,
      }),
    );
  });

  return app;
}
