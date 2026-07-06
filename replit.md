# XYTEEE Nexus

A real-time social chat platform with a FastAPI backend and React Native/Expo frontend.

## Stack

- **Backend**: Python / FastAPI + MongoDB (via Motor async driver), JWT auth, WebSockets
- **Frontend**: React Native / Expo (runs in browser via `expo start --web`)

## Running on Replit

Two workflows are configured:

| Workflow | Command | Port |
|---|---|---|
| Start Backend | `bash start_backend.sh` | 8000 (console) |
| Start application | `bash start_frontend.sh` | 5000 (webview) |

The frontend auto-discovers the backend URL from `REPLIT_DEV_DOMAIN` at startup.

## Required Secrets

Set these in Replit Secrets before starting:

- `MONGO_URL` — MongoDB Atlas connection string
- `JWT_SECRET` — secret key for signing JWTs (any long random string)
- `DB_NAME` — MongoDB database name (env var, not a secret)

## Architecture

- All API calls go through `EXPO_PUBLIC_BACKEND_URL + /api`
- WebSocket at `/api/ws`
- Backend CORS is open (`allow_origins=["*"]`) for development

## User preferences

(none yet)
