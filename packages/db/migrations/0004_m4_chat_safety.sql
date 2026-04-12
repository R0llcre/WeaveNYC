DO $$ BEGIN
  CREATE TYPE conversation_status AS ENUM ('active', 'closed', 'blocked');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS status conversation_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS blocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS blocked_by_user_id uuid REFERENCES users(user_id);

CREATE INDEX IF NOT EXISTS idx_conversations_last_activity
  ON conversations (last_activity_at, conversation_id);

CREATE INDEX IF NOT EXISTS idx_messages_sender_sent_at
  ON messages (sender_user_id, sent_at);

CREATE TABLE IF NOT EXISTS conversation_reads (
  conversation_id uuid NOT NULL REFERENCES conversations(conversation_id),
  user_id uuid NOT NULL REFERENCES users(user_id),
  last_read_message_id uuid REFERENCES messages(message_id),
  last_read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_conversation_reads PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS blocks (
  block_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_user_id uuid NOT NULL REFERENCES users(user_id),
  blocked_user_id uuid NOT NULL REFERENCES users(user_id),
  conversation_id uuid REFERENCES conversations(conversation_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_blocks_pair
  ON blocks (blocker_user_id, blocked_user_id);

CREATE INDEX IF NOT EXISTS idx_blocks_blocker
  ON blocks (blocker_user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_blocks_blocked
  ON blocks (blocked_user_id, created_at);
