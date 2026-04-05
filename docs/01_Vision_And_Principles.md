# WeaveNYC — Vision & Principles

## 1) 产品一句话
在纽约（先从 Farmingdale 11735 / Queens 113xx/114xx / Bronx 104xx 起），让居民可以在 **1 分钟内**找到/提供：
- **官方资源**：pantry、soup kitchen、福利点、避暑/避难点、311/社区服务目录
- **邻里互助**：食物/物资分享、短时照护、陪伴、语言协助、交通搭载等

并以“默认本地存储 + 社区自治”的方式解决弱势人群最核心的两大顾虑：**隐私** 与 **信任**。

## 2) 北极星指标（North Star Metric）
**Verified Matches / Week（每周已验证匹配数）**

定义：一次匹配 = 需求方确认收到帮助/资源信息，且通过 Anchor/见证机制达到“已验证”状态。

### 2.1 支撑指标（Leading Indicators）
- Time to First Value（TTFV）：首次打开到看到“可行动方案”≤ 30 秒
- Time to First Match：注册后 24 小时内发生首次匹配的用户占比
- Match Completion Rate：进入匹配流程的请求中，最终完成/确认的比例
- Safety Incident Rate：每 1000 个互动中的举报/拦截/封禁事件（越低越好）
- Anchor Engagement：Anchor 每周审核/公告发布次数

## 3) 目标用户（Personas）
> 详细见 [02_PRD](./02_PRD.md)，这里只列最关键的”谁每天会用”。

1. **资源求助者（Need Seeker）**
   - 特征：低收入/移民/老人/单亲家庭/临时失业
   - 任务：今晚找食物、临时托儿、陪伴/翻译、交通搭载
   - 数据支撑：纽约超过 100 万居民（15%）面临食物不安全，Bronx 达 20.2%（其中儿童 33.2%）；约 250 万纽约人为 Limited English Proficient（LEP）（来源：NYC Food Policy Report 2024; NYC Language Access Report）

2. **资源提供者（Helper）**
   - 特征：社区志愿者、邻居、学生、教会/社团成员
   - 任务：发”我有多余食物/衣物/时间”，快速、安全地完成交付
   - 数据支撑：COVID 期间 Bed-Stuy Strong 一个社区就服务了 28,000 人、募集 $1.2M；但节后志愿者流失率达 70%——说明有意愿帮助的人很多，但缺少可持续的平台（来源：City Limits, 2021）

3. **Anchor 管理员（Community Moderator）**
   - 特征：教会/NGO/社区中心工作人员或志愿者
   - 任务：审核高风险贴子、发布公告、配置本社区规则、管理黑名单
   - 数据支撑：NYC 有 700+ 社区花园、数十个 Community Fridge 站点，背后是大量活跃的社区组织，但目前缺少统一的数字化治理工具（来源：OASIS NYC; One Love Community Fridge）

## 4) 核心使用场景（MVP 只抓 3 个）
1. **找官方资源（零冷启动）**
   - 输入 ZIP → 显示今天开放的 pantry/soup kitchen（电话、地址、开放时间、导航）

2. **发互助请求并匹配（高频）**
   - 一句话语音/文本发布“今晚缺晚餐 2 人份”→ 60 秒内给出 3 个可行动方案（邻里分享 + 官方资源）

3. **安全交付（信任闭环）**
   - Anchor 审核 + 多人见证（witness）→ 降低骚扰与诈骗

## 5) 产品原则（写死，后面所有决策都要对齐）
1. **默认隐私**：
   - 默认本地存储；默认不公开精确定位；默认不要求实名

2. **低门槛**：
   - 首次打开不注册也能搜到官方资源
   - 语音优先 + 多语言 + 低带宽模式

3. **社区自治，而不是平台统治**：
   - “规则/审核/公告”优先由社区 Anchor 决定（平台只提供工具 + 最低安全底线）

4. **先把匹配做对，再做复杂金融/积分**：
   - MVP 不做时间银行、不做 token、不做区块链金融化

5. **安全优先于增长**：
   - 对高风险交易（现金、陌生接送、儿童照护等）默认更严格的审核与提示

## 6) 范围边界（Non-goals）
- 不做：时间银行、积分兑换、加密货币、支付闭环
- 不做：医疗诊断、律师建议等高风险决策（只能做资源引导）
- 不做：公开“社区八卦”类信息流（避免 Nextdoor 式撕裂）
- 不做：强社交关系链（关注点是互助/资源，而不是社交媒体）

## 7) 竞品分析与差异化

### 7.1 竞品对比矩阵

| 维度 | **WeaveNYC** | **NYC 311** | **Nextdoor** | **WhatsApp 群** | **Mutual Aid NYC** | **Community Fridge** |
|------|-------------|------------|-------------|----------------|-------------------|---------------------|
| **核心定位** | 隐私优先邻里互助 | 市政服务报告 | 邻里社交网络 | 即时通讯群组 | 草根互助网络 | 食物免费共享 |
| **用户规模** | MVP 试点 | 340 万次/年 | 6900 万全球 | 20 亿+全球 | 分散社区组织 | 数十站点 |
| **隐私模型** | 默认本地+匿名 | 政府数据库 | 追踪+广告变现 | 端对端加密但需手机号 | 无统一标准 | 无数字化 |
| **多语言** | EN/ES/ZH 原生支持 | 英语为主+有限翻译 | 英语为主 | 无本地化 | 取决于各组 | 无 |
| **匹配能力** | 智能匹配+官方兜底 | 工单转派 | 无 | 靠刷屏 | 人工协调 | 无 |
| **社区治理** | Anchor 自治审核 | 市政官僚 | 企业算法 | 群管理员个人 | 各组自定 | 志愿者 |
| **低带宽/离线** | PWA+离线缓存 | 需联网 | 需联网 | 需联网 | 多为线下 | 纯线下 |
| **可持续性** | 平台化+社区合作 | 政府财政 | 广告收入 | 免费但无组织 | 捐赠驱动（不稳定） | 捐赠驱动 |

### 7.2 主要竞品痛点分析

**NYC 311**（年处理 340 万请求，来源：NYC Comptroller 2024）：
- 约 25% 纽约人 LEP，翻译资源严重不足（英语/西班牙语之外几乎空白）
- ~28% 的住房投诉在未确认检查的情况下被关闭
- Bronx 等待时间最长、人均投诉量最高——恰好是我们的目标区域
- **WeaveNYC 机会**：311 只能”报告问题”，我们能”匹配解决方案”；多语言原生支持；社区层面即时响应

**Nextdoor**（6900 万用户，来源：Nextdoor Q4 2024 Investor Presentation）：
- 精准定位追踪 + 数据卖给 Microsoft 等第三方（来源：class action lawsuit filings, 2024）
- 持续的种族 profiling 问题（CEO 承认删除 BLM 帖子；来源：BuzzFeed News）
- 广告变现模式与互助使命冲突
- **WeaveNYC 机会**：默认匿名 + ZIP 级精度（非 GPS）；社区自治审核（非企业算法）；无广告、不卖数据

**WhatsApp/WeChat 社区群**：
- 无发现机制：新居民无法找到群组
- 无结构化信息：求助淹没在刷屏中，无匹配
- 群成员手机号互相可见，移民社区隐私顾虑大
- **WeaveNYC 机会**：结构化发布 + 智能匹配；匿名化身份；正式的社区发现入口

**Mutual Aid NYC / Community Fridge**：
- COVID 期间快速涌现（Bed-Stuy Strong 服务 28,000 人），但节后志愿者流失 70%（来源：City Limits, 2021）
- 信息分散在数十个独立组织，无统一平台
- 无数字化治理工具，全靠人工协调
- **WeaveNYC 机会**：为分散的互助力量提供可持续平台；Anchor 模式天然适配这些组织

### 7.3 差异化总结

- **比 311 更行动**：不仅”报告”问题，还能”匹配可用帮助”（邻里 Offer + 官方资源兜底）
- **比 WhatsApp 群更高效**：结构化发布 + 可解释匹配 + 结果可追踪，不靠刷屏
- **比 Nextdoor 更安全**：默认匿名化、社区自治审核、不追踪/不卖数据、反骚扰工具集
- **比 Mutual Aid 更可持续**：平台化架构 + Anchor 激励机制 + 官方资源永远兜底（不依赖纯志愿者）

## 8) 用户调研与市场数据

### 8.1 食物不安全（核心痛点）

纽约是全美食物不安全最严重的大城市之一。2019 至 2024 年间，紧急食物援助访问量增长了 83%。

| 行政区 | 食物不安全人口 | 占比 | 儿童食物不安全 | 儿童占比 |
|--------|--------------|------|--------------|---------|
| Bronx | 290,990 | 20.2% | 118,320 | 33.2% |
| Queens | 294,240 | 12.5% | 87,960 | 18.7% |
| Brooklyn | 406,560 | 15.2% | 152,830 | 25.3% |
| Staten Island | 56,480 | 11.5% | 15,190 | 14.2% |

> 来源：NYC Food Policy Report 2024; NYC Council Data Team — Emergency Food in NYC

**启示**：Bronx 儿童食物不安全率达 1/3，是我们最需要覆盖的区域。"官方资源目录 + 邻里食物分享"的双轨策略对这里最有价值。

### 8.2 语言障碍

纽约是全球最多语言的城市之一（200+ 种语言），约 30% 居民在家不说英语，约 250 万人被归类为 LEP（Limited English Proficient）。

前 5 大非英语语言：西班牙语（928,700）、中文（383,700）、俄语（153,000）、孟加拉语（101,500）、海地克里奥尔语（82,400）。

> 来源：NYC Language Access Report; NYC Public Advocate

**启示**：MVP 的 EN/ES/ZH 三语支持覆盖了 NYC 最大的三个语言群体。西班牙语和中文用户合计超过 130 万人。市政翻译资源在英语/西班牙语之外几乎为空白——这是我们多语言原生支持的巨大机会。

### 8.3 数字鸿沟与移动端依赖

| 指标 | 数据 | 来源 |
|------|------|------|
| 无宽带家庭 | 1/4 NYC 家庭缺少有线/光纤/DSL | NYC Comptroller 2024 |
| 黑人/西裔无宽带 | 超过 1/3 缺少宽带 | 同上 |
| 低收入无宽带 | 近 1/2 缺少宽带 | 同上 |
| Bronx 仅智能手机上网 | 113,000+ 家庭（19.2%） | Center for an Urban Future |
| Bronx 无宽带总计 | 36.7% 家庭 | 同上 |

> 来源：NYC Comptroller Broadband Report 2024; Center for an Urban Future — Understanding the Bronx Digital Divide

**启示**：PWA（Progressive Web App）+ 低带宽模式 + 离线缓存不是锦上添花，而是必须。目标用户大量依赖智能手机流量上网，数据配额有限。

### 8.4 移民社区信任与隐私顾虑

纽约有超过 300 万移民（占总人口 38%），其中 15% 为非公民。目标社区的移民比例更高（Queens ~48% 外国出生；Bronx ~32% 外国出生）。

关键发现：
- 无证/混合身份家庭对政府服务有强烈恐惧，宁可放弃医疗也不愿暴露身份（来源：CMS NY, 2022）
- DHS 隐私措施被审计发现存在系统性漏洞；ICE 曾意外泄露庇护申请者个人信息（来源：New America / OTI）
- 数据经纪商可在未经同意的情况下收集和出售 PII（姓名、地址、SSN）
- NYC 法律保护可能识别/定位个人的信息，要求"最低必要"数据收集标准

> 来源：MOIA 2024 Annual Report; CMS NY — NYC Programs & Services Report; New America OTI — Digital Deportation

**启示**：这些数据验证了我们"默认隐私"的产品原则。默认本地存储、不要求实名、ZIP 级精度、匿名化 actor ID——每一项设计决策都在直接回应这些真实的恐惧和风险。

### 8.5 目标社区画像

**Bronx 104xx**（核心目标区）：
- 人口 135.6 万；55% Hispanic、29% Black；中位家庭收入 $48,610（低于全市 39%）
- 贫困率 27.9%（全市 18.2%）；非公民 15.9%
- 数字鸿沟最严重的行政区：36.7% 无宽带、19.2% 仅靠手机上网
- 来源：Furman Center; NYC Census Data; OSC South Bronx Report

**Queens 113xx/114xx**（多元文化目标区）：
- 全球民族/语言最多样的城市区域之一；约 48% 外国出生
- 中位家庭收入 $79,710–$116,458（ZIP 间差异大）
- 拥有纽约州最大的亚裔人口和全美最大的安第斯移民群体
- 来源：Queens Demographics; NYC Census

**Farmingdale 11735**（Long Island 试点区）：
- 人口 8,450；中位家庭收入 $134,037；贫困率 4.99%
- 73.6% 白人、9.7% 亚裔；87.2% 本土公民
- 相对富裕，但仍有食物不安全和社区服务需求
- 来源：Point2Homes; Data USA

**三区策略**：Bronx 验证"高需求低资源"场景；Queens 验证"多语言多文化"场景；Farmingdale 验证"相对资源充足但社区纽带弱"场景。三者互补，MVP 期间为匹配算法和社区治理模型提供多样化的测试数据。

## 9) 参考资料

### 竞品研究
- Nextdoor Investor Presentation Q4 2024 — https://s28.q4cdn.com/517578190/files/doc_presentations/2025/
- CivicScience — Unlocking Nextdoor Usage in 2024 — https://civicscience.com/unlocking-nextdoor-usage-in-2024/
- NYC Comptroller — NYC311 Monitoring Tool — https://www.osc.ny.gov/reports/osdc/nyc311-monitoring-tool
- Nextdoor Privacy Class Action — https://www.classaction.org/nextdoor-data-privacy
- Mutual Aid NYC — https://mutualaid.nyc/
- One Love Community Fridge — https://www.onelovecommunityfridge.org/
- OASIS NYC — https://www.oasisnyc.net/

### 用户调研与人口数据
- NYC Food Policy — Food by the Numbers 2024 — https://www.nyc.gov/assets/foodpolicy/downloads/pdf/NYC-Food-by-the-Numbers-2024.pdf
- NYC Council Data Team — Emergency Food in NYC — https://council.nyc.gov/data/emergency-food-in-nyc/
- NYC Public Advocate — Language Access Report — https://advocate.nyc.gov/reports/language-access-report
- NYC Comptroller — Broadband Access Report 2024 — https://www.osc.ny.gov/press/releases/2024/12/dinapoli-report-examines-broadband-availability-access-and-affordability-nyc
- Center for an Urban Future — Bronx Digital Divide — https://nycfuture.org/research/understanding-and-overcoming-the-bronx-digital-divide
- MOIA — 2024 Annual Report on NYC Immigrant Population — https://www.nyc.gov/assets/immigrants/downloads/pdf/MOIA-2024-Annual-Report_4.4.25.pdf
- CMS NY — NYC Programs & Services Report — https://cmsny.org/publications/nyc-programs-services-and-benefits-report-013122/
- New America OTI — Digital Deportation — https://www.newamerica.org/oti/blog/digital-deportation/
- City Limits — NYC Mutual Aid at a Turning Point (2021) — https://citylimits.org/a-year-and-a-half-into-pandemic-nycs-mutual-aid-movement-at-a-turning-point/

### 社区人口统计
- Furman Center — The Bronx — https://furmancenter.org/neighborhoods/view/the-bronx
- OSC — South Bronx Economic Snapshot — https://www.osc.ny.gov/files/reports/osdc/pdf/report-13-2024.pdf
- Point2Homes — Farmingdale NY Demographics — https://www.point2homes.com/US/Neighborhood/NY/Farmingdale-Demographics.html
- Data USA — Farmingdale — https://datausa.io/profile/geo/farmingdale-ny/

