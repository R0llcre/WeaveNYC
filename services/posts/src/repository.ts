import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { appendCommunitySyncEvent, encodeDagNode } from '@weavenyc/p2p';
import type { CommunitySyncEvent } from '@weavenyc/shared';

import {
  announcementPinStrategies,
  postCategories,
  supportedLanguages,
} from '@weavenyc/shared';
import type {
  AdminDashboardResponse,
  CommunityRules,
  CommunityAccessEntry,
  ContactPreference,
  CreatePostRequest,
  PostDetail,
  PostStatus,
  ReviewQueueItem,
} from '@weavenyc/shared';

import { canViewPost, getPostActions } from './policy.js';
import type {
  CommunityAccessCodeRecord,
  CommunityMembershipResult,
  CommunityRecord,
  CursorPage,
  ListMyPostsInput,
  ListPostsInput,
  PostActor,
  PostRecord,
  ReviewDecisionInput,
  ReviewQueueInput,
  SyncedAnnouncement,
  SyncedPostDetail,
} from './types.js';
import { PostsServiceError } from './types.js';

const DEFAULT_LIMIT = 20;

type CursorValue = {
  createdAt: string;
  postId: string;
};

type CommunityRow = {
  community_id: string;
  name: string;
  center_zip: string;
  join_policy: CommunityRecord['join_policy'];
};

type CommunityAccessRow = CommunityRow & {
  channel: CommunityAccessEntry;
};

type MembershipRow = {
  joined_at: Date | string;
};

type RulesRow = {
  ruleset_id: string;
  community_id: string;
  review_categories: string[] | null;
  auto_hide_report_threshold: number;
  keyword_blocklist: string[] | null;
  language_preferences: string[] | null;
  announcement_pin_strategy: string | null;
  updated_at: Date | string;
};

type AnnouncementRow = {
  announcement_id: string;
  community_id: string;
  title: string;
  body: string;
  status: "active" | "deleted";
  is_pinned: boolean | number;
  created_by: string;
  published_at: Date | string;
  updated_at: Date | string;
  p2p_version: number;
  ipfs_cid: string | null;
};

type PostRow = {
  post_id: string;
  community_id: string;
  post_type: CreatePostRequest['post_type'];
  category: CreatePostRequest['category'];
  title: string;
  body: string;
  language: CreatePostRequest['language'];
  location_zip: string;
  privacy: CreatePostRequest['privacy'];
  status: PostStatus;
  risk_level: PostRecord['riskLevel'];
  expires_at: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
  created_by: string;
  contact_pref: ContactPreference | null;
  p2p_version: number;
  ipfs_cid: string | null;
};

type Queryable = Pick<Pool, 'query'>;
type TransactionClientLike = Queryable & {
  release?(): void;
};

type SyncedMutationResult<T> = T & {
  syncEvents?: CommunitySyncEvent[];
};

function encodeCursor(input: CursorValue) {
  return Buffer.from(JSON.stringify(input), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string | null | undefined): CursorValue | null {
  if (!cursor) {
    return null;
  }

  let parsed: CursorValue;
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as CursorValue;
  } catch {
    throw new PostsServiceError('Cursor is not valid', 'invalid_cursor');
  }

  if (!parsed.createdAt || !parsed.postId) {
    throw new PostsServiceError('Cursor is not valid', 'invalid_cursor');
  }

  return parsed;
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toP2PSyncPost(record: PostRecord) {
  return {
    post_id: record.postId,
    community_id: record.communityId,
    post_type: record.postType,
    category: record.category,
    title: record.title,
    body: record.body,
    language: record.language,
    location_zip: record.locationZip,
    privacy: record.privacy,
    status: record.status,
    risk_level: record.riskLevel,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    expires_at: record.expiresAt,
    is_owner: false,
    p2p_version: record.p2pVersion ?? 1,
    ipfs_cid: record.ipfsCid ?? null,
  };
}

function mapCommunity(row: CommunityRow): CommunityRecord {
  return {
    community_id: row.community_id,
    name: row.name,
    center_zip: row.center_zip,
    join_policy: row.join_policy,
  };
}

function mapPostRow(row: PostRow): PostRecord {
  return {
    postId: row.post_id,
    communityId: row.community_id,
    postType: row.post_type,
    category: row.category,
    title: row.title,
    body: row.body,
    language: row.language,
    locationZip: row.location_zip,
    privacy: row.privacy,
    status: row.status,
    riskLevel: row.risk_level,
    expiresAt: toIso(row.expires_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    createdBy: row.created_by,
    contactPref: row.contact_pref,
    p2pVersion: row.p2p_version,
    ipfsCid: row.ipfs_cid,
  };
}

function defaultCommunityRules(communityId: string): CommunityRules {
  return {
    community_id: communityId,
    review_categories: ["childcare", "transportation"],
    auto_hide_report_threshold: 3,
    keyword_blocklist: [],
    language_preferences: [],
    announcement_pin_strategy: "latest",
    updated_at: new Date(0).toISOString()
  };
}

const validReviewCategorySet = new Set<string>(postCategories);
const validLanguageSet = new Set<string>(supportedLanguages);
const validAnnouncementPinStrategySet = new Set<string>(announcementPinStrategies);

function sanitizeEnumArray<T extends string>(values: readonly string[] | null | undefined, allowed: ReadonlySet<string>) {
  const sanitized: T[] = [];
  const seen = new Set<string>();

  for (const value of values ?? []) {
    if (allowed.has(value) && !seen.has(value)) {
      sanitized.push(value as T);
      seen.add(value);
    }
  }

  return sanitized;
}

function sanitizeKeywordBlocklist(values: readonly string[] | null | undefined) {
  const sanitized: string[] = [];
  const seen = new Set<string>();

  for (const rawValue of values ?? []) {
    const normalized = rawValue.trim();
    if (!normalized || normalized.length > 120 || seen.has(normalized)) {
      continue;
    }

    sanitized.push(normalized);
    seen.add(normalized);
  }

  return sanitized;
}

function mapCommunityRules(row: RulesRow): CommunityRules {
  const announcementPinStrategy = validAnnouncementPinStrategySet.has(row.announcement_pin_strategy ?? "")
    ? (row.announcement_pin_strategy as CommunityRules["announcement_pin_strategy"])
    : "latest";

  return {
    community_id: row.community_id,
    review_categories: sanitizeEnumArray<CommunityRules["review_categories"][number]>(
      row.review_categories,
      validReviewCategorySet
    ),
    auto_hide_report_threshold: Math.min(Math.max(Math.trunc(row.auto_hide_report_threshold), 1), 20),
    keyword_blocklist: sanitizeKeywordBlocklist(row.keyword_blocklist),
    language_preferences: sanitizeEnumArray<CommunityRules["language_preferences"][number]>(
      row.language_preferences,
      validLanguageSet
    ),
    announcement_pin_strategy: announcementPinStrategy,
    updated_at: toIso(row.updated_at)
  };
}

function mapAnnouncement(row: AnnouncementRow): SyncedAnnouncement {
  return {
    announcement_id: row.announcement_id,
    community_id: row.community_id,
    title: row.title,
    body: row.body,
    status: row.status,
    is_pinned: Boolean(row.is_pinned),
    created_by: row.created_by,
    published_at: toIso(row.published_at),
    updated_at: toIso(row.updated_at),
    p2p_version: row.p2p_version,
    ipfs_cid: row.ipfs_cid,
  };
}

function toPostDetail(actor: PostActor, record: PostRecord): SyncedPostDetail {
  return {
    post_id: record.postId,
    community_id: record.communityId,
    post_type: record.postType,
    category: record.category,
    title: record.title,
    body: record.body,
    language: record.language,
    location_zip: record.locationZip,
    privacy: record.privacy,
    status: record.status,
    risk_level: record.riskLevel,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    expires_at: record.expiresAt,
    is_owner: actor.userId === record.createdBy,
    contact_pref: record.contactPref,
    actions: getPostActions(actor, record),
    p2p_version: record.p2pVersion,
    ipfs_cid: record.ipfsCid ?? null,
  };
}

function createPostDagValue(record: PostRecord) {
  return {
    kind: 'post',
    post_id: record.postId,
    community_id: record.communityId,
    post_type: record.postType,
    category: record.category,
    title: record.title,
    body: record.body,
    language: record.language,
    location_zip: record.locationZip,
    privacy: record.privacy,
    status: record.status,
    risk_level: record.riskLevel,
    expires_at: record.expiresAt,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    created_by: record.createdBy,
    contact_pref: record.contactPref,
    p2p_version: record.p2pVersion ?? 1,
  };
}

function createAnnouncementDagValue(announcement: SyncedAnnouncement) {
  return {
    kind: 'announcement',
    announcement_id: announcement.announcement_id,
    community_id: announcement.community_id,
    title: announcement.title,
    body: announcement.body,
    status: announcement.status,
    is_pinned: announcement.is_pinned,
    created_by: announcement.created_by,
    published_at: announcement.published_at,
    updated_at: announcement.updated_at,
    p2p_version: announcement.p2p_version ?? 1,
  };
}

async function stampPostSyncMetadata(queryable: Queryable, row: PostRow): Promise<PostRecord> {
  const record = mapPostRow(row);
  const { cid } = await encodeDagNode(createPostDagValue(record));
  const synced = await queryable.query<PostRow>(
    `
      update posts
      set ipfs_cid = $2
      where post_id = $1
      returning
        post_id,
        community_id,
        post_type,
        category,
        title,
        body,
        language,
        location_zip,
        privacy,
        status,
        risk_level,
        expires_at,
        created_at,
        updated_at,
        created_by,
        contact_pref,
        p2p_version,
        ipfs_cid
    `,
    [record.postId, cid]
  );

  return mapPostRow(synced.rows[0] ?? { ...row, ipfs_cid: cid });
}

async function stampAnnouncementSyncMetadata(
  queryable: Queryable,
  row: AnnouncementRow
): Promise<SyncedAnnouncement> {
  const announcement = mapAnnouncement(row);
  const { cid } = await encodeDagNode(createAnnouncementDagValue(announcement));
  const synced = await queryable.query<AnnouncementRow>(
    `
      update announcements
      set ipfs_cid = $2
      where announcement_id = $1
      returning
        announcement_id,
        community_id,
        title,
        body,
        status,
        is_pinned,
        created_by,
        published_at,
        updated_at,
        p2p_version,
        ipfs_cid
    `,
    [announcement.announcement_id, cid]
  );

  return mapAnnouncement(synced.rows[0] ?? { ...row, ipfs_cid: cid });
}

async function appendPostSyncEvent(
  queryable: Queryable,
  input: {
    eventType: 'post.published' | 'post.updated' | 'post.tombstoned';
    post: PostRecord;
    actorUserId?: string | null;
    reason?: string | null;
  },
) {
  return appendCommunitySyncEvent(queryable, {
    communityId: input.post.communityId,
    topicKey: 'posts',
    eventType: input.eventType,
    aggregateType: 'post',
    aggregateId: input.post.postId,
    actorUserId: input.actorUserId ?? null,
    occurredAt: input.post.updatedAt ?? input.post.createdAt,
    payload: {
      post: toP2PSyncPost(input.post),
      reason: input.reason ?? null,
    },
  });
}

async function appendAnnouncementSyncEvent(
  queryable: Queryable,
  input: {
    eventType: 'announcement.published' | 'announcement.updated' | 'announcement.deleted';
    announcement: SyncedAnnouncement;
    actorUserId?: string | null;
  },
) {
  return appendCommunitySyncEvent(queryable, {
    communityId: input.announcement.community_id,
    topicKey: 'announcements',
    eventType: input.eventType,
    aggregateType: 'announcement',
    aggregateId: input.announcement.announcement_id,
    actorUserId: input.actorUserId ?? null,
    occurredAt: input.announcement.updated_at ?? input.announcement.published_at,
    payload: {
      announcement: input.announcement,
    },
  });
}

function toSummary(actor: PostActor, record: PostRecord) {
  const detail = toPostDetail(actor, record);
  return {
    post_id: detail.post_id,
    community_id: detail.community_id,
    post_type: detail.post_type,
    category: detail.category,
    title: detail.title,
    body: detail.body,
    language: detail.language,
    location_zip: detail.location_zip,
    privacy: detail.privacy,
    status: detail.status,
    risk_level: detail.risk_level,
    created_at: detail.created_at,
    updated_at: detail.updated_at,
    expires_at: detail.expires_at,
    is_owner: detail.is_owner,
  };
}

export class PostsRepository {
  constructor(private readonly pool: Pool) {}

  private async withTransaction<T>(operation: (queryable: Queryable) => Promise<T>) {
    const poolLike = this.pool as Pool & { connect?: () => Promise<TransactionClientLike> };
    if (typeof poolLike.connect !== 'function') {
      return operation(this.pool);
    }

    const client = await poolLike.connect();
    try {
      await client.query('begin');
      const result = await operation(client);
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release?.();
    }
  }

  async ping() {
    await this.pool.query('select 1');
  }

  async close() {
    await this.pool.end();
  }

  async findCommunityAccessCode(input: { inviteCode?: string; qrToken?: string }) {
    const lookupChannel = input.inviteCode ? 'invite_code' : 'qr_token';
    const lookupCode = input.inviteCode ?? input.qrToken;
    const result = await this.pool.query<CommunityAccessRow>(
      `
        select
          c.community_id,
          c.name,
          c.center_zip,
          c.join_policy,
          cac.channel
        from community_access_codes cac
        join communities c on c.community_id = cac.community_id
        where cac.channel = $1
          and cac.code = $2
          and cac.status = 'active'
          and (cac.expires_at is null or cac.expires_at > now())
        limit 1
      `,
      [lookupChannel, lookupCode]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    const community = mapCommunity(row);
    return {
      community,
      entry: row.channel,
    } satisfies CommunityAccessCodeRecord;
  }

  async joinCommunity(userId: string, communityId: string): Promise<CommunityMembershipResult | null> {
    const client = await this.pool.connect();

    try {
      const communityResult = await client.query<{ community_id: string }>(
        `
          select community_id
          from communities
          where community_id = $1
          limit 1
        `,
        [communityId]
      );

      if (!communityResult.rows[0]) {
        return null;
      }

      const insertResult = await client.query<MembershipRow>(
        `
          insert into community_members (user_id, community_id, joined_at)
          values ($1, $2, now())
          on conflict (user_id, community_id) do nothing
          returning joined_at
        `,
        [userId, communityId]
      );

      const inserted = insertResult.rows[0];
      if (inserted) {
        return {
          community_id: communityId,
          membership_status: 'joined',
          joined_at: toIso(inserted.joined_at),
        };
      }

      const existingResult = await client.query<MembershipRow>(
        `
          select joined_at
          from community_members
          where user_id = $1 and community_id = $2
          limit 1
        `,
        [userId, communityId]
      );
      const existing = existingResult.rows[0];
      if (!existing) {
        return null;
      }

      return {
        community_id: communityId,
        membership_status: 'already_joined',
        joined_at: toIso(existing.joined_at),
      };
    } finally {
      client.release();
    }
  }

  async hasMembership(userId: string, communityId: string) {
    const result = await this.pool.query(
      `
        select 1
        from community_members
        where user_id = $1 and community_id = $2
        limit 1
      `,
      [userId, communityId]
    );

    return Boolean(result.rows[0]);
  }

  async insertPost(input: {
    actor: PostActor;
    request: CreatePostRequest;
    riskLevel: PostRecord['riskLevel'];
    status: PostStatus;
    verificationState: 'unverified' | 'verified_by_anchor' | 'verified_by_witnesses';
  }) {
    return this.withTransaction(async (queryable) => {
      const result = await queryable.query<PostRow>(
        `
          insert into posts (
            post_id,
            post_type,
            category,
            title,
            body,
            language,
            location_zip,
            privacy,
            expires_at,
            created_by,
            community_id,
            status,
            risk_level,
            verification_state,
            contact_pref,
            p2p_version,
            created_at,
            updated_at
          )
          values (
            $1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz,
            $10, $11, $12, $13, $14, $15::jsonb, 1, now(), now()
          )
          returning
            post_id,
            community_id,
            post_type,
            category,
            title,
            body,
            language,
            location_zip,
            privacy,
            status,
            risk_level,
            expires_at,
            created_at,
            updated_at,
            created_by,
            contact_pref,
            p2p_version,
            ipfs_cid
        `,
        [
          randomUUID(),
          input.request.post_type,
          input.request.category,
          input.request.title,
          input.request.body,
          input.request.language,
          input.request.location_zip,
          input.request.privacy,
          input.request.expires_at,
          input.actor.userId,
          input.request.community_id,
          input.status,
          input.riskLevel,
          input.verificationState,
          JSON.stringify(input.request.contact_pref ?? null),
        ]
      );

      const row = result.rows[0];
      if (!row) {
        throw new Error('Post insert did not return a row');
      }

      const post = await stampPostSyncMetadata(queryable, row);
      const syncEvent = await appendPostSyncEvent(queryable, {
        eventType: 'post.published',
        post,
        actorUserId: input.actor.userId,
      });

      return {
        ...post,
        syncEvents: [syncEvent],
      } satisfies SyncedMutationResult<PostRecord>;
    });
  }

  async findPost(postId: string) {
    const result = await this.pool.query<PostRow>(
      `
        select
          post_id,
          community_id,
          post_type,
          category,
          title,
          body,
          language,
          location_zip,
          privacy,
          status,
          risk_level,
          expires_at,
          created_at,
          updated_at,
          created_by,
          contact_pref,
          p2p_version,
          ipfs_cid
        from posts
        where post_id = $1
        limit 1
      `,
      [postId]
    );

    const row = result.rows[0];
    return row ? mapPostRow(row) : null;
  }

  async updatePost(input: {
    postId: string;
    request: Partial<Omit<CreatePostRequest, 'community_id' | 'post_type'>>;
    riskLevel: PostRecord['riskLevel'];
    status: PostStatus;
  }) {
    const current = await this.findPost(input.postId);
    if (!current) {
      return null;
    }

    const next = {
      category: input.request.category ?? current.category,
      title: input.request.title ?? current.title,
      body: input.request.body ?? current.body,
      language: input.request.language ?? current.language,
      locationZip: input.request.location_zip ?? current.locationZip,
      privacy: input.request.privacy ?? current.privacy,
      expiresAt: input.request.expires_at ?? current.expiresAt,
      contactPref: input.request.contact_pref ?? current.contactPref,
    };

    return this.withTransaction(async (queryable) => {
      const result = await queryable.query<PostRow>(
        `
          update posts
          set
            category = $2,
            title = $3,
            body = $4,
            language = $5,
            location_zip = $6,
            privacy = $7,
            expires_at = $8::timestamptz,
            contact_pref = $9::jsonb,
            risk_level = $10,
            status = $11,
            p2p_version = p2p_version + 1,
            updated_at = now()
          where post_id = $1
          returning
            post_id,
            community_id,
            post_type,
            category,
            title,
            body,
            language,
            location_zip,
            privacy,
            status,
            risk_level,
            expires_at,
            created_at,
            updated_at,
            created_by,
            contact_pref,
            p2p_version,
            ipfs_cid
        `,
        [
          input.postId,
          next.category,
          next.title,
          next.body,
          next.language,
          next.locationZip,
          next.privacy,
          next.expiresAt,
          JSON.stringify(next.contactPref),
          input.riskLevel,
          input.status,
        ]
      );

      const row = result.rows[0];
      if (!row) {
        return null;
      }

      const post = await stampPostSyncMetadata(queryable, row);
      const syncEvent = await appendPostSyncEvent(queryable, {
        eventType: post.status === 'removed' ? 'post.tombstoned' : 'post.updated',
        post,
      });

      return {
        ...post,
        syncEvents: [syncEvent],
      } satisfies SyncedMutationResult<PostRecord>;
    });
  }

  async setPostStatus(input: {
    postId: string;
    status: PostStatus;
    actorUserId?: string | null;
    reason?: string | null;
  }) {
    return this.withTransaction(async (queryable) => {
      const result = await queryable.query<PostRow>(
        `
          update posts
          set status = $2, p2p_version = p2p_version + 1, updated_at = now()
          where post_id = $1
          returning
            post_id,
            community_id,
            post_type,
            category,
            title,
            body,
            language,
            location_zip,
            privacy,
            status,
            risk_level,
            expires_at,
            created_at,
            updated_at,
            created_by,
            contact_pref,
            p2p_version,
            ipfs_cid
        `,
        [input.postId, input.status]
      );

      const row = result.rows[0];
      if (!row) {
        return null;
      }

      const post = await stampPostSyncMetadata(queryable, row);
      const syncEvent = await appendPostSyncEvent(queryable, {
        eventType: post.status === 'removed' ? 'post.tombstoned' : 'post.updated',
        post,
        actorUserId: input.actorUserId ?? null,
        reason: input.reason ?? null,
      });

      return {
        ...post,
        syncEvents: [syncEvent],
      } satisfies SyncedMutationResult<PostRecord>;
    });
  }

  async listPosts(input: ListPostsInput): Promise<CursorPage<PostDetail>> {
    const cursor = decodeCursor(input.cursor);
    const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), 50);
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (input.scope === 'community') {
      params.push(input.communityId);
      conditions.push(`community_id = $${params.length}`);
      conditions.push(`privacy <> 'anchor_mediated'`);

      if (input.actor.role === 'anchor') {
        if (input.status) {
          params.push(input.status);
          conditions.push(`status = $${params.length}`);
        } else {
          conditions.push(`status = 'active'`);
        }
      } else {
        conditions.push(`status = 'active'`);
      }
    } else {
      conditions.push(`status = 'active'`);
      conditions.push(`privacy = 'public'`);
      if (input.communityId) {
        params.push(input.communityId);
        conditions.push(`community_id = $${params.length}`);
      }
    }

    if (input.postType) {
      params.push(input.postType);
      conditions.push(`post_type = $${params.length}`);
    }

    if (input.category) {
      params.push(input.category);
      conditions.push(`category = $${params.length}`);
    }

    if (cursor) {
      params.push(cursor.createdAt);
      params.push(cursor.postId);
      conditions.push(`(created_at, post_id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`);
    }

    conditions.push(`(expires_at is null or expires_at > now())`);

    params.push(limit + 1);
    const result = await this.pool.query<PostRow>(
      `
        select
          post_id,
          community_id,
          post_type,
          category,
          title,
          body,
          language,
          location_zip,
          privacy,
          status,
          risk_level,
          expires_at,
          created_at,
          updated_at,
          created_by,
          contact_pref,
          p2p_version,
          ipfs_cid
        from posts
        where ${conditions.join(' and ')}
        order by created_at desc, post_id desc
        limit $${params.length}
      `,
      params
    );

    const records = result.rows.map((row: PostRow) => mapPostRow(row));
    const next = records.length > limit ? records.pop() ?? null : null;
    return {
      items: records.map((record: PostRecord) => toPostDetail(input.actor, record)),
      nextCursor: next ? encodeCursor({ createdAt: next.createdAt, postId: next.postId }) : null,
    };
  }

  async listMyPosts(input: ListMyPostsInput): Promise<CursorPage<PostDetail>> {
    const cursor = decodeCursor(input.cursor);
    const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), 50);
    const params: unknown[] = [input.actor.userId];
    const conditions = ['created_by = $1'];

    if (input.communityId) {
      params.push(input.communityId);
      conditions.push(`community_id = $${params.length}`);
    }

    if (input.status) {
      params.push(input.status);
      conditions.push(`status = $${params.length}`);
    }

    if (cursor) {
      params.push(cursor.createdAt);
      params.push(cursor.postId);
      conditions.push(`(created_at, post_id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`);
    }

    params.push(limit + 1);
    const result = await this.pool.query<PostRow>(
      `
        select
          post_id,
          community_id,
          post_type,
          category,
          title,
          body,
          language,
          location_zip,
          privacy,
          status,
          risk_level,
          expires_at,
          created_at,
          updated_at,
          created_by,
          contact_pref,
          p2p_version,
          ipfs_cid
        from posts
        where ${conditions.join(' and ')}
        order by created_at desc, post_id desc
        limit $${params.length}
      `,
      params
    );

    const records = result.rows.map((row: PostRow) => mapPostRow(row));
    const next = records.length > limit ? records.pop() ?? null : null;
    return {
      items: records.map((record: PostRecord) => toPostDetail(input.actor, record)),
      nextCursor: next ? encodeCursor({ createdAt: next.createdAt, postId: next.postId }) : null,
    };
  }

  async listReviewQueue(input: ReviewQueueInput): Promise<CursorPage<ReviewQueueItem>> {
    const cursor = decodeCursor(input.cursor);
    const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), 50);
    const params: unknown[] = [input.communityId];
    const conditions = [`community_id = $1`, `status = 'pending_review'`];

    if (cursor) {
      params.push(cursor.createdAt);
      params.push(cursor.postId);
      conditions.push(`(created_at, post_id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`);
    }

    params.push(limit + 1);
    const result = await this.pool.query<PostRow>(
      `
        select
          post_id,
          community_id,
          post_type,
          category,
          title,
          body,
          language,
          location_zip,
          privacy,
          status,
          risk_level,
          expires_at,
          created_at,
          updated_at,
          created_by,
          contact_pref,
          p2p_version,
          ipfs_cid
        from posts
        where ${conditions.join(' and ')}
        order by created_at desc, post_id desc
        limit $${params.length}
      `,
      params
    );

    const records = result.rows.map((row: PostRow) => mapPostRow(row));
    const next = records.length > limit ? records.pop() ?? null : null;
    return {
      items: records.map((record: PostRecord) => ({
        ...toSummary(input.actor, record),
        review_actions: ['approve', 'reject', 'request_more_info'],
      })),
      nextCursor: next ? encodeCursor({ createdAt: next.createdAt, postId: next.postId }) : null,
    };
  }

  async getCommunityRules(communityId: string): Promise<CommunityRules> {
    const result = await this.pool.query<RulesRow>(
      `
        select
          ruleset_id,
          community_id,
          review_categories,
          auto_hide_report_threshold,
          keyword_blocklist,
          language_preferences,
          announcement_pin_strategy,
          updated_at
        from community_rulesets
        where community_id = $1
        limit 1
      `,
      [communityId]
    );

    const row = result.rows[0];
    return row ? mapCommunityRules(row) : defaultCommunityRules(communityId);
  }

  async upsertCommunityRules(input: {
    actorUserId: string;
    communityId: string;
    rules: Omit<CommunityRules, "community_id" | "updated_at">;
  }): Promise<CommunityRules> {
    const result = await this.pool.query<RulesRow>(
      `
        insert into community_rulesets (
          ruleset_id,
          community_id,
          review_categories,
          auto_hide_report_threshold,
          keyword_blocklist,
          language_preferences,
          announcement_pin_strategy,
          created_by,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
        on conflict (community_id)
        do update
        set
          review_categories = excluded.review_categories,
          auto_hide_report_threshold = excluded.auto_hide_report_threshold,
          keyword_blocklist = excluded.keyword_blocklist,
          language_preferences = excluded.language_preferences,
          announcement_pin_strategy = excluded.announcement_pin_strategy,
          updated_at = now()
        returning
          ruleset_id,
          community_id,
          review_categories,
          auto_hide_report_threshold,
          keyword_blocklist,
          language_preferences,
          announcement_pin_strategy,
          updated_at
      `,
      [
        randomUUID(),
        input.communityId,
        input.rules.review_categories,
        input.rules.auto_hide_report_threshold,
        input.rules.keyword_blocklist,
        input.rules.language_preferences,
        input.rules.announcement_pin_strategy,
        input.actorUserId
      ]
    );

    const row = result.rows[0];
    if (!row) {
      throw new PostsServiceError("Community rules could not be saved", "invalid_state");
    }

    await this.pool.query(
      `
        update communities
        set ruleset_id = $2,
            updated_at = now()
        where community_id = $1
      `,
      [input.communityId, row.ruleset_id]
    );

    return mapCommunityRules(row);
  }

  async listAnnouncements(input: {
    communityId: string;
    includeDeleted?: boolean;
  }): Promise<SyncedAnnouncement[]> {
    const rules = await this.getCommunityRules(input.communityId);
    const params: unknown[] = [input.communityId];
    const conditions = ["community_id = $1"];
    if (!input.includeDeleted) {
      conditions.push("status = 'active'");
      conditions.push("deleted_at is null");
    }

    const orderBy =
      rules.announcement_pin_strategy === "manual"
        ? "coalesce(is_pinned, false) desc, published_at desc, announcement_id desc"
        : "published_at desc, announcement_id desc";

    const result = await this.pool.query<AnnouncementRow>(
      `
        select
          announcement_id,
          community_id,
          title,
          body,
          status,
          is_pinned,
          created_by,
          published_at,
          updated_at,
          p2p_version,
          ipfs_cid
        from announcements
        where ${conditions.join(" and ")}
        order by ${orderBy}
      `,
      params
    );

    return result.rows.map(mapAnnouncement);
  }

  async createAnnouncement(input: {
    actorUserId: string;
    communityId: string;
    title: string;
    body: string;
    isPinned: boolean;
  }): Promise<SyncedAnnouncement> {
    return this.withTransaction(async (queryable) => {
      const result = await queryable.query<AnnouncementRow>(
        `
          insert into announcements (
            announcement_id,
            community_id,
            title,
            body,
            status,
            is_pinned,
            p2p_version,
            created_by,
            published_at,
            updated_at
          )
          values ($1, $2, $3, $4, 'active', $5, 1, $6, now(), now())
          returning
            announcement_id,
            community_id,
            title,
            body,
            status,
            is_pinned,
            created_by,
            published_at,
            updated_at,
            p2p_version,
            ipfs_cid
        `,
        [randomUUID(), input.communityId, input.title, input.body, input.isPinned, input.actorUserId]
      );

      const announcement = await stampAnnouncementSyncMetadata(queryable, result.rows[0]!);
      const syncEvent = await appendAnnouncementSyncEvent(queryable, {
        eventType: 'announcement.published',
        announcement,
        actorUserId: input.actorUserId,
      });

      return {
        ...announcement,
        syncEvents: [syncEvent],
      };
    });
  }

  async updateAnnouncement(input: {
    communityId: string;
    announcementId: string;
    title?: string;
    body?: string;
    isPinned?: boolean;
  }): Promise<SyncedAnnouncement | null> {
    const fields: string[] = [];
    const params: unknown[] = [input.communityId, input.announcementId];

    if (typeof input.title === "string") {
      params.push(input.title);
      fields.push(`title = $${params.length}`);
    }

    if (typeof input.body === "string") {
      params.push(input.body);
      fields.push(`body = $${params.length}`);
    }

    if (typeof input.isPinned === "boolean") {
      params.push(input.isPinned);
      fields.push(`is_pinned = $${params.length}`);
    }

    if (fields.length === 0) {
      const existing = await this.pool.query<AnnouncementRow>(
        `
          select
            announcement_id,
            community_id,
            title,
            body,
            status,
            is_pinned,
            created_by,
            published_at,
            updated_at,
            p2p_version,
            ipfs_cid
          from announcements
          where community_id = $1
            and announcement_id = $2
          limit 1
        `,
        params
      );
      return existing.rows[0] ? mapAnnouncement(existing.rows[0]) : null;
    }

    return this.withTransaction(async (queryable) => {
      const result = await queryable.query<AnnouncementRow>(
        `
          update announcements
          set ${fields.join(", ")},
              p2p_version = p2p_version + 1,
              updated_at = now()
          where community_id = $1
            and announcement_id = $2
          returning
            announcement_id,
            community_id,
            title,
            body,
            status,
            is_pinned,
            created_by,
            published_at,
            updated_at,
            p2p_version,
            ipfs_cid
        `,
        params
      );

      if (!result.rows[0]) {
        return null;
      }

      const announcement = await stampAnnouncementSyncMetadata(queryable, result.rows[0]);
      const syncEvent = await appendAnnouncementSyncEvent(queryable, {
        eventType: announcement.status === 'deleted' ? 'announcement.deleted' : 'announcement.updated',
        announcement,
      });

      return {
        ...announcement,
        syncEvents: [syncEvent],
      };
    });
  }

  async deleteAnnouncement(input: {
    communityId: string;
    announcementId: string;
  }): Promise<SyncedAnnouncement | null> {
    return this.withTransaction(async (queryable) => {
      const result = await queryable.query<AnnouncementRow>(
        `
          update announcements
          set status = 'deleted',
              p2p_version = p2p_version + 1,
              deleted_at = now(),
              updated_at = now()
          where community_id = $1
            and announcement_id = $2
          returning
            announcement_id,
            community_id,
            title,
            body,
            status,
            is_pinned,
            created_by,
            published_at,
            updated_at,
            p2p_version,
            ipfs_cid
        `,
        [input.communityId, input.announcementId]
      );

      if (!result.rows[0]) {
        return null;
      }

      const announcement = await stampAnnouncementSyncMetadata(queryable, result.rows[0]);
      const syncEvent = await appendAnnouncementSyncEvent(queryable, {
        eventType: 'announcement.deleted',
        announcement,
      });

      return {
        ...announcement,
        syncEvents: [syncEvent],
      };
    });
  }

  async getAdminDashboard(communityId: string): Promise<AdminDashboardResponse> {
    const result = await this.pool.query<{
      posts_this_week_request_count: number;
      posts_this_week_offer_count: number;
      accepted_contacts_this_week_count: number;
      reports_this_week_count: number;
      pending_post_review_count: number;
      pending_report_count: number;
    }>(
      `
        select
          (
            select count(*)::int
            from posts p
            where p.community_id = $1
              and p.post_type = 'request'
              and p.created_at >= now() - interval '7 days'
          ) as posts_this_week_request_count,
          (
            select count(*)::int
            from posts p
            where p.community_id = $1
              and p.post_type = 'offer'
              and p.created_at >= now() - interval '7 days'
          ) as posts_this_week_offer_count,
          (
            select count(*)::int
            from contact_requests cr
            join posts p
              on p.post_id = cr.from_post_id
            where p.community_id = $1
              and cr.status = 'accepted'
              and coalesce(cr.responded_at, cr.created_at) >= now() - interval '7 days'
          ) as accepted_contacts_this_week_count,
          (
            select count(*)::int
            from reports r
            where r.community_id = $1
              and r.created_at >= now() - interval '7 days'
          ) as reports_this_week_count,
          (
            select count(*)::int
            from posts p
            where p.community_id = $1
              and p.status = 'pending_review'
          ) as pending_post_review_count,
          (
            select count(*)::int
            from reports r
            where r.community_id = $1
              and r.status = 'new'
          ) as pending_report_count
      `,
      [communityId]
    );

    const row = result.rows[0]!;
    return {
      community_id: communityId,
      posts_this_week_request_count: row.posts_this_week_request_count,
      posts_this_week_offer_count: row.posts_this_week_offer_count,
      accepted_contacts_this_week_count: row.accepted_contacts_this_week_count,
      reports_this_week_count: row.reports_this_week_count,
      pending_post_review_count: row.pending_post_review_count,
      pending_report_count: row.pending_report_count
    };
  }

  async applyReviewDecision(input: ReviewDecisionInput & { decidedAt: string; status: PostStatus }) {
    return this.withTransaction(async (queryable) => {
      // Lock the target row for the duration of the transaction so two anchors
      // deciding the same pending post cannot both succeed and each insert a
      // moderation_actions row. The status filter inside the UPDATE below is a
      // defense-in-depth check; the row lock is the primary guard.
      const lockedResult = await queryable.query<{
        post_id: string;
        status: PostStatus;
        community_id: string;
        updated_at: Date | string;
      }>(
        `
          select post_id, status, community_id, updated_at
          from posts
          where post_id = $1
          limit 1
          for update
        `,
        [input.postId]
      );

      const lockedRow = lockedResult.rows[0];
      if (!lockedRow) {
        return null;
      }

      // If the post is no longer pending review (another anchor decided first,
      // or the author removed it, etc.), short-circuit with an idempotent
      // "already decided" sentinel. The route layer surfaces this as a 200 with
      // the current decision body instead of a 409.
      if (lockedRow.status !== 'pending_review') {
        const current = await this.findPost(input.postId);
        if (!current) {
          return null;
        }

        return {
          post: current,
          moderationActionId: null,
          syncEvents: [],
          alreadyDecided: true as const,
          decidedAt: toIso(lockedRow.updated_at),
        };
      }

      const postResult = await queryable.query<PostRow>(
        `
          update posts
          set status = $2,
              p2p_version = p2p_version + 1,
              updated_at = $3::timestamptz
          where post_id = $1
            and status = 'pending_review'
          returning
            post_id,
            community_id,
            post_type,
            category,
            title,
            body,
            language,
            location_zip,
            privacy,
            status,
            risk_level,
            expires_at,
            created_at,
            updated_at,
            created_by,
            contact_pref,
            p2p_version,
            ipfs_cid
        `,
        [input.postId, input.status, input.decidedAt]
      );

      const row = postResult.rows[0];
      if (!row) {
        // The row lock guarantees the status was pending_review moments ago, so
        // this branch should be unreachable. Treat it defensively as a
        // not-found so the caller surfaces a 404 rather than silently passing.
        return null;
      }

      const post = await stampPostSyncMetadata(queryable, row);

      const actionId = randomUUID();
      await queryable.query(
        `
          insert into moderation_actions (
            action_id,
            anchor_user_id,
            community_id,
            action_type,
            target_type,
            target_id,
            reason,
            created_at
          )
          values ($1, $2, $3, $4, 'post', $5, $6, $7::timestamptz)
        `,
        [
          actionId,
          input.actor.userId,
          post.communityId,
          input.decision,
          post.postId,
          input.notes ?? null,
          input.decidedAt,
        ]
      );

      const syncEvents = await Promise.all([
        appendPostSyncEvent(queryable, {
          eventType: post.status === 'removed' ? 'post.tombstoned' : 'post.updated',
          post,
          actorUserId: input.actor.userId,
          reason: input.decision,
        }),
        appendCommunitySyncEvent(queryable, {
          communityId: post.communityId,
          topicKey: 'reports',
          eventType: 'moderation.decision',
          aggregateType: 'moderation',
          aggregateId: actionId,
          actorUserId: input.actor.userId,
          occurredAt: input.decidedAt,
          payload: {
            report_id: null,
            target_type: 'post',
            target_id: post.postId,
            report_target_type: 'post',
            report_target_id: post.postId,
            resolution: input.decision,
            status: post.status,
            decided_at: input.decidedAt,
          },
        }),
      ]);

      return {
        post,
        moderationActionId: actionId,
        syncEvents,
        alreadyDecided: false as const,
        decidedAt: input.decidedAt,
      };
    });
  }
}

export function createPostsRepository(connectionString: string) {
  return new PostsRepository(
    new Pool({
      connectionString,
    })
  );
}

export { canViewPost, toPostDetail, toSummary };
