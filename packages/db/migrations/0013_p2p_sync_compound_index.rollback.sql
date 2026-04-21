-- Rollback for 0013_p2p_sync_compound_index.sql.
--
-- 0013 dropped the 0009-era (community_id, occurred_at) index and
-- replaced it with a compound (community_id, occurred_at, sync_event_id)
-- index INCLUDE (event_type, aggregate_type, aggregate_id, payload_json,
-- cid, actor_p2p_id). This rollback restores the prior index shape.
--
-- Both operations are idempotent via IF EXISTS / IF NOT EXISTS guards so
-- the command is safe to re-run. The rollback runner
-- (packages/db/scripts/rollback.ts) wraps it in a single transaction.
BEGIN;

DROP INDEX IF EXISTS idx_community_sync_events_community_cursor;

CREATE INDEX IF NOT EXISTS idx_community_sync_events_community_occurred_at
  ON community_sync_events (community_id, occurred_at);

COMMIT;
