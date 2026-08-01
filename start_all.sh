#!/bin/bash
# XYTEEE Nexus – one-command launcher
# Backend :8000, Frontend :5001, Proxy :5000
set -e

cd /root/nexus

echo "== Starting backend (:8000) =="
cd backend
if [ ! -d "venv" ]; then
  python3 -m venv venv
  source venv/bin/activate
  pip install -r requirements.txt
else
  source venv/bin/activate
fi
setsid nohup uvicorn server:app --host 0.0.0.0 --port 8000 --reload > /tmp/backend.log 2>&1 < /dev/null &
echo "  backend PID: $!"

cd /root/nexus

echo "== Starting frontend (:5001) =="
cd frontend
if [ ! -d "node_modules" ]; then
  npm install --legacy-peer-deps
fi
setsid nohup npx expo start --web --port 5001 > /tmp/frontend.log 2>&1 < /dev/null &
echo "  frontend PID: $!"

cd /root/nexus

echo "== Starting proxy (:5000) =="
setsid nohup node proxy.js > /tmp/proxy.log 2>&1 < /dev/null &
echo "  proxy PID: $!"

echo ""
echo "=========================================="
echo " App ready →  http://localhost:5000"
echo " API docs  →  http://localhost:8000/docs"
echo "=========================================="
