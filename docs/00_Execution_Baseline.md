# WeaveNYC — Execution Baseline (M0-M1)

状态：`CANONICAL`

目的：把当前仓库真实状态、阶段状态、文档优先级和已经冻结的 M1 前置决策写成单一基线，避免继续引用 pre-M0 口径。

---

## 1) 当前仓库真实状态

- 当前仓库已经不是 docs-only planning repo，而是 **可本地 bootstrap 的 M0 monorepo**。
- 当前根目录真实包含：`apps/`、`services/`、`packages/`、`infra/`、`.github/`、`docs/`、`diagrams/`、`templates/`、`archive/`、`README.md`、`docker-compose.yml`、`package.json`、`pnpm-workspace.yaml`、`.env.example`。
- 当前可运行的 M0 服务面：
  - PWA：`http://localhost:3000`
  - Anchor Admin：`http://localhost:3001`
  - API Gateway：`http://localhost:4000`
  - Swagger：`http://localhost:4000/docs`
- 当前已验证的 M0 API 面：
  - `GET /healthz`
  - `GET /readyz`
  - `POST /v1/auth/anonymous`
  - `GET /v1/me`
- 当前真实 bootstrap 顺序：

```bash
pnpm install
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

---

## 2) 官方阶段状态

| 阶段 | 状态 | 说明 |
|------|------|------|
| `P0` | `completed` | 入口、命名、契约已冻结 |
| `M0` | `completed` | monorepo skeleton、本地基础设施、匿名 auth 最小闭环、CI stub 已落地 |
| `M1` | `pending` | 下一个唯一主线阶段：official resource directory |
| `M2-M5` | `planned` | 继续按 phased roadmap 推进 |
| `M6` | `optional` | 仅在 MVP 主线稳定后进入 |

结论：

- 不再对外表述“先把 M0 做出来”。
- 当前唯一下一阶段是 `M1 official resource directory`。

---

## 3) M0 验收事实

M0 已通过的仓库级验收：

- 根 `package.json` 提供 `dev`、`build`、`lint`、`typecheck`、`test`、`db:migrate`、`db:seed`
- `infra/docker-compose.yml` 和根 `docker-compose.yml` 可启动 PostgreSQL / Redis
- `infra/dev/jwt-private.pem`、`infra/dev/jwt-public.pem` 已作为 dev bootstrap artifacts 入库
- `apps/pwa`、`apps/anchor-admin`、`services/api-gateway` 可参与 `pnpm dev`
- `packages/shared`、`packages/db`、`packages/test-utils` 已接通 workspace
- `GET /healthz`、`GET /readyz`、匿名会话签发、JWT 受保护路由均已可用

当前唯一已知残余风险：

- CI 默认不跑 Docker-backed DB integration
- [`packages/db/test/db.integration.test.ts`](/Users/kairan/Documents/Spring26/WeaveNYC/packages/db/test/db.integration.test.ts) 目前为 opt-in

---

## 4) 推荐阅读路径

1. `README.md`
2. 本文档（当前真值基线）
3. [`21_M0_Closeout.md`](./21_M0_Closeout.md)
4. `01_Vision_And_Principles.md`
5. `02_PRD.md`
6. `03_User_Flows_And_Screens.md`
7. `13_Implementation_Plan.md`
8. `14_Backlog.md`
9. `04_Data_Sources.md`、`09_API_Spec.md`、`18_Auth_Design.md`、`08_Data_Model.md`、`20_DB_Schema_Reference.md`

---

## 5) 文档优先级

从现在开始，发生冲突时按以下顺序取值：

1. 本文档（`00_Execution_Baseline.md`）
2. [`21_M0_Closeout.md`](./21_M0_Closeout.md)
3. `README.md`
4. 产品与交互：`02_PRD.md`、`03_User_Flows_And_Screens.md`
5. 工程契约：`09_API_Spec.md`、`18_Auth_Design.md`、`08_Data_Model.md`、`20_DB_Schema_Reference.md`
6. 计划与阶段状态：`13_Implementation_Plan.md`、`14_Backlog.md`
7. 历史材料：`archive/`

---

## 6) 冻结决策（M1 前继续有效）

### 6.1 社区加入机制

- `M1-M2` 采用 **邀请码 / 二维码加入社区**。
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
- 最小通知实现先用 in-app pending request / inbox badge + 客户端 polling；push 不是 M0/M1 前置。

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

M0 关闭后，下一阶段统一进入 `M1 official resource directory`。

M1 入口文档固定从以下四份开始：

1. [`13_Implementation_Plan.md`](/Users/kairan/Documents/Spring26/WeaveNYC/docs/13_Implementation_Plan.md)
2. [`14_Backlog.md`](/Users/kairan/Documents/Spring26/WeaveNYC/docs/14_Backlog.md)
3. [`04_Data_Sources.md`](/Users/kairan/Documents/Spring26/WeaveNYC/docs/04_Data_Sources.md)
4. [`09_API_Spec.md`](/Users/kairan/Documents/Spring26/WeaveNYC/docs/09_API_Spec.md)
