# R8 — Chat safety + WebSocket reliability (Round 4)

**Reviewer**: R8
**Round**: 4 (final)
**Area**: chat content safety (blocklist, regex, E.164, Luhn), WebSocket reliability, block-propagation
**Reviewed-at SHA**: `4d43d49` (PR #58) — re-verified at `164dce7` (HEAD)
**Published-at**: 2026-04-21T13:30:00-04:00

## 1. Scope

- **In scope**:
  - `services/chat/src/safety/**` — content classifier + blocklist
  - `POST /v1/conversations/:id/messages` safety gate
  - WebSocket reconnect + resume logic (client + server)
  - Server-side heartbeat (ping/pong) and stale-connection pruning
  - Block-disconnect: when user A blocks B, A's block must immediately sever B's open WS
  - `safety_flags` rendering on the PWA (user-facing safety reason)
- **Out of scope**: ML-based toxicity classifier (regex-only in M8), voice/video (never in scope)
- **Evidence sources**:
  - Read every file in `services/chat/src/safety/`
  - `curl -X POST https://api.weavenyc.org/v1/conversations/.../messages` with crafted E.164 / Luhn / slur payloads (smoke against staging, not prod — no pilot users yet)
  - Two-browser WS reconnect drill via `pnpm test:smoke:p2p`
  - `tests/e2e/chat-safety.spec.ts` walked through manually

## 2. Findings

### P0 (closed)

1. `R8-P0-1` — **No E.164 phone blocking**: the regex was naive (`/\d{10}/`) and missed `+1-212-555-0123` formatting. — **closed by PR #57** (true E.164 pattern with country code variations).
2. `R8-P0-2` — **Bank account regex was false-positive-prone**: matched any 9–17 digit sequence. — **closed by PR #57** (Luhn checksum validation before rejecting).
3. `R8-P0-3` — **No hate/harassment blocklist**: safety gate only caught numeric PII, not slurs. — **closed by PR #57**.
4. `R8-P0-4` — **Block did not disconnect live WS**: blocked user could keep sending messages on an already-authenticated socket. — **closed by PR #58** (server emits `BLOCK_DISCONNECT` and closes the socket).

### P1 (closed)

1. `R8-P1-1` — **WS has no reconnect-with-resume**: a brief network blip dropped all unread messages until a full reload. — **closed by PR #58** (cursor-based resume with `resume_from` frame).
2. `R8-P1-2` — **No server heartbeat**: idle connections ate RAM indefinitely. — **closed by PR #58** (ping/pong every 25s; prune on 2 missed pongs).
3. `R8-P1-3` — **`safety_flags` was sent by server but not rendered in PWA**: user saw a silent message failure, not the reason. — **closed by PR #63** (render safety reason; i18n for Banner/Toast dismiss label).

### P2 (logged to M9 backlog)

1. `R8-P2-1` — Blocklist is a static file; add admin UI for community-level customization. M9.
2. `R8-P2-2` — Regex-only classifier misses paraphrased content. ML toxicity scoring in M9 if pilot data justifies the cost.

## 3. Verdict

**pass** — no open P0/P1 at HEAD.

## 4. Linked PRs

- `PR #57` — fix(chat-safety): hate/harassment blocklist + Luhn-validated bank regex + E.164 phone — **closes** R8-P0-1, R8-P0-2, R8-P0-3
- `PR #58` — fix(chat): WS reconnect + resume + server heartbeat + block disconnect — **closes** R8-P0-4, R8-P1-1, R8-P1-2
- `PR #61` — test: WS hook + block-disconnect + chat-safety E2E + /v1/resources smoke + promtool + Sentry init — **supports** (E2E coverage)
- `PR #63` — fix(pwa): render safety_flags + systemic error i18n + Banner/Toast dismiss label + route fallback i18n — **closes** R8-P1-3

## 5. Reviewer SHA-stamp

```
Reviewed-at-SHA: 4d43d49 (PR #58)
Re-verified-at-SHA: 164dce7 (HEAD)
Reviewed-at-UTC: 2026-04-21T17:30:00Z
Reviewer: R8
Signature: R8 / 2026-04-21
```
