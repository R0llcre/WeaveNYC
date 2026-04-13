# WeaveNYC — Execution Baseline (Main-First Canonical Baseline)

状态：`CANONICAL`

目的：把当前仓库真实状态、阶段状态、文档优先级和已经冻结的 M0-M5 决策写成单一基线，避免继续引用 pre-M1 口径，也避免把 branch closeout 当成 canonical baseline。

---

## 1) 当前仓库真实状态

- 当前仓库已经不是 docs-only planning repo，而是 **可本地 bootstrap 的 monorepo**。
- `main` 是 canonical baseline，当前稳定基线为 `M5 completed`。
- 当前根目录真实包含：`apps/`、`services/`、`packages/`、`infra/`、`.github/`、`docs/`、`diagrams/`、`templates/`、`archive/`、`README.md`、`docker-compose.yml`、`package.json`、`pnpm-workspace.yaml`、`.env.example`。
- 当前可运行的共享服务面：
  - PWA：`http://localhost:3000`
  - Anchor Admin：`http://localhost:3001`
  - API Gateway：`http://localhost:4000`
  - Swagger：`http://localhost:4000/docs`
- 当前已验证的共享 API 面：
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
- 当前已完成并已验证的 M2-M5 API 面：
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
  - `GET /v1/posts/:post_id/matches`
  - `POST /v1/match/contact`
  - `GET /v1/contact-requests/inbox`
  - `POST /v1/contact-requests/:contact_request_id/accept`
  - `POST /v1/contact-requests/:contact_request_id/reject`
  - `GET /v1/conversations`
  - `GET /v1/conversations/:conversation_id`
  - `GET /v1/conversations/:conversation_id/messages`
  - `POST /v1/conversations/:conversation_id/messages`
  - `POST /v1/conversations/:conversation_id/close`
  - `POST /v1/blocks`
  - `POST /v1/reports`
  - `GET /v1/ws/chat?token=...`
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
| `M2` | `completed` | community join、posting、visibility、minimal review、speech fallback 已冻结 |
| `M3` | `completed` | matching、Top-3 suggestions、contact requests、recipient inbox 已完成 |
| `M4` | `completed` | live chat、message send/read、block/report、WebSocket realtime 已完成 |
| `M5` | `completed` | Anchor Admin、report queue、announcements、rules、dashboard、pilot rehearsal、real smoke、E2E 和 6-lane review gate 已关闭 |
| `M6` | `optional_next_phase` | 是否启动取决于 M5 分支合回 `main` 之后的下一轮排期决策 |

结论：

- 当前 workspace 的 canonical 阶段真值应表述为：`main = M5 completed`。

---

## 3) 已完成能力（M0-M2 基线）

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
- 当前验证命令分层：
  - canonical `main` baseline：`pnpm install --frozen-lockfile`、`pnpm typecheck`、`pnpm lint`、`pnpm test`、`pnpm build`
  - canonical integration gate：`pnpm db:migrate`、`pnpm db:seed`、`pnpm test:smoke:real`、`pnpm test:e2e`
  - `pnpm test:smoke:real` 只有在同一轮 fresh `db:migrate` + `db:seed` 后通过，才可计入 M5 closeout
  - manual / opt-in：`pnpm test:live-sources`、`pnpm dev:mint-anchor-token`

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
5. [`23_M2_Closeout.md`](./23_M2_Closeout.md)
6. [`24_M3_Closeout.md`](./24_M3_Closeout.md)
7. [`25_M4_Closeout.md`](./25_M4_Closeout.md)
8. [`26_M5_Closeout.md`](./26_M5_Closeout.md)
9. `01_Vision_And_Principles.md`
10. `02_PRD.md`
11. `03_User_Flows_And_Screens.md`
12. `13_Implementation_Plan.md`
13. `14_Backlog.md`
14. `04_Data_Sources.md`、`09_API_Spec.md`、`18_Auth_Design.md`、`08_Data_Model.md`、`20_DB_Schema_Reference.md`

---

## 5) 文档优先级

从现在开始，发生冲突时按以下顺序取值：

1. 本文档（`00_Execution_Baseline.md`）
2. `README.md`
3. [`26_M5_Closeout.md`](./26_M5_Closeout.md)
4. [`25_M4_Closeout.md`](./25_M4_Closeout.md)
5. [`24_M3_Closeout.md`](./24_M3_Closeout.md)
6. [`23_M2_Closeout.md`](./23_M2_Closeout.md)
7. [`22_M1_Closeout.md`](./22_M1_Closeout.md)
8. [`21_M0_Closeout.md`](./21_M0_Closeout.md)
9. 产品与交互：`02_PRD.md`、`03_User_Flows_And_Screens.md`
10. 工程契约：`09_API_Spec.md`、`18_Auth_Design.md`、`08_Data_Model.md`、`20_DB_Schema_Reference.md`
11. 计划与阶段状态：`13_Implementation_Plan.md`、`14_Backlog.md`
12. 历史材料：`archive/`

---

## 6) 冻结决策（M2-M4 前继续有效）

### 6.1 社区加入机制

- `M2` 采用 **邀请码 / 二维码加入社区**。
- 实现路径固定为：
  - `POST /v1/community-access/resolve` 接受 `invite_code` 或 `qr_token`
  - 返回绑定当前 user / community 的短期 `join_token`
  - `POST /v1/communities/:community_id/join` 消费 `join_token` 并创建 / 复用 `community_members`
- 不做开放社区搜索加入。
- `community_only` 是默认可见性，但前提是用户已经加入某个社区。

### 6.2 认证与身份

- `user_id` 一律使用 UUID。
- JWT 中的 `level` 一律使用字符串枚举：`anonymous`、`verified`、`anchor`。
- 匿名账户创建接口：`POST /v1/auth/anonymous`
- 升级路径：
  - 主路径：手机号 OTP
  - 备选路径：邮箱 magic link
- 权限真值：
  - anonymous member 可发布 low / medium risk `request`
  - `offer` 必须 `level >= verified`
  - high-risk `request` / `offer` 都要求 `level >= verified` 且进入 `pending_review`
- `POST /v1/community-access/resolve` / `POST /v1/communities/:community_id/join` 接受 anonymous JWT，不要求 verified。
- Token 策略冻结为：
  - `access_token`：15 分钟
  - `refresh_token`：7 天
- Anchor Admin 主链路已经切到真实 M5 激活流：verified session -> `POST /v1/auth/anchor/activate` -> `POST /v1/auth/anchor/activate/confirm` -> `POST /v1/auth/anchor/session/start` -> `POST /v1/auth/anchor/session/verify`。
- `pnpm dev:mint-anchor-token` 仅保留为 dev/debug fallback，不属于 M5 pilot rehearsal 或 closeout 主路径。

### 6.3 聊天与建联

- `POST /v1/match/contact` 不直接创建 live conversation。
- 该接口只创建 `contact_request`，返回 `contact_request_id` 和 `status = pending`。
- recipient 在 canonical `/inbox` 的 Requests 视图里处理请求；`GET /v1/contact-requests/inbox` 仅作为底层 contact-request API，`accept` / `reject` 都要求 `level >= verified` 且保持幂等。
- `accept` 当场创建真实 `conversation`，不再停在 placeholder。
- `M4` 范围内额外包含：
  - `GET /v1/conversations`
  - `GET /v1/conversations/:conversation_id`
  - `GET /v1/conversations/:conversation_id/messages`
  - `POST /v1/conversations/:conversation_id/messages`
  - `POST /v1/conversations/:conversation_id/close`
  - `POST /v1/blocks`
  - `POST /v1/reports`
  - `GET /v1/ws/chat?token=...`
- 最小通知实现仍以 in-app inbox badge + 客户端 polling 为主；聊天页实时消息通过 WebSocket + Redis Pub/Sub 交付。

### 6.4 M3 匹配冻结边界

- 邻里匹配池固定为：同社区、`active`、未过期、非 `anchor_mediated` 的 Offer。
- 结果集固定为 Top-3，且永远包含官方资源兜底。
- `refresh=true` 最多只允许再拿 1 批新结果；超过预算后返回当前批次。
- 匹配解释标签只使用当前已存在的信号。
- `anchor_reviewed` 只表示候选帖子本身已存在 Anchor review 信号，不引入新的“已完成帮助验证”流程。

### 6.5 官方资源目录 canonical schema

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

当前主线已经承接 `M5 Anchor Admin + pilot rehearsal` 的已实现事实；相关细节分别记录在 `24_M3_Closeout.md`、`25_M4_Closeout.md` 与 `26_M5_Closeout.md`。
main-first 口径下，下一步唯一入口是决定是否启动 `M6`；`M6` 属于后续可选阶段，不再被未关闭的 M5 gate 阻塞。

1. [`13_Implementation_Plan.md`](/Users/kairan/Documents/Spring26/WeaveNYC/docs/13_Implementation_Plan.md)
2. [`14_Backlog.md`](/Users/kairan/Documents/Spring26/WeaveNYC/docs/14_Backlog.md)
3. [`09_API_Spec.md`](/Users/kairan/Documents/Spring26/WeaveNYC/docs/09_API_Spec.md)
4. [`03_User_Flows_And_Screens.md`](/Users/kairan/Documents/Spring26/WeaveNYC/docs/03_User_Flows_And_Screens.md)
