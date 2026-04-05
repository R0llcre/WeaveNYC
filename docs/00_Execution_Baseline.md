# WeaveNYC — Execution Baseline (M0-M1)

状态：`CANONICAL`

目的：把当前仓库状态、文档优先级、以及已经冻结的 M0-M1 实现决策写成单一基线，避免继续被过期文档误导。

---

## 1) 当前仓库状态

- 当前仓库是 **docs-first planning repo**，不是已初始化完成的应用 monorepo。
- 现阶段真实存在的是：产品/架构文档、Mermaid 图、模板、归档资料。
- 根目录当前只保留：`docs/`、`diagrams/`、`templates/`、`archive/`、`README.md`、`AGENTS.md`。
- 现阶段**不存在**的内容包括：`apps/`、`services/`、`packages/`、`infra/`、`.github/workflows/`、`pnpm-workspace.yaml`、`.env.example`、根目录运行用 `package.json` 等工程骨架。
- 因此，凡是声称“现在可以直接 `pnpm dev` / `pnpm db:migrate` / 自动部署 staging”的表述，均应视为 **target-state 设计**，不是当前仓库事实。

---

## 2) 推荐阅读路径

1. `README.md`
2. 本文档（当前状态与冻结决策）
3. `01_Vision_And_Principles.md`
4. `02_PRD.md`
5. `03_User_Flows_And_Screens.md`
6. `13_Implementation_Plan.md`
7. `14_Backlog.md`
8. 只有在开始实现时再进入 `09_API_Spec.md`、`18_Auth_Design.md`、`08_Data_Model.md`、`20_DB_Schema_Reference.md`
9. `16_Contribution_Guide.md`、`19_Deployment_Guide.md` 明确属于 target-state 文档

---

## 3) 文档优先级

从现在开始，发生冲突时按以下顺序取值：

1. 本文档（`00_Execution_Baseline.md`）
2. `README.md`
3. 产品与交互：`02_PRD.md`、`03_User_Flows_And_Screens.md`
4. 工程契约：`09_API_Spec.md`、`18_Auth_Design.md`、`08_Data_Model.md`、`20_DB_Schema_Reference.md`
5. 计划与排期：`13_Implementation_Plan.md`、`14_Backlog.md`
6. 目标态说明：`16_Contribution_Guide.md`、`19_Deployment_Guide.md`

---

## 4) 冻结决策（M0-M1）

### 4.1 范围

- 允许立即开工的范围是 `M0-M1`：
  - 项目骨架
  - 官方资源目录
  - 数据导入
  - 认证最小闭环
- `P2P sync`、完整多云部署、完整 observability 属于后续阶段，不作为第一周阻塞项。

### 4.2 社区加入机制

- `M0-M1` 采用 **邀请码 / 二维码加入社区**。
- 实现路径固定为：邀请码 / 二维码 -> 创建 `community_members` -> 开放 `community_only` feed / post visibility。
- 不做开放社区搜索加入。
- `community_only` 是默认可见性，但前提是用户已经加入某个社区。
- 这条社区加入能力是 `M2` 的硬前置，没有它，`M2` 不算完成。

### 4.3 认证与身份

- `user_id` 一律使用 **UUID**。
- JWT 中的 `level` 一律使用字符串枚举：
  - `anonymous`
  - `verified`
  - `anchor`
- 匿名账户创建接口：`POST /v1/auth/anonymous`
- 升级路径：
  - 主路径：**手机号 OTP**
  - 备选路径：**邮箱 magic link**
- Token 策略冻结为：
  - `access_token`: 15 分钟
  - `refresh_token`: 7 天
- Anchor 激活接口冻结为：`POST /v1/auth/anchor/activate`

### 4.4 聊天建联

- `POST /v1/match/contact` **不直接创建 conversation**。
- 该接口只创建 `contact_request`，返回 `contact_request_id` 和 `status = pending`。
- 只有在对方接受后，才创建 `conversation`。
- `contact_request` 的最小通知实现先用 in-app pending request / inbox badge + 客户端轮询刷新，push 通知留给后续的 `E10`。
- 因此，数据模型中必须显式存在 `contact_requests`。

### 4.5 官方资源目录 canonical schema

`resource_providers` 以以下字段为准：

- `provider_id`
- `source`
- `source_ref`
- `name`
- `type`
- `address_text`
- `city`
- `state`
- `zip`
- `phone`
- `hours_json`
- `languages`
- `eligibility_notes`
- `lat`
- `lng`
- `geo_precision`
- `content_hash`
- `dataset_version`
- `status`
- `last_seen_at`
- `last_verified_at`
- `created_at`
- `updated_at`

说明：
- 这里的 `type` 统一替代 `provider_type`。
- 导入回滚依赖 `dataset_version + status`。
- 变更检测依赖 `source_ref + content_hash`。

---

## 5) 当前真正可执行的工作

今天可以直接执行的工作：

- 统一文档与契约
- 建立 monorepo skeleton 的 issue / backlog
- 画 Figma / 拆 API / 拆 schema
- 准备 `M0` 代码初始化

今天**不能**直接执行的工作：

- 按旧版 `Contribution Guide` 运行 `pnpm dev`
- 按旧版 `Deployment Guide` 跑 CI/CD 或 staging 部署
- 按旧版目录结构引用不存在的 `apps/`、`services/`、`packages/`

---

## 6) M0 完成标准

只有满足以下条件后，仓库才可被视为“工程已起盘”：

- 存在 `pnpm-workspace.yaml`
- 存在 `apps/`、`services/`、`packages/`、`infra/`
- 根 `package.json` 具备 `dev`、`build`、`lint`、`test`、`db:migrate` 脚本
- 存在 `.env.example`
- 存在本地开发基础设施定义（例如 `infra/docker-compose.yml`）
- 存在 bootstrap artifacts：`infra/dev/jwt-private.pem`、`infra/dev/jwt-public.pem`
- 服务暴露 `GET /healthz` 和 `GET /readyz`
- `docs/16_Contribution_Guide.md` 中的命令可以在仓库中真实执行
