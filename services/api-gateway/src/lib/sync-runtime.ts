import { Redis } from "ioredis";
import { Pool } from "pg";
import { createCommunitySyncEvent, topicsForCommunity, type CreateCommunitySyncEventInput } from "@weavenyc/p2p";
import { communitySyncEventSchema, type CommunitySyncEvent } from "@weavenyc/shared";

type SocketLike = {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  readyState?: number;
};

export type P2PTopicKey = "posts" | "announcements" | "reports";

export type P2PEventType =
  | "post.published"
  | "post.updated"
  | "post.tombstoned"
  | "announcement.published"
  | "announcement.updated"
  | "announcement.deleted"
  | "report.created"
  | "moderation.decision";

export type P2PAggregateType = "post" | "announcement" | "report" | "moderation";

export type P2PCommunityTopics = Record<P2PTopicKey, string>;

export type P2PEventEnvelope = CommunitySyncEvent;

export type P2PPublishResult = {
  event: P2PEventEnvelope;
  durablePublished: boolean;
  livePublished: boolean;
};

type SyncCursor = {
  occurredAt: string;
  syncEventId: string | null;
};

export type P2PSnapshotInfo = {
  last_event_at: string | null;
  event_count: number;
};

export type P2PPublishInput = CreateCommunitySyncEventInput;

export type P2PSyncConnectionReady = {
  frame_type: "ready";
  community_id: string;
  node_id: string;
  peer_count: number;
  latest_snapshot: P2PSnapshotInfo;
  topics: P2PCommunityTopics;
  transport: "bootstrap" | "mdns-demo";
};

export type P2PSyncConnectionHeartbeat = {
  frame_type: "heartbeat";
  occurred_at: string;
};

export type P2PSyncConnectionEvent = {
  frame_type: "event";
  event: P2PEventEnvelope;
};

export type P2PSyncConnectionFrame =
  | P2PSyncConnectionReady
  | P2PSyncConnectionHeartbeat
  | P2PSyncConnectionEvent;

export interface P2PSyncRuntime {
  readonly nodeId: string;
  readonly mdnsDemoEnabled: boolean;
  attachConnection(communityId: string, socket: SocketLike): Promise<P2PSyncConnectionReady>;
  detachConnection(communityId: string, socket: SocketLike): void;
  listEvents(communityId: string, since: string | null, limit: number): Promise<P2PEventEnvelope[]>;
  getLatestSnapshot(communityId: string): Promise<P2PSnapshotInfo>;
  fanout(event: P2PEventEnvelope): Promise<boolean>;
  publish(input: P2PPublishInput): Promise<P2PPublishResult>;
  topicsForCommunity(communityId: string): P2PCommunityTopics;
  close(): Promise<void>;
}

function channelForCommunity(communityId: string) {
  return `p2p:community:${communityId}:events`;
}

function safeSend(socket: SocketLike, frame: P2PSyncConnectionFrame) {
  try {
    socket.send(JSON.stringify(frame));
  } catch {
    try {
      socket.close();
    } catch {
      // ignore close errors from broken sockets
    }
  }
}

function broadcastEventToSockets(
  sockets: Set<SocketLike> | undefined,
  event: P2PEventEnvelope,
) {
  if (!sockets?.size) {
    return false;
  }

  const frame: P2PSyncConnectionEvent = {
    frame_type: "event",
    event,
  };
  for (const socket of sockets) {
    safeSend(socket, frame);
  }
  return true;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseCursor(cursor: string | null): SyncCursor | null {
  if (!cursor) {
    return null;
  }

  const legacyTimestamp = Date.parse(cursor);
  if (!Number.isNaN(legacyTimestamp)) {
    return {
      occurredAt: new Date(legacyTimestamp).toISOString(),
      syncEventId: null,
    };
  }

  if (!cursor.startsWith("v1.")) {
    throw new Error("since must be a valid sync cursor");
  }

  try {
    const raw = Buffer.from(cursor.slice(3), "base64url").toString("utf8");
    const parsed = JSON.parse(raw) as { occurred_at?: unknown; sync_event_id?: unknown };
    if (typeof parsed.occurred_at !== "string" || Number.isNaN(Date.parse(parsed.occurred_at))) {
      throw new Error("invalid cursor occurred_at");
    }
    if (
      parsed.sync_event_id !== undefined &&
      parsed.sync_event_id !== null &&
      (typeof parsed.sync_event_id !== "string" || !isUuid(parsed.sync_event_id))
    ) {
      throw new Error("invalid cursor sync_event_id");
    }
    return {
      occurredAt: new Date(parsed.occurred_at).toISOString(),
      syncEventId: typeof parsed.sync_event_id === "string" ? parsed.sync_event_id : null,
    };
  } catch {
    throw new Error("since must be a valid sync cursor");
  }
}

export function encodeSyncCursor(event: Pick<P2PEventEnvelope, "occurred_at" | "sync_event_id"> | null) {
  if (!event) {
    return null;
  }

  return `v1.${Buffer.from(
    JSON.stringify({
      occurred_at: event.occurred_at,
      sync_event_id: event.sync_event_id,
    }),
    "utf8",
  ).toString("base64url")}`;
}

function compareEventPosition(
  left: Pick<P2PEventEnvelope, "occurred_at" | "sync_event_id">,
  right: Pick<P2PEventEnvelope, "occurred_at" | "sync_event_id">,
) {
  if (left.occurred_at !== right.occurred_at) {
    return left.occurred_at.localeCompare(right.occurred_at);
  }

  return left.sync_event_id.localeCompare(right.sync_event_id);
}

function isAfterCursor(event: P2PEventEnvelope, cursor: SyncCursor | null) {
  if (!cursor) {
    return true;
  }

  if (event.occurred_at > cursor.occurredAt) {
    return true;
  }

  if (event.occurred_at < cursor.occurredAt) {
    return false;
  }

  if (!cursor.syncEventId) {
    return false;
  }

  return event.sync_event_id > cursor.syncEventId;
}

function createEnvelope(input: P2PPublishInput): P2PEventEnvelope {
  return createCommunitySyncEvent(input);
}

export class InMemoryP2PSyncRuntime implements P2PSyncRuntime {
  readonly nodeId: string;
  readonly mdnsDemoEnabled: boolean;
  readonly publishedEvents: P2PEventEnvelope[] = [];
  private readonly eventsByCommunity = new Map<string, P2PEventEnvelope[]>();
  private readonly connections = new Map<string, Set<SocketLike>>();
  private readonly heartbeatTimer: NodeJS.Timeout;

  constructor(options: { nodeId?: string; mdnsDemoEnabled?: boolean; heartbeatIntervalMs?: number } = {}) {
    this.nodeId = options.nodeId ?? "anchor-sync-test";
    this.mdnsDemoEnabled = options.mdnsDemoEnabled ?? false;
    this.heartbeatTimer = setInterval(() => {
      const frame: P2PSyncConnectionHeartbeat = {
        frame_type: "heartbeat",
        occurred_at: new Date().toISOString(),
      };
      for (const sockets of this.connections.values()) {
        for (const socket of sockets) {
          safeSend(socket, frame);
        }
      }
    }, options.heartbeatIntervalMs ?? 30_000);
    this.heartbeatTimer.unref();
  }

  async attachConnection(communityId: string, socket: SocketLike): Promise<P2PSyncConnectionReady> {
    const sockets = this.connections.get(communityId) ?? new Set<SocketLike>();
    sockets.add(socket);
    this.connections.set(communityId, sockets);
    return {
      frame_type: "ready",
      community_id: communityId,
      node_id: this.nodeId,
      peer_count: Math.max(sockets.size - 1, 0),
      latest_snapshot: await this.getLatestSnapshot(communityId),
      topics: this.topicsForCommunity(communityId),
      transport: "bootstrap",
    };
  }

  detachConnection(communityId: string, socket: SocketLike) {
    const sockets = this.connections.get(communityId);
    if (!sockets) {
      return;
    }

    sockets.delete(socket);
    if (sockets.size === 0) {
      this.connections.delete(communityId);
    }
  }

  async listEvents(communityId: string, since: string | null, limit: number): Promise<P2PEventEnvelope[]> {
    const cursor = parseCursor(since);
    const events = this.eventsByCommunity.get(communityId) ?? [];
    return events
      .filter((event) => isAfterCursor(event, cursor))
      .sort(compareEventPosition)
      .slice(0, limit);
  }

  async getLatestSnapshot(communityId: string): Promise<P2PSnapshotInfo> {
    const events = this.eventsByCommunity.get(communityId) ?? [];
    const latest = events[events.length - 1];
    return {
      last_event_at: latest?.occurred_at ?? null,
      event_count: events.length,
    };
  }

  async publish(input: P2PPublishInput): Promise<P2PPublishResult> {
    const event = createEnvelope(input);
    const events = this.eventsByCommunity.get(input.communityId) ?? [];
    events.push(event);
    events.sort(compareEventPosition);
    this.eventsByCommunity.set(input.communityId, events);
    this.publishedEvents.push(event);

    const livePublished = await this.fanout(event);

    return {
      event,
      durablePublished: true,
      livePublished,
    };
  }

  async fanout(event: P2PEventEnvelope): Promise<boolean> {
    const events = this.eventsByCommunity.get(event.community_id) ?? [];
    if (!events.some((entry) => entry.sync_event_id === event.sync_event_id)) {
      events.push(event);
      events.sort(compareEventPosition);
      this.eventsByCommunity.set(event.community_id, events);
    }

    if (!this.publishedEvents.some((entry) => entry.sync_event_id === event.sync_event_id)) {
      this.publishedEvents.push(event);
    }

    return broadcastEventToSockets(this.connections.get(event.community_id), event);
  }

  topicsForCommunity(communityId: string): P2PCommunityTopics {
    return topicsForCommunity(communityId);
  }

  async close() {
    clearInterval(this.heartbeatTimer);
  }
}

export class RedisP2PSyncRuntime implements P2PSyncRuntime {
  readonly nodeId: string;
  readonly mdnsDemoEnabled: boolean;
  private readonly publisher: Redis;
  private readonly subscriber: Redis;
  private readonly database: Pool;
  private readonly connections = new Map<string, Set<SocketLike>>();
  private readonly heartbeatTimer: NodeJS.Timeout;
  private readonly ready: Promise<void>;

  constructor(
    redisUrl: string,
    databaseUrl: string,
    options: {
      nodeId: string;
      mdnsDemoEnabled?: boolean;
      heartbeatIntervalMs?: number;
    },
    dependencies?: {
      publisher?: Pick<Redis, "publish" | "quit">;
      subscriber?: Pick<Redis, "psubscribe" | "on" | "quit">;
      database?: Pick<Pool, "query" | "end">;
      ready?: Promise<void>;
    },
  ) {
    this.nodeId = options.nodeId;
    this.mdnsDemoEnabled = options.mdnsDemoEnabled ?? false;
    this.publisher = (dependencies?.publisher as Redis | undefined) ?? new Redis(redisUrl, { lazyConnect: false });
    this.subscriber = (dependencies?.subscriber as Redis | undefined) ?? new Redis(redisUrl, { lazyConnect: false });
    this.database = (dependencies?.database as Pool | undefined) ?? new Pool({ connectionString: databaseUrl });
    this.ready =
      dependencies?.ready ?? this.subscriber.psubscribe("p2p:community:*:events").then(() => undefined);
    this.subscriber.on("pmessage", (_pattern, channel, payload) => {
      const communityId = channel.split(":")[2];
      if (!communityId) {
        return;
      }

      let event: P2PEventEnvelope;
      try {
        event = JSON.parse(payload) as P2PEventEnvelope;
      } catch {
        return;
      }

      const sockets = this.connections.get(communityId);
      if (!sockets?.size) {
        return;
      }

      const frame: P2PSyncConnectionEvent = {
        frame_type: "event",
        event,
      };
      for (const socket of sockets) {
        safeSend(socket, frame);
      }
    });
    this.heartbeatTimer = setInterval(() => {
      const frame: P2PSyncConnectionHeartbeat = {
        frame_type: "heartbeat",
        occurred_at: new Date().toISOString(),
      };
      for (const sockets of this.connections.values()) {
        for (const socket of sockets) {
          safeSend(socket, frame);
        }
      }
    }, options.heartbeatIntervalMs ?? 30_000);
    this.heartbeatTimer.unref();
  }

  async attachConnection(communityId: string, socket: SocketLike): Promise<P2PSyncConnectionReady> {
    await this.ready;
    const sockets = this.connections.get(communityId) ?? new Set<SocketLike>();
    sockets.add(socket);
    this.connections.set(communityId, sockets);
    return {
      frame_type: "ready",
      community_id: communityId,
      node_id: this.nodeId,
      peer_count: Math.max(sockets.size - 1, 0),
      latest_snapshot: await this.getLatestSnapshot(communityId),
      topics: this.topicsForCommunity(communityId),
      transport: "bootstrap",
    };
  }

  detachConnection(communityId: string, socket: SocketLike) {
    const sockets = this.connections.get(communityId);
    if (!sockets) {
      return;
    }

    sockets.delete(socket);
    if (sockets.size === 0) {
      this.connections.delete(communityId);
    }
  }

  async listEvents(communityId: string, since: string | null, limit: number): Promise<P2PEventEnvelope[]> {
    await this.ready;
    const cursor = parseCursor(since);
    const result = cursor
      ? await this.database.query<{
          sync_event_id: string;
          community_id: string;
          event_type: P2PEventType;
          aggregate_type: P2PAggregateType;
          aggregate_id: string;
          actor_p2p_id: string | null;
          payload_json: Record<string, unknown>;
          cid: string;
          occurred_at: Date;
        }>(
          `
            select
              sync_event_id,
              community_id,
              event_type,
              aggregate_type,
              aggregate_id,
              actor_p2p_id,
              payload_json,
              cid,
              occurred_at
            from community_sync_events
            where community_id = $1
              and (
                occurred_at > $2::timestamptz
                or ($3::uuid is not null and occurred_at = $2::timestamptz and sync_event_id > $3::uuid)
              )
            order by occurred_at asc, sync_event_id asc
            limit $4
          `,
          [communityId, cursor.occurredAt, cursor.syncEventId, limit],
        )
      : await this.database.query<{
          sync_event_id: string;
          community_id: string;
          event_type: P2PEventType;
          aggregate_type: P2PAggregateType;
          aggregate_id: string;
          actor_p2p_id: string | null;
          payload_json: Record<string, unknown>;
          cid: string;
          occurred_at: Date;
        }>(
          `
            select
              sync_event_id,
              community_id,
              event_type,
              aggregate_type,
              aggregate_id,
              actor_p2p_id,
              payload_json,
              cid,
              occurred_at
            from community_sync_events
            where community_id = $1
            order by occurred_at asc, sync_event_id asc
            limit $2
          `,
          [communityId, limit],
        );

    return result.rows.map((row) =>
      communitySyncEventSchema.parse({
        sync_event_id: row.sync_event_id,
        community_id: row.community_id,
        topic: topicsForCommunity(row.community_id)[
          row.aggregate_type === "announcement"
            ? "announcements"
            : row.aggregate_type === "post"
              ? "posts"
              : "reports"
        ],
        event_type: row.event_type,
        aggregate_type: row.aggregate_type,
        aggregate_id: row.aggregate_id,
        occurred_at: row.occurred_at.toISOString(),
        cid: row.cid,
        actor_p2p_id: row.actor_p2p_id,
        payload: row.payload_json,
      }),
    );
  }

  async getLatestSnapshot(communityId: string): Promise<P2PSnapshotInfo> {
    await this.ready;
    const [latestResult, eventCountResult] = await Promise.all([
      this.database.query<{ occurred_at: Date }>(
        `
          select occurred_at
          from community_sync_events
          where community_id = $1
          order by occurred_at desc, sync_event_id desc
          limit 1
        `,
        [communityId],
      ),
      this.database.query<{ event_count: string }>(
        `
          select count(*)::text as event_count
          from community_sync_events
          where community_id = $1
        `,
        [communityId],
      ),
    ]);
    const latest = latestResult.rows[0];
    return {
      last_event_at: latest?.occurred_at.toISOString() ?? null,
      event_count: Number(eventCountResult.rows[0]?.event_count ?? 0),
    };
  }

  async publish(input: P2PPublishInput): Promise<P2PPublishResult> {
    await this.ready;
    const event = createEnvelope(input);
    await this.database.query(
      `
        insert into community_sync_events (
          sync_event_id,
          community_id,
          event_type,
          aggregate_type,
          aggregate_id,
          actor_user_id,
          actor_p2p_id,
          payload_json,
          cid,
          occurred_at
        ) values ($1::uuid, $2::uuid, $3, $4, $5::uuid, null, $6, $7::jsonb, $8, $9::timestamptz)
      `,
      [
        event.sync_event_id,
        event.community_id,
        event.event_type,
        event.aggregate_type,
        event.aggregate_id,
        event.actor_p2p_id,
        JSON.stringify(event.payload),
        event.cid,
        event.occurred_at,
      ],
    );

    const livePublished = await this.fanout(event);
    return {
      event,
      durablePublished: true,
      livePublished,
    };
  }

  async fanout(event: P2PEventEnvelope): Promise<boolean> {
    await this.ready;
    const serialized = JSON.stringify(event);
    try {
      await this.publisher.publish(channelForCommunity(event.community_id), serialized);
      return true;
    } catch {
      return broadcastEventToSockets(this.connections.get(event.community_id), event);
    }
  }

  topicsForCommunity(communityId: string): P2PCommunityTopics {
    return topicsForCommunity(communityId);
  }

  async close() {
    clearInterval(this.heartbeatTimer);
    await Promise.all([this.publisher.quit(), this.subscriber.quit(), this.database.end()]);
  }
}
