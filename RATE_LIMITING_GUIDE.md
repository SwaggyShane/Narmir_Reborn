# API Rate Limiting & DDoS Protection

**Status:** Implemented and configured  
**Last Updated:** 2026-06-29  
**Environment:** Production and development

---

## Overview

Narmir Reborn uses a sliding-window, per-IP rate limiter with separate tiers for:

- authentication
- game mutations
- general API traffic
- admin routes

The active limits are driven by [config/rate-limiting.js](/C:/Users/king_/Narmir_Reborn/config/rate-limiting.js) and consumed by [index.js](/C:/Users/king_/Narmir_Reborn/index.js).

---

## Active Tiers

| Tier | Default limit | Window | Scope |
|---|---:|---:|---|
| Auth | 10/min prod, 60/min dev | 60s | `/api/auth` login and register mutations |
| Turn | 300/min | 60s | `/api/kingdom/*`, `/api/hero/*` |
| General | 500/min | 60s | general API traffic |
| Admin | 30/min prod, 120/min dev | 60s | `/api/admin/*` |

---

## Environment Variables

```bash
RATE_LIMIT_AUTH_MAX=10
RATE_LIMIT_AUTH_WINDOW_MS=60000

RATE_LIMIT_TURN_MAX=300
RATE_LIMIT_TURN_WINDOW_MS=60000

RATE_LIMIT_GENERAL_MAX=500
RATE_LIMIT_GENERAL_WINDOW_MS=60000

RATE_LIMIT_ADMIN_MAX=30
RATE_LIMIT_ADMIN_WINDOW_MS=60000

ADMIN_ALLOWED_IPS=203.0.113.1,203.0.113.2
```

Notes:

- `ADMIN_ALLOWED_IPS` acts as admin access control.
- If an admin IP is whitelisted, admin-route rate limiting is bypassed for `/api/admin/*`.
- The whitelist does not create a global bypass for unrelated gameplay routes.

---

## Middleware Behavior

### Authentication

- `authSensitiveLimiter` applies only to login and registration requests.

### Gameplay and hero routes

- `turnLimiter` protects `/api/kingdom/*` and `/api/hero/*`.
- This is the main spam-abuse protection for actions like turn advancement, warfare, hiring, and research.

### General API traffic

- `generalLimiter` is mounted globally.
- Whitelisted admin IPs bypass this limiter only when the request is for `/api/admin/*`.

### Admin routes

- `/api/admin/*` is protected by both IP allowlisting and an admin-specific limiter.
- If `ADMIN_ALLOWED_IPS` is empty, admin IP filtering is disabled.

---

## 429 Logging

In production, rate-limited requests are appended to:

`logs/rate-limits.log`

Each entry includes:

- timestamp
- status code
- normalized client IP
- HTTP method
- request URL
- limiter threshold and window

Development does not write this log file.

---

## Response Contract

Rate-limited requests return:

```json
{
  "error": "Too many requests — slow down"
}
```

Status code:

```text
429 Too Many Requests
```

---

## Operational Guidance

Watch for:

- sustained high `429` rates
- unusual concentration from a small IP set
- admin access attempts from non-whitelisted IPs
- response-time degradation during mutation bursts

If tuning is needed, change the environment variables rather than editing hardcoded values.

---

## Related Files

- [index.js](/C:/Users/king_/Narmir_Reborn/index.js)
- [config/rate-limiting.js](/C:/Users/king_/Narmir_Reborn/config/rate-limiting.js)
- [ROADMAP.md](/C:/Users/king_/Narmir_Reborn/ROADMAP.md)
