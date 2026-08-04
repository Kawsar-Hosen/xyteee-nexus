#!/bin/bash
# XYTEEE Nexus - local UI launcher (Railway backend)
#
# Architecture (single public port = 5000):
#   browser -> :5000 (proxy.js) -> :5001 Expo web dev server
#   API and WebSocket requests go directly to EXPO_PUBLIC_BACKEND_URL.

set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "[frontend] Starting reverse proxy on :5000..."
setsid nohup node "$ROOT_DIR/proxy.js" > /tmp/proxy.log 2>&1 < /dev/null &
echo "[frontend] Proxy PID: $!"

sleep 1

echo "[frontend] Checking node_modules..."
cd "$ROOT_DIR/frontend"
if [ ! -d "node_modules" ] || [ ! -d "node_modules/expo-router" ]; then
  echo "[frontend] Installing dependencies (please wait)..."
  npm install --legacy-peer-deps
fi

echo "[frontend] Starting Expo web on :5001..."
setsid nohup npx expo start --web --port 5001 > /tmp/frontend.log 2>&1 < /dev/null &
echo "[frontend] Expo PID: $!"
echo "[frontend] App: http://localhost:5000"
