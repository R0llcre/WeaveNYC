import { createHash, randomUUID } from "node:crypto";

import {
  communitySyncEventSchema,
  type AnnouncementSyncEventPayload,
  type CommunitySyncEvent,
  type ModerationDecisionEventPayload,
  type P2PTopicMap,
  type PostSyncEventPayload,
  type ReportCreatedEventPayload,
} from "@weavenyc/shared";

import { canonicalizeJson } from "./canonical.js";

export type P2PTopicKey = keyof P2PTopicMap;

export type CommunitySyncEventQueryable = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    queryText: string,
    values?: unknown[],
  ): Promise<{ rows: T[]; rowCount?: number | null }>;
};

type CreateCommunitySyncEventBase = {
  communityId: string;
  aggregateId: string;
  actorUserId?: string | null;
  actorP2PId?: string | null;
  occurredAt?: string;
  syncEventId?: string;
};

export type CreateCommunitySyncEventInput =
  | (CreateCommunitySyncEventBase & {
      topicKey: "posts";
      eventType: "post.published" | "post.updated" | "post.tombstoned";
      aggregateType: "post";
      payload: PostSyncEventPayload;
    })
  | (CreateCommunitySyncEventBase & {
      topicKey: "announcements";
      eventType: "announcement.published" | "announcement.updated" | "announcement.deleted";
      aggregateType: "announcement";
      payload: AnnouncementSyncEventPayload;
    })
  | (CreateCommunitySyncEventBase & {
      topicKey: "reports";
      eventType: "report.created";
      aggregateType: "report";
      payload: ReportCreatedEventPayload;
    })
  | (CreateCommunitySyncEventBase & {
      topicKey: "reports";
      eventType: "moderation.decision";
      aggregateType: "moderation";
      payload: ModerationDecisionEventPayload;
    });

function createCid(payload: unknown) {
  return createHash("sha256").update(canonicalizeJson(payload)).digest("hex");
}

export function topicsForCommunity(communityId: string): P2PTopicMap {
  return {
    posts: `weavenyc/${communityId}/posts`,
    announcements: `weavenyc/${communityId}/announcements`,
    reports: `weavenyc/${communityId}/reports`,
  };
}

export function deriveActorP2PId(
  communityId: string,
  actorUserId?: string | null,
  actorP2PId?: string | null,
) {
  if (actorP2PId?.trim()) {
    return actorP2PId.trim();
  }

  if (!actorUserId) {
    return null;
  }

  return `actor_${createHash("sha256")
    .update(`${communityId}:${actorUserId}`)
    .digest("hex")
    .slice(0, 24)}`;
}

export function createCommunitySyncEvent(input: CreateCommunitySyncEventInput): CommunitySyncEvent {
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const topic = topicsForCommunity(input.communityId)[input.topicKey];
  return communitySyncEventSchema.parse({
    sync_event_id: input.syncEventId ?? randomUUID(),
    community_id: input.communityId,
    topic,
    event_type: input.eventType,
    aggregate_type: input.aggregateType,
    aggregate_id: input.aggregateId,
    occurred_at: occurredAt,
    cid: createCid({
      community_id: input.communityId,
      topic,
      event_type: input.eventType,
      aggregate_type: input.aggregateType,
      aggregate_id: input.aggregateId,
      occurred_at: occurredAt,
      payload: input.payload,
    }),
    actor_p2p_id: deriveActorP2PId(input.communityId, input.actorUserId, input.actorP2PId),
    payload: input.payload,
    signature: null,
  });
}

export async function appendCommunitySyncEvent(
  queryable: CommunitySyncEventQueryable,
  input: CreateCommunitySyncEventInput,
) {
  const event = createCommunitySyncEvent(input);

  await queryable.query(
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
      ) values ($1::uuid, $2::uuid, $3, $4, $5::uuid, $6::uuid, $7, $8::jsonb, $9, $10::timestamptz)
    `,
    [
      event.sync_event_id,
      event.community_id,
      event.event_type,
      event.aggregate_type,
      event.aggregate_id,
      input.actorUserId ?? null,
      event.actor_p2p_id ?? null,
      JSON.stringify(event.payload),
      event.cid,
      event.occurred_at,
    ],
  );

  return event;
}

export async function appendCommunitySyncEvents(
  queryable: CommunitySyncEventQueryable,
  inputs: CreateCommunitySyncEventInput[],
) {
  const events: CommunitySyncEvent[] = [];
  for (const input of inputs) {
    events.push(await appendCommunitySyncEvent(queryable, input));
  }
  return events;
}
