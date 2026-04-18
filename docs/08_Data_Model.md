# WeaveNYC — Data Model (Domain + Storage)

目标：把领域实体、字段、索引、隐私分级写清楚。

> 当前 `main` 的 canonical baseline 是 `M7 completed`；本文件中的 P2P 同步元数据和本地缓存扩展已经进入主线，当前只把 `M8` 作为 pilot readiness 规划边界。

---

## 1) 数据分区（Privacy by Design）

> **当前 M6 canonical 三层结构**：IndexedDB（客户端只读缓存）→ HTTP/WebSocket sync overlay（社区事件传播）→ PostgreSQL + PostGIS（authoritative data + replay log）。

### 1.1 Local-only — IndexedDB（Dexie.js）
**默认仅本地，不离开设备**：

| 数据类型 | Dexie 表名 | 说明 |
|----------|-----------|------|
| 用户设置 | `settings` | 语言、隐私偏好、主题、字体大小 |
| 草稿 | `drafts` | 未发布的 Request/Offer |
| 最近浏览/收藏 | `bookmarks` | 收藏的资源/帖子 CID |
| 离线帖子缓存 | `post_cache` | 已订阅社区的帖子摘要快照 |
| 离线公告缓存 | `announcement_cache` | 社区公告快照 |
| P2P 密钥 | `p2p_keys` | Ed25519 设备密钥（按社区隔离） |
| P2P 同步状态 | `p2p_sync_state` | 是否启用、最近同步时间、peer 数 |
| P2P 事件游标 | `p2p_event_cursor` | 最近一次 HTTP catch-up / Gossip replay 游标 |
| 密钥 | `device_keys` | Ed25519 私钥（加密存储） |
| 本地设备标识 | `device` | 匿名 device_id（不关联真实身份） |

**容量预估**：单个社区 ~500 帖子缓存 ≈ 2-5 MB，IndexedDB 配额通常 ≥ 50 MB，足够。

### 1.2 Community-shared — Sync Overlay
**用户 opt-in 后接收社区同步副本，不直接做 edge publish**：

| 数据类型 | 当前载体 | 说明 |
|----------|----------|------|
| 帖子摘要 | `post.*` sync events | 社区只读缓存修复 |
| 公告摘要 | `announcement.*` sync events | 社区公告只读缓存修复 |
| 举报状态 | `report.created` sync events | 仅 post-target，最小字段 |
| 审核状态 | `moderation.decision` sync events | 仅 post-target，Anchor wins |

**当前不进入 overlay**：姓名、精确地址、身份证件、聊天内容、`user/message` report、conversation metadata。

### 1.3 Cloud-shared — PostgreSQL + PostGIS
**云端聚合索引，用于搜索/匹配/分析**：

| 数据类型 | PostgreSQL 表 | 说明 |
|----------|--------------|------|
| 官方资源目录 | `resource_providers` | 完整字段 + PostGIS 地理索引 |
| 帖子索引 | `posts` | 结构化字段（从 IPFS 同步），用于匹配引擎查询 |
| 匹配结果 | `match_suggestions` | 匹配引擎输出，关联 request_post_id |
| 用户账户 | `users` | 基础信息（user_id、display_name、home_zip），不存敏感信息 |
| 社区/Anchor | `communities`, `community_access_codes`, `anchor_invites`, `anchors` | 社区元数据、加入入口、Anchor 激活与会话归属 |
| 规则/公告 | `community_rulesets`, `announcements` | 社区审核规则、公告 banner 与公告列表 |
| P2P 事件日志 | `community_sync_events` | 当前主线使用的 M6 事件追加日志（posts / announcements / reports / moderation） |
| 导入批次 | `dataset_versions` | 官方资源导入批次元数据（来源、记录数、状态） |
| 社区成员关系 | `community_members` | 用户与社区的 membership 关系（联合主键 `(user_id, community_id)`） |
| 建联请求 | `contact_requests` | 双向同意前的联系请求状态机 |
| 会话/消息 | `conversations`, `messages` | 双向同意后才创建的聊天数据（`contact_request_id` 一对一） |
| 举报/审核 | `reports`, `moderation_actions` | 审计日志 |
| 资源版本变更 | `resource_change_logs` | 导入 diff 记录（新增/删除/字段变化） |
| 资源人工校验 | `verification_logs` | 抽查与人工拨号核验记录 |
| 聚合指标 | `analytics_events` | 匿名化事件日志（不含 PII） |

**对象存储（S3 / GCS / Azure Blob）**：
- 官方目录原始快照（CSV/JSON 备份）
- 数据库备份（每日全量 + WAL 增量）

### 1.4 数据流向总览

```
Edge (IndexedDB)  ──opt-in──>  Sync Overlay (WebSocket + /sync)  ──replay──>  Cloud (PostgreSQL)
     ↑                                   ↑                                   ↑
   本地草稿/设置                 社区只读缓存修复                    authoritative writes + event log
   密钥/收藏                     offline catch-up                    官方资源 + 分析
```

---

## 2) 领域实体（Domain Entities）

### 2.1 User
> MVP 可只实现"匿名用户 + 轻量登录"，不要求实名。

字段：
- `user_id` (uuid)
- `display_name` (string, optional)
- `preferred_languages` (array)
- `home_zip` (string)
- `memberships` (via `community_members`)
- `community_members` 以 `(user_id, community_id)` 联合主键去重
- `created_at`, `updated_at`
- `status` (active, suspended, deleted)
- `level` (anonymous, verified, anchor) — 身份等级，决定可见 API surface 与可执行动作
  - `anonymous`：首次匿名会话，可浏览官方资源 + 本地草稿，不能发帖/建联
  - `verified`：已通过 OTP / Magic Link 升级，可发帖、建联、收件箱
  - `anchor`：已通过 invite code + TOTP 激活的社区锚点管理员，可访问 `/v1/admin/**`
  - 详见 `docs/18_Auth_Design.md §5.1` 能力矩阵；`packages/shared/src/auth.ts authLevelRank` 定义排序

### 2.2 Community
字段：
- `community_id` (uuid)
- `name` (Farmingdale, Queens-Astoria, Bronx-MottHaven...)
- `center_zip` (string)
- `join_policy` (invite_only, open)
- `ruleset_id` (uuid, 指向当前生效的 `community_rulesets.ruleset_id`)
- `members` (via `community_members`)
- `community_members` 不允许同一用户重复加入同一社区

### 2.3 Anchor
字段：
- `anchor_id` (uuid)
- `user_id` (uuid, optional until activation confirm)
- `community_id` (uuid)
- `org_name` (string)
- `contact` (string, optional)
- `status` (pending_activation, active, revoked)
- `totp_secret_ciphertext` (text, server-encrypted)
- `recovery_codes_hashes` (string[])
- `activated_at`, `last_mfa_at`
- `role_assignments` (admins/mods)

### 2.3.1 AnchorInvite
字段：
- `anchor_invite_id` (uuid)
- `community_id` (uuid)
- `code_hash` (string, 单次使用，不存明文)
- `status` (active, consumed, revoked)
- `expires_at` (optional)
- `consumed_by_user_id`, `consumed_at`
- `created_at`

### 2.3.2 CommunityRuleset
字段：
- `ruleset_id` (uuid)
- `community_id` (uuid, unique)
- `review_categories` (string[])
- `auto_hide_report_threshold` (int, 1-20)
- `keyword_blocklist` (string[])
- `language_preferences` (en, es, zh)
- `announcement_pin_strategy` (latest, manual)
- `created_by`, `created_at`, `updated_at`

### 2.3.3 Announcement
字段：
- `announcement_id` (uuid)
- `community_id` (uuid)
- `title`, `body`
- `status` (active, deleted)
- `is_pinned` (boolean)
- `ipfs_cid` (string, optional, M6 canonical)
- `p2p_version` (int, M6 canonical)
- `created_by`
- `published_at`, `updated_at`, `deleted_at`

### 2.4 ResourceProvider（官方资源点）
字段：
- `provider_id` (uuid)
- `source` (cfc_active, island_harvest, manual)
- `source_ref` (string)
- `name`, `type`
- `address_text`, `city`, `state`, `zip`, `phone`
- `hours_json` (structured)
- `languages` (string[])
- `eligibility_notes` (text)
- `lat`, `lng`, `geo_precision`（exact, rooftop, street, zip_centroid；默认 `zip_centroid`）
- `content_hash`
- `dataset_version`
- `status` (active, inactive)
- `last_seen_at`, `last_verified_at`
- `created_at`, `updated_at`

### 2.5 Post（Request/Offer）
字段：
- `post_id` (uuid)
- `post_type` (enum: request|offer)
- `category` (enum: food, goods, childcare, companionship, translation, transportation, other)
- `title` (string, ≤ 60 字, required)
- `body` (text, ≤ 280 字, required) — 与 [03_User_Flows §3 Screen 6](./03_User_Flows_And_Screens.md) 的描述长度限制一致
- `language` (enum: en|es|zh)
- `location_zip` (string, 5 位)  # MVP 用 ZIP
- `privacy` (enum: community_only|public|anchor_mediated) — 枚举值全小写蛇形命名
- `expires_at` (datetime, 默认 24h)
- `created_by` (user_id, FK)
- `community_id` (uuid, FK)
- `status` (enum: draft, pending_review, active, fulfilled, closed, removed)
- `risk_level` (enum: low, medium, high)
- `verification_state` (enum: unverified, verified_by_anchor, verified_by_witnesses)
- `contact_pref` (jsonb, 可选) — 联系偏好，如 `{"in_app_chat": true, "call": false}`
- `p2p_version` (int, M6 canonical；内容版本单调递增)
- `ipfs_cid` (string, optional, M6 canonical 内容寻址标识)
- `created_at`, `updated_at` (datetime)

### 2.6 MatchSuggestion
字段：
- `suggestion_id` (uuid)
- `request_post_id`
- `candidate_type` (neighbor_post, official_resource)
- `candidate_id` (post_id 或 provider_id)
- `score` (0-1)
- `reasons` (array of strings)

### 2.7 Conversation & Message
字段（ContactRequest）：
- `contact_request_id`
- `from_post_id`
- `to_post_id`
- `requester_user_id`
- `recipient_user_id`
- `status` (pending, accepted, rejected, expired, cancelled)
- `created_at`, `responded_at`, `expires_at`

字段（Conversation）：
- `conversation_id`
- `contact_request_id`（唯一；一个 contact_request 只能生成一个 conversation）
- `participants` (user_ids)
- `related_post_ids`
- `created_at`, `last_activity_at`

字段（Message）：
- `message_id`
- `conversation_id`
- `sender_user_id`
- `body`
- `sent_at`
- `safety_flags` (array)

### 2.8 Report & ModerationAction（举报与处置）
字段：
- `report_id`
- `target_type` (post, user, message)
- `target_id`
- `reason` (harassment, scam, misinformation, unsafe_behavior, other)
- `detail_text` (optional)
- `reporter_user_id`
- `status` (new, resolved, dismissed)
- `resolution` (remove_post, suspend_user, warn, none)

字段（ModerationAction）：
- `action_id`
- `report_id`
- `anchor_user_id` (optional for system-triggered moderation)
- `community_id`
- `action_type` (approve, reject, request_more_info, dismiss, warn, remove_post, suspend_user)
- `target_type`
- `target_id`
- `reason` (optional)
- `created_at`

### 2.9 DatasetVersionBatch（导入批次）
字段：
- `dataset_version`
- `source`
- `source_label` (optional)
- `source_url` (optional)
- `record_count`
- `active_record_count`
- `status` (importing, active, superseded, failed)
- `checksum` (optional)
- `import_started_at`
- `import_completed_at`
- `created_at`

约束：
- 每个 `(source, dataset_version)` 只允许 1 条批次记录

### 2.10 ResourceChangeLog & VerificationLog
字段（ResourceChangeLog）：
- `change_log_id`
- `source`
- `source_ref`
- `dataset_version` (FK -> `dataset_versions.dataset_version`)
- `change_type` (added, removed, updated)
- `changed_fields` (array)
- `content_hash_before`, `content_hash_after`
- `created_at`

字段（VerificationLog）：
- `verification_log_id`
- `provider_id`
- `verifier`
- `method` (phone_check, site_check, manual_review)
- `result` (confirmed, changed, unreachable)
- `notes`
- `created_at`

### 2.11 CommunitySyncEvent（M6 canonical）
字段：
- `sync_event_id`
- `community_id`
- `event_type` (`post.published`, `post.updated`, `post.tombstoned`, `announcement.published`, `announcement.updated`, `announcement.deleted`, `report.created`, `moderation.decision`)
- `aggregate_type` (`post`, `announcement`, `report`, `moderation`)
- `aggregate_id`
- `actor_p2p_id` (optional)
- `payload_json`
- `cid` (optional)
- `occurred_at`

说明：
- authoritative write path 仍是现有 HTTP APIs；`community_sync_events` 只是 P2P replay / catch-up 的辅助日志
- 不把聊天消息或 conversation 状态写入这张表
- 只把 **post-target** 的 `report.created` / `moderation.decision` 写入这张表
- `actor_user_id` 不出现在对外 sync envelope 中；对外只暴露匿名 `actor_p2p_id`

---

## 3) 索引与查询（MVP 必要）

> ORM: **Drizzle**（类型安全 + SQL-like API），Migration 工具: **drizzle-kit**。
> 命名规范：表名复数蛇形（`resource_providers`），列名蛇形（`created_at`）。

### 3.1 Post 查询（PostgreSQL）
- 按社区：`community_id`
- 按类别：`category`
- 按状态：`status=active`
- 按过期：`expires_at > now()`
- 按 ZIP：`location_zip`

推荐复合索引（Drizzle schema 定义）：
```typescript
// packages/db/schema/posts.ts
export const postsTable = pgTable('posts', {
  // ... 字段定义
}, (table) => ({
  communityStatusIdx: index('idx_posts_community_status')
    .on(table.community_id, table.status, table.category, table.expires_at),
  communityZipIdx: index('idx_posts_community_zip')
    .on(table.community_id, table.location_zip, table.status, table.expires_at),
}));
```

### 3.2 ResourceProvider 查询（PostgreSQL + PostGIS）
- 按 ZIP：`zip`
- 按类型：`type`
- 按开放状态：通过 `hours_json` + 当前时间计算
- **按距离**（PostGIS）：对 `ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography` 的表达式索引做距离查询，不依赖实体 `geom` 列

推荐索引：
```sql
-- ZIP + type 复合索引
CREATE INDEX idx_resources_zip_type ON resource_providers (zip, type);
-- PostGIS 空间索引（资源点的经纬度）
CREATE INDEX idx_resources_geom ON resource_providers USING GIST (
  ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
);
```

### 3.3 IndexedDB 查询（Dexie.js — 客户端）
```typescript
// packages/shared/dexie-schema.ts
const db = new Dexie('weavenyc');
db.version(1).stores({
  post_cache: 'post_id, community_id, category, status, expires_at',
  announcement_cache: 'announcement_id, community_id, status, published_at',
  bookmarks: '++id, type, target_id, created_at',
  drafts: '++id, post_type, category, updated_at',
  p2p_keys: 'community_id, actor_id',
  p2p_sync_state: 'community_id, enabled, last_synced_at',
  p2p_event_cursor: 'community_id, updated_at',
  settings: 'key',
  device: 'key',
  device_keys: 'key_type, community_id',
});
```

---

## 4) 脱敏与最小化字段策略

### 4.1 位置
- MVP 仅存 ZIP；不存精确 GPS
- 如果未来加地图点：保存 `geo_precision` 并允许用户选择“zip-only”
- `geo_precision` 建议默认值为 `zip_centroid`，仅在更高精度可确认时提升到 `street` / `rooftop` / `exact`

### 4.2 文本内容
- 提醒用户不要发布 SSN、护照号等敏感信息
- 对消息/贴子做风险关键词检测（只用于安全，不用于广告）

---

## 5) 示例记录（JSON）

### 5.1 Request Post
```json
{
  "post_id": "9f0c...",
  "post_type": "request",
  "category": "food",
  "title": "Need dinner for 2",
  "body": "We are short on food tonight. Anything helps.",
  "language": "en",
  "location_zip": "11735",
  "privacy": "community_only",
  "expires_at": "2026-02-21T01:00:00Z",
  "community_id": "c1...",
  "status": "active",
  "risk_level": "low",
  "verification_state": "unverified"
}
```

### 5.2 Official Resource
```json
{
  "provider_id": "p1...",
  "source": "cfc_active",
  "name": "St. Kilian Parish Social Ministry",
  "type": "pantry",
  "address_text": "140 Elizabeth Street, Farmingdale, NY",
  "zip": "11735",
  "phone": "516-756-9656",
  "hours_json": {"mon": "09:30-12:30", "tue": "09:30-12:30"},
  "geo_precision": "street"
}
```
