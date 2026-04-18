ALTER TABLE users
  ADD COLUMN IF NOT EXISTS purge_at timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_reason varchar(40),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

DO $$
BEGIN
  ALTER TABLE users
    ADD CONSTRAINT chk_users_deletion_reason_valid
    CHECK (
      deletion_reason IS NULL
      OR deletion_reason IN (
        'no_longer_needed',
        'privacy_concerns',
        'moving_away',
        'safety_concerns',
        'other'
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_purge_at
  ON users (purge_at)
  WHERE purge_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS analytics_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type varchar(40) NOT NULL,
  community_id uuid REFERENCES communities(community_id),
  actor_user_id_hash varchar(64),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_type_occurred_at
  ON analytics_events (event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_community_type_occurred_at
  ON analytics_events (community_id, event_type, occurred_at DESC)
  WHERE community_id IS NOT NULL;
