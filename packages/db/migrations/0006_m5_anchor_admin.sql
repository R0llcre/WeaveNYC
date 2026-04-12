DO $$
BEGIN
  CREATE TYPE anchor_invite_status AS ENUM ('active', 'consumed', 'revoked');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE anchor_status AS ENUM ('pending_activation', 'active', 'revoked');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE announcement_status AS ENUM ('active', 'deleted');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE announcement_pin_strategy AS ENUM ('latest', 'manual');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS anchor_invites (
  anchor_invite_id uuid PRIMARY KEY,
  community_id uuid NOT NULL REFERENCES communities(community_id),
  code_hash varchar(64) NOT NULL,
  org_name varchar(200),
  status anchor_invite_status NOT NULL DEFAULT 'active',
  expires_at timestamptz,
  consumed_by_user_id uuid REFERENCES users(user_id),
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_anchor_invites_code_hash
  ON anchor_invites (code_hash);

CREATE INDEX IF NOT EXISTS idx_anchor_invites_community_status
  ON anchor_invites (community_id, status, created_at);

CREATE TABLE IF NOT EXISTS community_rulesets (
  ruleset_id uuid PRIMARY KEY,
  community_id uuid NOT NULL REFERENCES communities(community_id),
  review_categories text[] NOT NULL DEFAULT '{}'::text[],
  auto_hide_report_threshold integer NOT NULL DEFAULT 3,
  keyword_blocklist text[] NOT NULL DEFAULT '{}'::text[],
  language_preferences text[] NOT NULL DEFAULT '{}'::text[],
  announcement_pin_strategy announcement_pin_strategy NOT NULL DEFAULT 'latest',
  created_by uuid REFERENCES users(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_community_rulesets_community
  ON community_rulesets (community_id);

ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS ruleset_id uuid;

DO $$
BEGIN
  ALTER TABLE communities
    ADD CONSTRAINT fk_communities_ruleset_id
    FOREIGN KEY (ruleset_id) REFERENCES community_rulesets(ruleset_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE anchors
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(user_id),
  ADD COLUMN IF NOT EXISTS status anchor_status NOT NULL DEFAULT 'pending_activation',
  ADD COLUMN IF NOT EXISTS totp_secret_ciphertext text,
  ADD COLUMN IF NOT EXISTS recovery_codes_hashes text[],
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_mfa_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS uq_anchors_user
  ON anchors (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_anchors_active_community
  ON anchors (community_id)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS announcements (
  announcement_id uuid PRIMARY KEY,
  community_id uuid NOT NULL REFERENCES communities(community_id),
  title varchar(140) NOT NULL,
  body text NOT NULL,
  status announcement_status NOT NULL DEFAULT 'active',
  is_pinned boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES users(user_id),
  published_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_announcements_community_published_at
  ON announcements (community_id, published_at);

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES conversations(conversation_id);

UPDATE reports r
SET conversation_id = m.conversation_id
FROM messages m
WHERE r.target_type = 'message'
  AND r.target_id = m.message_id
  AND r.conversation_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_reports_community_status_created_at
  ON reports (community_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_moderation_actions_report_id
  ON moderation_actions (report_id);
