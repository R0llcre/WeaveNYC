import { createHmac, timingSafeEqual } from "node:crypto";

import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";

import { createPostsRepository } from "./repository.js";
import { createPostsService } from "./service.js";
import type { PostsConfig } from "./config.js";
import { loadPostsConfig } from "./config.js";
import type {
  PostsService,
  PostActor,
  ResolveCommunityAccessInput,
} from "./types.js";
import { PostsServiceError as PostsDomainError } from "./types.js";

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

declare module "fastify" {
  interface FastifyRequest {
    internalClaims?: InternalServiceClaims;
  }
}

export interface PostsApp extends FastifyInstance {
  config: PostsConfig;
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

function verifyInternalToken(token: string, expectedAudience: string, config: PostsConfig) {
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

function mapPostsError(error: unknown) {
  if (error instanceof PostsDomainError) {
    const statusCode =
      error.code === "not_found"
        ? 404
        : error.code === "forbidden" ||
            error.code === "membership_required" ||
            error.code === "verified_required"
          ? 403
          : error.code === "invalid_state"
            ? 409
            : 400;
    return {
      statusCode,
      message: error.message,
    };
  }

  return null;
}

export async function buildPostsApp(options: { config?: PostsConfig; logger?: boolean } = {}): Promise<PostsApp> {
  const config = options.config ?? loadPostsConfig();
  const app = Fastify({
    logger: options.logger ?? false,
  }) as unknown as PostsApp;
  const repository = createPostsRepository(config.databaseUrl);
  const service = createPostsService(repository);
  const startedAt = new Date().toISOString();

  app.decorate("config", config);
  app.decorateRequest("internalClaims", undefined);

  app.setErrorHandler((error, _request, reply) => {
    const mapped = mapPostsError(error);
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
      await service.ping();
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

    internal.post<{ Body: ResolveCommunityAccessInput }>("/internal/v1/posts/resolve-community-access", async (request) =>
      service.resolveCommunityAccess({
        userId: request.internalClaims?.actor?.sub ?? request.internalClaims?.request_id ?? "",
        inviteCode: request.body.inviteCode,
        qrToken: request.body.qrToken,
      }),
    );

    internal.post<{ Body: { communityId: string } }>("/internal/v1/posts/join-community", async (request) =>
      service.joinCommunity({
        userId: request.internalClaims?.actor?.sub ?? request.internalClaims?.request_id ?? "",
        communityId: request.body.communityId,
      }),
    );

    internal.post<{ Body: Parameters<PostsService["createPost"]>[0] }>("/internal/v1/posts/create-post", async (request) =>
      service.createPost({
        actor: toPostActor(request.internalClaims?.actor),
        request: request.body.request,
      }),
    );

    internal.post<{ Body: Omit<Parameters<PostsService["listPosts"]>[0], "actor"> }>("/internal/v1/posts/list-posts", async (request) =>
      service.listPosts({
        actor: toPostActor(request.internalClaims?.actor),
        scope: request.body.scope,
        communityId: request.body.communityId,
        postType: request.body.postType,
        category: request.body.category,
        status: request.body.status,
        cursor: request.body.cursor ?? null,
        limit: request.body.limit,
      }),
    );

    internal.post<{ Body: { postId: string } }>("/internal/v1/posts/get-post-detail", async (request) =>
      service.getPostDetail(toPostActor(request.internalClaims?.actor), request.body.postId),
    );

    internal.post<{ Body: { postId: string; request: Parameters<PostsService["updatePost"]>[0]["request"] } }>(
      "/internal/v1/posts/update-post",
      async (request) =>
        service.updatePost({
          actor: toPostActor(request.internalClaims?.actor),
          postId: request.body.postId,
          request: request.body.request,
        }),
    );

    internal.post<{ Body: { postId: string } }>("/internal/v1/posts/close-post", async (request) =>
      service.closePost(toPostActor(request.internalClaims?.actor), request.body.postId),
    );

    internal.post<{ Body: { postId: string } }>("/internal/v1/posts/remove-post", async (request) =>
      service.removePost(toPostActor(request.internalClaims?.actor), request.body.postId),
    );

    internal.post<{ Body: Omit<Parameters<PostsService["listMyPosts"]>[0], "actor"> }>("/internal/v1/posts/list-my-posts", async (request) =>
      service.listMyPosts({
        actor: toPostActor(request.internalClaims?.actor),
        communityId: request.body.communityId,
        status: request.body.status,
        cursor: request.body.cursor ?? null,
        limit: request.body.limit,
      }),
    );

    internal.post<{ Body: Omit<Parameters<PostsService["listReviewQueue"]>[0], "actor"> }>("/internal/v1/posts/list-review-queue", async (request) =>
      service.listReviewQueue({
        actor: toPostActor(request.internalClaims?.actor),
        communityId: request.body.communityId,
        cursor: request.body.cursor ?? null,
        limit: request.body.limit,
      }),
    );

    internal.post<{ Body: Omit<Parameters<PostsService["decideReview"]>[0], "actor"> }>("/internal/v1/posts/decide-review", async (request) =>
      service.decideReview({
        actor: toPostActor(request.internalClaims?.actor),
        postId: request.body.postId,
        decision: request.body.decision,
        notes: request.body.notes,
      }),
    );

    internal.post<{ Body: { communityId: string } }>("/internal/v1/posts/admin-dashboard", async (request) =>
      service.getAdminDashboard({
        actor: toPostActor(request.internalClaims?.actor),
        communityId: request.body.communityId,
      }),
    );

    internal.post<{ Body: { communityId: string } }>("/internal/v1/posts/get-community-rules", async (request) =>
      service.getCommunityRules({
        actor: toPostActor(request.internalClaims?.actor),
        communityId: request.body.communityId,
      }),
    );

    internal.post<{ Body: Omit<Parameters<PostsService["updateCommunityRules"]>[0], "actor"> }>("/internal/v1/posts/update-community-rules", async (request) =>
      service.updateCommunityRules({
        actor: toPostActor(request.internalClaims?.actor),
        communityId: request.body.communityId,
        rules: request.body.rules,
      }),
    );

    internal.post<{ Body: { communityId: string; includeDeleted?: boolean } }>("/internal/v1/posts/list-announcements", async (request) =>
      service.listAnnouncements({
        actor: request.internalClaims?.actor ? toPostActor(request.internalClaims.actor) : null,
        communityId: request.body.communityId,
        includeDeleted: request.body.includeDeleted,
      }),
    );

    internal.post<{ Body: Omit<Parameters<PostsService["createAnnouncement"]>[0], "actor"> }>("/internal/v1/posts/create-announcement", async (request) =>
      service.createAnnouncement({
        actor: toPostActor(request.internalClaims?.actor),
        communityId: request.body.communityId,
        request: request.body.request,
      }),
    );

    internal.post<{ Body: Omit<Parameters<PostsService["updateAnnouncement"]>[0], "actor"> }>("/internal/v1/posts/update-announcement", async (request) =>
      service.updateAnnouncement({
        actor: toPostActor(request.internalClaims?.actor),
        communityId: request.body.communityId,
        announcementId: request.body.announcementId,
        request: request.body.request,
      }),
    );

    internal.post<{ Body: Omit<Parameters<PostsService["deleteAnnouncement"]>[0], "actor"> }>("/internal/v1/posts/delete-announcement", async (request) =>
      service.deleteAnnouncement({
        actor: toPostActor(request.internalClaims?.actor),
        communityId: request.body.communityId,
        announcementId: request.body.announcementId,
      }),
    );
  });

  return app;
}
