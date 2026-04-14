# WeaveNYC

状态：`main = M5 completed (canonical baseline)` · `feature/m6-p2p-sync = M6 in progress`

WeaveNYC 是一个面向纽约弱势社区的隐私优先互助平台。`main` 是唯一 canonical baseline，当前主线已经收口到 `M5 completed`。当前执行分支 `feature/m6-p2p-sync` 正在给现有 HTTP-first 产品加一层 P2P sync overlay，但不会把未实现的 M6 surface 冒充成 `main` 已上线能力。

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
7. [docs/26_M5_Closeout.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/26_M5_Closeout.md)
8. [docs/01_Vision_And_Principles.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/01_Vision_And_Principles.md)
9. [docs/02_PRD.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/02_PRD.md)
10. [docs/03_User_Flows_And_Screens.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/03_User_Flows_And_Screens.md)
11. [docs/13_Implementation_Plan.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/13_Implementation_Plan.md)
12. [docs/14_Backlog.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/14_Backlog.md)
13. [docs/16_Contribution_Guide.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/16_Contribution_Guide.md)
14. [docs/18_Auth_Design.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/18_Auth_Design.md), [docs/09_API_Spec.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/09_API_Spec.md), [docs/08_Data_Model.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/08_Data_Model.md), [docs/20_DB_Schema_Reference.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/20_DB_Schema_Reference.md)

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
- PWA routes: `/posts/[postId]/matches`, `/inbox`, `/conversations/[conversationId]`
- Legacy compatibility redirect: `/contact-requests` -> `/inbox`
- Anchor Admin routes: `/login`, `/activate`, `/`, `/review`, `/announcements`, `/rules`
- Opt-in live-source smoke: `pnpm test:live-sources`

- `POST /v1/auth/anchor/activate`
- `POST /v1/auth/anchor/activate/confirm`
- `POST /v1/auth/anchor/session/start`
- `POST /v1/auth/anchor/session/verify`
- `GET /v1/admin/review_queue?community_id=...&cursor=...`
- `GET /v1/admin/report_queue?community_id=...&status=...&cursor=...`
- `POST /v1/admin/review_queue/:post_id/decision`
- `POST /v1/admin/report_queue/:report_id/decision`
- `GET /v1/admin/communities/:community_id/dashboard`
- `GET /v1/admin/communities/:community_id/rules`
- `PUT /v1/admin/communities/:community_id/rules`
- `GET /v1/admin/communities/:community_id/announcements`
- `POST /v1/admin/communities/:community_id/announcements`
- `PATCH /v1/admin/communities/:community_id/announcements/:announcement_id`
- `DELETE /v1/admin/communities/:community_id/announcements/:announcement_id`

Current verification split:

- Canonical `main` baseline gates: `pnpm install --frozen-lockfile` -> `typecheck` -> `lint` -> `test` -> `build`
- Canonical integration gates: `pnpm db:migrate` -> `pnpm db:seed` -> `pnpm test:smoke:real` -> `pnpm test:e2e`
- `pnpm test:smoke:real` self-starts `api-gateway` when `/readyz` is unavailable, and only counts after a fresh `pnpm db:migrate` + `pnpm db:seed` on the current local database.
- Branch-local M6 overlay smoke: `pnpm test:smoke:p2p`
- Manual / opt-in: `pnpm test:live-sources`, `pnpm dev:mint-anchor-token`
- Formal `M1 completed` status closed on `2026-04-06`
- Current canonical phase status is `M5 completed`; closeout truth lives in `docs/26_M5_Closeout.md`

---

## Execution Snapshot

1. `P0` 文档冻结与命名统一
2. `M0` 工程骨架与本地开发闭环
3. `M1` 官方资源目录与扩展认证
4. `M2` 发帖与社区可见性
5. `M3` 匹配与行动方案
6. `M4` 联系、聊天与安全
7. `M5` Anchor Admin 与试点准备
8. `M6` P2P 同步 overlay（in progress on branch）

详细内容见 [docs/13_Implementation_Plan.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/13_Implementation_Plan.md)。

---

## Archive

- `archive/legacy-slides/`：旧 PPT、slide 生成脚本和视觉交付物
- `archive/project-history/`：midterm proposal、教授反馈和保留版讲稿
