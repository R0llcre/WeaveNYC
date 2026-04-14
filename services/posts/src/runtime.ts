import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import type { PostsService, PostActor } from "./types.js";

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
  level: PostActor["level"];
  role: PostActor["role"];
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

export type PostsRuntimeOptions = {
  service: PostsService;
  host?: string;
  port?: number;
  serviceVersion?: string;
  readinessCheck: RuntimeCheckFactory;
  onClose?: () => Promise<void>;
};

export type PostsRuntime = {
  listen(): Promise<void>;
  close(): Promise<void>;
  baseUrl(): string;
};

const INTERNAL_AUDIENCE = "posts-service";
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

  return {
    secret,
    issuer,
  };
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
  return {
    status,
    ready
  };
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

  const signingInput = `${headerPart}.${payloadPart}`;
  const expectedSignature = createHmac("sha256", secret).update(signingInput).digest("base64url");
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

function toPostActor(actor: InternalServiceActor | undefined): PostActor {
  if (!actor) {
    throw new Error("Internal actor is required");
  }

  return {
    userId: actor.sub,
    level: actor.level,
    role: actor.role,
    communityIds: actor.community_ids,
    anchorCommunityId: actor.anchor_community_id ?? null,
    mfaVerifiedAt: actor.mfa_verified_at,
  };
}

function jsonOrTextMessage(error: unknown) {
  return error instanceof Error ? error.message : "Internal server error";
}

export function createPostsRuntime(options: PostsRuntimeOptions): PostsRuntime {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 4101;
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
      sendJson(reply, 403, { message: jsonOrTextMessage(error) });
      return;
    }

    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `${host}:${port}`}`);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";

    if (pathname === "/internal/v1/posts/resolve-community-access" && request.method === "POST") {
      const body = await readJsonBody<{ invite_code?: string; qr_token?: string }>(request);
      const result = await options.service.resolveCommunityAccess({
        userId: claims.actor?.sub ?? claims.request_id,
        inviteCode: body.invite_code,
        qrToken: body.qr_token,
      });
      sendJson(reply, 200, result);
      return;
    }

    if (pathname === "/internal/v1/posts/join-community" && request.method === "POST") {
      const body = await readJsonBody<{ community_id: string }>(request);
      const result = await options.service.joinCommunity({
        userId: claims.actor?.sub ?? claims.request_id,
        communityId: body.community_id,
      });
      sendJson(reply, 200, result);
      return;
    }

    if (pathname === "/internal/v1/posts/create-post" && request.method === "POST") {
      const body = await readJsonBody<{ request: Parameters<PostsService["createPost"]>[0]["request"] }>(request);
      const result = await options.service.createPost({
        actor: toPostActor(claims.actor),
        request: body.request,
      });
      sendJson(reply, 200, result);
      return;
    }

    if (pathname === "/internal/v1/posts/list-posts" && request.method === "POST") {
      const body = await readJsonBody<Parameters<PostsService["listPosts"]>[0]>(request);
      const result = await options.service.listPosts({
        actor: toPostActor(claims.actor),
        scope: body.scope,
        communityId: body.communityId,
        postType: body.postType,
        category: body.category,
        status: body.status,
        cursor: body.cursor ?? null,
        limit: body.limit,
      });
      sendJson(reply, 200, result);
      return;
    }

    if (pathname === "/internal/v1/posts/get-post-detail" && request.method === "POST") {
      const body = await readJsonBody<{ post_id: string }>(request);
      const result = await options.service.getPostDetail(toPostActor(claims.actor), body.post_id);
      sendJson(reply, 200, result);
      return;
    }

    if (pathname === "/internal/v1/posts/update-post" && request.method === "POST") {
      const body = await readJsonBody<{ post_id: string; request: Parameters<PostsService["updatePost"]>[0]["request"] }>(request);
      const result = await options.service.updatePost({
        actor: toPostActor(claims.actor),
        postId: body.post_id,
        request: body.request,
      });
      sendJson(reply, 200, result);
      return;
    }

    if (pathname === "/internal/v1/posts/close-post" && request.method === "POST") {
      const body = await readJsonBody<{ post_id: string }>(request);
      const result = await options.service.closePost(toPostActor(claims.actor), body.post_id);
      sendJson(reply, 200, result);
      return;
    }

    if (pathname === "/internal/v1/posts/remove-post" && request.method === "POST") {
      const body = await readJsonBody<{ post_id: string }>(request);
      const result = await options.service.removePost(toPostActor(claims.actor), body.post_id);
      sendJson(reply, 200, result);
      return;
    }

    if (pathname === "/internal/v1/posts/list-my-posts" && request.method === "POST") {
      const body = await readJsonBody<Parameters<PostsService["listMyPosts"]>[0]>(request);
      const result = await options.service.listMyPosts({
        actor: toPostActor(claims.actor),
        communityId: body.communityId,
        status: body.status,
        cursor: body.cursor ?? null,
        limit: body.limit,
      });
      sendJson(reply, 200, result);
      return;
    }

    if (pathname === "/internal/v1/posts/list-review-queue" && request.method === "POST") {
      const body = await readJsonBody<Parameters<PostsService["listReviewQueue"]>[0]>(request);
      const result = await options.service.listReviewQueue({
        actor: toPostActor(claims.actor),
        communityId: body.communityId,
        cursor: body.cursor ?? null,
        limit: body.limit,
      });
      sendJson(reply, 200, result);
      return;
    }

    if (pathname === "/internal/v1/posts/decide-review" && request.method === "POST") {
      const body = await readJsonBody<Parameters<PostsService["decideReview"]>[0]>(request);
      const result = await options.service.decideReview({
        actor: toPostActor(claims.actor),
        postId: body.postId,
        decision: body.decision,
        notes: body.notes,
      });
      sendJson(reply, 200, result);
      return;
    }

    if (pathname === "/internal/v1/posts/admin-dashboard" && request.method === "POST") {
      const body = await readJsonBody<Parameters<PostsService["getAdminDashboard"]>[0]>(request);
      const result = await options.service.getAdminDashboard({
        actor: toPostActor(claims.actor),
        communityId: body.communityId,
      });
      sendJson(reply, 200, result);
      return;
    }

    if (pathname === "/internal/v1/posts/get-community-rules" && request.method === "POST") {
      const body = await readJsonBody<Parameters<PostsService["getCommunityRules"]>[0]>(request);
      const result = await options.service.getCommunityRules({
        actor: toPostActor(claims.actor),
        communityId: body.communityId,
      });
      sendJson(reply, 200, result);
      return;
    }

    if (pathname === "/internal/v1/posts/update-community-rules" && request.method === "POST") {
      const body = await readJsonBody<Parameters<PostsService["updateCommunityRules"]>[0]>(request);
      const result = await options.service.updateCommunityRules({
        actor: toPostActor(claims.actor),
        communityId: body.communityId,
        rules: body.rules,
      });
      sendJson(reply, 200, result);
      return;
    }

    if (pathname === "/internal/v1/posts/list-announcements" && request.method === "POST") {
      const body = await readJsonBody<Parameters<PostsService["listAnnouncements"]>[0]>(request);
      const result = await options.service.listAnnouncements({
        actor: body.actor ? toPostActor(claims.actor) : null,
        communityId: body.communityId,
        includeDeleted: body.includeDeleted,
      });
      sendJson(reply, 200, result);
      return;
    }

    if (pathname === "/internal/v1/posts/create-announcement" && request.method === "POST") {
      const body = await readJsonBody<Parameters<PostsService["createAnnouncement"]>[0]>(request);
      const result = await options.service.createAnnouncement({
        actor: toPostActor(claims.actor),
        communityId: body.communityId,
        request: body.request,
      });
      sendJson(reply, 200, result);
      return;
    }

    if (pathname === "/internal/v1/posts/update-announcement" && request.method === "POST") {
      const body = await readJsonBody<Parameters<PostsService["updateAnnouncement"]>[0]>(request);
      const result = await options.service.updateAnnouncement({
        actor: toPostActor(claims.actor),
        communityId: body.communityId,
        announcementId: body.announcementId,
        request: body.request,
      });
      sendJson(reply, 200, result);
      return;
    }

    if (pathname === "/internal/v1/posts/delete-announcement" && request.method === "POST") {
      const body = await readJsonBody<Parameters<PostsService["deleteAnnouncement"]>[0]>(request);
      const result = await options.service.deleteAnnouncement({
        actor: toPostActor(claims.actor),
        communityId: body.communityId,
        announcementId: body.announcementId,
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
        service: "posts-service",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (pathname === "/readyz") {
      const checks = await options.readinessCheck();
      const summary = summarizeChecks(checks);
      sendJson(reply, summary.ready ? 200 : 503, {
        status: summary.status,
        service: "posts-service",
        timestamp: new Date().toISOString(),
        checks,
      });
      return;
    }

    if (pathname === "/versionz") {
      sendJson(reply, 200, {
        status: "ok",
        service: "posts-service",
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
          service: "posts-service",
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
          sendJson(reply, 500, {
            message: error instanceof Error ? error.message : "Internal server error",
          });
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
