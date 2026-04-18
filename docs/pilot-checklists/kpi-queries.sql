-- WeaveNYC pilot KPI queries
-- Copy-pasteable. Run against the production Postgres replica.
-- Schema reference: packages/db/migrations/0010_m8_account_lifecycle.sql
--                   packages/shared/src/validators/analytics.ts
--
-- The analytics_events table has columns:
--   event_id uuid PRIMARY KEY DEFAULT gen_random_uuid()
--   event_type varchar(40)
--   community_id uuid REFERENCES communities(community_id)
--   actor_user_id_hash varchar(64)
--   occurred_at timestamptz DEFAULT now()
--   payload jsonb
--
-- Known event_type values:
--   verified_match_created, contact_accepted, post_published, anchor_decision,
--   account_deleted, account_undeleted, account_purged, anchor_activated, ttfv_sample
--
-- ---------------------------------------------------------------------------
-- 1. Verified Matches per Week (North Star)
--    Per community, last 7 days rolling.
-- ---------------------------------------------------------------------------

SELECT
  c.name                             AS community,
  c.center_zip                       AS zip,
  COUNT(*) FILTER (
    WHERE e.event_type = 'verified_match_created'
      AND e.occurred_at >= now() - interval '7 days'
  )                                  AS verified_matches_last_7d,
  COUNT(*) FILTER (
    WHERE e.event_type = 'verified_match_created'
      AND e.occurred_at >= now() - interval '14 days'
      AND e.occurred_at <  now() - interval '7 days'
  )                                  AS verified_matches_prev_7d
FROM communities c
LEFT JOIN analytics_events e ON e.community_id = c.community_id
GROUP BY c.community_id, c.name, c.center_zip
ORDER BY verified_matches_last_7d DESC;

-- ---------------------------------------------------------------------------
-- 2. TTFV (Time To First Value) percentiles
--    p50 and p95 over the last 7 days, from ttfv_sample events.
--    ttfv_sample payload: { "milliseconds_since_bootstrap": <int>, ... }
-- ---------------------------------------------------------------------------

SELECT
  percentile_cont(0.50) WITHIN GROUP (
    ORDER BY (payload->>'milliseconds_since_bootstrap')::int
  ) AS ttfv_p50_ms,
  percentile_cont(0.95) WITHIN GROUP (
    ORDER BY (payload->>'milliseconds_since_bootstrap')::int
  ) AS ttfv_p95_ms,
  COUNT(*) AS sample_count
FROM analytics_events
WHERE event_type = 'ttfv_sample'
  AND occurred_at >= now() - interval '7 days'
  AND payload ? 'milliseconds_since_bootstrap';

-- Per community breakdown of TTFV (for communities that have emitted samples):
SELECT
  c.name                             AS community,
  percentile_cont(0.50) WITHIN GROUP (
    ORDER BY (e.payload->>'milliseconds_since_bootstrap')::int
  ) AS ttfv_p50_ms,
  percentile_cont(0.95) WITHIN GROUP (
    ORDER BY (e.payload->>'milliseconds_since_bootstrap')::int
  ) AS ttfv_p95_ms,
  COUNT(*) AS sample_count
FROM analytics_events e
LEFT JOIN communities c ON c.community_id = e.community_id
WHERE e.event_type = 'ttfv_sample'
  AND e.occurred_at >= now() - interval '7 days'
  AND e.payload ? 'milliseconds_since_bootstrap'
GROUP BY c.community_id, c.name
ORDER BY ttfv_p50_ms ASC NULLS LAST;

-- ---------------------------------------------------------------------------
-- 3. Anchor decision latency
--    Time from post_published (with pending_review status) to anchor_decision.
--    We correlate by payload.post_id since actor_user_id_hash differs
--    (publisher vs. anchor).
-- ---------------------------------------------------------------------------

WITH queued AS (
  SELECT
    payload->>'post_id' AS post_id,
    community_id,
    MIN(occurred_at) AS queued_at
  FROM analytics_events
  WHERE event_type = 'post_published'
    AND payload->>'risk_level' IN ('elevated', 'high')
    AND occurred_at >= now() - interval '30 days'
  GROUP BY payload->>'post_id', community_id
),
decided AS (
  SELECT
    payload->>'post_id' AS post_id,
    community_id,
    MIN(occurred_at) AS decided_at,
    MIN(payload->>'decision') AS decision
  FROM analytics_events
  WHERE event_type = 'anchor_decision'
    AND payload->>'target_type' = 'post'
    AND occurred_at >= now() - interval '30 days'
  GROUP BY payload->>'post_id', community_id
)
SELECT
  c.name                                        AS community,
  COUNT(*)                                      AS decisions,
  percentile_cont(0.50) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM (d.decided_at - q.queued_at))
  )                                             AS latency_p50_seconds,
  percentile_cont(0.95) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM (d.decided_at - q.queued_at))
  )                                             AS latency_p95_seconds,
  MAX(EXTRACT(EPOCH FROM (d.decided_at - q.queued_at))) AS latency_max_seconds
FROM queued q
JOIN decided d ON d.post_id = q.post_id AND d.community_id = q.community_id
LEFT JOIN communities c ON c.community_id = q.community_id
GROUP BY c.community_id, c.name
ORDER BY latency_p95_seconds DESC NULLS LAST;

-- ---------------------------------------------------------------------------
-- 4. Contact accept rate
--    Conceptually: contact_accepted / total_contact_requests.
--    Contact requests are stored in the contact_requests table. The table has
--    (from_post_id, to_post_id) rather than a single post reference; we join
--    on to_post_id (recipient side) to attribute to a community.
--    Filtered to last 30 days.
-- ---------------------------------------------------------------------------

SELECT
  c.name                                                     AS community,
  COUNT(DISTINCT cr.contact_request_id)                      AS total_requests,
  COUNT(DISTINCT CASE
    WHEN cr.status = 'accepted' THEN cr.contact_request_id
  END)                                                       AS accepted,
  ROUND(
    100.0 * COUNT(DISTINCT CASE
      WHEN cr.status = 'accepted' THEN cr.contact_request_id
    END)
    / NULLIF(COUNT(DISTINCT cr.contact_request_id), 0),
    1
  )                                                          AS accept_rate_pct
FROM contact_requests cr
LEFT JOIN posts p       ON p.post_id = cr.to_post_id
LEFT JOIN communities c ON c.community_id = p.community_id
WHERE cr.created_at >= now() - interval '30 days'
GROUP BY c.community_id, c.name
ORDER BY total_requests DESC NULLS LAST;

-- Cross-check against the verified_match_created analytics event:
SELECT
  c.name                             AS community,
  COUNT(*) FILTER (
    WHERE e.event_type = 'contact_accepted'
      AND e.occurred_at >= now() - interval '30 days'
  ) AS contact_accepted_last_30d,
  COUNT(*) FILTER (
    WHERE e.event_type = 'verified_match_created'
      AND e.occurred_at >= now() - interval '30 days'
  ) AS verified_matches_last_30d
FROM communities c
LEFT JOIN analytics_events e ON e.community_id = c.community_id
GROUP BY c.community_id, c.name
ORDER BY verified_matches_last_30d DESC NULLS LAST;

-- ---------------------------------------------------------------------------
-- 5. Post publish funnel
--    TODO: the client-side events (composer_opened, composer_submitted)
--    are not yet instrumented. Wire them into apps/pwa/src/lib/analytics.ts
--    and POST to /v1/analytics/events. For now, server-side only:
-- ---------------------------------------------------------------------------

-- Server-visible portion of the funnel: posts that made it as far as the
-- server and, conditional on being flagged, how many got approved.
WITH publishes AS (
  SELECT
    community_id,
    payload->>'post_id'                         AS post_id,
    (payload->>'risk_level')                    AS risk_level,
    occurred_at
  FROM analytics_events
  WHERE event_type = 'post_published'
    AND occurred_at >= now() - interval '30 days'
),
flagged_for_review AS (
  SELECT community_id, post_id
  FROM publishes
  WHERE risk_level IN ('elevated', 'high')
),
approved AS (
  SELECT
    community_id,
    payload->>'post_id'                         AS post_id
  FROM analytics_events
  WHERE event_type = 'anchor_decision'
    AND payload->>'decision' = 'approve'
    AND occurred_at >= now() - interval '30 days'
)
SELECT
  c.name                                        AS community,
  COUNT(DISTINCT p.post_id)                     AS published_posts_30d,
  COUNT(DISTINCT f.post_id)                     AS sent_to_review,
  COUNT(DISTINCT a.post_id)                     AS approved_by_anchor,
  ROUND(
    100.0 * COUNT(DISTINCT a.post_id)
    / NULLIF(COUNT(DISTINCT f.post_id), 0),
    1
  )                                             AS anchor_approve_rate_pct
FROM publishes p
LEFT JOIN flagged_for_review f USING (community_id, post_id)
LEFT JOIN approved a           USING (community_id, post_id)
LEFT JOIN communities c ON c.community_id = p.community_id
GROUP BY c.community_id, c.name
ORDER BY published_posts_30d DESC NULLS LAST;

-- ---------------------------------------------------------------------------
-- 6. Anchor activation health (operational metric, not an OKR)
--    Useful for the Go/No-Go checklist.
-- ---------------------------------------------------------------------------

SELECT
  c.name                               AS community,
  c.center_zip                         AS zip,
  a.status                             AS anchor_status,
  a.activated_at                       AS anchor_activated_at,
  a.last_mfa_at                        AS last_mfa_at,
  MAX(e.occurred_at) FILTER (
    WHERE e.event_type = 'anchor_activated'
  )                                    AS last_activation_event
FROM communities c
LEFT JOIN anchors a ON a.community_id = c.community_id AND a.status = 'active'
LEFT JOIN analytics_events e ON e.community_id = c.community_id
GROUP BY c.community_id, c.name, c.center_zip, a.status, a.activated_at, a.last_mfa_at
ORDER BY c.name;
