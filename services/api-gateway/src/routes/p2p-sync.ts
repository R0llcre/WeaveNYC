import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";

import {
  communityBootstrapParamsSchema,
  communityBootstrapResponseSchema,
  communitySyncDeltaResponseSchema,
  errorResponseSchema,
} from "../contracts.js";
import { isAnchorForCommunity, loadCurrentActor } from "../lib/require-anchor.js";
import { encodeSyncCursor } from "../lib/sync-runtime.js";

/**
 * Close-reason labels we allow on the `ws_auth` rate-limit error counter.
 * The WS frame reason sent to the client is always the generic
 * `"unauthorized"` (see below) — these labels are internal-only and give
 * operators a histogram of *why* handshakes fail without leaking account
 * state to a network observer.
 */
type P2PWsAuthRejectionReason =
  | "missing_token"
  | "invalid_token"
  | "invalid_scope"
  | "missing_community"
  | "community_mismatch"
  | "unknown_user"
  | "inactive_user"
  | "not_member";

/**
 * Single generic reason returned to the WebSocket client. Previously each
 * rejection path told the caller *why* they were refused (e.g. "Inactive
 * user" vs "Unknown user"), which allowed an observer listening on the
 * network to distinguish between "this user id exists" and "this user id
 * does not exist", leaking account state. All paths now close with the
 * same opaque token; precise cause is recorded server-side only.
 */
const WS_AUTH_CLOSE_CODE = 1008;
const WS_AUTH_GENERIC_REASON = "unauthorized";

function logWsRejection(
  request: { log: { warn: (obj: unknown, msg?: string) => void } },
  app: { metrics?: { p2pSyncErrorsTotal?: { inc: (labels: Record<string, string>) => void } } },
  reason: P2PWsAuthRejectionReason,
  context: Record<string, unknown>,
) {
  request.log.warn({ reason, ...context }, "p2p ws rejected");
  app.metrics?.p2pSyncErrorsTotal?.inc({ op: "ws_auth", kind: reason });
}

type CommunityParams = {
  community_id: string;
};

type SyncQuery = {
  since?: string;
  limit?: number;
};

type P2PSocketQuery = {
  token?: string;
  community_id?: string;
};

type P2PWebSocketClaims = {
  sub: string;
  mfa_verified_at?: string;
  scope?: string;
  community_id?: string;
};

function canAccessCommunity(actor: {
  role: string;
  communityIds: string[];
  anchorCommunityId?: string | null;
  mfaVerifiedAt?: string;
}, communityId: string) {
  return actor.communityIds.includes(communityId) || isAnchorForCommunity(actor, communityId);
}

function readForwardedValue(value: string | string[] | undefined) {
  const first =
    typeof value === "string"
      ? value
      : Array.isArray(value)
        ? value[0]
        : null;

  return first?.split(",")[0]?.trim() || null;
}

function resolveWebsocketUrl(
  request: {
    protocol?: string;
    headers: Record<string, string | string[] | undefined>;
  },
  token: string,
) {
  const forwardedProto = readForwardedValue(request.headers["x-forwarded-proto"]);
  const protocol =
    forwardedProto
      ? forwardedProto
      : request.protocol === "https"
        ? "https"
        : "http";
  const host =
    readForwardedValue(request.headers["x-forwarded-host"]) ??
    readForwardedValue(request.headers.host) ??
    "localhost:4000";
  const wsProtocol = protocol === "https" ? "wss" : "ws";
  return `${wsProtocol}://${host}/v1/ws/p2p?token=${encodeURIComponent(token)}`;
}

/**
 * `since` is a base64url-encoded opaque cursor — 512 chars is ~384 bytes of
 * raw payload, more than enough for the v1 schema. Capping here prevents an
 * attacker from posting a multi-MB query string to exhaust parser memory
 * before the route handler even runs.
 */
const localCommunitySyncQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    since: { type: "string", maxLength: 512 },
    limit: { type: "integer", minimum: 1, maximum: 200 },
  },
} as const;

function readBearerToken(headers: Record<string, string | string[] | undefined>) {
  const authorization = headers.authorization;
  if (typeof authorization !== "string") {
    return null;
  }

  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export const p2pSyncRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: CommunityParams }>(
    "/v1/communities/:community_id/bootstrap",
    {
      schema: {
        summary: "Load anchor sync bootstrap metadata for a community",
        tags: ["p2p"],
        security: [{ bearerAuth: [] }],
        params: communityBootstrapParamsSchema,
        response: {
          200: communityBootstrapResponseSchema,
          403: errorResponseSchema,
        },
      },
      preHandler: [app.authenticate],
      config: {
        // Abuse control: 10 bootstrap/min/user is already generous given the
        // PWA only needs ~1 at boot and one per route change; anything higher
        // from a single account is either a broken client loop or a scraper.
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
          keyGenerator: (request) =>
            (request.currentUser?.userId ?? request.user?.sub ?? request.ip) as string,
        },
      },
    },
    async (request, reply) => {
      const actor =
        request.currentUser ??
        (await loadCurrentActor(app, request.user.sub, request.user.mfa_verified_at));
      if (!actor) {
        app.metrics?.p2pBootstrapTotal?.inc({ outcome: "denied" });
        reply.code(404);
        return { message: "User not found" };
      }

      const communityId = request.params.community_id;
      if (!canAccessCommunity(actor, communityId)) {
        app.metrics?.p2pBootstrapTotal?.inc({ outcome: "denied" });
        reply.code(403);
        return { message: "Community membership is required" };
      }

      const bearerToken = readBearerToken(request.headers);
      if (!bearerToken) {
        app.metrics?.p2pBootstrapTotal?.inc({ outcome: "denied" });
        reply.code(401);
        return { message: "Bearer token is required" };
      }

      try {
        const websocketToken = app.jwt.sign(
          {
            sub: actor.userId,
            level: actor.level,
            role: actor.role,
            community_ids: actor.communityIds,
            anchor_community_id: actor.anchorCommunityId ?? undefined,
            mfa_verified_at: actor.mfaVerifiedAt ?? undefined,
            jti: randomUUID(),
            scope: "p2p_ws",
            community_id: communityId,
          },
          {
            algorithm: "RS256",
            iss: app.config.jwt.issuer,
            expiresIn: "60s",
          },
        );
        const websocketUrl = resolveWebsocketUrl(request, websocketToken);
        const response = {
          community_id: communityId,
          bootstrap_version: "m6-anchor-sync-v1",
          anchor_node: {
            node_id: app.syncRuntime.nodeId,
            websocket_url: websocketUrl,
          },
          relay_nodes: [],
          topics: app.syncRuntime.topicsForCommunity(communityId),
          latest_snapshot: await app.syncRuntime.getLatestSnapshot(communityId),
          mdns_demo_enabled: app.syncRuntime.mdnsDemoEnabled,
        };
        app.metrics?.p2pBootstrapTotal?.inc({ outcome: "ok" });
        return response;
      } catch (err) {
        app.metrics?.p2pBootstrapTotal?.inc({ outcome: "error" });
        app.metrics?.p2pSyncErrorsTotal?.inc({ op: "bootstrap", kind: "runtime" });
        request.log.error({ err, userId: actor.userId, communityId }, "p2p bootstrap failed");
        throw err;
      }
    },
  );

  app.get<{ Params: CommunityParams; Querystring: SyncQuery }>(
    "/v1/communities/:community_id/sync",
    {
      schema: {
        summary: "Catch up community sync events after an offline gap",
        tags: ["p2p"],
        security: [{ bearerAuth: [] }],
        params: communityBootstrapParamsSchema,
        querystring: localCommunitySyncQuerySchema,
        response: {
          200: communitySyncDeltaResponseSchema,
          400: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
      preHandler: [app.authenticate],
      config: {
        // 30/min/user = 1 catch-up sync every 2s — comfortable for normal
        // reconnect storms (app wake / network flap) without enabling a
        // brute-force cursor-enumeration scraper.
        rateLimit: {
          max: 30,
          timeWindow: "1 minute",
          keyGenerator: (request) =>
            (request.currentUser?.userId ?? request.user?.sub ?? request.ip) as string,
        },
      },
    },
    async (request, reply) => {
      const actor =
        request.currentUser ??
        (await loadCurrentActor(app, request.user.sub, request.user.mfa_verified_at));
      if (!actor) {
        reply.code(404);
        return { message: "User not found" };
      }

      const communityId = request.params.community_id;
      if (!canAccessCommunity(actor, communityId)) {
        reply.code(403);
        return { message: "Community membership is required" };
      }

      const limit = request.query.limit ?? 100;
      const since = request.query.since ?? null;
      try {
        const events = await app.syncRuntime.listEvents(communityId, since, limit);
        return {
          events,
          next_since: encodeSyncCursor(events.at(-1) ?? null) ?? since,
          server_time: new Date().toISOString(),
          latest_snapshot: await app.syncRuntime.getLatestSnapshot(communityId),
        };
      } catch (err) {
        // A cursor-parse failure is a 400 (client sent a malformed cursor);
        // we intentionally do NOT echo `err.message` — past versions
        // leaked the internal parser error text which exposed impl detail.
        // Any other failure (DB down, zod schema drift, etc.) is a 500:
        // we re-throw so the global Fastify error hook / Sentry records it.
        const message = err instanceof Error ? err.message : "";
        if (message.includes("since must be a valid sync cursor")) {
          app.metrics?.p2pSyncErrorsTotal?.inc({ op: "list", kind: "validation" });
          reply.code(400);
          return { message: "Invalid since cursor" };
        }

        request.log.error(
          { err, userId: actor.userId, communityId, since },
          "p2p list failed",
        );
        app.metrics?.p2pSyncErrorsTotal?.inc({ op: "list", kind: "runtime" });
        throw err;
      }
    },
  );

  // IMPORTANT INVARIANT: the `token` query param accepted here is ONLY the
  // short-lived (60s) `scope: "p2p_ws"` JWT minted by /bootstrap. The primary
  // access bearer token MUST NEVER be accepted as a query param — doing so
  // would (a) log the access token in every reverse-proxy access log and
  // (b) let arbitrary pages with a WebSocket URL gain full-scope API access.
  // We enforce the scope check below and reject anything else with 1008.
  app.get<{ Querystring: P2PSocketQuery }>(
    "/v1/ws/p2p",
    { websocket: true },
    async (socket, request) => {
      const token = request.query.token;
      if (!token) {
        logWsRejection(request, app, "missing_token", {});
        socket.close(WS_AUTH_CLOSE_CODE, WS_AUTH_GENERIC_REASON);
        return;
      }

      let claims: P2PWebSocketClaims;
      try {
        claims = await app.jwt.verify<P2PWebSocketClaims>(token);
      } catch (err) {
        logWsRejection(request, app, "invalid_token", { err });
        socket.close(WS_AUTH_CLOSE_CODE, WS_AUTH_GENERIC_REASON);
        return;
      }

      // Scope guard: only the `p2p_ws` JWT minted by /bootstrap can open
      // this socket. This blocks a caller from naively passing their
      // primary API access token (which does not carry the scope claim)
      // as the ?token= query param.
      if (claims.scope !== "p2p_ws") {
        logWsRejection(request, app, "invalid_scope", {
          userId: claims.sub,
          observedScope: claims.scope ?? null,
        });
        socket.close(WS_AUTH_CLOSE_CODE, WS_AUTH_GENERIC_REASON);
        return;
      }

      const communityId = claims.community_id ?? null;
      if (!communityId) {
        logWsRejection(request, app, "missing_community", { userId: claims.sub });
        socket.close(WS_AUTH_CLOSE_CODE, WS_AUTH_GENERIC_REASON);
        return;
      }
      if (request.query.community_id && request.query.community_id !== communityId) {
        logWsRejection(request, app, "community_mismatch", {
          userId: claims.sub,
          claimedCommunity: communityId,
          queryCommunity: request.query.community_id,
        });
        socket.close(WS_AUTH_CLOSE_CODE, WS_AUTH_GENERIC_REASON);
        return;
      }

      const actor = await loadCurrentActor(app, claims.sub, claims.mfa_verified_at);
      if (!actor) {
        logWsRejection(request, app, "unknown_user", { userId: claims.sub, communityId });
        socket.close(WS_AUTH_CLOSE_CODE, WS_AUTH_GENERIC_REASON);
        return;
      }

      if (actor.status !== "active") {
        logWsRejection(request, app, "inactive_user", {
          userId: actor.userId,
          communityId,
          status: actor.status,
        });
        socket.close(WS_AUTH_CLOSE_CODE, WS_AUTH_GENERIC_REASON);
        return;
      }

      if (!canAccessCommunity(actor, communityId)) {
        logWsRejection(request, app, "not_member", {
          userId: actor.userId,
          communityId,
        });
        socket.close(WS_AUTH_CLOSE_CODE, WS_AUTH_GENERIC_REASON);
        return;
      }

      const readyFrame = await app.syncRuntime.attachConnection(communityId, socket);
      socket.send(JSON.stringify(readyFrame));

      socket.on("close", () => {
        app.syncRuntime.detachConnection(communityId, socket);
      });
      socket.on("error", () => {
        app.syncRuntime.detachConnection(communityId, socket);
      });
    },
  );
};
