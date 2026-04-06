# WeaveNYC — M1 Closeout Status

状态：`completed`

日期：`2026-04-06`

当前官方阶段状态：`P0 completed` · `M0 completed` · `M1 completed` · `M2 pending`

目的：记录 M1 正式 closeout 的真实状态、通过的验证链、6-lane rereview 结论，以及关闭后仍接受的剩余风险。

---

## 1) 当前结论

- `M1 official resource directory + extended auth` 已完成
- default CI、real API smoke、fixture-backed browser smoke、manual live-source smoke 的边界已重新写实
- 6-lane rereview 最终全部返回 `No material findings`
- 下一阶段统一切换为 `M2 posting + community visibility`

---

## 2) 关闭时验证基线

M1 关闭时通过的默认 CI 目标基线是：

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm test:smoke:real
pnpm test:e2e
```

关闭时的验证切分：

- default CI：
  - `pnpm test`
  - `pnpm build`
  - docker bootstrap + `pnpm db:migrate` + `pnpm db:seed`
  - `pnpm test:smoke:real`
  - `pnpm test:e2e`
- manual / opt-in：
  - `pnpm test:live-sources`

---

## 3) 通过的 Checks

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- `docker compose up -d`
- `pnpm db:migrate`
- `pnpm db:seed`
- `pnpm test:smoke:real`
- `pnpm test:e2e`
- `pnpm test:live-sources`

---

## 4) 6-Lane Rereview

- Foundation / DevEx / docs truth: `No material findings`
- Data ingestion / live-source adapters / geocoding / import semantics: `No material findings`
- Auth / session / OTP / magic-link / refresh rotation: `No material findings`
- API / DB / resource query behavior: `No material findings`
- Frontend / PWA / i18n / onboarding / persistence / smoke coverage: `No material findings`
- Cross-cutting skeptic review: `No material findings`

---

## 5) 当前接受的剩余风险

- CI 默认不跑 live-source smoke，仍以 fixture-backed tests 为主
- CI 默认不跑完整 Docker-backed DB integration suite
- CFC live adapter 仍依赖上游 PDF 结构与本地 `pdftotext`
- Playwright smoke 当前覆盖 `Language -> ZIP -> List -> Detail -> Bookmark` 与 mocked verify UI wiring，但 OTP / magic-link 的真实 started-server 验证仍由 `pnpm test:smoke:real` 承担

---

## 6) 下一阶段入口

M2 现在统一从以下文档进入：

1. [`13_Implementation_Plan.md`](/Users/kairan/Documents/Spring26/WeaveNYC/docs/13_Implementation_Plan.md)
2. [`14_Backlog.md`](/Users/kairan/Documents/Spring26/WeaveNYC/docs/14_Backlog.md)
3. [`02_PRD.md`](/Users/kairan/Documents/Spring26/WeaveNYC/docs/02_PRD.md)
4. [`03_User_Flows_And_Screens.md`](/Users/kairan/Documents/Spring26/WeaveNYC/docs/03_User_Flows_And_Screens.md)
