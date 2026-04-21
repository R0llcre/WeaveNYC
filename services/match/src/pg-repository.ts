import { NominatimGeocoder, type ResourceListItem } from "@weavenyc/resource-directory";
import { Pool } from "pg";

import type {
  AcceptedConversationRecord,
  ContactRequestInboxRow,
  ContactRequestRecord,
  CursorPage,
  MatchRepository,
  MatchSuggestion,
  MatchSuggestionBatch,
  MatchablePost,
  ResourceSummary,
} from "./types.js";
import { MatchServiceError } from "./types.js";

type PostRow = {
  post_id: string;
  community_id: string;
  post_type: MatchablePost["post_type"];
  category: MatchablePost["category"];
  title: string;
  body: string;
  language: MatchablePost["language"];
  location_zip: string;
  privacy: MatchablePost["privacy"];
  status: MatchablePost["status"];
  risk_level: MatchablePost["risk_level"];
  created_at: Date | string;
  updated_at: Date | string;
  expires_at: Date | string;
  created_by: string;
  author_alias: string | null;
  author_level: MatchablePost["author_level"];
  anchor_reviewed: boolean;
};

type SuggestionRow = {
  suggestion_id: string;
  request_post_id: string;
  batch_number: number;
  position: number;
  candidate_type: MatchSuggestion["candidate_type"];
  candidate_id: string;
  score: number;
  reasons: string[] | null;
  created_at: Date | string;
};

type ContactRequestRow = {
  contact_request_id: string;
  from_post_id: string;
  to_post_id: string;
  requester_user_id: string;
  recipient_user_id: string;
  requester_alias: string | null;
  status: ContactRequestRecord["status"];
  created_at: Date | string;
  expires_at: Date | string;
  responded_at: Date | string | null;
};

type ConversationRow = {
  conversation_id: string;
  contact_request_id: string;
  related_post_ids: string[] | null;
  created_at: Date | string;
  requester_user_id: string;
  requester_alias: string | null;
  recipient_user_id: string;
  recipient_alias: string | null;
};

type CursorValue = {
  createdAt: string;
  id: string;
};

function toIso(value: Date | string | null) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function encodeCursor(input: CursorValue) {
  return Buffer.from(JSON.stringify(input), "utf8").toString("base64url");
}

function decodeCursor(cursor: string | null | undefined): CursorValue | null {
  if (!cursor) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as CursorValue;
    if (!parsed.createdAt || !parsed.id) {
      throw new Error("invalid");
    }
    return parsed;
  } catch {
    throw new MatchServiceError("Cursor is not valid", "invalid_cursor");
  }
}

function fallbackAlias(userId: string, alias: string | null) {
  return alias?.trim() || `Neighbor ${userId.slice(-4)}`;
}

function buildDirectionsUrl(address: string, city: string | null, state: string | null, zip: string) {
  const parts = [address, city, state, zip].filter(Boolean);
  return `https://maps.google.com/?q=${encodeURIComponent(parts.join(", "))}`;
}

function haversineDistanceMiles(
  left: { lat: number | null; lng: number | null },
  right: { lat: number | null; lng: number | null },
) {
  if (left.lat === null || left.lng === null || right.lat === null || right.lng === null) {
    return null;
  }

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusMiles = 3958.7613;
  const dLat = toRadians(right.lat - left.lat);
  const dLng = toRadians(right.lng - left.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(left.lat)) *
      Math.cos(toRadians(right.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((earthRadiusMiles * c).toFixed(2));
}

function mapPost(row: PostRow, distanceMiles: number | null): MatchablePost {
  return {
    post_id: row.post_id,
    community_id: row.community_id,
    post_type: row.post_type,
    category: row.category,
    title: row.title,
    body: row.body,
    language: row.language,
    location_zip: row.location_zip,
    privacy: row.privacy,
    status: row.status,
    risk_level: row.risk_level,
    created_at: toIso(row.created_at)!,
    updated_at: toIso(row.updated_at)!,
    expires_at: toIso(row.expires_at)!,
    is_owner: false,
    created_by: row.created_by,
    author_alias: fallbackAlias(row.created_by, row.author_alias),
    author_level: row.author_level,
    anchor_reviewed: row.anchor_reviewed,
    distance_miles: distanceMiles,
  };
}

function mapResource(item: ResourceListItem): ResourceSummary {
  return {
    provider_id: item.providerId,
    name: item.name,
    type: item.type,
    address: item.address,
    city: item.city,
    state: item.state,
    zip: item.zip,
    phone: item.phone,
    languages: item.languages,
    source: item.source,
    source_label: item.sourceLabel,
    notes: item.notes,
    distance_miles: item.distanceMiles,
    is_open_today: item.isOpenToday,
    is_open_now: item.isOpenNow,
    geo_precision: item.geoPrecision,
    directions_url: buildDirectionsUrl(item.address, item.city, item.state, item.zip),
  };
}

function mapContactRequest(row: ContactRequestRow): ContactRequestRecord {
  return {
    contactRequestId: row.contact_request_id,
    fromPostId: row.from_post_id,
    toPostId: row.to_post_id,
    requesterUserId: row.requester_user_id,
    recipientUserId: row.recipient_user_id,
    requesterAlias: fallbackAlias(row.requester_user_id, row.requester_alias),
    status: row.status,
    createdAt: toIso(row.created_at)!,
    expiresAt: toIso(row.expires_at)!,
    respondedAt: toIso(row.responded_at),
  };
}

function mapConversation(row: ConversationRow): AcceptedConversationRecord {
  return {
    conversation_id: row.conversation_id,
    contact_request_id: row.contact_request_id,
    related_post_ids: row.related_post_ids ?? [],
    participant_preview: [
      {
        user_id: row.requester_user_id,
        alias: fallbackAlias(row.requester_user_id, row.requester_alias),
      },
      {
        user_id: row.recipient_user_id,
        alias: fallbackAlias(row.recipient_user_id, row.recipient_alias),
      },
    ],
    status: "accepted_contact",
    created_at: toIso(row.created_at)!,
  };
}

export class PgMatchRepository implements MatchRepository {
  private readonly geocoder = new NominatimGeocoder();
  private readonly zipCache = new Map<string, { lat: number | null; lng: number | null }>();

  constructor(
    private readonly pool: Pool,
    private readonly searchOfficialResources: (zip: string) => Promise<ResourceListItem[]>,
  ) {}

  async close(): Promise<void> {
    await this.pool.end();
  }

  async getPost(postId: string): Promise<MatchablePost | null> {
    const result = await this.pool.query<PostRow>(
      `
        select
          p.post_id,
          p.community_id,
          p.post_type,
          p.category,
          p.title,
          p.body,
          p.language,
          p.location_zip,
          p.privacy,
          p.status,
          p.risk_level,
          p.created_at,
          p.updated_at,
          p.expires_at,
          p.created_by,
          u.display_name as author_alias,
          u.level as author_level,
          (p.verification_state = 'verified_by_anchor') as anchor_reviewed
        from posts p
        join users u on u.user_id = p.created_by
        where p.post_id = $1
        limit 1
      `,
      [postId],
    );

    const row = result.rows[0];
    return row ? mapPost(row, null) : null;
  }

  async listCandidateNeighborPosts(requestPost: MatchablePost): Promise<MatchablePost[]> {
    const requestZipCenter = await this.getZipCenter(requestPost.location_zip);
    const result = await this.pool.query<PostRow>(
      `
        select
          p.post_id,
          p.community_id,
          p.post_type,
          p.category,
          p.title,
          p.body,
          p.language,
          p.location_zip,
          p.privacy,
          p.status,
          p.risk_level,
          p.created_at,
          p.updated_at,
          p.expires_at,
          p.created_by,
          u.display_name as author_alias,
          u.level as author_level,
          (p.verification_state = 'verified_by_anchor') as anchor_reviewed
        from posts p
        join users u on u.user_id = p.created_by
        where p.post_type = 'offer'
          and p.status = 'active'
          and p.category = $1
          and p.community_id = $2
          and p.created_by <> $3
          and p.privacy <> 'anchor_mediated'
          and p.expires_at > now()
        order by p.created_at desc
      `,
      [requestPost.category, requestPost.community_id, requestPost.created_by],
    );

    return Promise.all(
      result.rows.map(async (row: PostRow) => {
        const offerZipCenter = await this.getZipCenter(row.location_zip);
        return mapPost(row, haversineDistanceMiles(requestZipCenter, offerZipCenter));
      }),
    );
  }

  async listOfficialResourcesForRequest(requestPost: MatchablePost): Promise<ResourceSummary[]> {
    const items = await this.searchOfficialResources(requestPost.location_zip);
    return items.map(mapResource);
  }

  async listSuggestionBatches(requestPostId: string): Promise<MatchSuggestionBatch[]> {
    const result = await this.pool.query<SuggestionRow>(
      `
        select
          suggestion_id,
          request_post_id,
          batch_number,
          position,
          candidate_type,
          candidate_id,
          score,
          reasons,
          created_at
        from match_suggestions
        where request_post_id = $1
        order by batch_number asc, position asc
      `,
      [requestPostId],
    );

    const grouped = new Map<number, MatchSuggestionBatch>();
    for (const row of result.rows) {
      const batch = grouped.get(row.batch_number) ?? {
        requestPostId: row.request_post_id,
        batchNumber: row.batch_number,
        createdAt: toIso(row.created_at)!,
        items: [] as MatchSuggestion[],
      };

      batch.items.push({
        suggestion_id: row.suggestion_id,
        batch_number: row.batch_number,
        position: row.position,
        candidate_type: row.candidate_type,
        candidate_id: row.candidate_id,
        score: row.score,
        reasons: (row.reasons ?? []) as MatchSuggestion["reasons"],
        distance_miles: null,
        neighbor_post: null,
        official_resource: null,
      });
      grouped.set(row.batch_number, batch);
    }

    return Array.from(grouped.values()).sort((left, right) => left.batchNumber - right.batchNumber);
  }

  async saveSuggestionBatch(batch: MatchSuggestionBatch): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await client.query(
        `delete from match_suggestions where request_post_id = $1 and batch_number = $2`,
        [batch.requestPostId, batch.batchNumber],
      );
      for (const item of batch.items) {
        await client.query(
          `
            insert into match_suggestions (
              suggestion_id,
              request_post_id,
              batch_number,
              position,
              candidate_type,
              candidate_id,
              score,
              reasons,
              created_at
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8::text[], $9::timestamptz)
          `,
          [
            item.suggestion_id,
            batch.requestPostId,
            batch.batchNumber,
            item.position,
            item.candidate_type,
            item.candidate_id,
            item.score,
            item.reasons,
            batch.createdAt,
          ],
        );
      }
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteSuggestionBatches(requestPostId: string, batchNumbers?: number[]): Promise<void> {
    if (!batchNumbers?.length) {
      await this.pool.query(`delete from match_suggestions where request_post_id = $1`, [requestPostId]);
      return;
    }

    await this.pool.query(
      `delete from match_suggestions where request_post_id = $1 and batch_number = any($2::int[])`,
      [requestPostId, batchNumbers],
    );
  }

  async isBlockedBetween(userA: string, userB: string): Promise<boolean> {
    // Bidirectional block lookup against the shared `blocks` table —
    // matches chat's `PgChatRepository.findBlockBetweenUsers` predicate so
    // /v1/match/contact enforces the exact same semantics as chat's send
    // path (F4-A Fix #1). Bidirectional because once either side blocks
    // the other, no further contact should flow — the Match service would
    // otherwise let a blocked requester keep spamming the blocker via
    // fresh contact requests.
    const result = await this.pool.query<{ one: number }>(
      `
        select 1 as one
        from blocks
        where (blocker_user_id = $1 and blocked_user_id = $2)
           or (blocker_user_id = $2 and blocked_user_id = $1)
        limit 1
      `,
      [userA, userB],
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  async findContactRequestByPair(fromPostId: string, toPostId: string): Promise<ContactRequestRecord | null> {
    const result = await this.pool.query<ContactRequestRow>(
      `
        select
          cr.contact_request_id,
          cr.from_post_id,
          cr.to_post_id,
          cr.requester_user_id,
          cr.recipient_user_id,
          requester.display_name as requester_alias,
          cr.status,
          cr.created_at,
          cr.expires_at,
          cr.responded_at
        from contact_requests cr
        join users requester on requester.user_id = cr.requester_user_id
        where cr.from_post_id = $1
          and cr.to_post_id = $2
        order by cr.created_at desc
        limit 1
      `,
      [fromPostId, toPostId],
    );

    const row = result.rows[0];
    return row ? mapContactRequest(row) : null;
  }

  private async findActiveContactRequestByPair(fromPostId: string, toPostId: string) {
    const result = await this.pool.query<ContactRequestRow>(
      `
        select
          cr.contact_request_id,
          cr.from_post_id,
          cr.to_post_id,
          cr.requester_user_id,
          cr.recipient_user_id,
          requester.display_name as requester_alias,
          cr.status,
          cr.created_at,
          cr.expires_at,
          cr.responded_at
        from contact_requests cr
        join users requester on requester.user_id = cr.requester_user_id
        where cr.from_post_id = $1
          and cr.to_post_id = $2
          and (
            cr.status = 'accepted'
            or (cr.status = 'pending' and cr.expires_at > now())
          )
        order by cr.created_at desc
        limit 1
      `,
      [fromPostId, toPostId],
    );

    const row = result.rows[0];
    return row ? mapContactRequest(row) : null;
  }

  async getContactRequest(contactRequestId: string): Promise<ContactRequestRecord | null> {
    const result = await this.pool.query<ContactRequestRow>(
      `
        select
          cr.contact_request_id,
          cr.from_post_id,
          cr.to_post_id,
          cr.requester_user_id,
          cr.recipient_user_id,
          requester.display_name as requester_alias,
          cr.status,
          cr.created_at,
          cr.expires_at,
          cr.responded_at
        from contact_requests cr
        join users requester on requester.user_id = cr.requester_user_id
        where cr.contact_request_id = $1
        limit 1
      `,
      [contactRequestId],
    );

    const row = result.rows[0];
    return row ? mapContactRequest(row) : null;
  }

  async saveContactRequest(record: ContactRequestRecord): Promise<ContactRequestRecord> {
    let result;
    try {
      result = await this.pool.query<ContactRequestRow>(
        `
          insert into contact_requests (
            contact_request_id,
            from_post_id,
            to_post_id,
            requester_user_id,
            recipient_user_id,
            status,
            created_at,
            responded_at,
            expires_at
          )
          values ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz, $9::timestamptz)
          on conflict (contact_request_id) do update
            set status = excluded.status,
                responded_at = excluded.responded_at,
                expires_at = excluded.expires_at
          returning
            contact_request_id,
            from_post_id,
            to_post_id,
            requester_user_id,
            recipient_user_id,
            null::text as requester_alias,
            status,
            created_at,
            expires_at,
            responded_at
        `,
        [
          record.contactRequestId,
          record.fromPostId,
          record.toPostId,
          record.requesterUserId,
          record.recipientUserId,
          record.status,
          record.createdAt,
          record.respondedAt,
          record.expiresAt,
        ],
      );
    } catch (error) {
      const maybePgError = error as { code?: string; constraint?: string };
      if (
        maybePgError.code === "23505" &&
        maybePgError.constraint === "uq_contact_requests_active_pair" &&
        (record.status === "pending" || record.status === "accepted")
      ) {
        const existing = await this.findActiveContactRequestByPair(record.fromPostId, record.toPostId);
        if (existing) {
          return existing;
        }
      }
      throw error;
    }

    const saved = result.rows[0];
    if (!saved) {
      throw new MatchServiceError("Contact request could not be saved", "invalid_state");
    }
    return {
      ...mapContactRequest(saved),
      requesterAlias: record.requesterAlias,
    };
  }

  async listInboxPage(input: {
    recipientUserId: string;
    cursor: string | null;
    limit: number;
  }): Promise<CursorPage<ContactRequestRecord>> {
    const cursor = decodeCursor(input.cursor);
    const limit = Math.min(Math.max(input.limit, 1), 50);
    const params: unknown[] = [input.recipientUserId];
    let cursorClause = "";

    if (cursor) {
      params.push(cursor.createdAt, cursor.id);
      cursorClause = `
        and (
          cr.created_at < $2::timestamptz
          or (cr.created_at = $2::timestamptz and cr.contact_request_id < $3::uuid)
        )
      `;
    }

    params.push(limit + 1);

    const result = await this.pool.query<ContactRequestRow>(
      `
        select
          cr.contact_request_id,
          cr.from_post_id,
          cr.to_post_id,
          cr.requester_user_id,
          cr.recipient_user_id,
          requester.display_name as requester_alias,
          cr.status,
          cr.created_at,
          cr.expires_at,
          cr.responded_at
        from contact_requests cr
        join users requester on requester.user_id = cr.requester_user_id
        where cr.recipient_user_id = $1
          and cr.status = 'pending'
          ${cursorClause}
        order by cr.created_at desc, cr.contact_request_id desc
        limit $${params.length}
      `,
      params,
    );

    const items = result.rows.slice(0, limit).map(mapContactRequest);
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        result.rows.length > limit && last
          ? encodeCursor({
              createdAt: last.createdAt,
              id: last.contactRequestId,
            })
          : null,
    };
  }

  async listInboxItems(input: {
    recipientUserId: string;
    cursor: string | null;
    limit?: number;
  }): Promise<CursorPage<ContactRequestInboxRow>> {
    const page = await this.listInboxPage({
      recipientUserId: input.recipientUserId,
      cursor: input.cursor,
      limit: input.limit ?? 20,
    });

    if (!page.items.length) {
      return { items: [], nextCursor: page.nextCursor };
    }

    const result = await this.pool.query<
      ContactRequestRow & {
        from_post_title: string;
        to_post_title: string;
        from_post_category: MatchablePost["category"];
        to_post_category: MatchablePost["category"];
      }
    >(
      `
        select
          cr.contact_request_id,
          cr.from_post_id,
          cr.to_post_id,
          cr.requester_user_id,
          cr.recipient_user_id,
          requester.display_name as requester_alias,
          cr.status,
          cr.created_at,
          cr.expires_at,
          cr.responded_at,
          from_post.title as from_post_title,
          to_post.title as to_post_title,
          from_post.category as from_post_category,
          to_post.category as to_post_category
        from contact_requests cr
        join users requester on requester.user_id = cr.requester_user_id
        join posts from_post on from_post.post_id = cr.from_post_id
        join posts to_post on to_post.post_id = cr.to_post_id
        where cr.contact_request_id = any($1::uuid[])
      `,
      [page.items.map((item) => item.contactRequestId)],
    );

    const byId = new Map(
      result.rows.map((row) => [row.contact_request_id, row] as const),
    );
    return {
      items: page.items
        .map((item) => {
          const row = byId.get(item.contactRequestId);
          if (!row) {
            return null;
          }

          return {
            ...mapContactRequest(row),
            fromPostTitle: row.from_post_title,
            toPostTitle: row.to_post_title,
            fromPostCategory: row.from_post_category,
            toPostCategory: row.to_post_category,
          };
        })
        .filter((item): item is ContactRequestInboxRow => Boolean(item)),
      nextCursor: page.nextCursor,
    };
  }

  async getAcceptedConversationByContactRequest(
    contactRequestId: string,
  ): Promise<AcceptedConversationRecord | null> {
    const result = await this.pool.query<ConversationRow>(
      `
        select
          c.conversation_id,
          c.contact_request_id,
          c.related_post_ids,
          c.created_at,
          cr.requester_user_id,
          requester.display_name as requester_alias,
          cr.recipient_user_id,
          recipient.display_name as recipient_alias
        from conversations c
        join contact_requests cr on cr.contact_request_id = c.contact_request_id
        join users requester on requester.user_id = cr.requester_user_id
        join users recipient on recipient.user_id = cr.recipient_user_id
        where c.contact_request_id = $1
        limit 1
      `,
      [contactRequestId],
    );

    const row = result.rows[0];
    return row ? mapConversation(row) : null;
  }

  async getAcceptedConversation(conversationId: string): Promise<AcceptedConversationRecord | null> {
    const result = await this.pool.query<ConversationRow>(
      `
        select
          c.conversation_id,
          c.contact_request_id,
          c.related_post_ids,
          c.created_at,
          cr.requester_user_id,
          requester.display_name as requester_alias,
          cr.recipient_user_id,
          recipient.display_name as recipient_alias
        from conversations c
        join contact_requests cr on cr.contact_request_id = c.contact_request_id
        join users requester on requester.user_id = cr.requester_user_id
        join users recipient on recipient.user_id = cr.recipient_user_id
        where c.conversation_id = $1
        limit 1
      `,
      [conversationId],
    );

    const row = result.rows[0];
    return row ? mapConversation(row) : null;
  }

  async saveAcceptedConversation(record: AcceptedConversationRecord): Promise<AcceptedConversationRecord> {
    await this.pool.query(
      `
        insert into conversations (
          conversation_id,
          participants,
          related_post_ids,
          contact_request_id,
          created_at,
          last_activity_at
        )
        values ($1, $2::uuid[], $3::uuid[], $4, $5::timestamptz, $5::timestamptz)
        on conflict (contact_request_id) do nothing
      `,
      [
        record.conversation_id,
        record.participant_preview.map((participant) => participant.user_id),
        record.related_post_ids,
        record.contact_request_id,
        record.created_at,
      ],
    );

    return (
      (await this.getAcceptedConversationByContactRequest(record.contact_request_id)) ??
      (await this.getAcceptedConversation(record.conversation_id)) ??
      record
    );
  }

  private async getZipCenter(zip: string) {
    const cached = this.zipCache.get(zip);
    if (cached) {
      return cached;
    }

    const geocoded = await this.geocoder.geocodeZip(zip);
    const center = {
      lat: geocoded.lat,
      lng: geocoded.lng,
    };
    this.zipCache.set(zip, center);
    return center;
  }
}

export function createPgMatchRepository(
  connectionString: string,
  searchOfficialResources: (zip: string) => Promise<ResourceListItem[]>,
) {
  return new PgMatchRepository(
    new Pool({
      connectionString,
    }),
    searchOfficialResources,
  );
}
