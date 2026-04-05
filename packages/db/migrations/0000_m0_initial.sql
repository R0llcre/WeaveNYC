CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('active', 'suspended', 'deleted');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE user_level AS ENUM ('anonymous', 'verified', 'anchor');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE join_policy AS ENUM ('invite_only', 'open');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE post_type AS ENUM ('request', 'offer');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE category AS ENUM ('food', 'goods', 'childcare', 'companionship', 'translation', 'transportation', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE privacy AS ENUM ('community_only', 'public', 'anchor_mediated');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE post_status AS ENUM ('draft', 'pending_review', 'active', 'fulfilled', 'closed', 'removed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE verification_state AS ENUM ('unverified', 'verified_by_anchor', 'verified_by_witnesses');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE language AS ENUM ('en', 'es', 'zh');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE dataset_version_status AS ENUM ('importing', 'active', 'superseded', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE resource_status AS ENUM ('active', 'inactive');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE contact_request_status AS ENUM ('pending', 'accepted', 'rejected', 'expired', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE report_status AS ENUM ('new', 'in_review', 'resolved', 'dismissed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE report_reason AS ENUM ('harassment', 'scam', 'misinformation', 'unsafe_behavior', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE resolution AS ENUM ('remove_post', 'suspend_user', 'warn', 'none');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
  user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name varchar(50),
  preferred_languages text[],
  home_zip varchar(10),
  phone_hash varchar(64),
  email_hash varchar(64),
  level user_level NOT NULL DEFAULT 'anonymous',
  status user_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS communities (
  community_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL,
  center_zip varchar(10) NOT NULL,
  join_policy join_policy NOT NULL DEFAULT 'invite_only',
  ruleset_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community_members (
  user_id uuid NOT NULL REFERENCES users(user_id),
  community_id uuid NOT NULL REFERENCES communities(community_id),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, community_id)
);

CREATE TABLE IF NOT EXISTS anchors (
  anchor_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(community_id),
  org_name varchar(200) NOT NULL,
  contact varchar(200),
  role_assignments jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS posts (
  post_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_type post_type NOT NULL,
  category category NOT NULL,
  title varchar(60) NOT NULL,
  body text NOT NULL,
  language language NOT NULL DEFAULT 'en',
  location_zip varchar(10) NOT NULL,
  privacy privacy NOT NULL DEFAULT 'community_only',
  expires_at timestamptz NOT NULL,
  created_by uuid NOT NULL REFERENCES users(user_id),
  community_id uuid NOT NULL REFERENCES communities(community_id),
  status post_status NOT NULL DEFAULT 'draft',
  risk_level risk_level NOT NULL DEFAULT 'low',
  verification_state verification_state NOT NULL DEFAULT 'unverified',
  contact_pref jsonb,
  ipfs_cid varchar(100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posts_community_status
  ON posts (community_id, status, category, expires_at);
CREATE INDEX IF NOT EXISTS idx_posts_community_zip
  ON posts (community_id, location_zip, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_posts_created_by
  ON posts (created_by);

CREATE TABLE IF NOT EXISTS dataset_versions (
  dataset_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source varchar(50) NOT NULL,
  dataset_version varchar(50) NOT NULL,
  source_label varchar(120),
  source_url text,
  record_count integer NOT NULL,
  active_record_count integer NOT NULL DEFAULT 0,
  status dataset_version_status NOT NULL DEFAULT 'importing',
  checksum varchar(64),
  import_started_at timestamptz NOT NULL,
  import_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_dataset_versions_dataset_version
  ON dataset_versions (dataset_version);
CREATE UNIQUE INDEX IF NOT EXISTS uq_dataset_versions_source_version
  ON dataset_versions (source, dataset_version);

CREATE TABLE IF NOT EXISTS resource_providers (
  provider_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source varchar(50) NOT NULL,
  source_ref varchar(200) NOT NULL,
  name varchar(200) NOT NULL,
  type varchar(50) NOT NULL,
  address_text text NOT NULL,
  city varchar(100),
  state varchar(50),
  zip varchar(10) NOT NULL,
  phone varchar(30),
  hours_json jsonb,
  languages text[],
  eligibility_notes text,
  lat double precision,
  lng double precision,
  geo_precision varchar(20) DEFAULT 'zip_centroid',
  content_hash varchar(64),
  dataset_version varchar(50) NOT NULL REFERENCES dataset_versions(dataset_version),
  status resource_status NOT NULL DEFAULT 'active',
  last_seen_at timestamptz,
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resources_zip_type
  ON resource_providers (zip, type);
CREATE INDEX IF NOT EXISTS idx_resources_source_ref
  ON resource_providers (source, source_ref);
CREATE INDEX IF NOT EXISTS idx_resources_dataset_status
  ON resource_providers (dataset_version, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_resources_source_ref_version
  ON resource_providers (source, source_ref, dataset_version);
CREATE UNIQUE INDEX IF NOT EXISTS uq_resources_active_source_ref
  ON resource_providers (source, source_ref)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_resources_geom
  ON resource_providers
  USING GIST ((ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography));

CREATE TABLE IF NOT EXISTS match_suggestions (
  suggestion_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_post_id uuid NOT NULL REFERENCES posts(post_id),
  candidate_type varchar(30) NOT NULL,
  candidate_id uuid NOT NULL,
  score double precision NOT NULL,
  reasons text[],
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contact_requests (
  contact_request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_post_id uuid NOT NULL REFERENCES posts(post_id),
  to_post_id uuid NOT NULL REFERENCES posts(post_id),
  requester_user_id uuid NOT NULL REFERENCES users(user_id),
  recipient_user_id uuid NOT NULL REFERENCES users(user_id),
  status contact_request_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contact_requests_recipient_status
  ON contact_requests (recipient_user_id, status, created_at);

CREATE TABLE IF NOT EXISTS conversations (
  conversation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participants uuid[] NOT NULL,
  related_post_ids uuid[],
  contact_request_id uuid NOT NULL REFERENCES contact_requests(contact_request_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_conversations_contact_request_id
  ON conversations (contact_request_id);

CREATE TABLE IF NOT EXISTS messages (
  message_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(conversation_id),
  sender_user_id uuid NOT NULL REFERENCES users(user_id),
  body text NOT NULL,
  safety_flags text[],
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON messages (conversation_id, sent_at);

CREATE TABLE IF NOT EXISTS reports (
  report_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type varchar(20) NOT NULL,
  target_id uuid NOT NULL,
  reason report_reason NOT NULL,
  detail_text text,
  reporter_user_id uuid NOT NULL REFERENCES users(user_id),
  status report_status NOT NULL DEFAULT 'new',
  resolution resolution,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS moderation_actions (
  action_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid REFERENCES reports(report_id),
  anchor_user_id uuid NOT NULL REFERENCES users(user_id),
  community_id uuid NOT NULL REFERENCES communities(community_id),
  action_type varchar(30) NOT NULL,
  target_type varchar(20) NOT NULL,
  target_id uuid NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resource_change_logs (
  change_log_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source varchar(50) NOT NULL,
  source_ref varchar(200) NOT NULL,
  dataset_version varchar(50) NOT NULL REFERENCES dataset_versions(dataset_version),
  change_type varchar(20) NOT NULL,
  changed_fields text[],
  content_hash_before varchar(64),
  content_hash_after varchar(64),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verification_logs (
  verification_log_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES resource_providers(provider_id),
  verifier varchar(100) NOT NULL,
  method varchar(30) NOT NULL,
  result varchar(30) NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
