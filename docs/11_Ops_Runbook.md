# WeaveNYC — Ops Runbook (SRE-lite)

目标：即使只有 2-3 人，也要把"可观测性 + 故障处理 + 数据恢复"最小化做起来。

---

## 1) 服务清单（MVP）

**6 个后端微服务（Fastify + TypeScript）**：

| 服务 | 职责 | 关键依赖 |
|------|------|----------|
| API Gateway | 路由、鉴权、限流 | PostgreSQL, Redis |
| Resource Directory Service | 官方资源目录查询 | PostgreSQL (PostGIS) |
| Posts Service | 互助帖子 CRUD | PostgreSQL |
| Match Service | 匹配引擎 | PostgreSQL, Posts Service, Directory Service |
| Chat Service | 聊天消息（WebSocket） | PostgreSQL / Redis Pub/Sub |
| Notification Service | 推送/短信/邮件 | Twilio / FCM / SES |

**前端应用（Next.js + TypeScript，不计入微服务数量）**：

| 应用 | 职责 | 部署 |
|------|------|------|
| PWA（用户端） | 互助发布/搜索/匹配/聊天 | Vercel Edge |
| Anchor Admin Console | 管理后台（审核/公告/规则） | Vercel Edge |

---

## 2) SLO / SLA（建议）

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

## 3) 监控面板（Dashboard）

### 3.1 Golden Signals
- **Latency**：p50, p95, p99（按服务拆分）
- **Traffic**：req/s, active users/hour, WebSocket connections
- **Errors**：5xx rate, 4xx rate（按 endpoint 拆分）
- **Saturation**：CPU %, memory %, DB connection pool usage, disk I/O

### 3.2 Domain Metrics
- Posts created/day（按类别、风险等级分组）
- Matches suggested/day
- Verified matches/week（北极星指标）
- Reports/day & 平均处置时长
- Anchor 审核队列积压量
- 新用户 7 天留存率

### 3.3 推荐工具栈

| 用途 | 推荐工具 | 备选 | 说明 |
|------|----------|------|------|
| 指标采集 | Prometheus + Grafana | Datadog | 开源免费，社区大 |
| 日志聚合 | Loki + Grafana | ELK (Elastic) | 轻量，与 Prometheus 生态统一 |
| 应用追踪 | OpenTelemetry + Jaeger | Zipkin | CNCF 标准，vendor-neutral |
| Uptime 监控 | UptimeRobot (免费版) | Better Uptime | 免费额度足够 MVP |
| 错误追踪 | Sentry (免费版) | — | 前后端错误自动归类 |

### 3.4 Grafana Dashboard 布局（建议）

**Dashboard 1: Overview**
- Row 1: 4 个 stat panel（QPS / 5xx rate / p95 latency / active users）
- Row 2: 时间序列图（latency by service / error rate by service）
- Row 3: 时间序列图（posts created / matches generated）

**Dashboard 2: Safety & Governance**
- Row 1: 举报数 / 审核队列积压 / 平均处置时长
- Row 2: 敏感词拦截次数 / 封禁操作数 / 高风险帖子占比

---

## 4) 日志与追踪

### 4.1 日志格式（JSON Structured Logging）
```json
{
  "timestamp": "2026-02-22T10:30:00Z",
  "level": "info",
  "service": "posts-service",
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

### 4.4 Distributed Tracing（Phase 2）
- 使用 OpenTelemetry SDK 在各服务入口注入 trace context
- 关键链路追踪：`用户发帖 → 风险检测 → 审核 → 匹配 → 通知`
- 采样率：MVP 阶段可 100%，流量大时降至 10%

---

## 5) 告警规则

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

      - alert: MatchServiceDown
        expr: up{service="match-service"} == 0
        for: 2m
        labels:
          severity: P1
        annotations:
          summary: "Match service is down"
```

### 5.3 告警通知渠道配置
- **Slack**：创建 #ops-critical / #ops-alerts / #ops-info 三个频道
- **电话（P0）**：使用 PagerDuty 免费版或 Slack 的 Workflow 触发电话呼叫
- **邮件**：作为兜底渠道，所有 P0/P1 告警同时发邮件

---

## 6) On-Call 机制（2-3 人团队版）

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

## 7) 故障处理 Playbooks

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
2. 通过 API 直接处理紧急审核：
   ```bash
   curl -X POST https://api.weavenyc.local/v1/admin/review_queue/{post_id}/decision \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"decision": "approve", "notes": "emergency bypass"}'
   ```
3. 通知 Anchor 使用备用渠道（Slack/电话）报告紧急情况

---

## 8) 备份与恢复

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

## 9) 发布流程（Deployment Pipeline）

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

### 9.3 Rollback 命令
```bash
# 快速回滚到上一个版本
git revert HEAD --no-edit && git push origin main

# 或直接部署指定 tag
npm run deploy -- --tag v1.2.3
```

### 9.4 Feature Flags（推荐）
对高风险功能使用 feature flag 控制灰度：
- `ENABLE_P2P_SYNC`: P2P 同步功能开关
- `ENABLE_VOICE_INPUT`: 语音输入功能开关
- `MATCH_ALGORITHM_VERSION`: 匹配算法版本（可灰度切换）

---

## 10) 安全运营检查清单（每周）

- [ ] 检查 Sentry 未解决的错误数量
- [ ] 检查审核队列是否有超时未处理的举报
- [ ] 检查 Error Budget 消耗情况
- [ ] 确认备份正常执行（S3 最新备份时间）
- [ ] 检查依赖库安全漏洞（`npm audit`）
- [ ] 确认日志中无敏感信息泄露
