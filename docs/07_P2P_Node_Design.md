# WeaveNYC — P2P Sync Overlay Design

目标：把 `feature/m6-p2p-sync` 当前分支里的 M6 同步层写成真实可执行的设计，不把 future-state 节点网络当作已经实现。

> 本章描述的是 **当前 M6 branch-local truth**。
>
> `main` 仍以 `M5 completed` 为准；这里定义的是 `feature/m6-p2p-sync` 上已经接入或正在收口的 **HTTP-first + P2P sync overlay**。
>
> **authoritative write path**：帖子、公告、举报、审核决定仍先走现有 HTTP API 落库；同步层只负责 event append、live stream、offline catch-up 和只读缓存修复。

---

## 1) 当前节点职责

### 1.1 Edge client（PWA）
职责：
- 继续通过现有 HTTP API 创建/编辑帖子、提交举报、读取公告
- 在 `/community` 页面 opt-in 开启同步
- 通过 WebWorker 维护只读同步状态和离线缓存
- 断网时从 Dexie 读取帖子/公告缓存；恢复后先做 HTTP catch-up，再继续 live stream

**当前实现边界**：
- 没有浏览器端 libp2p/Helia 节点
- 没有 direct edge publish
- 没有 P2P 聊天或 message sync
- `mDNS` demo 路径默认关闭，但在 dev/demo flag 打开时会显示实验性 toggle；默认 discovery 路径始终是 bootstrap

### 1.2 Anchor runtime（嵌在 `api-gateway`）
职责：
- 继续作为唯一后端 runtime
- 在写入成功后追加 `community_sync_events`
- 通过 Redis Pub/Sub 向在线连接广播社区事件
- 为离线恢复提供 `GET /v1/communities/:community_id/sync`
- 为在线连接提供 `GET /v1/ws/p2p`

**当前实现边界**：
- 没有独立 Anchor node 进程
- 没有 libp2p GossipSub relay
- 没有 Helia pin/node management
- 同步层的 durable replay 依赖 PostgreSQL 事件日志，不依赖分布式 block exchange

### 1.3 Cloud / central services
职责保持不变：
- 资源目录、匹配、审核、聊天等主逻辑继续走中心化服务
- M6 不用 P2P 替代中心化 API

---

## 2) 当前同步对象

M6 overlay 只同步这 4 类对象：
- `posts`
- `announcements`
- `report.created`
- `moderation.decision`

进一步约束：
- 只把 **post-target** 的 `report.created` / `moderation.decision` 放进社区同步流
- `user` / `message` report 不进入社区 overlay
- 聊天消息、会话状态、通知系统都不进入 M6

---

## 3) 发现与连接

### 3.1 Bootstrap
`GET /v1/communities/:community_id/bootstrap`

返回：
- `community_id`
- `bootstrap_version`
- `anchor_node`
- `relay_nodes`
- `topics`
- `latest_snapshot`
- `mdns_demo_enabled`

说明：
- 浏览器默认走 bootstrap，不依赖 mDNS
- `bootstrap.websocket_url` 由 bootstrap mint 一次短时 websocket token
- 该 URL 不是主 API bearer token 的回显；客户端优先直接复用 bootstrap 返回值
- `community_id` 作用域默认由 websocket token 承载；当前客户端兼容行为是在 URL 缺少 `community_id` 时补上该参数，但不会重新 mint websocket token

### 3.2 Live stream
`GET /v1/ws/p2p`

说明：
- 这是当前分支里的 live stream 路径
- PWA worker 连接该 websocket 接收社区事件
- 如果 live stream 不可用，worker 回退到 `/sync` polling

### 3.3 Offline catch-up
`GET /v1/communities/:community_id/sync?since=...&limit=...`

说明：
- 首次请求可传 ISO timestamp
- 后续请求应回传服务端返回的 opaque `next_since` cursor
- cursor 内部包含 `occurred_at + sync_event_id`，避免同一时间戳分页丢事件

---

## 4) 事件模型

### 4.1 Topics
- `weavenyc/{community_id}/posts`
- `weavenyc/{community_id}/announcements`
- `weavenyc/{community_id}/reports`

### 4.2 Event types
- `post.published`
- `post.updated`
- `post.tombstoned`
- `announcement.published`
- `announcement.updated`
- `announcement.deleted`
- `report.created`
- `moderation.decision`

### 4.3 Event envelope
```ts
type P2PEventEnvelope = {
  sync_event_id: string;
  community_id: string;
  topic: string;
  event_type: "post.published" | "post.updated" | "post.tombstoned" | "announcement.published" | "announcement.updated" | "announcement.deleted" | "report.created" | "moderation.decision";
  aggregate_type: "post" | "announcement" | "report" | "moderation";
  aggregate_id: string;
  occurred_at: string;
  actor_p2p_id?: string | null;
  cid: string | null;
  payload: Record<string, unknown> | null;
};
```

约束：
- 不暴露 `actor_user_id`
- `actor_p2p_id` 是按社区派生的匿名 actor 标识
- 当前 runtime 仍是 unsigned event stream；签名 helper 仅保留为未来扩展，不属于当前 M6 runtime contract
- payload 只写当前 overlay 会实际传播的最小字段集；`detail_text`、`conversation_id`、`affected_user_id` 这类聊天/审计上下文字段不进入社区同步流

### 4.4 Payload discipline

`post.*`
- `payload.post` 为当前帖子摘要
- 可带 `reason`

`announcement.*`
- `payload.announcement` 为当前公告摘要

`report.created`
- 只同步 post-target report
- runtime payload 只包含 `report_id`, `target_type`, `target_id`, `reason`, `status`, `created_at`

`moderation.decision`
- 只同步 post-target moderation
- `aggregate_id` 对应触发本次决策的 `moderation_actions.action_id`，不是 `report_id`
- runtime payload 只包含 `report_id`, `target_type`, `target_id`, `report_target_type`, `report_target_id`, `resolution`, `status`, `decided_at`

---

## 5) 版本与内容标识

M6 当前没有分布式内容获取网络，但已经把版本和内容标识接入 authoritative records：

- `posts.p2p_version`
- `posts.ipfs_cid`
- `announcements.p2p_version`
- `announcements.ipfs_cid`

当前语义：
- `p2p_version` 单调递增
- `ipfs_cid` 由 DAG JSON 内容计算得到，作为内容标识和 replay 校验字段
- 当前分支 **不会** 通过 Helia/IPFS 网络去 fetch 这些 blocks；CID 用于版本化和同步校验，不代表已实现内容交换网络

冲突规则：
- 内容：`p2p_version` 更高者覆盖
- 审核/处置：**Anchor wins**

---

## 6) 持久化与回放

### 6.1 PostgreSQL
`community_sync_events`

用途：
- 作为 branch-local M6 的 durable replay log
- 支撑 `/sync` catch-up
- 支撑 snapshot 统计

说明：
- 事件写入发生在 HTTP 成功落库之后
- live broadcast 走 Redis Pub/Sub
- durable replay 走 Postgres

### 6.2 Dexie
本地缓存表：
- `postCache`
- `announcementCache`
- `p2pKeys`
- `p2pSyncState`
- `p2pEventCursor`

说明：
- worker 收到 live event 或 catch-up delta 后，会把帖子/公告只读缓存落进 Dexie
- 离线时 `/community` 回退到 Dexie cache
- M6 不支持离线写入后再合并

---

## 7) 隐私与边界

### 7.1 身份
- 事件中不暴露 `user_id`
- 只暴露匿名 `actor_p2p_id`

### 7.2 位置
- 当前同步摘要只保留 `location_zip`
- 不把精确坐标带入社区 overlay

### 7.3 安全事件
- 只同步 post-target safety state
- 不把 user/message report、conversation_id、affected_user_id 等聊天上下文带入 overlay

### 7.4 聊天
- M6 不做 P2P 聊天或 message sync
- 聊天继续走当前中心化 WebSocket 中继

---

## 8) Stretch demo path

当前 branch-local M6 manual stretch demo 路径固定为：
1. 设备 A、设备 B 加入同一社区
2. 两端都开启 `/community` 上的 P2P sync
3. 两端通过 `/bootstrap` 获得 websocket URL 和 topics
4. A 通过现有 HTTP API 创建帖子或 Anchor 发布公告
5. `api-gateway` 在写入成功后追加 `community_sync_events`，再向 live stream 广播
6. 在 live socket 已连通的手工 demo 下，B 应更新社区只读缓存而无需整页刷新
7. B 断线后恢复时，通过 `/sync` + opaque cursor 补齐遗漏事件

---

## 9) 当前技术依赖

| 组件 | 当前实现 | 用途 |
|------|----------|------|
| Event / DAG helper | `packages/p2p` | CID、canonicalize、merge/replay helper |
| Durable replay | PostgreSQL | `community_sync_events` |
| Live broadcast | Redis Pub/Sub | 向 websocket 连接广播社区事件 |
| Browser cache | Dexie / IndexedDB | 离线帖子与公告缓存 |
| Browser sync runtime | WebWorker + WebSocket + HTTP catch-up | 在线订阅与离线恢复 |

说明：
- `packages/p2p` 当前不是 libp2p node implementation
- `mDNS` 为实验性 demo 开关，不是默认路径
