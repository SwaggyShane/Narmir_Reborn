# Narmir Reborn API Documentation

All endpoints require authentication via JWT cookie/token and CSRF validation where indicated.

## Base URL

- **Production:** `https://narmirreborn.com/api`
- **Development:** `http://localhost:3000/api`

---

## Authentication (`/auth`)

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|----------------|
| POST | `/auth/register` | Create new account | No |
| POST | `/auth/login` | Login with credentials | No |
| GET | `/auth/me` | Get current user info | Yes |
| POST | `/auth/logout` | Logout | Yes |
| POST | `/auth/change-password` | Update password | Yes |

---

## Kingdom Profile (`/kingdom`)

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|----------------|
| GET | `/kingdom/me` | Get full kingdom state | Yes |
| GET | `/kingdom/rank` | Get kingdom rank/rating | Yes |
| GET | `/kingdom/profile/:kingdomId` | Get public kingdom info | No |
| POST | `/kingdom/update-tax` | Set kingdom tax rate | Yes |
| POST | `/kingdom/update-name` | Rename kingdom | Yes |

---

## Gameplay (`/`)

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|----------------|
| POST | `/turn` | Advance to next turn | Yes |
| GET | `/chat/global` | Get global chat messages | Yes |
| GET | `/news/list` | Get kingdom news feed | Yes |
| DELETE | `/news/clear` | Clear news badges | Yes |

---

## Building & Construction (`/`)

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|----------------|
| GET | `/training-allocation` | Get unit training config | Yes |
| POST | `/training-allocation` | Set training allocation | Yes |
| POST | `/build-allocation` | Set building allocation | Yes |
| POST | `/resource-build-allocation` | Set resource building allocation | Yes |
| POST | `/build-queue` | Queue building construction | Yes |
| POST | `/build` | Build single structure | Yes |
| POST | `/demolish` | Demolish structure | Yes |
| POST | `/cancel-building` | Cancel queued building | Yes |

---

## Military & Warfare (`/warfare`)

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|----------------|
| GET | `/warfare/targets` | Get list of attack targets | Yes |
| POST | `/warfare/search` | Search for specific target | Yes |
| POST | `/warfare/attack` | Attack another kingdom | Yes |
| GET | `/warfare/battle-reports` | Get battle history | Yes |
| GET | `/warfare/mercenaries` | Get hired mercenaries | Yes |
| POST | `/warfare/mercenary-action` | Hire/manage mercenaries | Yes |

---

## Research & Development (`/research`)

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|----------------|
| GET | `/research/status` | Get research progress | Yes |
| POST | `/research/allocate` | Adjust researcher allocation | Yes |
| POST | `/research/advance` | Complete research tech | Yes |

---

## Exploration (`/exploration`)

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|----------------|
| GET | `/expedition` | Get active expeditions | Yes |
| POST | `/expedition/start` | Launch exploration party | Yes |
| POST | `/expedition/recall` | Recall expedition early | Yes |

---

## Economy (`/economy`)

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|----------------|
| GET | `/economy/status` | Get economy overview | Yes |
| GET | `/economy/market` | Get market prices | Yes |
| POST | `/economy/market/buy` | Purchase resources | Yes |
| POST | `/economy/market/sell` | Sell resources | Yes |
| GET | `/goals` | Get active goals | Yes |
| POST | `/goals/claim` | Claim goal rewards | Yes |

---

## Forum (`/forum`)

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|----------------|
| GET | `/forum/boards` | Get forum categories | No |
| GET | `/forum/:boardId/threads` | Get board threads | No |
| GET | `/forum/thread/:threadId` | Get thread messages | No |
| POST | `/forum/thread/:threadId/reply` | Post message | Yes |
| POST | `/forum/thread` | Create new thread | Yes |

---

## Admin (`/admin`)

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|----------------|
| POST | `/admin/setup-admin` | Initial admin setup | No |
| GET | `/admin/dashboard` | Admin dashboard data | Yes (Admin) |
| POST | `/admin/announce` | Broadcast announcement | Yes (Admin) |

---

## Common Response Patterns

### Success Response
```json
{
  "ok": true,
  "data": { /* endpoint-specific data */ }
}
```

### Error Response
```json
{
  "error": "Description of error",
  "code": "ERROR_CODE"
}
```

### Authentication Error
```json
{
  "error": "Not authenticated",
  "code": "AUTH_REQUIRED"
}
```

---

## Common Query Parameters

- `limit` — Limit results (pagination)
- `offset` — Offset for pagination
- `sort` — Sort field name
- `order` — `asc` or `desc`

---

## Authentication Details

- **JWT Location:** `token` cookie (httpOnly) or `Authorization: Bearer <token>` header
- **CSRF Token:** Required for POST/PUT/DELETE; pass as `X-CSRF-Token` header or `_csrf` form field
- **Token Expiration:** Configurable via environment; typically 7 days
- **Session:** Survives server restarts via persistent JWT

---

## Rate Limiting

API endpoints are rate-limited. See `docs/API_RATE_LIMITING.md` for details.

---

## Websocket Events

Real-time updates via Socket.io:

- `kingdom:update` — Kingdom state changed
- `news:new` — New news event
- `chat:message` — Global chat message
- `battle:result` — Battle outcome received
- `turn:advanced` — Turn progression

---

## Deprecated Endpoints

None currently, but all internal endpoints subject to change before v1.0.

---

**Last Updated:** 2026-06-29  
**API Version:** Pre-beta  
**Status:** Subject to change
