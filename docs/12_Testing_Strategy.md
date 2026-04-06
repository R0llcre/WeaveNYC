# WeaveNYC — Testing Strategy

目标：用最小成本把当前已落地的高风险路径测扎实：资源导入、资源搜索、session 升级、refresh rotation，以及从首页到详情/收藏的 PWA 主路径；同时明确区分默认 CI、真实 API smoke、以及手工 live-source 验证。

---

## 1) 测试分层

| 层级 | 覆盖目标 | 当前工具 |
|------|----------|----------|
| Unit | parser、hours、validators、auth/session helpers、merge/geocode util | Vitest |
| Integration | Fastify route + PostgreSQL/Redis + shared contracts | Vitest |
| Real API smoke | 已启动 API + DB + Redis + seed 的真实 HTTP 路径 | `pnpm test:smoke:real` |
| E2E smoke | `Language -> ZIP -> List -> Detail -> Bookmark` | Playwright |
| Live-source smoke | CFC / Island Harvest 源可达、parser shape、record count sanity | `pnpm test:live-sources` |

### 1.1 当前工具真值

| 用途 | 工具 | 说明 |
|------|------|------|
| 单元测试 / 集成测试 | **Vitest** | 当前仓库统一使用 |
| HTTP / route 测试 | **Vitest + Fastify inject** | 不额外引入 Supertest |
| 数据库集成测试 | **PostgreSQL + Redis（docker compose）** | 本地可跑；CI 默认不启用 live DB integration |
| Real API smoke | **Node fetch + tsx** | 不走浏览器 route mock，直接打本地 Fastify |
| E2E 浏览器测试 | **Playwright** | 当前 browser smoke 仍使用 fixture-backed route mocking |
| API Contract 测试 | **Zod** + **tsc** | 请求/响应 schema 校验 |
| Live-source smoke | **CLI + real sources** | 默认 opt-in，不阻塞 CI |

### 1.2 当前 CI 真值

默认 CI 跑：

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm test:smoke:real
pnpm test:e2e
```

说明：

- `pnpm test:smoke:real` 是默认 CI 的真实 HTTP smoke，要求 API gateway、PostgreSQL、Redis、seed 都真正启动
- `pnpm test:e2e` 仍使用 fixture-backed browser smoke，不依赖真实外部源
- `pnpm test:live-sources` 是 opt-in 手工 smoke，不放进默认 CI
- Docker-backed DB integration 仍保留为本地/人工验证项

---

## 2) M1 必过用例

### 2.1 Zero Cold Start（官方资源目录）

| 用例 | 输入 | 期望输出 | 级别 |
|------|------|----------|------|
| ZIP 搜索 | ZIP=11735 | 返回 ≥3 个官方资源 | Real API smoke + Integration |
| 当前开放筛选 | ZIP + open_now=true | 只返回当前开放资源 | Unit（时间逻辑）+ Integration |
| 无效 ZIP | ZIP=00000 | 400 错误 + 前端给出可纠正提示 | Integration + E2E |
| 资源缺字段 | provider 缺 phone | 返回结果，详情页不崩 | Integration + E2E |
| 收藏回读 | 收藏资源后刷新页面 | bookmark 仍存在 | E2E |

### 2.2 Auth / Session（M1 范围）

| 用例 | 输入 | 期望输出 | 级别 |
|------|------|----------|------|
| 匿名会话 | `POST /v1/auth/anonymous` | 返回 access/refresh token + `level=anonymous` | Real API smoke + Integration |
| OTP 升级 | start + verify | 用户升级到 `verified` | Real API smoke + Integration |
| Magic link fallback | start + verify | 用户升级到 `verified` | Real API smoke + Integration |
| Refresh rotation | old refresh token | 返回新 token，旧 token 失效 | Real API smoke + Integration |
| Refresh replay | 已消费 refresh token 再次使用 | refresh family 被撤销 | Real API smoke + Integration |

### 2.3 Live-source smoke（opt-in）

| 用例 | 输入 | 期望输出 | 级别 |
|------|------|----------|------|
| CFC live probe | `pnpm test:live-sources` | CFC source reachable，parser 输出 `recordCount > 0` | Manual smoke |
| Island Harvest live probe | `pnpm test:live-sources` | Island Harvest source reachable，parser 输出 `recordCount > 0` | Manual smoke |
| 脏数据容错 | live source 含缺 ZIP/地址记录 | adapter 跳过坏记录，不致整批失败 | Unit + Manual smoke |

---

## 3) 测试数据管理

### 3.1 Seed Data（固定种子）

```typescript
export const TEST_SEED = {
  resources: [
    // 当前 seed 至少包含 11735 附近的 4 条官方资源
  ],
  users: [
    { id: 'user_anonymous', level: 'anonymous' },
    { id: 'user_verified', level: 'verified' },
    { id: 'user_anchor', level: 'anchor' },
  ],
};
```

说明：

- M1 默认 fixture-backed browser tests 不依赖真实 CFC / Island Harvest 源
- `pnpm test:live-sources` 才会触发真实源验证

### 3.2 数据生成脚本

```bash
pnpm db:seed
docker compose down -v
```

### 3.3 测试隔离策略

- **Unit tests**：纯内存，无外部依赖
- **Integration tests**：默认使用 fixture data 或本地 docker compose 数据库
- **Real API smoke**：要求本地 API + Redis + PostgreSQL + seed 处于可用状态
- **E2E tests**：默认通过 Playwright route mocking 保持稳定

---

## 4) 当前验证切分

### 4.1 Real API smoke

```bash
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm --filter @weavenyc/api-gateway start
pnpm test:smoke:real
```

覆盖：

- `GET /healthz`
- `GET /readyz`
- `POST /v1/auth/anonymous`
- `POST /v1/auth/refresh`
- `POST /v1/auth/refresh` replay -> `401`
- `GET /v1/me`（401 / 200）
- `POST /v1/auth/otp/start` + `verify`
- `POST /v1/auth/magic-link/start` + `verify`
- `GET /v1/resources?zip=11735&limit=5`
- `GET /v1/resources/:provider_id?zip=11735`
- `GET /docs`

### 4.2 Fixture-backed browser smoke

```typescript
test('language -> zip -> list -> detail -> bookmark smoke flow', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'ES', exact: true }).click();
  await page.getByRole('button', { name: 'Crear sesión anónima' }).click();

  await page.getByPlaceholder('11735').fill('11735');
  await page.getByRole('button', { name: 'Ver recursos cercanos' }).click();
  await expect(page.locator('article').first()).toContainText('St. Kilian');

  await page.getByRole('button', { name: 'Guardar' }).first().click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Guardado' }).first()).toBeVisible();

  await page.getByRole('link', { name: 'Ver detalles' }).first().click();
  await expect(page.getByText('Horario semanal')).toBeVisible();
});
```

---

## 5) 当前接受的测试限制

- CI 默认不跑 live-source smoke
- Browser smoke 仍不覆盖真实 API / DB / Redis 集成
- CI 默认不跑完整 Docker-backed DB integration suite
- CFC live probe 依赖本地 `pdftotext` 与上游 PDF 结构
