"""
XYTEEE Nexus – Real-Time Social Chat Platform (FastAPI + Supabase/PostgreSQL)
All endpoints prefixed /api.  WebSocket at /api/ws.
"""
from __future__ import annotations
import httpx

import os
import uuid
import logging
import asyncio
import smtplib
from email.message import EmailMessage
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Set

import jwt
from bcrypt import hashpw, checkpw, gensalt
from fastapi import (
    FastAPI,
    APIRouter,
    Depends,
    HTTPException,
    Header,
    Query,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.openapi.utils import get_openapi
from starlette.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from pydantic import BaseModel, EmailStr, Field
from dotenv import load_dotenv

# ── Setup ──────────────────────────────────────────────────────────────────────
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_DAYS = int(os.environ.get("JWT_EXPIRE_DAYS", "7"))

SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_EMAIL = os.environ.get("SMTP_EMAIL", "")
SMTP_APP_PASSWORD = os.environ.get("SMTP_APP_PASSWORD", "")
SMTP_FROM_NAME = os.environ.get("SMTP_FROM_NAME", "XYTEEE Nexus")

sb: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("xyteee")

app = FastAPI(title="XYTEEE Nexus API")
api = APIRouter(prefix="/api")


# ── DB helper ──────────────────────────────────────────────────────────────────
async def run(fn):
    """Run a sync Supabase call in a thread pool so the event loop stays free."""
    return await asyncio.to_thread(fn)


# ── Email helper ───────────────────────────────────────────────────────────────
def _send_email_sync(
    to_email: str,
    subject: str,
    body: str,
    html: Optional[str] = None,
) -> None:
    if not SMTP_EMAIL or not SMTP_APP_PASSWORD:
        raise RuntimeError("SMTP email credentials are not configured")

    message = EmailMessage()
    message["From"] = f"{SMTP_FROM_NAME} <{SMTP_EMAIL}>"
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(body)

    if html:
        message.add_alternative(html, subtype="html")

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as smtp:
        smtp.ehlo()
        smtp.starttls()
        smtp.ehlo()
        smtp.login(SMTP_EMAIL, SMTP_APP_PASSWORD)
        smtp.send_message(message)


async def send_email(
    to_email: str,
    subject: str,
    body: str,
    html: Optional[str] = None,
) -> None:
    await asyncio.to_thread(
        _send_email_sync,
        to_email,
        subject,
        body,
        html,
    )


# ── Utils ──────────────────────────────────────────────────────────────────────
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def make_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


def hash_password(pwd: str) -> str:
    return hashpw(pwd.encode(), gensalt()).decode()


def verify_password(pwd: str, hashed: str) -> bool:
    try:
        return checkpw(pwd.encode(), hashed.encode())
    except Exception:
        return False


def create_jwt(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": int(now_utc().timestamp()),
        "exp": int((now_utc() + timedelta(days=JWT_EXPIRE_DAYS)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_jwt(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("sub")
    except Exception:
        return None


def ts(dt: datetime) -> str:
    """Convert datetime → ISO-8601 string for Supabase."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def parse_ts(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def jsonable(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: jsonable(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [jsonable(v) for v in obj]
    if isinstance(obj, datetime):
        return ts(obj)
    return obj


_HIDDEN = {"password_hash", "email_verify_token", "password_reset_token", "password_reset_expiry"}


def public_user(u: Optional[dict]) -> Optional[dict]:
    if not u:
        return None

    data = {k: v for k, v in u.items() if k not in _HIDDEN}

    status_expiry = parse_ts(data.get("status_expires_at"))
    if status_expiry and status_expiry <= now_utc():
        data["status_text"] = None
        data["status_expires_at"] = None

    return data


async def get_user_public(user_id: str) -> Optional[dict]:
    r = await run(lambda: sb.table("users").select("*").eq("user_id", user_id).execute())
    return public_user(r.data[0]) if r.data else None



async def _send_expo_push(to_user: str, kind: str, data: dict):
    r = await run(
        lambda: sb.table("push_tokens")
        .select("expo_push_token")
        .eq("user_id", to_user)
        .execute()
    )

    tokens = [
        x.get("expo_push_token")
        for x in (r.data or [])
        if x.get("expo_push_token")
    ]
    if not tokens:
        return

    title_map = {
        "friend_request": "New friend request",
        "friend_accepted": "Friend request accepted",
        "message": "New message",
        "voice_call": "Incoming voice call",
        "story": "New story notification",
        "circle_invite": "New Circle invitation",
        "circle_invite_accepted": "Circle invitation accepted",
        "circle_invite_rejected": "Circle invitation declined",
        "circle_member_removed": "Removed from Circle",
        "circle_message_reaction": "Message reaction",
        "message_reaction": "Message reaction",
        "story_reaction": "Story reaction",
        "account_moderated": "Account suspended" if data.get("status") == "suspended" else "Account banned",
        "account_restored": "Account restored",
        "circle_message": data.get("circle_name") or "Circle message",
    }

    from_name = data.get("from_name") or "Someone"

    body_map = {
        "friend_request": f"{from_name} sent you a friend request",
        "friend_accepted": f"{from_name} accepted your friend request",
        "message": f"{from_name}: {data.get('preview') or 'Sent you a message'}",
        "voice_call": f"{from_name} is calling you",
        "story": f"{from_name} added a new story",
        "circle_invite": f"{from_name} invited you to {data.get('circle_name') or 'a Circle'}",
        "circle_invite_accepted": f"{from_name} accepted your invitation to {data.get('circle_name') or 'the Circle'}",
        "circle_invite_rejected": f"{from_name} declined your invitation to {data.get('circle_name') or 'the Circle'}",
        "circle_member_removed": f"You were removed from {data.get('circle_name') or 'a Circle'}",
        "circle_message_reaction": f"{from_name} reacted {data.get('emoji') or '❤️'} to your Circle message",
        "message_reaction": f"{from_name} reacted {data.get('emoji') or '❤️'} to your message",
        "story_reaction": f"{from_name} reacted {data.get('emoji') or '❤️'} to your story",
        "account_moderated": data.get("reason") or "Your account status has been updated",
        "account_restored": "Your account has been restored. You can use Nexus again.",
        "circle_message": f"{from_name}: {data.get('preview') or 'Sent a message'}",
    }

    messages = [
        {
            "to": token,
            "sound": "default",
            "title": title_map.get(kind, "XYTEEE Nexus"),
            "body": data.get("message") or data.get("body") or body_map.get(kind, "You have a new notification"),
            "data": {"kind": kind, **jsonable(data)},
        }
        for token in tokens
    ]

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            "https://exp.host/--/api/v2/push/send",
            json=messages,
            headers={"Content-Type": "application/json"},
        )
        response.raise_for_status()
        result = response.json()
        logger.info("Expo push response for %s: %s", to_user, result)


# ── Auth dependency ────────────────────────────────────────────────────────────
async def current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1].strip()
    user_id = decode_jwt(token)
    if not user_id:
        r = await run(lambda: sb.table("user_sessions").select("*").eq("session_token", token).execute())
        sess = r.data[0] if r.data else None
        if not sess:
            raise HTTPException(status_code=401, detail="Invalid token")
        exp = parse_ts(sess.get("expires_at"))
        if exp and exp < now_utc():
            raise HTTPException(status_code=401, detail="Session expired")
        user_id = sess.get("user_id")
    user = await get_user_public(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    moderation_status = user.get("moderation_status") or "active"

    if moderation_status in {"suspended", "banned"}:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "ACCOUNT_MODERATED",
                "status": moderation_status,
                "user_id": user.get("user_id"),
                "reason": user.get("moderation_reason") or "No reason provided",
                "reason_code": user.get("moderation_reason_code"),
                "moderated_at": user.get("moderated_at"),
            },
        )

    return user


# ── WebSocket hub (in-memory presence) ────────────────────────────────────────
class Hub:
    def __init__(self):
        self.connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, user_id: str, ws: WebSocket):
        self.connections.setdefault(user_id, set()).add(ws)
        await run(lambda: sb.table("users")
            .update({"online": True, "last_seen": ts(now_utc())})
            .eq("user_id", user_id).execute())
        await self._broadcast_presence(user_id, True)

    async def disconnect(self, user_id: str, ws: WebSocket):
        conns = self.connections.get(user_id)
        if conns:
            conns.discard(ws)
        if not conns:
            self.connections.pop(user_id, None)
            await run(lambda: sb.table("users")
                .update({"online": False, "last_seen": ts(now_utc())})
                .eq("user_id", user_id).execute())
            await self._broadcast_presence(user_id, False)

    async def send(self, user_id: str, payload: dict):
        for ws in list(self.connections.get(user_id, set())):
            try:
                await ws.send_json(payload)
            except Exception:
                pass

    async def _broadcast_presence(self, user_id: str, online: bool):
        ur = await run(lambda: sb.table("users")
            .select("online_status")
            .eq("user_id", user_id)
            .limit(1).execute())
        online_status = (
            ur.data[0].get("online_status", "online")
            if ur.data
            else "online"
        )
        visible_online = online and online_status != "invisible"

        r = await run(lambda: sb.table("friendships").select("a,b")
            .or_(f"a.eq.{user_id},b.eq.{user_id}").execute())
        others = [f["a"] if f["b"] == user_id else f["b"] for f in r.data]
        payload = {
            "type": "presence",
            "user_id": user_id,
            "online": visible_online,
            "online_status": online_status if visible_online else "offline",
            "last_seen": ts(now_utc()),
        }
        for o in others:
            await self.send(o, payload)


hub = Hub()

# Pending voice-call offers for users who open the app from a push notification.
pending_voice_calls: Dict[str, dict] = {}


async def broadcast_to_user(user_id: str, payload: dict):
    await hub.send(user_id, jsonable(payload))


# ── Pydantic models ────────────────────────────────────────────────────────────
class SignUpIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    username: str = Field(min_length=3, max_length=24)
    display_name: str = Field(min_length=1, max_length=48)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class GoogleAuthIn(BaseModel):
    id_token: str


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    new_password: str = Field(min_length=6)


class VerifyEmailIn(BaseModel):
    token: str


class ChangePwdIn(BaseModel):
    old_password: str
    new_password: str = Field(min_length=6)


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None
    profile_picture: Optional[str] = None
    cover_picture: Optional[str] = None
    birthday: Optional[str] = None
    birthday_visibility: Optional[str] = None
    is_private: Optional[bool] = None
    online_status: Optional[str] = None
    status_text: Optional[str] = None
    status_expires_at: Optional[str] = None


class MessageIn(BaseModel):
    conversation_id: str
    content: str = ""
    kind: str = "text"        # text | image | video | voice | file | emoji
    media: Optional[str] = None
    file_name: Optional[str] = None
    reply_to: Optional[str] = None


class CircleCreateIn(BaseModel):
    name: str
    description: str = ""
    photo: Optional[str] = None
    privacy: str = "public"


class CircleUpdateIn(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    photo: Optional[str] = None
    privacy: Optional[str] = None


class CircleThemeIn(BaseModel):
    theme: str


class CircleMessageIn(BaseModel):
    circle_id: str
    content: str = ""
    kind: str = "text"
    media: Optional[str] = None
    reply_to: Optional[str] = None


class CircleInviteIn(BaseModel):
    user_id: str



class MessageEdit(BaseModel):
    content: str


class ReactionIn(BaseModel):
    emoji: str


class DeleteAccountIn(BaseModel):
    password: Optional[str] = None


class StoryIn(BaseModel):
    kind: str = "image"       # image | video
    media: str
    caption: Optional[str] = ""
    is_private: bool = False
    text_x: float = 0.08
    text_y: float = 0.38
    text_color: str = "#FFFFFF"
    text_size: int = 28
    font_index: int = 0
    media_scale: float = 1.0
    media_x: float = 0.0
    media_y: float = 0.0


class FriendActionIn(BaseModel):
    user_id: str


# ── Notification helper ────────────────────────────────────────────────────────
async def _push_notification(to_user: str, kind: str, data: dict):
    notif = {
        "notif_id": make_id("ntf"),
        "user_id": to_user,
        "kind": kind,
        "data": data,
        "read": False,
        "created_at": ts(now_utc()),
    }
    await run(lambda: sb.table("notifications").insert(notif).execute())
    await broadcast_to_user(to_user, {"type": "notification", "notification": notif})
    try:
        await _send_expo_push(to_user, kind, data)
    except Exception as e:
        logger.warning("Expo push failed: %s", e)


# ── Auth ───────────────────────────────────────────────────────────────────────
@api.get("/auth/check-username")
async def check_username(username: str = Query(..., min_length=3, max_length=24)):
    clean_username = username.strip().lower()

    if not re.fullmatch(r"[a-z0-9._]+", clean_username):
        return {
            "available": False,
            "valid": False,
            "message": "Only letters, numbers, dots and underscores are allowed.",
        }

    r = await run(
        lambda: sb.table("users")
        .select("user_id")
        .eq("username", clean_username)
        .limit(1)
        .execute()
    )

    available = not bool(r.data)

    return {
        "available": available,
        "valid": True,
        "message": (
            "Username is available."
            if available
            else "This username is already taken."
        ),
    }


@api.post("/auth/signup")
async def signup(body: SignUpIn):
    email = body.email.lower()
    r1 = await run(lambda: sb.table("users").select("user_id").eq("email", email).execute())
    if r1.data:
        raise HTTPException(status_code=400, detail="Email already registered")
    r2 = await run(lambda: sb.table("users").select("user_id").eq("username", body.username.lower()).execute())
    if r2.data:
        raise HTTPException(status_code=400, detail="Username already taken")

    user_id = make_id("usr")
    doc = {
        "user_id": user_id,
        "email": email,
        "username": body.username.lower(),
        "display_name": body.display_name,
        "password_hash": hash_password(body.password),
        "bio": "",
        "profile_picture": "",
        "cover_picture": "",
        "is_private": False,
        "email_verified": True,
        "email_verify_token": None,
        "provider": "email",
        "online": False,
        "last_seen": ts(now_utc()),
        "created_at": ts(now_utc()),
    }
    await run(lambda: sb.table("users").insert(doc).execute())
    token = create_jwt(user_id)
    user = await get_user_public(user_id)

    try:
        welcome_name = body.display_name.strip() or body.username

        welcome_plain = f"""Welcome to XYTEEE Nexus, {welcome_name}!

Your account has been created successfully and is ready to use.

Discover your Nexus, connect with people, and make it yours.

If you did not create this account, please contact XYTEEE Nexus support.

— XYTEEE Nexus"""

        welcome_html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#F4F1EB;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F4F1EB;">
    <tr>
      <td align="center" style="padding:18px 10px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:500px;background:#FFFFFF;border:1px solid #E4DED3;border-radius:20px;overflow:hidden;">
          <tr>
            <td style="padding:24px 24px 12px;text-align:center;">
              <div style="font-family:Georgia,serif;font-size:25px;font-weight:bold;color:#171513;letter-spacing:2px;">
                XYTEEE
              </div>
              <div style="margin-top:3px;font-size:9px;font-weight:bold;color:#B47B42;letter-spacing:5px;">
                NEXUS
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:12px 24px 24px;text-align:center;">
              <div style="display:inline-block;padding:7px 12px;background:#F7F1E8;border-radius:999px;font-size:10px;font-weight:bold;color:#A46E38;letter-spacing:1px;">
                ACCOUNT READY
              </div>

              <h1 style="margin:14px 0 0;font-family:Georgia,serif;font-size:28px;line-height:1.15;color:#171513;">
                Welcome, {welcome_name}
              </h1>

              <p style="margin:10px 0 0;font-size:13px;line-height:20px;color:#716B63;">
                Your XYTEEE Nexus account has been created successfully. Your space is ready.
              </p>

              <div style="margin:18px 0;padding:16px;background:#FAF8F4;border:1px solid #E9E3D9;border-radius:14px;">
                <div style="font-size:13px;font-weight:bold;color:#292521;">
                  Your Nexus starts here
                </div>
                <div style="margin-top:6px;font-size:11px;line-height:17px;color:#7B746B;">
                  Discover people, build connections, share moments, and make your Nexus your own.
                </div>
              </div>

              <p style="margin:0;font-size:11px;line-height:17px;color:#938B81;">
                If you did not create this account, please contact XYTEEE Nexus support.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:14px 20px;background:#171513;text-align:center;">
              <div style="font-size:12px;font-weight:bold;color:#F4F1EB;">XYTEEE Nexus</div>
              <div style="margin-top:3px;font-size:9px;color:#A9A198;">Your Nexus. Your space.</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

        await send_email(
            email,
            "Welcome to XYTEEE Nexus",
            welcome_plain,
            welcome_html,
        )
    except Exception:
        logger.exception("Failed to send signup welcome email")

    return {"token": token, "user": user}


@api.post("/auth/google")
async def google_auth(body: GoogleAuthIn):
    google_client_id = os.environ.get("GOOGLE_WEB_CLIENT_ID", "").strip()

    if not google_client_id:
        raise HTTPException(status_code=500, detail="Google Sign-In is not configured")

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": body.id_token},
        )

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google token")

    info = response.json()

    if info.get("aud") != google_client_id:
        raise HTTPException(status_code=401, detail="Invalid Google token audience")

    email = str(info.get("email") or "").strip().lower()
    email_verified = str(info.get("email_verified") or "").lower() == "true"
    display_name = str(info.get("name") or "").strip() or "Nexus User"
    profile_picture = str(info.get("picture") or "").strip()

    if not email or not email_verified:
        raise HTTPException(status_code=401, detail="Google email is not verified")

    existing_r = await run(
        lambda: sb.table("users").select("*").eq("email", email).execute()
    )

    if existing_r.data:
        existing = existing_r.data[0]
        user_id = existing["user_id"]

        await run(
            lambda: sb.table("users")
            .update({
                "email_verified": True,
                "online": True,
                "last_seen": ts(now_utc()),
            })
            .eq("user_id", user_id)
            .execute()
        )

        token = create_jwt(user_id)
        user = await get_user_public(user_id)
        return {"token": token, "user": user, "is_new_user": False}

    username_base = "".join(
        ch for ch in email.split("@")[0].lower()
        if ch.isalnum() or ch in "._"
    )[:20] or "nexus"

    username = username_base
    counter = 1

    while True:
        username_r = await run(
            lambda: sb.table("users")
            .select("user_id")
            .eq("username", username)
            .execute()
        )

        if not username_r.data:
            break

        suffix = str(counter)
        username = f"{username_base[:24 - len(suffix)]}{suffix}"
        counter += 1

    user_id = make_id("usr")
    doc = {
        "user_id": user_id,
        "email": email,
        "username": username,
        "display_name": display_name[:48],
        "password_hash": None,
        "bio": "",
        "profile_picture": profile_picture,
        "cover_picture": "",
        "is_private": False,
        "email_verified": True,
        "email_verify_token": None,
        "provider": "google",
        "online": True,
        "last_seen": ts(now_utc()),
        "created_at": ts(now_utc()),
    }

    await run(lambda: sb.table("users").insert(doc).execute())

    token = create_jwt(user_id)
    user = await get_user_public(user_id)

    return {"token": token, "user": user, "is_new_user": True}


@api.post("/auth/login")
async def login(body: LoginIn):
    email = body.email.lower()
    r = await run(lambda: sb.table("users").select("*").eq("email", email).execute())
    u = r.data[0] if r.data else None
    if not u or not u.get("password_hash") or not verify_password(body.password, u["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    moderation_status = (u.get("moderation_status") or "active").lower()

    if moderation_status == "suspended":
        appeals_result = await run(
            lambda: sb.table("appeals")
            .select("appeal_id,status,created_at")
            .eq("user_id", u["user_id"])
            .order("created_at", desc=False)
            .execute()
        )

        appeal_rows = appeals_result.data or []
        appeal_count = len(appeal_rows)
        pending_appeal = next(
            (a for a in appeal_rows if a.get("status") == "pending"),
            None,
        )
        appeals_remaining = max(0, 2 - appeal_count)

        if pending_appeal:
            appeal_status = "pending"
            appeal_allowed = False
        elif appeal_count >= 2:
            appeal_status = "limit_reached"
            appeal_allowed = False
        else:
            appeal_status = "eligible"
            appeal_allowed = True

        raise HTTPException(
            status_code=403,
            detail={
                "code": "ACCOUNT_SUSPENDED",
                "title": "Account Suspended",
                "message": "Your account has been suspended.",
                "reason": u.get("moderation_reason"),
                "reason_code": u.get("moderation_reason_code"),
                "user_id": u.get("user_id"),
                "name": u.get("display_name"),
                "email": u.get("email"),
                "appeal_allowed": appeal_allowed,
                "appeal_status": appeal_status,
                "appeal_count": appeal_count,
                "appeals_remaining": appeals_remaining,
                "review_time": "24–72 hours" if pending_appeal else None,
            },
        )

    if moderation_status == "banned":
        raise HTTPException(
            status_code=403,
            detail={
                "code": "ACCOUNT_BANNED",
                "title": "Account Permanently Disabled",
                "message": "Your account has been permanently disabled.",
                "reason": u.get("moderation_reason"),
                "reason_code": u.get("moderation_reason_code"),
                "user_id": u.get("user_id"),
                "appeal_allowed": False,
            },
        )

    await run(lambda: sb.table("users")
        .update({"online": True, "last_seen": ts(now_utc())})
        .eq("user_id", u["user_id"]).execute())
    token = create_jwt(u["user_id"])
    user = await get_user_public(u["user_id"])
    return {"token": token, "user": user}


class AppealSubmitIn(BaseModel):
    user_id: str
    message: str = Field(min_length=5, max_length=1000)


@api.post("/auth/appeal")
async def submit_appeal(body: AppealSubmitIn):
    message = body.message.strip()
    if len(message) < 5:
        raise HTTPException(
            status_code=400,
            detail="Please write a little more about your appeal",
        )

    r = await run(
        lambda: sb.table("users")
        .select(
            "user_id,email,display_name,moderation_status,"
            "moderation_reason"
        )
        .eq("user_id", body.user_id)
        .execute()
    )

    if not r.data:
        raise HTTPException(status_code=404, detail="Account not found")

    u = r.data[0]

    if (u.get("moderation_status") or "active") != "suspended":
        raise HTTPException(
            status_code=400,
            detail="This account is not eligible to submit an appeal",
        )

    appeals = await run(
        lambda: sb.table("appeals")
        .select("appeal_id,status,created_at")
        .eq("user_id", u["user_id"])
        .order("created_at", desc=False)
        .execute()
    )

    appeal_rows = appeals.data or []
    pending_appeal = next(
        (a for a in appeal_rows if a.get("status") == "pending"),
        None,
    )

    if pending_appeal:
        return {
            "ok": True,
            "already_submitted": True,
            "status": "pending",
            "appeal_count": len(appeal_rows),
            "appeals_remaining": max(0, 2 - len(appeal_rows)),
            "message": (
                "Your appeal is already under review. "
                "Reviews usually take 24–72 hours."
            ),
        }

    if len(appeal_rows) >= 2:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "APPEAL_LIMIT_REACHED",
                "title": "Appeal Limit Reached",
                "message": (
                    "You have used both available appeals. "
                    "No further appeals can be submitted."
                ),
                "appeal_count": len(appeal_rows),
                "appeals_remaining": 0,
            },
        )

    if appeal_rows and appeal_rows[-1].get("status") != "rejected":
        raise HTTPException(
            status_code=400,
            detail="A new appeal cannot be submitted at this time",
        )

    appeal_id = make_id("apl")
    created_at = ts(now_utc())

    await run(
        lambda: sb.table("appeals").insert({
            "appeal_id": appeal_id,
            "user_id": u["user_id"],
            "name": u.get("display_name") or "",
            "email": u.get("email") or "",
            "message": message,
            "suspension_reason": u.get("moderation_reason"),
            "status": "pending",
            "created_at": created_at,
        }).execute()
    )

    return {
        "ok": True,
        "already_submitted": False,
        "appeal_id": appeal_id,
        "status": "pending",
        "message": (
            "Thank you. We have received your appeal and your account "
            "will be reviewed. Reviews usually take 24–72 hours."
        ),
    }


@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return user


@api.post("/auth/logout")
async def logout(user=Depends(current_user)):
    await run(lambda: sb.table("users")
        .update({"online": False, "last_seen": ts(now_utc())})
        .eq("user_id", user["user_id"]).execute())
    return {"ok": True}


@api.post("/auth/verify-email")
async def verify_email(body: VerifyEmailIn):
    r = await run(lambda: sb.table("users").select("user_id").eq("email_verify_token", body.token).execute())
    if not r.data:
        raise HTTPException(status_code=400, detail="Invalid token")
    uid = r.data[0]["user_id"]
    await run(lambda: sb.table("users")
        .update({"email_verified": True, "email_verify_token": None})
        .eq("user_id", uid).execute())
    return {"ok": True}


@api.post("/auth/forgot-password")
async def forgot_password(body: ForgotIn):
    email = body.email.lower()
    r = await run(lambda: sb.table("users").select("user_id").eq("email", email).execute())
    if not r.data:
        return {"ok": True}  # don't reveal existence
    uid = r.data[0]["user_id"]
    tok = f"{int.from_bytes(os.urandom(4), 'big') % 1000000:06d}"
    expiry = ts(now_utc() + timedelta(minutes=15))

    await run(lambda: sb.table("users")
        .update({"password_reset_token": tok, "password_reset_expiry": expiry})
        .eq("user_id", uid).execute())

    try:
        plain_body = f"""Your XYTEEE Nexus password reset code is:

{tok}

This code expires in 15 minutes.

If you did not request a password reset, you can ignore this email.

— XYTEEE Nexus"""

        html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#08080A;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#08080A;">
    <tr>
      <td align="center" style="padding:14px 10px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:500px;background:#121216;border:1px solid #29272F;border-radius:20px;overflow:hidden;">
          <tr>
            <td style="padding:22px 24px 10px;text-align:center;">
              <div style="font-family:Georgia,serif;font-size:25px;font-weight:bold;color:#F1EFE7;letter-spacing:2px;">
                XYTEEE
              </div>
              <div style="margin-top:3px;font-size:9px;font-weight:bold;color:#D9AE78;letter-spacing:5px;">
                NEXUS
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:10px 24px 22px;">
              <h1 style="margin:0;text-align:center;font-family:Georgia,serif;font-size:27px;line-height:1.15;color:#F1EFE7;">
                Reset access
              </h1>

              <p style="margin:8px 0 0;text-align:center;font-size:13px;line-height:19px;color:#98959F;">
                Use this verification code to choose a new password for your Nexus account.
              </p>

              <div style="margin:18px 0;padding:16px 10px;background:#0B0B0E;border:1px solid #35313A;border-radius:14px;text-align:center;">
                <div style="font-size:9px;font-weight:bold;color:#98959F;letter-spacing:3px;">
                  RESET CODE
                </div>
                <div style="margin-top:8px;font-size:32px;font-weight:bold;color:#D9AE78;letter-spacing:6px;">
                  {tok}
                </div>
              </div>

              <p style="margin:0;text-align:center;font-size:13px;line-height:19px;color:#F1EFE7;">
                This code expires in <strong style="color:#D9AE78;">15 minutes</strong>.
              </p>

              <div style="margin-top:18px;padding-top:16px;border-top:1px solid #29272F;">
                <p style="margin:0;text-align:center;font-size:11px;line-height:17px;color:#77747E;">
                  If you did not request a password reset, you can safely ignore this email. Never share this code with anyone.
                </p>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:14px 20px;background:#0D0D10;text-align:center;border-top:1px solid #29272F;">
              <div style="font-size:12px;font-weight:bold;color:#F1EFE7;">XYTEEE Nexus</div>
              <div style="margin-top:3px;font-size:9px;color:#6F6C75;">Your Nexus is right where you left it.</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

        await send_email(
            email,
            "Your XYTEEE Nexus password reset code",
            plain_body,
            html_body,
        )
    except Exception:
        logger.exception("Failed to send password reset email")
        await run(lambda: sb.table("users")
            .update({"password_reset_token": None, "password_reset_expiry": None})
            .eq("user_id", uid).execute())
        raise HTTPException(
            status_code=503,
            detail="Could not send the verification code. Please try again."
        )

    return {"ok": True}


@api.post("/auth/reset-password")
async def reset_password(body: ResetIn):
    r = await run(lambda: sb.table("users").select("*").eq("password_reset_token", body.token).execute())
    if not r.data:
        raise HTTPException(status_code=400, detail="Invalid token")
    u = r.data[0]
    exp = parse_ts(u.get("password_reset_expiry"))
    if exp and exp < now_utc():
        raise HTTPException(status_code=400, detail="Token expired")
    await run(lambda: sb.table("users")
        .update({"password_hash": hash_password(body.new_password),
                 "password_reset_token": None, "password_reset_expiry": None})
        .eq("user_id", u["user_id"]).execute())
    return {"ok": True}


@api.post("/auth/change-password")
async def change_password(body: ChangePwdIn, user=Depends(current_user)):
    r = await run(lambda: sb.table("users").select("*").eq("user_id", user["user_id"]).execute())
    u = r.data[0] if r.data else None
    if not u or not verify_password(body.old_password, u.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Invalid current password")
    await run(lambda: sb.table("users")
        .update({"password_hash": hash_password(body.new_password)})
        .eq("user_id", user["user_id"]).execute())
    return {"ok": True}


# ── Users ──────────────────────────────────────────────────────────────────────
@api.get("/users/search")
async def search_users(q: str = Query(""), user=Depends(current_user)):
    if not q:
        return {"users": []}
    r = await run(lambda: sb.table("users").select("*")
        .or_(f"username.ilike.%{q}%,display_name.ilike.%{q}%")
        .neq("user_id", user["user_id"])
        .limit(20).execute())
    users = []
    for u in (r.data or []):
        if not await users_blocked(user["user_id"], u["user_id"]):
            users.append(public_user(u))
    return {"users": users}


@api.get("/users/recent")
async def recent_users(user=Depends(current_user)):
    cutoff = ts(now_utc() - timedelta(days=15))

    fr = await run(lambda: sb.table("friendships").select("a,b")
        .or_(f"a.eq.{user['user_id']},b.eq.{user['user_id']}").execute())
    excluded = {
        f["a"] if f["b"] == user["user_id"] else f["b"]
        for f in (fr.data or [])
    }

    rq = await run(lambda: sb.table("friend_requests").select("from_user,to_user")
        .eq("status", "pending")
        .or_(f"from_user.eq.{user['user_id']},to_user.eq.{user['user_id']}").execute())
    for x in (rq.data or []):
        excluded.add(
            x["to_user"] if x["from_user"] == user["user_id"] else x["from_user"]
        )

    r = await run(lambda: sb.table("users").select("*")
        .gte("created_at", cutoff)
        .neq("user_id", user["user_id"])
        .order("created_at", desc=True).execute())

    seen = set()
    users = []
    for u in (r.data or []):
        uid = u.get("user_id")
        if (
            uid
            and uid not in seen
            and uid not in excluded
            and not await users_blocked(user["user_id"], uid)
        ):
            seen.add(uid)
            users.append(public_user(u))

    return {"users": users}


@api.get("/users/discover-more")
async def discover_more_users(user=Depends(current_user)):
    cutoff = ts(now_utc() - timedelta(days=15))

    fr = await run(lambda: sb.table("friendships").select("a,b")
        .or_(f"a.eq.{user['user_id']},b.eq.{user['user_id']}").execute())
    excluded = {
        f["a"] if f["b"] == user["user_id"] else f["b"]
        for f in (fr.data or [])
    }

    rq = await run(lambda: sb.table("friend_requests").select("from_user,to_user")
        .eq("status", "pending")
        .or_(f"from_user.eq.{user['user_id']},to_user.eq.{user['user_id']}").execute())
    for x in (rq.data or []):
        excluded.add(
            x["to_user"] if x["from_user"] == user["user_id"] else x["from_user"]
        )

    r = await run(lambda: sb.table("users").select("*")
        .lt("created_at", cutoff)
        .neq("user_id", user["user_id"])
        .order("created_at", desc=True).execute())

    seen = set()
    users = []
    for u in (r.data or []):
        uid = u.get("user_id")
        if (
            uid
            and uid not in seen
            and uid not in excluded
            and not await users_blocked(user["user_id"], uid)
        ):
            seen.add(uid)
            users.append(public_user(u))

    return {"users": users}


@api.get("/users/{user_id}")
async def get_user(user_id: str, user=Depends(current_user)):
    if user_id != user["user_id"]:
        await ensure_not_blocked(user["user_id"], user_id)

    u = await get_user_public(user_id)
    if not u:
        raise HTTPException(status_code=404, detail="Not found")

    # Real private-account access:
    # owner and accepted bonds can see private content
    private_locked = False
    if user_id != user["user_id"] and u.get("is_private"):
        pa, pb = sorted([user["user_id"], user_id])
        private_friend = await run(lambda: sb.table("friendships")
            .select("friendship_id")
            .eq("a", pa).eq("b", pb)
            .limit(1).execute())
        private_locked = not bool(private_friend.data)

    u["private_locked"] = private_locked

    # friend + story counts
    a_s, b_s = sorted([user_id, user_id])  # placeholder, real query below
    fc = await run(lambda: sb.table("friendships").select("friendship_id", count="exact")
        .or_(f"a.eq.{user_id},b.eq.{user_id}").execute())
    sc = await run(lambda: sb.table("stories").select("story_id", count="exact")
        .eq("user_id", user_id).gt("expires_at", ts(now_utc())).execute())
    u["friend_count"] = fc.count or 0
    u["story_count"] = 0 if private_locked else (sc.count or 0)

    # mutual bonds between current user and profile user
    my_fr = await run(lambda: sb.table("friendships").select("a,b")
        .or_(f"a.eq.{user['user_id']},b.eq.{user['user_id']}").execute())
    their_fr = await run(lambda: sb.table("friendships").select("a,b")
        .or_(f"a.eq.{user_id},b.eq.{user_id}").execute())

    my_bonds = {
        f["a"] if f["b"] == user["user_id"] else f["b"]
        for f in (my_fr.data or [])
    }
    their_bonds = {
        f["a"] if f["b"] == user_id else f["b"]
        for f in (their_fr.data or [])
    }

    mutual_ids = list(my_bonds & their_bonds)
    mutual_users = []

    if mutual_ids:
        mur = await run(lambda: sb.table("users").select("*")
            .in_("user_id", mutual_ids).execute())
        mutual_users = [public_user(x) for x in (mur.data or [])]

    u["mutual_bonds_count"] = len(mutual_ids)
    u["mutual_bonds_preview"] = mutual_users[:3]

    # relation to the caller
    if user_id != user["user_id"]:
        fa, fb = sorted([user["user_id"], user_id])
        fr = await run(lambda: sb.table("friendships").select("friendship_id")
            .eq("a", fa).eq("b", fb).execute())
        rel = "friend" if fr.data else "none"
        if not fr.data:
            rq = await run(lambda: sb.table("friend_requests").select("request_id")
                .eq("from_user", user["user_id"]).eq("to_user", user_id).eq("status", "pending").execute())
            if rq.data:
                rel = "requested"
            else:
                rq2 = await run(lambda: sb.table("friend_requests").select("request_id")
                    .eq("from_user", user_id).eq("to_user", user["user_id"]).eq("status", "pending").execute())
                if rq2.data:
                    rel = "incoming"
        bl = await run(lambda: sb.table("blocks").select("blocker")
            .eq("blocker", user["user_id"]).eq("blocked", user_id).execute())
        if bl.data:
            rel = "blocked"
        u["relation"] = rel

        birthday_visibility = u.get("birthday_visibility") or "private"
        if birthday_visibility == "private":
            u["birthday"] = None
        elif birthday_visibility == "bonds" and rel != "friend":
            u["birthday"] = None

    return u


@api.put("/users/me")
async def update_me(body: ProfileUpdate, user=Depends(current_user)):
    upd = {k: v for k, v in body.dict().items() if v is not None}

    if "birthday" in upd:
        try:
            birthday_value = datetime.strptime(upd["birthday"], "%Y-%m-%d").date()
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=400,
                detail="Invalid birthday date",
            )

        if birthday_value > now_utc().date():
            raise HTTPException(
                status_code=400,
                detail="Birthday cannot be in the future",
            )

    if "birthday_visibility" in upd:
        valid_birthday_visibilities = {"private", "public", "bonds"}
        if upd["birthday_visibility"] not in valid_birthday_visibilities:
            raise HTTPException(
                status_code=400,
                detail="Invalid birthday visibility",
            )

    if "online_status" in upd:
        valid_online_statuses = {"online", "idle", "dnd", "invisible"}
        if upd["online_status"] not in valid_online_statuses:
            raise HTTPException(
                status_code=400,
                detail="Invalid online status",
            )

    if "status_text" in body.__fields_set__:
        status = (body.status_text or "").strip()

        if len(status) > 128:
            raise HTTPException(
                status_code=400,
                detail="Status must be 128 characters or less",
            )

        if status:
            upd["status_text"] = status
            upd["status_expires_at"] = body.status_expires_at
        else:
            upd["status_text"] = None
            upd["status_expires_at"] = None

    if upd:
        await run(lambda: sb.table("users").update(upd).eq("user_id", user["user_id"]).execute())

    if "online_status" in upd:
        is_connected = bool(hub.connections.get(user["user_id"]))
        await hub._broadcast_presence(
            user["user_id"],
            is_connected,
        )

    return await get_user_public(user["user_id"])


# ── Block protection ───────────────────────────────────────────────────────────
async def users_blocked(a: str, b: str) -> bool:
    r = await run(lambda: sb.table("blocks").select("blocker")
        .or_(
            f"and(blocker.eq.{a},blocked.eq.{b}),"
            f"and(blocker.eq.{b},blocked.eq.{a})"
        ).limit(1).execute())
    return bool(r.data)


async def blocked_user_ids(user_id: str) -> Set[str]:
    r = await run(
        lambda: sb.table("blocks")
        .select("blocker,blocked")
        .or_(f"blocker.eq.{user_id},blocked.eq.{user_id}")
        .execute()
    )
    blocked_ids: Set[str] = set()

    for row in (r.data or []):
        blocker = row.get("blocker")
        blocked = row.get("blocked")

        if blocker == user_id and blocked:
            blocked_ids.add(blocked)
        elif blocked == user_id and blocker:
            blocked_ids.add(blocker)

    return blocked_ids


async def ensure_private_access(viewer_id: str, owner_id: str):
    if viewer_id == owner_id:
        return

    ur = await run(lambda: sb.table("users")
        .select("is_private")
        .eq("user_id", owner_id)
        .limit(1).execute())

    if not ur.data or not ur.data[0].get("is_private"):
        return

    fa, fb = sorted([viewer_id, owner_id])
    fr = await run(lambda: sb.table("friendships")
        .select("friendship_id")
        .eq("a", fa).eq("b", fb)
        .limit(1).execute())

    if not fr.data:
        raise HTTPException(status_code=404, detail="Not found")


async def ensure_not_blocked(a: str, b: str):
    if await users_blocked(a, b):
        raise HTTPException(status_code=404, detail="User not found")


# ── Friends ────────────────────────────────────────────────────────────────────
@api.post("/friends/request")
async def friend_request(body: FriendActionIn, user=Depends(current_user)):
    target = body.user_id
    if target == user["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot friend self")

    await ensure_not_blocked(user["user_id"], target)

    exists = await run(lambda: sb.table("users").select("user_id").eq("user_id", target).execute())
    if not exists.data:
        raise HTTPException(status_code=404, detail="Not found")

    fa, fb = sorted([user["user_id"], target])
    already = await run(lambda: sb.table("friendships").select("friendship_id").eq("a", fa).eq("b", fb).execute())
    if already.data:
        raise HTTPException(status_code=400, detail="Already friends")

    exist_req = await run(lambda: sb.table("friend_requests").select("request_id")
        .eq("from_user", user["user_id"]).eq("to_user", target).eq("status", "pending").execute())
    if exist_req.data:
        raise HTTPException(status_code=400, detail="Already requested")

    reverse = await run(lambda: sb.table("friend_requests").select("request_id")
        .eq("from_user", target).eq("to_user", user["user_id"]).eq("status", "pending").execute())
    if reverse.data:
        return await friend_accept(FriendActionIn(user_id=target), user)

    req_id = make_id("frq")
    await run(lambda: sb.table("friend_requests").insert({
        "request_id": req_id,
        "from_user": user["user_id"],
        "to_user": target,
        "status": "pending",
        "created_at": ts(now_utc()),
    }).execute())
    await _push_notification(target, "friend_request", {
        "from": user["user_id"], "from_name": user["display_name"], "request_id": req_id,
    })
    return {"ok": True, "request_id": req_id}


@api.post("/friends/accept")
async def friend_accept(body: FriendActionIn, user=Depends(current_user)):
    await ensure_not_blocked(user["user_id"], body.user_id)

    r = await run(lambda: sb.table("friend_requests").select("*")
        .eq("from_user", body.user_id).eq("to_user", user["user_id"]).eq("status", "pending").execute())
    if not r.data:
        raise HTTPException(status_code=404, detail="No request")
    req = r.data[0]
    await run(lambda: sb.table("friend_requests")
        .update({"status": "accepted", "resolved_at": ts(now_utc())})
        .eq("request_id", req["request_id"]).execute())
    fa, fb = sorted([user["user_id"], body.user_id])
    await run(lambda: sb.table("friendships").insert({
        "friendship_id": make_id("frn"), "a": fa, "b": fb, "created_at": ts(now_utc()),
    }).execute())
    await _push_notification(body.user_id, "friend_accepted", {
        "from": user["user_id"], "from_name": user["display_name"],
    })
    return {"ok": True}


@api.post("/friends/reject")
async def friend_reject(body: FriendActionIn, user=Depends(current_user)):
    await run(lambda: sb.table("friend_requests")
        .update({"status": "rejected", "resolved_at": ts(now_utc())})
        .eq("from_user", body.user_id).eq("to_user", user["user_id"]).eq("status", "pending").execute())
    return {"ok": True}


@api.post("/friends/cancel")
async def friend_cancel(body: FriendActionIn, user=Depends(current_user)):
    await run(lambda: sb.table("friend_requests").delete()
        .eq("from_user", user["user_id"]).eq("to_user", body.user_id).eq("status", "pending").execute())
    return {"ok": True}


@api.post("/friends/unfriend")
async def unfriend(body: FriendActionIn, user=Depends(current_user)):
    fa, fb = sorted([user["user_id"], body.user_id])
    await run(lambda: sb.table("friendships").delete().eq("a", fa).eq("b", fb).execute())
    return {"ok": True}


@api.post("/friends/block")
async def block_user(body: FriendActionIn, user=Depends(current_user)):
    if body.user_id == user["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot block self")
    fa, fb = sorted([user["user_id"], body.user_id])
    await run(lambda: sb.table("friendships").delete().eq("a", fa).eq("b", fb).execute())
    await run(lambda: sb.table("friend_requests").delete()
        .or_(f"and(from_user.eq.{user['user_id']},to_user.eq.{body.user_id}),"
             f"and(from_user.eq.{body.user_id},to_user.eq.{user['user_id']})").execute())
    await run(lambda: sb.table("blocks").upsert({
        "blocker": user["user_id"], "blocked": body.user_id, "created_at": ts(now_utc()),
    }).execute())
    return {"ok": True}


@api.post("/friends/unblock")
async def unblock_user(body: FriendActionIn, user=Depends(current_user)):
    await run(lambda: sb.table("blocks").delete()
        .eq("blocker", user["user_id"]).eq("blocked", body.user_id).execute())
    return {"ok": True}


@api.get("/friends")
async def friends_list(user=Depends(current_user)):
    r = await run(lambda: sb.table("friendships").select("a,b")
        .or_(f"a.eq.{user['user_id']},b.eq.{user['user_id']}").execute())
    ids = [f["a"] if f["b"] == user["user_id"] else f["b"] for f in r.data]
    if not ids:
        return {"friends": []}
    ur = await run(lambda: sb.table("users").select("*").in_("user_id", ids).execute())
    return {"friends": [public_user(u) for u in ur.data]}


@api.get("/friends/requests")
async def friend_requests_list(user=Depends(current_user)):
    inc_r = await run(lambda: sb.table("friend_requests").select("*")
        .eq("to_user", user["user_id"]).eq("status", "pending").execute())
    out_r = await run(lambda: sb.table("friend_requests").select("*")
        .eq("from_user", user["user_id"]).eq("status", "pending").execute())

    async def hydrate(reqs: list, id_field: str) -> list:
        ids = [r[id_field] for r in reqs]
        if not ids:
            return reqs
        ur = await run(lambda: sb.table("users").select("*").in_("user_id", ids).execute())
        umap = {u["user_id"]: public_user(u) for u in ur.data}
        for r in reqs:
            r["user"] = umap.get(r[id_field])
        return reqs

    incoming = await hydrate(inc_r.data, "from_user")
    outgoing = await hydrate(out_r.data, "to_user")
    return {"incoming": incoming, "outgoing": outgoing}


@api.get("/friends/mutual/{other_id}")
async def mutual(other_id: str, user=Depends(current_user)):
    my_r = await run(lambda: sb.table("friendships").select("a,b")
        .or_(f"a.eq.{user['user_id']},b.eq.{user['user_id']}").execute())
    my_ids = {f["a"] if f["b"] == user["user_id"] else f["b"] for f in my_r.data}
    ot_r = await run(lambda: sb.table("friendships").select("a,b")
        .or_(f"a.eq.{other_id},b.eq.{other_id}").execute())
    ot_ids = {f["a"] if f["b"] == other_id else f["b"] for f in ot_r.data}
    mutual_ids = list(my_ids & ot_ids)
    if not mutual_ids:
        return {"mutual": []}
    ur = await run(lambda: sb.table("users").select("*").in_("user_id", mutual_ids).execute())
    return {"mutual": [public_user(u) for u in ur.data]}


@api.get("/blocks")
async def blocks_list(user=Depends(current_user)):
    r = await run(lambda: sb.table("blocks").select("blocked").eq("blocker", user["user_id"]).execute())
    ids = [d["blocked"] for d in r.data]
    if not ids:
        return {"blocked": []}
    ur = await run(lambda: sb.table("users").select("*").in_("user_id", ids).execute())
    return {"blocked": [public_user(u) for u in ur.data]}



# ── Circles ────────────────────────────────────────────────────────────────────
@api.post("/circles")
async def create_circle(body: CircleCreateIn, user=Depends(current_user)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Circle name is required")

    if len(name) > 80:
        raise HTTPException(status_code=400, detail="Circle name is too long")

    privacy = body.privacy.strip().lower()
    if privacy not in ("public", "private"):
        raise HTTPException(status_code=400, detail="Invalid Circle privacy")

    circle_id = make_id("circle")
    now = ts(now_utc())

    circle = {
        "circle_id": circle_id,
        "name": name,
        "description": body.description.strip(),
        "photo": body.photo,
        "owner_id": user["user_id"],
        "privacy": privacy,
        "created_at": now,
        "updated_at": now,
    }

    await run(lambda: sb.table("circles").insert(circle).execute())

    await run(
        lambda: sb.table("circle_members").insert({
            "circle_id": circle_id,
            "user_id": user["user_id"],
            "role": "owner",
            "joined_at": now,
        }).execute()
    )

    circle["my_role"] = "owner"
    circle["member_count"] = 1
    return {"circle": circle}


@api.get("/circles")
async def list_my_circles(user=Depends(current_user)):
    mr = await run(
        lambda: sb.table("circle_members")
        .select("circle_id,role,joined_at")
        .eq("user_id", user["user_id"])
        .execute()
    )

    memberships = mr.data or []
    if not memberships:
        return {"circles": []}

    circle_ids = [m["circle_id"] for m in memberships]

    cr = await run(
        lambda: sb.table("circles")
        .select("*")
        .in_("circle_id", circle_ids)
        .order("updated_at", desc=True)
        .execute()
    )

    role_map = {m["circle_id"]: m["role"] for m in memberships}
    out = []

    for circle in (cr.data or []):
        count_r = await run(
            lambda cid=circle["circle_id"]: sb.table("circle_members")
            .select("user_id", count="exact")
            .eq("circle_id", cid)
            .execute()
        )

        circle["my_role"] = role_map.get(circle["circle_id"], "member")
        circle["member_count"] = count_r.count or 0
        out.append(circle)

    return {"circles": out}


@api.get("/circles/{circle_id}")
async def get_circle(circle_id: str, user=Depends(current_user)):
    mr = await run(
        lambda: sb.table("circle_members")
        .select("role")
        .eq("circle_id", circle_id)
        .eq("user_id", user["user_id"])
        .execute()
    )

    if not mr.data:
        raise HTTPException(status_code=403, detail="You are not a member of this Circle")

    cr = await run(
        lambda: sb.table("circles")
        .select("*")
        .eq("circle_id", circle_id)
        .execute()
    )

    if not cr.data:
        raise HTTPException(status_code=404, detail="Circle not found")

    count_r = await run(
        lambda: sb.table("circle_members")
        .select("user_id", count="exact")
        .eq("circle_id", circle_id)
        .execute()
    )

    circle = cr.data[0]
    circle["my_role"] = mr.data[0]["role"]
    circle["member_count"] = count_r.count or 0

    return {"circle": circle}



@api.put("/circles/{circle_id}")
async def update_circle(
    circle_id: str,
    body: CircleUpdateIn,
    user=Depends(current_user),
):
    member_r = await run(
        lambda: sb.table("circle_members")
        .select("role")
        .eq("circle_id", circle_id)
        .eq("user_id", user["user_id"])
        .execute()
    )

    if not member_r.data:
        raise HTTPException(status_code=403, detail="You are not a member of this Circle")

    if member_r.data[0]["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can edit this Circle")

    updates = {}

    if body.name is not None:
        name = body.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Circle name is required")
        if len(name) > 80:
            raise HTTPException(status_code=400, detail="Circle name is too long")
        updates["name"] = name

    if body.description is not None:
        updates["description"] = body.description.strip()

    if body.photo is not None:
        updates["photo"] = body.photo

    if body.privacy is not None:
        privacy = body.privacy.strip().lower()
        if privacy not in ("public", "private"):
            raise HTTPException(status_code=400, detail="Invalid Circle privacy")
        updates["privacy"] = privacy

    if not updates:
        raise HTTPException(status_code=400, detail="No changes provided")

    updates["updated_at"] = ts(now_utc())

    updated_r = await run(
        lambda: sb.table("circles")
        .update(updates)
        .eq("circle_id", circle_id)
        .execute()
    )

    if not updated_r.data:
        raise HTTPException(status_code=404, detail="Circle not found")

    circle = updated_r.data[0]
    circle["my_role"] = member_r.data[0]["role"]

    count_r = await run(
        lambda: sb.table("circle_members")
        .select("user_id", count="exact")
        .eq("circle_id", circle_id)
        .execute()
    )
    circle["member_count"] = count_r.count or 0

    return {"circle": circle}


@api.put("/circles/{circle_id}/theme")
async def update_circle_theme(
    circle_id: str,
    body: CircleThemeIn,
    user=Depends(current_user),
):
    allowed_themes = {
        "default",
        "classic",
        "midnight",
        "ocean",
        "sunset",
        "forest",
        "aurora",
        "rose",
        "violet",
        "gold",
        "cyber",
        "sky",
        "ember",
        "mint",
        "sakura",
        "monochrome",
    }

    theme = body.theme.strip().lower()

    if theme not in allowed_themes:
        raise HTTPException(status_code=400, detail="Invalid Circle theme")

    member_r = await run(
        lambda: sb.table("circle_members")
        .select("role")
        .eq("circle_id", circle_id)
        .eq("user_id", user["user_id"])
        .execute()
    )

    if not member_r.data:
        raise HTTPException(
            status_code=403,
            detail="You are not a member of this Circle",
        )

    updated_r = await run(
        lambda: sb.table("circles")
        .update({
            "theme": theme,
            "updated_at": ts(now_utc()),
        })
        .eq("circle_id", circle_id)
        .execute()
    )

    if not updated_r.data:
        raise HTTPException(status_code=404, detail="Circle not found")

    members_r = await run(
        lambda: sb.table("circle_members")
        .select("user_id")
        .eq("circle_id", circle_id)
        .execute()
    )

    for member in (members_r.data or []):
        await broadcast_to_user(
            member["user_id"],
            {
                "type": "circle_theme_update",
                "circle_id": circle_id,
                "theme": theme,
                "changed_by": user["user_id"],
            },
        )

    return {"theme": theme}


@api.get("/circles/{circle_id}/members")
async def list_circle_members(circle_id: str, user=Depends(current_user)):
    my_r = await run(
        lambda: sb.table("circle_members")
        .select("role")
        .eq("circle_id", circle_id)
        .eq("user_id", user["user_id"])
        .execute()
    )

    if not my_r.data:
        raise HTTPException(status_code=403, detail="You are not a member of this Circle")

    members_r = await run(
        lambda: sb.table("circle_members")
        .select("user_id,role,joined_at")
        .eq("circle_id", circle_id)
        .order("joined_at")
        .execute()
    )

    memberships = members_r.data or []
    user_ids = [member["user_id"] for member in memberships]

    users_map = {}
    if user_ids:
        users_r = await run(
            lambda: sb.table("users")
            .select("*")
            .in_("user_id", user_ids)
            .execute()
        )
        users_map = {
            u["user_id"]: public_user(u)
            for u in (users_r.data or [])
        }

    members = []
    for membership in memberships:
        member = dict(membership)
        member["user"] = users_map.get(membership["user_id"])
        members.append(member)

    role_order = {"owner": 0, "admin": 1, "member": 2}
    members.sort(key=lambda item: role_order.get(item["role"], 3))

    return {
        "members": members,
        "my_role": my_r.data[0]["role"],
    }


@api.post("/circles/{circle_id}/invite")
async def invite_circle_member(
    circle_id: str,
    body: CircleInviteIn,
    user=Depends(current_user),
):
    inviter_r = await run(
        lambda: sb.table("circle_members")
        .select("role")
        .eq("circle_id", circle_id)
        .eq("user_id", user["user_id"])
        .execute()
    )

    if not inviter_r.data:
        raise HTTPException(
            status_code=403,
            detail="You are not a member of this Circle"
        )

    if body.user_id == user["user_id"]:
        raise HTTPException(status_code=400, detail="You cannot invite yourself")

    target_r = await run(
        lambda: sb.table("users")
        .select("*")
        .eq("user_id", body.user_id)
        .execute()
    )

    if not target_r.data:
        raise HTTPException(status_code=404, detail="User not found")

    existing_r = await run(
        lambda: sb.table("circle_members")
        .select("user_id")
        .eq("circle_id", circle_id)
        .eq("user_id", body.user_id)
        .execute()
    )

    if existing_r.data:
        return {
            "invited": False,
            "already_member": True,
        }

    pending_r = await run(
        lambda: sb.table("notifications")
        .select("notif_id")
        .eq("user_id", body.user_id)
        .eq("kind", "circle_invite")
        .contains("data", {"circle_id": circle_id})
        .limit(1)
        .execute()
    )

    if pending_r.data:
        return {
            "invited": False,
            "already_pending": True,
        }

    circle_r = await run(
        lambda: sb.table("circles")
        .select("name,photo")
        .eq("circle_id", circle_id)
        .execute()
    )
    circle_data = circle_r.data[0] if circle_r.data else {}

    await _push_notification(
        body.user_id,
        "circle_invite",
        {
            "from": user["user_id"],
            "from_name": user.get("display_name", ""),
            "circle_id": circle_id,
            "circle_name": circle_data.get("name", "Circle"),
            "circle_photo": circle_data.get("photo"),
        },
    )

    return {
        "invited": True,
        "already_member": False,
        "already_pending": False,
    }


@api.post("/circles/invites/{notif_id}/accept")
async def accept_circle_invite(
    notif_id: str,
    user=Depends(current_user),
):
    notif_r = await run(
        lambda: sb.table("notifications")
        .select("*")
        .eq("notif_id", notif_id)
        .eq("user_id", user["user_id"])
        .eq("kind", "circle_invite")
        .execute()
    )

    if not notif_r.data:
        raise HTTPException(status_code=404, detail="Circle invitation not found")

    notif = notif_r.data[0]
    circle_id = (notif.get("data") or {}).get("circle_id")

    if not circle_id:
        raise HTTPException(status_code=400, detail="Invalid Circle invitation")

    circle_r = await run(
        lambda: sb.table("circles")
        .select("circle_id")
        .eq("circle_id", circle_id)
        .execute()
    )

    if not circle_r.data:
        raise HTTPException(status_code=404, detail="Circle not found")

    existing_r = await run(
        lambda: sb.table("circle_members")
        .select("user_id")
        .eq("circle_id", circle_id)
        .eq("user_id", user["user_id"])
        .execute()
    )

    if not existing_r.data:
        await run(
            lambda: sb.table("circle_members").insert({
                "circle_id": circle_id,
                "user_id": user["user_id"],
                "role": "member",
                "joined_at": ts(now_utc()),
            }).execute()
        )

    await run(
        lambda: sb.table("notifications")
        .delete()
        .eq("notif_id", notif_id)
        .eq("user_id", user["user_id"])
        .execute()
    )

    await run(
        lambda: sb.table("circles")
        .update({"updated_at": ts(now_utc())})
        .eq("circle_id", circle_id)
        .execute()
    )

    invite_data = notif.get("data") or {}
    inviter_id = invite_data.get("from")

    if inviter_id and inviter_id != user["user_id"]:
        await _push_notification(
            inviter_id,
            "circle_invite_accepted",
            {
                "from": user["user_id"],
                "from_name": user.get("display_name", ""),
                "circle_id": circle_id,
                "circle_name": invite_data.get("circle_name", "Circle"),
            },
        )

    return {"accepted": True, "circle_id": circle_id}


@api.post("/circles/invites/{notif_id}/reject")
async def reject_circle_invite(
    notif_id: str,
    user=Depends(current_user),
):
    notif_r = await run(
        lambda: sb.table("notifications")
        .select("notif_id,data")
        .eq("notif_id", notif_id)
        .eq("user_id", user["user_id"])
        .eq("kind", "circle_invite")
        .execute()
    )

    if not notif_r.data:
        raise HTTPException(status_code=404, detail="Circle invitation not found")

    invite_data = notif_r.data[0].get("data") or {}

    await run(
        lambda: sb.table("notifications")
        .delete()
        .eq("notif_id", notif_id)
        .eq("user_id", user["user_id"])
        .execute()
    )

    inviter_id = invite_data.get("from")

    if inviter_id and inviter_id != user["user_id"]:
        await _push_notification(
            inviter_id,
            "circle_invite_rejected",
            {
                "from": user["user_id"],
                "from_name": user.get("display_name", ""),
                "circle_id": invite_data.get("circle_id"),
                "circle_name": invite_data.get("circle_name", "Circle"),
            },
        )

    return {"rejected": True}


@api.delete("/circles/{circle_id}/members/{user_id}")
async def remove_circle_member(
    circle_id: str,
    user_id: str,
    user=Depends(current_user),
):
    my_r = await run(
        lambda: sb.table("circle_members")
        .select("role")
        .eq("circle_id", circle_id)
        .eq("user_id", user["user_id"])
        .execute()
    )

    if not my_r.data or my_r.data[0]["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Not allowed")

    target_r = await run(
        lambda: sb.table("circle_members")
        .select("role")
        .eq("circle_id", circle_id)
        .eq("user_id", user_id)
        .execute()
    )

    if not target_r.data:
        raise HTTPException(status_code=404, detail="Member not found")

    if target_r.data[0]["role"] == "owner":
        raise HTTPException(status_code=400, detail="Circle owner cannot be removed")

    circle_r = await run(
        lambda: sb.table("circles")
        .select("name")
        .eq("circle_id", circle_id)
        .limit(1)
        .execute()
    )
    circle_name = (
        circle_r.data[0].get("name", "Circle")
        if circle_r.data
        else "Circle"
    )

    await run(
        lambda: sb.table("circle_members")
        .delete()
        .eq("circle_id", circle_id)
        .eq("user_id", user_id)
        .execute()
    )

    await _push_notification(
        user_id,
        "circle_member_removed",
        {
            "from": user["user_id"],
            "from_name": user.get("display_name", ""),
            "circle_id": circle_id,
            "circle_name": circle_name,
        },
    )

    return {"removed": True}


@api.delete("/circles/{circle_id}")
async def delete_circle_permanently(
    circle_id: str,
    user=Depends(current_user),
):
    circle_r = await run(
        lambda: sb.table("circles")
        .select("circle_id,owner_id")
        .eq("circle_id", circle_id)
        .execute()
    )

    if not circle_r.data:
        raise HTTPException(status_code=404, detail="Circle not found")

    if circle_r.data[0]["owner_id"] != user["user_id"]:
        raise HTTPException(
            status_code=403,
            detail="Only the Circle owner can permanently delete this Circle"
        )

    await run(
        lambda: sb.table("circle_messages")
        .delete()
        .eq("circle_id", circle_id)
        .execute()
    )

    await run(
        lambda: sb.table("circle_members")
        .delete()
        .eq("circle_id", circle_id)
        .execute()
    )

    await run(
        lambda: sb.table("notifications")
        .delete()
        .eq("kind", "circle_invite")
        .contains("data", {"circle_id": circle_id})
        .execute()
    )

    await run(
        lambda: sb.table("circles")
        .delete()
        .eq("circle_id", circle_id)
        .eq("owner_id", user["user_id"])
        .execute()
    )

    return {"deleted": True, "circle_id": circle_id}


@api.post("/circles/{circle_id}/leave")
async def leave_circle(
    circle_id: str,
    user=Depends(current_user),
):
    member_r = await run(
        lambda: sb.table("circle_members")
        .select("role")
        .eq("circle_id", circle_id)
        .eq("user_id", user["user_id"])
        .execute()
    )

    if not member_r.data:
        raise HTTPException(status_code=404, detail="You are not a member of this Circle")

    if member_r.data[0]["role"] == "owner":
        raise HTTPException(
            status_code=400,
            detail="Transfer ownership before leaving this Circle"
        )

    await run(
        lambda: sb.table("circle_members")
        .delete()
        .eq("circle_id", circle_id)
        .eq("user_id", user["user_id"])
        .execute()
    )

    return {"left": True}


@api.get("/circles/{circle_id}/messages")
async def list_circle_messages(
    circle_id: str,
    limit: int = 100,
    user=Depends(current_user),
):
    member_r = await run(
        lambda: sb.table("circle_members")
        .select("user_id")
        .eq("circle_id", circle_id)
        .eq("user_id", user["user_id"])
        .execute()
    )

    if not member_r.data:
        raise HTTPException(status_code=403, detail="You are not a member of this Circle")

    messages_r = await run(
        lambda: sb.table("circle_messages")
        .select("*")
        .eq("circle_id", circle_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )

    messages = list(reversed(messages_r.data or []))
    sender_ids = list({m["sender_id"] for m in messages})

    users_map = {}
    if sender_ids:
        users_r = await run(
            lambda: sb.table("users")
            .select("*")
            .in_("user_id", sender_ids)
            .execute()
        )
        users_map = {
            u["user_id"]: public_user(u)
            for u in (users_r.data or [])
        }

    for message in messages:
        message["sender"] = users_map.get(message["sender_id"])

    return {"messages": messages}


@api.post("/circles/message")
async def send_circle_message(
    body: CircleMessageIn,
    user=Depends(current_user),
):
    member_r = await run(
        lambda: sb.table("circle_members")
        .select("user_id")
        .eq("circle_id", body.circle_id)
        .eq("user_id", user["user_id"])
        .execute()
    )

    if not member_r.data:
        raise HTTPException(status_code=403, detail="You are not a member of this Circle")

    if not body.content.strip() and not body.media:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    message = {
        "message_id": make_id("cmsg"),
        "circle_id": body.circle_id,
        "sender_id": user["user_id"],
        "content": body.content,
        "kind": body.kind,
        "media": body.media,
        "reply_to": body.reply_to,
        "read_by": [user["user_id"]],
        "reactions": [],
        "created_at": ts(now_utc()),
    }

    await run(
        lambda: sb.table("circle_messages")
        .insert(message)
        .execute()
    )

    await run(
        lambda: sb.table("circles")
        .update({"updated_at": ts(now_utc())})
        .eq("circle_id", body.circle_id)
        .execute()
    )

    members_r = await run(
        lambda: sb.table("circle_members")
        .select("user_id")
        .eq("circle_id", body.circle_id)
        .execute()
    )

    message["sender"] = public_user(user)

    circle_r = await run(
        lambda: sb.table("circles")
        .select("name,photo")
        .eq("circle_id", body.circle_id)
        .limit(1)
        .execute()
    )
    circle_data = circle_r.data[0] if circle_r.data else {}

    if body.kind == "text":
        preview = (body.content or "").strip()[:100] or "Sent a message"
    else:
        preview_map = {
            "image": "Sent a photo",
            "video": "Sent a video",
            "voice": "Sent a voice message",
            "file": "Sent a file",
            "emoji": "Sent an emoji",
        }
        preview = preview_map.get(body.kind, "Sent a message")

    for member in (members_r.data or []):
        member_id = member["user_id"]

        await broadcast_to_user(
            member_id,
            {
                "type": "circle_message",
                "circle_id": body.circle_id,
                "message": message,
            },
        )

        if member_id != user["user_id"]:
            await _send_expo_push(
                member_id,
                "circle_message",
                {
                    "from": user["user_id"],
                    "from_name": user.get("display_name", ""),
                    "circle_id": body.circle_id,
                    "circle_name": circle_data.get("name", "Circle"),
                    "circle_photo": circle_data.get("photo"),
                    "preview": preview,
                    "message_id": message["message_id"],
                },
            )

    return {"message": message}



@api.put("/circles/message/{message_id}")
async def edit_circle_message(
    message_id: str,
    body: MessageEdit,
    user=Depends(current_user),
):
    mr = await run(
        lambda: sb.table("circle_messages")
        .select("*")
        .eq("message_id", message_id)
        .execute()
    )

    if not mr.data or mr.data[0]["sender_id"] != user["user_id"]:
        raise HTTPException(status_code=404, detail="Message not found")

    msg = mr.data[0]

    await run(
        lambda: sb.table("circle_messages")
        .update({"content": body.content, "edited": True})
        .eq("message_id", message_id)
        .execute()
    )

    updated_r = await run(
        lambda: sb.table("circle_messages")
        .select("*")
        .eq("message_id", message_id)
        .execute()
    )
    updated = updated_r.data[0]
    updated["sender"] = public_user(user)

    members_r = await run(
        lambda: sb.table("circle_members")
        .select("user_id")
        .eq("circle_id", msg["circle_id"])
        .execute()
    )

    for member in (members_r.data or []):
        await broadcast_to_user(
            member["user_id"],
            {
                "type": "circle_message_edit",
                "circle_id": msg["circle_id"],
                "message": updated,
            },
        )

    return updated


@api.delete("/circles/message/{message_id}")
async def delete_circle_message(
    message_id: str,
    user=Depends(current_user),
):
    mr = await run(
        lambda: sb.table("circle_messages")
        .select("*")
        .eq("message_id", message_id)
        .execute()
    )

    if not mr.data:
        raise HTTPException(status_code=404, detail="Message not found")

    msg = mr.data[0]

    if msg["sender_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Only the sender can delete this message")

    await run(
        lambda: sb.table("circle_messages")
        .delete()
        .eq("message_id", message_id)
        .execute()
    )

    members_r = await run(
        lambda: sb.table("circle_members")
        .select("user_id")
        .eq("circle_id", msg["circle_id"])
        .execute()
    )

    for member in (members_r.data or []):
        await broadcast_to_user(
            member["user_id"],
            {
                "type": "circle_message_delete",
                "circle_id": msg["circle_id"],
                "message_id": message_id,
            },
        )

    return {"ok": True}


@api.post("/circles/message/{message_id}/react")
async def react_circle_message(
    message_id: str,
    body: ReactionIn,
    user=Depends(current_user),
):
    mr = await run(
        lambda: sb.table("circle_messages")
        .select("*")
        .eq("message_id", message_id)
        .execute()
    )

    if not mr.data:
        raise HTTPException(status_code=404, detail="Message not found")

    msg = mr.data[0]

    member_r = await run(
        lambda: sb.table("circle_members")
        .select("user_id")
        .eq("circle_id", msg["circle_id"])
        .eq("user_id", user["user_id"])
        .execute()
    )

    if not member_r.data:
        raise HTTPException(status_code=403, detail="Not allowed")

    reactions = list(msg.get("reactions") or [])
    existing = next(
        (r for r in reactions if r.get("user_id") == user["user_id"]),
        None,
    )

    reaction_added = not (
        existing and existing.get("emoji") == body.emoji
    )

    if not reaction_added:
        reactions = [
            r for r in reactions
            if r.get("user_id") != user["user_id"]
        ]
    else:
        reactions = [
            r for r in reactions
            if r.get("user_id") != user["user_id"]
        ]
        reactions.append({
            "user_id": user["user_id"],
            "emoji": body.emoji,
            "at": ts(now_utc()),
        })

    await run(
        lambda: sb.table("circle_messages")
        .update({"reactions": reactions})
        .eq("message_id", message_id)
        .execute()
    )

    updated_r = await run(
        lambda: sb.table("circle_messages")
        .select("*")
        .eq("message_id", message_id)
        .execute()
    )
    updated = updated_r.data[0]

    members_r = await run(
        lambda: sb.table("circle_members")
        .select("user_id")
        .eq("circle_id", msg["circle_id"])
        .execute()
    )

    for member in (members_r.data or []):
        await broadcast_to_user(
            member["user_id"],
            {
                "type": "circle_message_react",
                "circle_id": msg["circle_id"],
                "message": updated,
            },
        )

    if reaction_added and msg["sender_id"] != user["user_id"]:
        await _push_notification(
            msg["sender_id"],
            "circle_message_reaction",
            {
                "from": user["user_id"],
                "from_name": user.get("display_name", ""),
                "circle_id": msg["circle_id"],
                "message_id": message_id,
                "emoji": body.emoji,
            },
        )

    return updated


# ── Chats ──────────────────────────────────────────────────────────────────────
def _conv_id_for(a: str, b: str) -> str:
    x, y = sorted([a, b])
    return f"cnv_{x[:8]}_{y[:8]}"


@api.post("/chats/open")
async def open_chat(body: FriendActionIn, user=Depends(current_user)):
    other = body.user_id
    await ensure_not_blocked(user["user_id"], other)

    r = await run(lambda: sb.table("users").select("user_id").eq("user_id", other).execute())
    if not r.data:
        raise HTTPException(status_code=404, detail="Not found")
    conv_id = _conv_id_for(user["user_id"], other)
    cr = await run(lambda: sb.table("conversations").select("*").eq("conversation_id", conv_id).execute())
    if cr.data:
        conv = cr.data[0]
    else:
        conv = {
            "conversation_id": conv_id,
            "participants": sorted([user["user_id"], other]),
            "created_at": ts(now_utc()),
            "last_message": None,
            "last_message_at": ts(now_utc()),
        }
        await run(lambda: sb.table("conversations").insert(conv).execute())
    return {"conversation": conv}


@api.get("/chats")
async def list_chats(user=Depends(current_user)):
    blocked_ids = await blocked_user_ids(user["user_id"])

    r = await run(lambda: sb.table("conversations").select("*")
        .contains("participants", [user["user_id"]])
        .order("last_message_at", desc=True).limit(200).execute())
    out = []
    for c in r.data:
        other_ids = [p for p in c["participants"] if p != user["user_id"]]
        if not other_ids:
            continue
        other = other_ids[0]

        if other in blocked_ids:
            continue

        ur = await run(lambda: sb.table("users").select("*").eq("user_id", other).execute())
        other_user = public_user(ur.data[0]) if ur.data else None
        # unread: messages in this conv not from me, not in my read_by
        all_msgs = await run(lambda: sb.table("messages").select("message_id,sender_id,read_by,deleted_for")
            .eq("conversation_id", c["conversation_id"])
            .eq("deleted_for_everyone", False).execute())
        unread = sum(
            1 for m in all_msgs.data
            if m["sender_id"] != user["user_id"]
            and user["user_id"] not in (m.get("read_by") or [])
            and user["user_id"] not in (m.get("deleted_for") or [])
        )
        c["other_user"] = other_user
        c["unread"] = unread

        # Keep only the newest conversation for each user
        if not any(x.get("other_user", {}).get("user_id") == other for x in out):
            out.append(c)

    return {"chats": out}


@api.get("/chats/{conversation_id}/messages")
async def list_messages(
    conversation_id: str,
    limit: int = 50,
    before: Optional[str] = None,
    user=Depends(current_user),
):
    cr = await run(lambda: sb.table("conversations").select("participants")
        .eq("conversation_id", conversation_id).execute())
    if not cr.data or user["user_id"] not in cr.data[0]["participants"]:
        raise HTTPException(status_code=404, detail="Not found")

    other_ids = [p for p in cr.data[0]["participants"] if p != user["user_id"]]
    for other in other_ids:
        await ensure_not_blocked(user["user_id"], other)

    qb = (sb.table("messages").select("*")
          .eq("conversation_id", conversation_id)
          .order("created_at", desc=True)
          .limit(limit))

    if before:
        br = await run(lambda: sb.table("messages").select("created_at")
            .eq("message_id", before).execute())
        if br.data:
            qb = qb.lt("created_at", br.data[0]["created_at"])

    msgs_r = await run(lambda: qb.execute())
    msgs = list(reversed(msgs_r.data))

    # Filter deleted_for in Python, mark read
    visible = []
    for msg in msgs:
        if user["user_id"] in (msg.get("deleted_for") or []):
            continue
        visible.append(msg)
        if msg["sender_id"] != user["user_id"] and user["user_id"] not in (msg.get("read_by") or []):
            new_rb = list(set((msg.get("read_by") or []) + [user["user_id"]]))
            mid = msg["message_id"]
            await run(lambda: sb.table("messages").update({"read_by": new_rb}).eq("message_id", mid).execute())
            msg["read_by"] = new_rb
            await broadcast_to_user(msg["sender_id"], {
                "type": "message_read",
                "conversation_id": conversation_id,
                "message_id": mid,
                "read_by": new_rb,
                "read_by_user_id": user["user_id"],
            })

    return {"messages": visible}


@api.post("/chats/message")
async def send_message(body: MessageIn, user=Depends(current_user)):
    cr = await run(lambda: sb.table("conversations").select("*")
        .eq("conversation_id", body.conversation_id).execute())
    if not cr.data or user["user_id"] not in cr.data[0]["participants"]:
        raise HTTPException(status_code=404, detail="Not found")
    conv = cr.data[0]
    other_ids = [p for p in conv["participants"] if p != user["user_id"]]

    for other in other_ids:
        await ensure_not_blocked(user["user_id"], other)

    msg_id = make_id("msg")
    msg = {
        "message_id": msg_id,
        "conversation_id": body.conversation_id,
        "sender_id": user["user_id"],
        "content": body.content,
        "kind": body.kind,
        "media": body.media,
        "file_name": body.file_name,
        "reply_to": body.reply_to,
        "edited": False,
        "deleted_for_everyone": False,
        "deleted_for": [],
        "read_by": [user["user_id"]],
        "delivered_to": conv["participants"],
        "reactions": [],
        "created_at": ts(now_utc()),
    }
    await run(lambda: sb.table("messages").insert(msg).execute())
    preview = body.content[:80] if body.kind == "text" else f"[{body.kind}]"
    await run(lambda: sb.table("conversations")
        .update({"last_message": preview, "last_message_at": ts(now_utc())})
        .eq("conversation_id", body.conversation_id).execute())
    for p in conv["participants"]:
        await broadcast_to_user(p, {"type": "message", "message": msg})
    for other in other_ids:
        await _push_notification(other, "message", {
            "conversation_id": body.conversation_id,
            "from": user["user_id"],
            "from_name": user["display_name"],
            "preview": preview,
        })
    return msg


@api.put("/chats/message/{message_id}")
async def edit_message(message_id: str, body: MessageEdit, user=Depends(current_user)):
    mr = await run(lambda: sb.table("messages").select("*").eq("message_id", message_id).execute())
    if not mr.data or mr.data[0]["sender_id"] != user["user_id"]:
        raise HTTPException(status_code=404, detail="Not found")
    msg = mr.data[0]
    await run(lambda: sb.table("messages")
        .update({"content": body.content, "edited": True})
        .eq("message_id", message_id).execute())
    updated_r = await run(lambda: sb.table("messages").select("*").eq("message_id", message_id).execute())
    updated = updated_r.data[0]
    cr = await run(lambda: sb.table("conversations").select("participants")
        .eq("conversation_id", msg["conversation_id"]).execute())
    if cr.data:
        for p in cr.data[0]["participants"]:
            await broadcast_to_user(p, {"type": "message_edit", "message": updated})
    return updated


@api.delete("/chats/message/{message_id}")
async def delete_message(message_id: str, scope: str = Query("me"), user=Depends(current_user)):
    mr = await run(lambda: sb.table("messages").select("*").eq("message_id", message_id).execute())
    if not mr.data:
        raise HTTPException(status_code=404, detail="Not found")
    msg = mr.data[0]
    if scope == "everyone":
        if msg["sender_id"] != user["user_id"]:
            raise HTTPException(status_code=403, detail="Not sender")
        await run(lambda: sb.table("messages")
            .update({"deleted_for_everyone": True, "content": "", "media": None, "kind": "deleted"})
            .eq("message_id", message_id).execute())
        cr = await run(lambda: sb.table("conversations").select("participants")
            .eq("conversation_id", msg["conversation_id"]).execute())
        if cr.data:
            for p in cr.data[0]["participants"]:
                await broadcast_to_user(p, {"type": "message_delete", "message_id": message_id})
    else:
        new_df = list(set((msg.get("deleted_for") or []) + [user["user_id"]]))
        await run(lambda: sb.table("messages").update({"deleted_for": new_df}).eq("message_id", message_id).execute())
    return {"ok": True}


@api.get("/chats/{conversation_id}/search")
async def search_messages(conversation_id: str, q: str, user=Depends(current_user)):
    cr = await run(lambda: sb.table("conversations").select("participants")
        .eq("conversation_id", conversation_id).execute())
    if not cr.data or user["user_id"] not in cr.data[0]["participants"]:
        raise HTTPException(status_code=404, detail="Not found")

    other_ids = [p for p in cr.data[0]["participants"] if p != user["user_id"]]
    for other in other_ids:
        await ensure_not_blocked(user["user_id"], other)

    mr = await run(lambda: sb.table("messages").select("*")
        .eq("conversation_id", conversation_id)
        .eq("deleted_for_everyone", False)
        .ilike("content", f"%{q}%")
        .order("created_at", desc=True)
        .limit(50).execute())
    return {"messages": mr.data}


@api.post("/chats/message/{message_id}/react")
async def react_message(message_id: str, body: ReactionIn, user=Depends(current_user)):
    mr = await run(lambda: sb.table("messages").select("*").eq("message_id", message_id).execute())
    if not mr.data:
        raise HTTPException(status_code=404, detail="Not found")
    msg = mr.data[0]
    cr = await run(lambda: sb.table("conversations").select("participants")
        .eq("conversation_id", msg["conversation_id"]).execute())
    if not cr.data or user["user_id"] not in cr.data[0]["participants"]:
        raise HTTPException(status_code=403, detail="Not allowed")

    other_ids = [p for p in cr.data[0]["participants"] if p != user["user_id"]]
    for other in other_ids:
        await ensure_not_blocked(user["user_id"], other)

    reactions: list = list(msg.get("reactions") or [])
    existing = next((r for r in reactions if r.get("user_id") == user["user_id"]), None)
    reaction_added = not (
        existing and existing.get("emoji") == body.emoji
    )

    if not reaction_added:
        reactions = [r for r in reactions if r.get("user_id") != user["user_id"]]
    else:
        reactions = [r for r in reactions if r.get("user_id") != user["user_id"]]
        reactions.append({"user_id": user["user_id"], "emoji": body.emoji, "at": ts(now_utc())})

    await run(lambda: sb.table("messages").update({"reactions": reactions}).eq("message_id", message_id).execute())
    updated_r = await run(lambda: sb.table("messages").select("*").eq("message_id", message_id).execute())
    updated = updated_r.data[0]
    for p in cr.data[0]["participants"]:
        await broadcast_to_user(p, {"type": "message_react", "message": updated})

    if reaction_added and msg["sender_id"] != user["user_id"]:
        await _push_notification(
            msg["sender_id"],
            "message_reaction",
            {
                "from": user["user_id"],
                "from_name": user.get("display_name", ""),
                "conversation_id": msg["conversation_id"],
                "message_id": message_id,
                "emoji": body.emoji,
            },
        )

    return updated


@api.delete("/users/me")
async def delete_account(body: DeleteAccountIn, user=Depends(current_user)):
    ur = await run(lambda: sb.table("users").select("*").eq("user_id", user["user_id"]).execute())
    u = ur.data[0] if ur.data else None
    if u and u.get("provider") == "email" and u.get("password_hash"):
        if not body.password or not verify_password(body.password, u["password_hash"]):
            raise HTTPException(status_code=400, detail="Password required to delete account")
    uid = user["user_id"]
    await run(lambda: sb.table("stories").delete().eq("user_id", uid).execute())
    await run(lambda: sb.table("notifications").delete().eq("user_id", uid).execute())
    await run(lambda: sb.table("friend_requests").delete()
        .or_(f"from_user.eq.{uid},to_user.eq.{uid}").execute())
    await run(lambda: sb.table("friendships").delete().or_(f"a.eq.{uid},b.eq.{uid}").execute())
    await run(lambda: sb.table("blocks").delete().or_(f"blocker.eq.{uid},blocked.eq.{uid}").execute())
    await run(lambda: sb.table("messages")
        .update({"deleted_for_everyone": True, "content": "", "media": None, "kind": "deleted"})
        .eq("sender_id", uid).execute())
    convs_r = await run(lambda: sb.table("conversations").select("*")
        .contains("participants", [uid]).execute())
    for c in convs_r.data:
        remaining = [p for p in c["participants"] if p != uid]
        cid = c["conversation_id"]
        if not remaining:
            await run(lambda: sb.table("messages").delete().eq("conversation_id", cid).execute())
            await run(lambda: sb.table("conversations").delete().eq("conversation_id", cid).execute())
        else:
            await run(lambda: sb.table("conversations")
                .update({"participants": remaining}).eq("conversation_id", cid).execute())
    await run(lambda: sb.table("user_sessions").delete().eq("user_id", uid).execute())
    await run(lambda: sb.table("users").delete().eq("user_id", uid).execute())
    return {"ok": True}


class StoryReactionIn(BaseModel):
    emoji: str


# ── Stories ────────────────────────────────────────────────────────────────────
@api.post("/stories")
async def create_story(body: StoryIn, user=Depends(current_user)):
    story_id = make_id("sty")
    doc = {
        "story_id": story_id,
        "user_id": user["user_id"],
        "kind": body.kind,
        "media": body.media,
        "caption": body.caption or "",
        "is_private": body.is_private,
        "text_x": max(0.0, min(1.0, body.text_x)),
        "text_y": max(0.0, min(1.0, body.text_y)),
        "text_color": body.text_color,
        "text_size": max(12, min(72, body.text_size)),
        "font_index": max(0, min(9, body.font_index)),
        "media_scale": max(0.5, min(5.0, body.media_scale)),
        "media_x": max(-2.0, min(2.0, body.media_x)),
        "media_y": max(-2.0, min(2.0, body.media_y)),
        "viewers": [],
        "created_at": ts(now_utc()),
        "expires_at": ts(now_utc() + timedelta(hours=24)),
    }
    await run(lambda: sb.table("stories").insert(doc).execute())
    fr = await run(lambda: sb.table("friendships").select("a,b")
        .or_(f"a.eq.{user['user_id']},b.eq.{user['user_id']}").execute())
    for f in fr.data:
        other = f["a"] if f["b"] == user["user_id"] else f["b"]
        await broadcast_to_user(other, {"type": "story_new", "story_id": story_id, "user_id": user["user_id"]})
        await _push_notification(other, "story", {
            "from": user["user_id"], "from_name": user["display_name"], "story_id": story_id,
        })
    return doc


@api.get("/stories/feed")
async def stories_feed(user=Depends(current_user)):
    me = user["user_id"]
    blocked_ids = await blocked_user_ids(me)

    # Accepted bonds
    fr = await run(lambda: sb.table("friendships").select("a,b")
        .or_(f"a.eq.{me},b.eq.{me}").execute())
    friend_ids = {
        f["a"] if f["b"] == me else f["b"]
        for f in (fr.data or [])
    }

    # All active stories:
    # - my own stories
    # - public stories from anyone
    # - private stories only from accepted bonds
    sr = await run(lambda: sb.table("stories").select("*")
        .gt("expires_at", ts(now_utc()))
        .order("created_at", desc=True).execute())

    by_user: Dict[str, List[dict]] = {}

    for story in (sr.data or []):
        owner_id = story["user_id"]

        if owner_id != me and owner_id in blocked_ids:
            continue

        allowed = (
            owner_id == me
            or not story.get("is_private", False)
            or owner_id in friend_ids
        )

        if allowed:
            by_user.setdefault(owner_id, []).append(story)

    uid_list = list(by_user.keys())
    if not uid_list:
        return {"feed": []}

    ur = await run(lambda: sb.table("users").select("*")
        .in_("user_id", uid_list).execute())
    umap = {u["user_id"]: public_user(u) for u in (ur.data or [])}

    out = [
        {"user": umap.get(uid), "stories": stories_}
        for uid, stories_ in by_user.items()
        if umap.get(uid)
    ]

    out.sort(
        key=lambda x: (
            0 if x["user"]["user_id"] == me else 1,
            -len(x["stories"])
        )
    )
    return {"feed": out}


@api.post("/stories/{story_id}/view")
async def view_story(story_id: str, user=Depends(current_user)):
    sr = await run(lambda: sb.table("stories").select("*").eq("story_id", story_id).execute())
    if not sr.data:
        raise HTTPException(status_code=404, detail="Not found")
    s = sr.data[0]

    if s["user_id"] != user["user_id"]:
        await ensure_not_blocked(user["user_id"], s["user_id"])
        await ensure_private_access(user["user_id"], s["user_id"])

    viewers: list = list(s.get("viewers") or [])
    if user["user_id"] != s["user_id"] and not any(v.get("user_id") == user["user_id"] for v in viewers):
        viewers.append({"user_id": user["user_id"], "viewed_at": ts(now_utc())})
        await run(lambda: sb.table("stories").update({"viewers": viewers}).eq("story_id", story_id).execute())
    return {"ok": True}


@api.get("/stories/{story_id}/viewers")
async def story_viewers(story_id: str, user=Depends(current_user)):
    sr = await run(lambda: sb.table("stories").select("*").eq("story_id", story_id).execute())
    if not sr.data or sr.data[0]["user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not allowed")
    s = sr.data[0]
    viewers_raw: list = s.get("viewers") or []
    ids = [v["user_id"] for v in viewers_raw]
    if not ids:
        return {"viewers": [], "count": 0}
    ur = await run(lambda: sb.table("users").select("*").in_("user_id", ids).execute())
    umap = {u["user_id"]: public_user(u) for u in ur.data}
    viewers = []
    for v in viewers_raw:
        viewer_id = v.get("user_id")
        viewer_user = umap.get(viewer_id)

        if not viewer_id or not viewer_user:
            continue

        if await users_blocked(user["user_id"], viewer_id):
            continue

        viewers.append({
            "user": viewer_user,
            "viewed_at": v.get("viewed_at"),
            "reaction": v.get("reaction"),
            "reactions": v.get("reactions") or ([v.get("reaction")] if v.get("reaction") else []),
            "reacted_at": v.get("reacted_at"),
        })

    return {"viewers": viewers, "count": len(viewers)}


@api.delete("/stories/{story_id}")
async def delete_story(story_id: str, user=Depends(current_user)):
    sr = await run(lambda: sb.table("stories").select("story_id,user_id").eq("story_id", story_id).execute())
    if not sr.data or sr.data[0]["user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not allowed")
    await run(lambda: sb.table("stories").delete().eq("story_id", story_id).execute())
    return {"ok": True}


class StoryReactBody(BaseModel):
    emoji: str = "❤️"


@api.post("/stories/{story_id}/react")
async def react_to_story(story_id: str, body: StoryReactBody, user=Depends(current_user)):
    sr = await run(lambda: sb.table("stories").select("*").eq("story_id", story_id).execute())
    if not sr.data:
        raise HTTPException(status_code=404, detail="Not found")

    story = sr.data[0]

    if story["user_id"] != user["user_id"]:
        await ensure_not_blocked(user["user_id"], story["user_id"])
        await ensure_private_access(user["user_id"], story["user_id"])

    viewers = list(story.get("viewers") or [])
    found = False
    reaction_added = False

    for viewer in viewers:
        if viewer.get("user_id") == user["user_id"]:
            reactions = list(viewer.get("reactions") or [])
            if len(reactions) < 5:
                reactions.append(body.emoji)
                reaction_added = True
            viewer["reactions"] = reactions
            viewer["reaction"] = reactions[0] if reactions else None
            viewer["reacted_at"] = ts(now_utc())
            found = True
            break

    if not found:
        reaction_added = True
        viewers.append({
            "user_id": user["user_id"],
            "viewed_at": ts(now_utc()),
            "reactions": [body.emoji],
            "reaction": body.emoji,
            "reacted_at": ts(now_utc()),
        })

    await run(lambda: sb.table("stories").update({"viewers": viewers}).eq("story_id", story_id).execute())

    await broadcast_to_user(story["user_id"], {
        "type": "story_react",
        "story_id": story_id,
        "emoji": body.emoji,
        "from_user_id": user["user_id"],
        "from_name": user.get("display_name", ""),
    })

    if reaction_added and story["user_id"] != user["user_id"]:
        await _push_notification(
            story["user_id"],
            "story_reaction",
            {
                "from": user["user_id"],
                "from_name": user.get("display_name", ""),
                "story_id": story_id,
                "story_owner_id": story["user_id"],
                "emoji": body.emoji,
            },
        )

    return {"ok": True, "reaction": body.emoji}


# ── Notifications ──────────────────────────────────────────────────────────────
@api.get("/notifications")
async def list_notifications(user=Depends(current_user)):
    r = await run(lambda: sb.table("notifications").select("*")
        .eq("user_id", user["user_id"])
        .order("created_at", desc=True).limit(100).execute())

    notifications = r.data or []
    sender_ids = list({
        n.get("data", {}).get("from")
        for n in notifications
        if n.get("data", {}).get("from")
    })

    users_map = {}
    if sender_ids:
        ur = await run(lambda: sb.table("users")
            .select("user_id,username,display_name,profile_picture,badge_type")
            .in_("user_id", sender_ids).execute())
        users_map = {u["user_id"]: u for u in (ur.data or [])}

    visible_notifications = []
    for n in notifications:
        sender_id = n.get("data", {}).get("from")

        if sender_id and await users_blocked(user["user_id"], sender_id):
            continue

        n["sender"] = users_map.get(sender_id)
        visible_notifications.append(n)

    return {"notifications": visible_notifications}


@api.post("/notifications/read")
async def mark_all_read(user=Depends(current_user)):
    await run(lambda: sb.table("notifications")
        .update({"read": True})
        .eq("user_id", user["user_id"]).eq("read", False).execute())
    return {"ok": True}


@api.post("/notifications/{notif_id}/read")
async def mark_read(notif_id: str, user=Depends(current_user)):
    await run(lambda: sb.table("notifications")
        .update({"read": True})
        .eq("notif_id", notif_id).eq("user_id", user["user_id"]).execute())
    return {"ok": True}


# ── Pending voice call ─────────────────────────────────────────────────────────
@api.get("/calls/pending")
async def get_pending_voice_call(
    conversation_id: str,
    user=Depends(current_user),
):
    user_id = user["user_id"]
    pending = pending_voice_calls.get(user_id)

    if not pending:
        return {"call": None}

    if pending.get("expires_at") < now_utc():
        pending_voice_calls.pop(user_id, None)
        return {"call": None}

    if pending.get("conversation_id") != conversation_id:
        return {"call": None}

    return {
        "call": {
            "conversation_id": pending["conversation_id"],
            "caller_id": pending["caller_id"],
            "sdp": pending["sdp"],
        }
    }


# ── WebSocket ──────────────────────────────────────────────────────────────────
@app.websocket("/api/ws")
async def websocket_endpoint(ws: WebSocket, token: str):
    user_id = decode_jwt(token)
    if not user_id:
        r = await run(lambda: sb.table("user_sessions").select("user_id").eq("session_token", token).execute())
        user_id = r.data[0]["user_id"] if r.data else None
    if not user_id:
        await ws.close(code=4401)
        return
    await ws.accept()
    await hub.connect(user_id, ws)

    # Load this user's conversation participants once when WebSocket connects.
    # Typing events can then be forwarded instantly without a database request
    # on every keypress.
    typing_conversations = {}

    try:
        cr = await run(
            lambda: sb.table("conversations")
            .select("conversation_id,participants")
            .contains("participants", [user_id])
            .execute()
        )
        typing_conversations = {
            row["conversation_id"]: row.get("participants", [])
            for row in (cr.data or [])
        }
    except Exception:
        typing_conversations = {}

    try:
        while True:
            data = await ws.receive_json()
            t = data.get("type")

            if t == "typing":
                conv_id = data.get("conversation_id")
                participants = typing_conversations.get(conv_id, [])

                if conv_id and not participants:
                    cr = await run(
                        lambda: sb.table("conversations")
                        .select("participants")
                        .eq("conversation_id", conv_id)
                        .limit(1)
                        .execute()
                    )

                    if cr.data:
                        participants = cr.data[0].get("participants", [])
                        typing_conversations[conv_id] = participants

                if user_id in participants:
                    payload = {
                        "type": "typing",
                        "conversation_id": conv_id,
                        "user_id": user_id,
                        "is_typing": bool(data.get("is_typing")),
                    }

                    for participant_id in participants:
                        if participant_id != user_id:
                            await hub.send(participant_id, payload)

            elif t == "message_read":
                conv_id = data.get("conversation_id")
                message_id = data.get("message_id")
                participants = typing_conversations.get(conv_id, [])

                if (
                    conv_id
                    and message_id
                    and user_id in participants
                ):
                    mr = await run(
                        lambda: sb.table("messages")
                        .select("sender_id,read_by")
                        .eq("message_id", message_id)
                        .eq("conversation_id", conv_id)
                        .limit(1)
                        .execute()
                    )

                    if mr.data:
                        msg = mr.data[0]
                        sender_id = msg.get("sender_id")
                        read_by = msg.get("read_by") or []

                        if sender_id != user_id and user_id not in read_by:
                            new_rb = list(set(read_by + [user_id]))

                            await run(
                                lambda: sb.table("messages")
                                .update({"read_by": new_rb})
                                .eq("message_id", message_id)
                                .execute()
                            )

                            await hub.send(sender_id, {
                                "type": "message_read",
                                "conversation_id": conv_id,
                                "message_id": message_id,
                                "read_by": new_rb,
                                "read_by_user_id": user_id,
                            })

            elif t in {"call_offer", "call_answer", "call_ice", "call_end",
                       "video_call_offer", "video_call_answer", "video_call_ice", "video_call_end"}:
                conv_id = data.get("conversation_id")
                participants = typing_conversations.get(conv_id, [])

                if conv_id and not participants:
                    cr = await run(
                        lambda: sb.table("conversations")
                        .select("participants")
                        .eq("conversation_id", conv_id)
                        .limit(1)
                        .execute()
                    )

                    if cr.data:
                        participants = cr.data[0].get("participants", [])
                        typing_conversations[conv_id] = participants

                if user_id in participants:
                    if t == "call_offer":
                        for participant_id in participants:
                            if participant_id != user_id:
                                pending_voice_calls[participant_id] = {
                                    "conversation_id": conv_id,
                                    "caller_id": user_id,
                                    "sdp": data.get("sdp"),
                                    "expires_at": now_utc() + timedelta(seconds=60),
                                }

                    elif t == "call_end":
                        for participant_id in participants:
                            pending_voice_calls.pop(participant_id, None)
                        pending_voice_calls.pop(user_id, None)

                    payload = {
                        "type": t,
                        "conversation_id": conv_id,
                        "user_id": user_id,
                    }

                    if t in {"call_offer", "call_answer",
                             "video_call_offer", "video_call_answer"}:
                        payload["sdp"] = data.get("sdp")
                    elif t in {"call_ice", "video_call_ice"}:
                        payload["candidate"] = data.get("candidate")

                    for participant_id in participants:
                        if participant_id != user_id:
                            await hub.send(participant_id, payload)

                            if t == "call_offer":
                                try:
                                    caller = await get_user_public(user_id)
                                    await _send_expo_push(
                                        participant_id,
                                        "voice_call",
                                        {
                                            "from_user_id": user_id,
                                            "from_name": (
                                                caller.get("display_name")
                                                if caller
                                                else "Nexus User"
                                            ),
                                            "conversation_id": conv_id,
                                        },
                                    )
                                except Exception as e:
                                    logger.warning(
                                        "Voice call push failed: %s",
                                        e,
                                    )

                            elif t == "video_call_offer":
                                try:
                                    caller = await get_user_public(user_id)
                                    await _send_expo_push(
                                        participant_id,
                                        "video_call",
                                        {
                                            "from_user_id": user_id,
                                            "from_name": (
                                                caller.get("display_name")
                                                if caller
                                                else "Nexus User"
                                            ),
                                            "conversation_id": conv_id,
                                        },
                                    )
                                except Exception as e:
                                    logger.warning(
                                        "Video call push failed: %s",
                                        e,
                                    )

            elif t == "ping":
                await ws.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.exception("ws error: %s", e)
    finally:
        await hub.disconnect(user_id, ws)


# ── Admin ──────────────────────────────────────────────────────────────────────
ADMIN_EMAIL = "smdkawsar2@gmail.com"

# Optional: set ADMIN_USER_ID in environment to pin admin to a specific user_id.
# This is the most stable/secure option. Get your user_id from /api/auth/me after
# first login, then set: ADMIN_USER_ID=usr_xxxxxxxxxxxxxxxx in your .env file.
# If not set, falls back to email matching (safe once admin account is registered,
# because email has a UNIQUE DB constraint — no other account can hold it).
_ADMIN_USER_ID = os.environ.get("ADMIN_USER_ID", "").strip()

VALID_BADGE_TYPES = {"blue", "gold", "gray"}


async def require_admin(user: dict = Depends(current_user)) -> dict:
    """
    Dependency that rejects any non-admin request with 403.

    Two-layer check:
    1. If ADMIN_USER_ID env var is set → check user_id (most stable).
    2. Otherwise → fall back to email match (safe once admin account exists,
       because email is unique in DB and fetched server-side, not from JWT).
    """
    if _ADMIN_USER_ID:
        if user.get("user_id") != _ADMIN_USER_ID:
            raise HTTPException(status_code=403, detail="Admin access required")
    else:
        if user.get("email", "").strip().lower() != ADMIN_EMAIL.lower():
            raise HTTPException(status_code=403, detail="Admin access required")
    return user


class BadgeBody(BaseModel):
    badge_type: Optional[str] = None  # None = remove badge


@api.get("/admin/users")
async def admin_list_users(
    q: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    _admin: dict = Depends(require_admin),
):
    """List all users (admin). Optional ?q= filters by username/display_name/email."""
    query = sb.table("users").select(
        "user_id,email,username,display_name,profile_picture,bio,badge_type,online,created_at,email_verified"
    )
    if q:
        # ilike search across multiple columns
        query = query.or_(
            f"username.ilike.%{q}%,display_name.ilike.%{q}%,email.ilike.%{q}%"
        )
    r = await run(lambda: query.order("created_at", desc=True).limit(limit).execute())
    return {"users": r.data or [], "total": len(r.data or [])}


@api.get("/admin/users/{user_id}")
async def admin_get_user(
    user_id: str,
    _admin: dict = Depends(require_admin),
):
    """Get full (public) details for any user (admin)."""
    r = await run(lambda: sb.table("users").select(
        "user_id,email,username,display_name,profile_picture,cover_picture,bio,"
        "badge_type,online,last_seen,created_at,email_verified,is_private,provider,"
        "moderation_status,moderation_reason,moderation_reason_code,moderated_at"
    ).eq("user_id", user_id).execute())
    if not r.data:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": r.data[0]}


@api.get("/admin/users/{user_id}/reset-token")
async def admin_get_reset_token(
    user_id: str,
    _admin: dict = Depends(require_admin),
):
    """Get the pending password reset token for a user (admin only).
    Used to manually deliver the token to the user when email is not configured."""
    r = await run(lambda: sb.table("users")
        .select("user_id,email,username,password_reset_token,password_reset_expiry")
        .eq("user_id", user_id).execute())
    if not r.data:
        raise HTTPException(status_code=404, detail="User not found")
    u = r.data[0]
    tok = u.get("password_reset_token")
    exp = parse_ts(u.get("password_reset_expiry"))
    if not tok:
        return {"reset_token": None, "expired": False, "message": "No pending reset token"}
    expired = bool(exp and exp < now_utc())
    return {"reset_token": tok, "expired": expired, "expires_at": u.get("password_reset_expiry")}


@api.put("/admin/users/{user_id}/badge")
async def admin_set_badge(
    user_id: str,
    body: BadgeBody,
    _admin: dict = Depends(require_admin),
):
    """Assign or remove a verification badge from a user (admin only)."""
    badge = body.badge_type
    if badge is not None and badge not in VALID_BADGE_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid badge type. Valid: {sorted(VALID_BADGE_TYPES)}")
    # Verify user exists
    ur = await run(lambda: sb.table("users").select("user_id").eq("user_id", user_id).execute())
    if not ur.data:
        raise HTTPException(status_code=404, detail="User not found")
    badge_update = {
        "badge_type": badge,
        "verified_since": ts(now_utc()) if badge is not None else None,
    }
    await run(lambda: sb.table("users").update(badge_update).eq("user_id", user_id).execute())
    return {"ok": True, "badge_type": badge, "verified_since": badge_update["verified_since"]}



ADMIN_MODERATION_REASONS = {
    "spam_abuse": "Spam or abusive activity",
    "harassment": "Harassment or harmful behavior",
    "community_violation": "Violation of Nexus community rules",
}


class AdminModerationBody(BaseModel):
    reason_code: Optional[str] = None
    custom_reason: Optional[str] = None


async def admin_moderate_user(
    user_id: str,
    status: str,
    body: AdminModerationBody,
    admin: dict,
):
    if user_id == admin["user_id"]:
        raise HTTPException(
            status_code=400,
            detail="Admin cannot suspend or ban their own account",
        )

    ur = await run(
        lambda: sb.table("users")
        .select("user_id,username,display_name,moderation_status")
        .eq("user_id", user_id)
        .execute()
    )
    if not ur.data:
        raise HTTPException(status_code=404, detail="User not found")

    reason_code = (body.reason_code or "").strip() or None
    custom_reason = (body.custom_reason or "").strip()

    if reason_code and reason_code not in ADMIN_MODERATION_REASONS:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Invalid reason_code",
                "valid_reasons": ADMIN_MODERATION_REASONS,
            },
        )

    reason = custom_reason or (
        ADMIN_MODERATION_REASONS.get(reason_code)
        if reason_code
        else None
    )

    if not reason:
        raise HTTPException(
            status_code=400,
            detail="Choose a reason_code or provide custom_reason",
        )

    update = {
        "moderation_status": status,
        "moderation_reason": reason,
        "moderation_reason_code": reason_code or "custom",
        "moderated_at": ts(now_utc()),
        "moderated_by": admin["user_id"],
        "online": False,
    }

    await run(
        lambda: sb.table("users")
        .update(update)
        .eq("user_id", user_id)
        .execute()
    )

    await _send_expo_push(
        user_id,
        "account_moderated",
        {
            "status": status,
            "reason": reason,
            "reason_code": update["moderation_reason_code"],
        },
    )

    return {
        "ok": True,
        "user_id": user_id,
        "status": status,
        "reason": reason,
        "reason_code": update["moderation_reason_code"],
        "moderated_at": update["moderated_at"],
    }


@api.get("/admin/moderation/reasons", tags=["Admin Moderation"])
async def admin_moderation_reasons(
    _admin: dict = Depends(require_admin),
):
    """Show the 3 predefined moderation reasons."""
    return {"reasons": ADMIN_MODERATION_REASONS}


@api.put("/admin/users/{user_id}/suspend", tags=["Admin Moderation"])
async def admin_suspend_user(
    user_id: str,
    body: AdminModerationBody,
    admin: dict = Depends(require_admin),
):
    """Suspend a user until an admin restores the account."""
    return await admin_moderate_user(
        user_id, "suspended", body, admin
    )


@api.put("/admin/users/{user_id}/ban", tags=["Admin Moderation"])
async def admin_ban_user(
    user_id: str,
    body: AdminModerationBody,
    admin: dict = Depends(require_admin),
):
    """Ban a user until an admin restores the account."""
    return await admin_moderate_user(
        user_id, "banned", body, admin
    )


@api.put("/admin/users/{user_id}/restore", tags=["Admin Moderation"])
async def admin_restore_user(
    user_id: str,
    admin: dict = Depends(require_admin),
):
    """Remove suspension or ban and restore normal account access."""
    ur = await run(
        lambda: sb.table("users")
        .select("user_id,moderation_status")
        .eq("user_id", user_id)
        .execute()
    )
    if not ur.data:
        raise HTTPException(status_code=404, detail="User not found")

    await run(
        lambda: sb.table("users")
        .update({
            "moderation_status": "active",
            "moderation_reason": None,
            "moderation_reason_code": None,
            "moderated_at": None,
            "moderated_by": admin["user_id"],
        })
        .eq("user_id", user_id)
        .execute()
    )

    reviewed_at = ts(now_utc())

    await run(
        lambda: sb.table("appeals")
        .update({
            "status": "approved",
            "reviewed_at": reviewed_at,
            "reviewed_by": admin["user_id"],
        })
        .eq("user_id", user_id)
        .eq("status", "pending")
        .execute()
    )

    await _send_expo_push(
        user_id,
        "account_restored",
        {
            "status": "active",
        },
    )

    return {
        "ok": True,
        "user_id": user_id,
        "status": "active",
        "message": "Account restored successfully",
    }


@api.get("/admin/users/{user_id}/appeals", tags=["Admin Appeals"])
async def admin_get_user_appeals(
    user_id: str,
    _admin: dict = Depends(require_admin),
):
    r = await run(
        lambda: sb.table("appeals")
        .select(
            "appeal_id,user_id,name,email,message,suspension_reason,"
            "status,created_at,reviewed_at,reviewed_by"
        )
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )

    appeals = r.data or []

    return {
        "appeals": appeals,
        "total": len(appeals),
        "pending": next(
            (a for a in appeals if a.get("status") == "pending"),
            None,
        ),
        "appeals_remaining": max(0, 2 - len(appeals)),
    }


@api.put("/admin/appeals/{appeal_id}/reject", tags=["Admin Appeals"])
async def admin_reject_appeal(
    appeal_id: str,
    admin: dict = Depends(require_admin),
):
    r = await run(
        lambda: sb.table("appeals")
        .select("appeal_id,user_id,status")
        .eq("appeal_id", appeal_id)
        .execute()
    )

    if not r.data:
        raise HTTPException(status_code=404, detail="Appeal not found")

    appeal = r.data[0]

    if appeal.get("status") != "pending":
        raise HTTPException(
            status_code=400,
            detail="Only a pending appeal can be rejected",
        )

    reviewed_at = ts(now_utc())

    await run(
        lambda: sb.table("appeals")
        .update({
            "status": "rejected",
            "reviewed_at": reviewed_at,
            "reviewed_by": admin["user_id"],
        })
        .eq("appeal_id", appeal_id)
        .execute()
    )

    return {
        "ok": True,
        "appeal_id": appeal_id,
        "user_id": appeal["user_id"],
        "status": "rejected",
        "reviewed_at": reviewed_at,
        "message": "Appeal rejected",
    }


@api.get("/admin/users/{user_id}/moderation", tags=["Admin Moderation"])
async def admin_get_user_moderation(
    user_id: str,
    _admin: dict = Depends(require_admin),
):
    """View a user's current moderation status and reason."""
    r = await run(
        lambda: sb.table("users")
        .select(
            "user_id,username,display_name,moderation_status,"
            "moderation_reason,moderation_reason_code,"
            "moderated_at,moderated_by"
        )
        .eq("user_id", user_id)
        .execute()
    )
    if not r.data:
        raise HTTPException(status_code=404, detail="User not found")

    return {"moderation": r.data[0]}


# ── Startup ────────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    # Ensure badge_type column exists (graceful check on startup)
    try:
        await run(lambda: sb.table("users").select("badge_type").limit(1).execute())
        logger.info("badge_type column ✅")
    except Exception:
        logger.warning(
            "⚠️  badge_type column missing. Run in Supabase SQL Editor:\n"
            "    ALTER TABLE users ADD COLUMN IF NOT EXISTS badge_type TEXT DEFAULT NULL;"
        )
    # Log admin config status for first-run setup
    if _ADMIN_USER_ID:
        logger.info("Admin locked to user_id: %s", _ADMIN_USER_ID)
    else:
        logger.info(
            "Admin access: email-based (%s). "
            "For stronger binding set ADMIN_USER_ID=<your_user_id> in .env "
            "(get it from GET /api/auth/me after logging in).",
            ADMIN_EMAIL,
        )
    logger.info("XYTEEE Nexus API ready — Supabase backend")


@api.get("/")
async def root():
    return {"app": "XYTEEE Nexus", "ok": True}


@app.get("/admin/openapi.json", include_in_schema=False)
async def admin_openapi():
    admin_routes = [
        route
        for route in app.routes
        if getattr(route, "path", "").startswith("/api/admin/")
    ]

    return get_openapi(
        title="XYTEEE Nexus Admin Panel",
        version="1.0.0",
        description="Private administration controls for XYTEEE Nexus.",
        routes=admin_routes,
    )


@app.get("/admin/docs", include_in_schema=False)
async def admin_swagger_docs():
    return get_swagger_ui_html(
        openapi_url="/admin/openapi.json",
        title="XYTEEE Nexus Admin Panel",
        swagger_ui_parameters={
            "persistAuthorization": True,
            "displayRequestDuration": True,
            "filter": True,
            "tryItOutEnabled": True,
        },
    )


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Push Notification Token ──────────────────────────────────────────

class PushTokenIn(BaseModel):
    expo_push_token: str
    device_name: Optional[str] = ""

@api.post("/push-token")
async def save_push_token(body: PushTokenIn, user=Depends(current_user)):
    doc = {
        "user_id": user["user_id"],
        "expo_push_token": body.expo_push_token,
        "device_name": body.device_name or "",
        "updated_at": ts(now_utc()),
    }

    await run(
        lambda: sb.table("push_tokens")
        .upsert(doc, on_conflict="user_id,expo_push_token")
        .execute()
    )

    return {"ok": True}

# Include API router only after every @api route has been registered.
app.include_router(api)
