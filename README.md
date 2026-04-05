# WeaveNYC

状态：`M0 scaffold complete` -> `M1 pending`

WeaveNYC 是一个面向纽约弱势社区的隐私优先互助平台。当前仓库已经从 docs-first planning repo 进入可本地 bootstrap 的 `M0` 状态：workspace、PWA、Anchor Admin、API gateway、DB migration/seed、local infra、CI stub 都已落地；`M1` 之后的资源搜索、发帖、匹配、聊天业务仍按阶段继续实现。

---

## Root Layout

- `apps/`：前端应用，包含 `pwa/` 和 `anchor-admin/`
- `services/`：后端服务，`api-gateway/` 可运行，其余 4 个服务为 M0 placeholder
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
2. [docs/01_Vision_And_Principles.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/01_Vision_And_Principles.md)
3. [docs/02_PRD.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/02_PRD.md)
4. [docs/03_User_Flows_And_Screens.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/03_User_Flows_And_Screens.md)
5. [docs/13_Implementation_Plan.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/13_Implementation_Plan.md)
6. [docs/14_Backlog.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/14_Backlog.md)
7. [docs/16_Contribution_Guide.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/16_Contribution_Guide.md)
8. [docs/18_Auth_Design.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/18_Auth_Design.md), [docs/09_API_Spec.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/09_API_Spec.md), [docs/08_Data_Model.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/08_Data_Model.md), [docs/20_DB_Schema_Reference.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/20_DB_Schema_Reference.md)

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

Current runnable M0 surface:

- `GET /healthz`
- `GET /readyz`
- `POST /v1/auth/anonymous`
- `GET /v1/me`
- PWA home with API health + anonymous session button
- Anchor Admin home with API health + login placeholder

---

## Execution Snapshot

1. `P0` 文档冻结与命名统一
2. `M0` 工程骨架与本地开发闭环
3. `M1` 官方资源目录
4. `M2` 发帖与社区可见性
5. `M3` 匹配与行动方案
6. `M4` 双向同意联系与聊天安全
7. `M5` Anchor Admin 与试点准备
8. `M6` P2P 同步（可选加分）

详细内容见 [docs/13_Implementation_Plan.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/13_Implementation_Plan.md)。

---

## Archive

- `archive/legacy-slides/`：旧 PPT、slide 生成脚本和视觉交付物
- `archive/project-history/`：midterm proposal、教授反馈和保留版讲稿
