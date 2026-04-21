-- Rollback for 0020_users_purge_sweep_index.sql.
--
-- Recreates the pre-0020 partial index and drops the new composite one.
-- The purge-job sweep falls back to the old plan (index scan by
-- purge_at, then filter by status). Fine for pilot scale.
BEGIN;

DROP INDEX IF EXISTS idx_users_deleted_purge_at;

CREATE INDEX IF NOT EXISTS idx_users_purge_at
  ON users (purge_at)
  WHERE purge_at IS NOT NULL;

COMMIT;
