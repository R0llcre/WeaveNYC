# Playwright E2E — Breadth + Safety

Two tests covering the two stories that matter for the demo.

| Spec | What it proves |
|------|----------------|
| [`tests/e2e/resource-smoke.spec.ts`](../../tests/e2e/resource-smoke.spec.ts) | **Breadth** — ZIP → resource directory renders with public data; core PWA shell works end-to-end. Hits `/v1/resources?zip=…` which resolves through api-gateway → Cloud Run. |
| [`tests/e2e/chat-safety.spec.ts`](../../tests/e2e/chat-safety.spec.ts) | **Safety** — chat message containing blocked content (E.164 phone / hate slur / Luhn-valid bank number) is rejected server-side and the PWA renders a human-readable safety reason (`safety_flags`, wired in PR #63). Complementary to the unit tests in [`services/chat/tests`](../../services/chat). |

## Re-run locally

```bash
pnpm install
pnpm exec playwright install --with-deps chromium
pnpm exec playwright test resource-smoke chat-safety --reporter=list,html
```

## Or both via the package.json alias

```bash
pnpm test:smoke:browser -- resource-smoke chat-safety
```

## Report

HTML report is generated into `playwright-report/index.html` after each run. It is `.gitignore`d (we never commit the generated artifact), so the demo flow is:

1. `pnpm install` (one-time, or already done)
2. `pnpm exec playwright test resource-smoke chat-safety --reporter=list,html`
3. Open `playwright-report/index.html` in a browser — shows each spec, each step, and screenshots on failure.

## Full breadth (optional)

For reviewers who want every spec, not just the two demo-critical ones:

```bash
pnpm exec playwright test --reporter=list,html
```

This runs all 9 E2E specs in [`tests/e2e/`](../../tests/e2e/), including:
- `anchor-recovery.spec.ts`
- `community-posts.spec.ts`
- `m5-anchor-admin-rehearsal.spec.ts`
- `matching-inbox.spec.ts`
- `multi-community.spec.ts`
- `p2p-sync.spec.ts`
- `settings.spec.ts`

CI runs these on every PR via the Playwright GitHub Action (see [`.github/workflows`](../../.github/workflows)).
