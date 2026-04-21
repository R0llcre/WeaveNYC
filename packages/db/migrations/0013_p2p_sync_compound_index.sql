-- M6 cursor queries filter on `community_id = $1` then order by
-- `(occurred_at, sync_event_id)`. The existing index covers only the
-- first two columns, which forces heap fetches for same-timestamp
-- tie-breaking under burst writes. Replace with a compound index so the
-- full `WHERE` + `ORDER BY` + `LIMIT` plan stays index-only.
--
-- See P4 finding 4 / finding 11 in the M7 audit. With the INCLUDE clause,
-- all columns the `/sync` route reads come from the index, eliminating
-- heap fetches entirely for the hot path.
BEGIN;

DROP INDEX IF EXISTS idx_community_sync_events_community_occurred_at;

CREATE INDEX IF NOT EXISTS idx_community_sync_events_community_cursor
  ON community_sync_events (community_id, occurred_at, sync_event_id)
  INCLUDE (event_type, aggregate_type, aggregate_id, payload_json, cid, actor_p2p_id);

COMMIT;

-- ---------------------------------------------------------------------
-- DOWN migration (manual rollback — this file runs forward-only via
-- `pnpm db:migrate`; the statements below are the inverse if an operator
-- needs to revert to the 0009-era index).
--
-- BEGIN;
-- DROP INDEX IF EXISTS idx_community_sync_events_community_cursor;
-- CREATE INDEX IF NOT EXISTS idx_community_sync_events_community_occurred_at
--   ON community_sync_events (community_id, occurred_at);
-- COMMIT;
