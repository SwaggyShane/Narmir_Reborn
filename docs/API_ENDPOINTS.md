# Narmir Reborn API Endpoints

**Last Updated:** 2026-07-19 — A2-10: mount-order note refreshed for the full 12-file `kingdom.js` composition (was written when it was 7 files); route precedence confirmed still zero-duplicate after the A2-4→A2-9 splits

This document is a concise route map for the current codebase. When this file and the route files disagree, treat the route files as truth.

Base API prefix:
- production: `/api`
- local dev: `http://localhost:3000/api`

Auth model:
- JWT cookie or `Authorization: Bearer <token>`
- mutating routes generally require CSRF protection

> **Note on route precedence:** Several `/api/kingdom/*` routers are mounted on the same
> path prefix, composed explicitly in `routes/kingdom.js` (not `index.js`) via its
> `orderedRouters` array — that array, not this doc, is the actual source of truth;
> if they disagree, trust the code (A2-10). Current order: `kingdom-build`,
> `kingdom-warfare`, `kingdom-economy`, `kingdom-research`, `kingdom-profile`,
> `kingdom-turn`, `kingdom-forge`, `kingdom-prestige`, `kingdom-attunements`,
> `kingdom-worldmap`, `kingdom-social`, `kingdom-gameplay`, then
> `kingdom-exploration` mounted separately, after the loop. Express matches the
> first router that defines a given path+method, so where two files define the
> same route, the earlier-mounted one wins and the later one is dead code.
>
> **Why this order specifically:** `kingdom-build` through `kingdom-profile` predate
> the A2-series splits and their relative order is inherited, not re-verified here.
> `kingdom-gameplay` must stay last among the ordered files — it was the original
> monolith and remains the catch-all for routes that were never assigned their own
> file (M1-1's original router-order-dependency concern). The six files split out of
> it since (`turn`, `forge`, `prestige`, `attunements`, `worldmap`, `social`) have
> **no ordering constraint relative to each other** — each was verified to own
> disjoint paths at extraction time (A2-3 through A2-8), so their position in the
> array is extraction order, not a precedence requirement. `kingdom-exploration` is
> mounted outside the loop, after every other file, for the same reason gameplay
> must precede it: it's never been checked for path overlaps against the others and
> historically was the true catch-all before gameplay grew large.
>
> **Verified 2026-07-19 (A2-10, live scan of all 12 files in the composer + the
> separately-mounted kingdom-exploration.js, 120 unique routes): zero duplicate
> method+path pairs.** (Previous version of this note said "7 files" — stale from
> before the A2-4→A2-9 splits; the route *count* was still correct, only the file
> count was wrong.) This doc previously claimed 16 routes were duplicated between
> `kingdom-build.js` and `kingdom-gameplay.js` plus 1 between `kingdom-build.js` and
> `kingdom-research.js` (`POST /school-allocation`) — that was already stale by the time
> it was written; `school-allocation` exists in exactly one place (`kingdom-build.js`).
> Do not assume routes are dead based on an old doc claim — re-run the scan
> (`routes/kingdom.js`'s `orderedRouters` list defines the real precedence) before
> deleting anything on precedence grounds.
>
> **kingdom-turn.js, kingdom-forge.js, kingdom-prestige.js, kingdom-attunements.js,
> kingdom-worldmap.js, and kingdom-social.js** were split out of `kingdom-gameplay.js`
> (A2-3 2026-07-19, A2-4 2026-07-18, A2-5 2026-07-19, A2-6 2026-07-19, A2-7
> 2026-07-19, A2-8 2026-07-19 respectively) — see their sections below. This
> completes the gameplay.js route-split series.

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

## Turn

Route file:
- [routes/kingdom-turn.js](../routes/kingdom-turn.js)

Key endpoints:
- `POST /kingdom/turn`

Split out of `kingdom-gameplay.js` (A2-3, 2026-07-19) — also exports `runTurn`/
`loadTurnContext`/`commitTurnResults`/`withTurnLock` for reuse by
`kingdom-gameplay.js`'s `/smithy/forge-tools` and `/search` (turn-consuming instant
actions that don't go through the full HTTP `/turn` round trip).

Example:

```bash
curl -X POST http://localhost:3000/api/kingdom/turn \
  -H "Authorization: Bearer <token>" \
  -H "X-CSRF-Token: <csrf>" \
  -H "Content-Type: application/json" \
  -d "{}"
```

---

## Forge & Lava Industry

Route file:
- [routes/kingdom-forge.js](../routes/kingdom-forge.js)

Key endpoints:
- `POST /kingdom/forge/install-upgrade`
- `POST /kingdom/forge/charcoal-allocate`
- `POST /kingdom/forge/smelt`
- `POST /kingdom/forge/temper`
- `POST /kingdom/forge/craft-gear`
- `POST /kingdom/forge/build-barge`
- `POST /kingdom/expedition/lava-draw`
- `GET /kingdom/lava-vent`

Split out of `kingdom-gameplay.js` (A2-4, 2026-07-18) — Toolwright Yard/Engineers
Lodge/Forge upgrade chain, steel/tempered-steel production, Flux-Barge fleet, and
lava-draw expeditions/vents that feed the same barge fleet + `lava_stored` economy.
Distinct from the legacy `/kingdom/smithy/forge-tools` route (hammers/scaffolding),
which stays in `kingdom-gameplay.js` — see `game/COMMAND_COVERAGE.md`'s
"legacy smithy tools, not Forge & Lava" note.

None of these routes go through `CommandHandler`; that's intentional policy
(A5-2, Policy B in `game/COMMAND_COVERAGE.md`) for already-modularized systems.

---

## Prestige & Dragon Evolution

Route file:
- [routes/kingdom-prestige.js](../routes/kingdom-prestige.js)

Key endpoints:
- `POST /kingdom/rebirth`
- `POST /kingdom/evolution/start`
- `POST /kingdom/evolution/abort`
- `GET /kingdom/evolution`

Split out of `kingdom-gameplay.js` (A2-5, 2026-07-19) — kingdom rebirth
(`game/prestige/`) and the Dragon Evolution ritual (`game/evolution/`) are
genuinely coupled, not just adjacent by naming: `GET /evolution` reads
`prestige_level` as its unlock gate. Neither goes through `CommandHandler` — see
`game/COMMAND_COVERAGE.md`'s "Prestige — deliberately not CommandHandler" note.
(`GET /kingdom/evolution` was missing from this doc even before the split —
added here for the first time.)

---

## Inventory, Attunements & Synergies

Route file:
- [routes/kingdom-attunements.js](../routes/kingdom-attunements.js)

Key endpoints:
- `GET /kingdom/inventory`
- `GET /kingdom/attunements`
- `GET /kingdom/available-attunements`
- `POST /kingdom/attune-fragment`
- `POST /kingdom/remove-attunement`
- `GET /kingdom/contributing-synergies`
- `GET /kingdom/synergy-status`
- `GET /kingdom/synergy-cooldown`
- `POST /kingdom/activate-synergy-ability`

Split out of `kingdom-gameplay.js` (A2-6, 2026-07-19) — attunements and synergies
are bundled because they share real state (a kingdom's `fragment_bonuses` column
IS its attunement placements, and synergies are derived directly from that same
map); inventory is a separate, unrelated small read-only route kept in the same
file rather than split further.

---

## World Map, Locations & Rivers

Route file:
- [routes/kingdom-worldmap.js](../routes/kingdom-worldmap.js)

Key endpoints:
- `GET /kingdom/locations`
- `POST /kingdom/locations/steal-map`
- `GET /kingdom/world-map`
- `GET /kingdom/world-river-flow`
- `POST /kingdom/fix-visibility`
- `GET /kingdom/debug/scouts`

Split out of `kingdom-gameplay.js` (A2-7, 2026-07-19) — layers of the same
world-exploration/visibility domain: `GET /locations` reads a kingdom's
`discovered_kingdoms` map, `GET /world-map` renders it gated by `seenCells`
visibility, `POST /fix-visibility` resets the `seenCells`/`currentCells`
bitmaps that gate what's visible, and `GET /debug/scouts` exposes
`scout_progress` (drives `seenCells` reveals). (`GET /world-river-flow`,
`POST /fix-visibility`, and `GET /debug/scouts` were missing from this doc
even before the split — added here for the first time.)

---

## News, Chat, Scouts, Portrait & Happiness

Route file:
- [routes/kingdom-social.js](../routes/kingdom-social.js)

Key endpoints:
- `GET /kingdom/scouts`
- `GET /kingdom/chat/global`
- `GET /kingdom/news/list`
- `DELETE /kingdom/news/clear`
- `POST /kingdom/portrait`
- `DELETE /kingdom/portrait`
- `GET /kingdom/happiness-status`
- `GET /kingdom/happiness-events`

Split out of `kingdom-gameplay.js` (A2-8, 2026-07-19) — the last of the
gameplay.js route-split series (A2-4 through A2-8): the remainder that didn't
cluster with anything else. (`GET /kingdom/scouts` was missing from this doc
even before the split — added here for the first time.)

---

## Core Kingdom Gameplay

Route file:
- [routes/kingdom-gameplay.js](../routes/kingdom-gameplay.js)

Key endpoints:
- `POST /kingdom/hire`
- `POST /kingdom/smithy/forge-tools`
- `POST /kingdom/search`
- `POST /kingdom/library-allocation`
- `POST /kingdom/options`
- `GET /kingdom/season`
- `POST /kingdom/hybrid-blueprint/get-buildings`
- `POST /kingdom/hybrid-blueprint/confirm-assignment`
- `POST /kingdom/assign-hybrid-blueprint`
- `GET /kingdom/profile/:name`
- `GET /kingdom/lore-and-achievements`
- `GET /kingdom/resource-nodes`
- `GET /kingdom/resource-expeditions`
- `POST /kingdom/scout-node`
- `POST /kingdom/expedition/launch`
- `POST /kingdom/expedition/intercept`
- `GET /kingdom/expeditions/visible`
- `POST /kingdom/resource-upgrade`

`kingdom-gameplay.js` also defines the 16 routes documented under **Building and
Allocation** above (owned there because `kingdom-build.js` mounts first) — see the
route precedence note.

Example:

```bash
curl -X POST http://localhost:3000/api/kingdom/hire \
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

## Alliance, World, and Social

Route file:
- [index.js](../index.js) (defined directly on the app instance, not a separate router)

Alliance:
- `GET /alliance/list`
- `GET /alliance/my`
- `GET /alliance/:id`
- `POST /alliance/create`
- `POST /alliance/invite`
- `POST /alliance/leave`
- `POST /alliance/pledge`
- `POST /alliance/dismiss`
- `POST /alliance/vault/deposit`
- `POST /alliance/vault/project`

World and social:
- `GET /regions`
- `GET /world/bounties`
- `POST /world/bounties`
- `GET /messages`
- `POST /messages`
- `GET /chat/:room`

Utility and feedback:
- `GET /spell-definitions`
- `GET /health`
- `GET /status`
- `GET /public/rankings`
- `GET /changelog`
- `POST /log-error`
- `POST /suggestions`
- `POST /bug-reports`
- `POST /test-result`
- `GET /test-results`
- `GET /test-results/summary`
- `POST /setup-admin` (initial admin bootstrap, see `ADMIN_SECRET` in `README.md`)
- `POST /admin/wipe-players` (destructive — dev/test data reset)

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
