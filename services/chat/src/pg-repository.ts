import { encodeConversationCursor, encodeMessageCursor } from "./repository.js";
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
  end?(): Promise<void>;
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
  reporter_user_id: string;
  created_at: string;
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

function mapReport(row: ReportRow): ReportRecord {
  return {
    report_id: row.report_id,
    community_id: row.community_id,
    target_type: row.target_type,
    target_id: row.target_id,
    reason: row.reason,
    detail_text: row.detail_text,
    reporter_user_id: row.reporter_user_id,
    created_at: row.created_at,
  };
}

export class PgChatRepository implements ChatRepository {
  constructor(private readonly pool: PoolLike) {}

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
  }) {
    const result = await this.pool.query<MessageRow>(
      `
        insert into messages (
          conversation_id,
          sender_user_id,
          body,
          safety_flags,
          sent_at
        )
        values ($1, $2, $3, $4::text[], $5::timestamptz)
        returning message_id, conversation_id, sender_user_id, body, safety_flags, sent_at
      `,
      [input.conversationId, input.senderUserId, input.body, input.safetyFlags, input.sentAt],
    );
    await this.pool.query(
      `
        update conversations
        set last_activity_at = $2::timestamptz
        where conversation_id = $1
      `,
      [input.conversationId, input.sentAt],
    );

    return mapMessage(result.rows[0]!);
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
    reporterUserId: string;
    createdAt: string;
  }) {
    const result = await this.pool.query<ReportRow>(
      `
        insert into reports (
          community_id,
          target_type,
          target_id,
          reason,
          detail_text,
          reporter_user_id,
          created_at
        )
        values ($1, $2, $3, $4, $5, $6, $7::timestamptz)
        returning report_id, community_id, target_type, target_id, reason, detail_text, reporter_user_id, created_at
      `,
      [
        input.communityId,
        input.targetType,
        input.targetId,
        input.reason,
        input.detailText,
        input.reporterUserId,
        input.createdAt,
      ],
    );
    return mapReport(result.rows[0]!);
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
