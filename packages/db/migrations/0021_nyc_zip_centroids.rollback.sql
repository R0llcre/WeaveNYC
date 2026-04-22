-- Rollback for 0021_nyc_zip_centroids.sql.
--
-- Drops the lookup table; the geocoder falls back to the in-memory
-- hard-coded table (Long Island only, 7 rows) and Nominatim for any
-- NYC ZIPs. The sidecar's `SELECT` against `nyc_zip_centroids` will
-- throw — restart the service so it falls back to `zipCentroidTable`
-- without touching the DB.

BEGIN;

DROP TABLE IF EXISTS nyc_zip_centroids;

COMMIT;
