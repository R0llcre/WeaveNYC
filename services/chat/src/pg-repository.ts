import { randomUUID } from "node:crypto";

import type { AdminReportQueueItem } from "@weavenyc/shared";
import { appendCommunitySyncEvent } from "@weavenyc/p2p";

import { encodeConversationCursor, encodeMessageCursor } from "./repository.js";
import { ChatServiceError } from "./types.js";
import type {
  BlockRecord,
  ChatMessage,
  ChatReportReason,
  ChatReportTargetType,
  ChatRepository,
  ConversationRecord,
  ConversationStatus,
  CursorPage,
  ReportRecord,
} from "./types.js";

type QueryResultRow = Record<string, unknown>;

type PoolLike = {
  query<T extends QueryResultRow = QueryResultRow>(
    queryText: string,
    values?: unknown[],
  ): Promise<{ rows: T[]; rowCount?: number | null }>;
  connect?(): Promise<TransactionClientLike>;
  end?(): Promise<void>;
};

type TransactionClientLike = {
  query<T extends QueryResultRow = QueryResultRow>(
    queryText: string,
    values?: unknown[],
  ): Promise<{ rows: T[]; rowCount?: number | null }>;
  release?(): void;
};

type ConversationRow = {
  conversation_id: string;
  contact_request_id: string;
  related_post_ids: string[] | null;
  created_at: string;
  last_activity_at: string;
  status: ConversationStatus | null;
  closed_at: string | null;
  blocked_at: string | null;
  blocked_by_user_id: string | null;
  requester_user_id: string;
  requester_alias: string | null;
  recipient_user_id: string;
  recipient_alias: string | null;
  last_message_preview: string | null;
  last_message_at: string | null;
  unread_count: string | number | null;
};

type MessageRow = {
  message_id: string;
  conversation_id: string;
  sender_user_id: string;
  body: string;
  safety_flags: string[] | null;
  sent_at: string;
  client_message_id?: string | null;
};

type BlockRow = {
  block_id: string;
  blocker_user_id: string;
  blocked_user_id: string;
  conversation_id: string | null;
  created_at: string;
};

type ReportRow = {
  report_id: string;
  community_id: string;
  target_type: ChatReportTargetType;
  target_id: string;
  reason: ChatReportReason;
  detail_text: string | null;
  conversation_id: string | null;
  reporter_user_id: string;
  status: "new" | "resolved" | "dismissed";
  resolution: "remove_post" | "suspend_user" | "warn" | "none" | null;
  created_at: Date | string;
  resolved_at: Date | string | null;
};

type ReportQueueRow = ReportRow & {
  reporter_alias: string | null;
  priority: "P0" | "P1" | "P2";
  target_title: string | null;
  body_preview: string | null;
  related_user_id: string | null;
};

function mapConversation(row: ConversationRow): ConversationRecord {
  return {
    conversation_id: row.conversation_id,
    contact_request_id: row.contact_request_id,
    participant_user_ids: [row.requester_user_id, row.recipient_user_id],
    participant_preview: [
      {
        user_id: row.requester_user_id,
        alias: row.requester_alias ?? "Neighbor",
      },
      {
        user_id: row.recipient_user_id,
        alias: row.recipient_alias ?? "Neighbor",
      },
    ],
    related_post_ids: row.related_post_ids ?? [],
    status: row.status ?? "active",
    created_at: row.created_at,
    last_activity_at: row.last_activity_at,
    closed_at: row.closed_at,
    blocked_at: row.blocked_at,
    blocked_by_user_id: row.blocked_by_user_id,
    last_message_preview: row.last_message_preview,
    last_message_at: row.last_message_at,
    unread_count: Number(row.unread_count ?? 0),
  };
}

function mapMessage(row: MessageRow): ChatMessage {
  return {
    message_id: row.message_id,
    conversation_id: row.conversation_id,
    sender_user_id: row.sender_user_id,
    body: row.body,
    safety_flags: (row.safety_flags ?? []) as ChatMessage["safety_flags"],
    sent_at: row.sent_at,
  };
}

function mapBlock(row: BlockRow): BlockRecord {
  return {
    block_id: row.block_id,
    blocker_user_id: row.blocker_user_id,
    blocked_user_id: row.blocked_user_id,
    conversation_id: row.conversation_id,
    created_at: row.created_at,
  };
}

function toIsoTimestamp(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapReport(row: ReportRow): ReportRecord {
  return {
    report_id: row.report_id,
    community_id: row.community_id,
    target_type: row.target_type,
    target_id: row.target_id,
    reason: row.reason,
    detail_text: row.detail_text,
    conversation_id: row.conversation_id,
    reporter_user_id: row.reporter_user_id,
    status: row.status,
    resolution: row.resolution,
    created_at: toIsoTimestamp(row.created_at),
    resolved_at: row.resolved_at ? toIsoTimestamp(row.resolved_at) : null,
  };
}

function encodeReportCursor(row: { created_at: Date | string; report_id: string }) {
  return Buffer.from(
    JSON.stringify({
      createdAt: toIsoTimestamp(row.created_at),
      reportId: row.report_id,
    }),
    "utf8",
  ).toString("base64url");
}

function decodeReportCursor(cursor: string | null | undefined) {
  if (!cursor) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      createdAt?: string;
      reportId?: string;
    };
    if (!parsed.createdAt || !parsed.reportId) {
      throw new Error("invalid");
    }
    return parsed;
  } catch {
    throw new Error("Report cursor is not valid");
  }
}

function mapReportQueueItem(row: ReportQueueRow): AdminReportQueueItem {
  return {
    report_id: row.report_id,
    community_id: row.community_id,
    target_type: row.target_type,
    target_id: row.target_id,
    reason: row.reason,
    status: row.status,
    created_at: toIsoTimestamp(row.created_at),
    reporter_user_id: row.reporter_user_id,
    reporter_alias: row.reporter_alias ?? "Neighbor",
    priority: row.priority,
    conversation_id: row.conversation_id,
    target_summary: {
      title: row.target_title ?? "Untitled report target",
      body_preview: row.body_preview,
      related_user_id: row.related_user_id,
    },
    evidence_description: row.detail_text,
  };
}

export class PgChatRepository implements ChatRepository {
  constructor(private readonly pool: PoolLike) {}

  private async withTransaction<T>(operation: (client: TransactionClientLike) => Promise<T>) {
    if (!this.pool.connect) {
      return operation(this.pool);
    }

    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const result = await operation(client);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release?.();
    }
  }

  async close() {
    if ("end" in this.pool && typeof this.pool.end === "function") {
      await this.pool.end();
    }
  }

  async listConversationsPage(input: {
    userId: string;
    cursor: string | null;
    limit: number;
  }): Promise<CursorPage<ConversationRecord>> {
    const cursorValues = input.cursor
      ? JSON.parse(Buffer.from(input.cursor, "base64url").toString("utf8")) as {
          lastActivityAt: string;
          conversationId: string;
        }
      : null;
    const params = [input.userId, input.limit + 1];
    let cursorClause = "";
    if (cursorValues) {
      params.push(cursorValues.lastActivityAt, cursorValues.conversationId);
      cursorClause = `
        and (
          c.last_activity_at < $3::timestamptz
          or (c.last_activity_at = $3::timestamptz and c.conversation_id < $4::uuid)
        )
      `;
    }

    const result = await this.pool.query<ConversationRow>(
      `
        select
          c.conversation_id,
          c.contact_request_id,
          c.related_post_ids,
          c.created_at,
          c.last_activity_at,
          c.status,
          c.closed_at,
          c.blocked_at,
          c.blocked_by_user_id,
          cr.requester_user_id,
          requester.display_name as requester_alias,
          cr.recipient_user_id,
          recipient.display_name as recipient_alias,
          last_message.body as last_message_preview,
          last_message.sent_at as last_message_at,
          coalesce(unread.unread_count, 0) as unread_count
        from conversations c
        join contact_requests cr on cr.contact_request_id = c.contact_request_id
        join users requester on requester.user_id = cr.requester_user_id
        join users recipient on recipient.user_id = cr.recipient_user_id
        left join conversation_reads conversation_read
          on conversation_read.conversation_id = c.conversation_id
         and conversation_read.user_id = $1
        left join lateral (
          select m.body, m.sent_at
          from messages m
          where m.conversation_id = c.conversation_id
          order by m.sent_at desc, m.message_id desc
          limit 1
        ) as last_message on true
        left join lateral (
          select count(*)::int as unread_count
          from messages m
          where m.conversation_id = c.conversation_id
            and m.sender_user_id <> $1
            and (
              conversation_read.last_read_at is null
              or m.sent_at > conversation_read.last_read_at
              or (
                m.sent_at = conversation_read.last_read_at
                and m.message_id <> conversation_read.last_read_message_id
              )
            )
        ) as unread on true
        where $1 = any(c.participants)
        ${cursorClause}
        order by c.last_activity_at desc, c.conversation_id desc
        limit $2
      `,
      params,
    );

    const items = result.rows.slice(0, input.limit).map(mapConversation);
    const next = result.rows.length > input.limit ? items[items.length - 1] : undefined;
    return {
      items,
      nextCursor: next ? encodeConversationCursor(next) : null,
    };
  }

  async getConversation(conversationId: string, userId?: string | null) {
    const result = await this.pool.query<ConversationRow>(
      `
        select
          c.conversation_id,
          c.contact_request_id,
          c.related_post_ids,
          c.created_at,
          c.last_activity_at,
          c.status,
          c.closed_at,
          c.blocked_at,
          c.blocked_by_user_id,
          cr.requester_user_id,
          requester.display_name as requester_alias,
          cr.recipient_user_id,
          recipient.display_name as recipient_alias,
          last_message.body as last_message_preview,
          last_message.sent_at as last_message_at,
          coalesce(unread.unread_count, 0) as unread_count
        from conversations c
        join contact_requests cr on cr.contact_request_id = c.contact_request_id
        join users requester on requester.user_id = cr.requester_user_id
        join users recipient on recipient.user_id = cr.recipient_user_id
        left join conversation_reads conversation_read
          on conversation_read.conversation_id = c.conversation_id
         and conversation_read.user_id = $2::uuid
        left join lateral (
          select m.body, m.sent_at
          from messages m
          where m.conversation_id = c.conversation_id
          order by m.sent_at desc, m.message_id desc
          limit 1
        ) as last_message on true
        left join lateral (
          select count(*)::int as unread_count
          from messages m
          where $2::uuid is not null
            and m.conversation_id = c.conversation_id
            and m.sender_user_id <> $2::uuid
            and (
              conversation_read.last_read_at is null
              or m.sent_at > conversation_read.last_read_at
              or (
                m.sent_at = conversation_read.last_read_at
                and m.message_id <> conversation_read.last_read_message_id
              )
            )
        ) as unread on true
        where c.conversation_id = $1
        limit 1
      `,
      [conversationId, userId ?? null],
    );

    const row = result.rows[0];
    return row ? mapConversation(row) : null;
  }

  async listMessagesPage(input: {
    conversationId: string;
    cursor: string | null;
    limit: number;
  }): Promise<CursorPage<ChatMessage>> {
    const cursorValues = input.cursor
      ? JSON.parse(Buffer.from(input.cursor, "base64url").toString("utf8")) as {
          sentAt: string;
          messageId: string;
        }
      : null;
    const params = [input.conversationId, input.limit + 1];
    let cursorClause = "";
    if (cursorValues) {
      params.push(cursorValues.sentAt, cursorValues.messageId);
      cursorClause = `
        and (
          sent_at < $3::timestamptz
          or (sent_at = $3::timestamptz and message_id < $4::uuid)
        )
      `;
    }

    const result = await this.pool.query<MessageRow>(
      `
        select message_id, conversation_id, sender_user_id, body, safety_flags, sent_at
        from messages
        where conversation_id = $1
        ${cursorClause}
        order by sent_at desc, message_id desc
        limit $2
      `,
      params,
    );

    const items = result.rows.slice(0, input.limit).map(mapMessage);
    const next = result.rows.length > input.limit ? items[items.length - 1] : undefined;
    return {
      items,
      nextCursor: next ? encodeMessageCursor(next) : null,
    };
  }

  async countRecentMessagesByUser(userId: string, sinceIso: string) {
    const result = await this.pool.query<{ count: string }>(
      `
        select count(*)::text as count
        from messages
        where sender_user_id = $1
          and sent_at >= $2::timestamptz
      `,
      [userId, sinceIso],
    );

    return Number(result.rows[0]?.count ?? 0);
  }

  async saveMessage(input: {
    conversationId: string;
    senderUserId: string;
    body: string;
    safetyFlags: ChatMessage["safety_flags"];
    sentAt: string;
    clientMessageId?: string;
  }): Promise<ChatMessage> {
    // Atomic check-and-insert (F1-γ) + client-id idempotency (F1-β).
    //
    // 1. The WHERE EXISTS predicate resolves conversation status AND the
    //    blocks table in the same snapshot as the INSERT. Closes the TOCTOU
    //    window between getConversation/findBlockBetweenUsers and the write:
    //    a block landing mid-flight forces the INSERT to return 0 rows, and
    //    service raises conversation_blocked without emitting any fanout.
    //
    // 2. When `client_message_id` is provided and a row with the same
    //    (sender_user_id, client_message_id) already exists, the partial
    //    unique index `uq_messages_client_dedup` trips ON CONFLICT — we
    //    re-read the original row and return it. This gives repository-level
    //    idempotency even when the HTTP `Idempotency-Key` cache has been
    //    purged.
    //
    // The ON CONFLICT path runs inside the same predicate-gated INSERT, so
    // a dedup'd retry still respects the block/closed state: if a peer
    // blocked after the original insert committed, we'll still surface the
    // original persisted row (the block doesn't retroactively invalidate
    // it). If the predicate fails on the retry, we fall into the diagnostic
    // branch below just like a fresh send.
    return this.withTransaction(async (client) => {
      const insertResult = await client.query<MessageRow>(
        `
          insert into messages (
            conversation_id,
            sender_user_id,
            body,
            safety_flags,
            client_message_id,
            sent_at
          )
          select $1::uuid, $2::uuid, $3, $4::text[], $6, $5::timestamptz
          where exists (
            select 1 from conversations c
            where c.conversation_id = $1::uuid
              and c.status = 'active'
              and $2::uuid = any(c.participants)
              and not exists (
                select 1 from blocks b
                where (
                  (b.blocker_user_id = any(c.participants)
                    and b.blocked_user_id = any(c.participants))
                )
              )
          )
          on conflict (sender_user_id, client_message_id)
            where client_message_id is not null
            do update set client_message_id = excluded.client_message_id
          returning message_id, conversation_id, sender_user_id, body, safety_flags, client_message_id, sent_at
        `,
        [
          input.conversationId,
          input.senderUserId,
          input.body,
          input.safetyFlags,
          input.sentAt,
          input.clientMessageId ?? null,
        ],
      );

      if (insertResult.rows.length === 0) {
        // Diagnose why the predicate failed. Re-read the conversation to pick
        // the specific error code (conversation_closed vs conversation_blocked
        // vs not_found). Doing this INSIDE the same transaction ensures the
        // diagnostic SELECT sees the state that caused the insert to reject.
        const diag = await client.query<{
          status: string;
          participants_include_sender: boolean;
          has_active_block: boolean;
        }>(
          `
            select
              c.status,
              $2::uuid = any(c.participants) as participants_include_sender,
              exists (
                select 1 from blocks b
                where b.blocker_user_id = any(c.participants)
                  and b.blocked_user_id = any(c.participants)
              ) as has_active_block
            from conversations c
            where c.conversation_id = $1::uuid
            limit 1
          `,
          [input.conversationId, input.senderUserId],
        );

        const row = diag.rows[0];
        if (!row) {
          throw new ChatServiceError("Conversation not found", "not_found");
        }
        if (!row.participants_include_sender) {
          throw new ChatServiceError("Conversation is not available to this user", "forbidden");
        }
        if (row.has_active_block) {
          throw new ChatServiceError("Conversation is blocked", "conversation_blocked");
        }
        if (row.status !== "active") {
          throw new ChatServiceError(
            row.status === "blocked" ? "Conversation is blocked" : "Conversation is closed",
            row.status === "blocked" ? "conversation_blocked" : "conversation_closed",
          );
        }
        // Unreachable in steady state: the INSERT predicate would have matched.
        throw new ChatServiceError("Message could not be persisted", "internal_error");
      }

      // The INSERT succeeded — by construction the conversation was active, the
      // sender was a participant, and no block existed at commit time. Realtime
      // fanout invoked by the caller after this returns is therefore safe: the
      // block state seen by the atomic predicate is the state the transaction
      // will commit with.
      await client.query(
        `
          update conversations
          set last_activity_at = $2::timestamptz
          where conversation_id = $1
        `,
        [input.conversationId, input.sentAt],
      );

      return mapMessage(insertResult.rows[0]!);
    });
  }

  async findMessageByClientId(input: {
    senderUserId: string;
    clientMessageId: string;
  }): Promise<ChatMessage | null> {
    const result = await this.pool.query<MessageRow>(
      `
        select message_id, conversation_id, sender_user_id, body, safety_flags, client_message_id, sent_at
        from messages
        where sender_user_id = $1
          and client_message_id = $2
        limit 1
      `,
      [input.senderUserId, input.clientMessageId],
    );

    const row = result.rows[0];
    return row ? mapMessage(row) : null;
  }

  async markConversationRead(input: {
    conversationId: string;
    userId: string;
    messageId: string;
    readAt: string;
  }) {
    await this.pool.query(
      `
        insert into conversation_reads (
          conversation_id,
          user_id,
          last_read_message_id,
          last_read_at
        )
        values ($1, $2, $3, $4::timestamptz)
        on conflict (conversation_id, user_id) do update
        set last_read_message_id = excluded.last_read_message_id,
            last_read_at = excluded.last_read_at
        where conversation_reads.last_read_at is null
           or excluded.last_read_at >= conversation_reads.last_read_at
      `,
      [input.conversationId, input.userId, input.messageId, input.readAt],
    );
  }

  async updateConversationState(input: {
    conversationId: string;
    status: ConversationStatus;
    changedAt: string;
    blockedByUserId?: string | null;
  }) {
    const result = await this.pool.query(
      `
        update conversations
        set status = $2::conversation_status,
            closed_at = case when $2::conversation_status = 'closed' then $3::timestamptz else closed_at end,
            blocked_at = case when $2::conversation_status = 'blocked' then $3::timestamptz else blocked_at end,
            blocked_by_user_id = case when $2::conversation_status = 'blocked' then $4::uuid else null end,
            last_activity_at = $3::timestamptz
        where conversation_id = $1
        returning conversation_id
      `,
      [input.conversationId, input.status, input.changedAt, input.blockedByUserId ?? null],
    );

    if (result.rowCount === 0) {
      throw new Error("Conversation not found");
    }

    const conversation = await this.getConversation(input.conversationId, input.blockedByUserId ?? null);
    if (!conversation) {
      throw new Error("Conversation not found");
    }
    return conversation;
  }

  async findBlockBetweenUsers(userA: string, userB: string) {
    const result = await this.pool.query<BlockRow>(
      `
        select block_id, blocker_user_id, blocked_user_id, conversation_id, created_at
        from blocks
        where (blocker_user_id = $1 and blocked_user_id = $2)
           or (blocker_user_id = $2 and blocked_user_id = $1)
        order by created_at desc
        limit 1
      `,
      [userA, userB],
    );

    const row = result.rows[0];
    return row ? mapBlock(row) : null;
  }

  async saveBlock(input: {
    blockerUserId: string;
    blockedUserId: string;
    conversationId: string | null;
    createdAt: string;
  }) {
    try {
      const result = await this.pool.query<BlockRow>(
        `
          insert into blocks (
            blocker_user_id,
            blocked_user_id,
            conversation_id,
            created_at
          )
          values ($1, $2, $3, $4::timestamptz)
          returning block_id, blocker_user_id, blocked_user_id, conversation_id, created_at
        `,
        [input.blockerUserId, input.blockedUserId, input.conversationId, input.createdAt],
      );
      return mapBlock(result.rows[0]!);
    } catch (error) {
      const pgError = error as { code?: string; constraint?: string };
      if (pgError.code === "23505" && pgError.constraint === "uq_blocks_pair") {
        const existing = await this.findBlockBetweenUsers(input.blockerUserId, input.blockedUserId);
        if (existing) {
          return existing;
        }
      }
      throw error;
    }
  }

  async saveReport(input: {
    communityId: string;
    targetType: ChatReportTargetType;
    targetId: string;
    reason: ChatReportReason;
    detailText: string | null;
    conversationId: string | null;
    reporterUserId: string;
    createdAt: string;
  }) {
    return this.withTransaction(async (client) => {
      // `uq_reports_reporter_target_active` (migration 0014) prevents the
      // same user from stacking multiple 'new' reports against the same
      // target. On conflict we return the existing row instead of erroring:
      // from the reporter's perspective the action was already recorded, so
      // re-submitting should be a no-op rather than a 4xx surprise.
      const insertResult = await client.query<ReportRow>(
        `
          insert into reports (
            community_id,
            target_type,
            target_id,
            reason,
            detail_text,
            conversation_id,
            reporter_user_id,
            status,
            resolution,
            created_at
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz)
          on conflict (target_type, target_id, reporter_user_id)
            where status = 'new'
            do nothing
          returning
            report_id,
            community_id,
            target_type,
            target_id,
            reason,
            detail_text,
            conversation_id,
            reporter_user_id,
            status,
            resolution,
            created_at,
            resolved_at
        `,
        [
          input.communityId,
          input.targetType,
          input.targetId,
          input.reason,
          input.detailText,
          input.conversationId,
          input.reporterUserId,
          "new",
          null,
          input.createdAt,
        ],
      );
      let result = insertResult;
      if ((result.rowCount ?? result.rows.length) === 0) {
        // Conflict: the same reporter already has an open 'new' report for
        // this target. Return the existing row so the caller's flow
        // (autoHidePostIfThresholdReached + sync events) stays consistent.
        result = await client.query<ReportRow>(
          `
            select
              report_id,
              community_id,
              target_type,
              target_id,
              reason,
              detail_text,
              conversation_id,
              reporter_user_id,
              status,
              resolution,
              created_at,
              resolved_at
            from reports
            where target_type = $1
              and target_id = $2
              and reporter_user_id = $3
              and status = 'new'
            limit 1
          `,
          [input.targetType, input.targetId, input.reporterUserId],
        );
      }
      const report = mapReport(result.rows[0]!);
      const syncEvents =
        report.target_type === "post"
          ? [
              await appendCommunitySyncEvent(client, {
                communityId: report.community_id,
                topicKey: "reports",
                eventType: "report.created",
                aggregateType: "report",
                aggregateId: report.report_id,
                actorUserId: report.reporter_user_id,
                occurredAt: report.created_at,
                payload: {
                  report_id: report.report_id,
                  target_type: "post",
                  target_id: report.target_id,
                  reason: report.reason,
                  status: report.status,
                  created_at: report.created_at,
                },
              }),
            ]
          : [];

      return {
        report,
        syncEvents,
      };
    });
  }

  async listReportQueuePage(input: {
    communityId: string;
    status?: "new" | "resolved" | "dismissed";
    cursor: string | null;
    limit: number;
  }): Promise<CursorPage<AdminReportQueueItem>> {
    const cursor = decodeReportCursor(input.cursor);
    const params: unknown[] = [input.communityId];
    const conditions = ["r.community_id = $1"];

    if (input.status) {
      params.push(input.status);
      conditions.push(`r.status = $${params.length}`);
    } else {
      conditions.push(`r.status = 'new'`);
    }

    if (cursor) {
      params.push(cursor.createdAt, cursor.reportId);
      conditions.push(`(r.created_at, r.report_id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`);
    }

    params.push(input.limit + 1);
    const result = await this.pool.query<ReportQueueRow>(
      `
        select
          r.report_id,
          r.community_id,
          r.target_type,
          r.target_id,
          r.reason,
          r.detail_text,
          r.conversation_id,
          r.reporter_user_id,
          r.status,
          r.resolution,
          r.created_at,
          r.resolved_at,
          reporter.display_name as reporter_alias,
          case
            when r.reason in ('unsafe_behavior', 'scam', 'harassment') then 'P0'
            when r.reason = 'misinformation' then 'P1'
            else 'P2'
          end as priority,
          case
            when r.target_type = 'post' then p.title
            when r.target_type = 'user' then coalesce(target_user.display_name, 'User')
            when r.target_type = 'message' then 'Message report'
            else null
          end as target_title,
          case
            when r.target_type = 'post' then left(p.body, 280)
            when r.target_type = 'message' then left(m.body, 280)
            else null
          end as body_preview,
          case
            when r.target_type = 'post' then p.created_by
            when r.target_type = 'user' then target_user.user_id
            when r.target_type = 'message' then m.sender_user_id
            else null
          end as related_user_id
        from reports r
        join users reporter
          on reporter.user_id = r.reporter_user_id
        left join posts p
          on r.target_type = 'post'
         and p.post_id = r.target_id
        left join users target_user
          on r.target_type = 'user'
         and target_user.user_id = r.target_id
        left join messages m
          on r.target_type = 'message'
         and m.message_id = r.target_id
        where ${conditions.join(" and ")}
        order by r.created_at desc, r.report_id desc
        limit $${params.length}
      `,
      params,
    );

    const rows = result.rows;
    const next = rows.length > input.limit ? rows.pop() ?? null : null;
    return {
      items: rows.map(mapReportQueueItem),
      nextCursor: next ? encodeReportCursor(next) : null,
    };
  }

  async decideReport(input: {
    communityId: string;
    reportId: string;
    decision: "dismiss" | "warn" | "remove_post" | "suspend_user";
    notes: string | null;
    anchorUserId: string;
    decidedAt: string;
  }): Promise<import("./types.js").ReportDecisionResult | null> {
    return this.withTransaction(async (client) => {
      const target = await client.query<ReportQueueRow>(
        `
          select
            r.report_id,
            r.community_id,
            r.target_type,
            r.target_id,
            r.reason,
            r.detail_text,
            r.conversation_id,
            r.reporter_user_id,
            r.status,
            r.resolution,
            r.created_at,
            r.resolved_at,
            reporter.display_name as reporter_alias,
            case
              when r.reason in ('unsafe_behavior', 'scam', 'harassment') then 'P0'
              when r.reason = 'misinformation' then 'P1'
              else 'P2'
            end as priority,
            case
              when r.target_type = 'post' then p.title
              when r.target_type = 'user' then coalesce(target_user.display_name, 'User')
              when r.target_type = 'message' then 'Message report'
              else null
            end as target_title,
            case
              when r.target_type = 'post' then left(p.body, 280)
              when r.target_type = 'message' then left(m.body, 280)
              else null
            end as body_preview,
            case
              when r.target_type = 'post' then p.created_by
              when r.target_type = 'user' then target_user.user_id
              when r.target_type = 'message' then m.sender_user_id
              else null
            end as related_user_id
          from reports r
          join users reporter on reporter.user_id = r.reporter_user_id
          left join posts p on r.target_type = 'post' and p.post_id = r.target_id
          left join users target_user on r.target_type = 'user' and target_user.user_id = r.target_id
          left join messages m on r.target_type = 'message' and m.message_id = r.target_id
          where r.community_id = $1
            and r.report_id = $2
          limit 1
          for update of r
        `,
        [input.communityId, input.reportId],
      );

    const report = target.rows[0];
    if (!report) {
      return null;
    }

    if (report.status === "resolved" || report.status === "dismissed") {
      return {
        report_id: report.report_id,
        status: report.status,
        resolution: report.resolution ?? "none",
        decided_at: toIsoTimestamp(report.resolved_at ?? report.created_at),
        communityId: report.community_id,
        targetType: report.target_type,
        targetId: report.target_id,
        moderationTargetType: report.target_type,
        moderationTargetId: report.target_id,
        reportTargetType: report.target_type,
        reportTargetId: report.target_id,
        conversationId: report.conversation_id,
        moderationActionId: null,
        syncEvents: [],
      };
    }

      if (input.decision === "remove_post" && report.target_type !== "post") {
        throw new ChatServiceError("remove_post is only valid for post reports", "invalid_input");
      }

      const nextStatus: "dismissed" | "resolved" = input.decision === "dismiss" ? "dismissed" : "resolved";
      const resolution: "none" | "warn" | "remove_post" | "suspend_user" =
        input.decision === "dismiss" ? "none" : input.decision;
      const moderationTargetType =
        input.decision === "suspend_user" ? "user" : report.target_type;
      const moderationTargetId =
        input.decision === "suspend_user" ? report.related_user_id ?? report.target_id : report.target_id;
      const affectedUserId = input.decision === "suspend_user" ? moderationTargetId : null;

      if (input.decision === "remove_post") {
        await client.query(
          `
            update posts
            set status = 'removed',
                updated_at = $2::timestamptz
            where post_id = $1
          `,
          [report.target_id, input.decidedAt],
        );
      }

      if (input.decision === "suspend_user") {
        await client.query(
          `
            update users
            set status = 'suspended',
                updated_at = $2::timestamptz
            where user_id = $1
          `,
          [moderationTargetId, input.decidedAt],
        );
      }

      await client.query(
        `
          update reports
          set status = $2,
              resolution = $3,
              resolved_at = $4::timestamptz
          where report_id = $1
        `,
        [input.reportId, nextStatus, resolution, input.decidedAt],
      );

      const moderationActionId = randomUUID();
      await client.query(
        `
          insert into moderation_actions (
            action_id,
            report_id,
            anchor_user_id,
            community_id,
            action_type,
            target_type,
            target_id,
            reason,
            created_at
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz)
        `,
        [
          moderationActionId,
          input.reportId,
          input.anchorUserId,
          input.communityId,
          input.decision,
          moderationTargetType,
          moderationTargetId,
          input.notes,
          input.decidedAt,
        ],
      );

      const syncEvents =
        report.target_type === "post"
          ? [
              await appendCommunitySyncEvent(client, {
                communityId: input.communityId,
                topicKey: "reports",
                eventType: "moderation.decision",
                aggregateType: "moderation",
                aggregateId: moderationActionId,
                actorUserId: input.anchorUserId,
                occurredAt: input.decidedAt,
                payload: {
                  report_id: report.report_id,
                  target_type: "post",
                  target_id: report.target_id,
                  report_target_type: "post",
                  report_target_id: report.target_id,
                  resolution,
                  status: nextStatus,
                  decided_at: input.decidedAt,
                },
              }),
              ...(resolution === "remove_post"
                ? [
                    await appendCommunitySyncEvent(client, {
                      communityId: input.communityId,
                      topicKey: "posts",
                      eventType: "post.tombstoned",
                      aggregateType: "post",
                      aggregateId: report.target_id,
                      actorUserId: input.anchorUserId,
                      occurredAt: input.decidedAt,
                      payload: {
                        post: {
                          post_id: report.target_id,
                          community_id: input.communityId,
                          status: "removed",
                          updated_at: input.decidedAt,
                        },
                        reason: "report_queue_remove_post",
                      },
                    }),
                  ]
                : []),
            ]
          : [];

      return {
        report_id: input.reportId,
        status: nextStatus,
        resolution,
        decided_at: input.decidedAt,
        affected_user_id: affectedUserId,
        communityId: input.communityId,
        targetType: report.target_type,
        targetId: report.target_id,
        moderationTargetType,
        moderationTargetId,
        reportTargetType: report.target_type,
        reportTargetId: report.target_id,
        conversationId: report.conversation_id,
        moderationActionId,
        syncEvents,
      };
    });
  }

  async autoHidePostIfThresholdReached(input: { communityId: string; postId: string }) {
    return this.withTransaction(async (client) => {
      const decidedAt = new Date().toISOString();
      const thresholdResult = await client.query<{ threshold: number }>(
        `
          select coalesce(cr.auto_hide_report_threshold, 3)::int as threshold
          from communities c
          left join community_rulesets cr on cr.ruleset_id = c.ruleset_id
          where c.community_id = $1
          limit 1
        `,
        [input.communityId],
      );
      const threshold = thresholdResult.rows[0]?.threshold ?? 3;

      // A2 P1-7: count distinct reporters, not distinct rows. Previously a
      // single user could tap Report three times in a row and trip the
      // 3-reporter auto-hide threshold alone — a griefing vector that made
      // auto-moderation hostile to the posting user. `uq_reports_reporter_target_active`
      // added in migration 0014 also enforces at-most-one 'new' row per
      // (target, reporter), so counting distinct reporters here is now the
      // correct semantics for "how many different users flagged this".
      const countResult = await client.query<{ reporter_count: number }>(
        `
          select count(distinct reporter_user_id)::int as reporter_count
          from reports
          where community_id = $1
            and target_type = 'post'
            and target_id = $2
            and status not in ('dismissed', 'resolved')
        `,
        [input.communityId, input.postId],
      );

      if ((countResult.rows[0]?.reporter_count ?? 0) < threshold) {
        return null;
      }

      const result = await client.query<{ post_id: string }>(
        `
          update posts
          set status = 'removed',
              updated_at = $2::timestamptz
          where post_id = $1
            and status in ('active', 'pending_review')
          returning post_id
        `,
        [input.postId, decidedAt],
      );
      if (Number(result.rowCount ?? 0) === 0) {
        return null;
      }

      const reportResult = await client.query<{ report_id: string }>(
        `
          select report_id
          from reports
          where community_id = $1
            and target_type = 'post'
            and target_id = $2
            and status not in ('dismissed', 'resolved')
          order by created_at desc, report_id desc
        `,
        [input.communityId, input.postId],
      );
      const anchorResult = await client.query<{ anchor_user_id: string }>(
        `
          select user_id as anchor_user_id
          from anchors
          where community_id = $1
            and status = 'active'
          order by activated_at asc nulls last, anchor_id asc
          limit 1
        `,
        [input.communityId],
      );

      await client.query(
        `
          update reports
          set status = 'resolved',
              resolution = 'remove_post',
              resolved_at = $3::timestamptz
          where community_id = $1
            and target_type = 'post'
            and target_id = $2
            and status not in ('dismissed', 'resolved')
        `,
        [input.communityId, input.postId, decidedAt],
      );

      const openReportIds = reportResult.rows.map((row) => row.report_id);
      const anchorUserId = anchorResult.rows[0]?.anchor_user_id ?? null;
      const moderationRows =
        openReportIds.length > 0
          ? await client.query<{ action_id: string; report_id: string }>(
          `
            insert into moderation_actions (
              action_id,
              report_id,
              anchor_user_id,
              community_id,
              action_type,
              target_type,
              target_id,
              reason,
              created_at
            )
            select
              gen_random_uuid(),
              report_id,
              $1,
              $2,
              'remove_post',
              'post',
              $3,
              'auto_hide_report_threshold',
              $5::timestamptz
            from reports
            where report_id = any($4::uuid[])
            returning action_id, report_id
          `,
          [anchorUserId, input.communityId, input.postId, openReportIds, decidedAt],
        )
          : { rows: [] };
      const moderationActionIds = new Map(
        moderationRows.rows.map((row) => [row.report_id, row.action_id]),
      );

      for (const reportId of openReportIds) {
        if (!moderationActionIds.has(reportId)) {
          throw new ChatServiceError(
            `missing moderation action id for auto-hide report ${reportId}`,
            "internal_error",
          );
        }
      }

      const syncEvents = [
        ...(
          await Promise.all(
            openReportIds.map((reportId) =>
              appendCommunitySyncEvent(client, {
                communityId: input.communityId,
                topicKey: "reports",
                eventType: "moderation.decision",
                aggregateType: "moderation",
                aggregateId: moderationActionIds.get(reportId)!,
                actorUserId: anchorUserId,
                payload: {
                  report_id: reportId,
                  target_type: "post",
                  target_id: input.postId,
                  report_target_type: "post",
                  report_target_id: input.postId,
                  resolution: "remove_post",
                  status: "resolved",
                  decided_at: decidedAt,
                },
                occurredAt: decidedAt,
              }),
            ),
          )
        ),
        await appendCommunitySyncEvent(client, {
          communityId: input.communityId,
          topicKey: "posts",
          eventType: "post.tombstoned",
          aggregateType: "post",
          aggregateId: input.postId,
          actorUserId: anchorUserId,
          occurredAt: decidedAt,
          payload: {
            post: {
              post_id: input.postId,
              community_id: input.communityId,
              status: "removed",
              updated_at: decidedAt,
            },
            reason: "auto_hide_report_threshold",
          },
        }),
      ];

      return {
        postId: input.postId,
        communityId: input.communityId,
        anchorUserId,
        reportIds: openReportIds,
        moderationActionIds: Object.fromEntries(moderationActionIds.entries()),
        syncEvents,
      };
    });
  }

  async getMessage(messageId: string, conversationId: string) {
    const result = await this.pool.query<MessageRow>(
      `
        select message_id, conversation_id, sender_user_id, body, safety_flags, sent_at
        from messages
        where message_id = $1
          and conversation_id = $2
        limit 1
      `,
      [messageId, conversationId],
    );
    const row = result.rows[0];
    return row ? mapMessage(row) : null;
  }

  async getMessageContext(messageId: string) {
    const result = await this.pool.query<
      MessageRow & {
        requester_user_id: string;
        recipient_user_id: string;
        community_id: string | null;
      }
    >(
      `
        select
          m.message_id,
          m.conversation_id,
          m.sender_user_id,
          m.body,
          m.safety_flags,
          m.sent_at,
          cr.requester_user_id,
          cr.recipient_user_id,
          p.community_id
        from messages m
        join conversations c on c.conversation_id = m.conversation_id
        join contact_requests cr on cr.contact_request_id = c.contact_request_id
        left join posts p on p.post_id = cr.from_post_id
        where m.message_id = $1
        limit 1
      `,
      [messageId],
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      message: mapMessage(row),
      participantUserIds: [row.requester_user_id, row.recipient_user_id] as [string, string],
      communityId: row.community_id,
    };
  }

  async getPostCommunityId(postId: string) {
    const result = await this.pool.query<{ community_id: string }>(
      `
        select community_id
        from posts
        where post_id = $1
        limit 1
      `,
      [postId],
    );

    return result.rows[0]?.community_id ?? null;
  }
}
