# WeaveNYC

状态：`M1 completed` -> `M2 pending`

WeaveNYC 是一个面向纽约弱势社区的隐私优先互助平台。当前仓库的 **M1 已正式关闭**：official resource directory、CFC / Island Harvest adapters、资源搜索/详情、PWA 首页资源体验、OTP 升级、refresh rotation、magic-link fallback、real API smoke、fixture-backed browser smoke 都已经通过本轮 closeout 验证。下一阶段入口现在统一是 `M2`。

---

## Root Layout

- `apps/`：前端应用，包含 `pwa/` 和 `anchor-admin/`
- `services/`：后端服务，`api-gateway/` 可运行，`resource-directory/` 是 M1 的导入/解析/CLI 宿主，`posts/`、`match/`、`chat/` 仍是后续阶段 placeholder
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
4. [docs/01_Vision_And_Principles.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/01_Vision_And_Principles.md)
5. [docs/02_PRD.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/02_PRD.md)
6. [docs/03_User_Flows_And_Screens.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/03_User_Flows_And_Screens.md)
7. [docs/13_Implementation_Plan.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/13_Implementation_Plan.md)
8. [docs/14_Backlog.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/14_Backlog.md)
9. [docs/16_Contribution_Guide.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/16_Contribution_Guide.md)
10. [docs/18_Auth_Design.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/18_Auth_Design.md), [docs/09_API_Spec.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/09_API_Spec.md), [docs/08_Data_Model.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/08_Data_Model.md), [docs/20_DB_Schema_Reference.md](/Users/kairan/Documents/Spring26/WeaveNYC/docs/20_DB_Schema_Reference.md)

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

Current runnable M1 surface:

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
- PWA routes: `/`, `/resources/[providerId]`, `/verify`, `/dev/m0`
- Anchor Admin home with API health + login placeholder
- Real API smoke: `pnpm test:smoke:real`
- Fixture-backed browser smoke: `pnpm test:e2e`
- Opt-in live-source smoke: `pnpm test:live-sources`

Current verification split:

- Default CI: `pnpm install --frozen-lockfile` -> `typecheck` -> `lint` -> `test` -> `build` -> docker bootstrap -> `pnpm test:smoke:real` -> `pnpm test:e2e`
- Manual / opt-in: `pnpm test:live-sources`
- Formal `M1 completed` status closed on `2026-04-06`; next phase is `M2 pending`

---

## Execution Snapshot

1. `P0` 文档冻结与命名统一
2. `M0` 工程骨架与本地开发闭环
3. `M1` 官方资源目录与扩展认证
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
