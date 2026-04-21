-- Rollback for 0016_match_suggestions_candidate_index.sql.
--
-- Drop is safe — the purge-job orphan-sweep falls back to Seq Scan on
-- ~1000 rows, which is fine at pilot scale. The existing
-- `uq_match_suggestions_request_candidate` index still enforces the
-- request_post_id + candidate_type + candidate_id uniqueness constraint.
BEGIN;

DROP INDEX IF EXISTS idx_match_suggestions_candidate;

COMMIT;
