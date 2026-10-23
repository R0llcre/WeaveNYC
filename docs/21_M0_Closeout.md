# WeaveNYC — M0 Closeout

状态：`M0 completed`

日期：`2026-04-05`

当前官方阶段状态：`P0 completed` · `M0 completed` · `M1 pending`

目的：记录 M0 关单时通过的 checks、review gate 结论、唯一接受的剩余风险，以及正式阶段切换结果。

---

## 1) 关单结论

- `P0` 已完成
- `M0` 已完成
- `M1 official resource directory` 是当前唯一下一阶段

从现在开始，不再对外表述“先把 M0 做出来”。

---

## 2) 重新验证过的 M0 Checks

本轮关单重新跑过并通过：

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

运行面重新验证：

- `http://localhost:3000` 可打开
- `http://localhost:3001` 可打开
- `GET /healthz` 返回 `200`
- `GET /readyz` 返回 `200`
- `POST /v1/auth/anonymous` 按真实 contract 使用 `device_id` 时返回 `access_token`、`refresh_token`、`user.level = anonymous`
- `GET /v1/me` 无 token 时返回 `401`
- `GET /v1/me` 带 token 时返回 `200`
- `http://localhost:4000/docs` 返回 `200`

说明：

- 本轮先遇到一次旧 dev 进程占用 `3000/3001/4000`，随后已清空端口并 fresh rerun `pnpm dev`。
- fresh rerun 后，PWA、Anchor Admin、API Gateway 都成功监听并再次通过页面 / endpoint 验证。

---

## 3) 通过的仓库级事实

- 根 workspace 已存在并可安装依赖
- `apps/`、`services/`、`packages/`、`infra/`、`.github/workflows/` 已存在
- `apps/pwa`、`apps/anchor-admin`、`services/api-gateway` 已形成当前 M0 运行面
- `packages/shared`、`packages/db`、`packages/test-utils` 已接通 workspace
- `.env.example`、`docker-compose.yml`、`infra/docker-compose.yml`、dev JWT keys 已入库
- CI stub 当前覆盖 `install -> typecheck -> lint -> test -> build`

---

## 4) Review Gate

固定 5 条 review lane：

1. Foundation / DevEx
2. API / Auth
3. DB / Migration
4. Frontend / PWA
5. CI / Test

Gate 规则：

- 任一 lane 出现 `P1` blocker，必须先修复再重跑该 lane
- 全部 lane 无 `P1` blocker，M0 才能正式关闭

最终结论：

- Foundation / DevEx：`No material findings`
- API / Auth：`No material findings`
- DB / Migration：`No material findings`
- Frontend / PWA：`No material findings`
- CI / Test：`No material findings`

first-pass blockers 与收敛记录：

- first pass 暴露过的 blocker 主要是：
  - 缺失 `21_M0_Closeout.md`
  - backlog 误把 `E1-S4`、`E9-S1`、`E9-S3` 标成 `Completed (M0)`
  - closeout 中遗留 `pending final lane result` 占位和过期的 `pnpm dev` 说明
- 上述问题均已修复，并按 gate 规则对受影响 lane 做了 rerun。

---

## 5) 唯一接受的剩余风险

- CI 默认不跑 Docker-backed DB integration
- [`packages/db/test/db.integration.test.ts`](<repo>/packages/db/test/db.integration.test.ts) 当前是 opt-in

除这一项外，M0 不再保留“仓库未起盘”或“文档只是目标态”的剩余风险表述。

---

## 6) M1 入口

M0 关闭后，M1 统一从以下文档进入：

1. [`13_Implementation_Plan.md`](<repo>/docs/13_Implementation_Plan.md)
2. [`14_Backlog.md`](<repo>/docs/14_Backlog.md)
3. [`04_Data_Sources.md`](<repo>/docs/04_Data_Sources.md)
4. [`09_API_Spec.md`](<repo>/docs/09_API_Spec.md)
