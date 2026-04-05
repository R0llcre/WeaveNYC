# WeaveNYC — Testing Strategy

目标：用最小成本把"高风险路径"测扎实：发帖、匹配、聊天、审核、举报。

---

## 1) 测试金字塔

| 层级 | 占比 | 覆盖目标 | 工具 |
|------|------|----------|------|
| Unit | 70% | 纯函数、规则引擎、schema 校验、工具函数 | Jest |
| Integration | 20% | API + DB + 消息队列、服务间调用 | Jest + Supertest + Testcontainers (PostgreSQL) |
| E2E | 10% | 完整用户旅程：从 ZIP 搜索到完成 Verified Match | Playwright |

### 1.1 测试框架选型

| 用途 | 工具 | 说明 |
|------|------|------|
| 单元测试 / 集成测试 | **Jest** | Node.js 生态标配，内置 mock/spy |
| HTTP API 测试 | **Supertest** | 配合 Fastify/Express 做 API 集成测试 |
| 数据库集成测试 | **Testcontainers** | 每次测试自动启动一个 PostgreSQL Docker 容器，隔离干净 |
| E2E 浏览器测试 | **Playwright** | 支持多浏览器、移动端模拟、网络截断 |
| 负载测试 | **k6** | 脚本化负载测试，输出 Prometheus 格式指标 |
| API Contract 测试 | **Zod** (runtime) + **tsc** (compile time) | 请求/响应 schema 校验 |

### 1.2 CI 集成（GitHub Actions）

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:unit --coverage
      - uses: codecov/codecov-action@v4

  integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgis/postgis:16-3.4
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: weavenyc_test
        ports: ['5432:5432']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:integration
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/weavenyc_test

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: pnpm install --frozen-lockfile
      - run: npx playwright install --with-deps chromium
      - run: pnpm test:e2e
```

---

## 2) 关键用例（必须覆盖）

### 2.1 Zero Cold Start（官方资源目录）
| 用例 | 输入 | 期望输出 | 级别 |
|------|------|----------|------|
| ZIP 搜索 | ZIP=11735 | 返回 ≥3 个官方资源 | Unit + Integration |
| 今天开放筛选 | ZIP + open_now=true | 只返回今天开放的资源 | Unit（时间逻辑）+ Integration |
| 无效 ZIP | ZIP=00000 | 400 错误 + 可纠正提示 | Unit |
| 资源缺字段 | provider 缺 phone | 返回结果，phone 显示"未知" | Integration |

### 2.2 Request → Match Suggestions
| 用例 | 输入 | 期望输出 | 级别 |
|------|------|----------|------|
| 有邻里 Offer | Food Request + 存在 Food Offer | 返回 3 个方案，邻里在前，官方兜底 | Integration |
| 无邻里 Offer | Food Request + 无 Offer | 返回 3 个官方资源 | Integration |
| 语言匹配 | Request(zh) + Offer(zh) + Offer(en) | zh Offer 排名更高 | Unit（排序逻辑） |
| 过期 Offer | Food Request + expired Offer | 过期 Offer 不出现在结果中 | Integration |

### 2.3 High-risk Category Gate
| 用例 | 输入 | 期望输出 | 级别 |
|------|------|----------|------|
| Childcare 审核 | 发布 Childcare Request | status = pending_review，不可见 | Integration |
| Transportation 审核 | 发布 Transportation Offer | status = pending_review | Integration |
| Anchor 通过 | Anchor approve pending post | status → active，用户可见 | Integration |
| Anchor 拒绝 | Anchor reject pending post | status → removed | Integration |

### 2.4 Safety & Abuse
| 用例 | 输入 | 期望输出 | 级别 |
|------|------|----------|------|
| SSN 关键词 | 帖子含 "SSN" | 触发风险提示 + risk_level=high | Unit（规则引擎） |
| wire transfer 关键词 | 消息含 "wire transfer" | 触发安全弹窗 + risk event | Unit |
| 消息刷屏 | 同一用户 1 分钟 > 20 条消息 | 触发限流 (429) | Integration |
| 举报 → 处置 | 举报帖子 | report 创建，Anchor 收到 | Integration |

### 2.5 聊天与隐私
| 用例 | 输入 | 期望输出 | 级别 |
|------|------|----------|------|
| 双方同意 | A 先完成 verified 并发送 Contact Request；B 在 inbox 中 Accept | 创建 Conversation | Integration |
| 单方请求 | 只有 A 发送 Contact Request | 不创建 Conversation，不暴露 B 信息 | Integration |
| 收件箱可见 | B 打开 contact request inbox | 看到 pending 请求列表 | Integration |
| 越权读取收件箱 | requester 或第三方用户访问 contact request inbox | 403 或空结果，不返回不属于自己的请求 | Integration |
| 越权 accept/reject | requester 或第三方用户调用 accept/reject | 403 Forbidden | Integration |
| 拉黑 | A 拉黑 B | 双方互不可见，消息不送达 | Integration |

### 2.6 Anchor 管理
| 用例 | 输入 | 期望输出 | 级别 |
|------|------|----------|------|
| 发布公告 | Anchor 创建 Announcement | 社区用户可见 | Integration |
| 规则配置 | 修改 categories_require_review | 新帖遵循新规则 | Integration |
| 越权操作 | 普通用户调用 admin API | 403 Forbidden | Integration |

---

## 3) 测试数据管理

### 3.1 Seed Data（固定种子）
```typescript
// tests/fixtures/seed.ts
export const TEST_SEED = {
  communities: [
    { id: 'comm_test_1', name: 'Farmingdale', center_zip: '11735' },
    { id: 'comm_test_2', name: 'Queens-Astoria', center_zip: '11102' },
  ],
  resources: [
    // 100 条官方资源（pantry/soup kitchen），按 ZIP 分布
    // 固定种子随机数生成，保证可重现
  ],
  posts: [
    // 1000 条模拟 posts（500 request + 500 offer），按 ZIP/类别分布
  ],
  users: [
    { id: 'user_seeker', role: 'seeker', language: 'zh', level: 'verified' },
    { id: 'user_helper', role: 'helper', language: 'en', level: 'verified' },
    { id: 'user_anchor', role: 'anchor', community_id: 'comm_test_1' },
  ],
  contactRequests: [
    {
      id: 'cr_pending_1',
      requester_user_id: 'user_seeker',
      recipient_user_id: 'user_helper',
      from_post_id: 'post_request_1',
      to_post_id: 'post_offer_1',
      status: 'pending',
    },
  ],
  storageStates: {
    recipientVerified: 'tests/fixtures/storage/recipient-verified.json',
  },
};
```

说明：
- `contactRequests.cr_pending_1` 必须绑定到同一批 seed 里的 `user_helper`
- `recipient-verified.json` 必须由 `user_helper` 在测试前重新生成，不能复用未知旧状态
- inbox E2E 运行前先执行 `pnpm test:seed --seed=42` 或等价 reset，确保 pending request 与 storage state 同步

### 3.2 数据生成脚本
```bash
# 生成测试数据
pnpm test:seed --count-resources=100 --count-posts=1000 --seed=42

# 清理测试数据
pnpm test:clean
```

### 3.3 测试隔离策略
- **Unit tests**：纯内存，无外部依赖
- **Integration tests**：每个 test suite 使用独立的 DB schema 或事务回滚
- **E2E tests**：使用独立的 test database + test user accounts

---

## 4) E2E 测试场景（Playwright）

> 下列示例是**可执行骨架**，默认使用 `getByRole` / `getByLabel` / `data-testid`。实际实现里如果选择器不同，只需要统一替换，不要改动流程顺序。

### 4.1 Happy Path：匿名发帖，再升级后联系
```typescript
test('new user can find food resource, create an anonymous post, and upgrade before contact', async ({ page }) => {
  // 1) 打开 App → 选语言 (EN)
  await page.goto('/');
  await page.getByRole('button', { name: 'English' }).click();

  // 2) 输入 ZIP
  await page.getByLabel('ZIP Code').fill('11735');
  await page.getByRole('button', { name: 'See nearby resources' }).click();

  // 3) 验证资源列表
  const resourceCards = page.locator('[data-testid="resource-card"]');
  expect(await resourceCards.count()).toBeGreaterThanOrEqual(3);

  // 4) 发布 Food Request（允许匿名会话先写后发）
  await page.getByRole('button', { name: 'Request help' }).click();
  await page.getByRole('button', { name: 'I need help' }).click();
  await page.getByLabel('Category').selectOption('food');
  await page.getByLabel('Description').fill('Need dinner for 2');
  await page.getByLabel('Approx location').fill('11735');
  await page.getByRole('button', { name: 'Preview' }).click();
  await page.getByRole('button', { name: 'Publish' }).click();

  // 5) 验证帖子已进入待处理状态
  await expect(page.getByText('Pending')).toBeVisible();

  // 6) 进入匹配结果页后，点击 Contact 时必须先升级 verified
  await expect(page.getByText('3 ways to act now')).toBeVisible();
  await page.getByRole('button', { name: 'Contact' }).click();
  await expect(page.getByText('Verify to continue')).toBeVisible();
  await page.getByRole('button', { name: 'Continue with OTP' }).click();
  await page.getByLabel('Verification code').fill('123456');
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByText('Verified')).toBeVisible();
  await page.getByRole('button', { name: 'Contact' }).click();
  await expect(page.getByText('Request contact')).toBeVisible();
});
```

### 4.1.1 Fallback Path：Magic Link 也能恢复 Contact 流程
```typescript
test('user can upgrade with magic link and resume contact', async ({ page }) => {
  await page.goto('/matches/post_request_1');
  await page.getByRole('button', { name: 'Contact' }).click();
  await page.getByRole('button', { name: 'Continue with magic link' }).click();
  await page.getByLabel('Email').fill('helper@example.com');
  await page.getByRole('button', { name: 'Send magic link' }).click();

  // 测试环境中直接消费 challenge/token，避免依赖真实邮箱
  await page.goto('/auth/magic-link/callback?challenge_id=ml_test&token=token_test');
  await expect(page.getByText('Verified')).toBeVisible();
  await page.goto('/matches/post_request_1');
  await page.getByRole('button', { name: 'Contact' }).click();
  await expect(page.getByText('Request contact')).toBeVisible();
});
```

### 4.2 Safety Path：高风险类别被拦截
```typescript
test('childcare request requires anchor review', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Request help' }).click();
  await page.getByRole('button', { name: 'I need help' }).click();
  await page.getByLabel('Category').selectOption('childcare');
  await page.getByLabel('Description').fill('Need help with after-school pickup');
  await page.getByRole('button', { name: 'Publish' }).click();

  await expect(page.getByText('Needs anchor review')).toBeVisible();
  await expect(page.getByText('Pending')).toBeVisible();
});
```

### 4.3 Recipient Path：对方在收件箱里接受联系请求
```typescript
test.use({ storageState: 'tests/fixtures/storage/recipient-verified.json' });

test('recipient can accept a pending contact request from the inbox', async ({ page }) => {
  await page.goto('/inbox/contact-requests');

  const requests = page.locator('[data-testid="contact-request-item"]');
  expect(await requests.count()).toBeGreaterThanOrEqual(1);

  await requests.first().getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByText('Conversation created')).toBeVisible();
});
```

### 4.3.1 Unauthorized Path：非接收方不能读取或处理请求
```typescript
test.use({ storageState: 'tests/fixtures/storage/requester-verified.json' });

test('requester cannot read or accept someone else\\'s pending contact request', async ({ page, request }) => {
  const inbox = await request.get('/v1/contact-requests/inbox');
  expect([200, 403]).toContain(inbox.status());

  const accept = await request.post('/v1/contact-requests/cr_pending_1/accept');
  expect(accept.status()).toBe(403);

  await page.goto('/inbox/contact-requests');
  await expect(page.getByText('No pending contact requests')).toBeVisible();
});
```

### 4.4 多语言路径
```typescript
test('chinese user can complete full flow in zh', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '中文' }).click();
  await expect(page.getByText('选择语言')).toBeVisible();
  await page.getByLabel('ZIP Code').fill('11735');
  await page.getByRole('button', { name: '查看附近资源' }).click();
  await expect(page.getByRole('button', { name: '请求帮助' })).toBeVisible();
});
```

### 4.5 低带宽模式
```typescript
test('app works on slow 3G', async ({ page }) => {
  // Chromium-only: use CDP network emulation for a reproducible slow-3G profile
  const client = await page.context().newCDPSession(page);
  await client.send('Network.enable');
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 400,
    downloadThroughput: (750 * 1024) / 8,
    uploadThroughput: (250 * 1024) / 8,
  });

  await page.goto('/');
  await expect(page.getByRole('heading').first()).toBeVisible();
  // 验证首屏可用，图片可延迟加载或使用占位符
});
```

---

## 5) 负载测试（k6）

### 5.1 目标
模拟 500 日活、峰值 50 rps 的场景。

### 5.2 测试脚本
```javascript
// tests/load/scenario.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 20 },  // ramp up
    { duration: '5m', target: 50 },  // peak
    { duration: '2m', target: 0 },   // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // p95 < 2s
    http_req_failed: ['rate<0.01'],      // error rate < 1%
  },
};

export default function () {
  // 30 rps: 资源搜索
  const resSearch = http.get('https://api.weavenyc.local/v1/resources?zip=11735&open_now=true');
  check(resSearch, { 'resources 200': (r) => r.status === 200 });

  // 10 rps: 发帖
  const postCreate = http.post('https://api.weavenyc.local/v1/posts', JSON.stringify({
    post_type: 'request',
    category: 'food',
    body: 'Need dinner for 2',
    location_zip: '11735',
    privacy: 'community_only',
  }), { headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer TEST_TOKEN' } });
  check(postCreate, { 'post 201': (r) => r.status === 201 });

  sleep(1);
}
```

### 5.3 通过标准
| 接口 | 目标 QPS | p95 延迟 | 错误率 |
|------|----------|----------|--------|
| `/v1/resources` | 30 | < 800ms | < 1% |
| `/v1/posts` (create) | 10 | < 1s | < 1% |
| `/v1/posts/{post_id}/matches` | 5 | < 2s | < 1% |
| `/v1/conversations/*/messages` | 5 | < 500ms | < 1% |

---

## 6) 混沌/故障演练

### 6.1 演练场景

| 故障 | 持续时间 | 期望行为 | 验证方式 |
|------|----------|----------|----------|
| PostgreSQL 只读 | 10 分钟 | 降级为"只读官方资源"，发帖返回 503 + 友好提示 | E2E |
| Match Service 下线 | 10 分钟 | 发帖仍成功，匹配返回"暂时不可用" + 官方资源兜底 | E2E |
| 网络分区（Anchor 不可达） | 10 分钟 | Edge 本地缓存仍可用，低风险帖子可本地展示 | E2E |
| Redis 不可用 | 10 分钟 | 限流降级为内存计数器，session 降级为 JWT 无状态 | Integration |

### 6.2 演练命令
```bash
# 模拟 DB 只读
docker exec postgres psql -c "ALTER USER weavenyc SET default_transaction_read_only = on;"

# 模拟 Match Service 下线（本地 compose）
docker compose stop match-service

# 恢复（本地 compose）
docker compose start match-service
```

> 如果演练的是 target-state 云环境，不要再使用 Kubernetes 命令；应改用对应平台的停用/恢复方式
>（例如 AWS ECS service scale-down、Cloud Run revision disable、Vercel deployment rollback）。

---

## 7) 覆盖率要求

| 模块 | 行覆盖率目标 | 分支覆盖率目标 | 说明 |
|------|-------------|----------------|------|
| 风险规则引擎 | ≥ 90% | ≥ 85% | 安全关键路径 |
| 匹配排序逻辑 | ≥ 85% | ≥ 80% | 核心业务逻辑 |
| API 路由/鉴权 | ≥ 80% | ≥ 75% | 安全边界 |
| 数据导入/解析 | ≥ 80% | ≥ 75% | 数据质量关键 |
| UI 组件 | ≥ 60% | — | 以 E2E 为主 |

---

## 8) Release Gate（上线前必须通过）

- [ ] 所有 Must-have E2E 用例通过（§2.1-2.6）
- [ ] 关键接口鉴权 / 越权测试通过
- [ ] 日志脱敏检查通过（聊天正文不落日志）
- [ ] Rate limit 生效验证通过
- [ ] 负载测试 p95 达到 SLO（见 [11_Ops_Runbook](./11_Ops_Runbook.md)）
- [ ] 安全测试：OWASP Top 10 基础检查（见 [10_Security](./10_Security_Privacy_Threat_Model.md)）
- [ ] 无 `npm audit` High/Critical 级别漏洞
- [ ] 多语言 UI：EN/ES/ZH 关键页面文案无缺失
- [ ] Lighthouse 性能得分 ≥ 70（移动端 4G 模拟）
