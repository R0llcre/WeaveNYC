# WeaveNYC — Implementation Plan (Phased Execution Roadmap)

> 本文档用于 **排阶段、分时间、定产出**。当前 workspace 的 canonical baseline 以 `main = M4 completed` 为准；`feature/m5-anchor-admin` 已完成 M5 closeout，相关 branch-local 验收真值见 [26_M5_Closeout](./26_M5_Closeout.md)。

---

## 0) 怎么用这份计划

- `P0`、`M0` 已经完成，不再作为待排阶段。
- `M1`、`M2`、`M3`、`M4` 已完成；`M5` 已在当前分支完成 closeout；`M6` 仍是下一阶段可选项。
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
| `M2` 发帖与社区可见性 | Completed | 5-7 天 | 支持 Request/Offer 发布 | 发帖表单、Posts API、社区加入与 membership、可见性规则、生效的风控门槛、最小 review queue API、speech fallback | invite/QR join、生效的 Request/Offer gating、community/public/anchor_mediated visibility、manual moderation path、6-lane review gate 全部关闭 |
| `M3` 匹配与行动方案 | Completed | 4-6 天 | 对 Request 返回可行动方案并完成最小建联闭环 | 匹配服务、Top-3 结果页、一次刷新、官方资源兜底、解释标签、`contact_requests`、recipient inbox、accept/reject | 发布 request 后稳定得到 3 个建议；recipient 可在 app 内 accept/reject；accept 创建 conversation，后续聊天由 M4 接手 |
| `M4` 联系与聊天安全 | Completed | 5-7 天 | 把 accepted conversation 升级成真实聊天与安全闭环 | 会话列表、消息发送/读取、聊天页、举报/拉黑、敏感信息拦截、WebSocket realtime | 已接受的 request 可进入真实会话并收发消息；安全动作可用；6-lane review gate 关闭后进入 M5 |
| `M5` Anchor Admin + 试点准备 | Completed on branch | 5-7 天 | 管理后台和演示准备就绪 | Review Queue、公告、规则配置、种子数据、试点脚本、pilot rehearsal | Anchor activate/login、moderation、announcements、rules、dashboard、rehearsal、validation 和 6-lane review gate 全部关闭 |
| `M6` P2P 同步（仅在核心 MVP 完成后） | Optional next phase | 1-2 周 | 做课程加分项 | Edge opt-in、Anchor pin/index、同步恢复 | 两设备可跨节点看到同一帖子 |

> `M0-M5` 是 MVP critical path；`M6` 只在前面稳定后再排，不计入 MVP 必需项。

> 当前 `M5` 的 branch-local closeout / rehearsal 状态以 [`26_M5_Closeout.md`](./26_M5_Closeout.md) 为准；当前分支的 M5 closeout 已关闭，后续是否进入 `M6` 取决于下一轮排期。

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

### M2（Completed）：发帖 MVP（Request/Offer）

做什么：

- 接入已完成的匿名/verified 会话与社区加入
- 固定 `resolve -> join` 两步 community access
- 实现发帖表单、Posts API、我的帖子和社区 / public Feed
- 提供最小 review queue API 与 speech fallback，不等完整 Admin UI

阶段产出：

- 用户可创建/查看/编辑/关闭/软删除帖子
- 用户可先加入社区，再进入 community / public feed
- 社区可见性、高风险审核、manual moderation path 生效

进入下一阶段门槛：

- Invite code / QR 两条 community join 路径可用
- low / medium risk `request` 可由 anonymous member 发布
- verified `offer` 可发布，高风险帖子进入 `pending_review`
- `GET /v1/admin/review_queue` + `POST /v1/admin/review_queue/{post_id}/decision` 可清理待审帖子

### M3（Completed）：匹配引擎 + inbox 建联闭环

做什么：

- 实现 match service 和 match API
- 固定输出 Top-3 行动方案
- 永远包含官方资源兜底
- 在结果页展示解释标签
- `refresh=true` 只允许再拿 1 批新结果，不引入无限刷新
- 实现 `contact_requests`、recipient inbox、accept/reject 和 accepted conversation 创建
- 联系请求的最小通知先用 in-app inbox / pending request list / polling，不依赖 push infra

阶段产出：

- MatchSuggestions 数据
- Match Results 页面
- `refresh=true` 的一次“换一批”能力
- 联系请求在 app 内可见（badge / pending list / polling）
- `accept` / `reject` 幂等，`accept` 后得到 `conversation_id`

进入下一阶段门槛：

- 发布 Request 后 60 秒内出现 3 个方案
- 无邻里 Offer 时仍有官方资源结果
- 联系请求可在应用内被 recipient 看到，不依赖 push
- recipient 可在 app 内 accept / reject；`accept` 结果可被 M4 真实聊天直接消费

### M4（Completed）：聊天 + 反骚扰

做什么：

- 把 M3 的 accepted conversation 升级成真实会话
- 实现会话列表、消息发送、消息读取、实时同步
- 实现举报/拉黑、敏感信息拦截
- 在聊天层补齐安全动作与可追踪状态

阶段产出：

- Conversation / Message API
- Chat inbox / message thread UI
- Chat UI 与安全动作
- accepted request 到 real chat 的升级路径

进入下一阶段门槛：

- 已接受的 conversation 可直接进入真实聊天线程
- 会话建立后双方能实时聊天
- 拉黑和举报可用
- 敏感信息拦截可用

### M5（Week 5-6，已完成 branch closeout）：Anchor Admin MVP

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
- `M5`：Anchor Admin 与试点准备依赖前面的 auth / posts / matching / chat 稳定
- `M6`：只在 M5 稳定后再拉出支线，且不计入 MVP 主线容量

---

## 5) 任务分解（Backlog 摘要）

> 详细 user stories 见 [14_Backlog](./14_Backlog.md)。

当前执行起点：

- 如需继续推进，先确认是否先把当前 `M5` 分支合回 `main`，再评估是否值得启动 `M6`
- 不再继续把 `E0-M4` 这类已关闭阶段 story 当作当前待办
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
