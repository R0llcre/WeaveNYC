# WeaveNYC — Execution Baseline (M1 Complete -> M2)

状态：`CANONICAL`

目的：把当前仓库真实状态、阶段状态、文档优先级和已经冻结的 M2 前置决策写成单一基线，避免继续引用 pre-M1 口径，也避免在进入 `M2` 后再次漂移 M1 closeout 真值。

---

## 1) 当前仓库真实状态

- 当前仓库已经不是 docs-only planning repo，而是 **可本地 bootstrap 的 M1 complete monorepo**。
- 当前根目录真实包含：`apps/`、`services/`、`packages/`、`infra/`、`.github/`、`docs/`、`diagrams/`、`templates/`、`archive/`、`README.md`、`docker-compose.yml`、`package.json`、`pnpm-workspace.yaml`、`.env.example`。
- 当前可运行的 M1 服务面：
  - PWA：`http://localhost:3000`
  - Anchor Admin：`http://localhost:3001`
  - API Gateway：`http://localhost:4000`
  - Swagger：`http://localhost:4000/docs`
- 当前已验证的 API 面：
  - `GET /healthz`
  - `GET /readyz`
  - `POST /v1/auth/anonymous`
  - `POST /v1/auth/refresh`
  - `POST /v1/auth/otp/start`
  - `POST /v1/auth/otp/verify`
  - `POST /v1/auth/magic-link/start`
  - `POST /v1/auth/magic-link/verify`
  - `GET /v1/me`
  - `GET /v1/resources`
  - `GET /v1/resources/:provider_id`
- 当前真实 bootstrap 顺序：

```bash
pnpm install
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

- 只有在上述 bootstrap 顺序成功完成后，下面这些服务面和 API 面才应被视为“当前可运行”。

---

## 2) 官方阶段状态

| 阶段 | 状态 | 说明 |
|------|------|------|
| `P0` | `completed` | 入口、命名、契约已冻结 |
| `M0` | `completed` | monorepo skeleton、本地基础设施、匿名 auth 最小闭环、CI stub 已落地 |
| `M1` | `completed` | 资源目录、扩展认证、real API smoke、fixture browser smoke、6-lane rereview 已完成 |
| `M2` | `pending` | 下一阶段是 posting + community visibility |
| `M3-M5` | `planned` | 继续按 phased roadmap 推进 |
| `M6` | `optional` | 仅在 MVP 主线稳定后进入 |

结论：

- 当前可以对外表述 `M1 completed`。
- 当前唯一主线已切换为 `M2 posting + community visibility`。

---

## 3) M1 候选验收事实

当前已经落地并完成 closeout 的仓库级事实：

- 根 `package.json` 提供 `dev`、`build`、`lint`、`typecheck`、`test`、`test:smoke:real`、`test:e2e`、`test:live-sources`、`db:migrate`、`db:seed`
- `infra/docker-compose.yml` 和根 `docker-compose.yml` 可启动 PostgreSQL / Redis
- `infra/dev/jwt-private.pem`、`infra/dev/jwt-public.pem` 已作为 dev bootstrap artifacts 入库
- `apps/pwa`、`apps/anchor-admin`、`services/api-gateway` 可参与 `pnpm dev`
- `services/resource-directory` 已从 placeholder 升级为导入/解析/merge/geocode/CLI 宿主
- `packages/shared`、`packages/db`、`packages/test-utils` 已接通 workspace
- `GET /healthz`、`GET /readyz`、匿名会话、refresh rotation、OTP、magic-link fallback 均已有实现面
- `GET /v1/resources`、`GET /v1/resources/:provider_id` 已可用
- PWA 首页已切到 M1 资源发现入口，`/verify` 与 `/dev/m0` 已拆分
- 默认 CI 现在区分：
  - real API smoke：`pnpm test:smoke:real`
  - fixture-backed browser smoke：`pnpm test:e2e`
  - manual / opt-in live-source smoke：`pnpm test:live-sources`

当前显式接受的残余风险：

- CI 默认仍不跑 live-source smoke
- CFC live adapter 依赖上游 PDF 结构与本地 `pdftotext`
- [`packages/db/test/db.integration.test.ts`](/Users/kairan/Documents/Spring26/WeaveNYC/packages/db/test/db.integration.test.ts) 仍为 opt-in

---

## 4) 推荐阅读路径

1. `README.md`
2. 本文档（当前真值基线）
3. [`21_M0_Closeout.md`](./21_M0_Closeout.md)
4. [`22_M1_Closeout.md`](./22_M1_Closeout.md)
5. `01_Vision_And_Principles.md`
6. `02_PRD.md`
7. `03_User_Flows_And_Screens.md`
8. `13_Implementation_Plan.md`
9. `14_Backlog.md`
10. `04_Data_Sources.md`、`09_API_Spec.md`、`18_Auth_Design.md`、`08_Data_Model.md`、`20_DB_Schema_Reference.md`

---

## 5) 文档优先级

从现在开始，发生冲突时按以下顺序取值：

1. 本文档（`00_Execution_Baseline.md`）
2. `README.md`
3. [`22_M1_Closeout.md`](./22_M1_Closeout.md)
4. [`21_M0_Closeout.md`](./21_M0_Closeout.md)
5. 产品与交互：`02_PRD.md`、`03_User_Flows_And_Screens.md`
6. 工程契约：`09_API_Spec.md`、`18_Auth_Design.md`、`08_Data_Model.md`、`20_DB_Schema_Reference.md`
7. 计划与阶段状态：`13_Implementation_Plan.md`、`14_Backlog.md`
8. 历史材料：`archive/`

---

## 6) 冻结决策（M2 前继续有效）

### 6.1 社区加入机制

- `M2` 采用 **邀请码 / 二维码加入社区**。
- 实现路径固定为：邀请码 / 二维码 -> 创建 `community_members` -> 开放 `community_only` feed / post visibility。
- 不做开放社区搜索加入。
- `community_only` 是默认可见性，但前提是用户已经加入某个社区。

### 6.2 认证与身份

- `user_id` 一律使用 UUID。
- JWT 中的 `level` 一律使用字符串枚举：`anonymous`、`verified`、`anchor`。
- 匿名账户创建接口：`POST /v1/auth/anonymous`
- 升级路径：
  - 主路径：手机号 OTP
  - 备选路径：邮箱 magic link
- Token 策略冻结为：
  - `access_token`：15 分钟
  - `refresh_token`：7 天
- Anchor 激活接口冻结为：`POST /v1/auth/anchor/activate`

### 6.3 聊天建联

- `POST /v1/match/contact` 不直接创建 `conversation`。
- 该接口只创建 `contact_request`，返回 `contact_request_id` 和 `status = pending`。
- 只有在对方接受后，才创建 `conversation`。
- 最小通知实现先用 in-app pending request / inbox badge + 客户端 polling；push 不是 M2 前置。

### 6.4 官方资源目录 canonical schema

`resource_providers` 以以下字段为准：

- `provider_id`
- `source`
- `source_ref`
- `name`
- `type`
- `address_text`
- `city`
- `state`
- `zip`
- `phone`
- `hours_json`
- `languages`
- `eligibility_notes`
- `lat`
- `lng`
- `geo_precision`
- `content_hash`
- `dataset_version`
- `status`
- `last_seen_at`
- `last_verified_at`
- `created_at`
- `updated_at`

说明：

- `type` 统一替代 `provider_type`
- 导入回滚依赖 `dataset_version + status`
- 变更检测依赖 `source_ref + content_hash`

---

## 7) 历史说明

- 仓库早期确实曾处于 docs-first planning 阶段。
- 凡是仍写着“当前还不能 `pnpm dev` / `pnpm db:migrate` / 不存在 `apps/`、`services/`、`packages/`”的旧表述，都应视为 **历史口径**，不再代表当前仓库事实。

---

## 8) 下一步唯一入口

当前下一阶段已进入 `M2 posting + community visibility` 规划入口。

M2 入口文档固定从以下四份开始：

1. [`13_Implementation_Plan.md`](/Users/kairan/Documents/Spring26/WeaveNYC/docs/13_Implementation_Plan.md)
2. [`14_Backlog.md`](/Users/kairan/Documents/Spring26/WeaveNYC/docs/14_Backlog.md)
3. [`02_PRD.md`](/Users/kairan/Documents/Spring26/WeaveNYC/docs/02_PRD.md)
4. [`03_User_Flows_And_Screens.md`](/Users/kairan/Documents/Spring26/WeaveNYC/docs/03_User_Flows_And_Screens.md)
