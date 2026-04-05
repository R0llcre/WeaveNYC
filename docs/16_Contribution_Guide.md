# WeaveNYC — Contribution Guide

> 状态：当前仓库真实可执行的 M0 工作流。本文档不再描述 target-state 假命令。

---

## 1) 本地开发环境

### 1.1 前置要求

| 工具 | 版本建议 | 说明 |
|------|----------|------|
| Node.js | 20 LTS | 推荐用 `nvm` 管理 |
| pnpm | 10.33.x | workspace 包管理器 |
| Docker | 24.x+ | 本地 PostgreSQL / Redis |
| Git | 2.40+ | 版本控制 |

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

### 1.3 当前已验证的运行面

- `GET /healthz`
- `GET /readyz`
- `POST /v1/auth/anonymous`
- `GET /v1/me`
- PWA 首页：API health + anonymous session button
- Anchor Admin 首页：API health + login placeholder

### 1.4 环境变量

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
| `ANCHOR_ADMIN_PORT` | `3001` | Anchor Admin 端口 |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:4000` | 前端请求 API 的基地址 |
| `DATABASE_URL` | `postgres://weavenyc:weavenyc@localhost:5432/weavenyc_dev` | PostgreSQL 连接串 |
| `REDIS_URL` | `redis://localhost:6379` | Redis 连接串 |
| `JWT_SIGNING_PRIVATE_KEY` | `./infra/dev/jwt-private.pem` | RS256 私钥 |
| `JWT_SIGNING_PUBLIC_KEY` | `./infra/dev/jwt-public.pem` | RS256 公钥 |

安全提示：

- `.env.local` 已被忽略，不要提交真实密钥。
- `infra/dev/*` 仅用于本地开发 bootstrap，不得用于生产。

### 1.5 Bootstrap artifacts

当前仓库必须同时存在以下产物，M0 才成立：

- `.env.example`
- `docker-compose.yml`
- `infra/docker-compose.yml`
- `infra/dev/jwt-private.pem`
- `infra/dev/jwt-public.pem`
- `GET /healthz`
- `GET /readyz`

---

## 2) 当前 Repo 结构

```text
weavenyc/
├── apps/
│   ├── pwa/
│   └── anchor-admin/
├── services/
│   ├── api-gateway/
│   ├── resource-directory/   # placeholder
│   ├── posts/                # placeholder
│   ├── match/                # placeholder
│   └── chat/                 # placeholder
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

- `services/api-gateway` 是当前唯一运行中的后端服务。
- 其余 4 个 service 目录在 M0 只保留 package skeleton + README。
- `packages/db` 持有 schema、migration、seed、测试。

---

## 3) 日常开发命令

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:migrate
pnpm db:seed
```

命令真值：

- `pnpm dev`：并行启动 PWA、Anchor Admin、API Gateway
- `pnpm lint`：仓库级 ESLint
- `pnpm typecheck`：workspace 级 TypeScript 校验
- `pnpm test`：Vitest
- `pnpm build`：先 build shared / db / test-utils，再 build API 和两个前端

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
- 如改动 DB schema，同步更新 migration / seed / 文档
- 如改动 API 或数据模型，同步更新 [`08_Data_Model.md`](/Users/kairan/Documents/Spring26/WeaveNYC/docs/08_Data_Model.md) / [`09_API_Spec.md`](/Users/kairan/Documents/Spring26/WeaveNYC/docs/09_API_Spec.md)
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

当前唯一显式接受的残余风险：

- CI 默认不跑 Docker-backed DB integration
- [`packages/db/test/db.integration.test.ts`](/Users/kairan/Documents/Spring26/WeaveNYC/packages/db/test/db.integration.test.ts) 目前为 opt-in

除此之外，不要再把“仓库还不能 `pnpm dev`”或“当前只有 docs 没有代码”写进文档。
