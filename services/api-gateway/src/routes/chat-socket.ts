import type { FastifyPluginAsync } from "fastify";

type ChatSocketQuery = {
  token?: string;
};

export const chatSocketRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: ChatSocketQuery }>(
    "/v1/ws/chat",
    { websocket: true },
    async (socket, request) => {
      const token = request.query.token;
      if (!token) {
        socket.close(1008, "Missing token");
        return;
      }

      let userId: string;
      let tokenScope: string | undefined;
      try {
        const claims = await app.jwt.verify<{ sub: string; scope?: string }>(token);
        userId = claims.sub;
        tokenScope = claims.scope;
      } catch {
        socket.close(1008, "Invalid token");
        return;
      }

      // A1 P1-3 scope guard: this socket accepts the primary access
      // token (no `scope` claim), but MUST reject tokens minted for a
      // different scope (e.g. the short-lived `scope: "p2p_ws"` JWT
      // that /v1/communities/:id/bootstrap issues for /v1/ws/p2p). A
      // stolen p2p_ws token leaking via an access log must not unlock
      // the full chat socket.
      if (tokenScope !== undefined && tokenScope !== "chat_ws") {
        socket.close(1008, "Invalid token scope");
        return;
      }

      const user = await app.userStore.getAuthUserById(userId);
      if (!user) {
        socket.close(1008, "Unknown user");
        return;
      }

      if (user.status !== "active") {
        socket.close(1008, "Inactive user");
        return;
      }

      app.chatRealtimeHub.attachConnection(user.userId, socket);
      socket.send(
        JSON.stringify({
          event_type: "heartbeat",
          occurred_at: new Date().toISOString(),
        }),
      );

      socket.on("close", () => {
        app.chatRealtimeHub.detachConnection(user.userId, socket);
      });
      socket.on("error", () => {
        app.chatRealtimeHub.detachConnection(user.userId, socket);
      });
    },
  );
};
