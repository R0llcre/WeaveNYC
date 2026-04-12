# WeaveNYC — Contribution Guide

> 状态：`main` 的稳定基线是 M2；`feature/m4-chat-safety` 的 M3/M4 只作为 branch closeout 记录。本文档只描述当前可运行命令和当前 main-first 真值。

---

## 1) 本地开发环境

### 1.1 前置要求

| 工具 | 版本建议 | 说明 |
|------|----------|------|
| Node.js | 20 LTS | 推荐用 `nvm` 管理 |
| pnpm | 10.33.x | workspace 包管理器 |
| Docker | 24.x+ | 本地 PostgreSQL / Redis |
| Git | 2.40+ | 版本控制 |
| `pdftotext` | Poppler | CFC live adapter 需要 |

### 1.2 Bootstrap 顺序

```bash
pnpm install
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

启动后可访问：

- PWA：`http://localhost:3000`
- Anchor Admin：`http://localhost:3001`
- API：`http://localhost:4000`
- Swagger：`http://localhost:4000/docs`

只有当这条 bootstrap 链完整成功后，下面列出的运行面和 smoke 命令才算当前可执行真值。

### 1.3 当前已实现的运行面

`main` canonical baseline：

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
- PWA 首页：language -> ZIP -> resources list -> detail -> bookmark
- PWA `/verify`：OTP + magic-link fallback
- PWA `/dev/m0`：保留 M0 debug
- Anchor Admin 首页：API health + login placeholder

当前 branch-local surface on `feature/m4-chat-safety`：

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
- PWA `/community`、`/community/join`、`/posts/new`、`/posts/[postId]`、`/posts/mine`
- PWA `/posts/[postId]/matches`、`/inbox`、`/conversations/[conversationId]`
- PWA `/contact-requests`：兼容性 redirect 到 `/inbox`
- Manual moderation helper：`pnpm dev:mint-anchor-token`

### 1.4 当前验证分层

- canonical `main` baseline：
  - `pnpm install --frozen-lockfile`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
- 当前 `feature/m4-chat-safety` branch-local gates：
  - `docker compose up -d`
  - `pnpm db:migrate`
  - `pnpm db:seed`
  - `pnpm test:smoke:real`
  - `pnpm test:e2e`
- Manual / opt-in：
  - `pnpm test:live-sources`
- 说明：
  - `pnpm test:smoke:real` 直接打本地 Fastify，不走浏览器 route mock
  - `pnpm test:e2e` 仍是 fixture-backed browser smoke
  - `pnpm test:live-sources` 不进默认 CI

### 1.5 环境变量

仓库自带 `.env.example`。如需本地覆盖，复制一份：

```bash
cp .env.example .env.local
```

关键变量：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `NODE_ENV` | `development` | 环境标识 |
| `LOG_LEVEL` | `debug` | 本地日志级别 |
| `API_PORT` | `4000` | API Gateway 端口 |
| `PWA_PORT` | `3000` | PWA 端口 |
| `PWA_BASE_URL` | `http://localhost:3000` | API 生成 magic-link demo URL 时使用的前端基地址 |
| `ANCHOR_ADMIN_PORT` | `3001` | Anchor Admin 端口 |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:4000` | 前端请求 API 的基地址 |
| `DATABASE_URL` | `postgres://weavenyc:weavenyc@localhost:5432/weavenyc_dev` | PostgreSQL 连接串 |
| `REDIS_URL` | `redis://localhost:6379` | Redis 连接串 |
| `JWT_SIGNING_PRIVATE_KEY` | `./infra/dev/jwt-private.pem` | RS256 私钥 |
| `JWT_SIGNING_PUBLIC_KEY` | `./infra/dev/jwt-public.pem` | RS256 公钥 |

安全提示：

- `.env.local` 已被忽略，不要提交真实密钥。
- `infra/dev/*` 仅用于本地开发 bootstrap，不得用于生产。

### 1.6 Bootstrap artifacts

当前仓库必须同时存在以下产物，当前 bootstrap 才成立：

- `.env.example`
- `docker-compose.yml`
- `infra/docker-compose.yml`
- `infra/dev/jwt-private.pem`
- `infra/dev/jwt-public.pem`
- `GET /healthz`
- `GET /readyz`
- `GET /v1/resources`
- `GET /v1/resources/:provider_id`

---

## 2) 当前 Repo 结构

```text
weavenyc/
├── apps/
│   ├── pwa/
│   └── anchor-admin/
├── services/
│   ├── api-gateway/
│   ├── resource-directory/   # M1 ingestion / parse / CLI host
│   ├── posts/                # M2 domain library (not a standalone runtime)
│   ├── match/                # M3 domain library (not a standalone runtime)
│   └── chat/                 # M4 domain library (not a standalone runtime)
├── packages/
│   ├── shared/
│   ├── db/
│   └── test-utils/
├── infra/
│   ├── docker-compose.yml
│   └── dev/
├── docs/
├── diagrams/
├── templates/
├── archive/
├── .github/workflows/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── .env.example
```

说明：

- `services/api-gateway` 是当前唯一运行中的 HTTP 后端服务。
- `services/resource-directory` 在 M1 已承载 real-source adapters、merge、geocoding、CLI smoke/import。
- `services/posts` 当前承载 community access、membership、posts、risk、visibility、minimal moderation 规则，但不单独启动。
- `services/match` 当前承载 match batching、contact request state machine、recipient inbox、accept/reject，但不单独启动。
- `services/chat` 当前承载 conversations、messages、block/report、message safety、WebSocket fan-out，但不单独启动。
- `packages/db` 持有 schema、migration、seed、测试。

---

## 3) 日常开发命令

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:smoke:real
pnpm test:e2e
pnpm test:live-sources
pnpm dev:mint-anchor-token
pnpm db:migrate
pnpm db:seed
pnpm resources:import:cfc
pnpm resources:import:island-harvest
```

命令真值：

- `pnpm dev`：并行启动 PWA、Anchor Admin、API Gateway
- `pnpm lint`：仓库级 ESLint
- `pnpm typecheck`：workspace 级 TypeScript 校验
- `pnpm test`：Vitest
- `pnpm build`：先 build shared / db / test-utils，再 build API 和两个前端
- `pnpm test:smoke:real`：真实 API smoke，需要 API gateway、PostgreSQL、Redis、seed 处于可用状态
- `pnpm test:e2e`：fixture-backed Playwright browser smoke
- `pnpm test:live-sources`：opt-in live-source smoke（不写库，只验证源可达 / parser shape / record count）
- `pnpm dev:mint-anchor-token`：生成非生产环境 anchor bearer token，用于当前分支的 manual review / review queue 操作
- `pnpm resources:import:cfc` / `pnpm resources:import:island-harvest`：真实导入命令

---

## 4) 分支与提交

当前仓库最小真实工作流：

- 以 `main` 为基线
- 使用短生命周期 `feature/*` 分支开发
- 通过 PR 合并回 `main`

提交规范继续使用 Conventional Commits：

```text
<type>(<scope>): <description>
```

常用 `type`：`feat`、`fix`、`docs`、`refactor`、`test`、`chore`

---

## 5) 提交前检查

- 运行 `pnpm lint`
- 运行 `pnpm typecheck`
- 运行 `pnpm test`
- 运行 `pnpm build`
- 运行 `pnpm test:smoke:real`（如果改动 API/resource 验证路径或 CI glue）
- 如改动前端主路径，运行 `pnpm test:e2e`
- 如改动 live adapters，运行 `pnpm test:live-sources`
- 如改动 DB schema，同步更新 migration / seed / 文档
- 如改动 API 或数据模型，同步更新 [`08_Data_Model.md`](/Users/kairan/Documents/Spring26/WeaveNYC/docs/08_Data_Model.md) / [`09_API_Spec.md`](/Users/kairan/Documents/Spring26/WeaveNYC/docs/09_API_Spec.md)
- 如改动 community/posts/review/speech 契约，同步更新 [`03_User_Flows_And_Screens.md`](/Users/kairan/Documents/Spring26/WeaveNYC/docs/03_User_Flows_And_Screens.md) / [`14_Backlog.md`](/Users/kairan/Documents/Spring26/WeaveNYC/docs/14_Backlog.md) / [`18_Auth_Design.md`](/Users/kairan/Documents/Spring26/WeaveNYC/docs/18_Auth_Design.md)
- 如新增环境变量，同步更新 `.env.example`

---

## 6) Code Review 标准

- 功能正确性：是否满足当前阶段的验收标准
- 安全性：输入校验、鉴权、越权检查、日志脱敏
- 隐私：是否遵循默认最小披露原则
- 测试：关键路径是否有覆盖
- 文档：是否把 README / Baseline / Plan / Backlog 的真值一起维护

---

## 7) 当前已知限制

当前显式接受的残余风险：

- CI 默认不跑 live-source smoke
- Browser smoke 仍使用 fixture-backed tests
- CFC live adapter 依赖上游 PDF 结构和本地 `pdftotext`
- [`packages/db/test/db.integration.test.ts`](/Users/kairan/Documents/Spring26/WeaveNYC/packages/db/test/db.integration.test.ts) 目前为 opt-in

除此之外，不要再把“仓库还不能 `pnpm dev`”或“当前只有 docs 没有代码”写进文档。
