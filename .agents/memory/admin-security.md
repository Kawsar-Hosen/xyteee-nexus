---
name: Admin panel security
description: How the XYTEEE Nexus admin authorization works and why it is secure.
---

The `require_admin` FastAPI dependency checks `user.email.strip().lower() == ADMIN_EMAIL.lower()`.

**Why this is secure:**
- `user` is fetched from Supabase by the JWT-validated `user_id` (cannot be spoofed by client).
- Email is a server-side DB value, not taken from the JWT payload.
- The UNIQUE constraint on `users.email` prevents any other account from holding that email once registered.
- Therefore an attacker would need either the account password or the JWT_SECRET.

**How to apply:**
- Always normalize email comparison (strip + lower) when doing string-based checks.
- The `require_admin` dependency must be on EVERY admin endpoint via `Depends(require_admin)`.
