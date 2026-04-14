# WeaveNYC — M6 Closeout

状态：`M6 completed`

日期：`2026-04-14`

说明：本文档记录 `M6` closeout 的验证链和 review gate。当前 `main` 的 canonical baseline 已收口到 `M6 completed`；`feature/m7-staging-rehearsal` 是当前 `M7 in progress` 的 branch-local truth。

---

## 1) Scope Closed

- HTTP-first P2P sync overlay
- `GET /v1/communities/:community_id/bootstrap`
- `GET /v1/communities/:community_id/sync`
- `GET /v1/ws/p2p?token=...`
- PWA worker / Dexie / offline replay path
- `posts` / `announcements` / `report.created` / `moderation.decision` 的 replay semantics

---

## 2) Validation Status

当前已通过：

- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm test`
- [x] `pnpm build`
- [x] `docker compose up -d`
- [x] `pnpm db:migrate`
- [x] `pnpm db:seed`
- [x] `pnpm test:e2e`
- [x] `pnpm test:smoke:real`
- [x] `pnpm test:smoke:p2p`
- [x] docs truth assertions for owned M6 docs
- [x] 6-lane review gate

验证约束：

- `pnpm test:smoke:real` 只有在 fresh `pnpm db:migrate` + `pnpm db:seed` 后通过时，才可计入 M6 closeout
- `pnpm test:smoke:p2p` 仍然是独立 overlay smoke；它已经进入 canonical validation 链，但不在默认 CI 中自动运行
- `pnpm test:live-sources` 仍然是 manual / opt-in，不属于 M6 closeout 默认 gate
- `pnpm dev:mint-anchor-token` 仍然只是 dev/debug fallback，不属于正式 rehearsal 主路径

---

## 3) Review Gate

固定 6 条 review lane：

1. Docs truth / phase boundary
2. P2P protocol / event model / versioning
3. Bootstrap / sync API / embedded anchor runtime
4. Edge worker / Dexie cache / offline recovery
5. Report + moderation sync semantics
6. Stretch demo / mDNS / skeptic review

当前状态：

- 6 条 lane 已全部返回 `No material findings`
- 当前主线阶段状态已经切到 `M6 completed / M7 in progress`
- 当前验证证据以上面的命令通过结果为准；`main` 已承接 M6 canonical baseline

---

## 4) Remaining Risks

- `pnpm test:live-sources` 仍然是 manual / opt-in
- `packages/db/test/db.integration.test.ts` 仍然是 opt-in
- 当前 `M7` 仍处于 staging truth 收口阶段，deployment / ops / production / canary 仍然只在 docs 里作为 future notes 存在
- 当前剩余风险不在于 M6 不可运行，而在于 M7 还未形成可重复的 staging rehearsal automation

---

## 5) Next Phase

- `M6` 已完成 closeout
- 下一阶段入口是 `M7 in progress`
- `M7` 的目标是把 `README`、`00_Execution_Baseline.md`、`11_Ops_Runbook.md`、`12_Testing_Strategy.md`、`13_Implementation_Plan.md`、`14_Backlog.md`、`19_Deployment_Guide.md` 的 truth 收口保持一致
