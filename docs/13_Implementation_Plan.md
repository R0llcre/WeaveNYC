# WeaveNYC — Implementation Plan (Phased Execution Roadmap)

> 本文档用于 **排阶段、分时间、定产出**。当前仓库状态已经进入 `P0 completed / M0 completed / M1 pending`；`P0` 与 `M0` 在这里保留为已关闭阶段记录，真正的下一步只剩 `M1 official resource directory`。当前真值仍以 [00_Execution_Baseline](./00_Execution_Baseline.md) 和 [21_M0_Closeout](./21_M0_Closeout.md) 为准。

---

## 0) 怎么用这份计划

- `P0` 和 `M0` 已经完成，不再作为待排阶段。
- 当前执行从 `M1` 开始；`P0` 和 `M0` 只作为历史闭环记录保留。
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
| `M1` 官方资源目录 | Pending | 5-7 天 | 保证“零冷启动价值” | 资源导入脚本、`resource_providers` 表、搜索/详情 API、PWA 首页列表 | 输入 ZIP 能看到真实资源卡片 |
| `M2` 发帖与社区可见性 | Pending | 5-7 天 | 支持 Request/Offer 发布 | 发帖表单、Posts API、社区加入与 membership、可见性规则、生效的风控门槛 | 能先加入社区，再在同社区发布、查看、关闭帖子 |
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

### M1（Current Next Phase）：官方资源目录 MVP
做什么：
- 完成 OTP 升级与 refresh token rotation
- 完成 `resource_providers`、`resource_change_logs`、`verification_logs`
- 打通 CFC 导入、版本化、回滚和抽查记录
- 做 `GET /v1/resources` 和 `GET /v1/resources/{id}`
- 在 PWA 首页显示资源列表和详情

阶段产出：
- 匿名/已验证双层会话可用
- 可重复执行的数据导入脚本
- 可查询的官方资源目录
- 首页资源卡片和详情页

进入下一阶段门槛：
- 输入 `11735` 能稳定返回资源卡片
- OTP 升级与 refresh 行为可稳定通过
- 导入脚本可重复运行并生成 `dataset_version`

### M2（Week 2-3）：发帖 MVP（Request/Offer）
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

- `P0-M0`：已关闭，作为历史记录保留
- `M1-M3`：前端、后端、数据导入可以并行推进
- `M4-M5`：聊天安全、最小审核路径和 Anchor Admin 可以并行，但都依赖前面的 auth / posts / matching 稳定
- `M6`：只在 M5 稳定后再拉出支线，且不计入 MVP 主线容量

---

## 5) 任务分解（Backlog 摘要）
> 详细 user stories 见 [14_Backlog](./14_Backlog.md)。

当前执行起点：

- 从 `M1` 开始拉任务
- 不再继续把 `E0`、`E1-S1` 这类已关闭的 M0 foundation stories 当作当前待办
- 其余 auth / PWA platform story 是否已完成，一律以 [`14_Backlog.md`](./14_Backlog.md) 的当前状态标记为准

- Data ingestion
  - PDF parser
  - Normalizer
  - Geocoder（可选）

- Core services
  - Resource Directory
  - Community Membership
  - Posts
  - Matching
  - Moderation
  - Chat

- Frontend
  - Home
  - Post
  - Match results
  - Inbox
  - Community
  - Settings

- Anchor Admin
  - Login
  - Queue
  - Announcement
  - Rules

---

## 6) Demo 脚本（8-10 分钟）

> 目标：向评审展示”一个纽约移民居民从打开 App 到获得帮助”的完整体验，覆盖所有 MVP 核心功能。

### 开场白（30 秒）

“WeaveNYC 是一个面向纽约低收入和移民社区的隐私优先互助平台。纽约有超过 100 万居民面临食物不安全，Bronx 的儿童食物不安全率高达 33%。250 万 LEP 居民在现有平台上很难获得帮助。我们的目标是让他们在 1 分钟内找到可行动的帮助方案。”

（数据来源：[01_Vision §8](./01_Vision_And_Principles.md)）

### Scene 1：零冷启动 — 官方资源发现（1.5 分钟）

**操作**：
1. 打开 PWA（不注册）→ 选择语言 **中文**
2. 输入 ZIP `11735`（Farmingdale）
3. 首页展示”今天开放的资源”列表

**要展示的**：
- ⏱ TTFV（首次价值到达）≤ 10 秒
- 资源卡片：名称、地址、电话、开放时间、”今天开放”标签
- 一键导航（打开地图）、一键拨号
- **不需要注册**就能看到这些

**讲解要点**：
“官方资源目录是我们的'零冷启动'策略。即使还没有任何邻里用户，第一天就有价值。数据来源包括 CFC Active、Island Harvest 等公开目录。”

### Scene 2：发布互助请求 — 语音输入（2 分钟）

**操作**：
1. 点击”我需要帮助”
2. 选择类别 **Food**
3. 按住语音按钮说：”今晚缺晚餐，两个人份”
4. 语音转文字 → 编辑确认 → 提交

**要展示的**：
- 语音输入转文字（中文）
- 隐私等级选择：`community_only`（默认）/ `public` / `anchor_mediated`
- 风险提示条：”请不要分享 SSN、护照或银行信息”
- 提交后跳转到匹配结果页

**讲解要点**：
“语音输入对低识字率用户尤其重要。我们的三层降级策略（端侧 → Web Speech API → Cloud）确保语音始终可用。隐私等级默认为'仅社区可见'。”

### Scene 3：智能匹配 — 行动方案（1.5 分钟）

**操作**：
1. 提交后自动进入匹配结果页
2. 展示 3 个行动方案：
   - 方案 1：邻里 Offer（”有多余米饭和菜，今晚可分享”）
   - 方案 2：邻里 Offer（”超市刚买多了，可以匀你一些”）
   - 方案 3：官方资源（St. Kilian Parish pantry，今天开放）
3. 每个方案显示：匹配原因（距离 0.5mi / 语言匹配 / 今天开放）

**要展示的**：
- 默认 3 个方案（可点”换一批”加载更多，最多 6 个）
- 匹配可解释（不是黑盒分数）
- **官方资源永远兜底**（即使没有任何邻里 Offer）

**讲解要点**：
“匹配引擎综合考虑类别、语言、距离和时效。即使社区刚上线没有邻里帮助，官方资源也能保证每个请求至少有一个可行动的方案。”

### Scene 4：安全沟通（1 分钟）

**操作**：
1. 点选”邻里 Offer 1” → 点击”开始联系”
2. 进入聊天界面，显示预设快捷语句：
   - “我可以在 xx 时间提供帮助”
   - “我们在公共场所见面？”
3. 发送一条消息

**要展示的**：
- 双方都点击”开始联系”后才创建会话
- 聊天前不暴露对方的手机号/真实身份
- 预设安全提示语

**讲解要点**：
“聊天是双向同意制——双方都确认后才建立会话。默认匿名，保护双方隐私。”

### Scene 5：多语言切换（30 秒）

**操作**：
1. 切换语言到 **西班牙语**
2. 展示 UI 完全切换（包括资源目录、帖子、按钮）

**讲解要点**：
“NYC 有 200+ 种语言，我们 MVP 支持英语、西班牙语、中文——覆盖最大的三个语言群体。多语言是 Day 1 功能，不是后续补丁。”

### Scene 6：Anchor 管理后台（1.5 分钟）

**操作**（切换到 Anchor Admin 界面）：
1. 登录 Anchor 账号（展示 TOTP 二次验证）
2. 审核队列：一个 Transportation 请求待审核
3. 点击”通过” → 帖子对社区可见
4. 发布一条公告：”本周六 St. Kilian pantry 额外开放”

**要展示的**：
- 高风险类别（Transportation/Childcare）默认需审核
- 审核操作：通过 / 拒绝 / 要求补充
- 公告至少出现在社区首页 banner / in-app 列表；若 `E10` 已启用，再展示 push

**讲解要点**：
“社区自治是我们的核心原则。Anchor（社区组织）决定本社区的规则、审核标准和公告。平台只提供工具和最低安全底线。”

### Scene 7：隐私架构展示（30 秒）

**操作**：
1. 打开浏览器 DevTools → IndexedDB → 展示本地存储的数据
2. 指出：草稿、设置、密钥都在本地，未上传

**讲解要点**：
“默认本地存储是我们的隐私承诺。对于纽约 300 万移民——其中很多是无证或混合身份家庭——'数据不出设备'是使用这个平台的前提。”

### 收尾：技术亮点 + 竞品差异化（1 分钟）

“总结一下：
1. **比 NYC 311 更行动**——不是报告问题，而是匹配解决方案
2. **比 Nextdoor 更安全**——默认匿名、不追踪、不卖数据
3. **比 WhatsApp 群更高效**——结构化发布、智能匹配、不靠刷屏

技术上：全栈 TypeScript、Next.js PWA、6 个 Fastify 微服务、PostgreSQL + PostGIS、libp2p + IPFS 去中心化、三云部署（AWS + GCP + Azure）。

全部代码和文档在 GitHub：[repo URL]”

### Demo 环境准备清单

- [ ] 两台设备（或两个浏览器窗口）登录不同账号
- [ ] 种子数据已导入（官方资源 + 模拟帖子 + 模拟 Offer）
- [ ] Anchor 账号已创建，高风险帖子已就绪
- [ ] 网络稳定（如不稳定，准备离线模式演示作为 backup）
- [ ] 切换语言时确保所有翻译文件已加载
- [ ] Anchor Admin URL 已在第二个标签页打开

---

## 7) Done Definition（统一验收标准）
- 有单元测试或端到端测试覆盖关键路径
- 有日志与基本监控
- 文档更新：PRD/API/数据模型至少同步一次
- 安全：高风险类别有默认保护策略
