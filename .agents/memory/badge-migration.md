---
name: Badge type DB column
description: The badge_type column must be manually added to Supabase; PostgREST cannot run DDL.
---

Supabase's REST API (PostgREST) only supports DML — it cannot execute DDL (ALTER TABLE, CREATE TABLE etc.).
Any new columns must be added via:
1. Supabase SQL Editor (Dashboard → SQL Editor → New Query), OR
2. A psycopg2/asyncpg script with DATABASE_URL (password-based direct connection)

**Migration SQL for badge_type:**
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS badge_type TEXT DEFAULT NULL;
```

**Why:** No exec_sql RPC function exists in the Supabase project; Management API requires a personal access token (not the service key); no DATABASE_URL secret is configured in this Replit.
