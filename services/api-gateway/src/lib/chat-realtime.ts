import { Redis } from "ioredis";

import type { ChatRealtimeEvent } from "@weavenyc/shared";

// P0-9: `terminate` is optional because the in-memory hub's test fixtures
// don't need to free a kernel socket, but every real `@fastify/websocket`
// socket (backed by `ws`) exposes it. The stale-socket sweep uses it to
// slam the TCP connection shut — `close()` waits for a graceful handshake
// that a half-open peer will never complete.
export type SocketLike = {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  terminate?(): void;
  readyState?: number;
};

export interface ChatRealtimeHub {
  publishToUsers(userIds: string[], event: ChatRealtimeEvent): Promise<void>;
  attachConnection(userId: string, socket: SocketLike): void;
  detachConnection(userId: string, socket: SocketLike): void;
  /**
   * P0-9: evict a socket from every user bucket without knowing the userId.
   * Used by the stale-socket sweeper (a termination source doesn't know
   * which user owned the zombie socket) and as a shared helper that
   * `disconnectUser` reuses so both paths flow through one eviction
   * routine. Returns the number of bucket entries that were removed.
   */
  evictSocket(socket: SocketLike): number;
  disconnectUser(userId: string, reason?: string): void;
  close(): Promise<void>;
}

function channelForUser(userId: string) {
  return `chat:user:${userId}`;
}

function safeSend(socket: SocketLike, event: ChatRealtimeEvent) {
  try {
    socket.send(JSON.stringify(event));
  } catch {
    try {
      socket.close();
    } catch {
      // ignore close errors from broken sockets
    }
  }
}

// Shared eviction logic for both the Redis and in-memory hubs — scans every
// user bucket, removes the socket from any bucket it lives in, and prunes
// empty buckets. Kept outside the classes so both subclasses use the same
// loop without a second copy of the bookkeeping drift.
function evictSocketFromMap(
  connections: Map<string, Set<SocketLike>>,
  socket: SocketLike,
): number {
  let removed = 0;
  for (const [userId, sockets] of connections) {
    if (sockets.delete(socket)) {
      removed += 1;
    }
    if (sockets.size === 0) {
      connections.delete(userId);
    }
  }
  return removed;
}

export class RedisChatRealtimeHub implements ChatRealtimeHub {
  private readonly publisher: Redis;
  private readonly subscriber: Redis;
  private readonly connections = new Map<string, Set<SocketLike>>();
  private readonly heartbeatTimer: NodeJS.Timeout;
  private readonly ready: Promise<void>;

  constructor(redisUrl: string, heartbeatIntervalMs = 30_000) {
    this.publisher = new Redis(redisUrl, { lazyConnect: false });
    this.subscriber = new Redis(redisUrl, { lazyConnect: false });
    this.ready = this.subscriber.psubscribe("chat:user:*").then(() => undefined);
    this.subscriber.on("pmessage", (_pattern, channel, payload) => {
      const userId = channel.replace("chat:user:", "");
      let event: ChatRealtimeEvent;
      try {
        event = JSON.parse(payload) as ChatRealtimeEvent;
      } catch {
        return;
      }

      const sockets = this.connections.get(userId);
      if (!sockets?.size) {
        return;
      }

      for (const socket of sockets) {
        safeSend(socket, event);
      }
    });
    this.heartbeatTimer = setInterval(() => {
      const heartbeat: ChatRealtimeEvent = {
        event_type: "heartbeat",
        occurred_at: new Date().toISOString(),
      };
      for (const sockets of this.connections.values()) {
        for (const socket of sockets) {
          safeSend(socket, heartbeat);
        }
      }
    }, heartbeatIntervalMs);
    this.heartbeatTimer.unref();
  }

  attachConnection(userId: string, socket: SocketLike) {
    const sockets = this.connections.get(userId) ?? new Set<SocketLike>();
    sockets.add(socket);
    this.connections.set(userId, sockets);
  }

  detachConnection(userId: string, socket: SocketLike) {
    const sockets = this.connections.get(userId);
    if (!sockets) {
      return;
    }

    sockets.delete(socket);
    if (sockets.size === 0) {
      this.connections.delete(userId);
    }
  }

  evictSocket(socket: SocketLike): number {
    return evictSocketFromMap(this.connections, socket);
  }

  disconnectUser(userId: string, reason = "Access revoked") {
    const sockets = this.connections.get(userId);
    if (!sockets) {
      return;
    }

    // P0-4 + P0-9: copy the set before iterating so the per-socket
    // terminate/close path (which detaches via chat-socket's `close` hook
    // on real sockets) doesn't mutate the set we're iterating. On the
    // in-memory fixture no close hook fires, so we still delete the
    // bucket below as the eviction-of-last-resort.
    for (const socket of [...sockets]) {
      try {
        socket.close(1008, reason);
      } catch {
        try {
          socket.close();
        } catch {
          // ignore close errors from broken sockets
        }
      }
      // Defensive: if the close path didn't remove it (e.g. broken
      // socket, missing 'close' event), evict from the registry too so
      // the zombie doesn't stay attached.
      this.evictSocket(socket);
    }
    this.connections.delete(userId);
  }

  async publishToUsers(userIds: string[], event: ChatRealtimeEvent) {
    await this.ready;
    const uniqueUserIds = [...new Set(userIds)];
    await Promise.all(
      uniqueUserIds.map((userId) => this.publisher.publish(channelForUser(userId), JSON.stringify(event))),
    );
  }

  async close() {
    clearInterval(this.heartbeatTimer);
    await Promise.all([this.publisher.quit(), this.subscriber.quit()]);
  }
}

export class InMemoryChatRealtimeHub implements ChatRealtimeHub {
  readonly publishedEvents: Array<{ userIds: string[]; event: ChatRealtimeEvent }> = [];
  readonly disconnectedUsers: Array<{ userId: string; reason: string }> = [];
  private readonly connections = new Map<string, Set<SocketLike>>();

  attachConnection(userId: string, socket: SocketLike) {
    const sockets = this.connections.get(userId) ?? new Set<SocketLike>();
    sockets.add(socket);
    this.connections.set(userId, sockets);
  }

  detachConnection(userId: string, socket: SocketLike) {
    const sockets = this.connections.get(userId);
    if (!sockets) {
      return;
    }

    sockets.delete(socket);
    if (sockets.size === 0) {
      this.connections.delete(userId);
    }
  }

  evictSocket(socket: SocketLike): number {
    return evictSocketFromMap(this.connections, socket);
  }

  disconnectUser(userId: string, reason = "Access revoked") {
    // P0-4: record the call even when the user has no attached socket
    // (e.g. offline at block time) so tests and observability can
    // assert the safety pipeline fired the eviction, and a later
    // attach — if the user races a reconnect — still gets disconnected
    // via `evictSocket` since the block state blocks new socket traffic
    // at the route layer.
    this.disconnectedUsers.push({ userId, reason });
    const sockets = this.connections.get(userId);
    if (!sockets) {
      return;
    }

    for (const socket of [...sockets]) {
      try {
        socket.close(1008, reason);
      } catch {
        try {
          socket.close();
        } catch {
          // ignore close errors from broken sockets
        }
      }
      this.evictSocket(socket);
    }
    this.connections.delete(userId);
  }

  async publishToUsers(userIds: string[], event: ChatRealtimeEvent) {
    this.publishedEvents.push({ userIds: [...new Set(userIds)], event });
    for (const userId of userIds) {
      const sockets = this.connections.get(userId);
      if (!sockets) {
        continue;
      }
      for (const socket of sockets) {
        safeSend(socket, event);
      }
    }
  }

  async close() {}
}
