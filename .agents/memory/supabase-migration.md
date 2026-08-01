---
name: Supabase migration
description: Key decisions and quirks from migrating XYTEEE Nexus from MongoDB/Motor to Supabase (PostgreSQL).
---

**Why migrated:** MongoDB Atlas rejected Replit's IP (TLSV1_ALERT_INTERNAL_ERROR on SSL handshake). User then requested full Supabase migration.

**Key decisions:**
- `from` → `from_user` / `to_user` in `friend_requests` table: `from` is a reserved SQL word
- Friendships always stored with `a < b` (sorted alphabetically): simplifies duplicate-pair queries to simple eq("a").eq("b")
- Schema has `CHECK (a < b)` DB-level constraint on `friendships` table
- `supabase-py` sync client wrapped in `asyncio.to_thread()` — reliable for FastAPI async
- RLS disabled on all tables; backend uses service-role key which bypasses RLS anyway
- Removed Google OAuth / emergent integration entirely (called external emergentagent.com)
- `forgot-password` endpoint must NOT return reset_token in response (security fix applied)

**Schema file:** `backend/schema.sql` — has DROP TABLE IF EXISTS at top, safe to rerun.
