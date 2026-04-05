# WeaveNYC — Data Sources (MVP)

目标：保证“上线第一天就有价值”。因此我们从一开始就把 **官方资源目录**建成可持续更新的数据产品。

---

## 1) 数据源清单

### 1.1 NYC HRA — Community Food Connection (CFC)
用途：NYC 官方 food pantry / soup kitchen 总目录（作为主数据源）。

- 形式：PDF（CFC_ACTIVE.pdf）
- 预计规模：约 500+ pantry + 70+ soup kitchen
- 更新：官方不定期更新（需定期拉取对比）

我们要做：
- 建立 `source_ingestion/cfc_active_parser`：PDF → 结构化记录（CSV/JSON）
- 每次导入生成一条 `dataset_versions` 批次记录（便于回滚与追踪）

### 1.2 Food Help NYC / Finder
用途：官方交互工具补充信息（例如 eligibility、额外描述）。

- 形式：网页（可能有公开数据接口或可抓取）
- 风险：网页结构可能变化，MVP 可先人工补录关键字段

### 1.3 Island Harvest (Long Island)
用途：Farmingdale / Long Island 专属资源补充（从 NYC 外延到 Long Island 生态）。

- 形式：网页地图目录 + 短信服务
- MVP 策略：先手工录入 20-50 个试点范围内点位，后续再自动化

### 1.4 Mutual Aid Directory
用途：Anchor 节点候选池 + 社区组织信息。

- 形式：网页目录
- MVP 策略：手工建立 `anchors` 表，记录联系人与合作状态

### 1.5 Dataset Version Registry
用途：记录每次官方目录导入的批次元数据，支撑审计、回滚和 diff。

- 表名：`dataset_versions`
- 每次导入写 1 行，记录：
  - `dataset_version`（全局唯一字符串批次键，例如 `cfc_active_2026-02-02`）
  - `source`
  - `source_label` / `source_url`（可选）
  - `record_count`
  - `active_record_count`
  - `status`（`importing` / `active` / `superseded` / `failed`）
  - `checksum`
  - `import_started_at`
  - `import_completed_at`

这个表不是资源明细本身，而是资源快照的“批次索引”。`resource_providers.dataset_version` 和 `resource_change_logs.dataset_version` 都通过该表定位某次导入批次，因此 `dataset_versions.dataset_version` 必须是可被 FK 引用的唯一键。

---

## 2) 字段映射（External → Internal）

### 2.1 Internal Schema（ResourceProvider）
最小字段：
- `provider_id` (uuid)
- `source` (enum)
- `source_ref` (string)  // 原始条目的稳定唯一键（例如名称+地址 hash）
- `name` (string)
- `type` (enum: pantry, soup_kitchen, cooling_center, other)
- `address_text` (string)
- `city` (string)
- `state` (string)
- `zip` (string)
- `phone` (string)
- `hours_json` (json)
- `languages` (string[])
- `eligibility_notes` (string)
- `content_hash` (string)
- `dataset_version` (string, FK -> `dataset_versions.dataset_version`)
- `status` (enum: active, inactive)
- `last_seen_at` (datetime)
- `last_verified_at` (datetime)
- `lat`, `lng` (float, optional)
- `geo_precision` (enum: exact, rooftop, street, zip_centroid; 默认 `zip_centroid`)

### 2.2 CFC_ACTIVE -> ResourceProvider
- Name -> `name`
- Type -> `type`
- Address -> `address_text`, `city`, `state`, `zip`
- Phone -> `phone`
- Hours -> `hours_json`（解析为结构化）

Hours JSON 示例（统一使用缩写格式，与 [20_DB_Schema_Reference §5](./20_DB_Schema_Reference.md) 种子数据一致）：
```json
{
  "mon": "09:30-12:30",
  "tue": "",
  "wed": "09:30-12:30",
  "notes": "Every 2nd Tuesday 16:00-19:00"
}
```

---

## 3) 更新策略（Data Ops）

### 3.1 版本化
- 每次导入先写 `dataset_versions` 批次记录（例如 `cfc_active_2026-02-02`）
- 资源表保留 `dataset_version` 字段并引用对应批次
- 同一 `(source, source_ref)` 在任意时刻只允许 1 条 `status = active` 的资源记录
- 支持“软删除”（如果官方下架某点位，标记 `inactive`，不立即删）

### 3.2 变更检测
- 对同一 `source_ref` 计算 `content_hash`
- 如果 hash 变化：写入 `resource_change_logs`
- 变更类型：新增 / 删除 / 字段变更（电话、开放时间、地址）

### 3.3 人工校验（试点阶段）
- 试点范围内（11735 附近）资源每 2 周人工拨号抽查 5-10 个
- 抽查结果写入 `verification_logs`

---

## 4) 地理索引与距离计算（MVP 近似即可）

### 4.1 不存精确用户坐标
- 用户侧：只存 ZIP 或 Neighborhood
- 服务侧：资源点可存经纬度（来自 geocoding），但对用户显示“approx distance”

### 4.2 Geo 字段
- `lat`, `lng`：存资源点
- `geo_precision`：enum（exact, rooftop, street, zip_centroid）
- 默认使用 `zip_centroid`，只有在完成地理编码或更精细验证后才提升到更高精度

---

## 5) 数据迁移与回滚方案

### 5.1 官方资源目录：导入回滚
如果导入了一批坏数据（解析错误、字段丢失、数据源损坏）：

**回滚步骤**：
1. 停止当前导入 job
2. 将对应 `dataset_versions.status` 标记为 `failed`
3. 将所有 `dataset_version = <坏版本>` 的记录标记为 `inactive`
4. 恢复上一个 `dataset_version` 的记录为 `active`
5. 将上一个批次在 `dataset_versions` 中标记为 `active`
6. 验证回滚后的数据完整性（数量、关键字段非空率）

```sql
-- 1. 废弃坏版本
UPDATE dataset_versions
SET status = 'failed'
WHERE dataset_version = 'cfc_active_2026-02-20_bad';

-- 2. 废弃坏版本对应的资源行
UPDATE resource_providers
SET status = 'inactive'
WHERE dataset_version = 'cfc_active_2026-02-20_bad';

-- 3. 恢复上一个好版本对应的资源行
UPDATE resource_providers
SET status = 'active'
WHERE dataset_version = 'cfc_active_2026-02-15'
  AND status = 'inactive';

-- 4. 恢复上一个好版本的批次状态
UPDATE dataset_versions
SET status = 'active'
WHERE dataset_version = 'cfc_active_2026-02-15';

-- 5. 验证
SELECT dataset_version, status, COUNT(*)
FROM resource_providers
GROUP BY dataset_version, status
ORDER BY dataset_version DESC;

-- 6. 检查批次状态
SELECT dataset_version, source, status, record_count
FROM dataset_versions
ORDER BY import_completed_at DESC NULLS LAST;
```

### 5.2 数据库 Schema 迁移

**工具**：Drizzle Kit（与 [16_Contribution_Guide](./16_Contribution_Guide.md) 中的技术栈一致）

**流程**：
1. 修改 Drizzle schema 定义文件
2. 生成 migration：`pnpm db:migrate:create`
3. 本地验证：`pnpm db:migrate`（在 dev 环境执行）
4. Code Review：migration SQL 文件随 PR 一起审查
5. Staging 执行：merge 后自动在 staging 环境执行
6. Production 执行：手动触发，配合发布流程

**回滚策略**：
- 每个 migration 必须有对应的 down migration（回滚 SQL）
- 破坏性变更（删列、改类型）必须分两步：
  1. 第一步：新增列 + 双写（保留旧列）
  2. 第二步：确认无问题后，清理旧列

**示例**：给 Post 表加字段
```sql
-- up
ALTER TABLE posts ADD COLUMN language VARCHAR(5) DEFAULT 'en';

-- down
ALTER TABLE posts DROP COLUMN language;
```

### 5.3 灾难恢复
- 全库恢复：从 PostgreSQL 每日备份恢复（详见 [11_Ops_Runbook §8](./11_Ops_Runbook.md)）
- 单表恢复：从备份中提取特定表的数据
- 点时间恢复（PITR）：后续迭代可启用 PostgreSQL WAL 归档

---

## 6) 合规与版权注意
- 对外展示时保留来源标注（Source: NYC HRA CFC / Island Harvest 等）
- 对网页抓取数据：优先用公开数据集或获得许可后再自动化
