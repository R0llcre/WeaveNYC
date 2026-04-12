# WeaveNYC — Database Schema Reference

> 基于 [08_Data_Model](./08_Data_Model.md) 的领域实体定义，本文档提供完整的 Drizzle ORM schema（TypeScript）和对应的 SQL DDL，可直接用于实现。

---

## 1) Schema 文件结构

```
packages/db/
├── src/schema/
│   ├── users.ts                  # 用户
│   ├── communities.ts            # 社区 / membership
│   ├── community-access-codes.ts # join invite / qr
│   ├── anchor-invites.ts         # Anchor 激活邀请码
│   ├── community-rulesets.ts     # 社区规则
│   ├── anchors.ts                # Anchor 账号与 TOTP
│   ├── announcements.ts          # 公告
│   ├── posts.ts                  # 帖子（Request/Offer）
│   ├── dataset-versions.ts       # 官方资源导入批次
│   ├── resource-providers.ts     # 官方资源
│   ├── resource-change-logs.ts   # 资源版本变更记录
│   ├── verification-logs.ts      # 资源人工校验记录
│   ├── match-suggestions.ts      # 匹配结果
│   ├── contact-requests.ts       # 建联请求
│   ├── conversations.ts          # 会话
│   ├── messages.ts               # 消息
│   ├── reports.ts                # 举报
│   ├── moderation-actions.ts     # 审核操作
│   └── index.ts                  # 统一导出
├── migrations/               # drizzle-kit 生成
├── seed/                     # 种子数据
│   ├── resources.seed.ts     # 官方资源测试数据
│   └── posts.seed.ts         # 模拟帖子数据
└── drizzle.config.ts         # Drizzle Kit 配置
```

---

## 2) 完整 Drizzle Schema

### 2.1 users.ts

```typescript
import { pgTable, uuid, varchar, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const userStatusEnum = pgEnum('user_status', ['active', 'suspended', 'deleted']);
export const userLevelEnum = pgEnum('user_level', ['anonymous', 'verified', 'anchor']);

export const users = pgTable('users', {
  userId:              uuid('user_id').primaryKey().defaultRandom(),
  displayName:         varchar('display_name', { length: 50 }),
  preferredLanguages:  text('preferred_languages').array(),          // ['en', 'es']
  homeZip:             varchar('home_zip', { length: 10 }),
  phoneHash:           varchar('phone_hash', { length: 64 }),        // HMAC-SHA256(pepper, salt + ':' + normalized_phone)
  phoneHashSalt:       varchar('phone_hash_salt', { length: 64 }),
  emailHash:           varchar('email_hash', { length: 64 }),        // HMAC-SHA256(pepper, salt + ':' + normalized_email)
  emailHashSalt:       varchar('email_hash_salt', { length: 64 }),
  level:               userLevelEnum('level').notNull().default('anonymous'),
  status:              userStatusEnum('status').notNull().default('active'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### 2.2 communities.ts

```typescript
import { pgTable, uuid, varchar, pgEnum, timestamp, primaryKey } from 'drizzle-orm/pg-core';

export const joinPolicyEnum = pgEnum('join_policy', ['invite_only', 'open']);

export const communities = pgTable('communities', {
  communityId:  uuid('community_id').primaryKey().defaultRandom(),
  name:         varchar('name', { length: 100 }).notNull(),
  centerZip:    varchar('center_zip', { length: 10 }).notNull(),
  joinPolicy:   joinPolicyEnum('join_policy').notNull().default('invite_only'),
  rulesetId:    uuid('ruleset_id'),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 用户-社区多对多关系（联合主键去重）
export const communityMembers = pgTable('community_members', {
  userId:       uuid('user_id').notNull().references(() => users.userId),
  communityId:  uuid('community_id').notNull().references(() => communities.communityId),
  joinedAt:     timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  communityMemberPk: primaryKey({ columns: [table.userId, table.communityId] }),
}));
```

### 2.3 anchor-admin tables

```typescript
import { pgTable, uuid, varchar, text, integer, boolean, jsonb, timestamp, pgEnum, uniqueIndex, index } from 'drizzle-orm/pg-core';

export const anchorInviteStatusEnum = pgEnum('anchor_invite_status', ['active', 'consumed', 'revoked']);
export const anchorStatusEnum = pgEnum('anchor_status', ['pending_activation', 'active', 'revoked']);
export const announcementStatusEnum = pgEnum('announcement_status', ['active', 'deleted']);
export const announcementPinStrategyEnum = pgEnum('announcement_pin_strategy', ['latest', 'manual']);

export const anchorInvites = pgTable('anchor_invites', {
  anchorInviteId: uuid('anchor_invite_id').primaryKey().defaultRandom(),
  communityId: uuid('community_id').notNull().references(() => communities.communityId),
  codeHash: varchar('code_hash', { length: 64 }).notNull(),
  orgName: varchar('org_name', { length: 200 }),
  status: anchorInviteStatusEnum('status').notNull().default('active'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  consumedByUserId: uuid('consumed_by_user_id').references(() => users.userId),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  codeHashUq: uniqueIndex('uq_anchor_invites_code_hash').on(table.codeHash),
  communityStatusIdx: index('idx_anchor_invites_community_status').on(table.communityId, table.status, table.createdAt),
}));

export const communityRulesets = pgTable('community_rulesets', {
  rulesetId: uuid('ruleset_id').primaryKey().defaultRandom(),
  communityId: uuid('community_id').notNull().references(() => communities.communityId),
  reviewCategories: text('review_categories').array().notNull(),
  autoHideReportThreshold: integer('auto_hide_report_threshold').notNull().default(3),
  keywordBlocklist: text('keyword_blocklist').array().notNull(),
  languagePreferences: text('language_preferences').array().notNull(),
  announcementPinStrategy: announcementPinStrategyEnum('announcement_pin_strategy').notNull().default('latest'),
  createdBy: uuid('created_by').references(() => users.userId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  communityRulesetUq: uniqueIndex('uq_community_rulesets_community').on(table.communityId),
}));

export const anchors = pgTable('anchors', {
  anchorId:       uuid('anchor_id').primaryKey().defaultRandom(),
  userId:         uuid('user_id').references(() => users.userId),
  communityId:    uuid('community_id').notNull().references(() => communities.communityId),
  orgName:        varchar('org_name', { length: 200 }).notNull(),
  contact:        varchar('contact', { length: 200 }),
  status:         anchorStatusEnum('status').notNull().default('pending_activation'),
  totpSecretCiphertext: text('totp_secret_ciphertext'),
  recoveryCodesHashes: text('recovery_codes_hashes').array(),
  activatedAt:    timestamp('activated_at', { withTimezone: true }),
  lastMfaAt:      timestamp('last_mfa_at', { withTimezone: true }),
  roleAssignments: jsonb('role_assignments'),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx: uniqueIndex('uq_anchors_user').on(table.userId),
  activeCommunityUq: uniqueIndex('uq_anchors_active_community').on(table.communityId),
}));

export const announcements = pgTable('announcements', {
  announcementId: uuid('announcement_id').primaryKey().defaultRandom(),
  communityId: uuid('community_id').notNull().references(() => communities.communityId),
  title: varchar('title', { length: 140 }).notNull(),
  body: text('body').notNull(),
  status: announcementStatusEnum('status').notNull().default('active'),
  isPinned: boolean('is_pinned').notNull().default(false),
  createdBy: uuid('created_by').notNull().references(() => users.userId),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});
```

### 2.4 posts.ts

```typescript
import { pgTable, uuid, varchar, text, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';

export const postTypeEnum = pgEnum('post_type', ['request', 'offer']);
export const categoryEnum = pgEnum('category', [
  'food', 'goods', 'childcare', 'companionship', 'translation', 'transportation', 'other'
]);
export const privacyEnum = pgEnum('privacy', ['community_only', 'public', 'anchor_mediated']);
export const postStatusEnum = pgEnum('post_status', [
  'draft', 'pending_review', 'active', 'fulfilled', 'closed', 'removed'
]);
export const riskLevelEnum = pgEnum('risk_level', ['low', 'medium', 'high']);
export const verificationEnum = pgEnum('verification_state', [
  'unverified', 'verified_by_anchor', 'verified_by_witnesses'
]);
export const languageEnum = pgEnum('language', ['en', 'es', 'zh']);

export const posts = pgTable('posts', {
  postId:             uuid('post_id').primaryKey().defaultRandom(),
  postType:           postTypeEnum('post_type').notNull(),
  category:           categoryEnum('category').notNull(),
  title:              varchar('title', { length: 60 }).notNull(),
  body:               text('body').notNull(),                         // ≤ 280 字
  language:           languageEnum('language').notNull().default('en'),
  locationZip:        varchar('location_zip', { length: 10 }).notNull(),
  privacy:            privacyEnum('privacy').notNull().default('community_only'),
  expiresAt:          timestamp('expires_at', { withTimezone: true }).notNull(),
  createdBy:          uuid('created_by').notNull().references(() => users.userId),
  communityId:        uuid('community_id').notNull().references(() => communities.communityId),
  status:             postStatusEnum('status').notNull().default('draft'),
  riskLevel:          riskLevelEnum('risk_level').notNull().default('low'),
  verificationState:  verificationEnum('verification_state').notNull().default('unverified'),
  contactPref:        jsonb('contact_pref'),                           // {"in_app_chat": true, "call": false}
  ipfsCid:            varchar('ipfs_cid', { length: 100 }),           // IPFS CID（opt-in 后填充）
  createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:          timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  communityStatusIdx: index('idx_posts_community_status')
    .on(table.communityId, table.status, table.category, table.expiresAt),
  communityZipIdx: index('idx_posts_community_zip')
    .on(table.communityId, table.locationZip, table.status, table.expiresAt),
  createdByIdx: index('idx_posts_created_by').on(table.createdBy),
}));
```

### 2.5 dataset-versions.ts

```typescript
import { pgTable, uuid, varchar, text, integer, timestamp, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core';

export const datasetVersionStatusEnum = pgEnum('dataset_version_status', [
  'importing', 'active', 'superseded', 'failed'
]);

export const datasetVersions = pgTable('dataset_versions', {
  datasetVersionId:    uuid('dataset_version_id').primaryKey().defaultRandom(),
  source:              varchar('source', { length: 50 }).notNull(),
  datasetVersion:      varchar('dataset_version', { length: 50 }).notNull(),
  sourceLabel:         varchar('source_label', { length: 120 }),
  sourceUrl:           text('source_url'),
  recordCount:         integer('record_count').notNull(),
  activeRecordCount:   integer('active_record_count').notNull().default(0),
  status:              datasetVersionStatusEnum('status').notNull().default('importing'),
  checksum:            varchar('checksum', { length: 64 }),
  importStartedAt:     timestamp('import_started_at', { withTimezone: true }).notNull(),
  importCompletedAt:   timestamp('import_completed_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  datasetSourceUq: uniqueIndex('uq_dataset_versions_source_version')
    .on(table.source, table.datasetVersion),
}));
```

### 2.6 resource-providers.ts

```typescript
import { pgTable, uuid, varchar, text, jsonb, timestamp, doublePrecision, index, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core';

export const resourceStatusEnum = pgEnum('resource_status', ['active', 'inactive']);

export const resourceProviders = pgTable('resource_providers', {
  providerId:       uuid('provider_id').primaryKey().defaultRandom(),
  source:           varchar('source', { length: 50 }).notNull(),        // cfc_active, island_harvest, manual
  sourceRef:        varchar('source_ref', { length: 200 }).notNull(),
  name:             varchar('name', { length: 200 }).notNull(),
  type:             varchar('type', { length: 50 }).notNull(),          // pantry, soup_kitchen, cooling_center, other
  addressText:      text('address_text').notNull(),
  city:             varchar('city', { length: 100 }),
  state:            varchar('state', { length: 50 }),
  zip:              varchar('zip', { length: 10 }).notNull(),
  phone:            varchar('phone', { length: 30 }),
  hoursJson:        jsonb('hours_json'),                                // { mon: "09:00-17:00", ... }
  languages:        text('languages').array(),
  eligibilityNotes: text('eligibility_notes'),
  lat:              doublePrecision('lat'),
  lng:              doublePrecision('lng'),
  geoPrecision:     varchar('geo_precision', { length: 20 }).default('zip_centroid'),
  contentHash:      varchar('content_hash', { length: 64 }),
  datasetVersion:   varchar('dataset_version', { length: 50 }).notNull()
    .references(() => datasetVersions.datasetVersion),
  status:           resourceStatusEnum('status').notNull().default('active'),
  lastSeenAt:       timestamp('last_seen_at', { withTimezone: true }),
  lastVerifiedAt:   timestamp('last_verified_at', { withTimezone: true }),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  zipTypeIdx: index('idx_resources_zip_type').on(table.zip, table.type),
  sourceRefIdx: index('idx_resources_source_ref').on(table.source, table.sourceRef),
  datasetStatusIdx: index('idx_resources_dataset_status').on(table.datasetVersion, table.status),
  sourceRefVersionUq: uniqueIndex('uq_resources_source_ref_version')
    .on(table.source, table.sourceRef, table.datasetVersion),
  // PostGIS 空间索引需通过 raw SQL migration 添加：
  // CREATE INDEX idx_resources_geom ON resource_providers
  //   USING GIST (ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography);
}));
```

**Required SQL migration for active-version invariant**:
```sql
CREATE UNIQUE INDEX uq_resources_active_source_ref
ON resource_providers (source, source_ref)
WHERE status = 'active';
```

上面的 partial unique index 不是可选优化，而是保证“同一 `(source, source_ref)` 任意时刻只有 1 条 `active` 记录”的必需约束。

### 2.7 match-suggestions.ts

```typescript
import { pgTable, uuid, varchar, doublePrecision, text, timestamp } from 'drizzle-orm/pg-core';

export const matchSuggestions = pgTable('match_suggestions', {
  suggestionId:    uuid('suggestion_id').primaryKey().defaultRandom(),
  requestPostId:   uuid('request_post_id').notNull().references(() => posts.postId),
  candidateType:   varchar('candidate_type', { length: 30 }).notNull(), // neighbor_post | official_resource
  candidateId:     uuid('candidate_id').notNull(),                      // post_id 或 provider_id
  score:           doublePrecision('score').notNull(),                   // 0-1
  reasons:         text('reasons').array(),                              // ['距离近', '语言匹配', '今天开放']
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### 2.8 contact-requests.ts, conversations.ts & messages.ts

```typescript
import { pgTable, uuid, text, timestamp, index, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core';

export const contactRequestStatusEnum = pgEnum('contact_request_status', [
  'pending', 'accepted', 'rejected', 'expired', 'cancelled'
]);

export const contactRequests = pgTable('contact_requests', {
  contactRequestId:  uuid('contact_request_id').primaryKey().defaultRandom(),
  fromPostId:        uuid('from_post_id').notNull().references(() => posts.postId),
  toPostId:          uuid('to_post_id').notNull().references(() => posts.postId),
  requesterUserId:   uuid('requester_user_id').notNull().references(() => users.userId),
  recipientUserId:   uuid('recipient_user_id').notNull().references(() => users.userId),
  status:            contactRequestStatusEnum('status').notNull().default('pending'),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  respondedAt:       timestamp('responded_at', { withTimezone: true }),
  expiresAt:         timestamp('expires_at', { withTimezone: true }).notNull(),
}, (table) => ({
  recipientStatusIdx: index('idx_contact_requests_recipient_status')
    .on(table.recipientUserId, table.status, table.createdAt),
}));

export const conversations = pgTable('conversations', {
  conversationId:   uuid('conversation_id').primaryKey().defaultRandom(),
  participants:     uuid('participants').array().notNull(),               // [user_id, user_id]
  relatedPostIds:   uuid('related_post_ids').array(),
  contactRequestId: uuid('contact_request_id').notNull().references(() => contactRequests.contactRequestId),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastActivityAt:   timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  contactRequestUq: uniqueIndex('uq_conversations_contact_request_id')
    .on(table.contactRequestId),
}));

export const messages = pgTable('messages', {
  messageId:        uuid('message_id').primaryKey().defaultRandom(),
  conversationId:   uuid('conversation_id').notNull().references(() => conversations.conversationId),
  senderUserId:     uuid('sender_user_id').notNull().references(() => users.userId),
  body:             text('body').notNull(),
  safetyFlags:      text('safety_flags').array(),                        // ['ssn_detected', 'phone_detected']
  sentAt:           timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  conversationIdx: index('idx_messages_conversation').on(table.conversationId, table.sentAt),
}));
```

### 2.9 reports.ts & moderation-actions.ts

```typescript
import { pgTable, uuid, varchar, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const reportStatusEnum = pgEnum('report_status', ['new', 'resolved', 'dismissed']);
export const reportReasonEnum = pgEnum('report_reason', [
  'harassment', 'scam', 'misinformation', 'unsafe_behavior', 'other'
]);
export const resolutionEnum = pgEnum('resolution', ['remove_post', 'suspend_user', 'warn', 'none']);

export const reports = pgTable('reports', {
  reportId:         uuid('report_id').primaryKey().defaultRandom(),
  communityId:      uuid('community_id').notNull().references(() => communities.communityId),
  targetType:       varchar('target_type', { length: 20 }).notNull(),  // post | user | message
  targetId:         uuid('target_id').notNull(),
  reason:           reportReasonEnum('reason').notNull(),
  detailText:       text('detail_text'),
  conversationId:   uuid('conversation_id').references(() => conversations.conversationId),
  reporterUserId:   uuid('reporter_user_id').notNull().references(() => users.userId),
  status:           reportStatusEnum('status').notNull().default('new'),
  resolution:       resolutionEnum('resolution'),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt:       timestamp('resolved_at', { withTimezone: true }),
});

export const moderationActions = pgTable('moderation_actions', {
  actionId:         uuid('action_id').primaryKey().defaultRandom(),
  reportId:         uuid('report_id').references(() => reports.reportId),
  anchorUserId:     uuid('anchor_user_id').references(() => users.userId),
  communityId:      uuid('community_id').notNull().references(() => communities.communityId),
  actionType:       varchar('action_type', { length: 30 }).notNull(),  // approve | reject | request_more_info | dismiss | warn | remove_post | suspend_user
  targetType:       varchar('target_type', { length: 20 }).notNull(),
  targetId:         uuid('target_id').notNull(),
  reason:           text('reason'),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

---

### 2.10 resource-change-logs.ts & verification-logs.ts

```typescript
import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';

export const resourceChangeLogs = pgTable('resource_change_logs', {
  changeLogId:        uuid('change_log_id').primaryKey().defaultRandom(),
  source:             varchar('source', { length: 50 }).notNull(),
  sourceRef:          varchar('source_ref', { length: 200 }).notNull(),
  datasetVersion:     varchar('dataset_version', { length: 50 }).notNull()
    .references(() => datasetVersions.datasetVersion),
  changeType:         varchar('change_type', { length: 20 }).notNull(), // added | removed | updated
  changedFields:      text('changed_fields').array(),
  contentHashBefore:  varchar('content_hash_before', { length: 64 }),
  contentHashAfter:   varchar('content_hash_after', { length: 64 }),
  createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const verificationLogs = pgTable('verification_logs', {
  verificationLogId:  uuid('verification_log_id').primaryKey().defaultRandom(),
  providerId:         uuid('provider_id').notNull().references(() => resourceProviders.providerId),
  verifier:           varchar('verifier', { length: 100 }).notNull(),
  method:             varchar('method', { length: 30 }).notNull(), // phone_check | site_check | manual_review
  result:             varchar('result', { length: 30 }).notNull(), // confirmed | changed | unreachable
  notes:              text('notes'),
  createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

---

## 3) PostGIS 扩展初始化

```sql
-- 在初始 migration 中启用 PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- 资源提供者空间索引
CREATE INDEX idx_resources_geom ON resource_providers
  USING GIST (ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography);
```

---

## 4) Drizzle Kit 配置

```typescript
// packages/db/drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
} satisfies Config;
```

---

## 5) 种子数据示例

```typescript
// packages/db/seed/resources.seed.ts
import { db } from '../client';
import { datasetVersions, resourceProviders } from '../schema';

const seedDatasetVersions = [
  {
    source: 'cfc_active',
    datasetVersion: 'cfc_active_2026-02-26',
    sourceLabel: 'NYC HRA Community Food Connection',
    recordCount: 512,
    activeRecordCount: 512,
    status: 'active',
    importStartedAt: new Date('2026-02-26T10:00:00Z'),
    importCompletedAt: new Date('2026-02-26T10:15:00Z'),
  },
];

const seedResources = [
  {
    source: 'cfc_active',
    sourceRef: 'cfc_active:st-kilian-farmingdale',
    name: 'St. Kilian Parish Social Ministry',
    type: 'pantry',
    addressText: '140 Elizabeth Street, Farmingdale, NY',
    city: 'Farmingdale',
    state: 'NY',
    zip: '11735',
    phone: '516-756-9656',
    hoursJson: { mon: '09:30-12:30', tue: '09:30-12:30' },
    languages: ['en', 'es'],
    eligibilityNotes: 'Call ahead for current requirements.',
    lat: 40.7326,
    lng: -73.4454,
    geoPrecision: 'street',
    datasetVersion: 'cfc_active_2026-02-26',
    status: 'active',
  },
  // ... 更多种子数据
];

export async function seed() {
  await db.insert(datasetVersions).values(seedDatasetVersions);
  await db.insert(resourceProviders).values(seedResources);
  console.log(`Seeded ${seedDatasetVersions.length} dataset versions and ${seedResources.length} resource providers`);
}
```

---

## 6) IndexedDB Schema（客户端 — Dexie.js）

详见 [08_Data_Model §3.3](./08_Data_Model.md)。

```typescript
// packages/shared/dexie-schema.ts
import Dexie, { type Table } from 'dexie';

interface PostCache {
  post_id: string;
  community_id: string;
  category: string;
  title: string;
  body: string;
  status: string;
  expires_at: string;
  ipfs_cid?: string;
  synced_at: string;
}

interface Bookmark {
  id?: number;
  type: 'resource' | 'post';
  target_id: string;
  created_at: string;
}

interface Draft {
  id?: number;
  post_type: 'request' | 'offer';
  category: string;
  title: string;
  body: string;
  updated_at: string;
}

interface Setting {
  key: string;
  value: unknown;
}

interface KeyPair {
  key_type: 'ed25519';
  public_key: string;
  private_key: string;  // 加密存储
  community_id: string;
}

class WeaveNYCDatabase extends Dexie {
  post_cache!: Table<PostCache>;
  bookmarks!: Table<Bookmark>;
  drafts!: Table<Draft>;
  settings!: Table<Setting>;
  device!: Table<{ key: string; value: string }>;
  device_keys!: Table<KeyPair>;

  constructor() {
    super('weavenyc');
    this.version(1).stores({
      post_cache: 'post_id, community_id, category, status, expires_at',
      bookmarks: '++id, type, target_id, created_at',
      drafts: '++id, post_type, category, updated_at',
      settings: 'key',
      device: 'key',
      device_keys: 'key_type, community_id',
    });
  }
}

export const db = new WeaveNYCDatabase();
```
