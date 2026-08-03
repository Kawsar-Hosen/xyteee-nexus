"""
XYTEEE Nexus — Legacy base64 Blob → R2 URL Migration

Old clients stored images inline as base64 data URIs in the users and stories
tables. That makes the feed response megabytes large and slow (7.6MB observed).
This script uploads every blob to Cloudflare R2 and replaces the value with the
public URL. Idempotent — rows that are already URLs (or null) are skipped, and a
re-run simply does nothing.

Usage:
  cd backend
  python3 migrate_blobs_to_r2.py

Requires the same .env as server.py (SUPABASE_URL, SUPABASE_SERVICE_KEY, R2_*).
"""
import base64
import os
import uuid
from pathlib import Path

import boto3
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
R2_ACCOUNT_ID = os.environ.get("R2_ACCOUNT_ID", "")
R2_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID", "")
R2_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY", "")
R2_BUCKET_NAME = os.environ.get("R2_BUCKET_NAME", "xyteee-media")
R2_PUBLIC_URL = os.environ.get("R2_PUBLIC_URL", "")

r2 = boto3.client(
    "s3",
    endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
    aws_access_key_id=R2_ACCESS_KEY_ID,
    aws_secret_access_key=R2_SECRET_ACCESS_KEY,
    region_name="auto",
)
sb: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

mime_of = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/heic": "heic",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
}


def is_blob(v) -> bool:
    return isinstance(v, str) and v.startswith("data:")


def parse_data_uri(v: str):
    """Return (bytes, mime, ext) from a `data:<mime>;base64,<payload>` string."""
    header, _, payload = v.partition(",")
    mime = header[5:].split(";")[0] or "application/octet-stream"
    data = base64.b64decode(payload)
    ext = mime_of.get(mime, mime.split("/")[-1].split("+")[0])
    return data, mime, ext


def upload(v: str, prefix: str) -> str:
    data, mime, ext = parse_data_uri(v)
    key = f"{prefix}/{uuid.uuid4().hex}.{ext}"
    r2.put_object(
        Bucket=R2_BUCKET_NAME,
        Key=key,
        Body=data,
        ContentType=mime,
    )
    return f"{R2_PUBLIC_URL}/{key}"


def migrate_rows(table: str, column: str, prefix: str) -> tuple[int, int]:
    """Fetch rows where `column` looks like a blob and replace with an R2 URL.

    Returns (rows_fetched, rows_migrated). The server-side PostgREST filter
    cannot express `like(data:%)` reliably, so we fetch the full column list and
    filter in Python — fine at this dataset size.
    """
    id_col = "story_id" if table == "stories" else "user_id"
    r = sb.table(table).select(id_col + "," + column).execute()
    rows = r.data or []
    migrated = 0
    for row in rows:
        value = row.get(column)
        if not is_blob(value):
            continue
        url = upload(value, prefix)
        sb.table(table).update({column: url}).eq(id_col, row[id_col]).execute()
        migrated += 1
        print(f"  migrated {table}.{column} → {url[:70]}…")
    return len(rows), migrated


def main() -> None:
    if not R2_ACCOUNT_ID or not R2_PUBLIC_URL or "YOUR_" in R2_ACCOUNT_ID:
        print("R2 storage not configured in .env — aborting.")
        return

    for table, column, prefix in [
        ("users", "profile_picture", "avatars"),
        ("users", "cover_picture", "covers"),
        ("stories", "media", "stories"),
    ]:
        total, migrated = migrate_rows(table, column, prefix)
        print(f"  {table}.{column}: {migrated}/{total} migrated")

    print("✅ Migration complete. Feed payloads are now small URLs.")


if __name__ == "__main__":
    main()
