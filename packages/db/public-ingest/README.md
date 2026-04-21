# @weavenyc/db public-ingest

Pulls four public, redistributable directories of food / health / senior-meal
providers and normalizes them into `ResourceProviderSeed` rows the main seed
can upsert into `resource_providers`. Hand-curated fixtures always win on
conflict (see `dedup.ts`).

## Sources + attribution

| id | label | URL | license |
|---|---|---|---|
| `foodhelp_nyc` | NYC HRA Food Help NYC | https://finder.nyc.gov/foodhelp/ | NYC Open Data (attribution) |
| `usda_snap` | USDA FNS SNAP Retailer Locator | USDA FNS ArcGIS service | Public domain |
| `nyc_dfta_senior_meals` | NYC DFTA Senior Meal Sites | https://data.cityofnewyork.us/resource/6j6t-3ixh.json | NYC Open Data (attribution) |
| `hrsa_fqhc` | HRSA Find a Health Center | https://findahealthcenter.hrsa.gov/ | Public domain |

## Commands

- `pnpm db:seed:public` — live fetch (or fixture fallback on network error) and write `seed/generated/public-resources.json`.
- `pnpm db:seed:public --from-cache` — skip the network, read only checked-in fixtures. Required for class-day offline demos.
- `pnpm db:seed:public:snapshot` — same as above but writes `public-resources.snapshot.json` (committed to the repo).
- `SEED_PUBLIC_SOURCES=1 pnpm db:seed` — after a snapshot (or live generated file) exists, seeds public rows into Postgres.

## Adding a new source

1. Implement the `PublicSourceModule` interface in `sources/<id>.ts` (id, sourceLabel, sourceUrl, rateLimit, fetch, normalize, attribution, pii).
2. Check in `fixtures/<id>.raw.sample.json` with ≥10 real rows pulled from the live source.
3. Add `test/public-ingest/<id>.test.ts` asserting normalized shape, `contentHash` stability, and `assertNoPersonPii` pass.
4. Register the module in `publicSourceRegistry` in `index.ts` (order matters — earlier sources win on dedup collisions, subject to the curated-source override).
