# WeaveNYC — M5 Closeout

状态：`M5 completed`

日期：`2026-04-12`

说明：本文档记录 `M5` closeout 过程、验证链和 6-lane review gate。当前 `main` 的 canonical baseline 已收口到 `M5 completed`。

---

## 1) Scope Closed

- Anchor auth + TOTP step-up
- Anchor Admin UI
- posts / reports review queue
- announcements
- community rules
- basic dashboard
- demo / pilot rehearsal

---

## 2) Validation Status

当前已通过：

- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm test`
- [x] `pnpm build`
- [x] `pnpm db:migrate`
- [x] `pnpm db:seed`
- [x] `pnpm test:e2e`
- [x] docs truth assertions for owned M5 docs
- [x] `pnpm test:smoke:real`
- [x] 6-lane review gate
- [x] final phase-status flip to `M5 completed / M6 optional`

验证约束：

- `pnpm test:smoke:real` 会在 `/readyz` 不可用时自启动 `api-gateway`，并且只有在同一轮 fresh `pnpm db:migrate` + `pnpm db:seed` 后通过，才可计入 M5 closeout
- `pnpm test:live-sources` 仍然是 manual / opt-in，不属于 M5 closeout 默认 gate
- `pnpm dev:mint-anchor-token` 只是 dev/debug fallback，不属于 M5 truth invariant，也不是正式 rehearsal 必经步骤

---

## 4) Review Gate

固定 6 条 review lane：

1. Foundation / DevEx / docs truth
2. Anchor auth / TOTP / session security
3. Moderation / report queue / status transitions
4. Announcements / rules / dashboard / DB contracts
5. Anchor Admin UX + PWA announcement surfacing
6. Demo / pilot rehearsal / validation coverage

当前状态：

- 6 条 lane 已全部返回 `No material findings`
- 当前主线阶段状态已经切到 `M5 completed / M6 optional`
- 当前验证证据以上面的命令通过结果为准；`main` 已承接 M5 canonical baseline

---

## 5) Remaining Risks

- `pnpm test:live-sources` 仍然是 manual / opt-in
- `packages/db/test/db.integration.test.ts` 仍然是 opt-in
- CI 已经默认跑 Docker-backed smoke/bootstrap 验收：
  - `docker compose up -d`
  - `pnpm db:migrate`
  - `pnpm db:seed`
  - `pnpm test:smoke:real`
  - `pnpm test:e2e`
- 当前剩余风险不在于 CI 缺少 Docker-backed 验收，而在于 live-source importer 仍然保持 manual / opt-in

---

## 6) Next Phase

- `M5` 已完成 closeout
- 下一阶段入口是 `M6 optional`
