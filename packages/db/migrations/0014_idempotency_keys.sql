-- HTTP-level idempotency + write-path dedup hardening (A7 P0-2/3/4, A2 P0-4, A2 P1-7).
--
-- This migration lands three independent dedup guards that work together to
-- make the write path safe against client retries, double-submit races, and a
-- single-user griefing exploit that previously tripped the auto-hide threshold.
--
-- 1. `idempotency_keys` table — server-side cache for "Idempotency-Key"
--    header semantics on POST /v1/posts, POST /v1/conversations/:id/messages,
--    and POST /v1/reports. Stores the first response verbatim so retries
--    see the same outcome. Stripe-style 24h TTL is enforced by a reaper in
--    the api-gateway purge-job (`idx_idempotency_keys_expires_at` powers the
--    sweep query).
--
-- 2. `uq_messages_client_dedup` unique index — a partial unique index on
--    (`sender_user_id`, `client_message_id`) so the chat-send path can rely
--    on ON CONFLICT for natural dedup even when the HTTP idempotency cache
--    has been purged (e.g. after restart). NULL `client_message_id` means
--    "legacy client didn't supply one" so the index is partial.
--
-- 3. `uq_reports_reporter_target_active` unique index — prevents a single
--    user from stacking multiple 'new' reports against the same target.
--    Without this, a griefer could tap Report three times in a row and
--    auto-trip the 3-reporter threshold alone. Combined with the
--    `count(distinct reporter_user_id)` change in
--    services/chat/src/pg-repository.ts `autoHidePostIfThresholdReached`,
--    this closes the single-user-auto-hide exploit (A2 P1-7).
BEGIN;

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  route_name TEXT NOT NULL,
  user_id UUID NOT NULL,
  client_key TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at
  ON idempotency_keys (expires_at);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_user_route
  ON idempotency_keys (user_id, route_name);

-- Add `client_message_id` column to `messages` for natural-key dedup on the
-- chat send path. Nullable so legacy/pre-migration rows stay valid; the
-- unique index below is partial on NOT NULL values.
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS client_message_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_messages_client_dedup
  ON messages (sender_user_id, client_message_id)
  WHERE client_message_id IS NOT NULL;

-- Prevent the single-user-auto-hide griefing vector (A2 P1-7).
-- A 'new' report row is unique per (target, reporter). Once a report is
-- resolved or dismissed it drops out of the partial index so the same user
-- can legitimately file again if the behavior recurs.
CREATE UNIQUE INDEX IF NOT EXISTS uq_reports_reporter_target_active
  ON reports (target_type, target_id, reporter_user_id)
  WHERE status = 'new';

COMMIT;

-- ---------------------------------------------------------------------
-- DOWN migration (manual rollback).
--
-- BEGIN;
-- DROP INDEX IF EXISTS uq_reports_reporter_target_active;
-- DROP INDEX IF EXISTS uq_messages_client_dedup;
-- ALTER TABLE messages DROP COLUMN IF EXISTS client_message_id;
-- DROP INDEX IF EXISTS idx_idempotency_keys_user_route;
-- DROP INDEX IF EXISTS idx_idempotency_keys_expires_at;
-- DROP TABLE IF EXISTS idempotency_keys;
-- COMMIT;
