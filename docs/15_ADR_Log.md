# WeaveNYC — ADR Log (Architecture Decision Records)

> ADR 用来记录"为什么我们选了这个，而不是那个"，避免后续反复争论。

---

## ADR Template
- Title
- Status (Proposed / Accepted / Superseded)
- Context（背景与约束）
- Decision（决定）
- Consequences（后果与取舍）
- Alternatives considered（考虑过的替代方案）

---

## ADR-0001: Default data is stored locally
**Status**: Accepted

**Context**:
- 核心用户对隐私敏感（移民、低收入家庭、老人）
- 他们可能不信任云端存储

**Decision**:
- 默认本地存储；用户 opt-in 才同步到社区（P2P/Anchor）

**Consequences**:
- 冷启动必须靠官方目录（不能依赖用户贡献的内容）
- 多设备同步需要额外机制（Phase 2）
- 本地数据库需要选型（IndexedDB / SQLite via WASM）

**Alternatives**:
- 全部云端（更易做，但破坏信任，与核心价值矛盾）
- 默认 P2P 同步（复杂度高，MVP 不适合）

---

## ADR-0002: Anchor has final moderation authority
**Status**: Accepted

**Context**:
- 社区自治是核心价值
- P2P 网络中需要一个可信的仲裁方

**Decision**:
- Anchor 的审核结论覆盖 P2P 网络里的帖子状态
- Anchor 可配置社区规则（审核类别、黑名单、可见范围）

**Consequences**:
- 需要审计日志（所有审核操作可追踪）
- Anchor 账号安全变成关键（强制 MFA）
- 单点风险：Anchor 不活跃时审核停滞 → 需要 fallback 机制

**Alternatives**:
- 纯社区投票（民主但慢，且易被 Sybil 攻击）
- 平台统一审核（可控但违背社区自治原则）

---

## ADR-0003: Always include an official-resource fallback in match results
**Status**: Accepted

**Context**:
- 需要保证"行动方案"永远存在，即使没有邻里 Offer
- 用户在紧急情况下不能看到"无结果"

**Decision**:
- 每个 Request 的行动方案中必含至少 1 个官方资源

**Consequences**:
- Match service 必须调用资源目录服务
- 官方资源数据质量成为硬依赖（不能为空、不能全过期）

**Alternatives**:
- 只展示邻里匹配（冷启动时用户体验为零）
- 展示"暂无结果"+ 提示稍后再试（紧急需求场景不可接受）

---

## ADR-0004: Tech stack — Full-stack TypeScript + PostgreSQL + libp2p
**Status**: Accepted

**Context**:
- 团队 2-3 人，需要最大化开发效率，统一语言栈
- 产品形态：PWA（移动优先）+ Web 管理后台 + REST API + P2P 节点
- 核心 P2P 栈是 libp2p / IPFS（JS 生态最成熟），前端用 TS/JS 可直接复用代码、类型、加密/签名逻辑
- 需要地理查询（ZIP/距离）、多云部署友好
- 课程要求：P2P/去中心化 + 至少 3 大云 + 至少 3 种 PaaS

**Decision**:

**前端（Client Layer）**:

| 职责 | 选型 | 理由 |
|------|------|------|
| UI 框架 | **Next.js (React) + TypeScript** | PWA 原生支持、SSR/SSG、路由/权限/i18n 工程化成熟 |
| 状态管理 | **Redux Toolkit** | 中间件强大、DevTools 调试体验好、规范性强 |
| 数据请求缓存 | **TanStack Query (React Query)** | 请求/缓存/重试/离线友好、自动 stale-while-revalidate |
| 本地离线数据 | **IndexedDB (Dexie.js)** | 结构化本地存储、支持索引查询、PWA 离线核心 |
| i18n | **next-intl** | 与 Next.js App Router 深度集成、类型安全、Server Component 原生支持 |
| 地图 | **Leaflet + OpenStreetMap** | 免费、无 API Key、避免 Mapbox 费用和依赖 |
| P2P 客户端 | **libp2p-js / Helia (IPFS)** | 跑在 WebWorker 避免阻塞 UI，与后端共享消息协议 |
| Schema 校验 | **Zod** | 运行时校验 + TypeScript 类型推导，前后端共享 |

**后端（Service Layer）**:

| 职责 | 选型 | 理由 |
|------|------|------|
| API 框架 | **Fastify + TypeScript** | 高性能、内置 schema 验证、JSON 序列化最快 |
| ORM | **Drizzle** | 类型安全、SQL-like API、migration 工具完善 |
| 缓存/限流 | **Redis** | 会话管理、Rate limiting、Pub/Sub（Chat） |
| 任务队列 | **BullMQ (Redis-backed)** | 数据抓取、匹配计算、通知发送等异步任务 |
| API 文档 | **Fastify Swagger (自动生成)** | Zod schema → OpenAPI spec → Swagger UI |

**数据层**:

| 职责 | 选型 | 理由 |
|------|------|------|
| 中心索引 | **PostgreSQL + PostGIS** | 地理查询、关系型、跨云可迁移（RDS/Cloud SQL/Azure DB） |
| 内容存储 | **IPFS (Helia)** | 内容寻址、不可变、P2P 共享，帖子摘要走 IPFS |
| 对象存储 | **S3 / GCS / Azure Blob** | 官方目录快照、备份、大文件 |
| 客户端本地 | **IndexedDB (Dexie.js)** | 草稿、最近浏览、离线缓存、用户偏好 |

**基础设施**:

| 职责 | 选型 | 理由 |
|------|------|------|
| Monorepo | **pnpm workspace** | 前后端共享类型和工具包 |
| 容器化 | **Docker** | 本地开发一致性 + 多云部署可移植性 |
| CI/CD | **GitHub Actions** | 免费额度充足、与 GitHub 生态集成 |
| 多云部署 | AWS Lambda + GCP Cloud Run + Azure Functions | 不同服务可部署到不同云，满足课程 3 云 3 PaaS 要求 |

**Consequences**:
- 全栈 TypeScript：共享 DTO、校验规则、错误码、加密签名逻辑、P2P message schema
- PostGIS 提供原生地理查询，无需额外服务
- libp2p/Helia 的 JS 实现与前后端同语言，可直接复用消息结构和加密逻辑
- 多云部署变成"部署配置"而不是"重写系统"：同一套 Node.js 服务可以跑在 Lambda / Cloud Run / Azure Functions
- PWA "扫码即用、免安装"对低门槛至关重要

**Alternatives**:
- Flutter：跨端强但 libp2p/IPFS 在 Dart 生态需要桥接，团队成本上升
- React Native (Expo)：如果需要原生推送/蓝牙/WiFi Direct 深度能力可考虑，但先 PWA 跑通核心价值
- Python (FastAPI)：NLP/数据处理强，但前后端语言不统一增加维护成本
- MongoDB Atlas：多云托管可行但地理+结构化+审计场景 Postgres 更合适
- Express：成熟但性能不如 Fastify，缺乏内置 schema 验证

---

## ADR-0005: No time bank / token / blockchain in MVP
**Status**: Accepted

**Context**:
- 时间银行、积分兑换、加密货币是常见的互助激励机制
- 但这些机制增加复杂度，且可能引入金融监管问题

**Decision**:
- MVP 不做任何积分/代币/支付系统
- 先把"匹配做对"，用"见证 + 信誉"作为最小信任机制

**Consequences**:
- Helper 的激励主要靠利他动机 + 社区归属感
- 需要通过 Anchor 激励机制和社区文化建设来维持供给侧
- 后续迭代可以引入时间银行（作为 opt-in 功能）

**Alternatives**:
- 内置时间银行（增加激励但复杂度翻倍，且需要反欺诈）
- 积分/勋章系统（轻量激励，可作为 Phase 2 考虑）

---

## ADR-0006: ZIP-level location precision by default
**Status**: Accepted

**Context**:
- 用户群体对位置隐私极其敏感
- 但匹配需要某种程度的地理信息

**Decision**:
- 用户默认只提供 ZIP code 或 Neighborhood
- 不存储、不传输精确 GPS 坐标
- 资源点可存经纬度（来自 geocoding），但对用户展示为"约 X 英里"

**Consequences**:
- 匹配精度受限（同 ZIP 内可能距离较远）
- 后续可引入更细粒度的 geohash（用户 opt-in）
- 地图展示只能做到 neighborhood 级别

**Alternatives**:
- 精确 GPS（匹配更准但严重侵犯隐私）
- Geohash precision 5（约 5km²，比 ZIP 精确但仍模糊）— 可作为 Phase 2 opt-in

---

## ADR-0007: Eventually consistent P2P with Anchor arbitration
**Status**: Accepted

**Context**:
- P2P 架构天然是最终一致的
- 需要在一致性和可用性之间做选择（CAP theorem）

**Decision**:
- 帖子列表采用最终一致（eventually consistent）
- Anchor 的审核决定具有最终裁决权（moderation decision wins）
- 事件以 `event_id` 去重，帖子以 `post_id + version` 排序

**Consequences**:
- 用户可能短暂看到已被下架的内容（直到同步完成）
- Anchor 离线时审核停滞，低风险帖子仍可本地展示
- 需要冲突解决策略（last-write-wins for posts，Anchor-wins for moderation）

**Alternatives**:
- 强一致（Raft/Paxos）：保证即时同步但大幅增加复杂度
- 全中心化：简单但违背去中心化目标

---

## ADR-0008: Voice input — Three-tier degradation strategy
**Status**: Accepted

**Context**:
- 目标用户可能不擅长打字（老人、低教育水平、多语言用户）
- 语音输入是"低门槛"核心功能
- 需要支持英语、西班牙语、中文三种语言
- 隐私优先：音频数据应尽量不离开设备

**Decision**:
采用**三层降级策略**，隐私优先、逐级兜底：

| Tier | 方案 | 隐私 | 成本 | 触发条件 |
|------|------|------|------|----------|
| **Tier 1** | 端侧/系统级语音识别 | 最好（音频不出设备） | 免费 | 设备支持原生 Speech API 时优先使用 |
| **Tier 2** | 浏览器 Web Speech API | 好（浏览器处理） | 免费 | PWA 环境下的 fallback |
| **Tier 3** | 自建 Speech Gateway（多云 Provider） | 用户 opt-in | 按量付费 | Tier 1/2 不可用或质量不足时 |

**Tier 3 — Speech Gateway 架构**：
- 统一接口：`POST /v1/speech/transcribe`，输入短音频片段（≤ 20s）+ language hint
- 输出：文本 + 置信度 + 时间戳
- 隐私策略：**只在内存处理，立即丢弃，不落盘**
- Gateway 后端可挂多个 Provider（同时满足多云要求）：
  - AWS Transcribe（AWS）
  - Google Speech-to-Text（GCP）
  - Azure Speech（Azure）
- 附加能力：PII 脱敏提示（检测电话/地址/SSN）、敏感词提醒、速率限制、成本控制

**前端抽象**：
```typescript
interface VoiceToTextProvider {
  isAvailable(): Promise<boolean>;
  transcribe(audio: Blob, lang: 'en' | 'es' | 'zh'): Promise<TranscriptionResult>;
}
// 实现：NativeSpeechProvider → WebSpeechProvider → CloudSpeechProvider
```

**Consequences**:
- "能端侧就端侧，实在不行才云端，且用户可选择" → 与隐私优先产品定位完全一致
- 多云 Speech Provider 天然满足课程的 3 云要求
- 所有 Tier 都提供"语音 + 手动编辑"的 fallback（识别结果始终可编辑）
- MVP 先跑 Tier 1 + Tier 2，Tier 3 在匹配质量不满足时再接入

**Alternatives**:
- 只用 Web Speech API：简单但中文/西语质量可能不够
- 直接上 Whisper 自托管：质量好但增加服务器成本和运维负担
- 跳过语音：严重违背"低门槛"原则

---

## ADR-0009: Event naming convention — past tense
**Status**: Accepted

**Context**:
- P2P 事件和 API webhook 需要统一的命名规范
- 事件驱动系统中有两种常见命名：命令式（post.create）和事实式（post.published）

**Decision**:
- 所有事件类型使用过去式（表示已发生的事实）
- 完整列表：`post.published`, `post.updated`, `post.tombstoned`, `report.created`, `moderation.decision`, `announcement.published`

**Consequences**:
- 与 [07_P2P_Node_Design](./07_P2P_Node_Design.md) 和 [09_API_Spec](./09_API_Spec.md) 保持一致
- 清晰区分"命令"（API 请求）和"事件"（已发生的事实）

**Alternatives**:
- 命令式命名（`post.create`）：更简洁但语义不够清晰
- 混合命名：容易造成混乱
