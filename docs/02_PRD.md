# WeaveNYC — PRD (Product Requirements Document)

版本：v1.0（MVP）

目标：把“要做什么、做到什么程度算完成、怎么验收”写成可执行规格。

---

## 1) MVP 范围（不做时间银行）

### 1.1 Must-have（上线必须有）
A. **官方资源目录（零冷启动）**
- ZIP 搜索（例如 11735）
- 今日开放筛选（按星期/时间）
- 资源详情页：名称、地址、电话、开放时间、备注
- 交互：一键导航（打开地图 App）、一键拨号
- 数据更新：支持导入/更新（见 [04_Data_Sources](./04_Data_Sources.md)）

B. **互助发布（Request/Offer）**
- 发布类型：我需要（Request）/我能提供（Offer）
- 类别：Food / Goods / Childcare / Companionship / Translation / Transportation / Other
- 最小字段：类别、简短描述、ZIP 或近似位置、有效期（截止时间）、隐私等级
- 语音输入（转文字后可编辑）
- 发布后可编辑、可关闭、可删除

C. **匹配与沟通**
- 对每个 Request 自动给出 3 个“可行动方案”
  1) 1-2 个邻里 Offer（若存在）
  2) 1 个官方资源（总能兜底）
- 每个匹配项显示：距离（粗略）、语言匹配、可用时间、信任提示（Anchor/见证状态）
- 轻量聊天：仅 `verified` 用户可发起联系；双方都点击“开始联系”后创建会话

D. **安全 & 治理（MVP 级）**
- 举报：骚扰 / 诈骗 / 虚假信息 / 危险行为 / 其他
- 自动拦截：敏感关键词 + 风险规则（例如索要 SSN/护照、儿童单独接送等）
- Anchor 审核队列：
  - 新用户的高风险类别（Childcare/Transportation）默认进入审核
  - 被举报累计达到阈值的贴子进入审核
- 见证（witness）基础版：
  - 对“已交付/已发生”的互助，需求方可选择“我已收到帮助”
  - 若有 Anchor 或其他见证确认，则状态为 Verified

### 1.2 Should-have（很推荐，有则体验完整）
- 多语言 UI：英语/西语/中文（简体）
- 低带宽模式：文本优先、图片压缩/禁用
- 仅同社区可见的发布（社区 = Anchor 管理的“圈”）
- 资源收藏（收藏 pantry 等）
- 基础推送通知（新匹配、消息、公告）

### 1.3 Could-have（后续迭代）
- 离线/本地 mesh（Bluetooth/WiFi Direct）
- 更强信誉系统（多维度、可解释）
- 结构化需求（例如“2 人份晚餐”）与库存管理

### 1.4 Non-goals（明确不做）
- 时间银行、积分兑换、支付闭环、加密货币
- 公共信息流式“社区八卦/吐槽”产品形态
- 医疗诊断/法律建议

---

## 2) 目标与成功指标

### 2.1 产品目标
- 让用户 **在第一次打开就看到价值**（官方资源）
- 让用户 **一周内至少完成一次互助匹配**
- 让 Anchor **愿意持续使用后台**（公告、审核、规则配置）

### 2.2 成功指标（MVP 试点期 4-6 周）

> **说明**：以下为全平台合计目标（预计 2-3 个 Anchor 社区）。单个社区的 KPI 见 [05_Partner_Playbook §5](./05_Partner_Playbook.md)。

- TTFV（首次打开到出现可行动信息）p50 ≤ 10s, p95 ≤ 30s
- New User Activation：注册后 7 天内完成 1 次”发帖或联系” ≥ 35%
- Verified Matches / Week ≥ 20（全平台合计，2-3 个社区；单社区目标 ≥ 5）
- Safety Incident Rate ≤ 1 / 1000 interactions（且处置闭环 ≤ 24h）
- Anchor Weekly Active ≥ 1 次/周（每个 Anchor 社区至少 1 次）

---

## 3) 角色（Personas）与关键约束

> 用户画像的数据支撑（食物不安全、语言障碍、数字鸿沟、移民隐私顾虑）详见 [01_Vision §8 用户调研与市场数据](./01_Vision_And_Principles.md)。

### 3.1 Need Seeker（资源求助者）
- 设备：低端 Android 机、流量有限（Bronx 19.2% 家庭仅靠手机上网）
- 语言：英语/西语/中文（覆盖 NYC 最大的 3 个语言群体，合计 200 万+ LEP 用户）
- 顾虑：被追踪、身份暴露、被骚扰（尤其无证/混合身份家庭，详见 01_Vision §8.4）

### 3.2 Helper（资源提供者）
- 需求：快速发布、快速匹配、低风险沟通
- 顾虑：被骗、被骚扰、对方爽约

### 3.3 Anchor Admin（社区管理员）
- 需求：
  - 能定义“本社区规则”（哪些类别需审核、允许范围、黑名单）
  - 能处理举报与风险贴
  - 能发布公告（例如 pantry 开放、drive 活动）

---

## 4) 关键用户旅程（User Journeys）

### Journey A：第一次打开（无注册）
1) 打开 App → 选择语言
2) 输入 ZIP（或允许定位）
3) 看到：
   - 今天开放的官方资源列表（至少 3 条）
   - “发布互助请求/提供帮助”的入口
验收：整个流程 30 秒内完成，且不强制注册

### Journey B：发请求并得到行动方案
1) 点击“我需要帮助” → 选择类别 Food
2) 语音输入：“今晚缺晚餐，两个人” → 生成文本，可编辑
3) 提交 → 系统生成 3 个行动方案：
   - 邻里 Offer（若存在）
   - 官方 pantry（总有一个）
4) 用户点选一个 → 进入“联系/导航/拨号”
验收：1 分钟内看到 3 个方案；官方资源必须永远兜底

### Journey C：Anchor 审核高风险请求
1) 用户发布 Transportation 请求（例如接送）
2) 系统提示：此类别需要 Anchor 审核（保护双方安全）
3) Anchor 在后台看到队列 → 选择：通过/拒绝/要求补充信息
4) 通过后才对社区可见
验收：未经审核不得对公众可见；审核可追踪

---

## 5) 功能需求（Functional Requirements）

> 下面每个模块都包含：功能点、验收标准、边界情况。

### 5.1 Onboarding / 基础设置
**功能点**
- 语言选择（EN/ES/ZH）
- ZIP 输入（必填）或定位授权（可选）
- 昵称（可选）、偏好语言（可选）
- 隐私提示：默认匿名、默认不共享精确定位

**验收标准**
- 不注册也能使用官方资源目录
- 不授权定位也能通过 ZIP 使用主要功能

**边界情况**
- ZIP 无效：给出可纠正提示

---

### 5.2 官方资源目录（Resource Directory）
**功能点**
- 列表页：按距离/今天开放/类别过滤
- 详情页：
  - 地址 + 地图
  - 电话 + 一键拨号
  - 开放时间（能显示“今天是否开放”）
  - 备注（例如需要预约/证件）
- 收藏（Should-have）

**验收标准**
- 输入 ZIP 后 10 秒内加载出列表（p95≤30s）
- 每条资源必须可直接：导航或拨号

**边界情况**
- 数据源某条缺电话/时间：UI 显示“未知”，但不崩溃

---

### 5.3 互助发布（Offer/Request）
**功能点**
- 发布表单：
  - 类型（Offer/Request）
  - 类别（6+1）
  - 描述（≤ 280 字，语音输入可转写）
  - 位置（ZIP + 可选粗略网格，例如 1km geohash）
  - 有效期（默认 24h）
  - 隐私等级：
    - `community_only`（默认，仅同社区可见）
    - `public`（公开）
    - `anchor_mediated`（仅通过 Anchor 推荐可见）
- 编辑/关闭/删除
- 风险提示：发布前提示“不要分享 SSN/护照/银行信息”

**验收标准**
- 提交成功后进入“匹配结果页”
- 发布后可在“我的发布”里管理

**边界情况**
- 描述包含高风险关键词：强提示 +（部分场景）阻断提交

---

### 5.4 匹配引擎（Matching）
**功能点**
- 对每个 Request 默认生成 **Top 3** 行动方案：
  - 优先邻里 Offer（同类别、同语言、近距离、未过期）
  - 永远包含至少 1 条官方资源（兜底）
- 匹配解释（Explainability）：为什么推荐它（距离/语言/可信度/开放时间）
- 允许用户”换一批”建议（最多 2 次，每次展示新一批 3 个，累计最多展示 6 个不同方案）

**验收标准**
- 60 秒内给出 3 个建议（p95）
- 推荐理由可读，不是黑盒分数

**边界情况**
- 没有任何邻里 Offer：显示 3 条官方资源（按开放状态 + 距离排序）

---

### 5.5 沟通（Chat & Contact）
**功能点**
- 会话只有在双方明确同意后创建
- 预设快捷语句（多语言）：
  - “我可以在 xx 时间提供帮助”
  - “我们在公共场所见面？”
  - “请不要分享个人证件信息”
- 可一键屏蔽/举报对方

**验收标准**
- 未同意前不暴露对方手机号/真实身份

**边界情况**
- 对方离线：允许留下离线消息（在下次上线投递）

---

### 5.6 验证与治理（Trust & Safety）
**功能点**
- 举报入口（贴子/用户/消息）
- 风险分级：Low / Medium / High
  - High：Childcare、Transportation、涉及现金/证件等
- Anchor 审核：
  - 队列（按风险/时间排序）
  - 操作：通过/拒绝/要求补充/封禁
- 见证（witness）基础版：
  - 需求方点击“已收到帮助” → 生成完成事件
  - Anchor 或其他见证确认（可选）→ 标记 Verified

**验收标准**
- High 风险发布未审核不得公开
- 举报后 24h 内必须有处置记录（即使只是“已接收”）

---

### 5.7 Anchor 后台（Admin Console）
**功能点**
- 登录（Anchor 账号）
- 审核队列：
  - 待审核贴子
  - 被举报内容
- 公告发布：标题/正文/时间/范围（社区内）
- 规则配置：
  - 哪些类别需审核
  - 本社区语言偏好
  - 黑名单/白名单
- 数据看板（MVP 简版）：
  - 本周贴子数、匹配数、举报数

**验收标准**
- 审核/公告变更可在用户端实时看到（或 ≤ 1 分钟）

---

## 6) 非功能需求（NFR）

### 6.1 隐私
- 默认不采集实名、身份证号、精确地址
- 定位：默认“ZIP 或粗略网格”，精确定位需显式同意
- 数据留存：贴子过期后自动归档/删除（默认 30 天）

### 6.2 可用性
- 用户端 p95 首屏 ≤ 3 秒（在一般 4G 下）
- 系统端允许部分服务不可用时降级：
  - 云端匹配不可用 → 仍可用官方资源目录

### 6.3 安全
- 传输加密（TLS）
- 最小权限（RBAC）：普通用户/Anchor/系统
- 审计日志：所有审核/封禁操作必须可追踪

### 6.4 前端状态管理与数据获取

> 详细选型理由见 [ADR-0004](./15_ADR_Log.md)。

- **全局状态管理**：[Redux Toolkit](https://redux-toolkit.js.org/)（中间件强大、DevTools 调试体验好、团队规范性强）
  - 管理：用户认证状态、社区上下文、语言偏好、P2P 连接状态
- **服务端数据缓存**：[TanStack Query (React Query)](https://tanstack.com/query)（请求/缓存/重试/离线友好、自动 stale-while-revalidate）
  - 管理：API 请求结果（资源列表、帖子、匹配结果）
- **本地离线数据**：[Dexie.js](https://dexie.org/)（IndexedDB 封装，结构化本地存储、支持索引查询）
  - 管理：草稿、收藏、帖子缓存、设备密钥

### 6.5 多语言（i18n）

**MVP 支持语言**：英语 (en)、西班牙语 (es)、简体中文 (zh)

**技术方案**：
- 框架：[next-intl](https://next-intl-docs.vercel.app/)（外部文档链接；WeaveNYC 本身不使用 Vercel 作为部署平台 — PWA/Admin 部署在 Cloudflare Pages。历史参考，2026-04-21 核对。配合 Next.js App Router，支持 SSR/SSG + Server Component 原生支持 + 类型安全）
- 翻译文件结构：
  ```
  apps/pwa/src/locales/
  ├── en.json     # 英语（基准语言）
  ├── es.json     # 西班牙语
  └── zh.json     # 简体中文
  ```
- 翻译文件格式示例：
  ```json
  {
    "home.title": "Nearby Resources",
    "home.filter.open_now": "Open now",
    "post.create.title": "Request help",
    "post.category.food": "Food",
    "safety.warning": "Never share SSN, passport, or bank info"
  }
  ```
- 语言切换逻辑：
  1. 首次打开：跟随系统语言（`navigator.language`），若不在支持列表中则默认 en
  2. 用户手动选择后保存到本地设置
  3. URL 路由不区分语言（单一路由，客户端切换）

**用户生成内容（UGC）的多语言处理**：
- 帖子/公告保存原始语言（`language` 字段）
- 匹配结果优先推送同语言的 Offer
- **MVP 不做**机器翻译（风险：敏感内容翻译失误），后续迭代可加

**Anchor 审核的多语言**：
- MVP：Anchor 审核时看原文 + 浏览器翻译辅助
- 后续：可加机器翻译辅助按钮（标注"机器翻译，仅供参考"）

### 6.6 语音输入（Voice-to-Text）

> 详细技术方案见 [ADR-0008](./15_ADR_Log.md)（三层降级策略）。

- **Tier 1**（优先）：端侧/系统级语音识别（音频不出设备，隐私最佳）
- **Tier 2**（PWA fallback）：浏览器 Web Speech API
- **Tier 3**（质量兜底）：自建 Speech Gateway（多云 Provider：AWS Transcribe / Google STT / Azure Speech），用户 opt-in

所有 Tier 的识别结果均可手动编辑，确保最终内容由用户确认。

### 6.7 无障碍（Accessibility）

**目标**：WCAG 2.1 AA 级合规（考虑到目标用户包含老人和低教育水平人群）

**具体要求**：
- 字体大小：正文 ≥ 16px，可在设置中放大到 24px
- 对比度：文字与背景对比度 ≥ 4.5:1（AA 标准）
- 触控目标：按钮/链接点击区域 ≥ 44×44px
- 语义化 HTML：使用 `<nav>`、`<main>`、`<button>` 等语义标签
- ARIA 标签：所有交互元素提供 `aria-label`（多语言）
- 键盘导航：所有核心功能可通过键盘完成
- 屏幕阅读器：支持 VoiceOver (iOS) / TalkBack (Android)
- 图片/图标：提供 `alt` 文本
- 表单：错误信息关联到对应输入框（`aria-describedby`）
- 颜色：不仅靠颜色传达信息（同时用文字/图标）

**验证方式**：
- 开发时：使用 axe-core (`@axe-core/react`) 自动检测
- Release Gate：Lighthouse Accessibility 得分 ≥ 90

---

## 7) 事件埋点（Analytics / Telemetry）
> 详见 [11_Ops_Runbook](./11_Ops_Runbook.md) 与 [12_Testing_Strategy](./12_Testing_Strategy.md)。

最小事件集：
- `app_open`（包含语言、是否定位授权）
- `zip_set`
- `resource_view` / `resource_call` / `resource_navigate`
- `post_create`（post_type, category, privacy, risk_level）
- `match_shown` / `match_clicked`
- `chat_created` / `message_sent`
- `report_submitted`（reason）
- `anchor_review_action`（approve/reject/ban）

---

## 8) 风险与对策（MVP 版本就要写清）
- **诈骗/骚扰**：默认匿名 + 双向同意聊天 + 举报拦截 + Anchor 审核
- **假信息**：官方目录兜底 + 见证/审核 + 过期自动下线
- **冷启动**：先用官方资源目录做“开屏价值”，再慢慢引入邻里供给

---

## 9) M0-M1 已决策与剩余问题

### 已冻结决策
- 社区加入机制：邀请码 / 二维码
- 匿名账户升级：手机号 OTP 为主，邮箱 magic link 为备选
- 聊天建联：双向同意后才创建 Conversation

### 剩余但不阻塞 M0-M1 的问题
- Anchor 的加入/退出机制是否需要额外线下身份校验？（MVP 可先人工）
- 多语言内容审核是否要提供机器翻译辅助？（MVP 先不做内建翻译）
