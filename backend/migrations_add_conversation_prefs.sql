-- Nexus: conversation mute/archive/pin migration
-- Supabase Dashboard > SQL Editor > paste > Run (ONLY ONCE)

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS muted_for TEXT[] DEFAULT '{}';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS archived_for TEXT[] DEFAULT '{}';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pinned_for TEXT[] DEFAULT '{}';
