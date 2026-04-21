-- F4-B fix #6 — fn_touch_updated_at() + BEFORE UPDATE triggers.
--
-- Every table with an `updated_at timestamptz NOT NULL DEFAULT now()`
-- column depends on every writer to remember to set `updated_at = now()`
-- in their UPDATE. This is brittle and has already drifted at least
-- once in services/posts/src/repository.ts:stampPostSyncMetadata
-- (line ~351) — the post-sync CID update touches `ipfs_cid` without
-- touching `updated_at`, so the row timestamp stops reflecting the
-- actual last mutation.
--
-- A BEFORE UPDATE trigger per tracked table makes the DB layer
-- authoritative: application code no longer has to care. The trigger is
-- a no-op if the caller already set `updated_at` in the same statement
-- — we unconditionally overwrite to `now()` because that's the intent
-- of the column in every existing callsite.
--
-- Scope: tables flagged in the F4-B audit as having an
-- app-side-maintained `updated_at`:
--   - users, communities, posts, dataset_versions, resource_providers
--
-- Tables with domain-specific update semantics (messages, reports,
-- community_sync_events, etc.) are intentionally NOT touched here —
-- their updated_at columns track specific state transitions, not the
-- generic "last mutation" signal, and a trigger would silently clobber
-- hand-maintained values. Add them case-by-case in a future migration
-- if that changes.
BEGIN;

-- The trigger is "only overwrite if the caller didn't explicitly change
-- updated_at". This preserves callsites that deliberately set a specific
-- timestamp (e.g. anchor review decisions pass `decidedAt` for determinism
-- in tests + audit replay) while still catching the drift bug where a
-- writer forgets updated_at entirely. A writer that forgets leaves NEW
-- .updated_at == OLD.updated_at, which we overwrite to now(); a writer
-- that supplies a value is left alone.
CREATE OR REPLACE FUNCTION fn_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at THEN
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

-- Use DROP IF EXISTS + CREATE (rather than CREATE OR REPLACE, which
-- pg doesn't support for triggers) to keep the migration idempotent
-- under partial-failure re-runs.
DROP TRIGGER IF EXISTS trg_users_touch_updated_at ON users;
CREATE TRIGGER trg_users_touch_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

DROP TRIGGER IF EXISTS trg_communities_touch_updated_at ON communities;
CREATE TRIGGER trg_communities_touch_updated_at
  BEFORE UPDATE ON communities
  FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

DROP TRIGGER IF EXISTS trg_posts_touch_updated_at ON posts;
CREATE TRIGGER trg_posts_touch_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

DROP TRIGGER IF EXISTS trg_dataset_versions_touch_updated_at ON dataset_versions;
CREATE TRIGGER trg_dataset_versions_touch_updated_at
  BEFORE UPDATE ON dataset_versions
  FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

DROP TRIGGER IF EXISTS trg_resource_providers_touch_updated_at ON resource_providers;
CREATE TRIGGER trg_resource_providers_touch_updated_at
  BEFORE UPDATE ON resource_providers
  FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

COMMIT;
