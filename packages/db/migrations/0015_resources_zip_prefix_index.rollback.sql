-- Rollback for 0015_resources_zip_prefix_index.sql.
--
-- 0015 landed a single additive expression index used by the public
-- `/v1/resources?zip=...&type=...` hot path. Dropping it is safe for the
-- pre-0015 runtime — the repository falls back to the `idx_resources_zip_type`
-- (zip, type) index + application-level haversine filter. Performance
-- degrades to ~18ms p95 Seq Scan on the synthetic benchmark, but correctness
-- is preserved.
--
-- As with every rollback file in this directory: roll the application image
-- BACK first if the running api-gateway was built against post-0015 code.
-- See docs/29_M8_Pilot_Readiness.md §3.7 for ordering.
BEGIN;

DROP INDEX IF EXISTS idx_resources_zip3_type_status;

COMMIT;
