import { z } from "zod";

import {
  p2pAggregateTypes,
  p2pEventTypes,
  p2pSyncTransports,
} from "../enums";
import { announcementSchema } from "./admin";
import { postSummarySchema } from "./posts";

/**
 * Single-source-of-truth tag for the M6 overlay wire format.
 *
 * Shared between the API gateway (emitted on bootstrap + on the WebSocket
 * `ready` frame + on every `/sync` response) and the PWA worker (compared on
 * receipt). A mismatch means the client + server are speaking incompatible
 * protocol revisions — the worker stops its loop and posts a
 * `protocol_version_mismatch` error rather than silently poisoning caches.
 *
 * Bump this constant only when making a breaking wire change (e.g. a required
 * field added, a discriminator enum widened, etc). When bumped, the value
 * MUST change in lockstep with any supporting schema edits so that old
 * clients fail loudly rather than accept half-compatible payloads.
 */
export const P2P_OVERLAY_PROTOCOL_VERSION = "m6-overlay-v1" as const;

/**
 * Zod schema for the protocol_version literal. Using the constant keeps the
 * literal + the exported value in lockstep — there is no way for the server
 * to emit a stale string while the shared constant advances.
 */
export const p2pProtocolVersionSchema = z.literal(P2P_OVERLAY_PROTOCOL_VERSION);

export const p2pAggregateTypeSchema = z.enum(p2pAggregateTypes);
export const p2pEventTypeSchema = z.enum(p2pEventTypes);
export const p2pSyncTransportSchema = z.enum(p2pSyncTransports);

export const p2pTopicMapSchema = z.object({
  posts: z.string().min(1),
  announcements: z.string().min(1),
  reports: z.string().min(1),
});

export const communityLatestSnapshotSchema = z.object({
  last_event_at: z.string().datetime().nullable(),
  // `event_count` is only populated on the explicit bootstrap path today.
  // The `/sync` hot path can omit it when derivable from the delta's last
  // event, avoiding a `count(*)` scan per request. See P4 finding 3 / B.
  event_count: z.number().int().min(0).optional(),
});

export const communityBootstrapNodeSchema = z.object({
  node_id: z.string().min(1),
  websocket_url: z.string().url(),
  last_published_at: z.string().datetime().nullable().optional(),
});

export const communityBootstrapResponseSchema = z.object({
  community_id: z.string().uuid(),
  protocol_version: p2pProtocolVersionSchema,
  bootstrap_version: z.string().min(1),
  anchor_node: communityBootstrapNodeSchema.nullable(),
  relay_nodes: z.array(communityBootstrapNodeSchema),
  topics: p2pTopicMapSchema,
  latest_snapshot: communityLatestSnapshotSchema,
  mdns_demo_enabled: z.boolean(),
});

export const postSummaryDagSchema = postSummarySchema.extend({
  p2p_version: z.number().int().positive(),
  ipfs_cid: z.string().min(1).nullable(),
});

export const announcementSummaryDagSchema = announcementSchema.extend({
  p2p_version: z.number().int().positive(),
  ipfs_cid: z.string().min(1).nullable(),
});

export const reportCreatedEventPayloadSchema = z.object({
  report_id: z.string().uuid(),
  target_type: z.literal("post"),
  target_id: z.string().uuid(),
  reason: z.string().min(1),
  status: z.enum(["new", "resolved", "dismissed"]),
  created_at: z.string().datetime(),
});

export const moderationDecisionEventPayloadSchema = z.object({
  report_id: z.string().uuid().nullable(),
  target_type: z.literal("post"),
  target_id: z.string().uuid(),
  report_target_type: z.literal("post"),
  report_target_id: z.string().uuid(),
  resolution: z.string().min(1),
  status: z.string().min(1),
  decided_at: z.string().datetime(),
});

export const postSyncEventPayloadSchema = z.object({
  post: postSummaryDagSchema.partial().extend({
    post_id: z.string().uuid(),
  }),
  reason: z.string().min(1).nullable().optional(),
});

export const announcementSyncEventPayloadSchema = z.object({
  announcement: announcementSummaryDagSchema.partial().extend({
    announcement_id: z.string().uuid(),
  }),
});

const p2pEventEnvelopeBaseSchema = z.object({
  sync_event_id: z.string().uuid(),
  community_id: z.string().uuid(),
  topic: z.string().min(1),
  aggregate_id: z.string().uuid(),
  occurred_at: z.string().datetime(),
  actor_p2p_id: z.string().min(1).nullable().optional(),
  cid: z.string().min(1).nullable().optional(),
  signature: z.string().min(1).nullable().optional(),
});

const postPublishedEventEnvelopeSchema = p2pEventEnvelopeBaseSchema.extend({
  event_type: z.literal("post.published"),
  aggregate_type: z.literal("post"),
  payload: postSyncEventPayloadSchema,
});

const postUpdatedEventEnvelopeSchema = p2pEventEnvelopeBaseSchema.extend({
  event_type: z.literal("post.updated"),
  aggregate_type: z.literal("post"),
  payload: postSyncEventPayloadSchema,
});

const postTombstonedEventEnvelopeSchema = p2pEventEnvelopeBaseSchema.extend({
  event_type: z.literal("post.tombstoned"),
  aggregate_type: z.literal("post"),
  payload: postSyncEventPayloadSchema,
});

const announcementPublishedEventEnvelopeSchema = p2pEventEnvelopeBaseSchema.extend({
  event_type: z.literal("announcement.published"),
  aggregate_type: z.literal("announcement"),
  payload: announcementSyncEventPayloadSchema,
});

const announcementUpdatedEventEnvelopeSchema = p2pEventEnvelopeBaseSchema.extend({
  event_type: z.literal("announcement.updated"),
  aggregate_type: z.literal("announcement"),
  payload: announcementSyncEventPayloadSchema,
});

const announcementDeletedEventEnvelopeSchema = p2pEventEnvelopeBaseSchema.extend({
  event_type: z.literal("announcement.deleted"),
  aggregate_type: z.literal("announcement"),
  payload: announcementSyncEventPayloadSchema,
});

const reportCreatedEventEnvelopeSchema = p2pEventEnvelopeBaseSchema.extend({
  event_type: z.literal("report.created"),
  aggregate_type: z.literal("report"),
  payload: reportCreatedEventPayloadSchema,
});

const moderationDecisionEventEnvelopeSchema = p2pEventEnvelopeBaseSchema.extend({
  event_type: z.literal("moderation.decision"),
  aggregate_type: z.literal("moderation"),
  payload: moderationDecisionEventPayloadSchema,
});

export const p2pEventEnvelopeSchema = z.discriminatedUnion("event_type", [
  postPublishedEventEnvelopeSchema,
  postUpdatedEventEnvelopeSchema,
  postTombstonedEventEnvelopeSchema,
  announcementPublishedEventEnvelopeSchema,
  announcementUpdatedEventEnvelopeSchema,
  announcementDeletedEventEnvelopeSchema,
  reportCreatedEventEnvelopeSchema,
  moderationDecisionEventEnvelopeSchema,
]);

export const communitySyncEventSchema = p2pEventEnvelopeSchema;

export const communitySyncDeltaResponseSchema = z.object({
  protocol_version: p2pProtocolVersionSchema,
  events: z.array(communitySyncEventSchema),
  next_since: z.string().min(1).nullable(),
  server_time: z.string().datetime(),
  latest_snapshot: communityLatestSnapshotSchema,
  // `has_more` is the explicit end-of-stream signal the client loops on.
  // Previously we inferred exhaustion from `events.length < limit`, which
  // races the server's cursor semantics (P1 finding 6). Server-side:
  // `has_more = events.length === limit`.
  has_more: z.boolean(),
});

/**
 * WebSocket frames the p2p sync channel emits. The client runs `safeParse`
 * on every inbound frame so a server-side drift fails loudly instead of
 * silently poisoning the cache (P1 finding 2).
 */
export const p2pReadyFrameSchema = z.object({
  frame_type: z.literal("ready"),
  protocol_version: p2pProtocolVersionSchema,
  community_id: z.string().uuid(),
  node_id: z.string().min(1),
  peer_count: z.number().int().min(0),
  latest_snapshot: communityLatestSnapshotSchema,
  topics: p2pTopicMapSchema,
  transport: p2pSyncTransportSchema,
});

export const p2pHeartbeatFrameSchema = z.object({
  frame_type: z.literal("heartbeat"),
  occurred_at: z.string().datetime(),
});

export const p2pEventFrameSchema = z.object({
  frame_type: z.literal("event"),
  event: communitySyncEventSchema,
});

export const p2pSyncFrameSchema = z.discriminatedUnion("frame_type", [
  p2pReadyFrameSchema,
  p2pHeartbeatFrameSchema,
  p2pEventFrameSchema,
]);

export const p2pSyncStatusSchema = z.object({
  enabled: z.boolean(),
  transport: p2pSyncTransportSchema.nullable(),
  peer_count: z.number().int().min(0),
  last_synced_at: z.string().datetime().nullable(),
  latest_sync_event_id: z.string().uuid().nullable(),
});
