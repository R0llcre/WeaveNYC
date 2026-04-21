# R6 — Observability (Round 4)

**Reviewer**: R6
**Round**: 4 (final)
**Area**: metrics, logs, traces, alert rules, Sentry wiring, privacy-preserving observability
**Reviewed-at SHA**: `46bd609` (PR #64) — re-verified at `164dce7` (HEAD)
**Published-at**: 2026-04-21T13:25:00-04:00

## 1. Scope

- **In scope**:
  - `/metrics` endpoint on every runtime (api-gateway, posts, match, chat, resource-directory, notifications)
  - Prometheus alert rules in `infra/prometheus/alerts.yml`
  - Sentry SDK import + `beforeSend` hook
  - `pino` log configuration — redact paths, level config, transport
  - `/readyz` probe depth (must include DB + Redis + WS upstreams)
  - Metric cardinality — route labels, status code labels, user-id must NOT appear as label
- **Out of scope**: distributed tracing backend (Honeycomb / Datadog — M9), synthetic monitoring (Pingdom — M9)
- **Evidence sources**:
  - `curl -s https://api.weavenyc.org/metrics | wc -l` = several hundred lines; grep for forbidden labels
  - Manual `grep -r 'Sentry.init' services/` — confirmed in all six services
  - `promtool check rules infra/prometheus/alerts.yml` — passes

## 2. Findings

### P0 (closed)

1. `R6-P0-1` — **Metric cardinality risk**: route labels used raw request URL including query strings. At scale, `?zip=11368` and `?zip=10474` would explode into thousands of series per query. — **closed by PR #64** (use Fastify's registered route pattern).
2. `R6-P0-2` — **`/readyz` is shallow**: only returns 200 if process is alive, does not check DB / Redis / WS upstream health. An outage on Upstash Redis would not trip `/readyz`. — **closed by PR #64** (adds 5 depth probes — postgres, redis, chat_realtime, p2p_sync, jwt_sign_verify).
3. `R6-P0-3` — **Sentry has no `beforeSend`**: raw stack traces could leak E.164 phones, tokens, or PII. — **closed by PR #64** (adds E.164 + Luhn drop).

### P1 (closed)

1. `R6-P1-1` — **pino has no redact**: log lines could contain `authorization` header, `access_token`, `req.body.email`, `req.body.phone`. — **closed by PR #64** (adds redact paths).
2. `R6-P1-2` — **Alert rules not wired**: `infra/prometheus/alerts.yml` was a dead file until PR #45 wired it; still needed cardinality-safe `APIHigh5xxRate`. — **closed by PR #45 + PR #64**.
3. `R6-P1-3` — **Sentry env config missing**: no way to separate `production` vs `staging` events in Sentry. — **closed by PR #64** (SENTRY_ENV env var).

### P2 (logged to M9 backlog)

1. `R6-P2-1` — Prometheus scraper not deployed in pilot environment. M8 downgrade accepted; scraper deployment is pilot-week-1 work.
2. `R6-P2-2` — Log aggregation is CloudWatch-only (AWS), Cloud Logging (GCP), Log Analytics (Azure) — no unified backend. A single dashboard aggregating all 3 would simplify on-call. M9.

## 3. Verdict

**pass** — no open P0/P1 at HEAD. Two P2s are tracked against M9.

## 4. Linked PRs

- `PR #45` — fix(ops): api-gateway deploy actually rolls + Prometheus alert rules — **partial-close** R6-P1-2 (rule file wired)
- `PR #64` — fix(obs): metric cardinality + pino redact + Sentry beforeSend + /readyz depth + alert rules + Sentry env config — **closes** R6-P0-1, R6-P0-2, R6-P0-3, R6-P1-1, R6-P1-2 (final), R6-P1-3
- `PR #56` — ops: promote runbook appendices to current + wire Prometheus alerts + Sentry sourcemap upload — **supports** (docs + sourcemaps for readable stack traces)
- `PR #61` — test: WS hook + block-disconnect + chat-safety E2E + /v1/resources smoke + promtool + Sentry init — **supports** (CI gate for alert rule syntax + Sentry init assertion)

## 5. Reviewer SHA-stamp

```
Reviewed-at-SHA: 46bd609 (PR #64)
Re-verified-at-SHA: 164dce7 (HEAD)
Reviewed-at-UTC: 2026-04-21T17:25:00Z
Reviewer: R6
Signature: R6 / 2026-04-21
```
