"""
XYTEEE Nexus — Database Migration Helper
Run once to add new columns needed by the admin / badge system.

Usage:
  cd backend
  python3 migrate.py

This script requires DATABASE_URL env var pointing to your Supabase postgres
instance (find it in Supabase Dashboard → Settings → Database → Connection string).

Alternatively, paste the SQL below into Supabase SQL Editor:

  ALTER TABLE users ADD COLUMN IF NOT EXISTS badge_type TEXT DEFAULT NULL;

"""
import os
import sys
from dotenv import load_dotenv

load_dotenv(".env")

SQL = "ALTER TABLE users ADD COLUMN IF NOT EXISTS badge_type TEXT DEFAULT NULL;"

db_url = os.environ.get("DATABASE_URL")
if not db_url:
    print("=" * 60)
    print("DATABASE_URL not set. Paste this in Supabase SQL Editor:")
    print()
    print(f"  {SQL}")
    print()
    print("Supabase Dashboard → SQL Editor → New Query → paste → Run")
    print("=" * 60)
    sys.exit(0)

try:
    import psycopg2
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(SQL)
    print("✅ Migration complete: badge_type column added to users table.")
    conn.close()
except ImportError:
    print("psycopg2 not installed. Paste this in Supabase SQL Editor:")
    print(f"  {SQL}")
except Exception as e:
    print(f"Error: {e}")
    print(f"Paste in Supabase SQL Editor: {SQL}")
