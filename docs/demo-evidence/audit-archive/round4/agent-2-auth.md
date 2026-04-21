# R2 — Auth + block propagation (Round 4)

**Reviewer**: R2
**Round**: 4 (final)
**Area**: authentication, session, anchor activation, block-propagation across services
**Reviewed-at SHA**: `8fb5d9f` (PR #62) — re-verified at `164dce7` (HEAD)
**Published-at**: 2026-04-21T13:15:00-04:00

## 1. Scope

- **In scope**:
  - `services/api-gateway/src/auth/**` — anonymous, OTP, magic-link, anchor activation paths
  - JWT lifecycle: access token, refresh token, server-side logout
  - Anchor-activate rate-limiter
  - `/v1/match/contact` — block-list enforcement
  - `/v1/community-access/resolve` — rate-limit + community enumeration risk
  - WebSocket Origin check on `/v1/ws/p2p` and chat WS
  - Block-fanout scrub (server emits events to both parties after block, must scrub blocker identity)
- **Out of scope**: SSO / OAuth (not in M8), hardware token attestation (M9)
- **Evidence sources**:
  - Read every handler in `services/api-gateway/src/auth/` and `services/api-gateway/src/match/`
  - `curl` reproduction of the re-auth bypass pre-PR #50 vs post-PR #50
  - Manual WS connection from a foreign origin (rejected)

## 2. Findings

### P0 (closed)

1. `R2-P0-1` — **Re-auth bypass**: a stale refresh token could mint new access tokens indefinitely because the server did not track logout. — **closed by PR #50** (server-side logout + refresh-token invalidation table).
2. `R2-P0-2` — **Anchor activate brute-force**: no rate-limit on `/v1/auth/anchor/activate`, so a partner-email leak would allow unlimited TOTP guesses. — **closed by PR #50** (per-IP + per-email rate-limit).
3. `R2-P0-3` — **Block not enforced on `/v1/match/contact`**: a blocked user could re-issue a contact request via the match API. — **closed by PR #62**.
4. `R2-P0-4` — **`/v1/community-access/resolve` rate-limit missing**: allows community enumeration via ZIP-code scanning. — **closed by PR #62**.

### P1 (closed)

1. `R2-P1-1` — **WS Origin check absent**: browser could connect from any origin. — **closed by PR #62**, adds Origin allowlist check in WS upgrade handler.
2. `R2-P1-2` — **Block-fanout leak**: when user A blocks user B, downstream event fanout included A's user ID in metadata that eventually reached B's client. — **closed by PR #62** (scrub on fanout).

### P2 (logged to M9 backlog)

1. `R2-P2-1` — TOTP secret rotation UI not exposed to anchors (they can reset via ops-only endpoint today). Logged.
2. `R2-P2-2` — Magic-link validity window is currently 15 min; consider 5 min for pilot-week-2.

## 3. Verdict

**pass** — no open P0/P1 at HEAD.

## 4. Linked PRs

- `PR #50` — fix(auth): close P0 re-auth bypass + anchor activate rate-limit + server-side logout — **closes** R2-P0-1, R2-P0-2
- `PR #62` — fix(auth): enforce block on /v1/match/contact + rate-limit community-access/resolve + WS Origin check + block fanout scrub — **closes** R2-P0-3, R2-P0-4, R2-P1-1, R2-P1-2

## 5. Reviewer SHA-stamp

```
Reviewed-at-SHA: 8fb5d9f (PR #62)
Re-verified-at-SHA: 164dce7 (HEAD)
Reviewed-at-UTC: 2026-04-21T17:15:00Z
Reviewer: R2
Signature: R2 / 2026-04-21
```
