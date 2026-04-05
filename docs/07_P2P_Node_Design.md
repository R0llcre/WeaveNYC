# WeaveNYC — P2P Node Design (Edge / Anchor / Cloud)

目标：把”节点互补”写成可实现的协议与职责分工。

> **技术栈**：P2P 层基于 **libp2p-js**（网络传输/发现/路由）+ **Helia**（IPFS 内容寻址存储），详见 [ADR-0004](./15_ADR_Log.md)。
>
> 本章描述的是 **M6 / Phase 2 的可选 P2P 增强**，不作为 M0-M5 的阻塞项。

---

## 1) 节点类型与职责

### 1.1 Edge Node（用户手机 / PWA）
职责：
- 读取官方资源目录（只读）
- 创建/编辑/删除自己的帖子（Request/Offer）
- 本地存储（默认）：帖子草稿、个人设置、最近匹配、聊天缓存（IndexedDB via [Dexie.js](https://dexie.org/)）
- 选择性同步（opt-in）：把指定帖子发布到 P2P 网络

**P2P 运行时**：
- libp2p-js 实例运行在 **WebWorker** 中，避免阻塞 UI 线程
- 传输协议：WebRTC（浏览器间直连）+ WebSocket（连接 Anchor/Cloud 中继）
- 发现机制：通过 Anchor 提供的 Bootstrap 节点列表（主路径）；mDNS 仅用于局域网 demo / 调试，不作为生产依赖
- 内容存储：Helia (IPFS) 用于存储/获取帖子摘要的 CID（内容标识符）

资源约束：
- 低算力、低带宽、可能频繁离线
- WebWorker 内存限制：libp2p 连接数上限 10，DHT 关闭（由 Anchor 代理）
- 离线时所有数据从 IndexedDB 读取，上线后增量同步

### 1.2 Anchor Node（社区组织运行）
职责：
- 社区规则引擎（policy）：哪些类别需要审核、默认可见范围、黑名单
- 审核队列：通过/拒绝/要求补充信息
- 举报处置：下架/冻结/拉黑
- 公告：发布社区活动、pantry drive 通知
- **P2P 中继 & 索引**：作为本社区的缓存/索引/中继节点

**P2P 角色（关键）**：
- 运行完整 libp2p 节点（Node.js 进程），支持 TCP + WebSocket 传输
- 充当 **GossipSub Relay**：转发本社区的 topic 消息给在线 Edge 节点
- 维护 **社区帖子索引**：订阅 `weavenyc/{community_id}/posts` topic，将活跃帖子的 CID 索引到本地 SQLite/PostgreSQL
- 充当 **IPFS Pin 节点**：Pin 本社区活跃帖子的内容块，确保 Edge 离线时内容仍可获取
- 提供 **Bootstrap 端点**：新 Edge 节点加入时，从 Anchor 获取对等节点列表和最新帖子快照

### 1.3 Cloud Intelligence Node（多云）
职责（只做”重计算/聚合”，不持久保存个人敏感信息）：
- 匹配服务（Match Service）：给 Request 输出行动方案
- 风险检测（Risk Service）：敏感词/模式检测、限流策略建议
- 搜索索引（Search/Directory）：官方资源目录的查询 API、地理索引（PostgreSQL + PostGIS）
- 通知服务（Notification Service）：Push / SMS / Email
- **P2P 辅助**：运行 libp2p 中继节点，为跨社区消息和无 Anchor 在线时提供备份中继

---

## 2) P2P 发布的最小模型

### 2.1 发布什么？（MVP）
只发布”低敏、可共享、短时有效”的内容：
- Request/Offer 的公共摘要（category, title, body, approximate geo, expiry, language）
- 不发布：姓名、精确地址、身份证件、聊天内容

### 2.2 内容寻址与版本（Helia / IPFS）

**存储机制**：
- 每个帖子摘要序列化为 JSON → 通过 Helia `dag.put()` 写入 IPFS DAG → 返回 CID（Content Identifier）
- CID 是内容的唯一指纹，内容不可变
- 更新：创建新版本内容 → 新 CID → 通过 GossipSub 广播 `post.updated` 事件（携带新旧 CID）
- 删除：广播 `post.tombstoned` 事件 → 所有节点 Unpin 对应 CID → 内容自然 GC

**帖子摘要 DAG 结构**（存入 IPFS 的最小数据）：
```typescript
type PostSummaryDAG = {
  post_id: string;          // UUID
  version: number;          // 递增版本号
  post_type: 'request' | 'offer';
  category: string;
  title: string;            // ≤ 60 字
  body: string;             // ≤ 280 字
  language: 'en' | 'es' | 'zh';
  location_zip: string;
  privacy: 'community_only' | 'public' | 'anchor_mediated';
  expires_at: string;       // ISO 8601
  community_id: string;
  actor: string;            // 匿名化 actor ID（非 user_id）
  created_at: string;
  prev_cid?: string;        // 上一版本 CID（形成版本链）
  signature: string;        // Ed25519 签名（防篡改）
};
```

**Pin 策略**：
- Anchor 节点：Pin 本社区所有 `status=active` 且未过期的帖子
- Edge 节点：仅 Pin 自己发布的帖子 + 最近浏览/收藏的帖子
- Cloud 节点：不 Pin 帖子内容（仅处理结构化索引数据）
- 过期帖子：Anchor 定时任务每小时检查，Unpin 已过期 > 24h 的内容

---

## 3) 消息与事件（事件驱动 — GossipSub）

> 使用 libp2p **GossipSub v1.1** 协议进行社区内消息广播。

### 3.1 P2P Topic 命名
- `weavenyc/{community_id}/posts` — 帖子发布/更新/删除
- `weavenyc/{community_id}/reports` — 举报事件
- `weavenyc/{community_id}/announcements` — Anchor 公告

**Topic 订阅规则**：
- Edge 节点：订阅自己所属社区的 3 个 topic
- Anchor 节点：订阅自己管理的社区 topic + 跨社区管理 topic（若有）
- Cloud 节点：订阅所有社区的 `posts` topic（用于更新中心索引）

### 3.2 事件类型（Event Types）
所有事件使用**过去式命名**（表示已发生的事实），详见 [ADR-0009](./15_ADR_Log.md)。

1) `post.published` — 新帖子发布（含 IPFS CID）
2) `post.updated` — 帖子更新（含新旧 CID）
3) `post.tombstoned` — 帖子删除/下架
4) `report.created` — 新举报
5) `moderation.decision` — Anchor 审核决定
6) `announcement.published` — Anchor 公告

**事件信封格式**（所有事件共用）：
```typescript
type P2PEvent<T = unknown> = {
  event_id: string;         // UUID v7（时间有序）
  event_type: string;       // e.g. 'post.published'
  community_id: string;
  actor: string;            // 匿名化 actor ID
  ts: string;               // ISO 8601
  payload: T;               // 事件特定数据
  signature: string;        // actor 的 Ed25519 签名
};
```

**消息大小限制**：单条 GossipSub 消息 ≤ 64 KB（libp2p 默认），帖子正文已限制 ≤ 280 字，足够。

**去重与排序**：
- 事件以 `event_id` 去重（UUID v7 保证唯一）
- 帖子以 `post_id` + `version` 排序（version 递增）
- 收到重复 `event_id` 的消息直接丢弃

详细 JSON Schema 见 [09_API_Spec](./09_API_Spec.md)。

---

## 4) 节点互补的典型协作流程

### Flow A：用户发 Request（同社区可见）
1) Edge 本地创建 Request
2) 若用户选择 opt-in：Edge 发布 `post.published` 到社区 topic
3) Anchor 收到事件：
   - 若类别高风险 → 放入审核队列，未通过前不向其它 Edge 推送
   - 低风险 → 直接作为“可匹配候选”
4) Cloud Match Service 订阅（或由 Anchor 代发）候选摘要，计算 Top-3 行动方案
5) Edge 显示结果（邻里 + 官方兜底）

### Flow B：举报与处置
1) Edge 在贴子/聊天里点 Report
2) Edge 发 `report.created`（只含最小证据：post id / reason / optional screenshot hash）
3) Anchor 处理：
   - warn / remove / ban
4) Anchor 发 `moderation.decision` 广播，让社区节点同步执行（下架/隐藏）

---

## 5) 隐私与最小泄露策略

### 5.1 位置精度
- 默认：ZIP centroid 或 neighborhood（详见 [ADR-0006](./15_ADR_Log.md)）
- 不允许上传精确 GPS
- P2P 消息中只包含 `location_zip`，不包含经纬度

### 5.2 身份
- 默认匿名昵称
- P2P 事件中使用 `actor`（匿名化 ID），不暴露 `user_id`
- `actor` 由 Ed25519 公钥派生（每个社区可生成不同 actor，防止跨社区关联）
- Anchor 可选要求”线下确认”（例如 pantry 已服务过的家庭），但不把信息写入系统

### 5.3 聊天
- 聊天不进入 P2P 广播 topic
- 聊天走 **libp2p 点对点加密通道**（Noise 协议）或云 WebSocket 中继
- MVP：使用云 WebSocket 中继（Redis Pub/Sub 后端）
- Phase 2：支持 libp2p 直连 + 端到端加密（Signal Protocol 或 Noise XX）

### 5.4 密钥管理
- 每个用户本地生成 Ed25519 密钥对（用于 P2P 签名和身份）
- 私钥存储在 IndexedDB（Dexie.js），不上传到服务端
- 设备丢失 = 密钥丢失 → 需要重新加入社区（MVP 可接受；Phase 2 可加密钥备份）

---

## 6) 可靠性与一致性（MVP 策略）

> 详见 [ADR-0007](./15_ADR_Log.md)

### 6.1 一致性选择
MVP 目标是”可用性优先”（CAP 中选 AP），因此：
- 帖子列表最终一致（eventually consistent）
- Anchor 的审核决定具有最终裁决权（moderation decision wins）
- 冲突解决：帖子内容 → last-write-wins（按 version）；审核状态 → Anchor-wins

### 6.2 离线与同步
- Edge 离线时：从 IndexedDB 读取缓存的帖子列表，标注”离线模式”
- Edge 上线时：自动重连 GossipSub → 接收积压事件 → 增量更新本地缓存
- Anchor 离线时：低风险帖子仍可在 Edge 本地展示；高风险帖子审核停滞，Cloud 节点可作为备份中继

### 6.3 节点发现与连接

```
Edge 启动流程：
1) 从本地缓存加载已知 Anchor 节点地址
2) 通过 WebSocket / HTTPS 连接 Anchor Bootstrap 端点
3) Anchor 返回：对等节点列表 + 最新帖子 CID 列表
4) Edge 订阅社区 GossipSub topic
5) 按需从 IPFS 网络获取帖子内容（Helia.dag.get(cid)）
```

**Bootstrap 节点列表**：
- 硬编码 1-2 个 Cloud 中继节点地址（作为最后兜底）
- Anchor 节点地址通过 REST API `/v1/communities/{id}/bootstrap` 获取
- 本地缓存最近成功连接的 5 个节点地址

---

## 7) 已冻结的 M0-M1 决策（直接影响实现）
1) **社区加入机制**：采用邀请码 / 二维码加入；`M0-M1` 不做开放社区搜索加入。
2) **匿名账户升级机制**：采用手机号 OTP 作为主路径；邮箱 magic link 作为备选路径。
3) **P2P 启动边界**：没有 bootstrap API 或 Anchor 在线时，不阻塞 M0-M5；P2P 作为 M6 可选加分项。

---

## 8) 技术依赖汇总

| 组件 | 库 | 版本 | 用途 |
|------|----|------|------|
| P2P 网络 | **libp2p** (`@libp2p/interface`) | latest | 传输、发现、路由、GossipSub |
| IPFS 存储 | **Helia** (`helia`) | latest | 内容寻址存储、DAG 操作 |
| 传输协议 | `@libp2p/webrtc` + `@libp2p/websockets` | — | 浏览器间直连 + Anchor 中继 |
| 消息广播 | `@chainsafe/libp2p-gossipsub` | — | GossipSub v1.1 Pub/Sub |
| 节点发现 | `@libp2p/bootstrap` + `@libp2p/mdns` | — | 已知节点引导 + 局域网发现（mdns 仅 demo/debug） |
| 加密签名 | `@noble/ed25519` | — | 事件签名、身份验证 |
| 本地存储 | **Dexie.js** (IndexedDB) | 4.x | Edge 离线数据、密钥存储 |

> 前后端共享 P2P message schema（TypeScript 类型定义在 `packages/shared/`），详见 [ADR-0004](./15_ADR_Log.md)。
