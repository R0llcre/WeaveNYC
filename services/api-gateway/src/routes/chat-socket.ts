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
      try {
        const claims = await app.jwt.verify<{ sub: string }>(token);
        userId = claims.sub;
      } catch {
        socket.close(1008, "Invalid token");
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
