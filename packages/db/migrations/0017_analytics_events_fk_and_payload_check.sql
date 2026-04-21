-- F4-B fix #4 — analytics_events FK hardening + payload shape guard.
--
-- Problem 1: `analytics_events.community_id REFERENCES communities(community_id)`
-- was created in 0010 without an `ON DELETE` clause, so it defaults to
-- `NO ACTION`. That means deleting a community row is blocked by any
-- analytics event that references it — a real ops footgun once the
-- community admin UI can delete communities.
--
-- Problem 2: `payload jsonb` has no shape constraint. The analytics writer
-- in services/api-gateway/src/lib/analytics.ts stringifies an object
-- before insert, but nothing stops a caller from inserting a raw string,
-- number, or JSON null. Adding a CHECK that the payload is either NULL or
-- a JSON object makes the contract explicit at the DB layer and prevents
-- future regressions from polluting the table.
--
-- Both changes are low-risk for pilot data:
--   - FK swap: the SET NULL behavior matches the post-purge semantics we
--     already use for community_sync_events.actor_user_id (tombstone,
--     don't cascade-delete, keep the event row).
--   - CHECK: existing rows written by the purge-job + analytics recorder
--     are all `jsonb_build_object(...)` objects, so backfill passes.
BEGIN;

-- 1. Drop + re-add the community_id FK with ON DELETE SET NULL.
-- The constraint name pg auto-generates is `analytics_events_community_id_fkey`.
ALTER TABLE analytics_events
  DROP CONSTRAINT IF EXISTS analytics_events_community_id_fkey;

ALTER TABLE analytics_events
  ADD CONSTRAINT analytics_events_community_id_fkey
  FOREIGN KEY (community_id) REFERENCES communities(community_id)
  ON DELETE SET NULL;

-- 2. CHECK constraint: payload must be NULL or a JSON object (not an array,
-- not a scalar). Matches the de-facto contract between the analytics
-- recorder and the purge-job emitter.
ALTER TABLE analytics_events
  ADD CONSTRAINT analytics_events_payload_is_object
  CHECK (payload IS NULL OR jsonb_typeof(payload) = 'object');

COMMIT;
