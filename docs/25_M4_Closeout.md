# WeaveNYC — M4 Closeout

状态：`M4 completed on branch / M5 pending`

日期：`2026-04-11`

说明：本文档只记录 `feature/m4-chat-safety` 的 branch-local closeout；canonical baseline 仍然是 `main = M2 completed`。

---

## 1) Scope Closed

当前 `feature/m4-chat-safety` 分支已经完成 M4 冻结范围：

- accepted `contact_request` 可进入真实 `conversation`
- `GET /v1/conversations` / `GET /v1/conversations/:conversation_id` 可用
- `GET /v1/conversations/:conversation_id/messages` / `POST /v1/conversations/:conversation_id/messages` 可用
- `POST /v1/conversations/:conversation_id/close` 可用
- PWA 已提供 canonical `/inbox`、`/conversations/[conversationId]`，`/contact-requests` 仅作为兼容 redirect
- `POST /v1/blocks` / `POST /v1/reports` 已接通
- 敏感信息检测会在发送前阻断高风险内容
- `GET /v1/ws/chat?token=...` 已提供 WebSocket realtime

---

## 2) Validation

本轮已通过的 checks：

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm test:e2e`
- `pnpm test:smoke:real`

`real API smoke` 当前确认了这些 M4 关键路径：

- `POST /v1/contact-requests/:contact_request_id/accept`
- `GET /v1/conversations`
- `GET /v1/conversations/:conversation_id`
- `POST /v1/conversations/:conversation_id/messages`
- `GET /v1/conversations/:conversation_id/messages`
- `GET /v1/ws/chat?token=...`
- `POST /v1/reports`
- `POST /v1/blocks`
- `POST /v1/conversations/:conversation_id/close (blocked -> 409)`

---

## 3) Review Gate

6 条 review lane 结果：

1. Foundation / DevEx / docs truth: `No material findings`
2. Cross-cutting skeptic review: `No material findings`
3. Chat domain / realtime / idempotency: `No material findings`
4. API / DB / auth boundaries: `No material findings`
5. Frontend / PWA behavior: `No material findings`
6. Validation / CI / smoke coverage: `No material findings`

---

## 4) Remaining Accepted Risks

- `pnpm test:live-sources` 仍然不进默认 CI
- `packages/db/test/db.integration.test.ts` 仍然是 opt-in
- inbox 仍采用客户端 polling；消息线程实时更新通过 WebSocket + Redis Pub/Sub 提供

---

## 5) Next Phase

下一阶段唯一入口：`M5`

`M5` 负责：

- Anchor Admin 登录与激活
- review queue UI
- 公告与规则配置
- pilot prep / demo rehearsal
