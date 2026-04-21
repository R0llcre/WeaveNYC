# Audit Report Template

Copy this file to `agent-<N>-<area>.md` when starting a new audit. Keep sections in the listed order.

---

# R<N> — <Area> (Round <round>)

**Reviewer**: `<reviewer handle>`
**Round**: `1 | 2 | 3 | 4`
**Area**: `<data migrations | auth | P2P | tests | resource-directory | observability | ops | chat>`
**Reviewed-at SHA**: `<git SHA at time of review>`
**Published-at**: `<ISO 8601 timestamp>`

## 1. Scope

- **In scope**: files / directories / services actually audited (list them)
- **Out of scope**: what was explicitly not looked at (list them — this keeps future reviewers honest)
- **Evidence sources**: tests run, endpoints hit, migration scripts inspected

## 2. Findings

### P0 (must fix before pilot go-live)

1. `<finding-id>` — `<one-line summary>` — linked issue / PR: `#<N>`
   - **Where**: `<file path + line or endpoint>`
   - **Why P0**: `<impact: data loss / safety / outage / legal>`
   - **Reproduction**: `<steps or curl>`
   - **Suggested fix**: `<one sentence>`

### P1 (must fix before pilot week 2)

1. `<finding-id>` — `<one-line summary>` — linked PR: `#<N>`
   - **Where**: `<...>`
   - **Why P1**: `<...>`
   - **Suggested fix**: `<...>`

### P2 (M9 backlog)

1. `<finding-id>` — `<one-line summary>`
   - **Where**: `<...>`
   - **Why P2**: `<...>`
   - **Suggested fix**: `<...>`

## 3. Verdict

One of:
- **pass** — no open P0/P1, P2s logged to backlog
- **pass-with-followup** — no open P0/P1, but named P2s that must land in M9
- **blocked** — one or more P0/P1 unresolved; re-review required

## 4. Linked PRs

- `PR #<N>` — `<one-line summary>` — **closes**: finding ids
- `PR #<N>` — `<...>`

## 5. Reviewer SHA-stamp

```
Reviewed-at-SHA: <git sha>
Reviewed-at-UTC: <ISO 8601>
Reviewer: <handle>
Signature: <free-form — e.g. initials + date>
```
