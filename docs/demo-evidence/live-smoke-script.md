# Live Smoke Script — 30 Seconds from Audience's Laptop

Paste this into any `bash` shell (macOS Terminal, iTerm, WSL, Linux) with internet access. Needs only `curl` — no WeaveNYC code, no checkout, no credentials.

```bash
for url in https://weavenyc.org \
           https://admin.weavenyc.org \
           https://api.weavenyc.org/readyz \
           https://resource-dir.weavenyc.org/readyz \
           https://notify.weavenyc.org/healthz; do
  printf "%-55s %s\n" "$url" "$(curl -sS -o /dev/null -w '%{http_code} %{time_total}s' "$url")"
done
```

## Expected output (values will vary slightly, status codes must all be 200)

```
https://weavenyc.org                                    200 0.18s
https://admin.weavenyc.org                              200 0.16s
https://api.weavenyc.org/readyz                         200 0.32s
https://resource-dir.weavenyc.org/readyz                200 0.24s
https://notify.weavenyc.org/healthz                     200 0.28s
```

## What this proves

Each row hits a different production backend on a different cloud:

| URL | Runtime | Cloud |
|-----|---------|-------|
| `weavenyc.org` | Next.js static export | **Cloudflare Pages** |
| `admin.weavenyc.org` | Next.js static export | **Cloudflare Pages** |
| `api.weavenyc.org/readyz` | Fastify api-gateway | **AWS App Runner** |
| `resource-dir.weavenyc.org/readyz` | resource-directory-service (via CF Worker → Cloud Run per PR #67) | **GCP Cloud Run** |
| `notify.weavenyc.org/healthz` | notifications-service | **Azure Container Apps** |

## Richer evidence — the multicloud script

For fingerprint-level proof (cf-ray, Google Frontend trace, Azure TLS chain, Prometheus counters):

```bash
git clone https://github.com/R0llcre/WeaveNYC.git
cd WeaveNYC
pnpm demo:multicloud
# or:
bash scripts/demo/multicloud.sh
```

Output: 6 rows, all green, ~1 second. See [`scripts/demo/multicloud.sh`](../../scripts/demo/multicloud.sh).
