ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS p2p_version integer NOT NULL DEFAULT 1;

ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS ipfs_cid varchar(100),
  ADD COLUMN IF NOT EXISTS p2p_version integer NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS community_sync_events (
  sync_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(community_id),
  event_type varchar(80) NOT NULL,
  aggregate_type varchar(40) NOT NULL,
  aggregate_id uuid NOT NULL,
  actor_user_id uuid REFERENCES users(user_id),
  actor_p2p_id varchar(120),
  payload_json jsonb NOT NULL,
  cid varchar(100),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_sync_events_community_occurred_at
  ON community_sync_events (community_id, occurred_at);

CREATE INDEX IF NOT EXISTS idx_community_sync_events_aggregate_occurred_at
  ON community_sync_events (aggregate_type, aggregate_id, occurred_at);
