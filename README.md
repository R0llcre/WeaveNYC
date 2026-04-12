# WeaveNYC

状态：`main = M2 completed (canonical baseline)` · `feature/m4-chat-safety = M4 completed on branch`

WeaveNYC 是一个面向纽约弱势社区的隐私优先互助平台。`main` 仍是唯一 canonical baseline。当前工作分支 `feature/m4-chat-safety` 的 M3/M4 进度只在各自 closeout 文档里作为 branch status 记录，不作为主线基线；当前 branch 已完成的内容包括 matching、recipient inbox、live chat、block/report、sensitive-content interception 和 WebSocket realtime。

---

## Root Layout

- `apps/`：前端应用，包含 `pwa/` 和 `anchor-admin/`
- `services/`：后端服务，`api-gateway/` 可运行，`resource-directory/` 是 M1 的导入/解析/CLI 宿主，`posts/` 是 M2 domain library，`match/` 是 M3 domain library，`chat/` 是 M4 domain library，二者都不单独启动
- `packages/`：共享 contracts、数据库层、测试工具
- `infra/`：本地基础设施和 dev bootstrap artifacts
- `docker-compose.yml`：根目录 bootstrap 入口，和 `infra/docker-compose.yml` 保持一致
- `docs/`：canonical 文档
- `diagrams/`：Mermaid 源文件和渲染图
- `templates/`：运营/合作模板
- `archive/`：历史交付物和项目历史资料

---

## Start Here

1. [docs/00_Execution_Baseline.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/00_Execution_Baseline.md)
2. [docs/21_M0_Closeout.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/21_M0_Closeout.md)
3. [docs/22_M1_Closeout.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/22_M1_Closeout.md)
4. [docs/23_M2_Closeout.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/23_M2_Closeout.md)
5. [docs/24_M3_Closeout.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/24_M3_Closeout.md)
6. [docs/25_M4_Closeout.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/25_M4_Closeout.md)
7. [docs/01_Vision_And_Principles.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/01_Vision_And_Principles.md)
8. [docs/02_PRD.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/02_PRD.md)
9. [docs/03_User_Flows_And_Screens.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/03_User_Flows_And_Screens.md)
10. [docs/13_Implementation_Plan.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/13_Implementation_Plan.md)
11. [docs/14_Backlog.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/14_Backlog.md)
12. [docs/16_Contribution_Guide.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/16_Contribution_Guide.md)
13. [docs/18_Auth_Design.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/18_Auth_Design.md), [docs/09_API_Spec.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/09_API_Spec.md), [docs/08_Data_Model.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/08_Data_Model.md), [docs/20_DB_Schema_Reference.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/20_DB_Schema_Reference.md)

---

## Bootstrap

```bash
pnpm install
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Expected endpoints:

- PWA: `http://localhost:3000`
- Anchor Admin: `http://localhost:3001`
- API: `http://localhost:4000`
- Swagger: `http://localhost:4000/docs`

Current stable surface on `main`:

- Only treat the items below as runnable after `docker compose up -d`, `pnpm db:migrate`, `pnpm db:seed`, and either `pnpm dev` or a started API process have all completed successfully.

- `GET /healthz`
- `GET /readyz`
- `POST /v1/auth/anonymous`
- `POST /v1/auth/refresh`
- `POST /v1/auth/otp/start`
- `POST /v1/auth/otp/verify`
- `POST /v1/auth/magic-link/start`
- `POST /v1/auth/magic-link/verify`
- `GET /v1/me`
- `GET /v1/resources`
- `GET /v1/resources/:provider_id`
- PWA routes: `/`, `/resources/[providerId]`, `/verify`, `/dev/m0`, `/community`, `/community/join`, `/posts/new`, `/posts/[postId]`, `/posts/mine`
- Anchor Admin home with API health + login placeholder
- Opt-in live-source smoke: `pnpm test:live-sources`

Branch-local surface on `feature/m4-chat-safety`:

- `POST /v1/community-access/resolve`
- `POST /v1/communities/:community_id/join`
- `POST /v1/posts`
- `GET /v1/posts`
- `GET /v1/posts/:post_id`
- `GET /v1/posts/mine`
- `PATCH /v1/posts/:post_id`
- `POST /v1/posts/:post_id/close`
- `DELETE /v1/posts/:post_id`
- `GET /v1/admin/review_queue`
- `POST /v1/admin/review_queue/:post_id/decision`
- `POST /v1/speech/transcribe`
- `GET /v1/posts/:post_id/matches`
- `POST /v1/match/contact`
- `GET /v1/contact-requests/inbox`
- `POST /v1/contact-requests/:contact_request_id/accept`
- `POST /v1/contact-requests/:contact_request_id/reject`
- `GET /v1/conversations`
- `GET /v1/conversations/:conversation_id`
- `GET /v1/conversations/:conversation_id/messages`
- `POST /v1/conversations/:conversation_id/messages`
- `POST /v1/conversations/:conversation_id/close`
- `POST /v1/blocks`
- `POST /v1/reports`
- `GET /v1/ws/chat?token=...`
- PWA routes: `/posts/[postId]/matches`, `/inbox`, `/conversations/[conversationId]`
- Legacy compatibility redirect: `/contact-requests` -> `/inbox`
- Dev helper: `pnpm dev:mint-anchor-token`

Current verification split:

- Canonical `main` baseline gates: `pnpm install --frozen-lockfile` -> `typecheck` -> `lint` -> `test` -> `build`
- Branch-local `feature/m4-chat-safety` gates: docker bootstrap -> `pnpm test:smoke:real` -> `pnpm test:e2e`
- Manual / opt-in: `pnpm test:live-sources`
- Formal `M1 completed` status closed on `2026-04-06`
- Current branch status is `M4 completed on branch`; that progress is recorded in branch closeout docs and does not change the canonical `main` baseline

---

## Execution Snapshot

1. `P0` 文档冻结与命名统一
2. `M0` 工程骨架与本地开发闭环
3. `M1` 官方资源目录与扩展认证
4. `M2` 发帖与社区可见性
5. `M3` 匹配与行动方案
6. `M4` 联系、聊天与安全
7. `M5` Anchor Admin 与试点准备
8. `M6` P2P 同步（可选加分）

详细内容见 [docs/13_Implementation_Plan.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/13_Implementation_Plan.md)。

---

## Archive

- `archive/legacy-slides/`：旧 PPT、slide 生成脚本和视觉交付物
- `archive/project-history/`：midterm proposal、教授反馈和保留版讲稿
