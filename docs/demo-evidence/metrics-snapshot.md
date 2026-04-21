# Live Metrics Snapshot

Pulled from production `api.weavenyc.org/metrics` (AWS App Runner, Prometheus text exposition) at demo prep time (2026-04-21).

Command to refresh:

```bash
curl -s https://api.weavenyc.org/metrics \
  | grep -E '^(http_requests_total|http_request_duration_seconds_(sum|count|bucket)|chat_messages_|p2p_|weavenyc_nodejs_version)' \
  | head -40
```

## Process + runtime

```
weavenyc_nodejs_version_info{version="v20.20.2",major="20",minor="20",patch="2",service="api-gateway"} 1
weavenyc_process_start_time_seconds{service="api-gateway"} 1776792026
```

Node v20.20.2 matches the [engines pin](../../package.json#L7) (`">=20.0.0"`).

## HTTP request counters (10 series, across all observed routes)

```
http_requests_total{method="GET",route="/healthz",status_code="200",...} 420
http_requests_total{method="GET",route="/readyz",status_code="200",...} 9
http_requests_total{method="GET",route="/v1/resources",status_code="200",...} 3
http_requests_total{method="GET",route="/versionz",status_code="200",...} 6
http_requests_total{method="GET",route="/metrics",status_code="200",...} 8
http_requests_total{method="GET",route="/metrics.json",status_code="200",...} 1
http_requests_total{method="GET",route="/docs",status_code="200",...} 2
http_requests_total{method="POST",route="/v1/auth/anonymous",status_code="200",...} 4
http_requests_total{method="POST",route="/v1/auth/refresh",status_code="200",...} 1
http_requests_total{method="POST",route="/v1/auth/refresh",status_code="401",...} 1
```

**Cardinality control** (PR #64): route labels are matched against the registered Fastify schema, not the raw URL, so `status_code` + `method` + `route` stay bounded even under query-string variation.

## HTTP latency histogram — p95 < 100 ms on health paths

Histogram for `GET /healthz` (420 samples):

```
http_request_duration_seconds_bucket{le="0.01",...,route="/healthz"} 418    # 99.5% under 10 ms
http_request_duration_seconds_bucket{le="0.05",...,route="/healthz"} 419    # 99.7% under 50 ms
http_request_duration_seconds_bucket{le="0.1",...,route="/healthz"}  420    # 100% under 100 ms
http_request_duration_seconds_sum{...,route="/healthz"}              0.372  # 0.89 ms mean
http_request_duration_seconds_count{...,route="/healthz"}            420
```

p95 for `/healthz`: **< 10 ms** (App Runner + Postgres pool warm).

## Chat + P2P counters (PRs #58, #39)

```
chat_messages_sent_total{service="api-gateway"} 0
chat_messages_delivered_total{service="api-gateway"}  # series exists, no deliveries yet (no pilot users)
p2p_sync_events_total{service="api-gateway"}          # series exists, no traffic yet
p2p_sync_errors_total{service="api-gateway"}          # series exists
p2p_sync_lag_seconds_bucket{le="0.1",...} 0           # histogram exists, 0 samples
```

**Why zeroes?** No pilot users yet — MOUs still unsigned. The series being registered (not absent) means the histogram is ready the moment the first message or sync event flows. See [`known-gaps.md`](./known-gaps.md).

## Sentry + privacy redaction (PR #64)

Logs are scrubbed via `pino.redact` before stdout → CloudWatch:
- `password`, `token`, `access_token`, `refresh_token`, `authorization` header → `[Redacted]`
- `req.body.email`, `req.body.phone` → `[Redacted]` at ingress

Sentry `beforeSend` runs a second pass to drop events whose message contains an E.164-looking phone or Luhn-valid bank number — even when those make it into a stack trace.

## Alert rules (wired, PR #45 + #56 + #64)

Rules live in [`infra/prometheus/alerts.yml`](../../infra/prometheus/alerts.yml). Key rules:
- `APIHigh5xxRate` — `> 5%` 5xx over 5m
- `APIReadyzDown` — readyz 200 rate < 1 for 2m
- `ChatWSDisconnectSpike` — disconnect rate > baseline × 3
- `P2PSyncLagHigh` — p95 lag > 60s

Scraper deployment deferred to pilot week 1 per [M8 downgrade §A8-P0-3](../29_M8_Pilot_Readiness.md#1-gono-go-checklist). `promtool check rules` runs in CI per PR #61.
