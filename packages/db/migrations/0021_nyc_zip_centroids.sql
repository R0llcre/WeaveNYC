-- V2-A NYC ZIP centroids table. Today `services/resource-directory/src/lib/
-- geocoding.ts` hard-codes 7 Long Island ZIP centroids and 0 NYC ones — every
-- NYC search falls back to Nominatim, which is rate-limited, flaky, and the
-- root cause of `no_results_in_area: true` surfacing even when rows exist.
--
-- This migration stands up a small lookup table the sidecar + gateway both
-- consult BEFORE falling back to Nominatim. The table is seeded from a
-- JSON file (packages/db/seed/nyc-zip-centroids.json) at seed time — see
-- packages/db/scripts/seed.ts. ~240 rows covering all 200 NYC ZIPs plus the
-- 40 most-requested Long Island ZIPs (Nassau + Suffolk).
--
-- Primary key on `zip` lets the geocoder do a single `WHERE zip = $1` with
-- no index scan. Rows are small (~50 bytes) so the full table fits in
-- shared_buffers and every lookup is effectively memory-speed.

BEGIN;

CREATE TABLE IF NOT EXISTS nyc_zip_centroids (
  zip varchar(5) PRIMARY KEY,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  borough varchar(20)
);

COMMENT ON TABLE nyc_zip_centroids IS
  'Precomputed lat/lng centroids for NYC (and commonly-requested Long Island) ZIPs. Seeded from packages/db/seed/nyc-zip-centroids.json; consulted by the resource-directory geocoder before any Nominatim fallback.';

COMMIT;
