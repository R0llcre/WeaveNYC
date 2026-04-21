# R4 — Test coverage (Round 4)

**Reviewer**: R4
**Round**: 4 (final)
**Area**: unit + integration + E2E test coverage, CI wiring, smoke gates
**Reviewed-at SHA**: `ce87f66` (PR #61) — re-verified at `164dce7` (HEAD)
**Published-at**: 2026-04-21T13:20:00-04:00

## 1. Scope

- **In scope**:
  - `tests/e2e/*.spec.ts` — 9 Playwright specs
  - `services/*/src/**/__tests__/` — vitest unit tests per service
  - `tests/smoke/real-api.ts` — production smoke runner
  - CI workflow files in `.github/workflows/`
  - `promtool check rules` gate for Prometheus alert rule syntax
- **Out of scope**: load tests (k6 / Artillery — M9), visual regression
- **Evidence sources**:
  - `pnpm test` on a clean checkout
  - `pnpm exec playwright test --list` — count specs
  - Read each workflow YAML to confirm the test step is unconditional

## 2. Findings

### P0 (closed)

1. `R4-P0-1` — **No P2P two-context E2E**: sync protocol could break silently without an actual two-browser test. — **closed by PR #41** (`tests/e2e/p2p-sync.spec.ts`).
2. `R4-P0-2` — **No chat-safety E2E**: blocklist changes could regress without end-to-end proof. — **closed by PR #61** (`tests/e2e/chat-safety.spec.ts`).
3. `R4-P0-3` — **WebSocket hook has no unit test** despite being the core chat mechanism. — **closed by PR #61** (hook unit test + block-disconnect unit test).

### P1 (closed)

1. `R4-P1-1` — `/v1/resources` smoke test absent. — **closed by PR #61**.
2. `R4-P1-2` — Sentry init path uncovered (we rely on SDK being imported; should assert it). — **closed by PR #61** (init assertion).
3. `R4-P1-3` — Prometheus alert rules had no syntax gate; typos would ship to production. — **closed by PR #61** (`promtool check rules` in CI).

### P2 (logged to M9 backlog)

1. `R4-P2-1` — Playwright currently runs only on Chromium in CI. Add Safari (Webkit) + Firefox once pilot user base justifies the CI time cost.
2. `R4-P2-2` — No contract tests between api-gateway and Cloud Run resource-directory; changes on either side could break the HTTP contract. M9.
3. `R4-P2-3` — Mutation testing (e.g., Stryker) not wired; coverage percentages are line-based only.

## 3. Verdict

**pass-with-followup** — all P0/P1 closed; three P2s for M9.

## 4. Linked PRs

- `PR #41` — test(p2p): two-context E2E + wire-format compat fixtures — **closes** R4-P0-1
- `PR #61` — test: WS hook + block-disconnect + chat-safety E2E + /v1/resources smoke + promtool + Sentry init — **closes** R4-P0-2, R4-P0-3, R4-P1-1, R4-P1-2, R4-P1-3

## 5. Reviewer SHA-stamp

```
Reviewed-at-SHA: ce87f66 (PR #61)
Re-verified-at-SHA: 164dce7 (HEAD)
Reviewed-at-UTC: 2026-04-21T17:20:00Z
Reviewer: R4
Signature: R4 / 2026-04-21
```
