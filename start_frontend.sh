#!/bin/bash
# XYTEEE Nexus – frontend + proxy launcher
#
# Architecture (single public port = 5000):
#   browser → :5000 (proxy.js)
#               ├─ /api/*  → :8000  FastAPI backend
#               └─ /*      → :5001  Expo web dev server

set -e

echo "[frontend] Starting reverse proxy on :5000..."
node /home/runner/workspace/proxy.js &
PROXY_PID=$!

sleep 1

echo "[frontend] Checking node_modules..."
cd /home/runner/workspace/frontend
if [ ! -d "node_modules" ] || [ ! -d "node_modules/expo-router" ]; then
  echo "[frontend] Installing dependencies (please wait)..."
  yarn install 2>&1 || true
fi

echo "[frontend] Starting Expo web on :5001..."
export CI=1
exec npx expo start --web --port 5001
