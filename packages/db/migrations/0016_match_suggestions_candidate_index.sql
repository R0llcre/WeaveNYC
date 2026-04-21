-- F4-B fix #3 — index for orphan match_suggestions sweep during user purge.
--
-- `match_suggestions.request_post_id` has a FK to `posts` and is indexed
-- via the existing `uq_match_suggestions_request_candidate` and
-- `idx_match_suggestions_request_batch` composites.
--
-- `candidate_id` is ALSO a post_id when `candidate_type = 'post'`, but it
-- has no FK (it's polymorphic across candidate types) and no supporting
-- index. This left a gap in the 30d user-purge cascade: rows where a
-- purged user's post was the candidate (not the request) remained
-- dangling, still readable via the inbox API even though the underlying
-- post row was deleted.
--
-- The purge-job now deletes these rows explicitly (see services/
-- api-gateway/src/lib/purge-job.ts step 7b). This index makes the sweep
-- query index-scan instead of seq-scan, and provides a supporting index
-- should we ever want to add a CHECK or synthetic integrity job.
--
-- Created CONCURRENTLY is NOT used here because:
--   a) we run inside `BEGIN; ... COMMIT;` per the migrate.ts contract, and
--   b) the pilot match_suggestions table has ~1000 rows.
-- A future migration can rebuild CONCURRENTLY if the table grows.
BEGIN;

CREATE INDEX IF NOT EXISTS idx_match_suggestions_candidate
  ON match_suggestions (candidate_type, candidate_id);

COMMIT;
