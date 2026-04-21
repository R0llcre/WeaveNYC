-- F4-B fix #5 — idempotency_keys → users FK.
--
-- 0014 created `idempotency_keys.user_id uuid NOT NULL` without a FK to
-- `users(user_id)`. When the 30d purge-job deletes a user row, their
-- idempotency_keys entries are left dangling until the 24h TTL sweep
-- removes them (see idx_idempotency_keys_expires_at). That's a small
-- but real PII leakage window (`response_body JSONB` contains the
-- first-attempt response verbatim, which can include the user's
-- display_name / conversation text).
--
-- Adding FK with ON DELETE CASCADE means the user-purge step naturally
-- removes the idempotency rows too, without needing a dedicated step in
-- purge-job.ts. The 24h TTL reaper continues to handle expiry for
-- still-active users.
BEGIN;

ALTER TABLE idempotency_keys
  ADD CONSTRAINT idempotency_keys_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(user_id)
  ON DELETE CASCADE;

COMMIT;
