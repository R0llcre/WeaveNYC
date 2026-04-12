# WeaveNYC — User Flows & Screens (Text Wireframes)

说明：这里用“文字线框图 + 交互规则”写清楚每个屏幕的元素、状态与跳转。团队可以直接据此画 Figma 或实现。

---

## 1) 首次打开（Onboarding Lite）

### Screen 1：Language Picker
元素：
- Title：Choose your language / Elige tu idioma / 选择语言
- Options：English / Español / 中文
- CTA：Continue

规则：
- 默认跟随系统语言
- 选择后写入本地设置

### Screen 2：Location Gate
元素：
- 输入框：ZIP Code（占位：e.g., 11735）
- 次要按钮：Use my location
- 文案：We only use approximate location.
- CTA：See nearby resources

规则：
- 不允许定位也能继续（隐私优先）
- ZIP 校验：5 位数字；错误提示：Please enter a 5-digit ZIP.
- 如果允许定位：只取“近似位置”（Neighborhood 级），不显示/不保存精确 GPS

---

## 2) Home（官方资源目录）

### Screen 3：Home List
元素：
- Search bar：ZIP / Neighborhood
- Filters：
  - Open now
  - Today
  - Type（Pantry / Soup Kitchen / All）
- Resource cards（列表项）：
  - Name
  - Type
  - Open status（Open now / Opens at / Closed）
  - Distance（approx）
  - Quick actions：Call、Directions
- 主 CTA：Request help / Offer help

状态：
- Empty：No results. Try a different ZIP or expand radius.
- Loading：Skeleton list

规则：
- 首页默认展示“Today + Open now”混合（p50 10s 内有结果）
- 永远允许“跳过注册”查看资源

### Screen 4：Resource Detail
元素：
- Name + Type
- Address（点击打开地图）
- Phone（点击拨号）
- Hours（按周展示；今天高亮）
- Notes（Eligibility / ID requirements / Languages）
- Buttons：Directions / Call / Save

---

## 3) Post（互助发布）

### Screen 5：Choose Post Type
元素：
- I need help（Request）
- I can help（Offer）

规则：
- 第一次发帖先创建匿名会话（Anonymous Session），再继续写帖或发布
- low / medium risk `Request` 可由 anonymous member 发布
- `Offer` 和 high-risk `Request` / `Offer` 都要求 verified
- 如果用户没有当前社区 membership，先进入 Join community 流程，再允许任何社区帖子发布

### Screen 6：Compose Post
字段（必填除非说明）：
- Category：Food / Goods / Childcare / Companionship / Translation / Transportation / Other
- Description（短文 ≤ 280 字）
- Voice input（可选）：按住说话 → 转写 → 可编辑
- Approx location：ZIP 或 Neighborhood
- Expire time：默认 24h（可选 2h、6h、24h、72h）
- Visibility：
  - `community_only`（默认）— 仅同社区可见
  - `public` — 对所有用户可见
  - `anchor_mediated` — 仅通过 Anchor 推荐可见
- Safety checkbox（高风险类别必选）：I understand safety guidelines

实时提示：
- 高风险类别提示条：Childcare/Transportation require extra review.
- 敏感词提示：If you are asked for SSN/passport, report and block.

CTA：Preview

规则：
- 草稿可以在匿名会话中完成
- 默认 `community_only` 仅在用户已加入当前社区时可发布；否则提示先加入社区
- 浏览器语音识别优先；失败时由用户触发音频上传 fallback 到 `/v1/speech/transcribe`

### Screen 7：Preview & Publish
元素：
- 预览卡片（最终显示样式）
- 风险标签（例如：Needs anchor review）
- CTA：Publish
- Secondary：Edit

发布后状态：
- low / medium risk：Active（已发布）
- high risk：Pending review（待审核）
- Closed（已关闭）

发布后跳转：
- `Request`：直接进入 `/posts/:postId/matches`
- `Offer`：留在 `/posts/:postId` 帖子详情页

---

## 4) Matching（行动方案）

### Screen 8：Match Results
元素：
- Header：3 ways to act now
- Cards（默认展示 3 张；用户点击"换一批"最多再拿 1 批，累计最多 6 张）：
  - Neighbor Match（邻里）
  - Official Resource（官方兜底）

Neighbor card字段：
- Category + Summary
- Compatibility chips：Language match / Approx distance / Verified / Anchor-reviewed
- CTA：Contact（匿名账户点击后先进入验证升级）

Official card字段：
- Name + Open status
- CTA：Call / Directions

规则：
- 匿名账户点击 Contact 时：先完成 OTP / magic link 升级，再发送 `contact_request`
- 已 verified 用户可直接发起 `contact_request`
- `refresh=true` 只允许再拿 1 批新结果；超过预算后继续返回当前批次，不再扩张
- **必须至少包含 1 个官方资源卡**（兜底）
- 若无邻里匹配：展示 3 个官方资源（按开放状态+距离排序）
- 邻里匹配池只包含：同社区、`active`、未过期、非 `anchor_mediated` 的 Offer
- 信任标签只使用当前已存在的信号；`anchor_reviewed` 仅在候选帖子本身已经带有 Anchor review 信号时显示，不引入新的“已完成帮助验证”流程

### Screen 9：Contact Confirmation
目的：防骚扰（先建联系请求，再由对方决定是否进入真实聊天）
元素：
- 文案：Only share what you are comfortable with.
- CTA：Request contact / Offer contact
- Secondary：Back

规则：
- 当前若为匿名账户：先升级为 verified，再允许发送联系请求
- 发起方提交后，只创建 `contact_request`
- 接收方在 canonical `/inbox` 的 Requests 视图里看到待处理请求；`/contact-requests` 仅作为兼容跳转
- 接收方可以在 `/inbox` 中 Accept / Reject
- `accept` 之后立即进入真实 `conversation`；消息流、举报、拉黑和安全检测都在同一线程页完成

---

## 5) Inbox（联系请求与聊天）

### Screen 10：Inbox
元素：
- Tabs：Requests / Conversations
- Requests list（发起方昵称、关联帖子、时间）
- Conversations list（对方昵称、最后一条消息预览、时间、未读 badge）
- Actions：Accept / Reject / Open conversation
- Empty state：No pending items yet.

规则：
- 仅 verified 用户可看见自己的 pending requests
- Requests 和 Conversations 共享同一个 `/inbox` 页面与 badge 入口
- 接受后跳转到对应 Conversation Thread
- 拒绝后该请求不再显示
- 按 `last_activity_at` 排序的 conversations 与 pending requests 使用同一套 inbox 文案
- polling 继续承担 inbox 更新；进入线程后实时消息通过 WebSocket 推送

### Screen 12：Conversation Thread
元素：
- Participant preview
- Message list
- Composer
- Quick phrases
- Actions：Report / Block / Close

规则：
- 只有 accepted conversation 的 participant 才能进入线程
- 关闭或拉黑后不可继续发送消息
- 发送前运行敏感信息检测；命中后阻断发送并提示删除后重试

---

## 6) Community（社区 & 公告）

### Screen 13：Community Home
元素：
- Current community（例如：Farmingdale）
- Announcements feed（公告列表）
- Buttons：
  - Join community（Enter code / Scan QR）
  - Community rules

规则：
- 如果当前没有社区 membership，Join community 打开邀请码/二维码输入流程
- 加入成功后，`community_only` 帖子和社区 feed 可见

### Screen 14：Announcement Detail
元素：
- Title、Body、Publisher（Anchor）、Time
- CTA：Share（复制链接/短信）

---

## 7) Settings（隐私与偏好）

### Screen 15：Settings
模块：
- Language
- Privacy
  - Default post visibility
  - Location precision：ZIP only / Neighborhood
- Safety
  - Blocked users
  - Reports
- Help & feedback

---

## 8) Anchor Admin（M5 Completed On Branch）
> 本节描述当前 `feature/m5-anchor-admin` 已实现并已完成 closeout 的后台交付面。`main` 仍保持 `M4 completed` 的 canonical baseline；这里记录的是当前分支的 M5 runtime 真值，直到变更合回 `main` 之前它仍是 branch-local closeout truth。

### Screen A：Dashboard
- Metrics tiles：Posts this week (request), Posts this week (offer), Accepted contacts this week, Reports this week, Pending post review, Pending report review
- Quick actions：Post announcement / Open review queue

### Screen B：Review Queue
列表字段：
- Post type（Request/Offer）
- Category
- Submitted time
- Risk flags（new user, high risk, reported）
- Actions：Approve / Reject / Ask for more info
- Tabs：Posts / Reports

### Screen C：Community Rules
可配置项（开关+阈值）：
- 哪些类别默认需审核
- 举报阈值（多少次进入审核）
- 黑名单词（本社区特有）
- 公告置顶策略

### Screen D：Anchor Login / Activate
- Verified session -> 选择 `Anchor activate` 或 `Anchor TOTP step-up`
- 已激活 anchor 走 `POST /v1/auth/anchor/session/start` + `verify`
- 未激活时引导完成 invite activation / recovery codes enrollment

---

## 9) 文案与语气（Copy Guidelines）
- 始终“体面”：用中性语言，不用羞辱性词汇
- 始终“可行动”：每个页面至少一个明确行动按钮
- 始终“安全”：高风险动作前给出提醒与退出选项
