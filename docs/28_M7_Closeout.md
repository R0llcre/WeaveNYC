# WeaveNYC — M7 Closeout

状态：`M7 completed`

日期：`2026-04-14`

说明：本文档记录已经合并到 `main` 的 M7 closeout。当前 canonical baseline 固定为 `main = M7 completed`；下一阶段固定为 `M8 Pilot Readiness`。本文档只记录已完成的 M7 目标、验证链、剩余风险和下一阶段入口，不再把 `feature/m7-staging-rehearsal` 作为入口真值。

---

## 1) Scope Closed

M7 已完成并收口到 `main` 的范围：

- split runtimes behind gateway
  - `api-gateway`
  - `posts-service`
  - `match-service`
  - `chat-service`
  - `resource-directory-service`
  - `notifications-service`
- notifications runtime 已进入当前 staging rehearsal contract
- deploy / smoke / backup-rehearsal workflows 已落地：
  - `.github/workflows/deploy-staging.yml`
  - `.github/workflows/smoke-staging.yml`
  - `.github/workflows/backup-restore-rehearsal.yml`
- fail-fast staging env/runtime contract 已落地：
  - [`deploy/runtime-contracts.json`](/Users/kairan/Documents/Spring26/WeaveNYC/deploy/runtime-contracts.json)
  - [`deploy/env-profiles.json`](/Users/kairan/Documents/Spring26/WeaveNYC/deploy/env-profiles.json)
- staging deploy / smoke / restore helper scripts 已落地：
  - [`scripts/staging/deploy-staging.ts`](/Users/kairan/Documents/Spring26/WeaveNYC/scripts/staging/deploy-staging.ts)
  - [`scripts/staging/smoke-staging.ts`](/Users/kairan/Documents/Spring26/WeaveNYC/scripts/staging/smoke-staging.ts)
  - [`scripts/staging/backup-restore-rehearsal.ts`](/Users/kairan/Documents/Spring26/WeaveNYC/scripts/staging/backup-restore-rehearsal.ts)
- docs truth 已同步到 main-first 口径，不再把 branch-local `M7 in progress` 当成入口事实

---

## 2) Validation Basis

当前 closeout 只记录 **repo-grounded** 的 M7 证据，不把 hosted staging 执行结果写成已通过事实。

可直接从当前主线证明的验证基础：

- repo 默认 validation 链已固定在 [`package.json`](/Users/kairan/Documents/Spring26/WeaveNYC/package.json) 和 [`ci.yml`](/Users/kairan/Documents/Spring26/WeaveNYC/.github/workflows/ci.yml)
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
- staging rehearsal workflow / script contract 已合入主线：
  - [`deploy-staging.yml`](/Users/kairan/Documents/Spring26/WeaveNYC/.github/workflows/deploy-staging.yml)
  - [`smoke-staging.yml`](/Users/kairan/Documents/Spring26/WeaveNYC/.github/workflows/smoke-staging.yml)
  - [`backup-restore-rehearsal.yml`](/Users/kairan/Documents/Spring26/WeaveNYC/.github/workflows/backup-restore-rehearsal.yml)
  - [`scripts/staging/deploy-staging.ts`](/Users/kairan/Documents/Spring26/WeaveNYC/scripts/staging/deploy-staging.ts)
  - [`scripts/staging/smoke-staging.ts`](/Users/kairan/Documents/Spring26/WeaveNYC/scripts/staging/smoke-staging.ts)
  - [`scripts/staging/backup-restore-rehearsal.ts`](/Users/kairan/Documents/Spring26/WeaveNYC/scripts/staging/backup-restore-rehearsal.ts)
- PR review comments 已处理，review threads 已 resolve

当前明确不写成已通过事实的内容：

- hosted staging deploy / smoke / backup workflow 成功执行
- production rollout 或 pilot rollout

说明：

- `deploy-staging` 负责 split-runtime deploy apply；`smoke-staging` 负责公网 smoke；`backup-restore-rehearsal` 负责 restore-to-shadow 演练。
- 这些 workflow 和脚本已经成为当前 `main` 的 canonical staging contract，但 hosted staging execution evidence 仍需在 `M8 Pilot Readiness` 中补齐。

---

## 3) Review / Merge Evidence

- PR: `#7`
- 状态：`merged`
- merged at：`2026-04-14T19:13:36Z`
- merge commit：`0c777029a5e6dc0ddeb422ab50eac8e65072f9f4`
- review threads：`4 / 4 resolved`

---

## 4) Accepted Residual Risks

- staging rehearsal 已就绪，但不代表 production rollout
- observability 仍然是最小组合，不是 full ops stack
- backup / restore 仍然是 rehearsal 级，不是 production DR program
- 最新可见的 GitHub Actions 记录中，`Deploy Staging` on `main` 为 failure，`Smoke Staging` 为 skipped；因此本文档不把 hosted staging run 成功视为 M7 closeout 证据

---

## 5) Next Phase

- 下一阶段入口固定为 `M8 Pilot Readiness`
- `M8` 只做试点上线准备，不做新业务能力或 production cutover
- `M8` 允许继续收口：
  - pilot deployment contract
  - ops minimum viable readiness
  - recovery / rollback / incident templates
  - pilot execution checklist
  - go / no-go checklist
