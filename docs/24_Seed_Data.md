# 24. Seed Data — Pilot Communities

> W5A closeout. Describes the deterministic fixtures written by `pnpm db:seed`.
> Every UUID is pinned so pilot demos can reset + re-seed without drifting.

## 1) Pilot communities at a glance

`packages/db/seed/index.ts` writes three pilot communities. Each community
shares the same shape: one anchor user + one verified seed user + an anchor
invite whose SHA-256 hash matches the canonical code, a community ruleset, one
pinned welcome announcement, and 2 sample posts (1 request, 1 offer) plus a set
of active resource providers near the center ZIP.

| Community | Center ZIP | Anchor invite code | Seed user | Providers | Languages |
| --- | --- | --- | --- | --- | --- |
| Farmingdale Demo Community | 11735 | `WEAVE-ANCHOR-11735` | Verified Demo User | 3 (pantry) | en, es |
| Queens Corona Demo Community | 11368 | `WEAVE-ANCHOR-Q113` | Queens Neighbor | 4 (pantry / kitchen / market) | en, es, zh |
| Bronx Hunts Point Demo Community | 10474 | `WEAVE-ANCHOR-BX104` | Bronx Neighbor | 3 (pantry / kitchen / market) | en, es |

All three anchor invite hashes are derived inline via
`crypto.createHash('sha256').update(code.toUpperCase()).digest('hex')` (see
`hashAnchorInviteCode` in `packages/db/seed/fixtures.ts`).

## 2) Canonical UUIDs

Farmingdale (pre-W5A, unchanged):

- community `44444444-4444-4444-8444-444444444444`
- anchor user `33333333-3333-4333-8333-333333333333`
- anchor invite `5a5a5a5a-5a5a-455a-855a-5a5a5a5a5a5a`

Queens Corona (W5A):

- community `a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1`
- anchor user `a8a8a8a8-a8a8-4a8a-8a8a-a8a8a8a8a8a8`
- seed user `a9a9a9a9-a9a9-4a9a-8a9a-a9a9a9a9a9a9`
- anchor invite `a3a3a3a3-a3a3-4a3a-8a3a-a3a3a3a3a3a3`
- ruleset `a6a6a6a6-a6a6-4a6a-8a6a-a6a6a6a6a6a6`
- announcement `a7a7a7a7-a7a7-4a7a-8a7a-a7a7a7a7a7a7`
- providers `aa010101…`, `aa020202…`, `aa030303…`, `aa040404…`

Bronx Hunts Point (W5A):

- community `b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1`
- anchor user `b8b8b8b8-b8b8-4b8b-8b8b-b8b8b8b8b8b8`
- seed user `b9b9b9b9-b9b9-4b9b-8b9b-b9b9b9b9b9b9`
- anchor invite `b3b3b3b3-b3b3-4b3b-8b3b-b3b3b3b3b3b3`
- ruleset `b6b6b6b6-b6b6-4b6b-8b6b-b6b6b6b6b6b6`
- announcement `b7b7b7b7-b7b7-4b7b-8b7b-b7b7b7b7b7b7`
- providers `ba010101…`, `ba020202…`, `ba030303…`

## 3) Resource providers

All providers share `source=cfc_active`, `datasetVersion=cfc_active_2026-04-04`,
`status=active`. The `source_ref` is unique per provider, so the partial
unique index `uq_resources_active_source_ref` lets us co-seed multiple
communities without collisions.

Queens (near 40.7489, -73.8627):

| Name | Type | Address | Phone | Languages |
| --- | --- | --- | --- | --- |
| Corona Food Pantry | pantry | 39-25 104th Street, Corona | (718) 555-1001 | en, es |
| Our Lady of Sorrows Community Kitchen | kitchen | 104-11 37th Avenue, Corona | (718) 555-1002 | en, es |
| Elmcor Community Fresh Market | market | 107-20 Northern Boulevard, Corona | (718) 555-1003 | en, es, zh |
| Flushing Chinese Community Pantry | pantry | 41-61 Kissena Boulevard, Flushing | (718) 555-1004 | en, zh |

Bronx (near 40.8116, -73.8909):

| Name | Type | Address | Phone | Languages |
| --- | --- | --- | --- | --- |
| St. Barnabas Pantry | pantry | 409 East 138th Street, Bronx | (718) 555-2001 | en, es |
| Hunts Point Alliance Community Kitchen | kitchen | 630 Jackson Avenue, Bronx | (718) 555-2002 | en, es |
| Longwood Fresh Market | market | 930 Hunts Point Avenue, Bronx | (718) 555-2003 | en, es |

Phone numbers use the `(718) 555-XXXX` reserved range so demo traffic never
reaches a real pantry.

## 4) Rerunning the seed

```bash
docker compose up -d postgres
pnpm db:migrate
pnpm db:seed
```

Because every insert uses `onConflictDoUpdate` keyed on the fixed UUIDs, the
script is idempotent — re-running it keeps row counts stable and overwrites
the canonical fields. `pnpm --filter @weavenyc/db test` asserts the seed /
migration contract is still green.

## 5) Verifying by hand

After seeding, `/community/join` should accept these codes:

- `FARMINGDALE-HELP` (invite) / `FARMINGDALE-QR` (QR)
- `QUEENS-CORONA-HELP` / `QUEENS-CORONA-QR`
- `BRONX-HUNTS-POINT-HELP` / `BRONX-HUNTS-POINT-QR`

Anchor operators can claim their community via the anchor invite codes listed
in the table above. The e2e test `tests/e2e/multi-community.spec.ts` covers
the happy path for all three.
