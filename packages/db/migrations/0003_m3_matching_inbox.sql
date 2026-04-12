ALTER TABLE match_suggestions
  ADD COLUMN IF NOT EXISTS batch_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_match_suggestions_request_candidate
  ON match_suggestions (request_post_id, candidate_type, candidate_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_match_suggestions_request_batch_position
  ON match_suggestions (request_post_id, batch_number, position);

CREATE INDEX IF NOT EXISTS idx_match_suggestions_request_batch
  ON match_suggestions (request_post_id, batch_number, position);

CREATE INDEX IF NOT EXISTS idx_contact_requests_requester_status
  ON contact_requests (requester_user_id, status, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS uq_contact_requests_active_pair
  ON contact_requests (from_post_id, to_post_id)
  WHERE status IN ('pending', 'accepted');
