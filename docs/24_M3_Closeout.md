# WeaveNYC — M3 Closeout

状态：`M3 completed on branch / M4 pending`

日期：`2026-04-07`

---

## 1) Scope Closed

`M3` 在当前 `feature/m3-matching-inbox` 分支上已经按冻结口径关闭：

- `Request` 发布后进入 `/posts/[postId]/matches`
- 后端生成并持久化 Top-3 行动方案
- `refresh=true` 最多只允许再刷新 1 次，总计最多 6 个不同 suggestion
- `POST /v1/match/contact` 只允许 `verified` 用户对当前匹配到的 neighbor offer 发起
- `GET /v1/contact-requests/inbox` 提供 recipient inbox
- `POST /v1/contact-requests/:id/accept` / `reject` 幂等
- `accept` 当场创建 `conversation`
- `GET /v1/conversations/:conversation_id` 只返回 `ready_for_chat_m4` placeholder
- 聊天消息流、会话列表、chat UI 仍明确留在 `M4`

---

## 2) Validation

本轮通过的 checks：

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm test:e2e`
- `pnpm test:live-sources`
- `WEAVENYC_API_BASE_URL=http://127.0.0.1:4113 pnpm test:smoke:real`

`real API smoke` 当前确认了这些 M3 关键路径：

- `GET /v1/posts/:post_id/matches`
- `GET /v1/posts/:post_id/matches?refresh=true`
- `POST /v1/match/contact (anonymous -> 403)`
- `POST /v1/auth/otp/start` / `verify` for requester upgrade
- `POST /v1/match/contact (verified)`
- `GET /v1/contact-requests/inbox`
- `POST /v1/contact-requests/:contact_request_id/accept`
- `GET /v1/conversations/:conversation_id`

说明：

- 为了让 M3 匹配 smoke 不被 default demo community 的历史帖子污染，`tests/smoke/real-api.ts` 会在本地测试数据库中创建一个临时隔离 community，并仍然通过正式的 `resolve -> join` API 进入该社区后再执行匹配主线。

---

## 3) Review Gate

6 条 review lane 的最终结论：

1. Foundation / DevEx / docs truth: `No material findings.`
2. Matching engine / scoring / fallback / refresh semantics: `No material findings.`
3. Contact request state machine / idempotency / conversation creation: `No material findings.`
4. API / DB / indexes / authorization boundaries: `No material findings.`
5. Frontend / results page / inbox / placeholder / verify handoff: `No material findings.`
6. Skeptic review on M3-vs-M4 boundary, stale suggestions, and duplicate-contact behavior: `No material findings.`

---

## 4) Remaining Accepted Risks

当前仍显式接受但不阻塞 M3 closeout 的风险：

- `pnpm test:live-sources` 仍然不进默认 CI
- `packages/db/test/db.integration.test.ts` 仍然是 opt-in
- CFC live adapter 仍依赖上游 PDF 结构和本地 `pdftotext`
- `M3` 只提供 `conversation placeholder`，真实消息流和聊天安全动作仍在 `M4`
- inbox 仍采用客户端 polling，不依赖 push infra

---

## 5) Next Phase

下一阶段唯一入口：`M4`

`M4` 负责：

- 会话列表
- 消息发送/读取
- 真实聊天页
- 举报 / 拉黑
- 敏感信息拦截

进入 `M4` 时，当前分支的阶段真值应视为：`M3 completed / M4 pending`。
