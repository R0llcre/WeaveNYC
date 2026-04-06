import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';

import type {
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
  };
}

function toPostDetail(actor: PostActor, record: PostRecord): PostDetail {
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
  };
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
    const result = await this.pool.query<PostRow>(
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
          created_at,
          updated_at
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz,
          $10, $11, $12, $13, $14, $15::jsonb, now(), now()
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
          contact_pref
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

    return mapPostRow(row);
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
          contact_pref
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

    const result = await this.pool.query<PostRow>(
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
          contact_pref
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

    return mapPostRow(row);
  }

  async setPostStatus(postId: string, status: PostStatus) {
    const result = await this.pool.query<PostRow>(
      `
        update posts
        set status = $2, updated_at = now()
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
          contact_pref
      `,
      [postId, status]
    );

    const row = result.rows[0];
    return row ? mapPostRow(row) : null;
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
          contact_pref
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
          contact_pref
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
          contact_pref
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

  async recordModerationDecision(input: ReviewDecisionInput, post: PostRecord) {
    await this.pool.query(
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
        values ($1, $2, $3, $4, 'post', $5, $6, now())
      `,
      [
        randomUUID(),
        input.actor.userId,
        post.communityId,
        input.decision,
        post.postId,
        input.notes ?? null,
      ]
    );
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
