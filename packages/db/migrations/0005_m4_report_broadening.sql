ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS community_id uuid REFERENCES communities(community_id);

UPDATE reports r
SET community_id = ma.community_id
FROM moderation_actions ma
WHERE ma.report_id = r.report_id
  AND r.community_id IS NULL;

UPDATE reports r
SET community_id = p.community_id
FROM posts p
WHERE r.target_type = 'post'
  AND r.target_id = p.post_id
  AND r.community_id IS NULL;

UPDATE reports r
SET community_id = p.community_id
FROM messages m
JOIN conversations c
  ON c.conversation_id = m.conversation_id
JOIN contact_requests cr
  ON cr.contact_request_id = c.contact_request_id
JOIN posts p
  ON p.post_id = cr.from_post_id
WHERE r.target_type = 'message'
  AND r.target_id = m.message_id
  AND r.community_id IS NULL;

UPDATE reports r
SET community_id = shared.community_id
FROM (
  SELECT
    candidate.report_id,
    min(candidate.community_id::text)::uuid AS community_id
  FROM (
    SELECT
      r2.report_id,
      cm_target.community_id
    FROM reports r2
    JOIN community_members cm_target
      ON cm_target.user_id = r2.target_id
    JOIN community_members cm_reporter
      ON cm_reporter.user_id = r2.reporter_user_id
     AND cm_reporter.community_id = cm_target.community_id
    WHERE r2.target_type = 'user'
      AND r2.community_id IS NULL
  ) AS candidate
  GROUP BY candidate.report_id
  HAVING count(*) = 1
) AS shared
WHERE r.report_id = shared.report_id
  AND r.community_id IS NULL;

DO $$
DECLARE
  unresolved_count integer;
BEGIN
  UPDATE reports r
  SET community_id = reporter.community_id
  FROM (
    SELECT
      cm.user_id,
      min(cm.community_id::text)::uuid AS community_id
    FROM community_members cm
    GROUP BY cm.user_id
    HAVING count(*) = 1
  ) AS reporter
  WHERE r.reporter_user_id = reporter.user_id
    AND r.community_id IS NULL;

  SELECT count(*)::int
  INTO unresolved_count
  FROM reports
  WHERE community_id IS NULL;

  IF unresolved_count > 0 THEN
    RAISE EXCEPTION
      'Unable to backfill reports.community_id for % legacy rows; manual remediation required before enforcing NOT NULL',
      unresolved_count;
  END IF;

  ALTER TABLE reports
    ALTER COLUMN community_id SET NOT NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_reports_community_created_at
  ON reports (community_id, created_at);
