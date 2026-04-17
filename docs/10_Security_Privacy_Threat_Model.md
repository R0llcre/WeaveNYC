# WeaveNYC — Security, Privacy & Threat Model

> MVP 的核心竞争力之一就是“弱势用户敢用”。所以安全与隐私是产品的一部分，不是上线后补丁。

---

## 1) 资产清单（我们要保护什么）
- 用户身份与联系方式（手机号/邮箱）
- 用户的请求内容（可能包含敏感处境）
- 位置数据（哪怕是 ZIP 也可能敏感）
- 社区规则与审核记录
- 官方资源目录（相对不敏感，但要防篡改）

---

## 2) 攻击面（Attack Surfaces）
- 客户端：PWA/移动端存储被窃取
- 网络：中间人攻击、消息注入
- P2P：恶意节点传播假信息、Sybil
- Anchor 后台：账号被盗导致滥权
- 内容：诈骗、骚扰、诱导交换敏感证件信息

---

## 3) 威胁建模（STRIDE 简版）

### 3.1 Spoofing（伪装）
风险：冒充 Anchor、冒充官方资源点、冒充邻居。
措施：
- Anchor 账号强制 MFA（TOTP）
- 官方资源目录采用”签名版本”（见 [04_Data_Sources](./04_Data_Sources.md)）
- 重要公告仅允许 Anchor 发布，且展示“Verified Anchor”标识

### 3.2 Tampering（篡改）
风险：篡改官方资源信息、篡改帖子状态。
措施：
- 官方数据导入流水号 + 哈希校验
- Post 更新采用版本号（optimistic concurrency）

### 3.3 Repudiation（抵赖）
风险：用户否认发过某条信息或进行过骚扰。
措施：
- 审计日志（最小化）：事件类型 + 时间 + 主体 + community_id
- 聊天消息可做不可抵赖摘要（后续迭代）

### 3.4 Information Disclosure（信息泄露）
风险：泄露位置、身份、处境。
措施：
- 默认 ZIP/Neighborhood 级别，不存精确 GPS
- 默认匿名昵称；不显示手机号/邮箱
- Chat 内置敏感提示：检测 SSN/护照等词
- 数据分区：Local-only 为默认（见 [08_Data_Model](./08_Data_Model.md)）

### 3.5 Denial of Service（拒绝服务）
风险：刷接口、刷帖、刷消息、P2P spam。
措施：
- Rate limit（见 [09_API_Spec §11](./09_API_Spec.md)）
- 新账号限制：不能立刻发高风险类别
- P2P topic 配额：每 peer 每分钟发布次数限制

### 3.6 Elevation of Privilege（越权）
风险：普通用户获得 Anchor 权限。
措施：
- Role-based access control（RBAC）
- Anchor 邀请码 + 手工批准（MVP）
- 后台所有危险操作二次确认（soft-delete、ban）

---

## 4) 内容安全策略（非常具体）

### 4.1 高风险类别默认策略
- Childcare / Transportation：
  - 默认需要 Anchor 审核
  - UI 显示“安全提示条”
  - 默认只在“社区内可见”

### 4.2 自动化风险规则（MVP 规则表示例）
- 检测到关键词：SSN, passport, bank, wire, crypto, gift card
  - 触发：提示 + 建议举报 + 可一键拉黑
- 同一用户 10 分钟内发送 > 20 条消息
  - 触发：限流 + 风控队列

### 4.3 举报与处置 SLA
- P0（儿童安全、暴力威胁、明显诈骗）：4 小时内处理
- P1（骚扰、歧视言论）：24 小时内处理
- P2（垃圾信息）：72 小时内处理

---

## 5) 隐私声明（MVP 可直接用作对外文案骨架）
- 我们默认把你的数据保存在本地设备上。
- 你可以选择把某些帖子同步到你的社区（去中心化网络/Anchor 节点）。
- 我们不会出售你的个人数据。
- 你可以随时删除你的帖子与账号。

---

## 6) 用户退出与数据删除流程

### 6.1 用户主动删除帖子
- 用户在"我的发布"中可随时删除自己的帖子
- 删除后：
  - 本地数据立即移除
  - P2P 网络发布 `post.tombstoned` 事件，其他节点同步删除
  - 数据库标记 `status = removed`，30 天后物理删除
  - 关联的匹配建议（MatchSuggestion）同步失效

### 6.2 用户注销账号
**入口**：设置 → 账号 → 删除我的账号

**流程**：
1. 二次确认弹窗："删除账号将永久移除你的所有数据，此操作不可逆。"
2. 需要重新验证身份（OTP / magic link）
3. 触发后台数据清理 job

**数据处理规则**：

| 数据类型 | 处理方式 | 时间 |
|----------|----------|------|
| 用户个人信息（昵称、手机号、邮箱） | 立即匿名化（替换为 `deleted_user_xxx`） | 即时 |
| 用户发布的帖子 | 标记 `removed`，30 天后物理删除 | 30 天 |
| 聊天消息 | 从用户侧删除；对方看到"此用户已注销" | 即时 / 30 天物理删除 |
| 举报记录（用户作为举报者） | 保留匿名化版本（用于审计，不含身份信息） | 永久保留 |
| 举报记录（用户作为被举报者） | 保留匿名化版本 | 永久保留 |
| 审计日志中的操作记录 | 保留匿名化版本（`user_id_hash` 保留，明文身份移除） | 永久保留 |
| 本地设备数据 | 用户自行清理（App 提示"清除本地数据"按钮） | 用户自行 |

### 6.3 合规考量

**CCPA（加州消费者隐私法）**：
- MVP 用户可能包含加州居民，需遵守：
  - 用户有权知道收集了哪些数据（隐私声明覆盖）
  - 用户有权要求删除（注销流程覆盖）
  - 不出售个人数据（已承诺）

**NYC 本地隐私法规**：
- NYC Local Law 144（AI 偏见审计）：匹配算法如涉及 AI/ML，可能需要公平性审计
- 目前 MVP 使用规则引擎（非 ML），暂不触发此法规

**GDPR**（如后续扩展到欧洲用户）：
- 数据最小化原则（已遵循：默认本地、最小上传）
- 被遗忘权（注销流程覆盖）
- 数据可携带性：后续可增加"导出我的数据"功能

### 6.4 数据删除 API（M8 三步流程）

出于 M8 pilot 安全审计要求，删号改为 OTP / magic-link 再认证的三步流程：
`/v1/account/delete/request` → `/v1/account/delete/confirm` →
（30 天窗口内可选）`/v1/account/undelete`。详细契约见
`docs/09_API_Spec.md §1.9`。

**Step 1：请求挑战**
```
POST /v1/account/delete/request
Authorization: Bearer <token>
```
- 速率限制：每账号每小时 3 次（`authAbuseStore.checkAccountDeleteRequest`）。
- 未绑定 phone/email 的匿名用户 → `409 cannot_verify_identity`。
- 绑定 phone 时发 SMS OTP；否则 fallback 到 email magic-link。
- 响应 `{challenge_id, masked_destination, delivery_channel, expires_in_seconds}`。

**Step 2：确认删除**
```
POST /v1/account/delete/confirm
Authorization: Bearer <token>
Body: { challenge_id, code, reason? }
```
- **Last-anchor 安全检查**：对于调用者所在的每个 community，若其为该社区
  唯一活跃 anchor（`countActiveAnchorsInCommunity(communityId,
  excludeUserId=self) === 0`），返回 `409 last_anchor_blocks_delete`。
  目的是避免社区在操作者删号后失去唯一运营方。用户必须先让另一位 anchor
  通过 `POST /v1/auth/anchor/activate` 激活，才能继续删除。
- Verify challenge → 错误码 `invalid` 5 次后失效；`expired` / `missing`
  同样要求重新发起 Step 1。
- 事务内：
  - `UPDATE users SET status='deleted', display_name=NULL,
    preferred_languages=NULL, home_zip=NULL, phone_hash=NULL,
    phone_hash_salt=NULL, email_hash=NULL, email_hash_salt=NULL,
    deleted_at=now(), purge_at=now()+interval '30 days',
    deletion_reason=$reason, updated_at=now()`
  - `UPDATE anchors SET status='revoked' WHERE user_id=$userId AND status='active'`
  - `refreshTokenStore.revokeUserSessions(userId)`（所有 refresh token
    家族立即吊销，access token 最长 15 分钟内自然过期）
  - `analyticsRecorder.recordEvent({event_type:'account_deleted', actor_user_id:
    userId, payload:{reason, had_anchor_role}})`
- 响应 `202 {status:'deletion_scheduled', purge_date, user_id,
  undelete_recovery_token}`。`undelete_recovery_token` 为一次性 capability，
  仅在本次响应中明文返回一次；服务端只保留 sha256 hash（TTL 与 `purge_at`
  对齐）。

**Step 3：可选的 Undelete（30 天软删除窗口内）**
```
POST /v1/account/undelete
Body: { user_id, recovery_token }
```
- 成功：`status='active'`, 清空 `deleted_at/purge_at/deletion_reason`，
  `level='anonymous'`，`PII 不恢复`。用户需重新绑定 phone/email 才能
  重新获得 verified 等级；community 成员资格 / anchor 角色同样需要重新激活。
- 过了 `purge_at` → `410 Gone`。
- Token 不匹配或已使用 → `400`。

**OTP 再认证要求**：
- Step 1 发出的 OTP / magic-link 与正常身份升级使用的 `refresh-token-store`
  challenge 同一套抽象（kind `account_delete`），但独立速率限制与过期窗口。
- 确认阶段必须同时校验 `challenge.userId === current_user.sub`，防止
  跨账号注入。

**PII 保留权衡**：选择在 delete 时立即清空 PII + 一次性 recovery token，
而不是保留 PII hash 30 天：
- 满足被遗忘权的用户预期（"我按了删除，数据就不在了"）。
- Recovery token 的服务端足迹仅为 sha256 + TTL，不可逆推原始信息。
- 代价：undelete 后用户失去原有 verified / anchor 状态，需要重新绑定
  与重新激活；认为这是正确的安全默认（避免"撤销删除"变成无声升权通道）。

**撤销旧端点**：M8 完成后 `POST /v1/account/delete` 单步接口下线。客户端
必须迁移到 `request` → `confirm` 两步。

---

## 7) 安全测试清单（上线前）
- OWASP Top 10 基础检查
- 重要接口：鉴权与越权测试
- PWA：本地存储加密/锁屏策略
- 日志：确保不记录敏感内容（聊天正文不入日志）
