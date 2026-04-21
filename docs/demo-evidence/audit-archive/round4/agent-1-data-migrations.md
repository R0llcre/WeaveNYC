# R1 — Data migrations + DB integrity (Round 4)

**Reviewer**: R1
**Round**: 4 (final)
**Area**: data migrations, FK integrity, analytics retention, idempotency
**Reviewed-at SHA**: `5eae9e5` (PR #59) — verified also at `164dce7` (HEAD, PR #67)
**Published-at**: 2026-04-21T13:10:00-04:00

## 1. Scope

- **In scope**:
  - `packages/db/migrations/` — all 15 numbered migrations
  - `packages/db/migrations/0015_*.down.sql` (rollback SQL)
  - `match_suggestions` + `analytics_events` + `idempotency_keys` tables — FK and CHECK constraints
  - `updated_at` trigger coverage
  - Hot-path index audit on `posts`, `messages`, `resources`
  - Analytics retention policy (rolling window → archive)
- **Out of scope**: application-level ORM usage, RLS policies (deferred to M9)
- **Evidence sources**:
  - `pnpm db:migrate` + `pnpm db:migrate:rollback` on a clean DB — ran twice, clean round-trip
  - `grep -r 'FOREIGN KEY' packages/db/migrations/`
  - Manual `EXPLAIN ANALYZE` on the three hot-path queries

## 2. Findings

### P0 (closed)

All P0s from rounds 1–3 closed by PR #59:
1. `R1-P0-1` — 0015 had no down migration — **closed by PR #59**, adds 0015 down SQL
2. `R1-P0-2` — `match_suggestions` orphan rows after post delete — **closed by PR #59**, cascade FK added
3. `R1-P0-3` — `idempotency_keys` missing FK to `user_id` (silent orphan on user delete) — **closed by PR #59**

### P1 (closed)

1. `R1-P1-1` — `analytics_events` missing CHECK on enum values — **closed by PR #59**
2. `R1-P1-2` — `updated_at` trigger missing on 3 tables — **closed by PR #59**
3. `R1-P1-3` — Hot-path index on `messages(conversation_id, created_at DESC)` missing — **closed by PR #59**
4. `R1-P1-4` — Migration numbering guard absent (two devs can take `0016_*`) — **closed by PR #59** (CI check)

### P2 (logged to M9 backlog)

1. `R1-P2-1` — RLS policies not enabled; enforcement currently lives in application layer only. Low risk given single-tenant DB, but defense-in-depth would add RLS. Logged.
2. `R1-P2-2` — Analytics retention archive (cold storage) is same-DB table-swap; consider S3 Glacier for pilot week 4+.

## 3. Verdict

**pass-with-followup** — all P0/P1 closed; two P2s for M9.

## 4. Linked PRs

- `PR #59` — fix(db): 0015 rollback + numbering guard + orphan match_suggestions + analytics FK/CHECK + idempotency FK + updated_at triggers + index tune + analytics retention — **closes** R1-P0-1, R1-P0-2, R1-P0-3, R1-P1-1..4
- `PR #49` — fix(api): Idempotency-Key on POST /v1/posts, /v1/conversations/:id/messages, /v1/chat-safety/report + accept dedup — **supports** R1-P0-3 (ensures idempotency_keys are written atomically with the protected writes)

## 5. Reviewer SHA-stamp

```
Reviewed-at-SHA: 5eae9e5 (PR #59)
Re-verified-at-SHA: 164dce7 (HEAD after Wave 4 closeout)
Reviewed-at-UTC: 2026-04-21T17:10:00Z
Reviewer: R1
Signature: R1 / 2026-04-21
```
