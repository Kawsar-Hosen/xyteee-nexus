"""XYTEEE Nexus — full Supabase backup.

Dumps every table (all 20) to:
  - <table>.json        raw rows (safety copy, exact API values)
  - restore_schema.sql  full CREATE TABLE + indexes + RLS (run FIRST)
  - restore_data.sql    all rows as INSERTs (run SECOND)
  - backup_report.txt   per-table row count verification
  - README-restore.txt  step-by-step restore guide

Restore into a NEW free Supabase project by pasting the two .sql files
into Dashboard -> SQL Editor, then point Railway at the new project's
SUPABASE_URL / SUPABASE_SERVICE_KEY.

Run:  python3 backend/backup_supabase.py
Requires backend/.env with SUPABASE_URL and SUPABASE_SERVICE_KEY.
"""

import json
import os
import shutil
import time
import urllib.request
import urllib.error
import zipfile
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

BASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

PAGE = 1000

# ── Table order = foreign-key safe insertion order ──────────────────────
# column: (SQL type, special)
# special in {"jsonb", "intarray", "textarray", "bigint"} controls how the
# value is emitted in restore_data.sql. Primary key columns are listed first
# in the INSERT and values carry over as-is (all PKs are app-generated TEXT).
SCHEMA: dict[str, dict[str, str]] = {
    "users": {
        "user_id": "TEXT",
        "email": "TEXT",
        "username": "TEXT",
        "display_name": "TEXT",
        "password_hash": "TEXT",
        "bio": "TEXT",
        "profile_picture": "TEXT",
        "cover_picture": "TEXT",
        "is_private": "BOOLEAN",
        "email_verified": "BOOLEAN",
        "email_verify_token": "TEXT",
        "password_reset_token": "TEXT",
        "password_reset_expiry": "TIMESTAMPTZ",
        "provider": "TEXT",
        "online": "BOOLEAN",
        "last_seen": "TIMESTAMPTZ",
        "verified": "BOOLEAN",
        "verification_type": "TEXT",
        "created_at": "TIMESTAMPTZ",
        "badge_type": "TEXT",
        "expo_push_token": "TEXT",
        "verified_since": "TIMESTAMPTZ",
        "status_text": "TEXT",
        "status_expires_at": "TIMESTAMPTZ",
        "online_status": "TEXT",
        "moderation_status": "TEXT",
        "moderation_reason": "TEXT",
        "moderation_reason_code": "TEXT",
        "moderated_at": "TIMESTAMPTZ",
        "moderated_by": "TEXT",
        "birthday": "TEXT",
        "birthday_visibility": "TEXT",
        "badge_icon": "TEXT",
        "badge_expires_at": "TIMESTAMPTZ",
        "profile_frame": "TEXT",
        "achievement_level": "TEXT",
        "profile_animation": "TEXT",
        "profile_animation_speed": "TEXT",
        "profile_animation_intensity": "TEXT",
        "profile_animation_expires_at": "TIMESTAMPTZ",
    },
    "user_sessions": {
        "id": "BIGINT",
        "session_token": "TEXT",
        "user_id": "TEXT",
        "expires_at": "TIMESTAMPTZ",
        "created_at": "TIMESTAMPTZ",
    },
    "friend_requests": {
        "request_id": "TEXT",
        "from_user": "TEXT",
        "to_user": "TEXT",
        "status": "TEXT",
        "created_at": "TIMESTAMPTZ",
        "resolved_at": "TIMESTAMPTZ",
    },
    "friendships": {
        "friendship_id": "TEXT",
        "a": "TEXT",
        "b": "TEXT",
        "created_at": "TIMESTAMPTZ",
    },
    "blocks": {
        "id": "BIGINT",
        "blocker": "TEXT",
        "blocked": "TEXT",
        "created_at": "TIMESTAMPTZ",
    },
    "conversations": {
        "conversation_id": "TEXT",
        "participants": "textarray",
        "last_message": "TEXT",
        "last_message_at": "TIMESTAMPTZ",
        "created_at": "TIMESTAMPTZ",
        "kind": "TEXT",
        "circle_name": "TEXT",
        "circle_photo": "TEXT",
        "circle_admins": "textarray",
        "circle_description": "TEXT",
        "circle_settings": "jsonb",
        "deleted_for": "textarray",
    },
    "messages": {
        "message_id": "TEXT",
        "conversation_id": "TEXT",
        "sender_id": "TEXT",
        "content": "TEXT",
        "kind": "TEXT",
        "media": "TEXT",
        "file_name": "TEXT",
        "reply_to": "TEXT",
        "edited": "BOOLEAN",
        "deleted_for_everyone": "BOOLEAN",
        "deleted_for": "textarray",
        "read_by": "textarray",
        "delivered_to": "textarray",
        "reactions": "jsonb",
        "pinned_for": "textarray",
        "created_at": "TIMESTAMPTZ",
    },
    "circles": {
        "circle_id": "TEXT",
        "name": "TEXT",
        "description": "TEXT",
        "photo": "TEXT",
        "owner_id": "TEXT",
        "privacy": "TEXT",
        "created_at": "TIMESTAMPTZ",
        "updated_at": "TIMESTAMPTZ",
        "theme": "TEXT",
    },
    "circle_members": {
        "circle_id": "TEXT",
        "user_id": "TEXT",
        "role": "TEXT",
        "joined_at": "TIMESTAMPTZ",
    },
    "circle_invites": {
        "invite_id": "TEXT",
        "circle_id": "TEXT",
        "created_by": "TEXT",
        "invite_code": "TEXT",
        "expires_at": "TIMESTAMPTZ",
        "created_at": "TIMESTAMPTZ",
    },
    "circle_join_requests": {
        "request_id": "TEXT",
        "circle_id": "TEXT",
        "user_id": "TEXT",
        "status": "TEXT",
        "created_at": "TIMESTAMPTZ",
    },
    "circle_messages": {
        "message_id": "TEXT",
        "circle_id": "TEXT",
        "sender_id": "TEXT",
        "content": "TEXT",
        "kind": "TEXT",
        "media": "TEXT",
        "reply_to": "TEXT",
        "edited": "BOOLEAN",
        "deleted_for_everyone": "BOOLEAN",
        "read_by": "textarray",
        "reactions": "jsonb",
        "created_at": "TIMESTAMPTZ",
    },
    "stories": {
        "story_id": "TEXT",
        "user_id": "TEXT",
        "kind": "TEXT",
        "media": "TEXT",
        "caption": "TEXT",
        "is_private": "BOOLEAN",
        "viewers": "jsonb",
        "created_at": "TIMESTAMPTZ",
        "expires_at": "TIMESTAMPTZ",
        "story_reactions": "jsonb",
        "text_x": "FLOAT",
        "text_y": "FLOAT",
        "text_color": "TEXT",
        "text_size": "INTEGER",
        "font_index": "INTEGER",
        "media_scale": "FLOAT",
        "media_x": "FLOAT",
        "media_y": "FLOAT",
        "music_id": "TEXT",
    },
    "notifications": {
        "notif_id": "TEXT",
        "user_id": "TEXT",
        "kind": "TEXT",
        "data": "jsonb",
        "read": "BOOLEAN",
        "created_at": "TIMESTAMPTZ",
    },
    "reports": {
        "report_id": "TEXT",
        "reporter_id": "TEXT",
        "reported_id": "TEXT",
        "conversation_id": "TEXT",
        "category": "TEXT",
        "description": "TEXT",
        "status": "TEXT",
        "created_at": "TIMESTAMPTZ",
        "resolved_at": "TIMESTAMPTZ",
        "resolved_by": "TEXT",
    },
    "appeals": {
        "appeal_id": "TEXT",
        "user_id": "TEXT",
        "name": "TEXT",
        "email": "TEXT",
        "message": "TEXT",
        "suspension_reason": "TEXT",
        "status": "TEXT",
        "created_at": "TIMESTAMPTZ",
        "reviewed_at": "TIMESTAMPTZ",
        "reviewed_by": "TEXT",
    },
    "push_tokens": {
        "user_id": "TEXT",
        "expo_push_token": "TEXT",
        "device_name": "TEXT",
        "created_at": "TIMESTAMPTZ",
        "updated_at": "TIMESTAMPTZ",
    },
}

# BIGSERIAL identity columns — let the new project auto-assign them
SERIAL_COLUMNS = {
    "user_sessions": {"id"},
    "blocks": {"id"},
}

# Single TEXT primary keys (app-generated). Every other table has one.
TEXT_PKS = {
    "users": "user_id",
    "user_sessions": "session_token",
    "friend_requests": "request_id",
    "friendships": "friendship_id",
    "conversations": "conversation_id",
    "messages": "message_id",
    "circles": "circle_id",
    "circle_invites": "invite_id",
    "circle_join_requests": "request_id",
    "circle_messages": "message_id",
    "stories": "story_id",
    "notifications": "notif_id",
    "reports": "report_id",
    "appeals": "appeal_id",
}

# Composite primary keys (no single TEXT pk)
COMPOSITE_PKS = {
    "circle_members": ["circle_id", "user_id"],
    "blocks": ["blocker", "blocked"],
    "push_tokens": ["user_id", "expo_push_token"],
}

# Unique constraints beyond the pk
EXTRA_UNIQUES: dict[str, list[str]] = {
    "users": ["email", "username"],
    "friendships": ["a", "b"],
    "user_sessions": ["session_token"],
}

INDEXES: dict[str, list[str]] = {
    "messages": [
        "CREATE INDEX idx_messages_conv_created ON messages(conversation_id, created_at DESC);",
    ],
    "notifications": [
        "CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);",
    ],
    "stories": [
        "CREATE INDEX idx_stories_user_expires ON stories(user_id, expires_at);",
    ],
    "friend_requests": [
        "CREATE INDEX idx_friend_requests_to_status ON friend_requests(to_user, status);",
        "CREATE INDEX idx_friend_requests_from_status ON friend_requests(from_user, status);",
    ],
    "conversations": [
        "CREATE INDEX idx_conversations_participants ON conversations USING GIN(participants);",
    ],
    "reports": [
        "CREATE INDEX idx_reports_status_created ON reports(status, created_at DESC);",
        "CREATE INDEX idx_reports_reported ON reports(reported_id, created_at DESC);",
    ],
}


def request(path: str, headers: dict | None = None) -> tuple[int, bytes, dict]:
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        headers={
            "apikey": SERVICE_KEY,
            "Authorization": f"Bearer {SERVICE_KEY}",
            **(headers or {}),
        },
    )
    try:
        resp = urllib.request.urlopen(req, timeout=60)
        return resp.status, resp.read(), dict(resp.headers)
    except urllib.error.HTTPError as e:
        body = e.read()
        raise RuntimeError(f"{path}: HTTP {e.code} {body[:300]}")


def fetch_all(table: str) -> list[dict]:
    rows: list[dict] = []
    offset = 0
    while True:
        status, body, headers = request(
            f"/rest/v1/{table}?select=*",
            {
                "Range": f"{offset}-{offset + PAGE - 1}",
                "Prefer": "count=exact",
            },
        )
        batch = json.loads(body)
        rows.extend(batch)
        total = headers.get("Content-Range", "").split("/")
        if len(total) == 2 and total[1] != "*":
            total = int(total[1])
        else:
            total = len(rows)
        if not batch or len(rows) >= total:
            break
        offset += PAGE
    return rows


def sql_literal(v) -> str:
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "TRUE" if v else "FALSE"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, (list, dict)):
        return "'" + json.dumps(v, ensure_ascii=True).replace("'", "''") + "'"
    s = str(v)
    return "'" + s.replace("'", "''") + "'"


def sql_array_literal(v) -> str:
    """PostgreSQL text[] literal: {elem1,elem2} with double-quoted escaping."""
    if v is None:
        return "NULL"
    if not isinstance(v, (list, tuple)):
        v = [v]
    parts = []
    for e in v:
        if e is None:
            parts.append("NULL")
            continue
        s = str(e).replace("\\", "\\\\").replace('"', '\\"')
        parts.append(f'"{s}"')
    return "'" + "{ " + ",".join(parts) + " }'"


def sql_type_for(col_name: str, raw: str) -> str:
    if col_name in ("participants", "circle_admins", "deleted_for", "read_by", "delivered_to", "pinned_for"):
        return "TEXT[]"
    if raw in ("jsonb", "?") or col_name in ("reactions", "viewers", "data", "circle_settings", "story_reactions"):
        return "JSONB"
    if col_name == "id" and raw in ("integer", "bigint"):
        return "BIGINT"
    if raw == "boolean":
        return "BOOLEAN"
    if raw == "integer":
        return "INTEGER"
    if raw == "number":
        return "FLOAT"
    return "TEXT"


def build_schema_sql() -> str:
    out = []
    out.append("-- Nexus full restore schema (generated by backup_supabase.py)")
    out.append("-- Run this in the NEW Supabase project SQL Editor FIRST, then restore_data.sql")
    out.append("")
    for table in SCHEMA:
        cols = []
        for col, t in SCHEMA[table].items():
            if col in SERIAL_COLUMNS.get(table, set()):
                sql_t = "BIGSERIAL"
            else:
                sql_t = {
                    "textarray": "TEXT[]",
                    "jsonb": "JSONB",
                    "bigint": "BIGINT",
                    "float": "FLOAT",
                    "integer": "INTEGER",
                    "boolean": "BOOLEAN",
                }.get(t, t)
            cols.append(f"  {col:<28} {sql_t}")
        lines = "\n".join(cols)
        pk = TEXT_PKS.get(table)
        if pk:
            out.append(f"CREATE TABLE {table} (\n{lines},\n  PRIMARY KEY ({pk})\n);")
        else:
            pks = COMPOSITE_PKS.get(table)
            if pks:
                out.append(f"CREATE TABLE {table} (\n{lines},\n  PRIMARY KEY ({', '.join(pks)})\n);")
            else:
                out.append(f"CREATE TABLE {table} (\n{lines}\n);")
        for u in EXTRA_UNIQUES.get(table, []):
            out.append(f"CREATE UNIQUE INDEX {table}_{u}_key ON {table}({u});")
        for idx in INDEXES.get(table, []):
            out.append(idx)
        out.append("")
    out.append("-- ── Reset auto-increment sequences ──────────────────────")
    out.append("SELECT setval('user_sessions_id_seq', COALESCE((SELECT MAX(id) FROM user_sessions), 1), (SELECT MAX(id) FROM user_sessions) IS NOT NULL);")
    out.append("SELECT setval('blocks_id_seq', COALESCE((SELECT MAX(id) FROM blocks), 1), (SELECT MAX(id) FROM blocks) IS NOT NULL);")
    out.append("")
    out.append("-- ── Disable RLS (service-role key bypasses RLS anyway) ──")
    for table in SCHEMA:
        out.append(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")
    return "\n".join(out)


def build_data_sql(tables_data: dict[str, list[dict]]) -> str:
    out = []
    out.append("-- Nexus full restore data (generated by backup_supabase.py)")
    out.append("-- Run after restore_schema.sql in the NEW project")
    out.append("")
    for table, rows in tables_data.items():
        out.append(f"-- {table}: {len(rows)} rows")
        if not rows:
            out.append("")
            continue
        skip = SERIAL_COLUMNS.get(table, set())
        cols = [c for c in SCHEMA[table] if c not in skip]
        col_sql = ", ".join(f'"{c}"' for c in cols)
        for r in rows:
            vals = ", ".join(
                sql_array_literal(r.get(c)) if SCHEMA[table][c] == "textarray" else sql_literal(r.get(c))
                for c in cols
            )
            out.append(f"INSERT INTO {table} ({col_sql}) VALUES ({vals});")
        out.append("")
    return "\n".join(out)


def main() -> None:
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_dir = Path(__file__).resolve().parent.parent / "backup" / f"nexus_backup_{stamp}"
    out_dir.mkdir(parents=True, exist_ok=True)

    tables_data: dict[str, list[dict]] = {}
    report: list[str] = []
    report.append("NEXUS SUPABASE BACKUP REPORT")
    report.append(f"generated: {datetime.now().isoformat()}")
    report.append(f"project  : {BASE_URL}")
    report.append("")

    for table in SCHEMA:
        rows = fetch_all(table)
        tables_data[table] = rows
        with open(out_dir / f"{table}.json", "w") as f:
            json.dump(rows, f, ensure_ascii=True, indent=1)
        report.append(f"{table:<22} {len(rows):>6} rows")
        print(f"{table:<22} {len(rows):>6} rows")
        time.sleep(0.2)

    with open(out_dir / "restore_schema.sql", "w") as f:
        f.write(build_schema_sql())
    with open(out_dir / "restore_data.sql", "w") as f:
        f.write(build_data_sql(tables_data))
    with open(out_dir / "backup_report.txt", "w") as f:
        f.write("\n".join(report) + "\n")

    readme = f"""NEXUS SUPABASE BACKUP - restore guide
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
"""
    with open(out_dir / "README-restore.txt", "w") as f:
        f.write(readme)

    zip_path = out_dir.parent / f"{out_dir.name}.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in sorted(out_dir.iterdir()):
            zf.write(p, arcname=f"{out_dir.name}/{p.name}")

    print(f"\n✅ Backup complete -> {out_dir}")
    print(f"   zip: {zip_path} ({zip_path.stat().st_size / 1024 / 1024:.1f} MB)")
    print(f"   total rows: {sum(len(v) for v in tables_data.values())}")


if __name__ == "__main__":
    main()
