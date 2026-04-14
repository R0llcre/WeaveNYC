# WeaveNYC — Testing Strategy

目标：把当前 `main = M5 completed` 的默认验证链和 `feature/m6-p2p-sync` 的 branch-local 验证链分清楚，避免把尚未落地的 P2P surface 混进默认 CI，同时给 M6 实现留出清晰的 smoke / E2E 入口。

---

## 1) 当前测试分层

| 层级 | 覆盖目标 | 当前入口 |
|------|----------|----------|
| Unit | helpers、validators、纯函数、协议工具 | `pnpm test` |
| Integration | Fastify route + PostgreSQL/Redis + shared contracts | `pnpm test` |
| Docs truth | README / Baseline / Plan / Backlog / API / Testing Strategy 是否一致 | `pnpm test` |
| Real API smoke | 已启动 API + DB + Redis + seed 的真实 HTTP 路径 | `pnpm test:smoke:real` |
| Browser smoke | PWA / Admin 的关键页面和主路径 | `pnpm test:e2e` |
| Live-source smoke | CFC / Island Harvest 上游源可达和 parser shape | `pnpm test:live-sources` |
| P2P smoke | M6 bootstrap / sync overlay 的 branch-local 真实 smoke | `pnpm test:smoke:p2p` |

说明：

- `pnpm test` 继续代表默认单元/集成/文档真值检查。
- `pnpm test:smoke:real` 继续代表 `main` 的真实 HTTP smoke。
- `pnpm test:smoke:p2p` 是 `feature/m6-p2p-sync` 的独立 overlay smoke，不并入当前 `main` 默认 close gate。

---

## 2) 当前默认 gate（main / M5）

默认 CI 和本地基线仍以 `main = M5 completed` 为准：

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

- `pnpm test:smoke:real` 会在 `/readyz` 不可用时先自启动 `api-gateway`
- `pnpm test:e2e` 仍是 browser smoke，不替代真实 API smoke
- `pnpm test:live-sources` 和 `pnpm dev:mint-anchor-token` 继续保留为 manual / opt-in
- `pnpm test:smoke:p2p` 当前不进默认 CI，因为 M6 业务 surface 仍在 branch 上实现中

---

## 3) M6 branch-local 验证链

### 3.1 目标

`M6` 的验证目标不是重测 M1-M5，而是新增这 5 类能力：

- bootstrap discovery
- sync delta / catch-up
- HTTP write -> durable sync event append -> second client catch-up
- Edge 本地缓存与离线只读恢复
- report / moderation 的 P2P replay 语义

### 3.2 当前 smoke 命令

```bash
pnpm test:smoke:p2p
```

当前定位：

- 它是 branch-local 的真实 overlay smoke，不属于 `main` 默认 close gate
- 它会沿用 `test:smoke:real` 的自启动策略；在本地没有现成 API 时，会先执行 `db:migrate` + `db:seed` 再自启 `api-gateway`
- 当前命令默认 hard-fail；bootstrap / sync surface 缺失或事件链不成立都会直接失败

建议环境变量：

| 变量 | 默认值 | 作用 |
|------|--------|------|
| `WEAVENYC_API_BASE_URL` | `http://127.0.0.1:4000` | P2P smoke 访问的 API 基地址 |
| `WEAVENYC_P2P_COMMUNITY_ID` | seeded community id | smoke 默认验证的社区 |

### 3.3 M6 当前 smoke 覆盖

- 两个已入社区的 client 都能成功调用 `GET /v1/communities/:community_id/bootstrap`
- bootstrap response 至少验证：
  - `community_id`
  - `bootstrap_version`
  - `anchor_node`
  - `relay_nodes`
  - `topics`
  - `latest_snapshot`
  - `mdns_demo_enabled`
- bootstrap 返回的 `websocket_url` 必须带短时 websocket token，且不能回显主 API bearer token
- 一个 writer client 通过现有 HTTP `POST /v1/posts` 成功写入 low-risk request
- 另一个 reader client 使用 `GET /v1/communities/:community_id/sync?since=...` 抓到该次写入产生的 `post.published`
- `post.published` delta 至少验证：
  - `aggregate_type = post`
  - `aggregate_id = created post_id`
  - `topic = weavenyc/{community_id}/posts`
- `payload.post.p2p_version = 1`
- `payload.post.ipfs_cid` 已写入
- anchor 公告发布后，reader 通过 `/sync` 抓到 `announcement.published`
- post-target report 创建后，reader 通过 `/sync` 抓到 `report.created`
- anchor report decision 后，reader 通过 `/sync` 抓到 `moderation.decision`
- reader 使用返回的 `next_since` 再打一次 `/sync`，必须得到空 `events`，证明 unseen catch-up 生效

当前 smoke 不额外承担这些路径：

- websocket live fanout
- 浏览器 worker 双端 live cache update
- 浏览器断线重连后的 UI 级恢复

这些仍由 integration tests、`pnpm test:smoke:real` 和后续更高层演示路径覆盖。

---

## 4) M6 测试计划

### 4.1 Unit

- event envelope shape / replay ordering / dedupe
- DAG serialization for posts and announcements
- version bump and merge rules
- `mDNS` env gate visibility（默认 off；显式开启路径有 unit coverage）

### 4.2 Integration

- `GET /v1/communities/:community_id/bootstrap`
- `GET /v1/communities/:community_id/sync`
- post create/update/remove -> event append + publish + `ipfs_cid` / `p2p_version` update
- announcement CRUD -> event append + publish + `ipfs_cid` / `p2p_version` update
- report create and moderation decision -> event append + replay visibility
- offline catch-up returns only unseen events and advances cursor
- chat/message routes remain untouched and do not emit P2P events

### 4.3 Browser / E2E

- 当前 `pnpm test:e2e` 仍是 M1-M5 的 fixture-backed browser smoke
- 现有浏览器用例不直接覆盖 M6 的 `/bootstrap`、`/sync`、worker 双端同步或断线恢复
- M6 的社区页 sync card、worker/Dexie/offline UI 路径目前依赖 unit/integration + `pnpm test:smoke:p2p` + manual demo 验证
- “设备 B 无整页刷新看到更新” 和 “断线后 UI 自动恢复” 目前仍是 manual stretch demo 目标，不算当前 browser automation 已证明项
- experimental `mDNS` toggle 仍保持 dev/demo-only，不进入默认 browser gate

### 4.4 Real demo / smoke

新增：

```bash
pnpm test:smoke:p2p
```

当前覆盖：

- bootstrap
- two-client membership bootstrap
- HTTP post write -> `post.published` replay
- announcement publish -> `announcement.published` replay
- post report create -> `report.created` replay
- anchor report decision -> `moderation.decision` replay
- empty / unseen catch-up

剩余拆分：

- worker/Dexie/offline UI path：unit/integration + manual demo

说明：

- `mDNS` 不进默认 CI gate，只做 dev/demo opt-in smoke
- 当前命令已经是可执行的 overlay smoke，不再只是 shape-only scaffold

---

## 5) Close gate（M6）

当 M6 进入真正 closeout 时，预期 gate 为：

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm test:smoke:real
pnpm test:smoke:p2p
```

6-lane review gate：

1. Docs truth / phase boundary
2. P2P protocol / event model / versioning
3. Bootstrap / sync API / embedded anchor runtime
4. Edge worker / Dexie cache / offline recovery
5. Report + moderation sync semantics
6. Stretch demo / mDNS / skeptic review

当前状态：

- `main` 仍以 M5 gate 为准
- `feature/m6-p2p-sync` 只提前接入文档真值和 branch-local smoke，不提前宣称 M6 已关闭
