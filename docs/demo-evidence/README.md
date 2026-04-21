# WeaveNYC Demo Evidence Package

## What this folder proves

Between 2026-04-18 and 2026-04-21, WeaveNYC shipped **31 merged PRs** (#37–#67) across **four review waves** that closed every P0/P1 finding raised by an 8-person internal audit. Today all four clouds — **Cloudflare** (PWA + admin), **AWS App Runner** (api-gateway), **GCP Cloud Run** (resource-directory), **Azure Container Apps** (notifications) — are live and responding to HTTPS traffic from public DNS. This folder is the audit trail: every live endpoint, every merged PR, every known gap, and the skeptic-resistant answers.

## Contents

- **[commit-timeline.md](./commit-timeline.md)** — the 31 merged PRs grouped into 4 review waves, with SHA + merge time
- **[live-smoke-script.md](./live-smoke-script.md)** — 30-second copy-pasteable bash that the audience can run on their own machine
- **[metrics-snapshot.md](./metrics-snapshot.md)** — live Prometheus metrics pulled at demo time (request counts, p95 latency, chat + P2P counters)
- **[known-gaps.md](./known-gaps.md)** — honest list of what is **not** shipped, so the audience does not have to ask
- **[skeptic-qa.md](./skeptic-qa.md)** — three hostile questions with short, PR-linked answers
- **[e2e-smoke-run.md](./e2e-smoke-run.md)** — how to re-run the Playwright breadth + safety smoke locally
- **[audit-archive/](./audit-archive/)** — the 8-person review reports and round index

## 30-second verification (run this at the demo)

```bash
# Multi-cloud proof (6 rows, all green, ~1s):
pnpm demo:multicloud

# Or without pnpm:
bash scripts/demo/multicloud.sh
```

Expected output: 6 rows, all green `✓ PASS`:

| Cloud + surface              | Evidence                              |
|------------------------------|----------------------------------------|
| Cloudflare (PWA)             | `cf-ray: ...-EWR`                      |
| Cloudflare (Admin)           | `cf-ray: ...-EWR`                      |
| AWS App Runner (api)         | 5 probes: postgres,redis,chat,p2p,jwt  |
| GCP Cloud Run (resources)    | `x-cloud-trace-context: ...` (Google FE)|
| Azure Container Apps (notify)| TLS verified + HTTP/2 200              |
| All (metrics)                | node version + http_requests_total     |

## Is this a Potemkin demo?

**No.**
1. **Audit trail**: 31 PRs with public GitHub hashes, grouped into [4 review waves](./commit-timeline.md).
2. **Live endpoints**: 4 clouds responding to HTTPS right now — re-run [the smoke script](./live-smoke-script.md) yourself.
3. **Tests**: breadth + safety covered by [`tests/e2e/resource-smoke.spec.ts`](../../tests/e2e/resource-smoke.spec.ts) and [`tests/e2e/chat-safety.spec.ts`](../../tests/e2e/chat-safety.spec.ts) — `pnpm exec playwright test` re-runs them locally.
