# WeaveNYC — Authentication & Authorization Design

> 本文档将散落在 [09_API_Spec](./09_API_Spec.md)、[10_Security](./10_Security_Privacy_Threat_Model.md)、[07_P2P_Node_Design](./07_P2P_Node_Design.md) 中的认证鉴权信息整合为统一方案。

---

## 1) 设计原则

1. **匿名优先**：用户不注册也能使用核心功能（搜索官方资源）
2. **渐进式认证**：发帖时自动创建匿名会话；开始联系/进入聊天前升级为已验证账户（主路径：OTP；备选：magic link）
3. **最小数据**：只收集必要信息，不要求实名
4. **双层身份**：HTTP API 用 `user_id`（JWT）；P2P 网络用 `actor`（Ed25519 公钥派生，与 `user_id` 不关联）

---

## 2) 用户身份层级

```
┌────────────────────────────────────────────────────────┐
│  Level 0: Anonymous Guest                              │
│  ─ 无账号，无 token                                    │
│  ─ 能力：搜索官方资源、查看公开帖子                     │
├────────────────────────────────────────────────────────┤
│  Level 1: Anonymous Account                            │
│  ─ POST /v1/auth/anonymous → 获得 JWT                  │
│  ─ 服务端生成 UUID user_id（无关联手机号/邮箱）         │
│  ─ 能力：发帖、收藏、浏览匹配结果                      │
│  ─ 限制：无法进入聊天、无法发高风险类别                  │
├────────────────────────────────────────────────────────┤
│  Level 2: Verified Account                             │
│  ─ POST /v1/auth/otp/start → verify → 获得 JWT        │
│  ─ 或 POST /v1/auth/magic-link/start → verify         │
│  ─ 能力：聊天、发高风险类别、接收推送通知               │
├────────────────────────────────────────────────────────┤
│  Level 3: Anchor Admin                                 │
│  ─ Verified Account + Anchor 邀请码                    │
│  ─ 强制 MFA（TOTP）                                   │
│  ─ 能力：审核、公告、规则配置、封禁                     │
└────────────────────────────────────────────────────────┘
```

---

## 3) 认证流程

### 3.1 匿名会话（Level 0 → Level 1）

```
Client                          API Gateway
  │                                  │
  │  POST /v1/auth/anonymous         │
  │  { device_id: "d_xxx" }         │
  │ ──────────────────────────────>  │
  │                                  │ 生成 UUID user_id
  │                                  │ 签发 access + refresh token
  │  { access_token, refresh_token,  │
  │    user: { user_id,              │
  │            level: "anonymous" } }│
  │ <──────────────────────────────  │
```

- `device_id` 由客户端本地生成（IndexedDB），用于设备关联（非追踪）
- `user_id` 使用 UUID（与 [20_DB_Schema_Reference](./20_DB_Schema_Reference.md) 保持一致）
- Token 有效期：`access_token` 15 分钟，`refresh_token` 7 天

### 3.2 手机号 OTP（Level 1 → Level 2）

```
Client                          API Gateway              SMS Provider
  │                                  │                        │
  │  POST /v1/auth/otp/start         │                        │
  │  { phone: "+1516..." }           │                        │
  │ ──────────────────────────────>  │                        │
  │                                  │  发送 6 位验证码        │
  │                                  │ ─────────────────────> │
  │  { challenge_id: "c_..." }       │                        │
  │ <──────────────────────────────  │                        │
  │                                  │                        │
  │  POST /v1/auth/otp/verify        │                        │
  │  { challenge_id, code: "123456"} │                        │
  │ ──────────────────────────────>  │                        │
  │                                  │ 升级 user level → verified
  │                                  │ 关联 phone_hash        │
  │  { access_token, refresh_token,  │                        │
  │    user: { user_id,              │                        │
  │            level: "verified" } } │                        │
  │ <──────────────────────────────  │                        │
```

**安全细节**：
- 验证码 6 位数字，有效期 5 分钟
- 同一手机号 Rate limit：3 次/小时
- 手机号存储为 `SHA-256(phone + salt)` 哈希，不存明文
- 用途：仅用于验证身份和防滥用，不用于推送（推送走 Push Notification Token）

### 3.3 邮箱 Magic Link（备选 Level 1 → Level 2）

```
POST /v1/auth/magic-link/start
{ "email": "user@example.com" }
→ 发送包含一次性 token 的链接到邮箱
→ 用户点击链接 → 回调 /v1/auth/magic-link/verify?token=xxx
→ 升级 user level → verified
```

- Magic link token 有效期：15 分钟，一次性使用
- 邮箱存储为哈希，同手机号

### 3.4 Anchor Admin 激活（Level 2 → Level 3）

```
POST /v1/auth/anchor/activate
{
  "invite_code": "ANC-XXXXX",       // 由平台管理员生成
  "totp_secret": "base32...",       // TOTP 设置
  "org_name": "St. Kilian Parish"
}
```

- 邀请码由平台管理员线下发放（MVP：手动生成）
- 强制绑定 TOTP（Google Authenticator / Authy）
- Anchor 账号的 JWT 包含 `role: "anchor"` 和 `community_id`

---

## 4) JWT Token 设计

### 4.1 Access Token Payload

```typescript
type JWTPayload = {
  sub: string;            // UUID user_id
  level: 'anonymous' | 'verified' | 'anchor';
  role: 'user' | 'anchor';
  community_ids: string[]; // 从 community_members 派生的所属社区
  iat: number;
  exp: number;            // 15min
};
```

### 4.2 Token 刷新

```
POST /v1/auth/refresh
{ "refresh_token": "rt_xxx" }
→ 验证 refresh_token 有效性
→ 签发新 access_token (15min) + 新 refresh_token (7d, rotation)
```

- Refresh token rotation：每次使用后旧 token 失效，签发新 token
- Refresh token 存储在 Redis 中，支持远程注销

### 4.3 Token 存储（客户端）

| 存储位置 | 内容 | 安全措施 |
|----------|------|----------|
| 内存（Redux Store） | access_token | 页面关闭即失效 |
| IndexedDB（Dexie.js） | refresh_token | HttpOnly 不适用 PWA；加密存储 |
| IndexedDB（Dexie.js） | Ed25519 私钥 | 仅用于 P2P 签名，不离开设备 |

---

## 5) 授权模型（RBAC）

### 5.1 角色权限矩阵

| 资源/操作 | Guest (L0) | User (L1) | Verified (L2) | Anchor (L3) |
|-----------|:----------:|:---------:|:-------------:|:-----------:|
| 搜索官方资源 | ✅ | ✅ | ✅ | ✅ |
| 查看公开帖子 | ✅ | ✅ | ✅ | ✅ |
| 创建低风险帖子 | ❌ | ✅ | ✅ | ✅ |
| 创建高风险帖子 | ❌ | ❌ | ✅ | ✅ |
| 查看匹配结果 | ❌ | ✅ | ✅ | ✅ |
| 发起聊天 | ❌ | ❌ | ✅ | ✅ |
| 举报内容 | ❌ | ✅ | ✅ | ✅ |
| 收藏资源 | ❌ | ✅ | ✅ | ✅ |
| 审核队列 | ❌ | ❌ | ❌ | ✅ |
| 发布公告 | ❌ | ❌ | ❌ | ✅ |
| 配置社区规则 | ❌ | ❌ | ❌ | ✅ |
| 封禁用户 | ❌ | ❌ | ❌ | ✅ |
| 管理 Anchor 成员 | ❌ | ❌ | ❌ | ✅（主 Anchor） |

### 5.2 API 中间件实现

```typescript
// services/api-gateway/middleware/auth.ts
import { FastifyRequest } from 'fastify';
import { z } from 'zod';

const AuthLevels = {
  GUEST: 0,
  ANONYMOUS: 'anonymous',
  VERIFIED: 'verified',
  ANCHOR: 'anchor',
} as const;

const Rank = {
  anonymous: 1,
  verified: 2,
  anchor: 3,
} as const;

// 路由装饰器：声明所需最低身份层级
function requireLevel(minLevel: keyof typeof Rank) {
  return async (request: FastifyRequest) => {
    const user = request.user; // 从 JWT 解析
    if (!user) throw { statusCode: 401, message: 'Authentication required' };
    if (Rank[user.level] < Rank[minLevel]) {
      throw { statusCode: 403, message: 'Insufficient permissions' };
    }
  };
}

// 社区归属检查：确保用户只能操作自己社区的资源
function requireCommunity(communityIdParam: string) {
  return async (request: FastifyRequest) => {
    const communityId = request.params[communityIdParam];
    if (!request.user.community_ids.includes(communityId)) {
      throw { statusCode: 403, message: 'Not a member of this community' };
    }
  };
}
```

---

## 6) P2P 身份（与 HTTP 身份隔离）

| 维度 | HTTP 身份 | P2P 身份 |
|------|-----------|----------|
| 标识符 | `user_id`（服务端生成） | `actor`（Ed25519 公钥哈希） |
| 存储 | PostgreSQL | IndexedDB（本地密钥对） |
| 可关联性 | 手机号/邮箱哈希 | 不可关联到 user_id |
| 跨社区 | 同一 user_id | 每社区可生成不同 actor（防跨社区追踪） |
| 用途 | API 鉴权 | GossipSub 事件签名 + IPFS 内容签名 |

**隔离原理**：服务端不存储 Ed25519 密钥，不知道 `actor` 对应哪个 `user_id`。只有用户本地设备同时持有两者。

详见 [07_P2P_Node_Design §5.2](./07_P2P_Node_Design.md)。

---

## 7) 安全加固

### 7.1 Rate Limiting

| 端点 | 限制 | 窗口 |
|------|------|------|
| `/v1/auth/otp/start` | 3 次/手机号 | 1 小时 |
| `/v1/auth/otp/verify` | 5 次/challenge | 5 分钟 |
| `/v1/auth/anonymous` | 10 次/IP | 1 小时 |
| `/v1/auth/refresh` | 30 次/user | 1 小时 |
| `/v1/posts` (POST) | 10 次/user | 1 小时 |
| `/v1/conversations/{id}/messages` (POST) | 60 次/user | 1 小时 |

实现：Redis + 令牌桶算法（`@fastify/rate-limit` 插件 + `ioredis`）

### 7.2 Session 安全

- JWT 签名算法：RS256（非对称，密钥轮换更安全）
- 密钥轮换：每 90 天自动轮换签名密钥（旧密钥保留 24h 用于验证）
- 黑名单：用户被封禁时，将 `user_id` 加入 Redis 黑名单，所有请求即时拒绝
- CORS：仅允许 `*.weavenyc.org` 和 `localhost:*`（开发）

### 7.3 Anchor MFA

- 登录时：密码（或 OTP）+ TOTP 二次验证
- 高危操作（封禁/规则变更）：再次输入 TOTP
- 会话超时：Anchor 后台 30 分钟无操作自动登出

---

## 8) 账户生命周期

```
创建 → 匿名使用 → 升级（OTP/Magic Link）→ 正常使用 → [可选] 删除
                                                          │
                                                          ↓
                                                  用户退出流程
                                                  详见 10_Security §6
```

| 状态 | 说明 | 触发条件 |
|------|------|----------|
| `active` | 正常状态 | 创建/注册 |
| `suspended` | 暂停（可恢复） | Anchor 封禁 / 累计举报 |
| `deleted` | 已删除（30 天后物理清除） | 用户主动删除 |

删除流程详见 [10_Security §6 用户退出与数据删除](./10_Security_Privacy_Threat_Model.md)。
