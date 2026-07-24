# XYTEEE Nexus

A real-time social chat platform with a FastAPI backend and React Native/Expo frontend.

## Stack

- **Backend**: Python / FastAPI + Supabase (PostgreSQL), JWT auth, WebSockets
- **Frontend**: React Native / Expo (web preview via `expo start --web`, mobile via EAS build)

## Running on Replit

Two workflows are configured:

| Workflow | Command | Port |
|---|---|---|
| Start Backend | `bash start_backend.sh` | 8000 (internal) |
| Start application | `bash start_frontend.sh` | 5000 (webview, proxied) |

The proxy on port 5000 routes `/api/*` → backend:8000 and `/*` → Expo:5001.

## Required Secrets

Set these in Replit Secrets before starting:

| Secret | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL (`https://xxxx.supabase.co`) |
| `SUPABASE_SERVICE_KEY` | Supabase service-role key |
| `JWT_SECRET` | Secret key for signing JWTs (any long random string) |
| `SESSION_SECRET` | Session secret (optional, used by some middleware) |
| `GEMINI_API_KEY` | Google Gemini API key for AI chat assistant |

## Chat UI

The chat screen (`frontend/app/chat/[id].tsx`) has been upgraded for clarity on all phone sizes:
- Responsive bubble width (78% of screen, max 320 px) via `useWindowDimensions`
- WhatsApp-style bubble tails (flat corner on the send/receive side)
- Larger font (15 px / 22 line-height) and cleaner timestamps
- Sent bubble glow shadow using the gold accent colour
- Elevated input bar with top border; send button with shadow
- Header with `flexShrink` on name so long names never overflow icons

## Building the APK

See `BUILD_GUIDE.md` for EAS build instructions (APK / AAB / iOS).

One-time DB migration required in Supabase SQL Editor:
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS badge_type TEXT DEFAULT NULL;
```

## Architecture

- All API calls go through `/api` (relative URLs on web, via reverse proxy)
- WebSocket at `/api/ws` — carries chat, typing, voice call, and video call signalling
- Backend CORS is open (`allow_origins=["*"]`) for development

## Call Signalling (WebSocket message types)

| Direction | Type | Payload |
|---|---|---|
| C→S→C | `call_offer` | `{conversation_id, sdp}` — audio call offer |
| C→S→C | `call_answer` | `{conversation_id, sdp}` |
| C→S→C | `call_ice` | `{conversation_id, candidate}` |
| C→S→C | `call_end` | `{conversation_id}` |
| C→S→C | `video_call_offer` | `{conversation_id, sdp}` — video call offer |
| C→S→C | `video_call_answer` | `{conversation_id, sdp}` |
| C→S→C | `video_call_ice` | `{conversation_id, candidate}` |
| C→S→C | `video_call_end` | `{conversation_id}` |

## User preferences

(none yet)
