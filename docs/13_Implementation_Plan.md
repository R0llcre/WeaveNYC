# WeaveNYC — Implementation Plan (Phased Execution Roadmap)

> 本文档用于 **排阶段、分时间、定产出**。当前仓库状态已经进入 `P0 completed / M0 completed / M1 completed / M2 pending`；`P0-M1` 是已关闭阶段记录，当前真值仍以 [00_Execution_Baseline](./00_Execution_Baseline.md) 为准。

---

## 0) 怎么用这份计划

- `P0`、`M0` 已经完成，不再作为待排阶段。
- `M1` 已完成；当前应直接按 `M2` 分派时间和人力。
- 每个阶段都看 3 件事：做什么、阶段结束必须产出什么、满足什么门槛才能进入下一阶段。
- `14_Backlog.md` 是任务池；本文件负责决定“现在先做哪一批”。

---

## 1) 团队分工建议（2-3 人也能跑）

- Product/Full-stack A：前端（PWA）+ 体验 + 基础接口
- Backend B：API + DB + 匹配 + 风控规则
- Infra/Node C（可选）：P2P/IPFS + Anchor 节点 + 部署脚本

> 这份路线图按 **3 人目标节奏**排；如果只有 **2 人**，请把 `M5` 后半和 `M6` 视为顺延，不要把它们硬塞进 6 周主线。

---

## 2) 阶段总览

| 阶段 | 状态 | 建议时长 | 目标 | 阶段产出 | 进入下一阶段门槛 |
|------|------|----------|------|----------|------------------|
| `P0` 文档冻结 | Completed | 0.5-1 天 | 统一入口、命名、契约 | 基线文档、阶段计划、命名决策、无 P1 文档冲突 | README / Baseline / API / Data Model / Backlog 对齐 |
| `M0` 工程骨架 | Completed | 2-4 天 | 建立可协作的 monorepo skeleton | `apps/`、`services/`、`packages/`、`.env.example`、本地基础设施、`GET /healthz`、`GET /readyz`、CI stub | 新同学能按文档把项目拉起到“骨架运行”并看到 healthcheck |
| `M1` 官方资源目录 | Completed | 5-7 天 | 保证“零冷启动价值”并完成真实验证收口 | CFC + Island Harvest adapters、`GET /v1/resources*`、PWA 首页/详情/收藏、OTP/refresh/magic-link fallback、real API smoke、docs truth | 真实 API smoke、fixture browser smoke、manual live-source split 清楚，且 6-lane rereview 无 material findings |
| `M2` 发帖与社区可见性 | Pending | 5-7 天 | 支持 Request/Offer 发布 | 发帖表单、Posts API、社区加入与 membership、可见性规则、生效的风控门槛 | `M1` remediation 关闭后，能先加入社区，再在同社区发布、查看、关闭帖子 |
| `M3` 匹配与行动方案 | Pending | 4-6 天 | 对 Request 返回可行动方案 | 匹配服务、Top-3 结果页、官方资源兜底、解释标签 | 发布 request 后稳定得到 3 个建议 |
| `M4` 联系与聊天安全 | Pending | 5-7 天 | 建立双向同意联系与会话 | `contact_requests`、accept/reject、会话列表、聊天、举报/拉黑、最小审核队列 API / manual triage | 未同意前不建会话，已同意后可实时聊天；pending_review 可先被清理 |
| `M5` Anchor Admin + 试点准备 | Pending | 5-7 天 | 管理后台和演示准备就绪 | Review Queue、公告、规则配置、种子数据、试点脚本 | 能跑通完整 demo 和 pilot rehearsal |
| `M6` P2P 同步（仅在核心 MVP 完成后） | Optional | 1-2 周 | 做课程加分项 | Edge opt-in、Anchor pin/index、同步恢复 | 两设备可跨节点看到同一帖子 |

> `M0-M5` 是 MVP critical path；`M6` 只在前面稳定后再排，不计入 MVP 必需项。

---

## 3) 分阶段执行

### P0（Completed）：文档冻结与命名统一

做什么：

- 统一入口文档和阅读顺序
- 定死 auth、post DTO、contact flow、resource schema
- 定死工程骨架命名：`apps/anchor-admin`、`packages/shared`、Next.js App Router

阶段产出：

- `README.md` 可作为新人入口
- `00_Execution_Baseline.md` 可作为当前状态基线
- API / Data Model / DB Schema / Backlog 不再存在 P1 冲突

进入下一阶段门槛：

- 不再有“同一实体两种命名”或“同一接口两种行为”

### M0（Completed）：项目骨架可协作

做什么：

- 初始化 monorepo
- 建立 `apps/pwa`、`apps/anchor-admin`、`services/*`、`packages/shared`、`packages/db`
- 配置 TypeScript、ESLint、Prettier、基础 CI、Drizzle、Docker Compose
- 落匿名会话 endpoint、JWT middleware、healthcheck，形成最小 auth 闭环
- 落最小 `.env.example`、`infra/docker-compose.yml`、dev JWT keys，形成 bootstrap artifacts

阶段产出：

- 仓库结构真实存在
- 本地 PostgreSQL / Redis 可启动
- 至少一个前端 app 和一个 API stub 能启动
- `POST /v1/auth/anonymous` 和基础 JWT 守卫可用
- `GET /healthz` 和 `GET /readyz` 可用
- `.env.example`、dev JWT keys、docker compose 可用于本地 bootstrap
- 贡献指南里的 M0 命令第一次变成真实可执行

进入下一阶段门槛：

- 新同学按文档能完成安装、启动、healthcheck
- 匿名会话可签发 token，受保护路由可完成基础鉴权
- bootstrap artifacts 在仓库中可直接找到

### M1（Completed）：官方资源目录 MVP

做什么：

- 完成 OTP 升级、refresh token rotation、magic-link fallback
- 完成 `resource_providers`、`resource_change_logs`、`verification_logs`
- 打通 CFC + Island Harvest 导入、版本化、diff、live-source smoke
- 做 `GET /v1/resources` 和 `GET /v1/resources/{id}`
- 在 PWA 首页显示资源列表、详情、收藏和最小 verify 流程

阶段产出：

- 匿名/已验证双层会话可用，含 refresh / OTP / magic-link fallback
- 可重复执行的数据导入脚本和 live-source smoke
- 可查询的官方资源目录
- 首页资源卡片、详情页、收藏和 verify 页面

进入下一阶段门槛：

- 输入 `11735` 能稳定返回资源卡片
- OTP 升级、refresh、magic-link 行为可稳定通过
- real API smoke 与 fixture-backed browser smoke 的边界已清楚且默认 CI 可复现
- live-source smoke 仍保留为 manual / opt-in

### M2（Next Phase）：发帖 MVP（Request/Offer）

做什么：

- 接入已完成的匿名/verified 会话与社区加入
- 先完成 `invite code / QR -> community_members` 的加入链路，再放开 `community_only`
- 实现发帖表单、Posts API、我的帖子和社区 Feed
- 接入高风险类别默认审核

阶段产出：

- 用户可创建/查看/编辑/关闭帖子
- 用户可先加入社区，再进入社区 feed
- 社区可见性和高风险审核规则生效

进入下一阶段门槛：

- 能发布 Food Request 并在列表看到
- 能通过邀请码 / 二维码加入社区
- 高风险帖子进入 `pending_review`

### M3（Week 3-4）：匹配引擎 + 行动方案

做什么：

- 实现 match service 和 match API
- 固定输出 Top-3 行动方案
- 永远包含官方资源兜底
- 在结果页展示解释标签
- 联系请求的最小通知先用 in-app inbox / pending request list / polling，不依赖 push infra

阶段产出：

- MatchSuggestions 数据
- Match Results 页面
- `refresh=true` 的“换一批”能力
- 联系请求在 app 内可见（badge / pending list / polling）

进入下一阶段门槛：

- 发布 Request 后 60 秒内出现 3 个方案
- 无邻里 Offer 时仍有官方资源结果
- 联系请求可在应用内被 recipient 看到，不依赖 push

### M4（Week 4-5）：聊天 + 反骚扰

做什么：

- 实现 `contact_requests`
- 实现 accept/reject 后创建 conversation
- 实现消息发送、实时同步、举报/拉黑、敏感信息拦截
- 提供最小 moderation queue API / manual triage path，让 pending_review 可在 M5 前清理

阶段产出：

- Contact request 状态机
- Conversation / Message API
- Chat UI 与安全动作
- 最小审核路径可清理 pending_review 帖子

进入下一阶段门槛：

- 未接受前不创建 conversation
- 会话建立后双方能实时聊天
- 拉黑和举报可用
- pending_review 可通过 API/manual path 被处理，而不必等完整 UI

### M5（Week 5-6）：Anchor Admin MVP

做什么：

- 实现 Anchor 激活 / 登录 / TOTP
- 实现 Review Queue UI、公告、规则配置
- 准备 demo 脚本、种子数据、试点演示环境

阶段产出：

- 管理后台核心页面
- 高风险审核闭环
- 可排练的 demo 环境

进入下一阶段门槛：

- Transportation / Childcare 默认进入审核
- Anchor 审核通过后用户端状态正确更新

### M6（Week 6+）：P2P 同步（可作为加分项，非 MVP critical path）

做什么：

- Edge opt-in 到 Helia / IPFS
- Anchor pin / index / replay
- 提供 `community bootstrap` API 作为 Anchor discovery 的默认入口；`mDNS` 只作为实验性补充，不作为默认依赖
- 基础冲突解决和离线恢复

阶段产出：

- Edge 发布到 P2P
- Anchor 可见和恢复同步
- 通过 bootstrap API 能拿到 Anchor 节点 / seed 信息
- 课程加分演示路径

进入下一阶段门槛：

- 仅在 M0-M5 核心路径稳定后才进入
- 两台设备能通过 Anchor 看到同一个帖子

---

## 4) 并行策略（2-3 人团队）

- `P0-M1`：已关闭，作为历史记录保留
- `M2-M3`：前端、后端、数据结构和流程规则可以并行推进
- `M4-M5`：聊天安全、最小审核路径和 Anchor Admin 可以并行，但都依赖前面的 auth / posts / matching 稳定
- `M6`：只在 M5 稳定后再拉出支线，且不计入 MVP 主线容量

---

## 5) 任务分解（Backlog 摘要）

> 详细 user stories 见 [14_Backlog](./14_Backlog.md)。

当前执行起点：

- 从 `M2` 开始拉任务
- 不再继续把 `E0-M1` 这类已关闭阶段 story 当作当前待办
- 其余 auth / PWA platform story 是否已完成，一律以 [`14_Backlog.md`](./14_Backlog.md) 的当前状态标记为准

- Core services
  - Community Membership
  - Posts
  - Matching
  - Moderation
  - Chat

- Frontend
  - Post compose
  - Community feed
  - Match results
  - Inbox
  - Settings

- Anchor Admin
  - Login
  - Queue
  - Announcement
  - Rules
