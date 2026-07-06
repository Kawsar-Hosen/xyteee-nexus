---
name: Proxy architecture
description: How the XYTEEE Nexus dev server is structured on Replit to expose both frontend and backend through one public port.
---

**Architecture:**
- `proxy.js` (Node.js, no npm deps) listens on port 5000 (the webview port)
  - `/api/*` → `localhost:8000` (FastAPI backend)
  - `/*` → `localhost:5001` (Expo web dev server)
  - WebSocket upgrades handled for both `/api/ws` (realtime) and Expo HMR
- Backend runs on port 8000 (internal only)
- Expo runs on port 5001 (internal only)

**Frontend URL strategy:**
- `frontend/src/api/client.ts`: `BASE = isWeb ? "" : EXPO_PUBLIC_BACKEND_URL`
- `frontend/src/context/WsContext.tsx`: on web, derives `wss://` from `window.location`
- Result: all API calls use relative paths on web → proxy handles routing

**Why:** Replit's browser proxy only exposes the webview port. Using relative URLs avoids cross-origin requests entirely.
