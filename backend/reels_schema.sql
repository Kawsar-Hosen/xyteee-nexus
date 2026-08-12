-- XYTEEE Nexus – Reels Schema (Supabase PostgreSQL)
-- Run this in Supabase → SQL Editor. Safe to rerun.

CREATE TABLE IF NOT EXISTS reels (
  reel_id       TEXT        PRIMARY KEY,
  user_id       TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  video_url     TEXT        NOT NULL,
  thumbnail_url TEXT        DEFAULT '',
  caption       TEXT        DEFAULT '',
  visibility    TEXT        DEFAULT 'public',  -- public | friends | private
  view_count    BIGINT      DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reel_likes (
  reel_id    TEXT        NOT NULL REFERENCES reels(reel_id) ON DELETE CASCADE,
  user_id    TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (reel_id, user_id)
);

CREATE TABLE IF NOT EXISTS reel_comments (
  comment_id TEXT        PRIMARY KEY,
  reel_id    TEXT        NOT NULL REFERENCES reels(reel_id) ON DELETE CASCADE,
  user_id    TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  content    TEXT        NOT NULL,
  kind       TEXT        DEFAULT 'text',
  media      TEXT        DEFAULT '',
  parent_comment_id TEXT REFERENCES reel_comments(comment_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reel_comments ADD COLUMN IF NOT EXISTS kind TEXT DEFAULT 'text';
ALTER TABLE reel_comments ADD COLUMN IF NOT EXISTS media TEXT DEFAULT '';
ALTER TABLE reel_comments ADD COLUMN IF NOT EXISTS parent_comment_id TEXT REFERENCES reel_comments(comment_id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_reels_user_created
  ON reels(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reels_created
  ON reels(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reel_comments_reel_created
  ON reel_comments(reel_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_reel_comments_parent
  ON reel_comments(parent_comment_id);

CREATE INDEX IF NOT EXISTS idx_reel_likes_reel
  ON reel_likes(reel_id);

ALTER TABLE reels         DISABLE ROW LEVEL SECURITY;
ALTER TABLE reel_likes    DISABLE ROW LEVEL SECURITY;
ALTER TABLE reel_comments DISABLE ROW LEVEL SECURITY;
