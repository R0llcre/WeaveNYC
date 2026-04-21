-- Rollback for 0014_idempotency_keys.sql.
--
-- 0014 landed three additive dedup guards:
--   1. `idempotency_keys` table + 2 supporting indexes
--   2. `messages.client_message_id` column + `uq_messages_client_dedup`
--      partial unique index
--   3. `uq_reports_reporter_target_active` partial unique index on
--      `reports` (status = 'new')
--
-- Dropping the table, column, and indexes is safe for the runtime code
-- that existed before #45 / A7 P0-2/3/4: the write paths fall back to
-- application-level dedup semantics the moment these guards go away.
-- BUT: if the api-gateway running against the rolled-back schema was
-- built against post-0014 code, inserts into `idempotency_keys` will
-- error out. Roll the application image BACK first, then run this
-- rollback. See docs/29_M8_Pilot_Readiness.md §3.7 for ordering.
BEGIN;

DROP INDEX IF EXISTS uq_reports_reporter_target_active;
DROP INDEX IF EXISTS uq_messages_client_dedup;
ALTER TABLE messages DROP COLUMN IF EXISTS client_message_id;
DROP INDEX IF EXISTS idx_idempotency_keys_user_route;
DROP INDEX IF EXISTS idx_idempotency_keys_expires_at;
DROP TABLE IF EXISTS idempotency_keys;

COMMIT;
