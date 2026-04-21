import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

type ChatSocketQuery = {
  token?: string;
};

// P0-3: socket-level liveness bookkeeping. A half-open socket (peer dropped
// without a FIN) keeps `readyState === OPEN` on the server even though
// writes silently buffer forever. The client sends `{type:"ping"}` every
// 30s; we reply with a pong and refresh `lastPongAt` so the sweeper can
// terminate any socket that hasn't pinged in STALE_THRESHOLD_MS.
//
// The WeakMap holds `lastPongAt` per live socket without preventing GC on
// disconnect; `liveSockets` is a Set the sweeper iterates, plus a
// `openedAt` fallback for sockets that haven't pinged yet.
type TrackedSocket = {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  terminate?(): void;
  on(event: "message", cb: (raw: Buffer | string) => void): unknown;
  on(event: "close", cb: () => void): unknown;
  on(event: "error", cb: (err?: unknown) => void): unknown;
};

const STALE_THRESHOLD_MS = 90_000;
const STALE_SWEEP_INTERVAL_MS = 30_000;

// P0-3: wrapped in `fastify-plugin` so the test-only decorators
// (`chatSocketSweepForTest`, `chatSocketLiveCountForTest`) hoist out of
// the plugin's encapsulation context to the root app — otherwise tests
// couldn't reach them through the `FastifyInstance` returned by
// `buildApp`.
const chatSocketRoutesImpl: FastifyPluginAsync = async (app) => {
  // Per-app (not module-global) so multiple Fastify instances in the same
  // process — e.g. two test apps running side by side — don't share a
  // sweep timer that outlives its owning app.
  const liveSockets = new Set<TrackedSocket>();
  const lastPongAt = new WeakMap<TrackedSocket, number>();
  const openedAt = new WeakMap<TrackedSocket, number>();

  // Tests can override the clock so the sweeper can be driven without
  // actually waiting 90s of wall time. Production uses `Date.now`.
  let nowFn: () => number = Date.now;
  const sweepStaleSockets = () => {
    const now = nowFn();
    for (const socket of liveSockets) {
      const lastActivity = lastPongAt.get(socket) ?? openedAt.get(socket) ?? 0;
      if (now - lastActivity > STALE_THRESHOLD_MS) {
        // Drop the zombie at the TCP layer. `terminate()` is the `ws`
        // helper that skips the close-handshake round-trip (the peer
        // is unresponsive, so a graceful close would block forever).
        // Falls back to `close()` for test fixtures that don't expose
        // terminate.
        try {
          if (typeof socket.terminate === "function") {
            socket.terminate();
          } else {
            socket.close(1008, "Stale socket");
          }
        } catch {
          // Ignore — the close handler below will still run on real
          // sockets; for mock sockets the test asserts on the call.
        }
        // Symmetric cleanup of the hub registry (P0-9): even if the
        // 'close' event doesn't fire for some reason, this keeps the
        // zombie out of the per-user socket bucket.
        app.chatRealtimeHub.evictSocket(socket as Parameters<typeof app.chatRealtimeHub.evictSocket>[0]);
        liveSockets.delete(socket);
      }
    }
  };

  const sweepTimer = setInterval(sweepStaleSockets, STALE_SWEEP_INTERVAL_MS);
  // Don't hold the event loop open just to sweep — the interval is
  // bookkeeping, the process should be allowed to exit on SIGTERM.
  sweepTimer.unref?.();

  app.addHook("onClose", async () => {
    clearInterval(sweepTimer);
    liveSockets.clear();
  });

  // Expose the sweeper + state so tests can invoke it deterministically
  // under fake timers without racing a real setInterval. The `now`
  // override lets tests jump the clock forward past the 90s stale
  // threshold without stalling wall time.
  app.decorate("chatSocketSweepForTest", (now?: number) => {
    if (typeof now === "number") {
      const previous = nowFn;
      nowFn = () => now;
      try {
        sweepStaleSockets();
      } finally {
        nowFn = previous;
      }
    } else {
      sweepStaleSockets();
    }
  });
  app.decorate("chatSocketLiveCountForTest", () => liveSockets.size);

  app.get<{ Querystring: ChatSocketQuery }>(
    "/v1/ws/chat",
    { websocket: true },
    async (socket, request) => {
      const trackedSocket = socket as unknown as TrackedSocket;
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

      // P0-3 / P0-9 bookkeeping: track this socket so the sweeper can
      // detect half-open peers. `openedAt` acts as the initial activity
      // watermark until the first ping lands.
      const now = Date.now();
      liveSockets.add(trackedSocket);
      openedAt.set(trackedSocket, now);
      lastPongAt.set(trackedSocket, now);

      socket.send(
        JSON.stringify({
          event_type: "heartbeat",
          occurred_at: new Date().toISOString(),
        }),
      );

      // P0-3: accept client pings and reply with a pong. Refreshing
      // `lastPongAt` on each ping tells the sweeper that this socket
      // round-tripped a message within the window. We also refresh on
      // any parseable inbound message so chatter on the socket keeps
      // it alive even if the keep-alive cadence drifts.
      trackedSocket.on("message", (raw: Buffer | string) => {
        lastPongAt.set(trackedSocket, Date.now());
        let msg: unknown;
        try {
          msg = JSON.parse(typeof raw === "string" ? raw : raw.toString());
        } catch {
          return;
        }
        if (msg && typeof msg === "object" && (msg as { type?: unknown }).type === "ping") {
          try {
            socket.send(JSON.stringify({ type: "pong", t: Date.now() }));
          } catch {
            // send() on a broken socket triggers the close handler; ignore.
          }
        }
      });

      socket.on("close", () => {
        liveSockets.delete(trackedSocket);
        app.chatRealtimeHub.detachConnection(user.userId, socket);
      });
      socket.on("error", () => {
        liveSockets.delete(trackedSocket);
        app.chatRealtimeHub.detachConnection(user.userId, socket);
      });
    },
  );
};

export const chatSocketRoutes = fp(chatSocketRoutesImpl, {
  name: "chat-socket-routes",
});
