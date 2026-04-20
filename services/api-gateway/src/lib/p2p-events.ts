import type { FastifyInstance } from "fastify";
import type {
  AnnouncementSyncEventPayload,
  CommunitySyncEvent,
  ModerationDecisionEventPayload,
  PostSyncEventPayload,
  ReportCreatedEventPayload,
} from "@weavenyc/shared";

import type { P2PEventType, P2PPublishResult } from "./sync-runtime.js";

type PostLike = PostSyncEventPayload["post"] & {
  community_id: string;
  created_at?: string;
  updated_at: string;
};

type AnnouncementLike = AnnouncementSyncEventPayload["announcement"] & {
  community_id: string;
};

function logP2PPublishResult(app: FastifyInstance, result: P2PPublishResult, context: Record<string, unknown>) {
  if (!result.durablePublished) {
    app.log.error(
      { ...context, eventType: result.event.event_type, syncEventId: result.event.sync_event_id },
      "Unable to durably append sync event",
    );
    return;
  }

  if (!result.livePublished) {
    app.log.warn(
      { ...context, eventType: result.event.event_type, syncEventId: result.event.sync_event_id },
      "Durable sync event was appended but live publish failed",
    );
  }
}

function logP2PFanoutResult(app: FastifyInstance, event: CommunitySyncEvent, livePublished: boolean, context: Record<string, unknown>) {
  if (livePublished) {
    return;
  }

  app.log.warn(
    { ...context, eventType: event.event_type, syncEventId: event.sync_event_id },
    "Durable sync event was appended but live publish failed",
  );
}

export async function fanoutSyncEvents(
  app: FastifyInstance,
  events: CommunitySyncEvent[] | undefined,
  context: Record<string, unknown>,
) {
  // Per-event try/catch: a single bad event (e.g. socket hung up, subscriber
  // throws during local broadcast) must NOT short-circuit the loop and
  // starve the remaining events. We log + increment the error counter and
  // keep going — the durable row has already been committed, so the client
  // will still pick it up on the next /sync catch-up.
  for (const event of events ?? []) {
    try {
      const livePublished = await app.syncRuntime.fanout(event);
      logP2PFanoutResult(app, event, livePublished, context);
    } catch (err) {
      app.log.error(
        { ...context, err, eventType: event.event_type, syncEventId: event.sync_event_id },
        "Failed to fanout sync event; continuing with remaining events",
      );
      app.metrics?.p2pSyncErrorsTotal?.inc({ op: "fanout", kind: "runtime" });
    }
  }
}

export async function publishPostEvent(
  app: FastifyInstance,
  input: {
    eventType: Extract<P2PEventType, "post.published" | "post.updated" | "post.tombstoned">;
    post: PostLike;
    actorUserId?: string | null;
    reason?: string;
  },
) {
  // post.tombstoned must atomically redact any prior post.published /
  // post.updated rows for the same aggregate so readers cannot replay the
  // tombstoned content via /sync.
  const redactPriorPayloads = input.eventType === "post.tombstoned";
  const result = await app.syncRuntime.publish({
    communityId: input.post.community_id,
    topicKey: "posts",
    eventType: input.eventType,
    aggregateType: "post",
    aggregateId: input.post.post_id,
    actorUserId: input.actorUserId ?? null,
    payload: {
      post: input.post,
      reason: input.reason ?? null,
    } satisfies PostSyncEventPayload,
    occurredAt: input.post.updated_at ?? input.post.created_at,
    redactPriorPayloads,
  });
  logP2PPublishResult(app, result, { postId: input.post.post_id });
  return result;
}

export async function publishAnnouncementEvent(
  app: FastifyInstance,
  input: {
    eventType: Extract<P2PEventType, "announcement.published" | "announcement.updated" | "announcement.deleted">;
    announcement: AnnouncementLike;
    actorUserId?: string | null;
  },
) {
  // announcement.deleted follows the same post.tombstoned redaction pattern.
  const redactPriorPayloads = input.eventType === "announcement.deleted";
  const result = await app.syncRuntime.publish({
    communityId: input.announcement.community_id,
    topicKey: "announcements",
    eventType: input.eventType,
    aggregateType: "announcement",
    aggregateId: input.announcement.announcement_id,
    actorUserId: input.actorUserId ?? null,
    payload: {
      announcement: input.announcement,
    } satisfies AnnouncementSyncEventPayload,
    occurredAt: input.announcement.updated_at ?? input.announcement.published_at,
    redactPriorPayloads,
  });
  logP2PPublishResult(app, result, { announcementId: input.announcement.announcement_id });
  return result;
}

export async function publishReportCreatedEvent(
  app: FastifyInstance,
  input: {
    communityId: string;
    actorUserId?: string | null;
    report: {
      report_id: string;
      target_type: string;
      target_id: string;
      reason: string;
      status: ReportCreatedEventPayload["status"];
      created_at: string;
      conversation_id?: string | null;
      detail_text?: string | null;
    };
  },
) {
  if (input.report.target_type !== "post") {
    return null;
  }

  const result = await app.syncRuntime.publish({
    communityId: input.communityId,
    topicKey: "reports",
    eventType: "report.created",
    aggregateType: "report",
    aggregateId: input.report.report_id,
    actorUserId: input.actorUserId ?? null,
    payload: {
      report_id: input.report.report_id,
      target_type: "post",
      target_id: input.report.target_id,
      reason: input.report.reason,
      status: input.report.status,
      created_at: input.report.created_at,
    } satisfies ReportCreatedEventPayload,
    occurredAt: input.report.created_at,
  });
  logP2PPublishResult(app, result, { reportId: input.report.report_id });
  return result;
}

export async function publishModerationDecisionEvent(
  app: FastifyInstance,
  input: {
    communityId: string;
    aggregateId: string;
    actorUserId?: string | null;
    reportId: string;
    targetType: string;
    targetId: string;
    reportTargetType?: string;
    reportTargetId?: string;
    resolution: string;
    status: string;
    decidedAt: string;
    affectedUserId?: string | null;
    conversationId?: string | null;
  },
) {
  const reportTargetType = input.reportTargetType ?? input.targetType;
  const reportTargetId = input.reportTargetId ?? input.targetId;
  if (reportTargetType !== "post") {
    return null;
  }

  const result = await app.syncRuntime.publish({
    communityId: input.communityId,
    topicKey: "reports",
    eventType: "moderation.decision",
    aggregateType: "moderation",
    aggregateId: input.aggregateId,
    actorUserId: input.actorUserId ?? null,
    payload: {
      report_id: input.reportId,
      target_type: "post",
      target_id: reportTargetId,
      report_target_type: "post",
      report_target_id: reportTargetId,
      resolution: input.resolution,
      status: input.status,
      decided_at: input.decidedAt,
    } satisfies ModerationDecisionEventPayload,
    occurredAt: input.decidedAt,
  });
  logP2PPublishResult(app, result, { reportId: input.reportId, targetType: reportTargetType });
  return result;
}
