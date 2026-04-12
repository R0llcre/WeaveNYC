# WeaveNYC — Product & Engineering Backlog

> 结构：Epic → Story → Acceptance Criteria → Story Points (SP)
>
> **Story Points 参考**：1 SP ≈ 半天（1 人），2 SP ≈ 1 天，3 SP ≈ 1.5 天，5 SP ≈ 2-3 天，8 SP ≈ 一周
>
> **优先级**：P0（上线必须）、P1（强烈推荐）、P2（后续迭代）
>
> **里程碑对照**：M0-M6 对应 [13_Implementation_Plan](./13_Implementation_Plan.md)
>
> **当前 canonical baseline**：`main = M2 completed`
>
> **Branch closeouts**：`feature/m4-chat-safety = M3 completed on branch` · `M4 completed on branch`
>
> **当前阶段状态**：`P0 completed` · `M0 completed` · `M1 completed` · `M2 completed` · `M5 pending`
>
> **状态标记**：
> - `Completed (M0)`：已经落地，不再作为当前待办
> - `Completed (M1)`：代码已落地；如 phase closeout 被重新打开，仍需以 `22_M1_Closeout.md` 为准
> - `Completed (M2)`：代码与 closeout 已落地，并已成为当前 workspace 的已关闭基线；不再表示“当前 feature branch 待合并状态”
> - `Pending (M1+)`：保留在后续阶段继续实现
>
> 说明：`Completed (M1)` / `Completed (M2)` 都表示“实现与对应 closeout 已完成”；M3/M4 的实现状态只作为 branch closeout 记录，不改变 main baseline。当前阶段真值统一以 [`00_Execution_Baseline.md`](./00_Execution_Baseline.md) 为准。

---

## Epic E0: Project Foundation（项目骨架）— Status: `Completed (M0)`

> 里程碑：M0（Day 1-3）
> 目标：monorepo 可跑、CI 通过、dev 环境可部署

### E0-S1: Initialize monorepo with pnpm workspace — P0 · 3 SP · `Completed (M0)`

- As a developer, I can `pnpm install` and `pnpm dev` to start the entire project.
- Acceptance:
  - monorepo 结构：`apps/pwa`、`apps/anchor-admin`、`services/*`、`packages/shared`
  - `pnpm dev` 同时启动前端（Next.js）和后端（Fastify stub）
  - TypeScript strict mode、ESLint、Prettier 配置就绪
  - `.env.example` 包含所有必要变量
  - `infra/docker-compose.yml` 存在且可启动 PostgreSQL + Redis
  - `infra/dev/jwt-private.pem`、`infra/dev/jwt-public.pem` 或等价的 dev key bootstrap 产物存在

### E0-S2: CI/CD pipeline setup — P0 · 3 SP · `Completed (M0)`

- As a developer, I can push to `main` and trigger automated lint + test + build.
- Acceptance:
  - GitHub Actions workflow：lint → typecheck → test → build
  - PR 合并需通过所有 checks
  - Docker compose 本地开发环境可启动（PostgreSQL + Redis）
  - 从全新 checkout 按 Contribution Guide 执行一次 bootstrap：`pnpm install` → `docker compose up -d` → `pnpm db:migrate` → `pnpm db:seed` → `pnpm dev`

### E0-S3: Database migration infrastructure — P0 · 2 SP · `Completed (M0)`

- As a developer, I can run `pnpm db:migrate` to apply schema changes.
- Acceptance:
  - Drizzle ORM 配置就绪，连接 PostgreSQL
  - 初始 migration 创建所有基础表（参考 [20_DB_Schema_Reference](./20_DB_Schema_Reference.md)）
  - Seed 脚本可导入测试数据
  - `pnpm db:migrate` 和 `pnpm db:seed` 被纳入 M0 bootstrap 验证，而不是只作为独立脚本存在

### E0-S4: Shared packages setup — P0 · 2 SP · `Completed (M0)`

- As a developer, I can import shared types and utilities from `@weavenyc/shared`.
- Acceptance:
  - `packages/shared` 包含：TypeScript 类型定义（User, Post, Resource 等枚举）
  - `packages/shared/validators` 包含 Zod schema（前后端共用校验）
  - 所有 apps/services 可正确 import

---

## Epic E1: Authentication & Identity（认证与身份）— Status: `Completed (M1)`

> 里程碑：M0-M1
> 来源：[18_Auth_Design](./18_Auth_Design.md) + [09_API_Spec §1](./09_API_Spec.md)

### E1-S1: Anonymous session endpoint — P0 · 2 SP · `Completed (M0)`

- As a guest, I can get a JWT without any registration so I can browse and interact.
- Acceptance:
  - `POST /v1/auth/anonymous` → 返回 `{ access_token, refresh_token, user }`
  - JWT payload 包含 `user_id`、`level: "anonymous"`、`exp`（15min）
  - refresh_token 有效期 7 天
  - 数据库创建 `users` 记录（`level = anonymous`）

### E1-S2: OTP phone verification — P0 · 3 SP · `Completed (M1)`

- As an anonymous user, I can verify my phone number to upgrade to L2 Verified.
- Acceptance:
  - `POST /v1/auth/otp/start` → 生成 6 位 OTP，存入 Redis（TTL 5min），通过 provider abstraction 发送；本地默认 stub provider
  - `POST /v1/auth/otp/verify` → 验证 OTP → 更新 user level 为 `verified`
  - 存储 `phone_hash`（SHA-256 + salt），**不存储**明文手机号
  - 签发新 JWT（level: verified）
  - 错误处理：OTP 过期、5 次错误后 challenge 失效
  - 本地开发可通过 demo code 跑通 verify，不依赖真实短信供应商

### E1-S3: Token refresh with rotation — P0 · 2 SP · `Completed (M1)`

- As a logged-in user, my session stays active through automatic token refresh.
- Acceptance:
  - `POST /v1/auth/refresh` → 验证旧 refresh_token → 签发新 access + refresh token
  - 旧 refresh_token 立即失效（rotation）
  - 检测 refresh_token 重放攻击 → 撤销该用户 refresh family

### E1-S3b: Magic-link fallback verification — P0 · 2 SP · `Completed (M1)`

- As an anonymous user, I can fall back to a magic link when SMS is not available.
- Acceptance:
  - `POST /v1/auth/magic-link/start` 和 `POST /v1/auth/magic-link/verify` 已可用
  - challenge 存 Redis，TTL 有效，服务端只持久化 `email_hash`
  - 本地开发默认使用 stub email-link provider，demo token / URL 可读

### E1-S4: JWT middleware and RBAC — P0 · 2 SP · `Pending (M2+)`

- As a developer, all protected endpoints automatically validate JWT and enforce role checks.
- 当前备注：M0 已经落地 JWT 验证和受保护路由样板；完整 `requireLevel(...)` RBAC helper 和角色守卫仍待补齐。
- Acceptance:
  - Fastify 插件：解析 JWT RS256、注入 `req.user`
  - 权限守卫：`requireLevel("anonymous" | "verified" | "anchor")`
  - 未授权请求返回 401，权限不足返回 403

### E1-S5: Anchor admin invitation flow — P1 · 3 SP · `Pending (M5)`

- As a verified user, I can use an Anchor invitation code + setup TOTP to become L3 Admin.
- Acceptance:
  - `POST /v1/auth/anchor/activate` → 验证邀请码 → 绑定 TOTP secret
  - 后续 Anchor 登录强制 TOTP 二步验证
  - Anchor 绑定到具体 `community_id`

---

## Epic E2: Official Resource Directory（官方资源目录）— Status: `Completed (M1)`

> 里程碑：M1（Week 1-2）
> 来源：[02_PRD §5.2](./02_PRD.md) + [04_Data_Sources](./04_Data_Sources.md)

### E2-S1: Data ingestion — CFC Active dataset — P0 · 5 SP · `Completed (M1)`

- As an admin, I can import the CFC Active Food Pantry dataset and create a versioned snapshot.
- Acceptance:
  - 解析真实 CFC Active PDF → 标准化字段（name, address, phone, hours_json, zip, lat, lng）
  - 创建 `dataset_version` 记录（导入时间、记录数、来源），作为可回滚的导入批次元数据
  - Diff 报告：显示新增 / 修改 / 删除的记录数
  - 地理编码：address → lat/lng（Nominatim，失败后回退 ZIP centroid）
  - `geo_precision` 标注：`exact | rooftop | street | zip_centroid`
  - 脚本可重复执行（幂等）
  - 同一 `source + source_ref` 任一时刻只保留一个 `active` 版本，回滚后旧版本可恢复 active

### E2-S2: Data ingestion — Island Harvest multi-source merge — P1 · 3 SP · `Completed (M1)`

- As an admin, I can import multiple official data sources and merge them into a unified directory.
- Acceptance:
  - 支持 CFC Active + Island Harvest 两种真实来源
  - 合并策略：`normalized_address + zip` 去重
  - 字段优先级：CFC 对 `name/type/address/hours` 优先，Island Harvest 补缺失字段或新增地址
  - `source` 字段标注数据来源

### E2-S3: Resource search API — P0 · 3 SP · `Completed (M1)`

- As a user, I can search resources by ZIP code with filters.
- Acceptance:
  - `GET /v1/resources?zip=11735&open_now=true&type=pantry&limit=20`
  - 按距离排序（PostGIS `ST_Distance`）
  - 支持筛选：`open_now`（按当前星期/时间匹配 hours_json）、`type`（pantry / soup_kitchen / cooling_center）
  - 返回 ≤ 50 条结果，分页支持 `cursor`
  - 响应时间 p95 ≤ 2s

### E2-S4: Resource detail API — P0 · 1 SP · `Completed (M1)`

- As a user, I can view the full detail of a resource.
- Acceptance:
  - `GET /v1/resources/:id` → 完整字段（name, address, phone, hours, lat, lng, notes）
  - 包含"今天是否开放"的计算字段 `is_open_today`

### E2-S5: Resource list page (PWA) — P0 · 3 SP · `Completed (M1)`

- As a user, I can see a list of nearby resources on the home page.
- Acceptance:
  - 输入 ZIP 后 ≤ 10 秒加载出资源卡片列表
  - 卡片展示：名称、地址（截断）、电话、"今天开放" badge
  - 筛选 pills：Open Now / Pantry / Soup Kitchen / All
  - 空状态："No resources found for this ZIP"

### E2-S6: Resource detail page (PWA) — P0 · 2 SP · `Completed (M1)`

- As a user, I can view a resource's details and take action.
- Acceptance:
  - 详情页显示：名称、完整地址、电话、开放时间表、备注
  - 一键拨号按钮（`tel:` link）
  - 一键导航按钮（打开 Google Maps / Apple Maps）
  - 缺失字段显示"暂无信息"而非崩溃

### E2-S7: Resource bookmark (PWA) — P1 · 2 SP · `Completed (M1)`

- As a user, I can bookmark resources for quick access later.
- Acceptance:
  - 收藏存储在 IndexedDB（Dexie.js），无需登录
  - 首页"我的收藏"快捷入口
  - 已收藏资源显示实心星标

---

## Epic E3: Mutual Aid Posting（互助发布）— Status: `Completed (M2)`

> 里程碑：M2（Week 2-3）
> 来源：[02_PRD §5.3](./02_PRD.md)

### E3-S0: Community join and membership bootstrap — P0 · 3 SP · `Completed (M2)`

- As a user, I can join a community with an invite code or QR so community-only content becomes available.
- Acceptance:
  - `POST /v1/community-access/resolve` 接受 `invite_code` 或 `qr_token`
  - resolve 返回绑定当前 user / community 的 `join_token`
  - `POST /v1/communities/:community_id/join` 消费 `join_token`
  - 创建或复用 `community_members` 关系，且对重复加入保持幂等
  - 当前 community 会写入本地 session / profile context
  - `community_only` 帖子和社区 feed 在 membership 存在前保持隐藏
  - Join 入口可从 Onboarding、Community Home 或 Settings 进入

### E3-S1: Create post API — P0 · 3 SP · `Completed (M2)`

- As a user (L1+), I can create a Request or Offer post.
- Acceptance:
  - `POST /v1/posts` → 创建帖子
  - 必填字段校验：`community_id`、`post_type`、`category`、`title`、`body`、`location_zip`
  - 默认值：`privacy = community_only`、`expires_at = now + 24h`
  - 发帖前必须已有 `community_id` membership
  - low / medium risk `request`：anonymous member 可直接发布
  - `offer` 和 high-risk `request` / `offer`：要求 verified
  - `risk_level` 自动计算：Childcare / Transportation → high；其他 → low/medium
  - high-risk 帖子 `status = pending_review`；low-risk 直接 `status = active`

### E3-S2: Post CRUD API (list/detail/update/close) — P0 · 3 SP · `Completed (M2)`

- As a user, I can view, edit, and close my posts.
- Acceptance:
  - `GET /v1/posts?scope=community&community_id=...&status=active&category=food` → 分页列表
  - `GET /v1/posts/:id` → 帖子详情
  - `GET /v1/posts/mine` → 我的帖子列表
  - `PATCH /v1/posts/:id` → 仅 owner 可编辑（active/pending_review 状态）
  - `POST /v1/posts/:id/close` → 关闭帖子（status → closed），退出匹配池
  - `DELETE /v1/posts/:id` → 软删除（status → removed）
  - 权限：owner 可编辑/关闭/删除；Anchor 走 review queue decision

### E3-S3: Post compose page (PWA) — P0 · 3 SP · `Completed (M2)`

- As a user, I can fill out and submit a mutual aid post.
- Acceptance:
  - 表单字段：类型（Request/Offer）、类别下拉、描述文本框（≤ 280 字）、ZIP、有效期、隐私等级
  - 风险提示条：描述框上方 "请不要分享 SSN、护照或银行信息"
  - 第一次发帖允许先创建匿名会话，再继续；提交前若缺少 membership 或 verified 身份，则先导向 join / OTP
  - `Request` 发布后直接进入 `/posts/:postId/matches`
  - `Offer` 发布后进入帖子详情 / 发布结果页
  - 离线时自动保存草稿到 IndexedDB

### E3-S4: Voice-to-text input — P1 · 5 SP · `Completed (M2)`

- As a user, I can speak instead of typing to describe my request.
- Acceptance:
  - Tier 1：尝试端侧 Speech Recognition（`SpeechRecognition` Web API）
  - Tier 2：用户可触发音频上传 fallback 到 `POST /v1/speech/transcribe`
  - 支持语言：en、es、zh
  - 识别结果填入描述框，用户可手动编辑
  - 用户可选择不使用语音（纯键盘输入）
  - 音频不持久化存储

### E3-S5: My posts page (PWA) — P0 · 2 SP · `Completed (M2)`

- As a user, I can see and manage all my posts.
- Acceptance:
  - "我的发布"页面：按状态分组（active / pending / closed / fulfilled）
  - 每条帖子可执行：编辑（draft/active）、关闭、删除
  - 显示匹配数量 badge

### E3-S6: Community feed page (PWA) — P0 · 3 SP · `Completed (M2)`

- As a user, I can browse active posts in my community.
- Acceptance:
  - 按时间倒序展示同社区 active 帖子
  - 分类筛选 pills（Food / Goods / Childcare / ...）
  - 帖子卡片：类型 badge、类别、描述截断、ZIP、剩余时间
  - 点击进入帖子详情

---

## Epic E4: Matching Engine（匹配引擎）— Status: `Completed (M3)`

> 里程碑：M3（Week 3-4）
> 来源：[02_PRD §5.4](./02_PRD.md)

### E4-S1: Match computation service — P0 · 5 SP · `Completed (M3)`

- As the system, I compute Top-3 action plans for each active Request.
- Acceptance:
  - 触发时机：帖子变为 active 时自动执行
  - 候选池固定为：同社区、`active`、未过期、非 `anchor_mediated` 的 Offer
  - 匹配维度（加权评分）：
    - 类别相同（必须）
    - 距离（PostGIS `ST_DWithin`，≤ 5 miles 优先）
    - 语言匹配（+20% 权重）
    - 时效性（expires_at 未过期）
    - 信任度（verified > anonymous；只有候选帖子已存在 Anchor review 信号时才显示 `anchor_reviewed`）
  - 输出 Top-3：优先 1-2 个邻里 Offer + 至少 1 个官方资源（**永远兜底**）
  - 无邻里 Offer 时：返回 3 条官方资源（按距离 + 开放状态排序）
  - `MatchSuggestion` 记录写入数据库，包含 `score` 和 `reasons[]`

### E4-S2: Match results API — P0 · 2 SP · `Completed (M3)`

- As a user, I can retrieve match suggestions for my post.
- Acceptance:
  - `GET /v1/posts/:id/matches` → 返回 Top-3 suggestions
  - 每个 suggestion 包含：`candidate_type`、候选详情、`score`、`reasons[]`（人类可读）
  - 支持"换一批"：`GET /v1/posts/:id/matches?refresh=true`（最多 1 次，累计 ≤ 6 个不同方案）
  - 超过 refresh 预算后继续返回当前批次，不再扩张结果集

### E4-S3: Match results page (PWA) — P0 · 3 SP · `Completed (M3)`

- As a user, I can see 3 action plans after posting a request.
- Acceptance:
  - 卡片式展示 3 个方案：
    - 邻里 Offer 卡片：描述、距离、语言匹配度、"开始联系"按钮
    - 官方资源卡片：名称、地址、今日开放、"导航/拨号"按钮
  - 每张卡片显示匹配原因标签（"0.5 mi away"、"语言匹配"、"今天开放"）
  - "换一批"按钮（最多 1 次）
  - p95 ≤ 60 秒内展示结果

### E4-S4: Contact initiation flow — P0 · 2 SP · `Completed (M3)`

- As a user, I can initiate contact with a matched neighbor.
- Acceptance:
  - `POST /v1/match/contact` → 仅 `verified` 用户可向对方发送联系请求
  - `anonymous` 用户点击"开始联系"时：先触发 OTP / magic link 升级流程
  - 对方在 app 内的 pending request / inbox badge 中看到联系请求；push 通知留给后续 `E10`
  - 接口只创建 / 复用 `contact_request`；不会直接创建真实聊天线程
  - 若该联系请求此前已被接受，接口可返回已有的 `conversation_id`
  - 未确认前不暴露任何个人信息

### E4-S5: Pending request inbox + accept/reject — P0 · 4 SP · `Completed (M3)`

- As a user, I can see incoming contact requests and act on them before the live chat thread opens.
- Acceptance:
  - inbox / pending request list can surface unread contact requests
  - client can poll or refresh to pick up new contact requests
  - `POST /v1/contact-requests/:id/accept` / `reject` 都是幂等的
  - `accept` 后返回同一个 `conversation_id`
  - `reject` 后该请求进入终态，不再出现在 pending inbox 中
  - `E10` 的 push infrastructure 仍然是后续增强，不阻塞 M3

---

## Epic E5: Chat & Communication（聊天与沟通）— Status: `Completed (M4)`

> 里程碑：M4（Week 4-5）
> 来源：[02_PRD §5.5](./02_PRD.md) + [09_API_Spec §5](./09_API_Spec.md)

### E5-S1: Conversation & Message API — P0 · 3 SP · `Completed (M4)`

- As a user, I can send and receive messages in a conversation.
- Acceptance:
  - M3 的 accepted conversation 会话可直接进入真实聊天会话
  - `GET /v1/conversations` → 我的会话列表（按 `last_activity_at` 排序）
  - `POST /v1/conversations/:id/messages` → 发送消息
  - `GET /v1/conversations/:id/messages?cursor=...` → 分页获取消息
  - `POST /v1/conversations/:id/close` → 关闭会话

### E5-S2: Real-time WebSocket messaging — P0 · 5 SP · `Completed (M4)`

- As a user, I can receive messages in real-time without refreshing.
- Acceptance:
  - WebSocket 连接：`GET /v1/ws/chat?token=...`（由现有 API gateway 提供）
  - 消息通过 Redis Pub/Sub 分发到对方连接
  - 在线时实时接收；离线时消息持久化到 DB，下次上线投递
  - 心跳检测（30s interval），断线自动重连

### E5-S3: Safety detection in chat — P0 · 3 SP · `Completed (M4)`

- As the system, I detect sensitive personal information in messages before delivery.
- Acceptance:
  - 正则 + 规则引擎检测：SSN 格式、完整电话号码、完整地址、银行账号
  - 检测到后：阻断发送，向发送者显示警告"检测到个人信息，建议删除后重新发送"
  - 不记录被拦截消息的具体内容（隐私）
  - 关键词黑名单可由 Anchor 配置

### E5-S4: Chat inbox page (PWA) — P0 · 3 SP · `Completed (M4)`

- As a user, I can see all my conversations in an inbox.
- Acceptance:
  - 会话列表：对方昵称（或匿名标识）、最后一条消息预览、时间、未读 badge
  - 点击进入聊天详情页
  - 预设快捷语句按钮（多语言）：
    - "我可以在 xx 时间提供帮助"
    - "我们在公共场所见面？"
    - "请不要分享个人证件信息"

### E5-S5: Block and report in chat — P0 · 2 SP · `Completed (M4)`

- As a user, I can block and/or report the other person in a conversation.
- Acceptance:
  - 屏蔽后：双方互不可见，不能发消息，会话标记为 blocked
  - 举报入口：选择原因 → 提交到审核队列
  - 屏蔽/举报操作不可逆（MVP 不支持解除屏蔽）

---

## Epic E6: Trust & Safety — Reports & Moderation（安全与治理）

> 里程碑：M4-M5
> 来源：[02_PRD §5.6](./02_PRD.md) + [10_Security](./10_Security_Privacy_Threat_Model.md)

### E6-S0: Minimal moderation queue API / manual triage — P0 · 2 SP · `Completed (M2)`

- As an Anchor admin or ops user, I can clear `pending_review` posts before the full admin UI exists.
- Acceptance:
  - `GET /v1/admin/review_queue?community_id=...` 能列出待审帖子
  - `POST /v1/admin/review_queue/{post_id}/decision` 可通过 API、Swagger 或内部手动脚本使用
  - `pnpm dev:mint-anchor-token` 可生成非生产环境 anchor bearer token
  - 不要求独立 Web UI；先保证 pending_review 能在 M5 前被清理
  - 处理结果写入 `ModerationAction` 审计记录

### E6-S1: Report submission API — P0 · 2 SP · `Completed (M4)`

- As a user, I can report a post, user, or message.
- Acceptance:
  - `POST /v1/reports` → `{ target_type, target_id, reason, conversation_id?, evidence_description? }`
  - `reason` 枚举：`harassment | scam | misinformation | unsafe_behavior | other`
  - 创建 `Report` 记录（status = new）
  - 自动关联到 target 所属 community → 进入该 Anchor 的审核队列

### E6-S2: Auto risk assessment — P0 · 3 SP

- As the system, I auto-flag high-risk content before it goes live.
- Acceptance:
  - 发帖时关键词扫描：SSN 格式、护照号、银行卡号 → 阻断提交 + 提示
  - 高风险类别（Childcare / Transportation）自动 `status = pending_review`
  - 累计举报 ≥ threshold（由 `RuleSet.report_threshold` 配置）→ 自动下架待审
  - 风险评估日志可审计

### E6-S3: Moderation queue API — P0 · 3 SP

- As an Anchor admin, I can review and act on reported/flagged content.
- Acceptance:
  - `GET /v1/admin/review_queue?community_id=...&cursor=...` → M2 先覆盖待审核帖子（按时间排序）
  - `POST /v1/admin/review_queue/{post_id}/decision` → `{ decision: "approve" | "reject" | "request_more_info", notes?: string }`
  - 每个操作创建 `ModerationAction` 审计记录（actor, timestamp, decision, reason）
  - 处理后至少在 app 内更新相关状态（review queue / inbox badge / detail state）；push 通知留给后续 `E10`

### E6-S4: Witness verification (basic) — P1 · 2 SP

- As a requester, I can confirm I received help to verify a match.
- Acceptance:
  - `POST /v1/posts/:id/verify` → requester 确认"已收到帮助"
  - 可选：Anchor 或第三方见证人附加确认
  - 状态变为 `fulfilled` + `verification_state = verified_by_anchor | verified_by_witnesses`
  - 触发双方信誉积累（MVP 仅记录，不展示）

---

## Epic E7: Anchor Admin Console（管理后台）

> 里程碑：M5（Week 5-6）
> 来源：[02_PRD §5.7](./02_PRD.md)

### E7-S1: Anchor login with TOTP MFA — P0 · 2 SP

- As an Anchor admin, I can log in with my credentials + TOTP.
- Acceptance:
  - 登录页面：手机号/邮箱 + OTP → TOTP 二步验证
  - 登录后 JWT 包含 `level: "anchor"`、`community_id`
  - 会话超时：4 小时无操作自动登出

### E7-S2: Review queue page — P0 · 3 SP

- As an Anchor admin, I can review pending posts and reports.
- Acceptance:
  - 两个 tab：待审核帖子 / 待处理举报
  - 优先级标签：P0（4h）/ P1（24h）/ P2（72h）
  - 操作按钮：通过 / 拒绝（需填原因）/ 要求补充信息
  - 操作后实时反映到用户端（≤ 1 分钟）

### E7-S3: Announcement publishing — P0 · 2 SP

- As an Anchor admin, I can publish announcements to my community.
- Acceptance:
  - `POST /v1/communities/:id/announcements` → `{ title, body }`
  - 无论是否启用 `E10`，公告都必须出现在社区首页 banner / in-app 列表
  - 若 `E10` 已启用，再补 push 通知到社区成员
  - 公告列表页：按时间倒序，支持编辑/删除

### E7-S4: Community rule configuration — P1 · 3 SP

- As an Anchor admin, I can configure moderation rules for my community.
- Acceptance:
  - 可配置项：
    - 哪些类别需要审核（checkboxes）
    - 举报阈值（自动下架的举报数量）
    - 关键词黑名单
    - 社区语言偏好
  - 变更保存到 `RuleSet` 表
  - 变更生效无需重启

### E7-S5: Admin dashboard (basic) — P1 · 3 SP

- As an Anchor admin, I can see basic community metrics.
- Acceptance:
  - 卡片式看板：
    - 本周帖子数（Request / Offer 分开）
    - 本周匹配成功数
    - 本周举报数
    - 待审核数量（实时）
  - 数据来自 API 聚合（无需专门 analytics 服务）

---

## Epic E8: Localization & Accessibility（多语言与无障碍）

> 里程碑：M1-M5（贯穿全程）
> 来源：[02_PRD §6.5-6.7](./02_PRD.md)

### E8-S1: i18n framework setup (next-intl) — P0 · 2 SP · `Completed (M1)`

- As a developer, I can use `t("key")` to render translated strings.
- Acceptance:
  - `next-intl` 集成到 Next.js App Router
  - 翻译文件：`locales/en.json`、`locales/es.json`、`locales/zh.json`
  - 语言选择器组件（首次打开 + Settings 页面）
  - 默认跟随系统语言（`navigator.language`）

### E8-S2: Complete translation for all UI strings — P1 · 5 SP

- As a user, I can use the entire app in English, Spanish, or Chinese.
- Acceptance:
  - 所有 UI 文案覆盖 3 种语言（包括错误消息、空状态、按钮、标签）
  - 帖子 UGC 显示原始语言（不翻译）
  - 匹配优先推送同语言 Offer

### E8-S3: Accessibility compliance (WCAG 2.1 AA) — P1 · 3 SP

- As a user with accessibility needs, I can use all core features.
- Acceptance:
  - 字体 ≥ 16px，可放大到 24px
  - 对比度 ≥ 4.5:1
  - 触控目标 ≥ 44×44px
  - 语义化 HTML（`<nav>`、`<main>`、`<button>`）
  - 所有交互元素有 `aria-label`
  - 键盘可完成所有核心功能
  - Lighthouse Accessibility ≥ 90

### E8-S4: Low bandwidth mode — P1 · 2 SP

- As a user on a limited data plan, I can use a lightweight version of the app.
- Acceptance:
  - 设置中"低流量模式"开关
  - 开启后：禁用图片加载、减少字体文件、API 请求压缩
  - 首屏包体 ≤ 200KB（gzip）

---

## Epic E9: PWA Infrastructure（PWA 基础设施）— Status: `In Progress`

> 里程碑：M0-M1
> 来源：[06_Blueprints](./06_Blueprints.md) + [02_PRD §6](./02_PRD.md)

### E9-S1: PWA manifest and service worker — P0 · 2 SP · `Pending (M2+)`

- As a user, I can install WeaveNYC as a PWA on my home screen.
- 当前备注：M0 已经落地 manifest、icon 和 service worker shell wiring；完整离线资源列表体验仍待资源目录完成后补齐。
- Acceptance:
  - `manifest.json` 配置：name, icons, theme_color, display: standalone
  - Service Worker：缓存静态资源 + API 响应（stale-while-revalidate）
  - 离线时显示缓存的首页资源列表（graceful degradation）

### E9-S2: IndexedDB local persistence (Dexie.js) — P0 · 3 SP · `Completed (M1)`

- As a user, my preferences, bookmarks, and local session survive reloads without server sync.
- Acceptance:
  - Dexie.js 提供本地持久化存储
  - 语言偏好、ZIP、low-bandwidth、bookmarks、匿名/verified session 可持久化
  - bookmark 刷新后仍存在
  - 不要求在 M1 完成 drafts / device_keys

### E9-S3: Redux Toolkit + TanStack Query setup — P0 · 2 SP · `Completed (M1)`

- As a developer, I have a consistent state management pattern.
- 当前备注：M1 已落地 `auth` / `preferences` slice 和资源 / verify / refresh query hooks；更完整的 `community` / `ui` slice 与 DevTools 集成留到后续阶段。
- Acceptance:
  - Redux Toolkit store：`auth`、`preferences`
  - TanStack Query：`useResources`、`useResource`、`useOtpStart`、`useOtpVerify`、`useMagicLinkStart`、`useMagicLinkVerify`、`useRefreshSession`
  - 资源查询已采用 stale cache
  - DevTools 集成可留到后续阶段

### E9-S4: Onboarding flow — P0 · 2 SP · `Completed (M1)`

- As a first-time user, I can set up the app in under 30 seconds.
- Acceptance:
  - 步骤：语言选择 → ZIP 输入 → 首页
  - 不强制注册，直接显示官方资源
  - 隐私提示："默认匿名，不采集精确位置"
  - ZIP 校验：无效 ZIP 给出可纠正提示

---

## Epic E10: Notification Service（通知服务）

> 里程碑：M4-M5
> 来源：[09_API_Spec §7](./09_API_Spec.md)

### E10-S1: Push notification infrastructure — P1 · 3 SP

- As a user, I receive push notifications for important events.
- Acceptance:
  - Web Push API（VAPID keys）集成
  - 通知类型：新匹配、新消息、联系请求、Anchor 公告
  - 用户可在设置中开关每类通知
  - Azure Functions 处理通知分发

### E10-S2: In-app notification feed — P1 · 2 SP

- As a user, I can see a list of recent notifications.
- Acceptance:
  - 通知 bell icon + 未读计数 badge
  - 通知列表：类型 icon、标题、时间、已读/未读状态
  - 点击跳转到对应页面

---

## Epic E11: P2P Sync（去中心化同步）

> 里程碑：M6（Week 6+，可作为加分项）
> 来源：[07_P2P_Node_Design](./07_P2P_Node_Design.md)

### E11-S0: Community bootstrap API — P2 · 2 SP

- As an edge client, I can discover the Anchor bootstrap information for my community without relying on browser mDNS as the default path.
- Acceptance:
  - `GET /v1/communities/:id/bootstrap` 返回 Anchor 节点地址、seed 信息和同步参数
  - PWA / Edge 通过该 endpoint 获取默认 discovery 信息
  - `mDNS` 不作为默认依赖，只作为实验性补充

### E11-S1: Edge node libp2p WebWorker — P2 · 8 SP

- As a user, my PWA connects to the P2P network via WebWorker.
- Acceptance:
  - WebWorker 运行 libp2p-js + Helia
  - 生成 Ed25519 密钥对（每社区独立）
  - WebSocket 连接到 Anchor 节点
  - 订阅 GossipSub topic：`weavenyc/{community_id}/posts`

### E11-S2: Anchor node — libp2p full node — P2 · 8 SP

- As a community, the Anchor node relays and pins posts.
- Acceptance:
  - Fastify + libp2p GossipSub v1.1 + Helia
  - 验证 Ed25519 签名 → 规则引擎检查
  - Helia Pin PostSummaryDAG → 获得 CID
  - 同步到 Cloud PostgreSQL（REST API）

### E11-S3: Offline recovery sync — P2 · 3 SP

- As a user who was offline, I can catch up on missed posts.
- Acceptance:
  - 检测重新上线 → 请求 `last_sync_ts` 之后的增量事件
  - 批量更新 IndexedDB
  - 冲突解决策略：last-write-wins（MVP）

---

## Epic E12: Observability & Operations（可观测性与运维）

> 里程碑：贯穿全程
> 来源：[11_Ops_Runbook](./11_Ops_Runbook.md) + [12_Testing_Strategy](./12_Testing_Strategy.md)

### E12-S0: Smoke E2E bootstrap — P0 · 2 SP

- As a developer, I can run a very small smoke E2E suite early, before the full suite exists.
- Acceptance:
  - 至少覆盖 2 条关键 smoke 路径：首次打开 -> ZIP -> 资源发现；匿名会话 -> 本地草稿保存 -> 刷新后仍存在
  - 在 CI 中可 headless 执行
  - 这是 smoke 层，不替代 M6 的完整 E2E suite

### E12-S1: Structured logging — P0 · 2 SP

- As a developer, all services emit structured JSON logs.
- Acceptance:
  - 日志格式：`{ ts, level, service, req_id, msg, ...context }`
  - 不记录 PII（手机号、消息内容等）
  - 日志级别：debug / info / warn / error
  - 集中收集到 CloudWatch / Loki

### E12-S2: Health check and basic monitoring — P0 · 2 SP

- As an operator, I can monitor service health.
- Acceptance:
  - 每个服务暴露 `GET /healthz` 和 `GET /readyz`
  - SLO 监控：API p99 latency ≤ 500ms、error rate ≤ 1%
  - 告警：服务连续 3 次 healthcheck 失败 → 通知

### E12-S3: Analytics event tracking — P1 · 2 SP

- As a product owner, I can track key user events.
- Acceptance:
  - 最小事件集（参考 [02_PRD §7](./02_PRD.md)）：
    - `app_open`、`zip_set`、`resource_view`、`resource_call`
    - `post_create`、`match_shown`、`match_clicked`
    - `chat_created`、`message_sent`、`report_submitted`
  - 事件存储到独立 analytics 表（不影响主业务）

### E12-S4: End-to-end test suite — P1 · 5 SP

- As a developer, I can run E2E tests covering all critical paths.
- Acceptance:
  - Playwright 测试覆盖 4 条关键路径：
    1. 首次打开 → 搜索资源 → 查看详情 → 拨号/导航
    2. 匿名会话 → 发帖 → 查看匹配 → 升级验证 → 发起联系
    3. 聊天 → 屏蔽/举报
    4. Anchor 登录 → 审核 → 发公告
  - CI 中可运行（headless Chrome）
  - 覆盖率目标：关键路径 100%

---

## Sprint Planning 参考（2-3 人团队）

> 排期口径：下方 Sprint 表按 **3 人目标节奏**估算；如果只有 **2 人**，请把 `M5` 拆成“核心必需”和“可顺延扩展”两层，不要默认 6 周内把 `M5` 全吃掉。

| Sprint | 里程碑 | Epics | 总 SP | 目标 |
|--------|--------|-------|-------|------|
| Sprint 0 (Day 1-3) | M0 | E0, E1-S1, auth / PWA shell subset, E12-S2 subset | ~22 SP | Completed: 骨架可跑，匿名会话可用，healthcheck 可见 |
| Sprint 1 (Week 1-2) | M1 | E2, E1-S2/S3/S3b, E8-S1, E9-S2/S3/S4, E12-S0 | ~35 SP | Candidate complete: 资源目录 MVP、verify/refresh/magic-link、browser smoke、real API smoke、live-source smoke 已实现并已重跑；正式 closeout 仍以 `22_M1_Closeout.md` 为准 |
| Sprint 2 (Week 2-3) | M2 | E3 | ~22 SP | 发帖 + 社区 join + 社区 Feed |
| Sprint 3 (Week 3-4) | M3 | E4 | ~16 SP | 匹配引擎 + 行动方案 + 一次刷新 + contact request inbox/accept-reject |
| Sprint 4 (Week 4-5) | M4 | E5, E6-S0/S1/S2/S3 | ~26 SP | 聊天 + 最小审核闭环 |
| Sprint 5 (Week 5-6) | M5 | E7 core, E1-S5, (+ E10 / E6-S4 / E8-S2/S3/S4 only with 3-person capacity) | ~33 SP | Anchor 后台核心闭环；扩展项视容量追加 |
| Sprint 6 (Week 6+) | M6 | E11, E12-S3/S4 | ~28 SP | P2P 同步 + 完整 E2E（optional） |

**总计**：~178 SP

**MVP critical path（3-person target, M0-M5）**：~150 SP
**2-person conservative MVP（延后 E10 / E6-S4 / E8-S2/S3/S4）**：~133 SP
**Optional add-on（M6）**：~30 SP

---

## Future (Phase 2 — Not MVP)

> 以下功能明确**不在 MVP 范围内**，记录以备后续迭代。

### F1: Offline mesh networking — P2

- Bluetooth Low Energy / WiFi Direct 点对点传输
- 无网环境下发帖 → 有网后自动同步
- 技术探索：libp2p WebRTC + BLE transport

### F2: Advanced reputation system — P2

- 多维度信誉分：互助完成率、见证次数、社区活跃度
- 可解释信誉标签（"完成 5 次互助"、"3 位邻居见证"）
- 防刷机制：Sybil 检测、速率限制

### F3: Time bank / Skill exchange — P2

- 时间币：1 小时服务 = 1 时间币
- 技能标签匹配（翻译、维修、辅导等）
- 交易记录 + 社区级统计

### F4: Machine translation for UGC — P2

- 帖子/消息自动翻译（标注"机器翻译，仅供参考"）
- Anchor 审核时提供翻译辅助
- 翻译质量反馈机制

### F5: Structured requests & inventory — P2

- 结构化需求："2 人份晚餐"、"婴儿奶粉 1 罐"
- Offer 方可标注库存数量
- 自动扣减 + 补货提醒

### F6: Advanced analytics dashboard — P2

- 社区健康度评分（匹配率、响应时间、活跃度）
- 趋势分析（按类别/时段/区域）
- 对比视图（社区 vs 社区）
- 导出报告（CSV/PDF）
