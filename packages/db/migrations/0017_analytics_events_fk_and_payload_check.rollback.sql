-- Rollback for 0017_analytics_events_fk_and_payload_check.sql.
--
-- Drops the payload CHECK and restores the pre-0017 FK (no ON DELETE
-- clause, i.e. NO ACTION). After rollback, deleting a community row
-- blocks on referencing analytics_events again — that's the same state
-- 0010 left us in.
BEGIN;

ALTER TABLE analytics_events
  DROP CONSTRAINT IF EXISTS analytics_events_payload_is_object;

ALTER TABLE analytics_events
  DROP CONSTRAINT IF EXISTS analytics_events_community_id_fkey;

ALTER TABLE analytics_events
  ADD CONSTRAINT analytics_events_community_id_fkey
  FOREIGN KEY (community_id) REFERENCES communities(community_id);

COMMIT;
