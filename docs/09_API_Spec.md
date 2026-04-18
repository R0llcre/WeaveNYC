# WeaveNYC — API Spec (HTTP Surface, Main-First)

目标：把当前可运行的 HTTP surface 写成“可以直接实现”的最小集合；`main` 的 canonical surface 已覆盖 M0-M7。下一阶段 `M8` 只做 pilot readiness，不新增新的用户端 HTTP product surface。

约定：
- HTTP Base URL（示例）：`https://api.weavenyc.local`
- Auth：MVP 可用 JWT（匿名账户也能拿 token）
- 所有时间：ISO8601 UTC
- 示例中的 `p_...`、`c_...`、`comm_...` 仅为可读占位符；实际持久化 ID 统一使用 UUID（见 [20_DB_Schema_Reference](./20_DB_Schema_Reference.md)）
- 当前 staging runtime 的 `/healthz`、`/readyz`、`/versionz`、`/metrics` 属于 ops probes，不算新的用户端 product API surface

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

### 1.7a Anchor Session Recovery (TOTP fallback)
`POST /v1/auth/anchor/session/recovery`

Request:
```json
{
  "community_id": "44444444-4444-4444-8444-444444444444",
  "recovery_code": "ABCD-EFGH"
}
```

Response: same shape as §1.4 (returns `access_token` + `refresh_token` + `user`).

Notes:
- Allows an anchor to open a step-up session using one of the recovery codes minted at activation (see §1.7) when their authenticator app is unavailable
- Requires a current session with `level >= verified`
- Recovery codes are **single-use** — on success the code is removed from `anchors.recovery_codes_hashes` and cannot be reused
- Invalid or already-used codes return `400`; anchors missing for `(user, community)` return `404`
- After success, previous refresh token families for the user are revoked, matching `anchor/session/verify` behavior

### 1.7 Anchor Activate
`POST /v1/auth/anchor/activate`

Request:
```json
{ "invite_code": "WEAVE-ANCHOR-11735" }
```

Response:
```json
{
  "activation_id": "550e8400-e29b-41d4-a716-446655440099",
  "community": {
    "community_id": "44444444-4444-4444-8444-444444444444",
    "name": "Farmingdale Demo Community",
    "center_zip": "11735",
    "join_policy": "invite_only"
  },
  "otpauth_uri": "otpauth://totp/WeaveNYC%20Anchor:St.%20Kilian...",
  "recovery_codes": ["ABCD-EFGH", "IJKL-MNOP"],
  "expires_in_seconds": 600
}
```

Notes:
- 前置条件：当前会话必须 `level >= verified`
- 客户端不上传 `totp_secret`；TOTP secret 由服务端生成，只在这里通过 `otpauth_uri` 返回一次
- 完整流程固定为：`activate -> activate/confirm -> session/start -> session/verify`
- 非生产环境的 manual debug/recovery path 仍可使用 `pnpm dev:mint-anchor-token` 生成临时 anchor bearer token

### 1.8 Current Session (Me)
`GET /v1/me`

Response (200):
```json
{
  "user": {
    "user_id": "550e8400-e29b-41d4-a716-446655440001",
    "level": "verified",
    "role": "user",
    "community_ids": ["44444444-4444-4444-8444-444444444444"],
    "anchor_community_id": null,
    "mfa_verified_at": null
  }
}
```

Response (404):
```json
{ "error": { "code": "not_found", "message": "User not found" } }
```

Notes:
- Requires a valid bearer token (any level, including anonymous)
- `role` is either `user` or `anchor`
- `anchor_community_id` / `mfa_verified_at` are only populated after a successful `anchor/session/verify`
- Clients should call this after refresh to materialize the latest session state into Redux / React state

### 1.9 Delete Account (3-step flow)

M8 account deletion is a three-step, identity-verified flow rather than a single call. The canonical implementation lives in `services/api-gateway/src/routes/account.ts`; the security rationale lives in [`docs/10_Security_Privacy_Threat_Model.md §6.4`](./10_Security_Privacy_Threat_Model.md).

At a glance:

1. `POST /v1/account/delete/request` — issue an OTP / magic-link challenge to the bound phone or email.
2. `POST /v1/account/delete/confirm` — verify the challenge, run last-anchor safety checks, soft-delete, and mint a single-use undelete recovery token.
3. `POST /v1/account/undelete/request` + `POST /v1/account/undelete` — optional 30-day recovery window using the token from step 2.

#### §1.9.1 `POST /v1/account/delete/request`

Step 1 — issues an OTP / magic-link challenge to the bound phone or email on file.

- **Auth**: Bearer token (any level ≥ `anonymous`). Anonymous users with no bound phone/email receive `409 cannot_verify_identity`.
- **Request body**: `{}` (no body; the user identity is taken from the session `sub`).
- **Response 200**:
  ```json
  {
    "challenge_id": "550e8400-e29b-41d4-a716-446655440200",
    "masked_destination": "phone on file (***1234)",
    "delivery_channel": "sms",
    "expires_in_seconds": 600,
    "fallback": true,
    "demo_code": "123456",
    "demo_token": null,
    "demo_url": null
  }
  ```
  - `delivery_channel`: `"sms"` if a phone is bound, otherwise `"email"`.
  - `fallback` / `demo_code` / `demo_token` / `demo_url` are only populated when the stub notification provider is active (dev / staging / smoke).
- **Response 409 `cannot_verify_identity`**: the user has neither a bound phone nor a bound email (typical for pure-anonymous sessions). Clients should first complete `/v1/auth/otp/start` + `/v1/auth/otp/verify` or the magic-link equivalent before retrying.
- **Response 429**: rate-limited. Per-user budget is **3 requests per hour** (`accountDeleteBurstLimit` / `accountDeleteWindowSeconds` in `packages/shared`). A `Retry-After` header is set.

Notes:
- The OTP / magic-link challenge inherits the standard OTP TTL (`otpChallengeTtlSeconds`) or the magic-link TTL (`magicLinkChallengeTtlSeconds`).
- The per-user bucket is shared with `/v1/account/undelete/request` to prevent an attacker bouncing between the two probes.

#### §1.9.2 `POST /v1/account/delete/confirm`

Step 2 — verifies the challenge from §1.9.1, runs the last-anchor safety check, and soft-deletes the account.

- **Auth**: Bearer token (must be the same user that called §1.9.1).
- **Request body**:
  ```json
  {
    "challenge_id": "550e8400-e29b-41d4-a716-446655440200",
    "code": "123456",
    "reason": "no_longer_needed"
  }
  ```
  - `reason` (optional) is a `AccountDeleteReason` enum: `"no_longer_needed" | "privacy_concerns" | "moving_away" | "safety_concerns" | "other"`. Captured for product analytics only.
- **Response 202** (soft-delete scheduled):
  ```json
  {
    "status": "deletion_scheduled",
    "purge_date": "2026-05-16T00:00:00Z",
    "user_id": "550e8400-e29b-41d4-a716-446655440001",
    "undelete_recovery_token": "uri_550e8400_..."
  }
  ```
  - `undelete_recovery_token` is **single-use** and returned only here. Clients must stash it client-side (or surface it to the user) immediately — the server only keeps its sha256 hash.
  - `purge_date` = `now + 30 days`.
- **Response 400** (wrong / expired / exhausted code): body includes a human-readable `message`. The verification pool decrements `remaining_attempts` until exhaustion; on exhaustion a fresh §1.9.1 is required.
- **Response 409 `last_anchor_blocks_delete`**: the user is the last active anchor of one of their communities. Body:
  ```json
  {
    "message": "last_anchor_blocks_delete: community <uuid> has no replacement anchor...",
    "community_id": "44444444-4444-4444-8444-444444444444"
  }
  ```
  Staff or a second anchor must take over the community before the delete can succeed.

Side effects on a 202:
- Transactional soft-delete: `users.status` → `deleted`; PII columns (`display_name`, `phone_hash`, `email_hash`, `home_zip`) are nulled.
- Any `active` anchor row for the user is set to `revoked`.
- All refresh token families are revoked; access tokens expire naturally within 15 minutes.
- A single-use undelete recovery token is stored **as sha256 hash only** in Redis with TTL matching `purge_at`.
- An `account_deleted` analytics event is emitted (best-effort; never blocks the delete).

#### §1.9.3 `POST /v1/account/undelete/request`

Probe-only endpoint that confirms a soft-deleted account is still within its 30-day recovery window. It does **not** mint a new recovery token; the one from §1.9.2 is the canonical artifact.

- **Auth**: Bearer token is optional — the user has usually lost their session by the time they want to restore.
- **Request body**:
  ```json
  { "user_id": "550e8400-e29b-41d4-a716-446655440001" }
  ```
- **Response 200**:
  ```json
  {
    "challenge_id": "550e8400-e29b-41d4-a716-446655440999",
    "masked_destination": "recovery token (issued at deletion)",
    "delivery_channel": "email",
    "expires_in_seconds": 2591999,
    "fallback": true
  }
  ```
- **Response 404**: account does not exist.
- **Response 409**: account is not in a restorable state (e.g., still `active`, or already restored).
- **Response 410**: the 30-day `purge_at` window has passed; no recovery is possible.
- **Response 429**: rate-limited. Same per-user budget as §1.9.1 (3/h).

#### §1.9.4 `POST /v1/account/undelete`

Restores a soft-deleted account using the single-use recovery token from §1.9.2.

- **Auth**: none required (by design — users usually have lost their session).
- **Request body**:
  ```json
  {
    "user_id": "550e8400-e29b-41d4-a716-446655440001",
    "recovery_token": "uri_550e8400_..."
  }
  ```
- **Response 200**:
  ```json
  {
    "status": "restored",
    "user_id": "550e8400-e29b-41d4-a716-446655440001"
  }
  ```
  - The user row is reactivated at `level = "anonymous"`. The user must re-bind phone/email via `/v1/auth/otp/start` or `/v1/auth/magic-link/start` and, if they were an anchor, re-activate via §1.7.
- **Response 400**: recovery token is bad, already used, or does not match `user_id`.
- **Response 404**: account does not exist.
- **Response 409**: account is not in a restorable state.
- **Response 410**: purge window has passed; no recovery possible.

### 1.9 Notes (applies to all four subsections)

- **PII is intentionally NOT restored on undelete** (privacy-first). Display name / phone hash / email hash / home zip stay nulled. The user rebuilds identity through the normal OTP / magic-link onboarding flow after `/v1/account/undelete` returns 200.
- The recovery token is single-use and only the sha256 hash is persisted (Redis, TTL = `purge_at - now`). Its plaintext is returned exactly once from §1.9.2.
- `AccountDeleteReason` enum (used by §1.9.2): `"no_longer_needed" | "privacy_concerns" | "moving_away" | "safety_concerns" | "other"`.
- See [`docs/10_Security_Privacy_Threat_Model.md §6.4`](./10_Security_Privacy_Threat_Model.md) for full rationale (why 30 days, why PII is not restored, why last-anchor is a hard block).

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

Response:
```json
{ "contact_request_id": "cr_...", "status": "rejected" }
```

Notes:
- Requires `level >= verified`
- The authenticated user must equal the `recipient_user_id` on the target `contact_request`
- Idempotent: retrying `reject` returns the same terminal status
- No conversation is created on reject; any subsequent `accept` from the same requester requires a fresh contact request

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

### 6.4 P2P Sync WebSocket
`GET /v1/ws/p2p?token=<ws_jwt>&community_id=<community_id>`

Notes:
- Short-lived `ws_jwt` is minted by `GET /v1/communities/{community_id}/bootstrap` and embedded in `anchor_node.websocket_url`
- Scope is limited to a single community — the caller must be a member of `community_id`
- Emits M6 sync events (`post.published`, `post.updated`, `post.tombstoned`, `announcement.published`, `announcement.updated`, `announcement.deleted`, `report.created`, `moderation.decision`) as JSON frames matching §8 payloads
- Live overlay only — offline catch-up must use `GET /v1/communities/{community_id}/sync?since=...` (see §8.8)
- On reconnect, clients should replay §8.8 from the last known `next_since` cursor before re-subscribing
- Server closes with code `4401` on expired `ws_jwt`; clients should re-bootstrap to obtain a new token

---

## Appendix A: M5 Anchor Admin API（canonical current surface）

> 以下接口已经进入 `main` 的 canonical surface，并已通过 M6 closeout 与 6-lane review gate。

### 7.1 Anchor Activate
`POST /v1/auth/anchor/activate`

Request:
```json
{ "invite_code": "WEAVE-ANCHOR-11735" }
```

Response:
```json
{
  "activation_id": "550e8400-e29b-41d4-a716-446655440099",
  "community": {
    "community_id": "44444444-4444-4444-8444-444444444444",
    "name": "Farmingdale Demo Community",
    "center_zip": "11735",
    "join_policy": "invite_only"
  },
  "otpauth_uri": "otpauth://totp/WeaveNYC%20Anchor:St.%20Kilian...",
  "recovery_codes": ["ABCD-EFGH", "IJKL-MNOP"],
  "expires_in_seconds": 600
}
```

### 7.2 Anchor Activate Confirm
`POST /v1/auth/anchor/activate/confirm`

Request:
```json
{
  "activation_id": "550e8400-e29b-41d4-a716-446655440099",
  "totp_code": "123456"
}
```

### 7.3 Anchor Session Start
`POST /v1/auth/anchor/session/start`

Request:
```json
{ "community_id": "44444444-4444-4444-8444-444444444444" }
```

### 7.4 Anchor Session Verify
`POST /v1/auth/anchor/session/verify`

Request:
```json
{
  "challenge_id": "550e8400-e29b-41d4-a716-446655440100",
  "totp_code": "123456"
}
```

### 7.5 Review Queue
`GET /v1/admin/review_queue?community_id=...&cursor=...&status=pending_review`

Response:
```json
{
  "items": [
    {
      "post_id": "p_...",
      "community_id": "comm_...",
      "post_type": "request",
      "category": "transportation",
      "title": "Ride to clinic Wed morning",
      "body": "...",
      "language": "en",
      "risk_level": "high",
      "risk_reasons": ["high_risk_category"],
      "author_user_id": "u_...",
      "created_at": "2026-02-26T00:00:00Z",
      "status": "pending_review"
    }
  ],
  "next_cursor": null
}
```

### 7.6 Report Queue
`GET /v1/admin/report_queue?community_id=...&status=new|resolved|dismissed&cursor=...`

Response:
```json
{
  "items": [
    {
      "report_id": "r_...",
      "community_id": "comm_...",
      "target_type": "post",
      "target_id": "p_...",
      "reason": "scam",
      "reporter_user_id": "u_...",
      "status": "new",
      "created_at": "2026-02-26T00:00:00Z",
      "target_preview": { "post_id": "p_...", "title": "..." }
    }
  ],
  "next_cursor": null
}
```

### 7.7 Approve / Reject Post
`POST /v1/admin/review_queue/{post_id}/decision`

Request:
```json
{ "decision": "approve", "reason": "Content compliant" }
```

- `decision`: `approve` | `reject` | `request_more_info`
- `reason`: required when `reject` or `request_more_info`

Response:
```json
{ "post_id": "p_...", "status": "active", "decided_at": "2026-02-26T00:05:00Z" }
```

### 7.8 Decision on Report
`POST /v1/admin/report_queue/{report_id}/decision`

Request:
```json
{ "resolution": "remove_post", "reason": "Confirmed scam" }
```

- `resolution`: `remove_post` | `suspend_user` | `warn` | `none`
- Anchor must belong to the report's `community_id`; MFA session verified within 4h

Response:
```json
{ "report_id": "r_...", "status": "resolved", "resolution": "remove_post", "resolved_at": "2026-02-26T00:10:00Z" }
```

### 7.9 Admin Dashboard
`GET /v1/admin/communities/{community_id}/dashboard`

Response:
```json
{
  "community_id": "comm_...",
  "weekly_metrics": {
    "posts_request": 12,
    "posts_offer": 8,
    "accepted_contacts": 5,
    "reports_total": 2
  },
  "pending": {
    "posts_review": 3,
    "reports_review": 1
  },
  "window": { "from": "2026-02-19T00:00:00Z", "to": "2026-02-26T00:00:00Z" }
}
```

### 7.10 Get Community Rules
`GET /v1/admin/communities/{community_id}/rules`

Response:
```json
{
  "ruleset_id": "rs_...",
  "community_id": "comm_...",
  "review_categories": ["transportation", "childcare"],
  "auto_hide_report_threshold": 3,
  "keyword_blocklist": ["scam", "urgent-money"],
  "language_preferences": ["en", "es", "zh"],
  "announcement_pin_strategy": "latest",
  "updated_at": "2026-02-26T00:00:00Z"
}
```

### 7.11 Update Community Rules
`PUT /v1/admin/communities/{community_id}/rules`

Request: same shape as §7.10 response (without `ruleset_id` / `updated_at`). Returns the updated ruleset.

Notes:
- `auto_hide_report_threshold` must be within `[1, 20]`
- `language_preferences` must be a subset of `["en", "es", "zh"]`

### 7.12 Read Community Announcements
`GET /v1/communities/{community_id}/announcements`

Response:
```json
{
  "items": [
    {
      "announcement_id": "ann_...",
      "title": "Pantry drive this Saturday",
      "body": "...",
      "is_pinned": true,
      "published_at": "2026-02-26T00:00:00Z"
    }
  ]
}
```

Notes:
- Accessible to `level >= verified` members of the community; `status = deleted` rows are filtered server-side
- Anchor variant is §7.13 (supports `include_deleted`)

### 7.13 Manage Community Announcements
`GET /v1/admin/communities/{community_id}/announcements?include_deleted=true|false`

- `include_deleted=true` returns `status = deleted` rows with `deleted_at` populated
- Default is `include_deleted=false`

`POST /v1/admin/communities/{community_id}/announcements`

Request:
```json
{ "title": "Pantry drive this Saturday", "body": "...", "is_pinned": true }
```

Response: newly created announcement object.

`PATCH /v1/admin/communities/{community_id}/announcements/{announcement_id}`

Request (partial):
```json
{ "title": "Updated title", "is_pinned": false }
```

Response: updated announcement object.

`DELETE /v1/admin/communities/{community_id}/announcements/{announcement_id}`

- Soft delete: sets `status = 'deleted'` and `deleted_at`
- Returns `{ "announcement_id": "...", "status": "deleted", "deleted_at": "..." }`
- Anchor must belong to `community_id`; MFA session verified within 4h

---

## 8) M6 P2P Contracts (Canonical)

> **命名约定**：事件类型使用过去式（表示已发生的事实），与 [07_P2P_Node_Design §3.2](./07_P2P_Node_Design.md) 保持一致。
> 完整事件类型列表：`post.published`, `post.updated`, `post.tombstoned`, `announcement.published`, `announcement.updated`, `announcement.deleted`, `report.created`, `moderation.decision`
>
> **当前 overlay 边界**：这里只描述当前 canonical 会真实同步的最小 payload。`report.created` / `moderation.decision` 只覆盖 post-target 事件；`detail_text`、`conversation_id`、`affected_user_id` 不进入社区同步 payload。

### 8.1 post.published
```json
{
  "sync_event_id": "evt_...",
  "event_type": "post.published",
  "community_id": "comm_...",
  "topic": "weavenyc/comm_.../posts",
  "aggregate_type": "post",
  "aggregate_id": "p_...",
  "occurred_at": "2026-02-26T00:00:00Z",
  "actor_p2p_id": "actor_...",
  "cid": "bafy...",
  "payload": {
    "post_id": "p_...",
    "p2p_version": 1,
    "ipfs_cid": "bafy...",
    "post_type": "offer",
    "category": "food"
  }
}
```

### 8.2 post.updated
```json
{
  "sync_event_id": "evt_...",
  "event_type": "post.updated",
  "community_id": "comm_...",
  "topic": "weavenyc/comm_.../posts",
  "aggregate_type": "post",
  "aggregate_id": "p_...",
  "occurred_at": "2026-02-26T01:00:00Z",
  "actor_p2p_id": "actor_...",
  "cid": "bafy_new...",
  "payload": {
    "post_id": "p_...",
    "p2p_version": 2,
    "ipfs_cid": "bafy_new...",
    "changes": { "body": "Updated description", "expires_at": "2026-02-28T00:00:00Z" }
  }
}
```

### 8.3 post.tombstoned
```json
{
  "sync_event_id": "evt_...",
  "event_type": "post.tombstoned",
  "community_id": "comm_...",
  "topic": "weavenyc/comm_.../posts",
  "aggregate_type": "post",
  "aggregate_id": "p_...",
  "occurred_at": "2026-02-26T02:00:00Z",
  "actor_p2p_id": "actor_...",
  "cid": "bafy_old...",
  "payload": {
    "post_id": "p_...",
    "reason": "closed_by_owner"
  }
}
```

### 8.4 moderation.decision
```json
{
  "sync_event_id": "evt_...",
  "event_type": "moderation.decision",
  "community_id": "comm_...",
  "topic": "weavenyc/comm_.../reports",
  "aggregate_type": "moderation",
  "aggregate_id": "ma_...",
  "occurred_at": "2026-02-26T00:00:00Z",
  "actor_p2p_id": "anchor_actor_...",
  "cid": "bafy_mod...",
  "payload": {
    "report_id": "r_...",
    "target_type": "post",
    "target_id": "p_...",
    "report_target_type": "post",
    "report_target_id": "p_...",
    "resolution": "approve",
    "status": "resolved",
    "decided_at": "2026-02-26T00:00:00Z"
  }
}
```

### 8.5 report.created
```json
{
  "sync_event_id": "evt_...",
  "event_type": "report.created",
  "community_id": "comm_...",
  "topic": "weavenyc/comm_.../reports",
  "aggregate_type": "report",
  "aggregate_id": "r_...",
  "occurred_at": "2026-02-26T00:00:00Z",
  "actor_p2p_id": "actor_...",
  "cid": "bafy_rep...",
  "payload": {
    "report_id": "r_...",
    "target_type": "post",
    "target_id": "p_...",
    "reason": "scam",
    "status": "new",
    "created_at": "2026-02-26T00:00:00Z"
  }
}
```

### 8.6 announcement.published
```json
{
  "sync_event_id": "evt_...",
  "event_type": "announcement.published",
  "community_id": "comm_...",
  "topic": "weavenyc/comm_.../announcements",
  "aggregate_type": "announcement",
  "aggregate_id": "ann_...",
  "occurred_at": "2026-02-26T00:00:00Z",
  "actor_p2p_id": "anchor_actor_...",
  "cid": "bafy_ann...",
  "payload": {
    "announcement_id": "ann_...",
    "title": "Pantry drive this Saturday",
    "body": "...",
    "ipfs_cid": "bafy_ann..."
  }
}
```

> 当前 runtime 仍不 attach 或 verify envelope signatures；`signature` 不属于本分支的运行时 contract。

### 8.7 Community Bootstrap
`GET /v1/communities/{community_id}/bootstrap`

Response:
```json
{
  "community_id": "comm_...",
  "bootstrap_version": "m6-anchor-sync-v1",
  "anchor_node": {
    "node_id": "anchor_...",
    "websocket_url": "ws://127.0.0.1:4000/v1/ws/p2p?token=ws_jwt_..."
  },
  "relay_nodes": [],
  "topics": {
    "posts": "weavenyc/{community_id}/posts",
    "reports": "weavenyc/{community_id}/reports",
    "announcements": "weavenyc/{community_id}/announcements"
  },
  "latest_snapshot": {
    "last_event_at": null,
    "event_count": 0
  },
  "mdns_demo_enabled": false
}
```

Notes:
- Canonical discovery path for P2P clients
- If the client is offline or no anchor is available, use cached bootstrap data and skip P2P sync
- The browser should not depend on mDNS to join a community
- The returned `websocket_url` carries a short-lived websocket token minted by bootstrap, not the primary API bearer token
- Clients should prefer reusing the returned URL as-is; the current compatibility helper may still append `community_id` client-side when that query param is absent

### 8.8 Community Sync Delta
`GET /v1/communities/{community_id}/sync?since=<cursor-or-ISO>&limit=<n>`

Response:
```json
{
  "events": [
    {
      "sync_event_id": "evt_...",
      "community_id": "comm_...",
      "topic": "weavenyc/comm_.../posts",
      "event_type": "post.updated",
      "aggregate_type": "post",
      "aggregate_id": "p_...",
      "occurred_at": "2026-04-13T12:00:00Z",
      "actor_p2p_id": "actor_...",
      "cid": "bafy_new...",
      "payload": {
        "post": {
          "post_id": "p_...",
          "p2p_version": 3,
          "ipfs_cid": "bafy_new..."
        }
      }
    }
  ],
  "next_since": "v1.eyJvY2N1cnJlZF9hdCI6IjIwMjYtMDQtMTNUMTI6MDA6MDBaIiwic3luY19ldmVudF9pZCI6ImV2dF8uLi4ifQ",
  "server_time": "2026-04-13T12:00:01Z",
  "latest_snapshot": {
    "last_event_at": "2026-04-13T12:00:00Z",
    "event_count": 1
  }
}
```

Notes:
- Canonical catch-up path for offline recovery after the client reconnects
- The authoritative write path remains the existing HTTP APIs for posts, announcements, reports, and moderation
- Clients should treat this as a replay stream for cache repair, not a replacement for canonical HTTP reads
- `since` 首次请求可传 ISO timestamp；后续请求应直接回传服务端返回的 opaque `next_since`
- `report.created` / `moderation.decision` 只包含 post-target 的最小社区可见字段，不携带 chat/user report 上下文

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
