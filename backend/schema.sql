-- XYTEEE Nexus – Supabase PostgreSQL Schema
-- Run this in Supabase → SQL Editor
-- Safe to rerun: drops all tables first, then recreates cleanly.

-- ── Drop everything (CASCADE handles FK dependencies) ──────────────
DROP TABLE IF EXISTS notifications   CASCADE;
DROP TABLE IF EXISTS stories         CASCADE;
DROP TABLE IF EXISTS messages        CASCADE;
DROP TABLE IF EXISTS conversations   CASCADE;
DROP TABLE IF EXISTS blocks          CASCADE;
DROP TABLE IF EXISTS friendships     CASCADE;
DROP TABLE IF EXISTS friend_requests CASCADE;
DROP TABLE IF EXISTS user_sessions   CASCADE;
DROP TABLE IF EXISTS users           CASCADE;

-- ── Users ──────────────────────────────────────────────────────────
CREATE TABLE users (
  user_id               TEXT        PRIMARY KEY,
  email                 TEXT        UNIQUE NOT NULL,
  username              TEXT        UNIQUE NOT NULL,
  display_name          TEXT        NOT NULL,
  password_hash         TEXT,
  bio                   TEXT        DEFAULT '',
  profile_picture       TEXT        DEFAULT '',
  cover_picture         TEXT        DEFAULT '',
  is_private            BOOLEAN     DEFAULT FALSE,
  email_verified        BOOLEAN     DEFAULT FALSE,
  email_verify_token    TEXT,
  password_reset_token  TEXT,
  password_reset_expiry TIMESTAMPTZ,
  provider              TEXT        DEFAULT 'email',
  online                BOOLEAN     DEFAULT FALSE,
  last_seen             TIMESTAMPTZ DEFAULT NOW(),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  badge_type            TEXT        DEFAULT NULL   -- blue|gold|gray (admin-assigned verified badge)
);

-- ── Sessions ───────────────────────────────────────────────────────
CREATE TABLE user_sessions (
  session_token TEXT        PRIMARY KEY,
  user_id       TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Friend requests ────────────────────────────────────────────────
CREATE TABLE friend_requests (
  request_id  TEXT        PRIMARY KEY,
  from_user   TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  to_user     TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  status      TEXT        DEFAULT 'pending',   -- pending | accepted | rejected
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- ── Friendships ────────────────────────────────────────────────────
-- a < b always (sorted), so each pair is stored exactly once
CREATE TABLE friendships (
  friendship_id TEXT        PRIMARY KEY,
  a             TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  b             TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(a, b),
  CHECK (a < b)
);

-- ── Blocks ─────────────────────────────────────────────────────────
CREATE TABLE blocks (
  blocker    TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  blocked    TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY(blocker, blocked)
);

-- ── Conversations ──────────────────────────────────────────────────
CREATE TABLE conversations (
  conversation_id TEXT        PRIMARY KEY,
  participants    TEXT[]      NOT NULL DEFAULT '{}',
  last_message    TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Messages ───────────────────────────────────────────────────────
CREATE TABLE messages (
  message_id           TEXT        PRIMARY KEY,
  conversation_id      TEXT        NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
  sender_id            TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  content              TEXT        DEFAULT '',
  kind                 TEXT        DEFAULT 'text',
  media                TEXT,
  file_name            TEXT,
  reply_to             TEXT,
  edited               BOOLEAN     DEFAULT FALSE,
  deleted_for_everyone BOOLEAN     DEFAULT FALSE,
  deleted_for          TEXT[]      DEFAULT '{}',
  read_by              TEXT[]      DEFAULT '{}',
  delivered_to         TEXT[]      DEFAULT '{}',
  reactions            JSONB       DEFAULT '[]',
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ── Stories ────────────────────────────────────────────────────────
CREATE TABLE stories (
  story_id   TEXT        PRIMARY KEY,
  user_id    TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  kind       TEXT        DEFAULT 'image',
  media      TEXT        NOT NULL,
  caption    TEXT        DEFAULT '',
  is_private BOOLEAN     DEFAULT FALSE,
  viewers    JSONB       DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- ── Notifications ──────────────────────────────────────────────────
CREATE TABLE notifications (
  notif_id   TEXT        PRIMARY KEY,
  user_id    TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  kind       TEXT        NOT NULL,
  data       JSONB       DEFAULT '{}',
  read       BOOLEAN     DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ────────────────────────────────────────────────────────
CREATE INDEX idx_messages_conv_created
  ON messages(conversation_id, created_at DESC);

CREATE INDEX idx_notifications_user_created
  ON notifications(user_id, created_at DESC);

CREATE INDEX idx_stories_user_expires
  ON stories(user_id, expires_at);

CREATE INDEX idx_friend_requests_to_status
  ON friend_requests(to_user, status);

CREATE INDEX idx_friend_requests_from_status
  ON friend_requests(from_user, status);

CREATE INDEX idx_conversations_participants
  ON conversations USING GIN(participants);

CREATE INDEX idx_messages_deleted_for
  ON messages USING GIN(deleted_for);

CREATE INDEX idx_messages_read_by
  ON messages USING GIN(read_by);

-- ── Disable RLS (service-role key bypasses RLS anyway) ────────────
ALTER TABLE users           DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions   DISABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE friendships     DISABLE ROW LEVEL SECURITY;
ALTER TABLE blocks          DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversations   DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages        DISABLE ROW LEVEL SECURITY;
ALTER TABLE stories         DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications   DISABLE ROW LEVEL SECURITY;
