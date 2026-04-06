DO $$
BEGIN
  CREATE TYPE community_access_channel AS ENUM ('invite_code', 'qr_token');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE community_access_code_status AS ENUM ('active', 'revoked');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS community_access_codes (
  access_code_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities (community_id),
  channel community_access_channel NOT NULL,
  code varchar(140) NOT NULL,
  status community_access_code_status NOT NULL DEFAULT 'active',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_access_codes_community_status
  ON community_access_codes (community_id, status, channel);

CREATE INDEX IF NOT EXISTS idx_community_access_codes_channel_code
  ON community_access_codes (channel, code);

CREATE UNIQUE INDEX IF NOT EXISTS uq_community_access_codes_active_channel_code
  ON community_access_codes (channel, code)
  WHERE status = 'active';
