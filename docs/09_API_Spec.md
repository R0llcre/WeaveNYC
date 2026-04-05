# WeaveNYC — API Spec (HTTP + P2P)

目标：把客户端、Anchor 后台、P2P 节点之间的接口写成“可以直接实现”的最小集合。

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

### 2.3 Join Community
`POST /v1/communities/{community_id}/join`

Request:
```json
{
  "invite_code": "COMM-XXXXX",
  "qr_token": "qr_..."
}
```

Notes:
- `invite_code` 或 `qr_token` 二选一即可，实际实现可只接收其中一种
- 加入成功后，用户可以访问该社区的 `community_only` 内容
- 如果已经是成员，接口应返回幂等成功结果

---

## 3) Posts (Request/Offer)

### 3.1 Create Post
`POST /v1/posts`

> **字段说明**：HTTP DTO 与 [08_Data_Model §2.5 Post](./08_Data_Model.md) 保持同名。`post_type`、`location_zip`、`privacy`、`body` 等字段不做额外别名转换。
> **认证说明**：该接口接受 anonymous JWT；发帖不要求先完成 OTP。只有 `Contact` / `chat` 相关接口要求 `level >= verified`。

Request:
```json
{
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
{ "post_id": "p_...", "status": "pending_review", "risk_level": "low" }
```

### 3.2 List Posts (Feed)
`GET /v1/posts?community_id=...&category=food&type=request&cursor=...`
Response:
```json
{ "items": [...], "next_cursor": "..." }
```

### 3.3 Update Post
`PATCH /v1/posts/{post_id}`

### 3.4 Close Post
`POST /v1/posts/{post_id}/close`

---

## 4) Matching

### 4.1 Get Suggestions
`GET /v1/posts/{post_id}/matches?refresh=false`
Response:
```json
{
  "post_id": "p_...",
  "suggestions": [
    {
      "kind": "neighbor_post",
      "target_post_id": "p2_...",
      "score": 0.82,
      "reasons": ["same_category", "same_language", "within_2_miles"],
      "trust": {"verified": false, "anchor_reviewed": true}
    },
    {
      "kind": "official_resource",
      "provider_id": "rp_...",
      "score": 0.60,
      "reasons": ["open_now", "within_3_miles"]
    }
  ]
}
```

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
- The recipient must be able to read the pending request from `GET /v1/contact-requests/inbox`
- `POST /v1/contact-requests/{contact_request_id}/accept` should be idempotent and return the same `conversation_id` on retry

---

## 5) Messaging

### 5.1 Contact Request Inbox
`GET /v1/contact-requests/inbox?cursor=...`

Notes:
- Requires `level >= verified`
- Returns pending contact requests received by the authenticated user
- The authenticated user must be the `recipient_user_id` of each returned item
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
`GET /v1/conversations?cursor=...`

### 5.5 Send Message
`POST /v1/conversations/{conversation_id}/messages`
Request:
```json
{ "body": "Hi, I can help. Are you free at 6pm?" }
```

### 5.6 Close Conversation
`POST /v1/conversations/{conversation_id}/close`

---

## 6) Safety: Reports & Blocks

### 6.1 Report
`POST /v1/reports`
Request:
```json
{
  "target_type": "post",
  "target_id": "p_...",
  "reason": "scam",
  "detail": "Asked for SSN"
}
```

### 6.2 Block User
`POST /v1/blocks`
Request:
```json
{ "blocked_user_id": "u_..." }
```

---

## 7) Anchor Admin API

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

## 8) P2P Message Schemas (JSON)

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
- This is the discovery path for P2P M6 clients
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
