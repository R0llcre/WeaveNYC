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
- 发帖不要求先完成 OTP；只有在点击 Contact / Request contact / 进入聊天前才要求 verified
- 如果用户没有当前社区 membership，先显示 Join community 流程再允许 `community_only` 发布

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
- 草稿和首发都可以在匿名会话中完成
- 默认 `community_only` 仅在用户已加入当前社区时可发布；否则提示先加入社区

### Screen 7：Preview & Publish
元素：
- 预览卡片（最终显示样式）
- 风险标签（例如：Needs anchor review）
- CTA：Publish
- Secondary：Edit

发布后状态：
- Pending（待审核）
- Active（已发布）
- Closed（已关闭）

---

## 4) Matching（行动方案）

### Screen 8：Match Results
元素：
- Header：3 ways to act now
- Cards（默认展示 3 张；用户点击"换一批"可加载更多，最多 6 张）：
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
- **必须至少包含 1 个官方资源卡**（兜底）
- 若无邻里匹配：展示 3 个官方资源（按开放状态+距离排序）

### Screen 9：Contact Confirmation
目的：防骚扰（双方同意才建立聊天）
元素：
- 文案：Only share what you are comfortable with.
- CTA：Request contact / Offer contact
- Secondary：Back

规则：
- 当前若为匿名账户：先升级为 verified，再允许发送/接受联系请求
- 发起方提交后，接收方在 Contact Requests Inbox 里看到待处理请求
- 接收方可以在 Inbox 中 Accept / Reject
- 双方都完成同意后创建 Conversation

---

## 5) Inbox（消息）

### Screen 10：Contact Requests Inbox
元素：
- Pending requests list（发起方昵称、关联帖子、时间）
- Actions：Accept / Reject
- Empty state：No pending contact requests.

规则：
- 仅 verified 用户可看见自己的 pending 请求
- 接受后跳转到对应 Conversation
- 拒绝后该请求不再显示

### Screen 11：Conversation List
元素：
- 列表项：对方匿名昵称 + 最后一条消息摘要 + 时间 + 未读数
- Search（可选）

### Screen 12：Chat
元素：
- Safety banner：Report / Block
- Message input：文本；可选语音输入
- Quick replies：
  - “I can help”
  - “What time works?”
  - “Can you call the pantry?”
- CTA：Mark completed（标记完成）

规则：
- 新账号：发送频率限制（rate limit）
- 只有已接受的 `contact_request` 才能进入聊天页
- 触发敏感词：弹窗提醒 + 一键举报

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
  - Data sync：Local only / P2P opt-in / Cloud opt-in
- Safety
  - Blocked users
  - Reports
- Help & feedback

规则：
- 默认 Local only；用户主动选择才开启 P2P 或云同步

---

## 8) Anchor Admin（Web 最小后台）
> MVP 可用一个简单的 Web 管理台即可。

### Screen A：Dashboard
- Metrics tiles：Pending reviews, Reports, Active posts
- Quick actions：Post announcement

### Screen B：Review Queue
列表字段：
- Post type（Request/Offer）
- Category
- Submitted time
- Risk flags（new user, high risk, reported）
- Actions：Approve / Reject / Ask for more info

### Screen C：Post Detail (Admin)
- Post content（原文）
- Poster（匿名 ID + 账号年龄）
- History：编辑记录、举报记录
- Actions：Approve、Reject、Suspend、Ban user

### Screen D：Community Rules
可配置项（开关+阈值）：
- 哪些类别默认需审核
- 举报阈值（多少次进入审核）
- 黑名单词（本社区特有）
- 公告置顶策略

---

## 9) 文案与语气（Copy Guidelines）
- 始终“体面”：用中性语言，不用羞辱性词汇
- 始终“可行动”：每个页面至少一个明确行动按钮
- 始终“安全”：高风险动作前给出提醒与退出选项
