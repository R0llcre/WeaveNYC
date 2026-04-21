import { Redis } from "ioredis";
import { Pool } from "pg";
import { createCommunitySyncEvent, topicsForCommunity, type CreateCommunitySyncEventInput } from "@weavenyc/p2p";
import {
  P2P_OVERLAY_PROTOCOL_VERSION,
  communitySyncEventSchema,
  type CommunitySyncEvent,
} from "@weavenyc/shared";

import type { WeaveMetrics } from "./metrics.js";

/**
 * Minimal logger surface the sync runtimes call into. Mirrors the subset of
 * `FastifyBaseLogger` we actually use so tests can inject plain spies.
 */
export interface SyncRuntimeLogger {
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
  debug?: (obj: unknown, msg?: string) => void;
}

/**
 * Optional observability bindings passed into every runtime. Both are
 * intentionally nullable so legacy callsites / tests can omit them without
 * recompiling; when present the runtime emits Prometheus counters and
 * structured log lines for each hop.
 */
export interface SyncRuntimeObservability {
  logger?: SyncRuntimeLogger | null;
  metrics?: Pick<
    WeaveMetrics,
    'p2pSyncEventsTotal' | 'p2pSyncErrorsTotal' | 'p2pSyncLagSeconds' | 'p2pActiveConnections'
  > | null;
}

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

/**
 * `redactPriorPayloads` is opt-in. When set, prior `post.published`/`post.updated`
 * (or `announcement.published`/`announcement.updated`) rows for the same
 * `(community_id, aggregate_id)` have their `payload_json` rewritten to a minimal
 * `{ post: { post_id }, redacted: true }` (or the announcement equivalent)
 * snapshot so that tombstoned content can no longer be replayed through
 * `/sync`. The causal row is retained so offline cursors still advance.
 *
 * The redaction UPDATE + the tombstone INSERT are atomic in `RedisP2PSyncRuntime`
 * (wrapped in a `BEGIN/COMMIT`) so `/sync` cannot observe a state where the
 * tombstone event exists but the prior payloads are still plaintext.
 */
export type P2PPublishInput = CreateCommunitySyncEventInput & {
  redactPriorPayloads?: boolean;
};

export type P2PSyncConnectionReady = {
  frame_type: "ready";
  /**
   * Wire-format tag — matches `P2P_OVERLAY_PROTOCOL_VERSION` in
   * packages/shared. The client worker validates this against its own
   * constant on frame receipt; mismatch halts the sync loop (P1 finding 4).
   */
  protocol_version: typeof P2P_OVERLAY_PROTOCOL_VERSION;
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
  /** Attach a logger + Prometheus metrics handle after app construction. */
  bindObservability(observability: SyncRuntimeObservability): void;
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

function safeSend(
  socket: SocketLike,
  frame: P2PSyncConnectionFrame,
  observability?: SyncRuntimeObservability,
) {
  try {
    socket.send(JSON.stringify(frame));
  } catch (err) {
    // The receiving socket is broken. Log at debug so we notice in dev /
    // test without drowning production; bump the ws validation counter so
    // dashboards can surface sudden spikes (usually a deploy-time issue).
    observability?.logger?.debug?.(
      { err, frameType: frame.frame_type },
      "p2p websocket send failed",
    );
    observability?.metrics?.p2pSyncErrorsTotal.inc({ op: 'fanout', kind: 'ws' });
    try {
      socket.close();
    } catch (closeErr) {
      // At this point the socket is so broken close() itself throws; log
      // once and move on instead of letting the error bubble into the
      // fanout loop and interrupt delivery to the remaining subscribers.
      observability?.logger?.debug?.(
        { err: closeErr },
        "p2p websocket close failed after send error",
      );
    }
  }
}

function broadcastEventToSockets(
  sockets: Set<SocketLike> | undefined,
  event: P2PEventEnvelope,
  observability?: SyncRuntimeObservability,
) {
  if (!sockets?.size) {
    return false;
  }

  const frame: P2PSyncConnectionEvent = {
    frame_type: "event",
    event,
  };
  for (const socket of sockets) {
    safeSend(socket, frame, observability);
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
  // The wire format never exposes the runtime-only `redactPriorPayloads`
  // control flag — strip it before forwarding to the envelope factory.
  const { redactPriorPayloads: _redact, ...envelopeInput } = input;
  void _redact;
  return createCommunitySyncEvent(envelopeInput as CreateCommunitySyncEventInput);
}

/**
 * Minimal redacted payload for a post or announcement whose authoritative
 * content has been tombstoned. Keeps the aggregate id so downstream consumers
 * can correlate (and evict any cached bodies they might still be holding)
 * while removing the actual content text / title / metadata.
 */
function buildRedactedPayloadForAggregate(
  aggregateType: P2PAggregateType,
  aggregateId: string,
): Record<string, unknown> {
  if (aggregateType === "post") {
    return {
      post: { post_id: aggregateId },
      redacted: true,
    };
  }

  if (aggregateType === "announcement") {
    return {
      announcement: { announcement_id: aggregateId },
      redacted: true,
    };
  }

  return { redacted: true };
}

export class InMemoryP2PSyncRuntime implements P2PSyncRuntime {
  readonly nodeId: string;
  readonly mdnsDemoEnabled: boolean;
  readonly publishedEvents: P2PEventEnvelope[] = [];
  private readonly eventsByCommunity = new Map<string, P2PEventEnvelope[]>();
  private readonly connections = new Map<string, Set<SocketLike>>();
  private readonly heartbeatTimer: NodeJS.Timeout;
  private observability: SyncRuntimeObservability = {};

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
          safeSend(socket, frame, this.observability);
        }
      }
    }, options.heartbeatIntervalMs ?? 30_000);
    this.heartbeatTimer.unref();
  }

  bindObservability(observability: SyncRuntimeObservability) {
    this.observability = observability;
  }

  async attachConnection(communityId: string, socket: SocketLike): Promise<P2PSyncConnectionReady> {
    const sockets = this.connections.get(communityId) ?? new Set<SocketLike>();
    sockets.add(socket);
    this.connections.set(communityId, sockets);
    this.observability.metrics?.p2pActiveConnections.inc({ community_id: communityId });
    return {
      frame_type: "ready",
      protocol_version: P2P_OVERLAY_PROTOCOL_VERSION,
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

    if (sockets.delete(socket)) {
      this.observability.metrics?.p2pActiveConnections.dec({ community_id: communityId });
    }
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

    if (input.redactPriorPayloads) {
      // Mirror the DB-side atomic redact+insert: strip prior post.published /
      // post.updated (or announcement equivalents) payloads for the same
      // aggregate so /sync replay and the in-memory fanout never expose the
      // tombstoned content.
      const redactedPayload = buildRedactedPayloadForAggregate(
        event.aggregate_type,
        event.aggregate_id,
      );
      const redactionTargets: readonly P2PEventType[] =
        event.aggregate_type === "post"
          ? (["post.published", "post.updated"] as const)
          : event.aggregate_type === "announcement"
            ? (["announcement.published", "announcement.updated"] as const)
            : ([] as const);
      for (let i = 0; i < events.length; i += 1) {
        const prior = events[i];
        if (
          prior.aggregate_type === event.aggregate_type &&
          prior.aggregate_id === event.aggregate_id &&
          redactionTargets.includes(prior.event_type)
        ) {
          // The redacted payload is structurally compatible with the
          // post / announcement payload shapes (keeps the aggregate id)
          // but has an extra `redacted: true` marker — cast through
          // unknown because the discriminated-union payload type cannot
          // express that extra field without widening the schema.
          events[i] = { ...prior, payload: redactedPayload } as unknown as P2PEventEnvelope;
        }
      }
      for (let i = 0; i < this.publishedEvents.length; i += 1) {
        const prior = this.publishedEvents[i];
        if (
          prior.community_id === event.community_id &&
          prior.aggregate_type === event.aggregate_type &&
          prior.aggregate_id === event.aggregate_id &&
          redactionTargets.includes(prior.event_type)
        ) {
          this.publishedEvents[i] = {
            ...prior,
            payload: redactedPayload,
          } as unknown as P2PEventEnvelope;
        }
      }
    }

    events.push(event);
    events.sort(compareEventPosition);
    this.eventsByCommunity.set(input.communityId, events);
    this.publishedEvents.push(event);

    this.observability.metrics?.p2pSyncEventsTotal.inc({
      event_type: event.event_type,
      result: 'durable_ok',
    });

    const livePublished = await this.fanout(event);

    return {
      event,
      durablePublished: true,
      livePublished,
    };
  }

  async fanout(event: P2PEventEnvelope): Promise<boolean> {
    const events = this.eventsByCommunity.get(event.community_id) ?? [];
    const alreadyStored = events.some((entry) => entry.sync_event_id === event.sync_event_id);
    if (!alreadyStored) {
      events.push(event);
      events.sort(compareEventPosition);
      this.eventsByCommunity.set(event.community_id, events);
    }

    if (!this.publishedEvents.some((entry) => entry.sync_event_id === event.sync_event_id)) {
      this.publishedEvents.push(event);
    }

    // Observe fanout lag (how far behind the fanout we are relative to the
    // event's logical timestamp). Signals slow DB commits / GC pauses /
    // mis-clocked anchors upstream.
    const occurredAtMs = Date.parse(event.occurred_at);
    if (!Number.isNaN(occurredAtMs)) {
      const lag = Math.max(0, (Date.now() - occurredAtMs) / 1000);
      this.observability.metrics?.p2pSyncLagSeconds.observe(lag);
    }

    const livePublished = broadcastEventToSockets(
      this.connections.get(event.community_id),
      event,
      this.observability,
    );

    this.observability.metrics?.p2pSyncEventsTotal.inc({
      event_type: event.event_type,
      result: alreadyStored ? 'duplicate' : livePublished ? 'fanout_ok' : 'fanout_fail',
    });

    return livePublished;
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
  private observability: SyncRuntimeObservability = {};

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
      } catch (err) {
        // Previously swallowed silently — a corrupted publisher (different
        // envelope version, truncated payload, etc.) would have vanished
        // without a trace. Log with a short snippet and bump the validation
        // counter so we can correlate the spike with the offending node.
        this.observability.logger?.warn(
          { err, channel, payloadSnippet: payload.slice(0, 200) },
          "unparseable p2p payload",
        );
        this.observability.metrics?.p2pSyncErrorsTotal.inc({ op: 'fanout', kind: 'validation' });
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
        safeSend(socket, frame, this.observability);
      }
    });
    this.heartbeatTimer = setInterval(() => {
      const frame: P2PSyncConnectionHeartbeat = {
        frame_type: "heartbeat",
        occurred_at: new Date().toISOString(),
      };
      for (const sockets of this.connections.values()) {
        for (const socket of sockets) {
          safeSend(socket, frame, this.observability);
        }
      }
    }, options.heartbeatIntervalMs ?? 30_000);
    this.heartbeatTimer.unref();
  }

  bindObservability(observability: SyncRuntimeObservability) {
    this.observability = observability;
  }

  async attachConnection(communityId: string, socket: SocketLike): Promise<P2PSyncConnectionReady> {
    await this.ready;
    const sockets = this.connections.get(communityId) ?? new Set<SocketLike>();
    sockets.add(socket);
    this.connections.set(communityId, sockets);
    this.observability.metrics?.p2pActiveConnections.inc({ community_id: communityId });
    return {
      frame_type: "ready",
      protocol_version: P2P_OVERLAY_PROTOCOL_VERSION,
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

    if (sockets.delete(socket)) {
      this.observability.metrics?.p2pActiveConnections.dec({ community_id: communityId });
    }
    if (sockets.size === 0) {
      this.connections.delete(communityId);
    }
  }

  async listEvents(communityId: string, since: string | null, limit: number): Promise<P2PEventEnvelope[]> {
    await this.ready;
    const cursor = parseCursor(since);
    try {
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
    } catch (err) {
      this.observability.metrics?.p2pSyncErrorsTotal.inc({ op: 'list', kind: 'db' });
      this.observability.logger?.error(
        { err, communityId, hasCursor: Boolean(cursor) },
        "p2p listEvents failed",
      );
      throw err;
    }
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
    // TODO(m8.5): wrap in `ON CONFLICT (cid) DO NOTHING RETURNING sync_event_id`
    // once the 0014 migration lands a unique index on
    // `(community_id, cid)`. That turns /sync republish into a no-op rather
    // than a constraint violation, which closes the idempotency gap flagged
    // by P1 finding 5. Deferred to a separate milestone per the round's
    // out-of-scope list — the schema change (PK alter or new unique idx)
    // needs its own migration and backfill plan.
    const insertSql = `
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
      `;
    const insertParams = [
      event.sync_event_id,
      event.community_id,
      event.event_type,
      event.aggregate_type,
      event.aggregate_id,
      event.actor_p2p_id,
      JSON.stringify(event.payload),
      event.cid,
      event.occurred_at,
    ];

    try {
      if (input.redactPriorPayloads) {
        // Atomic: either /sync observes (a) the redacted prior rows AND the
        // tombstone, or (b) neither. A partial commit here would leak
        // plaintext post content between statements.
        await this.database.query("begin");
        try {
          const redactedPayload = buildRedactedPayloadForAggregate(
            event.aggregate_type,
            event.aggregate_id,
          );
          const redactionTargets: readonly P2PEventType[] =
            event.aggregate_type === "post"
              ? (["post.published", "post.updated"] as const)
              : event.aggregate_type === "announcement"
                ? (["announcement.published", "announcement.updated"] as const)
                : ([] as const);
          if (redactionTargets.length > 0) {
            await this.database.query(
              `
                update community_sync_events
                set payload_json = $1::jsonb
                where community_id = $2::uuid
                  and aggregate_type = $3
                  and aggregate_id = $4::uuid
                  and event_type = any($5::text[])
              `,
              [
                JSON.stringify(redactedPayload),
                event.community_id,
                event.aggregate_type,
                event.aggregate_id,
                redactionTargets.slice(),
              ],
            );
          }
          await this.database.query(insertSql, insertParams);
          await this.database.query("commit");
        } catch (error) {
          await this.database.query("rollback");
          throw error;
        }
      } else {
        await this.database.query(insertSql, insertParams);
      }
    } catch (err) {
      this.observability.metrics?.p2pSyncEventsTotal.inc({
        event_type: event.event_type,
        result: 'durable_fail',
      });
      this.observability.metrics?.p2pSyncErrorsTotal.inc({ op: 'publish', kind: 'db' });
      this.observability.logger?.error(
        { err, communityId: event.community_id, eventId: event.sync_event_id },
        "p2p durable publish failed",
      );
      throw err;
    }

    this.observability.metrics?.p2pSyncEventsTotal.inc({
      event_type: event.event_type,
      result: 'durable_ok',
    });

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

    // Observe end-to-end lag at fanout time regardless of publisher outcome:
    // the socket-level fallback is still a fanout attempt from a client's
    // perspective.
    const occurredAtMs = Date.parse(event.occurred_at);
    if (!Number.isNaN(occurredAtMs)) {
      const lag = Math.max(0, (Date.now() - occurredAtMs) / 1000);
      this.observability.metrics?.p2pSyncLagSeconds.observe(lag);
    }

    try {
      await this.publisher.publish(channelForCommunity(event.community_id), serialized);
      this.observability.metrics?.p2pSyncEventsTotal.inc({
        event_type: event.event_type,
        result: 'fanout_ok',
      });
      return true;
    } catch (err) {
      // The publisher is down (Redis outage / network partition). Log the
      // failure, count it, then still try the in-process socket broadcast
      // so locally-connected subscribers don't miss the event. Return the
      // TRUE publisher status — `false` — so upstream `logP2PFanoutResult`
      // can correctly flag "Redis down" instead of masquerading the
      // socket-level success as a durable fanout.
      this.observability.logger?.error(
        { err, communityId: event.community_id, eventId: event.sync_event_id },
        "p2p redis fanout failed; attempting local socket broadcast",
      );
      this.observability.metrics?.p2pSyncErrorsTotal.inc({ op: 'fanout', kind: 'redis' });
      this.observability.metrics?.p2pSyncEventsTotal.inc({
        event_type: event.event_type,
        result: 'fanout_fail',
      });
      broadcastEventToSockets(
        this.connections.get(event.community_id),
        event,
        this.observability,
      );
      return false;
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
