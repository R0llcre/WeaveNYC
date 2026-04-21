# WeaveNYC — Ops Runbook (SRE-lite)

目标：即使只有 2-3 人，也要把"可观测性 + 故障处理 + 数据恢复"最小化做起来。

> `main` 当前已是 `M7 completed`。当前文档只描述已经进入主线的 staging rehearsal truth；下一阶段 `M8` 固定为 Pilot Readiness，不新增用户端产品 surface。

---

## 1) 服务清单（当前 M7 运行面 / rehearsal）

**`main` 的稳定用户面仍经由 API Gateway 暴露；M7 已经把这些后端 runtimes 收口成当前 staging rehearsal truth**：

| 服务 | 职责 | 关键依赖 |
|------|------|----------|
| API Gateway | 路由、鉴权、限流、resource/posts/review/speech HTTP 接口 | PostgreSQL, Redis |
| Posts Service | community access / join、posts、review queue、announcements、rules、dashboard | PostgreSQL, Redis |
| Match Service | matches、contact requests、recipient inbox | PostgreSQL |
| Chat Service | conversations、messages、reports、block、realtime chat | PostgreSQL, Redis |
| Resource Directory Service | resources read API + import host | PostgreSQL/PostGIS |
| Notifications Service | Twilio / Resend delivery adapter | Twilio, Resend |

**当前 staging truth**：

| 包 | 当前形态 | 说明 |
|----|----------|------|
| `services/resource-directory` | library + standalone runtime | `main` 仍由 API Gateway 暴露查询面；M7 rehearsal 同时验证独立 runtime 健康探针 |
| `services/posts` | domain library + standalone runtime | staging split path 下由 Gateway 通过 internal service JWT 代理 |
| `services/match` | domain library + standalone runtime | staging split path 下由 Gateway 代理 |
| `services/chat` | domain library + standalone runtime | staging split path 下由 Gateway 代理 |
| `services/notifications` | standalone runtime | 只负责短信/邮件外发；不对用户直接暴露 |

**前端应用（Next.js + TypeScript，不计入微服务数量）**：

| 应用 | 职责 | 部署 |
|------|------|------|
| PWA（用户端） | 互助发布/搜索/匹配/聊天 | Cloudflare Pages（`weavenyc-pwa` 项目） |
| Anchor Admin Console | 管理后台（审核/公告/规则） | Cloudflare Pages（`weavenyc-anchor-admin` 项目） |

## 2) 当前可执行 staging truth

- 当前唯一稳定可执行的日常链路仍是：`pnpm install` → `docker compose up -d` → `pnpm db:migrate` → `pnpm db:seed` → `pnpm dev` → `pnpm test:smoke:real` → `pnpm test:e2e` → `pnpm test:smoke:p2p`
- `staging` 当前已经收口为可执行 rehearsal 路径：`push main` 默认触发 `deploy-staging` 的 `apply` 路径，或手动 `workflow_dispatch` 选择 `plan/apply`
- M7 rehearsal 要求整套 split runtime URL 与 smoke URL 都显式配置；`smoke-staging` 不再接受“只有 gateway/pwa/admin 有地址、其余服务缺省”的半接线形态
- staging split-runtime 现在按 fail-fast 运行：gateway 和 notifications 缺少内部 JWT、下游 URL 或真实 provider 配置时，不允许 silently fallback 到 in-process / stub 路径
- `production`、`canary`、完整 observability、跨云发布与自动回滚统一放到后面的 future notes

---

## Appendix A.0) Future SLO / SLA

| 指标 | SLO 目标 | 测量方式 | 违约处理 |
|------|----------|----------|----------|
| Home 资源搜索 | p95 < 800ms | 服务端埋点 | 触发告警，排查 DB 慢查询 |
| 发帖接口 | p95 < 1s | 服务端埋点 | 触发告警，检查写入瓶颈 |
| 匹配生成 | p95 < 2s | 服务端埋点 | 降级为只返回官方资源 |
| API 可用性 | >= 99.5%（月度） | Uptime 监控 | 触发 P0 on-call |
| 首屏加载 | p95 < 3s (4G) | RUM / Lighthouse | 检查 CDN / bundle size |

**Error Budget 策略（MVP 简化版）**：
- 月度 Error Budget = 0.5% × 30天 × 24h = 3.6h 允许停机
- 若 Error Budget 消耗过半，暂停非关键功能发布，只做 bug fix

---

## Appendix A.1) Future Monitoring Dashboard

### A.1.1 Dashboard Overview

#### A.1.1.1 Golden Signals
- **Latency**：p50, p95, p99（当前以 API Gateway 为主，后续按服务拆分）
- **Traffic**：req/s, active users/hour
- **Errors**：5xx rate, 4xx rate（按 endpoint 拆分）
- **Saturation**：CPU %, memory %, DB connection pool usage, disk I/O

#### A.1.1.2 Domain Metrics
- Posts created/day（按类别、风险等级分组）
- Matches suggested/day
- Verified matches/week（北极星指标）
- Reports/day & 平均处置时长
- Anchor 审核队列积压量
- 新用户 7 天留存率

#### A.1.1.3 推荐工具栈

| 用途 | 推荐工具 | 备选 | 说明 |
|------|----------|------|------|
| 指标采集 | Prometheus + Grafana | Datadog | 开源免费，社区大 |
| 日志聚合 | Loki + Grafana | ELK (Elastic) | 轻量，与 Prometheus 生态统一 |
| 应用追踪 | OpenTelemetry + Jaeger | Zipkin | CNCF 标准，vendor-neutral |
| Uptime 监控 | UptimeRobot (免费版) | Better Uptime | 免费额度足够 MVP |
| 错误追踪 | Sentry (免费版) | — | 前后端错误自动归类 |

#### A.1.1.4 Grafana Dashboard 布局（建议）

**Dashboard 1: Overview**
- Row 1: 4 个 stat panel（QPS / 5xx rate / p95 latency / active users）
- Row 2: 时间序列图（latency by service / error rate by service）
- Row 3: 时间序列图（posts created / matches generated）

**Dashboard 2: Safety & Governance**
- Row 1: 举报数 / 审核队列积压 / 平均处置时长
- Row 2: 敏感词拦截次数 / 封禁操作数 / 高风险帖子占比

---

## Appendix A.2) Future Logging & Tracing

### 4.1 日志格式（JSON Structured Logging）
```json
{
  "timestamp": "2026-02-22T10:30:00Z",
  "level": "info",
  "service": "api-gateway",
  "request_id": "req_abc123",
  "user_id_hash": "sha256:7f3a...",
  "endpoint": "POST /v1/posts",
  "status": 201,
  "latency_ms": 142,
  "community_id": "comm_xyz",
  "metadata": {
    "post_type": "request",
    "category": "food",
    "risk_level": "low"
  }
}
```

### 4.2 日志安全规则
**必含字段**：request_id, user_id_hash, endpoint, status, latency_ms
**严禁记录**：
- 聊天正文 / 帖子全文 body
- 手机号 / 邮箱明文
- 精确 GPS 坐标
- 用户 IP 地址（只记录子网或完全不记录）

### 4.3 日志查看实操
```bash
# 查看最近 1 小时的 5xx 错误
loki-cli query '{service="api-gateway"} |= "500"' --since=1h

# 按 request_id 追踪完整链路
loki-cli query '{} |= "req_abc123"' --since=24h

# 查看某用户的操作轨迹（用 hash 查）
loki-cli query '{} |= "sha256:7f3a"' --since=7d
```

### 4.4 Distributed Tracing（Target State）
- 当前 M2 只有 API Gateway 一个运行中的后端服务；若接入 tracing，先在 API Gateway 上统一打点
- 后续在真正拆出独立服务后，再使用 OpenTelemetry SDK 在各服务入口注入 trace context
- 关键链路追踪：`用户发帖 → 风险检测 → 审核 → 匹配 → 通知`
- 采样率：MVP 阶段可 100%，流量大时降至 10%

---

## Appendix A.3) Alerting

### A.3.0 Current alerting rules

Live Prometheus rule files shipped with the repo (load any file matching
`infra/prometheus/rules/*.yaml` via `rule_files` in `prometheus.yml`):

| File | Surface | Coverage |
|---|---|---|
| `infra/prometheus/rules/api-gateway.yaml` | API Gateway, DB, moderation, auth | 5xx rate, p95 latency, DB error rate, review-queue backlog, auth-challenge floor |
| `infra/prometheus/rules/p2p.yaml` | P2P overlay | Sync error rate, Redis fanout, stall detection, bootstrap denial rate, sync lag p95 |

Example `rule_files` glob for Prometheus config:

```yaml
rule_files:
  - /etc/prometheus/rules/*.yaml   # mounts infra/prometheus/rules/
```

Severity labels are `page` (paging-grade, maps to PagerDuty P0/P1) and
`warning` (notify-only, maps to Slack `#ops-alerts`). See
`scripts/staging/post-deploy-smoke.ts` for the manual equivalents used
until the Prometheus server is wired (see §Appendix H.2).

### 5.1 告警分级

| 级别 | 条件 | 响应时间 | 通知渠道 |
|------|------|----------|----------|
| **P0 Critical** | API 完全不可用 / 数据泄露嫌疑 | 15 分钟 | 电话 + Slack #ops-critical |
| **P1 High** | 5xx rate > 5% for 5m / 核心功能降级 | 30 分钟 | Slack #ops-alerts + 短信 |
| **P2 Medium** | p95 latency > 2s for 10m / 非核心服务异常 | 2 小时 | Slack #ops-alerts |
| **P3 Low** | 审核队列积压 > 50 for 24h / 非紧急指标偏离 | 下一工作日 | Slack #ops-info |

### 5.2 具体告警规则（Prometheus Alerting Rules）
```yaml
groups:
  - name: weavenyc-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.02
        for: 5m
        labels:
          severity: P1
        annotations:
          summary: "API 5xx rate > 2% for 5 minutes"

      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 10m
        labels:
          severity: P2
        annotations:
          summary: "p95 latency > 2s for 10 minutes"

      - alert: DBErrorRate
        expr: rate(pg_errors_total[5m]) > 0.005
        for: 5m
        labels:
          severity: P1
        annotations:
          summary: "Database error rate > 0.5%"

      - alert: ReviewQueueBacklog
        expr: anchor_review_queue_size > 50
        for: 24h
        labels:
          severity: P3
        annotations:
          summary: "Anchor review queue backlog > 50 for 24h"

      # Target-state alert: enable only after match-service becomes a real deployment
      # - alert: MatchServiceDown
      #   expr: up{service="match-service"} == 0
      #   for: 2m
      #   labels:
      #     severity: P1
      #   annotations:
      #     summary: "Match service is down"
```

### 5.3 告警通知渠道配置
- **Slack**：创建 #ops-critical / #ops-alerts / #ops-info 三个频道
- **电话（P0）**：使用 PagerDuty 免费版或 Slack 的 Workflow 触发电话呼叫
- **邮件**：作为兜底渠道，所有 P0/P1 告警同时发邮件

---

## On-Call

> **Pilot go-live action required.** The placeholders `<primary>`,
> `<secondary>`, `<escalation>` below MUST be replaced with real names,
> phone numbers, and Slack handles before pilot go-live. Do not ship the
> pilot with placeholder values in this section.

### 6.0 Current rotation (pilot)

| Role | Responsibility | Current holder |
|---|---|---|
| Primary on-call | First responder; acknowledges within 15 min | `<primary>` (name + phone + Slack) |
| Secondary on-call | Backup; covers when primary is unreachable or overloaded | `<secondary>` (name + phone + Slack) |
| Escalation / project lead | Final call on go/no-go, incident comms, postmortem owner | `<escalation>` (name + phone + Slack) |

**Rotation schedule template** (fill in dates before go-live):

| Week | Start (Mon 00:00 ET) | End (Sun 23:59 ET) | Primary | Secondary |
|---|---|---|---|---|
| W1 | YYYY-MM-DD | YYYY-MM-DD | `<primary>` | `<secondary>` |
| W2 | YYYY-MM-DD | YYYY-MM-DD | `<secondary>` | `<primary>` |
| W3 | YYYY-MM-DD | YYYY-MM-DD | `<primary>` | `<secondary>` |

**PagerDuty schedule:** `<pagerduty-schedule-url>` — WeaveNYC workspace,
schedule name `weavenyc-pilot-primary`. Rotations in the table above
mirror the PagerDuty schedule; the schedule is the source of truth and
the table is documentation. To page the current on-call without looking
at PagerDuty, send `/pd trigger weavenyc-pilot-primary "<summary>"` in
Slack `#ops-critical`.

### 6.1 轮换策略
- **周轮换**：每人每周轮值一次（2 人团队则每人隔周一次）
- On-call 人员需保证手机畅通 + Slack 在线
- 非 on-call 人员：P0 时作为 backup 可被呼叫

### 6.2 On-Call 职责
1. 收到告警后 15 分钟内确认（acknowledge）
2. 判断影响范围和优先级
3. 按 Playbook 执行初始响应
4. 如 30 分钟内无法解决，呼叫 backup
5. 故障解决后 24 小时内填写 incident report

### 6.3 Incident Report 模板
```markdown
## Incident Report - [日期] [标题]
- **级别**: P0/P1/P2
- **发现时间**:
- **恢复时间**:
- **影响范围**: （受影响用户数/功能）
- **根因分析**:
- **时间线**:
  - HH:MM 发现问题
  - HH:MM 开始排查
  - HH:MM 执行修复
  - HH:MM 恢复正常
- **后续 Action Items**:
  - [ ] ...
```

---

## Incident Playbooks

> **First-touch diagnostics.** When an alert fires, run
> `pnpm exec tsx scripts/staging/incident-snapshot.ts` first. It
> captures a point-in-time snapshot of `/healthz`, `/readyz`, `/metrics`,
> and recent error counts so you can attach it to the incident channel
> before you start mutating state. Each playbook below assumes the
> snapshot has already been taken.

### 7.1 官方资源查询挂了
**Symptoms**:
- Home list 无数据，或 5xx
- `/v1/resources` 接口超时或返回 500

**排查步骤**:
1. 检查 PostgreSQL 连接状态：`SELECT 1;` 是否正常
2. 检查 resource_providers 表是否有数据：`SELECT COUNT(*) FROM resource_providers;`
3. 检查最近的导入 job 日志：是否有导入失败导致数据被清空

**修复 Actions**:
1. 切换到 last-known-good `dataset_version`（只读缓存）
   ```sql
   -- 回滚到上一个版本
   UPDATE resource_providers SET status = 'active'
   WHERE dataset_version = 'cfc_active_2026-02-15';
   ```
2. 暂停导入 job（避免坏数据覆盖）
3. 对外提示：`Resource directory temporarily in read-only cache mode`
4. 根因修复后重新执行导入

### 7.2 诈骗/骚扰突然暴增
**Symptoms**:
- 举报数在短时间内激增（> 正常值 3 倍）
- 多个用户报告同一类型骚扰

**排查步骤**:
1. 查看举报来源分布：是集中在某个社区还是全平台
2. 检查最近注册的新账号模式：是否有批量注册
3. 查看被举报帖子/消息的关键词共性

**修复 Actions**:
1. 临时提高敏感词规则等级（更多类别进入审核）
2. 对新用户开启更严格限流（发帖、发消息频率减半）
3. 如涉及 bot 攻击：临时开启验证码
4. 通知相关社区 Anchor 紧急处理 P0 队列
5. 事后分析：更新风险规则集

### 7.3 匹配服务不可用
**Symptoms**:
- 用户发帖后看不到行动方案
- `/v1/posts/{post_id}/matches` 超时或 500

**修复 Actions**:
1. 降级策略：直接返回最近的 3 个官方资源（按 ZIP 距离排序）
2. 前端显示提示：`智能匹配暂时不可用，为您推荐附近的官方资源`
3. 排查 Match Service 日志，检查 DB 查询性能

### 7.4 数据库连接池耗尽
**Symptoms**:
- 多个服务同时报错 `too many connections`
- 响应时间全面飙升

**修复 Actions**:
1. 检查是否有慢查询锁表：`SELECT * FROM pg_stat_activity WHERE state = 'active' ORDER BY duration DESC;`
2. Kill 长时间运行的查询：`SELECT pg_terminate_backend(pid);`
3. 临时增加连接池上限
4. 根因分析：添加缺失索引或优化查询

### 7.5 Anchor 管理后台不可用
**Symptoms**:
- Anchor 无法登录或页面空白
- 审核操作失败

**修复 Actions**:
1. 检查 Anchor Admin UI 部署状态
2. 在非生产环境先生成临时 anchor token：
   ```bash
   pnpm dev:mint-anchor-token
   ```
3. 通过 API 直接处理紧急审核：
   ```bash
   curl -X POST https://api.weavenyc.local/v1/admin/review_queue/{post_id}/decision \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"decision": "approve", "notes": "emergency bypass"}'
   ```
4. 通知 Anchor 使用备用渠道（Slack/电话）报告紧急情况

### 7.6 M7 rehearsal path

当 `main` 需要复现 M7 closeout / staging rehearsal 时，按下面的顺序跑一遍：

1. `pnpm install`
2. `docker compose up -d`
3. `pnpm db:migrate`
4. `pnpm db:seed`
5. `pnpm dev`
6. 先完成 verified 登录，再做 Anchor activate + TOTP step-up
7. 依次检查 `Review Queue`、`Announcements`、`Rules`、`Dashboard`
8. 回到 PWA `/community` 确认 announcement banner / list 可见
9. `pnpm db:migrate && pnpm db:seed`，把 smoke 依赖的 deterministic fixtures 刷回基线
10. 运行 `pnpm test:smoke:real` 和 `pnpm test:e2e` 作为 rehearsal evidence
11. `pnpm dev:mint-anchor-token` 仅作为非生产环境 fallback，不属于正式 rehearsal 主路径

---

## Backup & Restore

**Pilot RPO/RTO targets (explicit, committed):**
- **RPO = 24h** — worst-case data loss bounded by the daily PostgreSQL
  `pg_dump` cadence. Resource-directory imports have RPO = 0 (each
  import is versioned in S3).
- **RTO = 4h** — worst-case time to restore a healthy API from a cold
  backup. Measured from "declare incident" to "smoke tests green."

**Rehearsal evidence.** Restore is exercised automatically on a
schedule via
[`.github/workflows/backup-restore-rehearsal.yml`](../.github/workflows/backup-restore-rehearsal.yml).
Every run records timestamps and RTO; a red run is itself an incident
(see §Incident Playbooks). The rehearsal is the authoritative proof
that the restore path works — if it hasn't passed in 30 days, treat
the backup as unvalidated and block pilot go-live until it does.

### 8.1 备份范围

| 数据 | 备份频率 | 保留期 | 存储位置 |
|------|----------|--------|----------|
| PostgreSQL 全库 | 每日自动（pg_dump） | 30 天 | S3 + 异地副本 |
| 官方资源目录快照 | 每次导入时 | 永久（版本化） | S3 |
| Posts/Reports metadata | 随 PostgreSQL 全库备份 | 30 天 | S3 |
| 用户聊天消息 | 随 PostgreSQL 全库备份 | 30 天 | S3（加密） |
| Grafana dashboard JSON | Git 版本控制 | 永久 | Git repo |

### 8.2 RPO / RTO

| 级别 | RPO（最大数据丢失） | RTO（最大恢复时间） |
|------|---------------------|---------------------|
| PostgreSQL | 24h（每日备份） | 4h |
| 官方资源目录 | 0（每次导入即备份） | 1h（切换 dataset_version） |

### 8.3 恢复演练（每月 1 次）
1. 从 S3 下载最近备份
2. 恢复到 staging 环境
3. 验证数据完整性：资源数、帖子数、用户数
4. 记录恢复耗时，确认 RTO 达标

### 8.4 恢复操作命令
```bash
# 下载最近备份
aws s3 cp s3://weavenyc-backups/daily/latest.sql.gz ./

# 恢复到 staging
gunzip latest.sql.gz
psql -h staging-db -U weavenyc -d weavenyc_staging < latest.sql

# 验证
psql -h staging-db -U weavenyc -d weavenyc_staging -c "
  SELECT 'resource_providers' as tbl, COUNT(*) FROM resource_providers
  UNION ALL
  SELECT 'posts', COUNT(*) FROM posts
  UNION ALL
  SELECT 'users', COUNT(*) FROM users;
"
```

---

## Appendix E) Future Deployment Pipeline

### 9.1 环境
| 环境 | 用途 | 部署方式 |
|------|------|----------|
| local | 本地开发 | `pnpm dev` |
| staging | 集成测试、Smoke test | PR merge → 自动部署 |
| production | 线上 | staging 验证后手动触发 |

### 9.2 发布步骤
1. PR 通过 CI（lint + unit test + integration test）
2. Merge 到 `dev` → 自动部署 staging
3. Staging smoke test（手动或自动化脚本）
4. Tag release → 部署 production（canary 5% 流量）
5. 监控 30 分钟：5xx rate / latency / error logs
6. 无异常 → 扩大到 100%
7. 异常 → 立即 rollback（`git revert` + 重新部署）

### 9.3 Rollback 命令（per-surface，不再使用假想的 `npm run deploy`）

真实回滚路径按部署表面分开执行。每条命令都已在 [`docs/29_M8_Pilot_Readiness.md §3`](./29_M8_Pilot_Readiness.md) 的 rollback SOP 中验证过；本节是 §3 的速查卡片版本。

**Cloudflare Pages — PWA (`weavenyc.org`)**
```bash
# 列出部署
wrangler pages deployment list --project-name weavenyc-pwa
# 回滚到指定 deployment-id
wrangler pages deployment rollback <deployment-id> --project-name weavenyc-pwa
```
或 Cloudflare 控制台 → Workers & Pages → `weavenyc-pwa` → Deployments → "Rollback to this deployment"。

**Cloudflare Pages — Anchor Admin (`admin.weavenyc.org`)**
```bash
wrangler pages deployment list --project-name weavenyc-anchor-admin
wrangler pages deployment rollback <deployment-id> --project-name weavenyc-anchor-admin
```

**AWS App Runner — API Gateway (`api.weavenyc.org`)**
```bash
# 推荐：仓库内脚本封装（会校验 ECR tag 存在、live SourceConfiguration 切换、轮询到 RUNNING）
scripts/ops/reset-to-last-good-image.sh <ecr-tag>

# 或手工（参考 29_M8_Pilot_Readiness §3.4）
aws apprunner update-service \
  --service-arn "$APPRUNNER_SERVICE_ARN" \
  --source-configuration "ImageRepository={ImageIdentifier=<previous-tag>,ImageRepositoryType=ECR}"
```

**GCP Cloud Run — Resource Directory (`resources.weavenyc.org`)**
```bash
gcloud run services update-traffic weavenyc-resource-directory \
  --region us-east1 \
  --to-revisions "<previous-revision>=100"
```

**Azure Container Apps — Notifications (`notify.weavenyc.org`)**

（实际部署名：Container App `notifications`，Resource Group `weavenyc-pilot` —
见 `infra/azure/README.md`。）
```bash
az containerapp revision set-mode \
  --name notifications \
  --resource-group weavenyc-pilot \
  --mode single --revision <previous-revision>
# 或若需要明确切流量：
az containerapp ingress traffic set \
  --name notifications \
  --resource-group weavenyc-pilot \
  --revision-weight <previous-revision>=100
```

**数据库**：如果坏版本带了 migration，见 [`29_M8_Pilot_Readiness §3.7`](./29_M8_Pilot_Readiness.md) — 优先找配对的 `*.rollback.sql` down 文件，没有就走 pg_dump 恢复。**不要**跑 `git revert`；迁移是单向的，回滚代码不会撤回 schema 变更。

### 9.4 Feature Flags（推荐）
对高风险功能使用 feature flag 控制灰度：
- `P2P_MDNS_DEMO_ENABLED`: 控制 bootstrap metadata 是否暴露 `mdns_demo_enabled=true`
- `NEXT_PUBLIC_P2P_MDNS_DEMO_ENABLED`: 控制 PWA 是否显示 dev/demo-only 的 mDNS toggle
- `ENABLE_VOICE_INPUT`: 语音输入功能开关
- `MATCH_ALGORITHM_VERSION`: 匹配算法版本（可灰度切换）

说明：
- 当前 canonical M6 没有单独的 server-side `ENABLE_P2P_SYNC` 开关；同步 overlay 作为主线实现面始终存在
- `mDNS` 默认关闭；默认 discovery 路径始终是 bootstrap
- 只有在显式打开上述 server/client demo flags 时，PWA 才显示实验性 mDNS toggle

---

## Appendix F) Future Security Ops

- [ ] 检查 Sentry 未解决的错误数量
- [ ] 检查审核队列是否有超时未处理的举报
- [ ] 检查 Error Budget 消耗情况
- [ ] 确认备份正常执行（S3 最新备份时间）
- [ ] 检查依赖库安全漏洞（`npm audit`）
- [ ] 确认日志中无敏感信息泄露

---

## Appendix G) Deploy invariant — api-gateway on AWS App Runner

### G.1 The invariant

**Every api-gateway deploy workflow run must explicitly update the App Runner service's `ImageIdentifier` to the SHA-tagged image it just pushed.** Not just `aws apprunner start-deployment` — that command redeploys whatever tag the service is currently pinned to, so a stale pin turns every deploy into a silent no-op.

`.github/workflows/deploy-api.yml` enforces this: the "Update App Runner ImageIdentifier to new SHA tag" step pulls the service's current `SourceConfiguration`, splices in the new `ImageIdentifier`, and calls `update-service` (which triggers a redeploy automatically when the identifier changes).

### G.2 Incident: 2026-04-20 — 4-day silent no-op deploy

**Symptom:** PR #39 (P2P server security hardening — two P0 findings) merged at 23:43 UTC and its Deploy API Gateway workflow reported success. But `GET /metrics` still returned `500 Cannot read properties of undefined (reading 'register')` — an error that only the pre-#39 code could produce. Three subsequent workflow runs (PRs #40, #41, #42) also "succeeded" without rolling new code.

**Root cause:** `aws apprunner describe-service` revealed `ImageIdentifier` pinned to `...:v0.1.5`, a tag not pushed by the workflow for 4 days. Every deploy workflow pushed to `:latest` and `:<sha>` then called `start-deployment`, which just re-pulled `:v0.1.5`. The `/healthz` probe in the workflow kept passing because the stale container was perfectly healthy — just stale.

**Fix applied:**
1. Live service config updated via `aws apprunner update-service` to pin `:latest` and enable `AutoDeploymentsEnabled: true`.
2. `.github/workflows/deploy-api.yml` rewritten to explicitly update `ImageIdentifier` with the new SHA tag on every run (see G.1).
3. New `scripts/staging/post-deploy-smoke.ts` asserts `uptime_seconds < 300` and presence of `p2p_*` counters in `/metrics` — fails the workflow if the deploy was a no-op.

**Recognise this symptom again:**
- `/healthz` 200, `/readyz` 200, but behaviour matches code from days ago
- `curl /metrics.json | jq .uptime_seconds` returns a value hours larger than the last deploy workflow run time
- AWS App Runner console shows an `ImageIdentifier` SHA that doesn't match the latest merged PR's commit

### G.3 Playbook: verify a new api-gateway deploy landed

```bash
# 1. readyz — stricter than healthz. Must show all checks as "ok",
#    including redis (A8 P0-7). If redis is "degraded" the REDIS_URL
#    still points at localhost; see §G.5.
curl -s https://api.weavenyc.org/readyz | jq .checks

# 2. uptime — should be within 5 minutes of the workflow's "Wait for
#    App Runner deployment" step completion.
curl -s https://api.weavenyc.org/metrics.json | jq .uptime_seconds

# 3. /metrics text must include the P2P counters from PR #39.
curl -s https://api.weavenyc.org/metrics | grep -E '^# HELP (p2p_sync_events_total|p2p_sync_errors_total|p2p_active_connections)'

# 4. AWS console: App Runner > weavenyc-api-gateway > Configuration >
#    ImageIdentifier should end with the 12-char SHA prefix of the most
#    recently merged PR touching services/api-gateway/**.

# 5. Or run the smoke script end-to-end (defaults to uptime mode +
#    api-gateway target):
MODE=uptime TARGET_URL=https://api.weavenyc.org \
  pnpm exec tsx scripts/staging/post-deploy-smoke.ts
```

### G.4 Force a redeploy / roll back to a known-good image

**Soft redeploy** (re-pulls whatever tag the service is currently pinned to):

```bash
SERVICE_ARN=$(aws apprunner list-services \
  --region us-east-1 \
  --query "ServiceSummaryList[?ServiceName=='weavenyc-api-gateway'].ServiceArn" \
  --output text)

aws apprunner start-deployment --service-arn "$SERVICE_ARN" --region us-east-1
```

Only use this after confirming the workflow-produced `:latest` tag is in
ECR and the service is configured to use it (both enforced by G.1).

**Roll back to a specific known-good tag** (A8 P0-4):

```bash
# Accepts a bare tag (v0.1.3), a short SHA (abc123def456), or a
# <repo>-<sha> identifier. Prompts before mutating unless
# WEAVENYC_NO_CONFIRM=1.
scripts/ops/reset-to-last-good-image.sh v0.1.3
```

The script verifies the tag exists in ECR, splices it into the live
`SourceConfiguration`, and polls until the service returns to `RUNNING`.
Source: `scripts/ops/reset-to-last-good-image.sh`. See
[`docs/29_M8_Pilot_Readiness.md §3.7.1`](./29_M8_Pilot_Readiness.md#371-app-runner-image-rollback-a8-p0-4)
for the rollback SOP context.

### G.5 Redis URL rotation (Upstash)

**Why this exists.** A8 P0-7: until 2026-04-20, `REDIS_URL` in the
App Runner service's `RuntimeEnvironmentVariables` pointed at
`redis://localhost:6379`. `/readyz` returned 503 continuously; chat
realtime, refresh-token store, rate limits, and P2P fanout were all
degraded. Redis now lives on Upstash Redis (TLS endpoint), with the URL
stored in AWS Secrets Manager entry `weavenyc/pilot/redis-url-jJCCYP`
and referenced by App Runner at deploy time.

#### G.5.1 Provisioning Upstash (one-time)

Manual step — Upstash does not have a pre-built self-serve API token in
this repo's CI. A maintainer with an Upstash account must:

1. Log in to https://console.upstash.com (or create a free account;
   free tier handles the pilot's volume comfortably).
2. **Create Database** → pick `Regional`, region `us-east-1` (same AZ
   family as App Runner) → `Redis 7.x` → name
   `weavenyc-pilot-redis`.
3. In the resulting database's **REST** / **Details** page, copy the
   TLS-enabled connection string. It looks like
   `rediss://default:<password>@global-xxxxxx.upstash.io:6379`.
   The leading `rediss://` (two `s`) is required — plain `redis://`
   is rejected by ioredis against Upstash's TLS-only listener.
4. Record the password separately (not committed anywhere) and
   continue with §G.5.2.

#### G.5.2 Updating the AWS secret and redeploying

```bash
# 1. Rotate the secret value (preserves the ARN / entry id, so App
#    Runner's Secrets Manager binding does not need to be rewired).
aws secretsmanager update-secret \
  --region us-east-1 \
  --secret-id weavenyc/pilot/redis-url-jJCCYP \
  --secret-string 'rediss://default:<password>@global-xxxxxx.upstash.io:6379'

# 2. Confirm the new value is readable (value redacted in CloudTrail
#    but returned via get-secret-value when authed as the deployer).
aws secretsmanager get-secret-value \
  --region us-east-1 \
  --secret-id weavenyc/pilot/redis-url-jJCCYP \
  --query 'SecretString' --output text | head -c 20
# expected prefix: rediss://default:

# 3. Trigger a Deploy API Gateway workflow run so the next container
#    picks up the rotated secret. workflow_dispatch is the lightest
#    trigger:
gh workflow run deploy-api.yml --ref main

# 4. Wait for the deploy to land (smoke script asserts freshness),
#    then verify redis is healthy in /readyz:
curl -s https://api.weavenyc.org/readyz | jq '.checks[] | select(.name=="redis")'
# expected: {"name":"redis","status":"ok"}
```

#### G.5.3 Env checklist — what must exist before this workflow succeeds

| Location | Key | Value shape | Managed by |
|---|---|---|---|
| AWS Secrets Manager | `weavenyc/pilot/redis-url-jJCCYP` | `rediss://default:<password>@<host>.upstash.io:6379` | Maintainer (manual rotate) |
| App Runner service env | `REDIS_URL` | Secrets Manager binding to the entry above (not a plaintext value) | Deploy workflow |
| Upstash console | Database `weavenyc-pilot-redis` | `Regional`, `us-east-1`, TLS on | Maintainer |

If any row is missing, `/readyz` will show `redis: degraded` and the
pilot go/no-go gate for API health (see
[`docs/29_M8_Pilot_Readiness.md §1`](./29_M8_Pilot_Readiness.md#1-gono-go-checklist))
cannot be checked green.

---

## Appendix H) Alert rules

### H.1 Where they live

`infra/prometheus/rules/p2p.yaml` — 5 Prometheus alert rules covering the P2P overlay:

| Alert | Severity | Fires when |
|---|---|---|
| `P2PSyncErrorRateHigh` | warning | error rate > 1% over 10min |
| `P2PRedisFanoutDown` | **critical** | Redis fanout errors > 0.1/s for 5min |
| `P2PSyncStalled` | warning | 0 events in 30min despite active subscribers |
| `P2PBootstrapDenyRateHigh` | warning | bootstrap denial rate > 10% for 15min |
| `P2PSyncLagHighP95` | warning | p95 fanout lag > 15s for 10min |

### H.2 Scraping / deployment status

As of M8 pilot readiness, the staging/pilot environment does **not** yet run a Prometheus server or Grafana Agent. `/metrics` is exposed by the api-gateway but nothing scrapes it.

When a Prometheus deployment lands (tracked as an ops milestone), copy `infra/prometheus/rules/p2p.yaml` into the Prometheus `rule_files` path and reload. Wire the severities to PagerDuty via Alertmanager.

Until then, the rules are documentation: they encode "what we want to be notified about" so the future Prometheus rollout knows what to wire up. They also serve as a guide for on-call to run the equivalent checks manually via `curl /metrics | promtool query instant …`.

---

## Appendix I) Resource data freshness

A5 P0 audit finding: before pilot, pantry data imported once during M1 and never refreshed. A pantry that closed upstream stayed "active" in our directory forever. This appendix covers the scheduled refresh, the safety rails, and the on-call playbook.

### I.1 When imports run

- **Scheduled:** every day at **04:00 UTC** (00:00 EDT / 23:00 EST) via `.github/workflows/refresh-resources.yml`.
- **Gated:** the workflow only fires when repo secret `ENABLE_RESOURCE_IMPORTS=1`. Until that flag flips the job is a no-op (reports "skipped" in the Actions tab). This keeps accidental merges of the workflow from triggering production imports before on-call sign-off.
- **Sources refreshed:**
  - `cfc-active` — NYC HRA Community Food Connection (`services/resource-directory/src/adapters/cfc-active.ts`).
  - `island-harvest` — Island Harvest Pantry Finder (`services/resource-directory/src/adapters/island-harvest.ts`).
- **Transaction boundary:** each source runs as its own `ResourceImportRepository.importDataset` call. Failures in one source do not wipe the other.

### I.2 Safety rails

1. **Completeness guard** (`ImportCompletenessError` in `services/resource-directory/src/lib/repository.ts`). If the incoming batch has fewer than **50%** of the previously-active row count for that source, the import refuses. This protects against partial upstream fetches silently inactivating 90% of pantries. A refused import leaves the DB untouched and the workflow red — on-call must investigate.
2. **Live adapter smoke** (workflow step `Smoke sources before committing`). Runs `pnpm resources:sync --smoke` against the live sources without writing. If CFC Active or Island Harvest are down or return zero records, the job fails before touching the DB.
3. **Concurrency:** the workflow group `refresh-resources` serializes all runs (scheduled + manually-dispatched). A manually-dispatched run while the scheduled one is in flight waits, not overlaps.

### I.3 Force an ad-hoc refresh

- **Preferred path (GitHub Actions UI):** Actions → Refresh Resource Directory → Run workflow. Requires `ENABLE_RESOURCE_IMPORTS=1` to be already set. Use this when the scheduled run failed and you want to retry without waiting 24h.
- **Operator box (skips the gate):** from a trusted machine with `DATABASE_URL` set to the production DSN:
  ```bash
  pnpm --filter @weavenyc/resource-directory resources:sync
  # or per-source:
  pnpm --filter @weavenyc/resource-directory resources:import:cfc
  pnpm --filter @weavenyc/resource-directory resources:import:island-harvest
  ```
- **If the completeness guard legitimately fires** (a source genuinely shrunk — e.g. CFC Active went from 500 to 10 pantries): run the CLI with `--force` to bypass the guard. Only do this after confirming the upstream dataset actually shrunk (spot-check the source URL):
  ```bash
  pnpm --filter @weavenyc/resource-directory exec tsx src/cli.ts cfc-active --force
  ```

### I.4 On-call contact & playbook

- **Primary:** whoever carries the weekly pager for the API Gateway on-call rotation.
- **Secondary (data-specific):** `maintainers@weavenyc.org` — CC if the issue is "upstream CSV/API format changed" rather than our infra.
- **When the workflow is red:**
  1. Check the failure step:
     - `Smoke sources before committing` red → upstream source is down or changed shape. Open a ticket against the adapter. Do **not** `--force`; you might import garbage.
     - `Import CFC Active + Island Harvest` red with `ImportCompletenessError` → compare the new record count to the previous active count. If the upstream shrunk for real, run with `--force` as above. If it looks like a partial fetch, leave the DB as-is and re-trigger the workflow later.
  2. Confirm the live resource API is still serving stale-but-valid data:
     ```bash
     curl "https://api.weavenyc.org/v1/resources?zip=11735&type=pantry" | jq '.items | length'
     ```
     A non-zero `items.length` means the PWA still has pantries to show; users don't see an outage.
  3. When the import eventually succeeds, spot-check that at least one well-known pantry appears in both list (search by ZIP) and detail queries.

### I.5 Budget & expectations

- A full refresh geocodes net-new rows via Nominatim (open, unthrottled, occasionally flaky). Expect 3-10 minutes for the full `sync` job.
- The guard's 50% floor assumes a mature dataset. On the **first** scheduled run after enabling imports, the previous-active-count will already equal the last M1 import's count, so the guard should not fire.
- Each run writes to `resource_change_logs` so the diff (added / updated / removed) is auditable.
