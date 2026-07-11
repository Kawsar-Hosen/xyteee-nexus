CREATE TABLE IF NOT EXISTS circles (
  circle_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  photo TEXT,
  owner_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  privacy TEXT NOT NULL DEFAULT 'public'
    CHECK (privacy IN ('public', 'private')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS circle_members (
  circle_id TEXT NOT NULL REFERENCES circles(circle_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (circle_id, user_id)
);

CREATE TABLE IF NOT EXISTS circle_invites (
  invite_id TEXT PRIMARY KEY,
  circle_id TEXT NOT NULL REFERENCES circles(circle_id) ON DELETE CASCADE,
  created_by TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS circle_join_requests (
  request_id TEXT PRIMARY KEY,
  circle_id TEXT NOT NULL REFERENCES circles(circle_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (circle_id, user_id)
);

CREATE TABLE IF NOT EXISTS circle_messages (
  message_id TEXT PRIMARY KEY,
  circle_id TEXT NOT NULL REFERENCES circles(circle_id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  content TEXT DEFAULT '',
  kind TEXT DEFAULT 'text',
  media TEXT,
  reply_to TEXT,
  edited BOOLEAN DEFAULT FALSE,
  deleted_for_everyone BOOLEAN DEFAULT FALSE,
  read_by TEXT[] DEFAULT '{}',
  reactions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_circle_members_user
  ON circle_members(user_id);

CREATE INDEX IF NOT EXISTS idx_circle_messages_created
  ON circle_messages(circle_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_circle_join_requests
  ON circle_join_requests(circle_id, status);

ALTER TABLE circles DISABLE ROW LEVEL SECURITY;
ALTER TABLE circle_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE circle_invites DISABLE ROW LEVEL SECURITY;
ALTER TABLE circle_join_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE circle_messages DISABLE ROW LEVEL SECURITY;
