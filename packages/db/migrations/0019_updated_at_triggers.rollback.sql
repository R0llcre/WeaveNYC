-- Rollback for 0019_updated_at_triggers.sql.
--
-- Drops the triggers + function. After rollback, application code is
-- responsible for setting `updated_at = now()` on every UPDATE — the
-- drift state 0018 left us in. Any writer that forgets will silently
-- leave the column stale.
BEGIN;

DROP TRIGGER IF EXISTS trg_resource_providers_touch_updated_at ON resource_providers;
DROP TRIGGER IF EXISTS trg_dataset_versions_touch_updated_at ON dataset_versions;
DROP TRIGGER IF EXISTS trg_posts_touch_updated_at ON posts;
DROP TRIGGER IF EXISTS trg_communities_touch_updated_at ON communities;
DROP TRIGGER IF EXISTS trg_users_touch_updated_at ON users;

DROP FUNCTION IF EXISTS fn_touch_updated_at();

COMMIT;
