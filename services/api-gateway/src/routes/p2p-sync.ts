import type { FastifyPluginAsync } from "fastify";

import {
  communityBootstrapParamsSchema,
  communityBootstrapResponseSchema,
  communitySyncDeltaResponseSchema,
  errorResponseSchema,
} from "../contracts.js";
import { isAnchorForCommunity, loadCurrentActor } from "../lib/require-anchor.js";
import { encodeSyncCursor } from "../lib/sync-runtime.js";

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

const localCommunitySyncQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    since: { type: "string" },
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

      const bearerToken = readBearerToken(request.headers);
      if (!bearerToken) {
        reply.code(401);
        return { message: "Bearer token is required" };
      }

      const websocketToken = app.jwt.sign(
        {
          sub: actor.userId,
          level: actor.level,
          role: actor.role,
          community_ids: actor.communityIds,
          anchor_community_id: actor.anchorCommunityId ?? undefined,
          mfa_verified_at: actor.mfaVerifiedAt ?? undefined,
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
      return {
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
      try {
        const events = await app.syncRuntime.listEvents(communityId, request.query.since ?? null, limit);
        return {
          events,
          next_since: encodeSyncCursor(events.at(-1) ?? null) ?? request.query.since ?? null,
          server_time: new Date().toISOString(),
          latest_snapshot: await app.syncRuntime.getLatestSnapshot(communityId),
        };
      } catch (error) {
        reply.code(400);
        return {
          message: error instanceof Error ? error.message : "Unable to load sync events",
        };
      }
    },
  );

  app.get<{ Querystring: P2PSocketQuery }>(
    "/v1/ws/p2p",
    { websocket: true },
    async (socket, request) => {
      const token = request.query.token;
      if (!token) {
        socket.close(1008, "Missing token");
        return;
      }

      let claims: P2PWebSocketClaims;
      try {
        claims = await app.jwt.verify<P2PWebSocketClaims>(token);
      } catch {
        socket.close(1008, "Invalid token");
        return;
      }

      const communityId = claims.scope === "p2p_ws" ? claims.community_id ?? null : request.query.community_id ?? null;
      if (!communityId) {
        socket.close(1008, "Missing community");
        return;
      }
      if (claims.scope === "p2p_ws" && request.query.community_id && request.query.community_id !== communityId) {
        socket.close(1008, "Community mismatch");
        return;
      }

      const actor = await loadCurrentActor(app, claims.sub, claims.mfa_verified_at);
      if (!actor) {
        socket.close(1008, "Unknown user");
        return;
      }

      if (actor.status !== "active") {
        socket.close(1008, "Inactive user");
        return;
      }

      if (!canAccessCommunity(actor, communityId)) {
        socket.close(1008, "Community membership is required");
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
