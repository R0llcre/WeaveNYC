# 30 · PWA Frontend Redesign Plan (M8.5)

**状态**: Planning / Ready to execute
**作者**: Claude + user (2026-04-17)
**范围**: `apps/pwa/**` 全量重做。`apps/anchor-admin/**` 与所有 backend services **不动**。
**不破坏**: 所有 `data-testid` 保留（E2E 依赖）。

---

## 0 · 触发原因

用户原话：
> "你觉得现在前端怎么改善，太丑了，太不好用了，怎么就跟小学生写代码一样，一个页面做完所有东西，好恶心，找 8 个人一起想，用 design skills"

8 位设计师并行产出后，共识问题：
1. **首页洪水**: `resource-home.tsx` 塞了 9 件事（语言切换 / ZIP picker / community CTA / resources / nearby / pantry / bookmark / matches / session），违反 "每页一件事"
2. **缺 App Shell**: 所有页面独立 render，无底部 tab bar，切页像在浏览网页而不是用 app
3. **视觉层级混乱**: 卡阴影全部相同、字阶无 overline 辅助、无明显 elevation 分层
4. **文案过长**: 按钮冗长、空态 2-3 句话、无 call-to-action 聚焦
5. **品牌弱**: 只有绿色单色调，无 category icon 系统，空态无插画
6. **移动端手感差**: 无 pull-to-refresh、无 press microinteraction、未处理 safe-area-inset

---

## 1 · 8 位设计师要点（原始归档）

| # | 领域 | 核心建议 |
|---|---|---|
| D1 | IA (信息架构) | 5-tab 底栏 (Home/Community/Post+/Inbox/Me)；`/me` 聚合 settings+verify+language；onboarding 为 takeover flow |
| D2 | App Shell | `<AppShell>` wrapper（top bar + scroll + bottom tab）；Framer Motion 页间滑入；z-index scale；swipe-back |
| D3 | Visual Hierarchy | 3 级视觉分层；字阶收紧（h1 32/40, h2 17/24+overline, body 15/22）；4 级 shadow elevation；Home 只留 1 张"主 CTA 卡" |
| D4 | Home Redesign | Home 只做 "discover nearby help"；empty/loading/loaded 三态；Community CTA 移到 tab；post+ 改 FAB |
| D5 | ResourceCard | 整卡可点；行 1=title+distance、行 2=hours、行 3=address；右侧 icon buttons (📞/🧭)；category icon |
| D6 | Copy | 15 条 before/after 重写；按钮 ≤3 词；空态 =1 句 + 1 CTA |
| D7 | Mobile Feel | 3h 具体 plan：manifest fix / bottom tab / pull-to-refresh / press scale / safe-area 审计 |
| D8 | Brand | 扩展色板（community 紫/urgent 橙/verified 绿）；SVG category icons；unDraw 空态插画；weave-pattern hero；DM Sans for h1 only |

---

## 2 · 5 个最大杠杆点（按 ROI 排序）

1. **拆洪水首页 + 5-tab 底栏** (D1+D4) — 产品骨架级别改动
2. **持久化 AppShell** (D2+D7) — 从网页变 app
3. **ResourceCard 原子 + 文案精简** (D5+D6) — 最常看的元素
4. **视觉分层收紧** (D3+D8) — 收尾打磨
5. **品牌微升** (D8) — 调色板 / 插画 / 字体

---

## 3 · 核心约束

- 所有 `data-testid` 值保留（见 §7 "testid 保护清单"）
- i18n 三语全覆盖（en/es/zh），**禁止硬编码**
- Next.js `output: 'export'` 静态导出兼容（不能用 Server Actions / dynamic = 'force-dynamic'）
- Anchor Admin (`apps/anchor-admin/**`) 完全不动
- Backend services (`services/**`) 完全不动
- `requestJson` Content-Type fix 不要退回
- 保留 `use-session-bootstrap` / `use-chat-websocket` / `safe-return-to` / `selectors.ts` 现有 utils

---

## 4 · 7 Wave 编排

### Wave 1 · 地基层（4 agent 并行）

| agent | 交付 | 文件 |
|---|---|---|
| **1A** Design tokens | globals.css 收紧：4 级 shadow、字阶 (h1 32/40, h2 17/24+overline, body 15/22)、扩展色板 (community 紫 / urgent 橙 / verified 绿 / 4.5:1 对比) | `apps/pwa/src/app/globals.css` |
| **1B** Atoms 完善 | 完善现有 8 atoms，新增 Icon/Avatar/Skeleton/Toast/Tag/IconButton/**ResourceCard**/EmptyState（共 15 atoms）| `apps/pwa/src/components/ui/*.tsx` |
| **1C** 品牌资源 | 12 category SVG icons、5 empty-state 插画、weave-pattern hero | `apps/pwa/src/assets/icons/*.svg`, `apps/pwa/src/assets/illustrations/*.svg` |
| **1D** i18n keys | 80 新 keys × 3 lang（按钮 ≤3 词、空态 ≤1 句） | `apps/pwa/src/lib/i18n.ts` |

**验收门**: `pnpm --filter @weavenyc/pwa build` 绿；atoms 在 storybook 式测试页可渲染。

### Wave 2 · 导航骨架（4 agent 并行）

| agent | 交付 | 文件 |
|---|---|---|
| **2A** AppShell 组件 | `<AppShell>` + `<TopBar>` + `<BottomTabBar>`（5 tab：Home/Community/Post+/Inbox/Me）；safe-area-inset；skip-link 透传 | `apps/pwa/src/components/shell/*.tsx` |
| **2B** 路由重构 | 新建 `/me` 路由聚合 settings+verify+language；onboarding 为 takeover flow 绕 shell | `apps/pwa/src/app/me/`, `apps/pwa/src/app/onboarding/**` |
| **2C** Layout 接入 | `layout.tsx` wrap AppShell；onboarding layout 独立；Redux/Query/skip-link 保留 | `apps/pwa/src/app/layout.tsx`, `apps/pwa/src/app/onboarding/layout.tsx` |
| **2D** 路由守卫 | `onboardingComplete` 判断 + `safe-return-to` whitelist 整合 | `apps/pwa/src/lib/route-guard.ts` (new) |

**验收门**: 13 页渲染不崩；bottom tab 切换 route 不 remount shell；onboarding 页不显示 tab bar。

### Wave 3 · 核心三页（3 agent 并行）

| agent | 交付 | 文件 |
|---|---|---|
| **3A** Home 拆分 | **只做 discover nearby help**：Hero → 搜索 → 3-5 张 `<ResourceCard>` → empty/loading/loaded。**砍掉**：community CTA（移 tab）、language/ZIP picker（移 onboarding）、pantry module 折叠到 filter。保留 testid: `create-session`, `see-nearby`, `bookmark-*`, `resource-detail-*` | `apps/pwa/src/components/resource-home.tsx` |
| **3B** Community + Join | Community 卡式 mode 选择（invite / QR / resolve）；成功态独立；保留 testid: `join-community`, `join-mode-invite`, `join-mode-qr`, `resolve-community`, `confirm-join` | `apps/pwa/src/components/community-screen.tsx`, `community-join-screen.tsx` |
| **3C** Me 新页面 | 聚合 user info + verify status + language / privacy / account / signout / danger zone；`<Card>` 分组；danger zone 独立区 | `apps/pwa/src/components/me-screen.tsx` (new) |

**验收门**: 三页所有 data-testid 在 DOM；Home `useEffect` onboarding guard 生效；`/me` 可到达 settings/verify 子流程。

### Wave 4 · 内容功能页（3 agent 并行）

| agent | 交付 | 文件 |
|---|---|---|
| **4A** Posts 四页 | Compose（单字段 focus）、Detail（卡分层）、Mine（EmptyState atom）、Matches（ResourceCard 变体）；保留 testid: `select-request`, `select-offer`, `preview-post`, `publish-post`, `browser-speech` | `apps/pwa/src/components/post-*.tsx` (4 files) |
| **4B** Inbox + Conversation | Inbox 列表 density 收紧；Conversation 气泡 4 级 elevation；Placeholder 用 EmptyState | `apps/pwa/src/components/inbox-*.tsx`, `conversation-*.tsx`, `placeholder-*.tsx` |
| **4C** Resource Detail | Cover + 双 CTA (📞/🧭) + metadata grid + bookmark；保留 testid: `resource-detail-*`, `bookmark-*` | `apps/pwa/src/components/resource-detail-screen.tsx` |

**验收门**: 10 页 testid 保留；Inbox WebSocket 正常连接；Conversation 滚动 60fps。

### Wave 5 · Onboarding + Auth

| agent | 交付 | 文件 |
|---|---|---|
| **5A** Onboarding Language | 三语大按钮（各按目标语言显示）；无 shell；进 → 5B | `apps/pwa/src/components/language-picker-screen.tsx` |
| **5B** Onboarding Location | ZIP + "use my location" + 社区建议；skip 落 `/me` | `apps/pwa/src/components/location-gate-screen.tsx` |
| **5C** Verify 子路由 | `/me/verify` 嵌套 flow，回退 `/me`；保留 testid: `send-code`, `verify-code`, `verify-title` | `apps/pwa/src/components/verify-screen.tsx`, `apps/pwa/src/app/me/verify/page.tsx` (new) |

**验收门**: 首次访问强制走 language → location；三语切换不硬编码；ZIP 落 Redux preferences。

### Wave 6 · 微交互打磨

| agent | 交付 |
|---|---|
| **6A** Framer Motion | 页间 slide；tab 切换 fade；modal scale |
| **6B** Pull-to-refresh | Home + Inbox，用 `touchstart/move/end` 事件 |
| **6C** Button press | `scale(0.98)` + iOS Safari `navigator.vibrate(10)` |
| **6D** a11y 复核 | focus-visible 环；async 区 aria-live；对比度 4.5:1；键盘 tab 顺序 |

**验收门**: 无 jank（60fps）；Chrome DevTools a11y audit 0 error；VoiceOver 可读。

### Wave 7 · 全量验证

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm --filter @weavenyc/pwa build      # 确认 static export 产物正常
pnpm test:e2e                          # 13 页 testid 全保留
```

**人工清单**:
- 13 页 before/after 截图对比
- Lighthouse mobile ≥ 90 分
- iPhone Safari 真机 safe-area 渲染
- 三语切换每页巡视

---

## 5 · 文件清单（新增 / 改写）

### 新增
- `apps/pwa/src/components/ui/ResourceCard.tsx`
- `apps/pwa/src/components/ui/EmptyState.tsx`
- `apps/pwa/src/components/ui/Icon.tsx`
- `apps/pwa/src/components/ui/Avatar.tsx`
- `apps/pwa/src/components/ui/Skeleton.tsx`
- `apps/pwa/src/components/ui/Toast.tsx`
- `apps/pwa/src/components/ui/Tag.tsx`
- `apps/pwa/src/components/ui/IconButton.tsx`
- `apps/pwa/src/components/shell/AppShell.tsx`
- `apps/pwa/src/components/shell/TopBar.tsx`
- `apps/pwa/src/components/shell/BottomTabBar.tsx`
- `apps/pwa/src/components/me-screen.tsx`
- `apps/pwa/src/lib/route-guard.ts`
- `apps/pwa/src/app/me/page.tsx`
- `apps/pwa/src/app/me/verify/page.tsx`
- `apps/pwa/src/app/onboarding/layout.tsx`
- `apps/pwa/src/assets/icons/*.svg` (12 category icons)
- `apps/pwa/src/assets/illustrations/*.svg` (5 empty states + hero)

### 改写
- `apps/pwa/src/app/globals.css`
- `apps/pwa/src/app/layout.tsx`
- `apps/pwa/src/app/page.tsx`（root）
- `apps/pwa/src/lib/i18n.ts`
- 所有 `apps/pwa/src/components/*-screen.tsx`（13 个）
- 所有 `apps/pwa/src/components/ui/*.tsx`（现有 8 atoms 补 props）

### 不动
- `apps/pwa/src/lib/api.ts`（保留 Content-Type 修复）
- `apps/pwa/src/lib/use-session-bootstrap.ts`
- `apps/pwa/src/lib/use-chat-websocket.ts`
- `apps/pwa/src/lib/safe-return-to.ts`
- `apps/pwa/src/lib/selectors.ts`
- `apps/pwa/src/lib/slices/**`（Redux slices）
- `apps/anchor-admin/**` 全部
- `services/**` 全部
- `packages/**` 全部

---

## 6 · 5-Tab 路由结构

```
/                          → Home (discover nearby)          [tab 1]
/community                 → Community hub                    [tab 2]
/community/join            ↳ Join flow (invite/QR/resolve)
/post                      → Post Compose (FAB → takeover)    [tab 3]
/post/mine                 ↳ My posts
/post/:id                  ↳ Post detail
/post/:id/matches          ↳ Matches
/inbox                     → Inbox list                       [tab 4]
/inbox/:conversationId     ↳ Conversation
/me                        → Me hub                           [tab 5]
/me/verify                 ↳ Phone/email verification
/me/settings               ↳ Settings subpage
/me/danger                 ↳ Account delete (rate-limited)
/resource/:id              → Resource detail (no tab change)
/onboarding/language       → Takeover (no shell)
/onboarding/location       → Takeover (no shell)
```

---

## 7 · testid 保护清单（E2E 依赖 — 必须保留）

### Home
- `create-session`, `see-nearby`, `bookmark-{id}`, `resource-detail-{id}`

### Community / Join
- `join-community`, `join-mode-invite`, `join-mode-qr`, `resolve-community`, `confirm-join`

### Verify
- `send-code`, `verify-code`, `verify-title`

### Post
- `select-request`, `select-offer`, `preview-post`, `publish-post`, `browser-speech`

### Resource Detail
- `resource-detail-{field}`, `bookmark-{id}`

### Inbox / Conversation
- 已有全保留

**策略**: Wave 3-5 每个 agent 的 prompt 附上本清单，提交前 `grep -r "data-testid" apps/pwa/src/components/` 对照检查。

---

## 8 · 验证端到端

```bash
# 类型 + lint + 单元
pnpm typecheck && pnpm lint && pnpm test

# 构建（静态导出）
pnpm --filter @weavenyc/pwa build
# 产物在 apps/pwa/out/，检查路由树

# E2E
pnpm test:e2e

# 本地预览
pnpm --filter @weavenyc/pwa dev
# 手工 13 页 + 三语 + onboarding 首跑
```

**Staging 验证**（代码合并后）:
```bash
gh workflow run deploy-pwa && gh run watch
# 访问 https://weavenyc.org 手工巡视
```

---

## 9 · 风险与回滚

| 风险 | 缓解 |
|---|---|
| E2E 大量破坏 | Wave 3-5 每 agent 提交前 grep testid；Wave 7 全 e2e；若破坏，revert 单 wave |
| 静态导出不支持的 API | Framer Motion 纯 client 组件、pull-to-refresh 纯 touch 事件、无 Server Actions |
| Safari/iOS 兼容 | safe-area-inset 测试；press scale 降级到非 haptic |
| i18n 漏翻 | Wave 1D 完成后生成 key 对照表；每 wave 的 PR description 附 key diff |
| context 溢出 | 每 wave 产出单独 PR；完成后 `/clear` 重载 |

**回滚**: 每 wave 独立 PR，任何一个 wave 出问题 revert 单 PR。

---

## 10 · 执行顺序与 checkpoint

1. **W1** → 我验收 tokens + atoms 清单 → 用户确认
2. **W2** → 我验收 shell 渲染 + 5 tab 切换 → 用户确认
3. **W3** → 我验收三页 testid + Home 拆分结果 → 用户确认
4. **W4** → 我验收 10 页
5. **W5** → 我验收 onboarding 首跑
6. **W6** → 我验收微交互
7. **W7** → `pnpm test:e2e` 全绿 + 手工巡视 + staging 部署

每 checkpoint 我给用户 before/after 截图。

---

## 11 · 非目标 (Non-goals)

- 不改 Anchor Admin
- 不改后端 API 形状
- 不改数据库 schema
- 不重写 Redux slices（可微调 selectors 但不改结构）
- 不引入新大型 UI 库（保持纯手写 + Framer Motion）
- 不做 dark mode（pilot 阶段不值）
- 不做 PWA install prompt（Wave 6.5 如果时间够）

---

## 12 · 后续记录

Wave 完成后在本文 §12 追加：
- PR 链接
- 每页 before/after 截图链接
- 遗留问题 / 二次 review finding
