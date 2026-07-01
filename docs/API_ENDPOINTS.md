# Narmir Reborn API Endpoints

**Last Updated:** 2026-06-30

This document is a concise route map for the current codebase. When this file and the route files disagree, treat the route files as truth.

Base API prefix:
- production: `/api`
- local dev: `http://localhost:3000/api`

Auth model:
- JWT cookie or `Authorization: Bearer <token>`
- mutating routes generally require CSRF protection

---

## Authentication

Route file:
- [routes/auth.js](C:\Users\king_\Narmir_Reborn\routes\auth.js)

Endpoints:
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/force-logout`
- `GET /auth/me`

Example:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"demo\",\"password\":\"DemoPass1!\"}"
```

---

## Kingdom Profile

Route file:
- [routes/kingdom-profile.js](C:\Users\king_\Narmir_Reborn\routes\kingdom-profile.js)

Endpoints:
- `GET /kingdom/me`
- `POST /kingdom/description`
- `GET /kingdom/rankings`
- `GET /kingdom/alliance-rankings`

---

## Core Kingdom Gameplay

Primary route file:
- [routes/kingdom-gameplay.js](C:\Users\king_\Narmir_Reborn\routes\kingdom-gameplay.js)

Key endpoints:
- `GET /kingdom/chat/global`
- `GET /kingdom/news/list`
- `DELETE /kingdom/news/clear`
- `POST /kingdom/turn`
- `POST /kingdom/hire`
- `POST /kingdom/build-queue`
- `GET /kingdom/training-allocation`
- `POST /kingdom/training-allocation`
- `POST /kingdom/build-allocation`
- `POST /kingdom/resource-build-allocation`
- `POST /kingdom/demolish`
- `POST /kingdom/build`
- `POST /kingdom/cancel-building`
- `POST /kingdom/smithy/forge-tools`
- `POST /kingdom/smithy/buy-hammers`
- `POST /kingdom/smithy/buy-scaffolding`
- `POST /kingdom/smithy-allocation`
- `POST /kingdom/search`
- `POST /kingdom/tower-craft`
- `POST /kingdom/tower-cancel`
- `POST /kingdom/shrine-allocation`
- `POST /kingdom/mausoleum-allocation`
- `POST /kingdom/buy-mausoleum-upgrade`
- `POST /kingdom/library-allocation`
- `POST /kingdom/options`
- `GET /kingdom/season`
- `GET /kingdom/locations`
- `GET /kingdom/profile/:name`
- `GET /kingdom/world-map`
- `POST /kingdom/rebirth`
- `GET /kingdom/lore-and-achievements`
- `GET /kingdom/resource-nodes`
- `GET /kingdom/resource-expeditions`
- `POST /kingdom/scout-node`
- `POST /kingdom/resource-upgrade`
- `GET /kingdom/inventory`
- `GET /kingdom/attunements`
- `GET /kingdom/available-attunements`
- `POST /kingdom/attune-fragment`
- `POST /kingdom/remove-attunement`
- `GET /kingdom/contributing-synergies`
- `GET /kingdom/synergy-status`
- `GET /kingdom/synergy-cooldown`
- `POST /kingdom/activate-synergy-ability`
- `POST /kingdom/portrait`
- `DELETE /kingdom/portrait`
- `GET /kingdom/happiness-status`
- `GET /kingdom/happiness-events`

Example:

```bash
curl -X POST http://localhost:3000/api/kingdom/turn \
  -H "Authorization: Bearer <token>" \
  -H "X-CSRF-Token: <csrf>" \
  -H "Content-Type: application/json" \
  -d "{}"
```

---

## Exploration and Goals

Route file:
- [routes/kingdom-exploration.js](C:\Users\king_\Narmir_Reborn\routes\kingdom-exploration.js)

Endpoints:
- `POST /kingdom/expedition/start`
- `GET /kingdom/expedition/list`
- `POST /kingdom/expedition/acknowledge`
- `POST /kingdom/expedition/cancel`
- `DELETE /kingdom/expedition/clear-all`
- `GET /kingdom/goals`
- `POST /kingdom/goals/claim`

Additional expedition-related gameplay endpoints also exist in:
- [routes/kingdom-gameplay.js](C:\Users\king_\Narmir_Reborn\routes\kingdom-gameplay.js)

Example:

```bash
curl -X GET http://localhost:3000/api/kingdom/expedition/list \
  -H "Authorization: Bearer <token>"
```

---

## Research

Route file:
- [routes/kingdom-research.js](C:\Users\king_\Narmir_Reborn\routes\kingdom-research.js)

Endpoints:
- `POST /kingdom/research-allocation`
- `POST /kingdom/research`
- `POST /kingdom/select-school`
- `GET /kingdom/studies/overview`

---

## Warfare

Route file:
- [routes/kingdom-warfare.js](C:\Users\king_\Narmir_Reborn\routes\kingdom-warfare.js)

Endpoints:
- `GET /kingdom/war-log`
- `GET /kingdom/war-log/:id`
- `POST /kingdom/attack`
- `POST /kingdom/spell`
- `POST /kingdom/covert`
- `GET /kingdom/defense/overview`
- `GET /kingdom/spy-reports`
- `POST /kingdom/spy-reports/:id/share`
- `GET /kingdom/spy-reports/alliance`

---

## Economy

Route file:
- [routes/kingdom-economy.js](C:\Users\king_\Narmir_Reborn\routes\kingdom-economy.js)

Common surfaces documented in the codebase:
- market pricing
- market buy/sell
- economy overview
- trade routes
- mercenaries
- banking
- trade offers
- economy upgrades

Use the route file as truth for the exact current path list.

---

## Forum

Route file:
- [routes/forum.js](C:\Users\king_\Narmir_Reborn\routes\forum.js)

Public:
- `GET /forum/index`
- `GET /forum/boards`
- `GET /forum/boards/:boardId/topics`
- `GET /forum/topics/:topicId/posts`

Authenticated:
- `GET /forum/profile`
- `PATCH /forum/profile`
- `POST /forum/topics`
- `POST /forum/topics/:topicId/posts`
- `PATCH /forum/posts/:postId`
- `DELETE /forum/posts/:postId`
- `DELETE /forum/topics/:topicId`

Moderation and admin:
- `GET /forum/admin/moderators`
- `GET /forum/admin/bans`
- `GET /forum/admin/logs`
- `POST /forum/admin/moderators`
- `DELETE /forum/admin/moderators/:modId`
- `POST /forum/moderation/ban-user`
- `DELETE /forum/moderation/bans/:banId`
- `POST /forum/moderation/hide-post`
- `POST /forum/reports`
- `GET /forum/moderation/queue`
- `PATCH /forum/moderation/reports/:reportId`

---

## Heroes

Route file:
- [routes/hero.js](C:\Users\king_\Narmir_Reborn\routes\hero.js)

Endpoints:
- `GET /hero/list`
- `GET /hero/classes`
- `GET /hero/all-classes`
- `POST /hero/recruit`

---

## Discord

Route file:
- [routes/discord.js](C:\Users\king_\Narmir_Reborn\routes\discord.js)

Endpoints:
- `POST /discord/link-discord`
- `POST /discord/unlink-discord`
- `GET /discord/link-status`
- `POST /discord/verify-token`
- `POST /discord/admin/configure-channel`
- `POST /discord/admin/toggle-channel`
- `GET /discord/admin/configs`
- `GET /discord/admin/linked-users`

---

## Admin

Route file:
- [routes/admin.js](C:\Users\king_\Narmir_Reborn\routes\admin.js)

Major endpoint groups:
- kingdom management
- bans and chat moderation
- announcements
- AI controls
- config and cache flush tools
- events and wishlist
- lore and sounds
- goals
- repair tools
- security audit tools
- audit notification settings
- audit history

Representative endpoints:
- `GET /admin/kingdoms`
- `GET /admin/stats`
- `POST /admin/ban`
- `POST /admin/unban`
- `POST /admin/reset-kingdom`
- `POST /admin/set-kingdom`
- `POST /admin/announce`
- `GET /admin/config`
- `POST /admin/config`
- `POST /admin/security-audit`
- `POST /admin/security-audit-full`
- `POST /admin/security-audit/sql-injection`
- `GET /admin/security-audit/sql-injection/status`

Example:

```bash
curl -X GET http://localhost:3000/api/admin/stats \
  -H "Authorization: Bearer <admin-token>"
```

---

## Response Shape

Common patterns:

Success:

```json
{ "ok": true }
```

Data response:

```json
{ "rows": [], "count": 0 }
```

Error:

```json
{ "error": "Description of the problem" }
```

---

## Notes

- The codebase mixes cookie auth and bearer-token auth support.
- Mutating routes commonly require CSRF validation.
- Some older docs use broader or older path names; this file now prefers the current route modules over historical naming.
