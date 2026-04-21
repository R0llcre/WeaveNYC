# WeaveNYC demo setup

## Sandbox mode

Activate with either:

- Build: `NEXT_PUBLIC_DEMO_SANDBOX=1 pnpm --filter @weavenyc/pwa build`
- URL: append `?demo=1` to any `/me/verify` route (preview + localhost only — blocked on `weavenyc.org`).

When active, `/me/verify` shows an amber banner with the demo code `246810`, auto-types it into the OTP input after 2 s, and pins a persistent `SANDBOX` pill to the top-right of the shell.

## Preflight (cloud)

```
pnpm demo:preflight            # GREEN 45s / RED: step N (...)
pnpm demo:preflight --verbose  # per-step trace
```

Completes in <90 s. Pings the 4 production origins, checks `GET /v1/resources?zip=11368` is non-empty, and rewrites `packages/db/seed/generated/demo-fresh-timestamps.json` so relative timestamps never go stale.

## Local demo stack

```
pnpm demo:local
# opens http://localhost:3000/?demo=1
```

Brings up pwa (3000), api (4000), postgres (5432), redis (6379), mailhog (1025/8025) via `docker-compose.demo.yml` and seeds the 5 demo personas into the Queens 11368 pilot community. Seeded UUIDs match cloud so screenshots interop.

## Pre-class checklist

1. `pnpm demo:preflight` returns GREEN.
2. Open preview URL with `?demo=1`; confirm amber banner + auto-typed `246810`.
3. Confirm Queens 11368 resources page shows at least 4 items.
4. Confirm Skyler's iPhone offer is auto-hidden (2 reports crossed threshold).
5. Confirm Skyler ↔ Dwayne conversation exists in inbox for the scene-6 block.
