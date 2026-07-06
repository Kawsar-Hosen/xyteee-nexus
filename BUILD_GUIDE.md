# XYTEEE Nexus — Build Guide

## 1. Expo Go (Preview on Device — Easiest)

Scan the QR code with the **Expo Go** app on your phone.

```bash
# In Replit Shell (separate from the main workflows):
bash start_expo_go.sh
```

This starts Expo in tunnel mode so any device can connect (no same-network requirement).

---

## 2. APK / AAB Build (EAS Build)

EAS Build runs in Expo's cloud — you get a downloadable APK or AAB without needing Android Studio.

### One-time setup

```bash
# 1. Create a free account at https://expo.dev

# 2. Install EAS CLI
npm install -g eas-cli

# 3. Log in
eas login

# 4. Link this project
cd frontend
eas build:configure
```

### Build APK (sideload / test)

```bash
cd frontend
eas build --platform android --profile preview
```

Produces a signed **APK** you can download and install directly on any Android device.

### Build AAB (Google Play Store upload)

```bash
cd frontend
eas build --platform android --profile production
```

Produces a **AAB** for uploading to Google Play Console.

### Build for iOS

```bash
cd frontend
eas build --platform ios --profile production
```

Requires an Apple Developer account ($99/year).

---

## 3. App Details

| Field | Value |
|---|---|
| App name | XYTEEE Nexus |
| Android package | `com.xyteee.nexus` |
| iOS bundle ID | `com.xyteee.nexus` |
| Version | 1.0.0 |
| EAS config | `frontend/eas.json` |

---

## 4. Database Migration (one-time, before using Admin Panel)

Run this SQL in your **Supabase SQL Editor** (Dashboard → SQL Editor → New Query):

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS badge_type TEXT DEFAULT NULL;
```

This adds the verification badge field required by the Admin Panel.
