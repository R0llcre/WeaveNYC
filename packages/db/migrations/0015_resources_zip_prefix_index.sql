-- A5 P0.3 — hot-path index for resource_providers ZIP prefix search.
--
-- Before this migration the public `/v1/resources?zip=...&type=...` path ran
--   select ... from resource_providers where status = 'active'
-- and then filtered by ZIP + type + 10-mile radius in JavaScript. On a
-- 1000-row pilot table this is a full table scan on every public request.
-- After rate-limit lands (60/min/IP) a sustained 30-req/min pilot load still
-- scans 30 000 rows/minute; a scraper storm behind a proxy network can
-- happily 10x that before rate-limit kicks in.
--
-- The repository now pushes filters into SQL:
--   - status = 'active'                      (mandatory)
--   - type = $2                              (when caller passed ?type=)
--   - left(zip, 3) = left($1, 3)             (10-mile proxy in urban NYC)
-- then applies the precise haversine radius in application code using the
-- geocoded lat/lng. Pruning by ZIP-prefix keeps the haversine step cheap.
--
-- `idx_resources_zip_type` (zip, type) already covers an EXACT-zip equality
-- scan (used by the match service's direct-ZIP lookups), but a PREFIX
-- match needs an expression index on `left(zip, 3)`. We keep both.
--
-- Benchmark note (local Docker postgres, synthetic 1000-row dataset):
--   before: Seq Scan, ~18ms p95, returns all 1000 rows to app
--   after:  Bitmap Index Scan on idx_resources_zip3_type_status,
--           ~0.6ms p95, returns ~50 rows per NYC-area ZIP prefix.
-- ~30x reduction; see docs/11_Ops_Runbook.md Appendix I.
BEGIN;

CREATE INDEX IF NOT EXISTS idx_resources_zip3_type_status
  ON resource_providers (left(zip, 3), type, status);

COMMIT;

-- ---------------------------------------------------------------------
-- DOWN migration (manual rollback).
--
-- BEGIN;
-- DROP INDEX IF EXISTS idx_resources_zip3_type_status;
-- COMMIT;
