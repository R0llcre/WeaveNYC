import { Redis } from "ioredis";

import type { ChatRealtimeEvent } from "@weavenyc/shared";

type SocketLike = {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  readyState?: number;
};

export interface ChatRealtimeHub {
  publishToUsers(userIds: string[], event: ChatRealtimeEvent): Promise<void>;
  attachConnection(userId: string, socket: SocketLike): void;
  detachConnection(userId: string, socket: SocketLike): void;
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

  disconnectUser(userId: string, reason = "Access revoked") {
    const sockets = this.connections.get(userId);
    if (!sockets) {
      return;
    }

    for (const socket of sockets) {
      try {
        socket.close(1008, reason);
      } catch {
        try {
          socket.close();
        } catch {
          // ignore close errors from broken sockets
        }
      }
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

  disconnectUser(userId: string, reason = "Access revoked") {
    const sockets = this.connections.get(userId);
    if (!sockets) {
      return;
    }

    for (const socket of sockets) {
      try {
        socket.close(1008, reason);
      } catch {
        try {
          socket.close();
        } catch {
          // ignore close errors from broken sockets
        }
      }
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
