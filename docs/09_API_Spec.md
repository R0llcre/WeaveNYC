# WeaveNYC — API Spec (HTTP Surface, Main-First)

目标：把当前可运行的 HTTP surface 写成“可以直接实现”的最小集合；M5/M6、Anchor Admin 和 P2P 相关内容统一放到文末的 future appendix / notes。

约定：
- HTTP Base URL（示例）：`https://api.weavenyc.local`
- Auth：MVP 可用 JWT（匿名账户也能拿 token）
- 所有时间：ISO8601 UTC
- 示例中的 `p_...`、`c_...`、`comm_...` 仅为可读占位符；实际持久化 ID 统一使用 UUID（见 [20_DB_Schema_Reference](./20_DB_Schema_Reference.md)）

---

## 1) Auth

### 1.1 Anonymous Session
`POST /v1/auth/anonymous`

Request:
```json
{ "device_id": "550e8400-e29b-41d4-a716-446655440000" }
```
Response:
```json
{
  "access_token": "jwt",
  "refresh_token": "rt_...",
  "user": {
    "user_id": "550e8400-e29b-41d4-a716-446655440001",
    "level": "anonymous"
  }
}
```

### 1.2 Refresh Session
`POST /v1/auth/refresh`

Request:
```json
{ "refresh_token": "rt_..." }
```
Response:
```json
{
  "access_token": "jwt",
  "refresh_token": "rt_...",
  "user": {
    "user_id": "550e8400-e29b-41d4-a716-446655440001",
    "level": "anonymous"
  }
}
```

### 1.3 Start OTP
`POST /v1/auth/otp/start`

Request:
```json
{ "phone": "+1516..." }
```
Response:
```json
{ "challenge_id": "c_..." }
```

### 1.4 Verify OTP
`POST /v1/auth/otp/verify`
Request:
```json
{ "challenge_id": "c_...", "code": "123456" }
```
Response:
```json
{
  "access_token": "jwt",
  "refresh_token": "rt_...",
  "user": {
    "user_id": "550e8400-e29b-41d4-a716-446655440001",
    "level": "verified"
  }
}
```

### 1.5 Start Magic Link (fallback)
`POST /v1/auth/magic-link/start`

Request:
```json
{ "email": "user@example.com" }
```
Response:
```json
{ "challenge_id": "ml_..." }
```

### 1.6 Verify Magic Link (fallback)
`POST /v1/auth/magic-link/verify`

Request:
```json
{ "challenge_id": "ml_...", "token": "token_..." }
```
Response:
```json
{
  "access_token": "jwt",
  "refresh_token": "rt_...",
  "user": {
    "user_id": "550e8400-e29b-41d4-a716-446655440001",
    "level": "verified"
  }
}
```

### 1.7 Anchor Activate
`POST /v1/auth/anchor/activate`

Request:
```json
{
  "invite_code": "ANC-XXXXX",
  "totp_secret": "base32...",
  "org_name": "St. Kilian Parish"
}
```

Notes:
- 该接口仍属于后续完整 Anchor 登录流（M5），当前只作为 future appendix 记录，不属于 current main surface
- M2 的 manual review path 在非生产环境使用 `pnpm dev:mint-anchor-token` 生成临时 anchor bearer token

---

## 2) Official Resources

### 2.1 Search Resources
`GET /v1/resources?zip=11735&open_now=true&type=pantry&limit=20`
Response:
```json
{
  "items": [...],
  "next_cursor": "..."
}
```

### 2.2 Resource Detail
`GET /v1/resources/{provider_id}`

### 2.3 Resolve Community Access
`POST /v1/community-access/resolve`

Request:
```json
{ "invite_code": "FARMINGDALE-HELP" }
```

或

```json
{ "qr_token": "FARMINGDALE-QR" }
```

Response:
```json
{
  "community": {
    "community_id": "44444444-4444-4444-8444-444444444444",
    "name": "Farmingdale Demo Community",
    "center_zip": "11735",
    "join_policy": "invite_only"
  },
  "join_token": "jwt_...",
  "entry": "invite_code",
  "expires_in_seconds": 600
}
```

### 2.4 Join Community
`POST /v1/communities/{community_id}/join`

Request:
```json
{
  "join_token": "jwt_..."
}
```

Notes:
- `resolve -> join` 是固定两步流程，`join` 不再直接接收 `invite_code` / `qr_token`
- 加入成功后，用户可以访问该社区的 `community_only` 内容
- 如果已经是成员，接口返回幂等成功结果

---

## 3) Posts (Request/Offer)

### 3.1 Create Post
`POST /v1/posts`

> **字段说明**：HTTP DTO 与 [08_Data_Model §2.5 Post](./08_Data_Model.md) 保持同名。`post_type`、`location_zip`、`privacy`、`body` 等字段不做额外别名转换。
> **认证说明**：
> - 该接口接受 anonymous JWT
> - 发布前必须已有对应 `community_id` 的 membership
> - low / medium risk `request` 可由 anonymous member 发布
> - `offer` 和 high-risk `request` / `offer` 要求 `level >= verified`

Request:
```json
{
  "community_id": "44444444-4444-4444-8444-444444444444",
  "post_type": "request",
  "category": "food",
  "title": "Need dinner for 2",
  "body": "We are short on food tonight. Anything helps.",
  "language": "en",
  "location_zip": "11735",
  "privacy": "community_only",
  "expires_at": "2026-02-26T03:00:00Z",
  "contact_pref": {"in_app_chat": true, "call": false}
}
```
Response:
```json
{ "post_id": "p_...", "status": "active", "risk_level": "low" }
```

### 3.2 List Posts (Feed)
`GET /v1/posts?scope=community&community_id=...&category=food&post_type=request&cursor=...`
Response:
```json
{ "items": [...], "next_cursor": "..." }
```

Notes:
- `scope=community` 需要 membership
- `scope=public` 只返回 `privacy = public` 且 `status = active`
- `anchor_mediated` 不进入普通 feed

### 3.3 My Posts
`GET /v1/posts/mine`

### 3.4 Post Detail
`GET /v1/posts/{post_id}`

### 3.5 Update Post
`PATCH /v1/posts/{post_id}`

### 3.6 Close Post
`POST /v1/posts/{post_id}/close`

### 3.7 Delete Post
`DELETE /v1/posts/{post_id}`

---

## 4) Matching

### 4.1 Get Suggestions
`GET /v1/posts/{post_id}/matches?refresh=false`
Response:
```json
{
  "post_id": "p_...",
  "batch_number": 1,
  "advanced": false,
  "refreshes_used": 0,
  "max_refreshes": 1,
  "items": [
    {
      "suggestion_id": "ms_...",
      "batch_number": 1,
      "position": 1,
      "candidate_type": "neighbor_post",
      "candidate_id": "p2_...",
      "score": 0.82,
      "reasons": ["same_category", "same_language", "within_1_mile"],
      "distance_miles": 0.8,
      "neighbor_post": {
        "post_id": "p2_...",
        "post_type": "offer",
        "category": "food",
        "title": "Can share groceries tonight",
        "language": "en",
        "privacy": "community_only",
        "status": "active",
        "risk_level": "low"
      },
      "official_resource": null
    },
    {
      "suggestion_id": "ms_...",
      "batch_number": 1,
      "position": 2,
      "candidate_type": "official_resource",
      "candidate_id": "rp_...",
      "score": 0.60,
      "reasons": ["open_now", "nearby_resource"],
      "distance_miles": 1.2,
      "neighbor_post": null,
      "official_resource": {
        "provider_id": "rp_...",
        "name": "St. Kilian Parish Social Ministry",
        "type": "pantry",
        "zip": "11735",
        "is_open_today": true,
        "is_open_now": true
      }
    }
  ]
}
```

Notes:
- 仅 Request owner 可读取自己的 suggestions。
- 邻里候选池固定为：同社区、`active`、未过期、非 `anchor_mediated` 的 Offer。
- 响应永远包含官方资源兜底；若无邻里 Offer，则返回 3 条官方资源。
- `refresh=true` 最多只允许再拿 1 批新结果；超过预算后继续返回当前批次。
- `anchor_reviewed` 只表示候选帖子本身已存在 Anchor review 信号；M3 不引入新的“已完成帮助验证”数据源。

### 4.2 Start Contact
`POST /v1/match/contact`
Request:
```json
{ "from_post_id": "p_...", "to_post_id": "p2_..." }
```
Response:
```json
{ "contact_request_id": "cr_...", "status": "pending" }
```

Notes:
- Requires `level >= verified`
- If the current session is `anonymous`, the client must complete OTP or magic-link upgrade before creating the `contact_request`
- The endpoint only creates or reuses a `contact_request`; it does not create a live chat thread by itself
- The recipient reads the pending request through the canonical `/inbox` UI backed by `GET /v1/contact-requests/inbox`
- If the same pair was already accepted, the response may include the existing `conversation_id` for the live conversation entry

---

## 5) Inbox & Chat（canonical `/inbox` UI）

### 5.1 Inbox Requests API
`GET /v1/contact-requests/inbox?cursor=...`

Notes:
- Requires `level >= verified`
- Returns pending contact requests received by the authenticated user
- The authenticated user must be the `recipient_user_id` of each returned item
- The recipient-side UI canonical route is `/inbox`; `/contact-requests` is compatibility/legacy redirect only
- Used by the recipient-side inbox UI before Accept / Reject

Response:
```json
{
  "items": [
    {
      "contact_request_id": "cr_...",
      "from_post_id": "p_...",
      "to_post_id": "p2_...",
      "requester_user_id": "u_...",
      "status": "pending",
      "created_at": "2026-02-26T00:00:00Z"
    }
  ],
  "next_cursor": "..."
}
```

### 5.2 Accept Contact Request
`POST /v1/contact-requests/{contact_request_id}/accept`

Notes:
- Requires `level >= verified`
- The authenticated user must equal the `recipient_user_id` on the target `contact_request`
- Idempotent: retrying `accept` returns the same `conversation_id`
- `accept` creates a live `conversation`

Response:
```json
{ "conversation_id": "c_...", "status": "accepted" }
```

### 5.3 Reject Contact Request
`POST /v1/contact-requests/{contact_request_id}/reject`

Notes:
- Requires `level >= verified`
- The authenticated user must equal the `recipient_user_id` on the target `contact_request`
- Idempotent: retrying `reject` returns the same terminal status

### 5.4 List Conversations
`GET /v1/conversations?cursor=...&limit=...`

Response:
```json
{
  "items": [
    {
      "conversation_id": "c_...",
      "contact_request_id": "cr_...",
      "related_post_ids": ["p_...", "p2_..."],
      "participant_preview": [
        { "user_id": "u_...", "alias": "Neighbor 72" },
        { "user_id": "u2_...", "alias": "Neighbor 31" }
      ],
      "status": "active",
      "created_at": "2026-02-26T00:00:00Z",
      "last_activity_at": "2026-02-26T00:05:00Z",
      "last_message_preview": "Can we meet at the library?",
      "unread_count": 1
    }
  ],
  "next_cursor": null
}
```

### 5.5 Get Conversation Detail
`GET /v1/conversations/{conversation_id}`

Response:
```json
{
  "conversation_id": "c_...",
  "contact_request_id": "cr_...",
  "related_post_ids": ["p_...", "p2_..."],
  "participant_preview": [
    { "user_id": "u_...", "alias": "Neighbor 72" },
    { "user_id": "u2_...", "alias": "Neighbor 31" }
  ],
  "status": "active",
  "created_at": "2026-02-26T00:00:00Z",
  "last_activity_at": "2026-02-26T00:05:00Z",
  "last_message_preview": "Can we meet at the library?",
  "unread_count": 1,
  "other_user_id": "u2_...",
  "actions": {
    "can_send": true,
    "can_close": true,
    "can_block": true,
    "can_report": true
  }
}
```

Notes:
- Only participants on the accepted `contact_request` can read the conversation.
- If the conversation is blocked, reads return `409`.

### 5.6 List Conversation Messages
`GET /v1/conversations/{conversation_id}/messages?cursor=...&limit=...`

### 5.7 Send Conversation Message
`POST /v1/conversations/{conversation_id}/messages`

Request:
```json
{ "body": "I can meet at the library at 3pm." }
```

Notes:
- Requires `level >= verified`
- Only conversation participants can send
- Sensitive content detection can block delivery with `422` and `safety_flags`

### 5.8 Close Conversation
`POST /v1/conversations/{conversation_id}/close`

Response:
```json
{
  "conversation_id": "c_...",
  "status": "closed",
  "closed_at": "2026-02-26T00:10:00Z"
}
```

---

## 6) Safety: Reports & Blocks

### 6.1 Report
`POST /v1/reports`
Request:
```json
{
  "target_type": "message",
  "target_id": "m_...",
  "reason": "scam",
  "conversation_id": "c_...",
  "evidence_description": "Asked for SSN"
}
```

### 6.2 Block User
`POST /v1/blocks`
Request:
```json
{ "blocked_user_id": "u_...", "conversation_id": "c_..." }
```

### 6.3 Chat WebSocket
`GET /v1/ws/chat?token=...`

Notes:
- Requires a valid bearer token passed as `token`
- Emits `heartbeat`, `message.created`, and `conversation.updated`
- Backed by Redis Pub/Sub for cross-process fan-out

---

## Future Appendix A: Anchor Admin API

### 7.1 Review Queue
`GET /v1/admin/review_queue?community_id=...&cursor=...`

### 7.2 Approve / Reject
`POST /v1/admin/review_queue/{post_id}/decision`
Request:
```json
{ "decision": "approve", "notes": "OK" }
```

### 7.3 Update Community Rules
`PUT /v1/admin/communities/{community_id}/rules`

### 7.4 Create Announcement
`POST /v1/admin/communities/{community_id}/announcements`

---

## Future Appendix B: P2P Message Schemas (JSON)

> **命名约定**：事件类型使用过去式（表示已发生的事实），与 [07_P2P_Node_Design §3.2](./07_P2P_Node_Design.md) 保持一致。
> 完整事件类型列表：`post.published`, `post.updated`, `post.tombstoned`, `report.created`, `moderation.decision`, `announcement.published`

### 8.1 post.published
```json
{
  "event_id": "evt_...",
  "event_type": "post.published",
  "community_id": "comm_...",
  "actor": "anon_user_...",
  "ts": "2026-02-26T00:00:00Z",
  "payload": {
    "post_id": "p_...",
    "cid": "bafy...",
    "version": 1,
    "post_type": "offer",
    "category": "food"
  },
  "signature": "..."
}
```

### 8.2 post.updated
```json
{
  "event_id": "evt_...",
  "event_type": "post.updated",
  "community_id": "comm_...",
  "actor": "anon_user_...",
  "ts": "2026-02-26T01:00:00Z",
  "payload": {
    "post_id": "p_...",
    "prev_cid": "bafy_old...",
    "cid": "bafy_new...",
    "version": 2,
    "changes": { "body": "Updated description", "expires_at": "2026-02-28T00:00:00Z" }
  },
  "signature": "..."
}
```

### 8.3 post.tombstoned
```json
{
  "event_id": "evt_...",
  "event_type": "post.tombstoned",
  "community_id": "comm_...",
  "actor": "anon_user_...",
  "ts": "2026-02-26T02:00:00Z",
  "payload": {
    "post_id": "p_...",
    "cid": "bafy_old...",
    "reason": "closed_by_owner"
  },
  "signature": "..."
}
```

### 8.4 moderation.decision
```json
{
  "event_id": "evt_...",
  "event_type": "moderation.decision",
  "community_id": "comm_...",
  "actor": "anchor_actor_...",
  "ts": "2026-02-26T00:00:00Z",
  "payload": {
    "post_id": "p_...",
    "decision": "approve",
    "reason": "Content verified",
    "by": { "node_id": "anchor_...", "community_id": "comm_..." }
  },
  "signature": "..."
}
```

### 8.5 report.created
```json
{
  "event_id": "evt_...",
  "event_type": "report.created",
  "community_id": "comm_...",
  "actor": "anon_user_...",
  "ts": "2026-02-26T00:00:00Z",
  "payload": {
    "report_id": "r_...",
    "target_type": "post",
    "target_id": "p_...",
    "reason": "scam"
  },
  "signature": "..."
}
```

### 8.6 announcement.published
```json
{
  "event_id": "evt_...",
  "event_type": "announcement.published",
  "community_id": "comm_...",
  "actor": "anchor_actor_...",
  "ts": "2026-02-26T00:00:00Z",
  "payload": {
    "announcement_id": "ann_...",
    "title": "Pantry drive this Saturday",
    "body": "...",
    "cid": "bafy_ann...",
    "by": { "node_id": "anchor_...", "community_id": "comm_..." }
  },
  "signature": "..."
}
```

### 8.7 Community Bootstrap
`GET /v1/communities/{community_id}/bootstrap`

Response:
```json
{
  "community_id": "comm_...",
  "bootstrap_version": 1,
  "anchor_nodes": [
    {
      "node_id": "anchor_...",
      "endpoint": "wss://anchor.weavenyc.local/p2p",
      "last_seen_at": "2026-02-26T00:00:00Z"
    }
  ],
  "relay_nodes": [
    {
      "node_id": "relay_...",
      "endpoint": "wss://relay.weavenyc.local/p2p"
    }
  ],
  "topics": {
    "posts": "weavenyc/{community_id}/posts",
    "reports": "weavenyc/{community_id}/reports",
    "announcements": "weavenyc/{community_id}/announcements"
  },
  "latest_snapshot": {
    "posts_cid": "bafy...",
    "announcements_cid": "bafy..."
  }
}
```

Notes:
- Future-only discovery path for P2P M6 clients
- If the client is offline or no anchor is available, use cached bootstrap data and skip P2P sync
- The browser should not depend on mDNS to join a community

---

## 9) Voice-to-Text（Tier 3 Cloud Gateway）

> 详见 [ADR-0008](./15_ADR_Log.md)。仅在 Tier 1（端侧）和 Tier 2（Web Speech API）不可用时才回退到此接口。

### 9.1 Transcribe Audio
`POST /v1/speech/transcribe`

Request（`multipart/form-data`）:
- `audio`: 音频文件（≤ 20 秒，WebM/OGG/WAV）
- `language`: `en` | `es` | `zh`

Response:
```json
{
  "text": "今晚需要两人份晚餐",
  "confidence": 0.92,
  "language": "zh",
  "duration_ms": 3200
}
```

**隐私策略**：音频只在内存处理，立即丢弃，不落盘。

---

## 10) Error Model
统一错误响应：
```json
{
  "error": {
    "code": "invalid_argument",
    "message": "zip must be 5 digits",
    "details": {"field": "zip"}
  }
}
```

---

## 11) Rate Limits (MVP 推荐)

| 接口类型 | 限制 |
|----------|------|
| Anonymous 通用 | 30 req/min |
| Logged-in 通用 | 120 req/min |
| Send message | 20/min |
| Post create | 5/min |
| Speech transcribe | 10/min |
| Report create | 5/min |

**超限响应**（HTTP 429 Too Many Requests）：
```json
{
  "error": {
    "code": "rate_limit_exceeded",
    "message": "Too many requests. Please try again in 32 seconds.",
    "details": {
      "retry_after_seconds": 32,
      "limit": 30,
      "window": "1m"
    }
  }
}
```

响应头包含 `Retry-After: 32`。
