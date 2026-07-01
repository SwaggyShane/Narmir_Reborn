# Narmir Reborn API Endpoints

**Last Updated:** 2026-07-01

This document is a concise route map for the current codebase. When this file and the route files disagree, treat the route files as truth.

Base API prefix:
- production: `/api`
- local dev: `http://localhost:3000/api`

Auth model:
- JWT cookie or `Authorization: Bearer <token>`
- mutating routes generally require CSRF protection

> **Note on route precedence:** Several `/api/kingdom/*` routers are mounted on the same
> path prefix in `index.js`, in this order: `kingdom-build`, `kingdom-warfare`,
> `kingdom-economy`, `kingdom-research`, `kingdom-profile`, `kingdom-exploration`,
> `kingdom-gameplay`. Express matches the first router that defines a given path+method,
> so where two files define the same route, the earlier-mounted one wins and the later
> one is dead code. This is currently true for 16 routes duplicated between
> `kingdom-build.js` and `kingdom-gameplay.js` (e.g. `POST /build-queue`,
> `POST /build`, `POST /tower-craft`) and 1 duplicated between `kingdom-build.js` and
> `kingdom-research.js` (`POST /school-allocation`). This doc lists each route once,
> attributed to the file that actually handles it. See `TODO.md` for the follow-up
> cleanup item.

---

## Authentication

Route file:
- [routes/auth.js](../routes/auth.js)

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
- [routes/kingdom-profile.js](../routes/kingdom-profile.js)

Endpoints:
- `GET /kingdom/me`
- `POST /kingdom/description`
- `GET /kingdom/rankings`
- `GET /kingdom/alliance-rankings`

---

## Building and Allocation

Route file (mounted first — owns all routes listed below, see note above):
- [routes/kingdom-build.js](../routes/kingdom-build.js)

Endpoints:
- `POST /kingdom/build-queue`
- `GET /kingdom/training-allocation`
- `POST /kingdom/training-allocation`
- `POST /kingdom/build-allocation`
- `POST /kingdom/resource-build-allocation`
- `POST /kingdom/school-allocation`
- `POST /kingdom/demolish`
- `POST /kingdom/build`
- `POST /kingdom/cancel-building`
- `POST /kingdom/smithy/buy-hammers`
- `POST /kingdom/smithy/buy-scaffolding`
- `POST /kingdom/smithy-allocation`
- `POST /kingdom/tower-craft`
- `POST /kingdom/tower-cancel`
- `POST /kingdom/shrine-allocation`
- `POST /kingdom/mausoleum-allocation`
- `POST /kingdom/buy-mausoleum-upgrade`

---

## Core Kingdom Gameplay

Route file:
- [routes/kingdom-gameplay.js](../routes/kingdom-gameplay.js)

Key endpoints:
- `GET /kingdom/chat/global`
- `GET /kingdom/news/list`
- `DELETE /kingdom/news/clear`
- `POST /kingdom/turn`
- `POST /kingdom/hire`
- `POST /kingdom/smithy/forge-tools`
- `POST /kingdom/search`
- `POST /kingdom/library-allocation`
- `POST /kingdom/options`
- `GET /kingdom/season`
- `GET /kingdom/locations`
- `POST /kingdom/locations/steal-map`
- `POST /kingdom/hybrid-blueprint/get-buildings`
- `POST /kingdom/hybrid-blueprint/confirm-assignment`
- `POST /kingdom/assign-hybrid-blueprint`
- `GET /kingdom/profile/:name`
- `GET /kingdom/world-map`
- `POST /kingdom/rebirth`
- `GET /kingdom/lore-and-achievements`
- `GET /kingdom/resource-nodes`
- `GET /kingdom/resource-expeditions`
- `POST /kingdom/scout-node`
- `POST /kingdom/expedition/launch`
- `POST /kingdom/expedition/intercept`
- `GET /kingdom/expeditions/visible`
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

`kingdom-gameplay.js` also defines the 16 routes documented under **Building and
Allocation** above (owned there because `kingdom-build.js` mounts first) — see the
route precedence note.

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
- [routes/kingdom-exploration.js](../routes/kingdom-exploration.js)

Endpoints:
- `POST /kingdom/expedition/start`
- `GET /kingdom/expedition/list`
- `POST /kingdom/expedition/acknowledge`
- `POST /kingdom/expedition/cancel`
- `DELETE /kingdom/expedition/clear-all`
- `GET /kingdom/goals`
- `POST /kingdom/goals/claim`

Additional expedition-related gameplay endpoints also exist in:
- [routes/kingdom-gameplay.js](../routes/kingdom-gameplay.js) (`expedition/launch`, `expedition/intercept`, `expeditions/visible`)

Example:

```bash
curl -X GET http://localhost:3000/api/kingdom/expedition/list \
  -H "Authorization: Bearer <token>"
```

---

## Research

Route file:
- [routes/kingdom-research.js](../routes/kingdom-research.js)

Endpoints:
- `POST /kingdom/research-allocation`
- `POST /kingdom/research`
- `POST /kingdom/research-focus`
- `GET /kingdom/studies/overview`
- `POST /kingdom/select-school`

`school-allocation` is defined here too but is dead code — `kingdom-build.js` owns it
(see route precedence note).

---

## Warfare

Route file:
- [routes/kingdom-warfare.js](../routes/kingdom-warfare.js)

Endpoints:
- `GET /kingdom/war-log`
- `GET /kingdom/war-log/:id`
- `POST /kingdom/attack`
- `POST /kingdom/spell`
- `POST /kingdom/covert`
- `POST /kingdom/fire`
- `GET /kingdom/defense/overview`
- `GET /kingdom/spy-reports`
- `POST /kingdom/spy-reports/:id/share`
- `GET /kingdom/spy-reports/alliance`

---

## Economy

Route file:
- [routes/kingdom-economy.js](../routes/kingdom-economy.js)

Endpoints:
- `GET /kingdom/trade-routes/list`
- `POST /kingdom/trade-routes/establish`
- `POST /kingdom/trade-routes/cancel`
- `POST /kingdom/trade/clear-logs`
- `GET /kingdom/market/prices`
- `POST /kingdom/market/buy`
- `POST /kingdom/market/sell`
- `POST /kingdom/economy/bank-deposit`
- `POST /kingdom/economy/bank-withdraw`
- `POST /kingdom/economy/upgrade`
- `POST /kingdom/economy/hire-mercs`
- `POST /kingdom/economy/dismiss-mercs`
- `POST /kingdom/economy/trade/send`
- `GET /kingdom/economy/trade/list`
- `POST /kingdom/economy/trade/accept`
- `POST /kingdom/economy/trade/decline`
- `GET /kingdom/economy/overview`

---

## Forum

Route file:
- [routes/forum.js](../routes/forum.js)

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
- [routes/hero.js](../routes/hero.js)

Endpoints:
- `GET /hero/list`
- `GET /hero/classes`
- `GET /hero/all-classes`
- `POST /hero/recruit`

---

## Discord

Route file:
- [routes/discord.js](../routes/discord.js)

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
- [routes/admin.js](../routes/admin.js)

Major endpoint groups:
- kingdom management, resets, and manual edits
- chat moderation (mods, bans)
- announcements
- AI presets and controls (synopsis, seed, hiatus, reset, apply-preset)
- config and cache flush tools
- events, wishlist, and suggestions
- lore and sounds
- goals
- repair tools (resource allocations, JSON row repair)
- security audit tools (general + SQL injection scan)
- audit notification settings, schedules, and history

Representative endpoints:
- `GET /admin/kingdoms`
- `GET /admin/stats`
- `GET /admin/kingdom-detail/:id`
- `POST /admin/ban`
- `POST /admin/unban`
- `POST /admin/reset-kingdom`
- `POST /admin/reset-all-kingdoms`
- `POST /admin/set-kingdom`
- `POST /admin/announce`
- `GET /admin/ai-hiatus`
- `POST /admin/ai-hiatus`
- `GET /admin/ai/synopsis`
- `POST /admin/ai/seed`
- `POST /admin/ai/reset`
- `GET /admin/ai/presets`
- `POST /admin/ai/apply-preset`
- `GET /admin/config`
- `POST /admin/config`
- `GET /admin/wishlist`
- `POST /admin/wishlist`
- `GET /admin/events/list`
- `GET /admin/lore`
- `GET /admin/sounds`
- `GET /admin/goals`
- `POST /admin/repair-resource-allocations`
- `POST /admin/repair-json-rows`
- `GET /admin/repair-json-rows/status`
- `POST /admin/security-audit`
- `POST /admin/security-audit-full`
- `POST /admin/security-audit/sql-injection`
- `GET /admin/security-audit/sql-injection/status`
- `GET /admin/audit-notifications/settings`
- `GET /admin/audit-schedules`
- `GET /admin/audit-history`

Use the route file as truth for the exact current path list — this group has 90+ routes
and grows frequently.

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
- Route precedence for `/api/kingdom/*` follows router mount order in `index.js` — see
  the note at the top of this document.
