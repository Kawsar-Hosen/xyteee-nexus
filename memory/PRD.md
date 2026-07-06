# XYTEEE Nexus – Product Requirements Document

## Concept
XYTEEE Nexus is a real-time social chat platform with an original identity ("Obsidian + Liquid Gold" aesthetic, editorial serif + geometric sans typography, and a Floating Dynamic Island navigation instead of standard bottom tabs). It combines direct messaging, 24h stories ("reveries"), friend graph ("bonds"), and real-time presence.

## Stack
- **Frontend**: Expo SDK 54 (React Native), Expo Router file-based navigation
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Realtime**: Native WebSocket at `/api/ws?token=…`
- **Auth**: JWT email/password + Emergent-managed Google OAuth (`POST /api/auth/google/session`)
- **Storage**: `expo-secure-store` for tokens via `@/src/utils/storage`

## Design system
- Typography: Playfair Display (display) + Outfit (body) — both loaded from local .ttf files under `/assets/fonts`
- Palette: Obsidian dark (#070709) + Liquid Gold (#CFA876) with matched light-mode alternate
- Nav: Floating glassmorphic dock (Feed / Find / Nexus / Bonds / You)
- Every interactive element carries `testID` in kebab-case

## Core features (MVP)
1. **Auth** – email signup/login/logout, Google OAuth, forgot/reset password, change password, email-verification token, `expo-secure-store` session persistence, `/auth/me` autoload.
2. **Profile** – display name, username, bio, avatar (base64), cover (base64), private toggle, friend/story counts, relation status; edit + change password.
3. **Friend system** – send/accept/reject/cancel request, unfriend, block/unblock, real-time notifications when someone requests/accepts.
4. **Real-time 1:1 chat** – conversations auto-created via `POST /chats/open`; text + image messages; reply, edit, copy, delete-for-me, delete-for-everyone; typing indicator via WS; seen/delivered receipts (`read_by`/`delivered_to`); unread counter; per-chat search.
5. **Stories ("reveries")** – 24h photo stories with MongoDB TTL index, viewers list, view counter, delete, private flag; auto-broadcast to bonds via WS + notification.
6. **Notifications** – types: friend_request, friend_accepted, message, story; real-time via WS + REST list with mark-read.
7. **Search** – user search by username/display name.
8. **Settings** – edit profile, change password, blocked users, private toggle, dark/light theme toggle, signout.

## MongoDB collections
- `users`: user_id, email, username, display_name, bio, profile_picture, cover_picture, password_hash, provider, online, last_seen, is_private
- `user_sessions`: session_token, user_id, expires_at (TTL)
- `friend_requests`: request_id, from, to, status
- `friendships`: friendship_id, a, b (sorted pair)
- `blocks`: blocker, blocked
- `conversations`: conversation_id, participants, last_message, last_message_at
- `messages`: message_id, conversation_id, sender_id, content, kind, media, reply_to, edited, deleted_for_everyone, deleted_for[], read_by[], delivered_to[]
- `stories`: story_id, user_id, kind, media, caption, is_private, viewers[], expires_at (TTL)
- `notifications`: notif_id, user_id, kind, data, read, created_at

## Deferred / limitations
- Video / voice / file sharing UI is scaffolded but the media pipeline is base64-only (no cloud storage yet). Adding Cloudinary keys later enables video + larger media.
- Email delivery (verify + reset) is not wired to an ESP — tokens are returned inline in responses for MVP so flows can be exercised end-to-end. Add SendGrid/Resend to enable real emails.
- Push notifications are intentionally out of scope for MVP (Emergent-managed push can be added on user request).
