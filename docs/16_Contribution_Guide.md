# WeaveNYC — Contribution Guide

> **状态说明**：本文档描述的是 **M0 完成后的目标工程工作流**。当前仓库还没有完成 monorepo 初始化，请先以 [00_Execution_Baseline](./00_Execution_Baseline.md) 为准。

---

## 1) 本地开发环境搭建

### 1.1 前置要求

| 工具 | 最低版本 | 说明 |
|------|----------|------|
| Node.js | 20 LTS | 推荐使用 [nvm](https://github.com/nvm-sh/nvm) 管理版本 |
| pnpm | 9.x | 包管理器（`npm install -g pnpm`） |
| Docker | 24.x | 用于本地 PostgreSQL / Redis |
| Git | 2.40+ | 版本控制 |
| VS Code | Latest | 推荐 IDE（见下方插件列表） |

### 1.2 当前状态与目标启动方式

**当前真实状态**：
- 当前仓库尚未完成 monorepo 初始化。
- 以下命令和目录结构是 **M0 完成后的目标状态**，不是当前仓库现状。
- 在 M0 完成前，请不要把 `pnpm dev`、`pnpm db:migrate`、`docker compose up` 视为已可执行。

**M0 完成后的目标启动方式**：

```bash
# 1) 克隆仓库
git clone https://github.com/your-org/weavenyc.git
cd weavenyc

# 2) 安装依赖
pnpm install

# 3) 启动基础设施（PostgreSQL + Redis）
docker compose up -d

# 4) 初始化数据库
pnpm db:migrate
pnpm db:seed          # 导入测试数据（官方资源 + 模拟帖子）

# 5) 启动所有服务（前端 + 后端）
pnpm dev

# 前端（PWA）：       http://localhost:3000
# Anchor Admin：      http://localhost:3001
# API：               http://localhost:4000
# API Docs (Swagger)：http://localhost:4000/docs
```

### 1.3 环境变量（目标态）

当 `.env.example` 在 M0 中落地后，复制为 `.env.local`：

```bash
cp .env.example .env.local
```

关键变量：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DATABASE_URL` | `postgres://weavenyc:weavenyc@localhost:5432/weavenyc_dev` | PostgreSQL 连接串 |
| `REDIS_URL` | `redis://localhost:6379` | Redis 连接串 |
| `JWT_SIGNING_PRIVATE_KEY` | `./infra/dev/jwt-private.pem` | RS256 私钥（本地开发可用自签发） |
| `JWT_SIGNING_PUBLIC_KEY` | `./infra/dev/jwt-public.pem` | RS256 公钥（供验签使用） |
| `NODE_ENV` | `development` | 环境标识 |
| `LOG_LEVEL` | `debug` | 日志级别（dev 用 debug，prod 用 info） |

> **安全提示**：`.env.local` 已在 `.gitignore` 中。永远不要提交包含真实密钥的 `.env` 文件。

### 1.4 M0 bootstrap artifacts（目标态）

M0 可执行的最小启动件需要同时存在以下产物：

- `.env.example`
- `infra/docker-compose.yml`
- `infra/dev/jwt-private.pem`
- `infra/dev/jwt-public.pem`
- `GET /healthz`
- `GET /readyz`

> 如果这些 bootstrap artifacts 还不存在，就不要把 `pnpm dev`、`pnpm db:migrate`、`docker compose up` 当成已可执行命令。

### 1.5 推荐 VS Code 插件

- ESLint (`dbaeumer.vscode-eslint`)
- Prettier (`esbenp.prettier-vscode`)
- Tailwind CSS IntelliSense (`bradlc.vscode-tailwindcss`)
- Mermaid Preview (`bierner.markdown-mermaid`)
- GitLens (`eamodio.gitlens`)
- Thunder Client (`rangav.vscode-thunder-client`) — 轻量 API 测试

---

## 2) Repo 结构（目标态）

```
weavenyc/
├── apps/
│   ├── pwa/                    # Next.js PWA（用户端）
│   │   ├── src/
│   │   │   ├── app/            # Next.js App Router
│   │   │   ├── components/     # React 组件
│   │   │   ├── hooks/          # 自定义 hooks
│   │   │   ├── lib/            # 工具函数
│   │   │   └── locales/        # i18n 翻译文件
│   │   └── public/             # 静态资源
│   └── anchor-admin/           # Next.js Anchor 管理后台
│
├── services/
│   ├── api-gateway/            # Fastify 入口网关
│   ├── resource-directory/     # 官方资源目录服务
│   ├── posts/                  # 帖子服务
│   ├── match/                  # 匹配引擎
│   └── chat/                   # 聊天服务
│
├── packages/
│   ├── shared/                 # 共享 DTO / 类型 / 校验器
│   ├── risk-rules/             # 风险规则引擎
│   ├── db/                     # 数据库 schema + migrations
│   └── test-utils/             # 测试工具函数
│
├── docs/                       # 本文档目录
├── diagrams/                   # 架构图（Mermaid）
├── templates/                  # 运营模板
├── infra/                      # 部署脚本 / Docker / K8s
│   ├── docker-compose.yml
│   ├── Dockerfile
│   └── k8s/
│
├── tests/
│   ├── e2e/                    # Playwright E2E 测试
│   ├── load/                   # k6 负载测试
│   └── fixtures/               # 测试数据固件
│
├── .github/
│   ├── workflows/              # CI/CD (GitHub Actions)
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   └── pull_request_template.md
│
├── package.json                # 根 package（pnpm workspace）
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .env.example
├── .gitignore
└── README.md
```

---

## 3) 分支策略

```
main ──────────────────────────── 始终可部署
  │
  └── dev ─────────────────────── 集成分支
        │
        ├── feature/E1-S1-cfc-import
        ├── feature/E2-S2-edit-post
        ├── fix/match-empty-result
        └── chore/update-deps
```

| 分支 | 用途 | 保护规则 |
|------|------|----------|
| `main` | 生产环境，始终可部署 | 禁止直推，必须通过 PR + CI 通过 + 1 人 review |
| `dev` | 集成分支，staging 自动部署 | 禁止直推，必须通过 PR + CI 通过 |
| `feature/*` | 功能开发 | 生命周期短（< 1 周），基于 `dev` 创建 |
| `fix/*` | Bug 修复 | 同 feature |
| `chore/*` | 依赖更新、配置变更 | 同 feature |
| `hotfix/*` | 紧急生产修复 | 基于 `main` 创建，修复后同时合入 `main` 和 `dev` |

---

## 4) Commit 规范

使用 [Conventional Commits](https://www.conventionalcommits.org/)：

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### 4.1 Type

| Type | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(posts): add voice input for request creation` |
| `fix` | Bug 修复 | `fix(match): handle empty offer list gracefully` |
| `docs` | 文档变更 | `docs(api): update POST /v1/posts request schema` |
| `style` | 格式调整（不影响逻辑） | `style: fix eslint warnings` |
| `refactor` | 重构（不改功能） | `refactor(risk): extract keyword rules to config` |
| `test` | 测试 | `test(match): add integration test for language matching` |
| `chore` | 构建/依赖/配置 | `chore: upgrade playwright to v1.40` |
| `perf` | 性能优化 | `perf(resources): add composite index for ZIP search` |

### 4.2 Scope（推荐）
`posts`, `match`, `resources`, `chat`, `anchor`, `auth`, `risk`, `pwa`, `admin`, `db`, `infra`, `ci`

### 4.3 Git Hooks（Husky + lint-staged）

```bash
# 已在 package.json 中配置
# pre-commit: lint-staged（ESLint + Prettier）
# commit-msg: commitlint（检查 Conventional Commits 格式）
```

---

## 5) PR 流程

### 5.1 创建 PR 前
- [ ] 本地运行 `pnpm lint` + `pnpm test:unit` 通过
- [ ] 如修改了 API 或 数据模型，同步更新 docs（[08_Data_Model](./08_Data_Model.md) / [09_API_Spec](./09_API_Spec.md)）
- [ ] 如新增了环境变量，更新 `.env.example`

### 5.2 PR 模板
```markdown
## What
<!-- 一句话说明这个 PR 做了什么 -->

## Why
<!-- 为什么要做这个改动 -->

## How
<!-- 关键实现思路（如果不显而易见） -->

## Testing
<!-- 怎么验证这个 PR 是正确的 -->
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated (if applicable)
- [ ] Manual testing: describe steps

## Checklist
- [ ] Tests pass (`pnpm test`)
- [ ] Lint pass (`pnpm lint`)
- [ ] No secrets committed
- [ ] Docs updated (if API/data model changed)
- [ ] Migrations added (if DB schema changed)
```

### 5.3 Code Review 标准
- **功能正确性**：是否满足 PRD 验收标准
- **安全性**：输入校验、鉴权、越权检查、日志脱敏
- **隐私**：是否遵循"默认本地 + 最小上传"原则
- **测试**：关键路径是否有覆盖
- **可读性**：命名清晰、注释适度、逻辑简洁

---

## 6) 编码规范

### 6.1 TypeScript
- 所有代码使用 TypeScript（strict mode）
- 所有外部输入使用 Zod schema 校验
- 使用 `type` 而非 `interface`（除非需要 declaration merging）
- 避免 `any`；确实需要时使用 `unknown` + 类型守卫

### 6.2 后端 (Fastify)
- 每个 route 使用 Zod schema 定义 request/response
- 错误一律通过统一 error handler 返回标准格式（见 [09_API_Spec §10](./09_API_Spec.md)）
- 幂等设计：POST 接口使用 idempotency key（可选）
- 日志：绝不记录敏感内容（聊天正文、手机号、邮箱明文）

### 6.3 前端 (Next.js)
- 组件使用函数式 + hooks
- 样式使用 Tailwind CSS（不用 CSS-in-JS）
- **状态管理**：Redux Toolkit（全局状态：认证、社区、语言、P2P 连接）
- **数据获取缓存**：TanStack Query / React Query（API 请求/缓存/重试/离线）
- **本地离线存储**：Dexie.js（IndexedDB 封装，草稿/收藏/帖子缓存/密钥）
- **i18n**：next-intl（与 Next.js App Router 深度集成，类型安全）
- **地图**：Leaflet + OpenStreetMap（免费，无 API Key）
- **P2P 客户端**：libp2p-js + Helia，运行在 WebWorker（避免阻塞 UI）
- **Schema 校验**：Zod（运行时校验 + TypeScript 类型推导，前后端共享）

### 6.4 数据库
- 使用 Drizzle ORM（类型安全 + 轻量）
- Migration 文件使用 `drizzle-kit` 生成
- 命名规范：表名复数蛇形（`resource_providers`），列名蛇形（`created_at`）

### 6.5 核心依赖库清单

> 完整选型理由见 [ADR-0004](./15_ADR_Log.md)。

**前端（Client Layer）**：

| 库 | 用途 | 备注 |
|----|------|------|
| `next` | UI 框架（SSR/SSG/PWA） | App Router |
| `react` + `react-dom` | 视图层 | — |
| `typescript` | 类型系统 | strict mode |
| `@reduxjs/toolkit` + `react-redux` | 全局状态管理 | 中间件 + DevTools |
| `@tanstack/react-query` | 数据获取/缓存 | stale-while-revalidate |
| `dexie` | IndexedDB 封装 | 离线存储 |
| `next-intl` | i18n | Server Component 支持 |
| `leaflet` + `react-leaflet` | 地图 | OpenStreetMap（免费） |
| `zod` | Schema 校验 | 前后端共享 |
| `tailwindcss` | 样式 | Utility-first |
| `libp2p` + `helia` | P2P 网络 + IPFS | WebWorker 运行 |
| `@noble/ed25519` | 加密签名 | 事件签名 |

**后端（Service Layer）**：

| 库 | 用途 | 备注 |
|----|------|------|
| `fastify` | API 框架 | 高性能 + 内置 schema 验证 |
| `drizzle-orm` + `drizzle-kit` | ORM + Migration | 类型安全 |
| `ioredis` | Redis 客户端 | 会话/限流/Pub-Sub |
| `bullmq` | 任务队列 | Redis-backed（异步匹配/通知） |
| `@fastify/swagger` | API 文档 | Zod → OpenAPI → Swagger UI |
| `zod` | Schema 校验 | 与前端共享 |
| `pg` | PostgreSQL 驱动 | PostGIS 支持 |

**测试 & 工具**：

| 库 | 用途 |
|----|------|
| `jest` | 单元/集成测试 |
| `supertest` | HTTP API 测试 |
| `testcontainers` | 数据库集成测试 |
| `@playwright/test` | E2E 浏览器测试 |
| `k6` | 负载测试 |
| `eslint` + `prettier` | 代码质量 |
| `husky` + `lint-staged` + `@commitlint/cli` | Git hooks |

---

## 7) Issue 模板

### 7.1 Bug Report
```markdown
**描述**: [简述 bug]
**重现步骤**:
1. ...
2. ...
**期望行为**: ...
**实际行为**: ...
**环境**: [浏览器/设备/OS]
**截图**: [如有]
```

### 7.2 Feature Request
```markdown
**用户故事**: As a [角色], I want [功能], so that [价值].
**验收标准**:
- [ ] ...
- [ ] ...
**相关文档**: [链接到 PRD/Backlog 中的 Epic/Story]
```

---

## 8) 常用命令速查

```bash
# 开发
pnpm dev                    # 启动所有服务
pnpm dev --filter pwa       # 只启动 PWA
pnpm dev --filter api-*     # 只启动后端服务

# 测试
pnpm test:unit              # 单元测试
pnpm test:integration       # 集成测试（需要 Docker）
pnpm test:e2e               # E2E 测试（需要服务运行中）
pnpm test:load              # 负载测试
pnpm test                   # 运行全部测试

# 数据库
pnpm db:migrate             # 执行数据库迁移
pnpm db:migrate:create      # 创建新的 migration 文件
pnpm db:seed                # 导入测试/种子数据
pnpm db:studio              # 打开 Drizzle Studio（可视化数据库）

# 代码质量
pnpm lint                   # ESLint 检查
pnpm lint:fix               # 自动修复
pnpm format                 # Prettier 格式化
pnpm typecheck              # TypeScript 类型检查

# 构建 & 部署
pnpm build                  # 构建所有 apps
pnpm start                  # 生产模式启动
```
