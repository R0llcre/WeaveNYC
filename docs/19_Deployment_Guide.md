# WeaveNYC — Deployment Guide

> 从代码到生产的完整部署流程。补充 [11_Ops_Runbook](./11_Ops_Runbook.md) 和 [16_Contribution_Guide](./16_Contribution_Guide.md) 中的部署相关内容。
>
> **状态说明**：本文档当前只保留 **可执行 staging truth**；production / canary / multi-cloud / full observability 都下沉为 appendix 或 future notes。请先以 [00_Execution_Baseline](./00_Execution_Baseline.md) 为准。

---

## 1) 环境矩阵

| 环境 | 用途 | 触发方式 | URL |
|------|------|----------|-----|
| **local** | 开发调试 | `pnpm dev` | `localhost:3000/4000` |
| **staging** | 集成测试 + rehearsal | `push main` 自动 apply，或手动 `workflow_dispatch` | `WEAVENYC_STAGING_*` 对应的 runtime / app URL |
| **production** | 未来 notes | 未启用 | `app.weavenyc.org` |

## 2) 当前可执行 staging truth

- 当前本地验证链仍是：`pnpm install` → `docker compose up -d` → `pnpm db:migrate` → `pnpm db:seed` → `pnpm dev`
- 当前 `main` 已承接的 staging deploy 链为：
  - `.github/workflows/deploy-staging.yml`
  - `.github/workflows/smoke-staging.yml`
  - `.github/workflows/backup-restore-rehearsal.yml`
- `push main` 默认进入 `deploy-staging` 的 `apply` 路径；`workflow_dispatch` 允许显式选择 `plan` 或 `apply`
- `smoke-staging` 的自动触发只跟随 `push main` 的 deploy；如果是手动 `workflow_dispatch` 跑 `plan/apply`，需要显式再触发一次 smoke workflow
- `smoke-staging` 现在要求完整 split-runtime URL 集合：gateway、posts、match、chat、resource-directory、notifications、pwa、anchor-admin 缺一不可
- staging split-runtime 当前使用共享 PostgreSQL/PostGIS + Redis，不做物理分库；gateway 与下游服务依赖 internal service JWT，notifications 走真实 `Twilio + Resend` 配置
- `pnpm test:smoke:real`、`pnpm test:e2e`、`pnpm test:smoke:p2p` 继续作为当前可执行验证链的一部分，优先服务于 rehearsal / closeout
- 当前阶段真值固定为：`main = M7 completed`，下一阶段入口固定为 `M8 Pilot Readiness`

## 2.5) M8 pilot — live AWS deploy (2026-04-20, Redis on Upstash)

The pilot `api-gateway` container is deployed to AWS App Runner in region `us-east-1`:

| Item | Value |
|------|-------|
| App Runner service | `weavenyc-api-gateway` (0.25 vCPU / 0.5 GB) |
| Default URL | `https://hykmfmcf58.us-east-1.awsapprunner.com` |
| Public API URL | `https://api.weavenyc.org` (Cloudflare DNS-only → App Runner custom domain) |
| Image | `590517422743.dkr.ecr.us-east-1.amazonaws.com/weavenyc-api-gateway:<sha>` (current SHA managed by `.github/workflows/deploy-api.yml`) |
| Database | RDS Postgres `weavenyc-pilot` (PostGIS, 13 migrations applied) |
| Redis | **Upstash Redis** (TLS), URL kept in AWS Secrets Manager entry `weavenyc/pilot/redis-url-jJCCYP` |

Deploy artifacts and step-by-step runbook live in [`infra/aws/README.md`](../infra/aws/README.md). Redis rotation SOP: [`11_Ops_Runbook.md §G.5`](./11_Ops_Runbook.md).

**Probe contract:**

- `GET /healthz` → `200 {"status":"ok"}` — reflects process liveness only.
- `GET /readyz` → `200 {"status":"ok", "checks":[{"name":"postgres","status":"ok"},{"name":"redis","status":"ok"}]}` once the Upstash URL has been rotated into Secrets Manager and a fresh deploy has landed.

### 2.5.1 Upstash Redis provisioning (manual, one-time)

**Needs a maintainer with an Upstash account.** The Upstash Console provisioning is manual for this pilot — no programmatic token exists in CI. If you are the maintainer running this PR to completion:

1. Log in at https://console.upstash.com (free tier is sufficient for the pilot's load profile).
2. **Create Database** → type `Regional` → region `us-east-1` → engine `Redis 7.x` → name `weavenyc-pilot-redis`.
3. From the database's **Details** / **REST** panel, copy the TLS connection string. It will look like:
   ```
   rediss://default:<password>@global-xxxxxx.upstash.io:6379
   ```
   The `rediss://` scheme (two `s`) is required — Upstash rejects plain `redis://`.
4. Proceed with §2.5.2 to wire the URL into AWS Secrets Manager and trigger a redeploy.

If this PR is being merged by someone without Upstash access, §2.5.1 is a **prerequisite step that blocks merge**. The remaining workflow / smoke changes still ship independently, but `/readyz` will not turn green until Upstash is provisioned and step 2.5.2 is executed. Coordinate with the primary on-call before merging.

### 2.5.2 Rotate `REDIS_URL` in AWS Secrets Manager + trigger a fresh deploy

```bash
# 1. Update the pre-existing Secrets Manager entry that App Runner
#    binds into REDIS_URL at runtime. The entry id is stable
#    (weavenyc/pilot/redis-url-jJCCYP) so the App Runner binding does
#    not need to be re-wired.
aws secretsmanager update-secret \
  --region us-east-1 \
  --secret-id weavenyc/pilot/redis-url-jJCCYP \
  --secret-string 'rediss://default:<password>@global-xxxxxx.upstash.io:6379'

# 2. Confirm the value is there:
aws secretsmanager describe-secret \
  --region us-east-1 \
  --secret-id weavenyc/pilot/redis-url-jJCCYP \
  --query '{Name:Name, ARN:ARN, LastChanged:LastChangedDate}'

# 3. Trigger a Deploy API Gateway workflow run. The deploy-api.yml
#    workflow now explicitly updates the App Runner ImageIdentifier
#    (A8 P0-6 invariant) and its post-deploy smoke asserts
#    uptime < 5 min, so a silent no-op would fail loudly.
gh workflow run deploy-api.yml --ref main

# 4. After the workflow reports success, confirm redis is healthy:
curl -s https://api.weavenyc.org/readyz | jq '.checks[] | select(.name=="redis")'
# expected: {"name":"redis","status":"ok"}
```

App Runner redeploys in ~5 minutes; `/readyz` flips to `200 {"status":"ok"}` once the subscriber/publisher ioredis clients complete their first handshake against Upstash.

**Smoke commands confirmed passing (target post-rotation):**

```bash
curl -sS https://api.weavenyc.org/healthz   # 200 {"status":"ok", ...}
curl -sS https://api.weavenyc.org/readyz    # 200 {"status":"ok", ...}
```

---

## Appendix A) Future Multi-Cloud Infrastructure

> 满足课程 3 云 3 PaaS 要求，详见 [ADR-0004](./15_ADR_Log.md) 和 [06_Blueprints §2.3](./06_Blueprints.md)。

### 2.1 服务分布

| 服务 | 云 | 部署方式 | 理由 |
|------|----|----------|------|
| **API Gateway** | AWS | Lambda + API Gateway | 自动伸缩、按请求计费、课程要求 |
| **Match Engine** | AWS | Lambda | 事件驱动，与 RDS 同区 |
| **Resource Directory** | GCP | Cloud Run | 容器化，独立扩缩、课程要求 |
| **Posts Service** | AWS | Lambda | 与 RDS 同区 |
| **Chat Service** | AWS | ECS Fargate | WebSocket 长连接不适合 Lambda |
| **Notification** | Azure | Functions | 课程要求 + 地理服务对接 |
| **Speech Gateway** | Azure | Functions | 课程要求 + Azure Speech 集成 |
| **PWA (前端)** | Cloudflare | Cloudflare Pages（`weavenyc-pwa` 项目） | Next.js/静态导出原生支持、Worker/KV 生态、全球 CDN |
| **Anchor Admin** | Cloudflare | Cloudflare Pages（`weavenyc-anchor-admin` 项目） | 同 PWA |

### 2.2 数据存储

| 存储 | 云 | 服务 | 用途 |
|------|----|------|------|
| PostgreSQL + PostGIS | AWS | RDS | 中心索引 |
| Redis | AWS | ElastiCache (或 Upstash) | 缓存/队列/限流 |
| 对象存储 | AWS + GCP + Azure | S3 + GCS + Blob | 备份/快照（跨云冗余） |

---

## Appendix B) Future CI/CD Pipeline

### B.1 流水线概览

```
push to feature/* ──> lint + typecheck + unit test
                         │
PR to dev ──────────> lint + typecheck + unit + integration + e2e
                         │ (merge)
                         ↓
dev branch ─────────> build → deploy to staging → smoke test
                         │
PR to main ─────────> require: CI pass + 1 review + staging smoke pass
                         │ (merge + tag)
                         ↓
main branch ────────> build → deploy to production → health check → notify
```

### B.2 主要 Workflow 文件

**`.github/workflows/ci.yml`**（PR 检查）:
```yaml
name: CI
on:
  pull_request:
    branches: [dev, main]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck

  unit-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:unit -- --coverage
      - uses: actions/upload-artifact@v4
        with: { name: coverage, path: coverage/ }

  integration-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgis/postgis:16-3.4
        env:
          POSTGRES_DB: weavenyc_test
          POSTGRES_USER: weavenyc
          POSTGRES_PASSWORD: weavenyc
        ports: ['5432:5432']
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm db:migrate
      - run: pnpm test:integration

  e2e-test:
    runs-on: ubuntu-latest
    needs: [unit-test, integration-test]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: npx playwright install --with-deps
      - run: pnpm build
      - run: pnpm test:e2e
```

**`.github/workflows/deploy-staging.yml`**（staging 部署）:
```yaml
name: Deploy Staging
on:
  push:
    branches: [dev]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build

      # AWS Lambda (API Gateway + Match + Posts)
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      - run: pnpm deploy:aws --stage staging

      # GCP Cloud Run (Resource Directory)
      - uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      - run: pnpm deploy:gcp --stage staging

      # Azure Functions (Notification + Speech)
      - uses: azure/login@v2
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
      - run: pnpm deploy:azure --stage staging

      # DB Migration
      - run: pnpm db:migrate --env staging

      # Smoke Test
      - run: pnpm test:smoke --base-url https://staging.weavenyc.org
```

### B.3 Release Gate 检查清单

部署到 production 前必须通过：

- [ ] 所有 CI 检查通过（lint + typecheck + unit + integration + e2e）
- [ ] staging 环境 smoke test 通过
- [ ] 代码覆盖率 ≥ 目标（核心模块 80%+）
- [ ] 无 P0/P1 级别的 open issue
- [ ] DB migration 有对应的 rollback migration
- [ ] 至少 1 人 code review approved
- [ ] 安全检查：无新增敏感信息提交（`git-secrets` scan）
- [ ] Lighthouse Accessibility ≥ 90

---

## Appendix C) Future DB Migration Flow

### C.1 正常迁移

```bash
# 1) 修改 Drizzle schema
# packages/db/schema/*.ts

# 2) 生成 migration
pnpm db:migrate:create --name add_verification_state

# 3) 检查生成的 SQL
# packages/db/migrations/YYYYMMDD_add_verification_state.sql

# 4) 本地测试
pnpm db:migrate           # 执行
pnpm db:migrate:rollback  # 回滚
pnpm db:migrate           # 再次执行确认幂等

# 5) 提交 PR（migration SQL 文件随代码一起 review）
```

### C.2 破坏性变更（两步走）

详见 [04_Data_Sources §5](./04_Data_Sources.md)。

```
Step 1 (Release N):   添加新列/表（兼容旧代码）
Step 2 (Release N+1): 迁移数据 → 删除旧列/表
```

### C.3 紧急回滚

```bash
# 回滚最近一次 migration
pnpm db:migrate:rollback --env production

# 如果 migration 无法回滚
# 1) 从最近的备份恢复
pg_restore -h $DB_HOST -U weavenyc -d weavenyc_prod /backup/latest.dump

# 2) 回滚应用代码
git revert HEAD && git push origin main  # 触发重新部署
```

---

## Appendix D) Future Docker Config

### D.1 docker-compose.yml（本地开发）

```yaml
# infra/docker-compose.yml
version: '3.9'
services:
  postgres:
    image: postgis/postgis:16-3.4
    ports: ['5432:5432']
    environment:
      POSTGRES_DB: weavenyc_dev
      POSTGRES_USER: weavenyc
      POSTGRES_PASSWORD: weavenyc
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports: ['6379:6379']
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  redisdata:
```

### D.2 Dockerfile（服务构建）

```dockerfile
# infra/Dockerfile
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/*/package.json ./packages/
COPY services/*/package.json ./services/
RUN pnpm install --frozen-lockfile --prod

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM base AS runner
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "dist/server.js"]
```

---

## Appendix E) Future Environment Variable Management

### E.1 Secret 管理

| 环境 | 方式 | 工具 |
|------|------|------|
| local | `.env.local` 文件 | 手动复制 `.env.example` |
| staging | GitHub Environment Secrets | GitHub Actions 注入 |
| production | 云平台 Secret Manager | AWS Secrets Manager / GCP Secret Manager |

### E.2 必要环境变量

| 变量 | staging | production | 说明 |
|------|---------|------------|------|
| `DATABASE_URL` | RDS staging | RDS production | PostgreSQL + PostGIS |
| `REDIS_URL` | ElastiCache staging | ElastiCache production | Redis |
| `JWT_SIGNING_PRIVATE_KEY` | RS256 私钥 | RS256 私钥（不同于 staging） | JWT 签名 |
| `JWT_SIGNING_PUBLIC_KEY` | RS256 公钥 | RS256 公钥（不同于 staging） | JWT 验签 |
| `OTP_SMS_PROVIDER_KEY` | Twilio test | Twilio production | SMS 发送 |
| `PUSH_NOTIFICATION_KEY` | FCM test | FCM production | Web Push |
| `SENTRY_DSN` | staging project | production project | 错误监控 |
| `S3_BUCKET` | weavenyc-staging | weavenyc-prod | 备份/快照 |

---

## Appendix F) Future Monitoring & Alerting

部署后的健康检查和监控，详见 [11_Ops_Runbook](./11_Ops_Runbook.md)。

### F.1 部署后自动检查

```bash
# 部署完成后自动运行
curl -sf https://app.weavenyc.org/health || exit 1
curl -sf https://app.weavenyc.org/v1/resources?zip=11735 || exit 1
```

### F.2 金丝雀发布（Phase 2）

MVP 阶段使用蓝绿部署（全量切换）；Phase 2 引入金丝雀发布：
- 10% 流量 → 新版本
- 监控 5 分钟无异常 → 50% → 100%
- 任何 P0 告警 → 自动回滚

---

## Appendix G) Future Rollback Strategy

| 组件 | 回滚方式 | 时间目标 |
|------|----------|----------|
| 前端（Cloudflare Pages） | `wrangler pages deployment rollback --project-name weavenyc-pwa --deployment-id <id>`（Admin 项目同理换 `weavenyc-anchor-admin`），或 Cloudflare 控制台"Rollback to this deployment" | < 1 分钟 |
| API Gateway（AWS App Runner） | `scripts/ops/reset-to-last-good-image.sh <ecr-tag>` / `aws apprunner update-service` 指回上一个 ECR tag | < 2 分钟 |
| Resource Directory（GCP Cloud Run） | `gcloud run services update-traffic weavenyc-resource-directory --region us-east1 --to-revisions <prev>=100` | < 2 分钟 |
| Notifications（Azure Container Apps） | `az containerapp revision set-mode --mode single --revision <prev>` | < 2 分钟 |
| 数据库 | Migration rollback / 备份恢复，详见 [`29_M8_Pilot_Readiness §3.7`](./29_M8_Pilot_Readiness.md) | 5-30 分钟 |
