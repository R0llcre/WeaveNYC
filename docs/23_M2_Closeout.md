# WeaveNYC — M2 Closeout Status

状态：`completed_on_branch`

日期：`2026-04-06`

当前分支阶段状态：`P0 completed` · `M0 completed` · `M1 completed` · `M2 completed on branch` · `M3 pending`

目的：记录 M2 正式 closeout 的真实状态、通过的验证链、6-lane rereview 结论，以及关闭后仍接受的剩余风险。

---

## 1) 当前结论

- `M2 community join + posts + minimal review` 已完成
- invite code / QR 的 `resolve -> join` 两步链路已落地
- Request / Offer 的 verified gating、risk classification、visibility policy、manual moderation path、speech fallback 都已落地
- 6-lane rereview 最终全部返回 `No material findings`
- 下一阶段统一切换为 `M3 matching + action plans`

---

## 2) 关闭时验证基线

M2 关闭时通过的默认验证基线是：

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm test:e2e
pnpm test:smoke:real
pnpm test:live-sources
```

关闭时的验证切分：

- default / branch-gate：
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
  - `docker compose up -d`
  - `pnpm db:migrate`
  - `pnpm db:seed`
  - `pnpm test:e2e`
  - `pnpm test:smoke:real`
- manual / opt-in：
  - `pnpm test:live-sources`

---

## 3) 通过的 Checks

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- `docker compose up -d`
- `pnpm db:migrate`
- `pnpm db:seed`
- `pnpm test:e2e`
- `pnpm test:smoke:real`
- `pnpm test:live-sources`

---

## 4) 关闭时通过的 M2 Surface

- `POST /v1/community-access/resolve`
- `POST /v1/communities/:community_id/join`
- `POST /v1/posts`
- `GET /v1/posts`
- `GET /v1/posts/:post_id`
- `GET /v1/posts/mine`
- `PATCH /v1/posts/:post_id`
- `POST /v1/posts/:post_id/close`
- `DELETE /v1/posts/:post_id`
- `GET /v1/admin/review_queue`
- `POST /v1/admin/review_queue/:post_id/decision`
- `POST /v1/speech/transcribe`
- PWA `/community`
- PWA `/community/join`
- PWA `/posts/new`
- PWA `/posts/[postId]`
- PWA `/posts/mine`
- `pnpm dev:mint-anchor-token`

---

## 5) 6-Lane Rereview

- Foundation / DevEx / docs truth: `No material findings`
- Community join / membership / auth gating: `No material findings`
- Posts domain / risk / visibility / status transitions: `No material findings`
- API / DB / query behavior / moderation API: `No material findings`
- Frontend / PWA / join-flow / compose / feed / my-posts: `No material findings`
- Voice input / fallback / cross-cutting skeptic review: `No material findings`

---

## 6) 当前接受的剩余风险

- `main` 仍停在 `M1 completed`，当前 `M2 completed` 只存在于 `feature/m2-community-posts`，需通过后续 commit / push / PR / merge 才能成为默认基线
- browser speech 仍依赖原生 `SpeechRecognition` 支持和权限 UX，不同浏览器 / 设备上行为会有差异
- `/v1/speech/transcribe` 的 multipart fallback 当前由 route tests 和 mocked browser smoke 覆盖，real API smoke 仍以 happy path 为主
- risk classification 仍是规则/关键词驱动，属于可解释但不智能的 MVP 方案

---

## 7) 下一阶段入口

M3 现在统一从以下文档进入：

1. [`13_Implementation_Plan.md`](<repo>/docs/13_Implementation_Plan.md)
2. [`14_Backlog.md`](<repo>/docs/14_Backlog.md)
3. [`02_PRD.md`](<repo>/docs/02_PRD.md)
4. [`03_User_Flows_And_Screens.md`](<repo>/docs/03_User_Flows_And_Screens.md)
5. [`09_API_Spec.md`](<repo>/docs/09_API_Spec.md)
