-- F4-B fix #7 — index tune for the 30d user-purge sweep.
--
-- Before this migration:
--   `idx_users_purge_at ON users (purge_at) WHERE purge_at IS NOT NULL`
-- was the supporting index for the purge-job sweep. The sweep query is
-- actually:
--   select user_id, deleted_at, purge_at
--   from users
--   where status = 'deleted'
--     and purge_at is not null
--     and purge_at < now()
--   order by purge_at asc
--   limit 500
-- The partial predicate matches only 1 of 2 constant filters, so the
-- planner picks an index scan that then filters by `status='deleted'`
-- at the heap. On a pilot table with mostly active users this is fine,
-- but at scale (many soft-deleted rows awaiting their 30d TTL) it's
-- measurable.
--
-- Replace with a narrower partial index that matches BOTH mandatory
-- predicates in the WHERE clause, so the sweep is index-only:
--   idx_users_deleted_purge_at
--     ON users (purge_at)
--     WHERE status = 'deleted' AND purge_at IS NOT NULL
--
-- Row count for the new partial index equals the set of users currently
-- in deletion grace-period — always small in steady state.
BEGIN;

DROP INDEX IF EXISTS idx_users_purge_at;

CREATE INDEX IF NOT EXISTS idx_users_deleted_purge_at
  ON users (purge_at)
  WHERE status = 'deleted' AND purge_at IS NOT NULL;

COMMIT;
