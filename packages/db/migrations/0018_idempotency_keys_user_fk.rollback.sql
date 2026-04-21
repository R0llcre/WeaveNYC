-- Rollback for 0018_idempotency_keys_user_fk.sql.
--
-- Removes the FK. After rollback, deleted users leave orphan
-- idempotency_keys rows until the 24h TTL sweep cleans them up. Matches
-- the pre-0018 state 0014 left us in.
BEGIN;

ALTER TABLE idempotency_keys
  DROP CONSTRAINT IF EXISTS idempotency_keys_user_id_fkey;

COMMIT;
