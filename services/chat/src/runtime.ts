import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import type { ChatActor, ChatService } from "./types.js";

type RuntimeCheckStatus = "ok" | "degraded" | "unavailable";

type RuntimeCheck = {
  name: string;
  status: RuntimeCheckStatus;
  detail?: string;
  latency_ms?: number;
};

type RuntimeCheckFactory = () => Promise<RuntimeCheck[]>;

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

export type ChatRuntimeOptions = {
  service: ChatService;
  host?: string;
  port?: number;
  serviceVersion?: string;
  readinessCheck: RuntimeCheckFactory;
  onClose?: () => Promise<void>;
};

export type ChatRuntime = {
  listen(): Promise<void>;
  close(): Promise<void>;
  baseUrl(): string;
};

const INTERNAL_AUDIENCE = "chat-service";
const DEFAULT_INTERNAL_ISSUER = "weavenyc-api-gateway:internal";
const DEV_INTERNAL_SECRET = "weavenyc-dev-internal-service-jwt-secret";

function getServiceVersion() {
  return process.env.npm_package_version ?? "0.1.0";
}

function getInternalJwtConfig() {
  const env = process.env.NODE_ENV ?? "development";
  const secret = process.env.INTERNAL_SERVICE_JWT_SECRET?.trim() ??
    (env === "development" || env === "test" ? DEV_INTERNAL_SECRET : "");
  const issuer = process.env.INTERNAL_SERVICE_JWT_ISSUER?.trim() ?? DEFAULT_INTERNAL_ISSUER;

  if (!secret) {
    throw new Error("Missing required environment variable: INTERNAL_SERVICE_JWT_SECRET");
  }

  if (env === "production" && secret === DEV_INTERNAL_SECRET) {
    throw new Error("INTERNAL_SERVICE_JWT_SECRET must not use the checked-in development/test sample in production");
  }

  return { secret, issuer };
}

function sendJson(reply: ServerResponse, statusCode: number, body: unknown) {
  reply.statusCode = statusCode;
  reply.setHeader("content-type", "application/json; charset=utf-8");
  reply.end(JSON.stringify(body));
}

function sendText(reply: ServerResponse, statusCode: number, body: string) {
  reply.statusCode = statusCode;
  reply.setHeader("content-type", "text/plain; charset=utf-8");
  reply.end(body);
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

function summarizeChecks(checks: RuntimeCheck[]) {
  const ready = checks.every((check) => check.status === "ok");
  const status: RuntimeCheckStatus = ready
    ? "ok"
    : checks.some((check) => check.status === "unavailable")
      ? "unavailable"
      : "degraded";
  return { status, ready };
}

function base64UrlToUtf8(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function readBearerToken(request: IncomingMessage) {
  const authorization = request.headers.authorization ?? "";
  const [scheme, token] = authorization.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }
  return token.trim();
}

function verifyInternalToken(token: string, expectedAudience: string) {
  const { secret, issuer } = getInternalJwtConfig();
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid service token");
  }

  const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];
  const header = JSON.parse(base64UrlToUtf8(headerPart)) as { alg?: string };
  if (header.alg !== "HS256") {
    throw new Error("Invalid service token");
  }

  const expectedSignature = createHmac("sha256", secret)
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
    payload.iss !== issuer
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

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    throw new Error("Request body is required");
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
  } catch {
    throw new Error("Request body must be valid JSON");
  }
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

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Internal server error";
}

export function createChatRuntime(options: ChatRuntimeOptions): ChatRuntime {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 4103;
  const version = options.serviceVersion ?? getServiceVersion();
  const startedAt = new Date().toISOString();
  let server: ReturnType<typeof createServer> | null = null;
  let currentBaseUrl = "";
  let closing = false;

  async function handleInternalRequest(request: IncomingMessage, reply: ServerResponse) {
    const token = readBearerToken(request);
    if (!token) {
      sendJson(reply, 401, { message: "Missing internal service token" });
      return;
    }

    let claims: InternalServiceClaims;
    try {
      claims = verifyInternalToken(token, INTERNAL_AUDIENCE);
    } catch (error) {
      sendJson(reply, 403, { message: errorMessage(error) });
      return;
    }

    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `${host}:${port}`}`);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";

    if (pathname === "/internal/v1/chat/list-conversations" && request.method === "POST") {
      const body = await readJsonBody<{ cursor?: string | null; limit?: number }>(request);
      const result = await options.service.listConversations({
        actor: toChatActor(claims.actor),
        cursor: body.cursor ?? null,
        limit: body.limit,
      });
      sendJson(reply, 200, result);
      return;
    }

    if (pathname === "/internal/v1/chat/list-conversation-ids-for-pair" && request.method === "POST") {
      const body = await readJsonBody<{ other_user_id: string }>(request);
      const result = await options.service.listConversationIdsForPair({
        actor: toChatActor(claims.actor),
        otherUserId: body.other_user_id,
      });
      sendJson(reply, 200, result);
      return;
    }

    if (pathname === "/internal/v1/chat/get-conversation" && request.method === "POST") {
      const body = await readJsonBody<{ conversation_id: string }>(request);
      const result = await options.service.getConversation({
        actor: toChatActor(claims.actor),
        conversationId: body.conversation_id,
      });
      sendJson(reply, 200, result);
      return;
    }

    if (pathname === "/internal/v1/chat/list-messages" && request.method === "POST") {
      const body = await readJsonBody<{ conversation_id: string; cursor?: string | null; limit?: number }>(request);
      const result = await options.service.listMessages({
        actor: toChatActor(claims.actor),
        conversationId: body.conversation_id,
        cursor: body.cursor ?? null,
        limit: body.limit,
      });
      sendJson(reply, 200, result);
      return;
    }

    if (pathname === "/internal/v1/chat/send-message" && request.method === "POST") {
      const body = await readJsonBody<{ conversation_id: string; body: string }>(request);
      const result = await options.service.sendMessage({
        actor: toChatActor(claims.actor),
        conversationId: body.conversation_id,
        body: body.body,
      });
      sendJson(reply, 200, result);
      return;
    }

    if (pathname === "/internal/v1/chat/close-conversation" && request.method === "POST") {
      const body = await readJsonBody<{ conversation_id: string }>(request);
      const result = await options.service.closeConversation({
        actor: toChatActor(claims.actor),
        conversationId: body.conversation_id,
      });
      sendJson(reply, 200, result);
      return;
    }

    if (pathname === "/internal/v1/chat/block-user" && request.method === "POST") {
      const body = await readJsonBody<{ conversation_id: string; blocked_user_id: string }>(request);
      const result = await options.service.blockUser({
        actor: toChatActor(claims.actor),
        conversationId: body.conversation_id,
        blockedUserId: body.blocked_user_id,
      });
      sendJson(reply, 200, result);
      return;
    }

    if (pathname === "/internal/v1/chat/submit-report" && request.method === "POST") {
      const body = await readJsonBody<{
        conversation_id?: string;
        target_type: "post" | "user" | "message";
        target_id: string;
        reason: "harassment" | "scam" | "misinformation" | "unsafe_behavior" | "other";
        detail_text?: string | null;
      }>(request);
      const result = await options.service.submitReport({
        actor: toChatActor(claims.actor),
        conversationId: body.conversation_id,
        targetType: body.target_type,
        targetId: body.target_id,
        reason: body.reason,
        detailText: body.detail_text ?? null,
      });
      sendJson(reply, 200, result);
      return;
    }

    if (pathname === "/internal/v1/chat/list-report-queue" && request.method === "POST") {
      const body = await readJsonBody<{ community_id: string; status?: "new" | "resolved" | "dismissed"; cursor?: string | null; limit?: number }>(request);
      const result = await options.service.listReportQueue({
        actor: toChatActor(claims.actor),
        communityId: body.community_id,
        status: body.status,
        cursor: body.cursor ?? null,
        limit: body.limit,
      });
      sendJson(reply, 200, result);
      return;
    }

    if (pathname === "/internal/v1/chat/decide-report" && request.method === "POST") {
      const body = await readJsonBody<{
        community_id: string;
        report_id: string;
        decision: "dismiss" | "warn" | "remove_post" | "suspend_user";
        notes?: string;
      }>(request);
      const result = await options.service.decideReport({
        actor: toChatActor(claims.actor),
        communityId: body.community_id,
        reportId: body.report_id,
        decision: body.decision,
        notes: body.notes,
      });
      sendJson(reply, 200, result);
      return;
    }

    sendJson(reply, 404, { message: "Not found" });
  }

  async function handleRequest(request: IncomingMessage, reply: ServerResponse) {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `${host}:${port}`}`);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";

    if (pathname.startsWith("/internal/v1/")) {
      await handleInternalRequest(request, reply);
      return;
    }

    if (request.method !== "GET") {
      sendJson(reply, 404, { message: "Not found" });
      return;
    }

    if (pathname === "/healthz") {
      sendJson(reply, 200, {
        status: "ok",
        service: "chat-service",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (pathname === "/readyz") {
      const checks = await options.readinessCheck();
      const summary = summarizeChecks(checks);
      sendJson(reply, summary.ready ? 200 : 503, {
        status: summary.status,
        service: "chat-service",
        timestamp: new Date().toISOString(),
        checks,
      });
      return;
    }

    if (pathname === "/versionz") {
      sendJson(reply, 200, {
        status: "ok",
        service: "chat-service",
        version,
        started_at: startedAt,
        node_version: process.version,
        pid: process.pid,
      });
      return;
    }

    if (pathname === "/metrics") {
      sendText(
        reply,
        200,
        buildMetricsText({
          service: "chat-service",
          version,
          uptimeSeconds: process.uptime(),
        }),
      );
      return;
    }

    sendJson(reply, 404, { message: "Not found" });
  }

  return {
    async listen() {
      if (server) {
        return;
      }

      server = createServer((request, reply) => {
        void handleRequest(request, reply).catch((error) => {
          sendJson(reply, 500, { message: errorMessage(error) });
        });
      });

      await new Promise<void>((resolve, reject) => {
        server!.once("error", reject);
        server!.listen(port, host, () => {
          const address = server!.address();
          if (typeof address === "string" || !address) {
            currentBaseUrl = `http://${host}:${port}`;
          } else {
            const resolvedHost = address.address === "::" ? "127.0.0.1" : address.address;
            currentBaseUrl = `http://${resolvedHost}:${address.port}`;
          }
          resolve();
        });
      });
    },

    async close() {
      if (!server || closing) {
        return;
      }

      closing = true;
      try {
        await options.onClose?.();
      } finally {
        await new Promise<void>((resolve, reject) => {
          server!.close((error) => {
            if (error) {
              reject(error);
              return;
            }
            resolve();
          });
        });
        server = null;
        currentBaseUrl = "";
        closing = false;
      }
    },

    baseUrl() {
      if (!currentBaseUrl) {
        throw new Error("Runtime has not started yet");
      }

      return currentBaseUrl;
    },
  };
}
