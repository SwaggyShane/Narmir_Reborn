# Narmir Reborn Account Management

**Last Updated:** 2026-06-30

This guide only documents account features that are present in the current codebase.

---

## Register

`POST /api/auth/register`

Required fields:
- `username`
- `password`
- `kingdomName`
- `email`

Validation:
- username: 3-20 characters, letters/numbers/underscores only
- password: minimum 8 characters and must include uppercase, lowercase, number, and `@$!%*?&`
- kingdom name: 3-50 characters, letters/numbers/spaces/apostrophes/hyphens only
- race: one of `human`, `high_elf`, `dwarf`, `dire_wolf`, `dark_elf`, `orc`, `vampire`, `wood_elf`, `ogre`
- gender: `male` or `female`

On success the server:
- creates the player
- creates the starting kingdom
- issues a JWT auth cookie
- issues a CSRF cookie

---

## Login

`POST /api/auth/login`

Required fields:
- `username`
- `password`

Behavior:
- verifies bcrypt password hash
- rejects banned accounts
- issues a JWT auth cookie
- issues a CSRF cookie

JWT lifetime:
- 30 days

---

## Logout

`POST /api/auth/logout`

Clears:
- `token`
- `csrf_token`

---

## Force Logout

`POST /api/auth/force-logout`

Clears auth cookies using multiple cookie option variants so stale browser state is more reliably removed.

---

## Current Session

`GET /api/auth/me`

Returns:
- `playerId`
- `username`
- `isAdmin`

Auth can be provided by:
- httpOnly `token` cookie
- `Authorization: Bearer <token>`
- `x-auth-token`

---

## Security Notes

Implemented:
- bcrypt password hashing
- JWT authentication
- secure cookies in production
- CSRF token cookie + route protection on mutating endpoints
- HTTPS enforcement in production

Not documented as current features because they are not present in the codebase:
- two-factor authentication
- password reset flow
- email verification flow
- active session management UI
- self-service account deletion flow
- billing or premium account management

---

## Admin Bootstrap

Admin access is controlled separately from normal account login.

Relevant server secret:
- `ADMIN_SECRET`

---

## Reference

Primary code:
- [routes/auth.js](C:\Users\king_\Narmir_Reborn\routes\auth.js)
- [routes/middleware.js](C:\Users\king_\Narmir_Reborn\routes\middleware.js)
- [index.js](C:\Users\king_\Narmir_Reborn\index.js)
