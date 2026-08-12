NEXUS SUPABASE BACKUP - restore guide
=====================================
Contents:
  restore_schema.sql  - full current schema (run FIRST)
  restore_data.sql    - all row data as INSERTs (run SECOND)
  <table>.json        - per-table raw JSON copies (safety)
  backup_report.txt   - per-table row count verification

Restore into a NEW Supabase project:
  1. Create a new Supabase project (free plan is fine).
  2. Open Dashboard -> SQL Editor.
  3. Paste ALL of restore_schema.sql and run it.
  4. Paste ALL of restore_data.sql and run it (may take a minute).
  5. Railway envs -> update SUPABASE_URL and SUPABASE_SERVICE_KEY
     to the NEW project's values, then redeploy the backend.
  6. App relaunch: existing users, passwords, sessions, messages,
     stories, circles, notifications all restored. Media files live
     in Cloudflare R2 and are NOT in this zip (back up R2 bucket
     'xyteee-media' separately if needed).

Notes:
  - IDs are TEXT (app-generated), so no sequence conflicts.
  - blocks.id / user_sessions.id are BIGSERIAL; sequences are reset
    automatically at the end of restore_data.sql.
