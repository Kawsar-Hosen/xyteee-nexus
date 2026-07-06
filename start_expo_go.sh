#!/bin/bash
# XYTEEE Nexus — Expo Go launcher (tunnel mode)
#
# This script starts the Expo dev server with a public tunnel URL so you can
# scan the QR code with Expo Go on any device (no same-network requirement).
#
# Prerequisites:
#   1. Install Expo Go on your iOS or Android device.
#   2. Make sure the BACKEND is running (bash start_backend.sh in another tab).
#
# Usage:
#   bash start_expo_go.sh
#
# The backend URL for Expo Go builds is set from the public Replit dev domain.
# Expo will print a QR code — scan it with Expo Go.

set -e

echo "[expo-go] Deriving backend URL for native..."
# The proxy runs on port 5000 (public Replit URL). Native Expo Go can reach it.
if [ -n "$REPLIT_DEV_DOMAIN" ]; then
  export EXPO_PUBLIC_BACKEND_URL="https://$REPLIT_DEV_DOMAIN"
  echo "[expo-go] EXPO_PUBLIC_BACKEND_URL=$EXPO_PUBLIC_BACKEND_URL"
else
  echo "[expo-go] REPLIT_DEV_DOMAIN not set — EXPO_PUBLIC_BACKEND_URL will be empty"
fi

cd /home/runner/workspace/frontend

echo "[expo-go] Starting Expo with tunnel (Expo Go compatible)..."
echo "[expo-go] Scan the QR code that appears below with Expo Go."
exec npx expo start --tunnel
