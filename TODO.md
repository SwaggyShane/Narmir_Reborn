# Narmir Reborn — TODO

**Purpose:** Live source of truth for active work. Completed work lives in [ARCHIVAL.md](ARCHIVAL.md). Architecture status: [game/ARCHITECTURE.md](game/ARCHITECTURE.md).

**Last updated:** 2026-07-19 — Implementation sessioned on. Step 1 (A1-1…A1-8, boot/index.js) complete and verified.

**Mode: LOCAL ONLY.** This campaign is local workspace work — commits on local branches / local `main` as you choose. **No PRs, no remote review loop, no “open a PR after push” requirement.** Remote push/merge is out of scope for how this TODO is executed.

**Verification rule:** Nothing is “done” until traced on the live runtime path. Docs alone do not count.

**Execution rule:** Implementation is sessioned on. Work through the suggested order below; surgical changes only — fix root causes, no bandaids, do not ignore warnings/errors. Test + document each item before moving to the next.

### Assessment completeness (honest)

This TODO is **as complete as static analysis of the repo allows without running the game server, DB profilers, or browser**. A second pass added quantitative inventories (route counts, command types, processTurn span, client sync call-sites, sockets, response-structurer).

| Covered well | Not complete without live runtime |
|--------------|-----------------------------------|
| Boot file map + double handlers | Actual boot failure modes on Railway |
| Route counts, 0 path-dups, gameplay cluster map, full kingdom mutating path list | Every admin/forum/alliance mutator narrative |
| processTurn ~1432 lines + phase comment order | Measured ms per phase (local/prod) |
| Client normalizer vs direct snapshot call-sites; api.mjs vs api imports | Full network-level contract test per endpoint |
| CommandHandler USED/UNUSED types; sockets bypass engine | Play-test that UI still works after each gap fix |

**Still out of scope of this document (by design until implementation session):** line-by-line rewrite plans, full admin.js split map, full `config.js`/`magic.js` internals, balance numbers.

---

## Local acceptance baseline

Run before considering any future implementation item done:

```bash
npm run lint
npm run architecture:accept
npm run check:command-boundary
npm run validate:game-tables
npm test
```

Optional later:

```bash
npm run test:systems
npm run smoke:combat-v2
```

---

# Assessment findings (2026-07-18)

Read-only audit of five systems. Findings feed the work queues below.

---

## 1. Boot + `index.js`

### Current state

| Piece | Location | Role |
|-------|----------|------|
| Env + logger + createServer | `index.js` | Entry |
| `start()` orchestration | `index.js` (~lines 19–132) | Secrets, flags, middleware, Vite, DB, routes, finalize |
| Graceful shutdown + SIGTERM/SIGINT | `index.js` (~134–183) | Server/io close, audit scheduler |
| unhandledRejection / uncaughtException | **`index.js` AND `lib/error-handlers.setupProcessErrorHandlers`** | **Double registration** |
| DB + regen + boot data | `lib/boot.js` | Catch-up regen, hero patch, schedulers, locations/lore/JSON repair |
| Route mount | `lib/setup-routes.js` | Express mounts + sockets |
| Listen + post-init | `lib/finalize-boot.js` | Static/vite serve, listen, goals/constants, audit scheduler |
| HTTP server factory | `lib/server.js` | Express + Socket.io + body parsers |

`index.js` is **~172 lines / ~6.6 KB** — already extracted once, but re-bloated with orchestration + shutdown + duplicate process handlers.

### Problems

1. **Duplicate process handlers** — `index.js` registers rejection/exception handlers that **exit / ignore Sentry recovery**. `finalizeBoot` → `setupProcessErrorHandlers` registers *another* pair with recoverable PG codes + Sentry + `process.exit(1)`. Behavior depends on registration order; uncaughtException handlers can both run; policy is inconsistent (index wants gracefulShutdown; error-handlers wants hard exit).
2. **Extra SIGTERM/SIGINT** — `setupAuditScheduler` also attaches signal handlers for scheduler shutdown (`lib/boot.js`). Multiple listeners on the same signals; works but is hard to reason about.
3. **`start()` nesting** — awkward brace structure; fatal vs DB-offline paths mixed; easy for agents to dump more boot logic here.
4. **`setupRoutes` DI bag** — 12+ injected deps from `index.js` that could be required inside `setup-routes` or passed as one `ctx`.
5. **No guardrail** against entrypoint re-growth.

### Work items (implementation later)

| ID | Item | Status |
|----|------|--------|
| A1-1 | Extract `lib/shutdown.js`: single graceful shutdown (server, io, audit scheduler). | **DONE** |
| A1-2 | **One** process-handler owner: merge index + `setupProcessErrorHandlers` (recoverable PG + Sentry + optional graceful path). Remove duplicate `process.on` from `index.js`. | **DONE** |
| A1-3 | Extract `lib/bootstrap.js` / `start-server.js`: own full `start()` body. | **DONE** |
| A1-4 | Thin `index.js` to ≤ ~40 lines (env, logger, createServer, start, signals via shutdown module). | **DONE** (37 lines) |
| A1-5 | Collapse `setupRoutes` inject bag → `ctx` or internal requires. | **DONE** (14 props → 3: db, io, getBootError; rest are stateless requires now internal to setup-routes.js) |
| A1-6 | Document boot order in `lib/BOOT.md` or ARCHITECTURE section. | **DONE** — `lib/BOOT.md` |
| A1-7 | Optional: `architecture:accept` / script fails if `index.js` line count > 50–60. | **DONE** — limit 60, wired into `scripts/architecture-acceptance.js` |
| A1-8 | Consolidate signal listeners so audit scheduler shutdown is called from the single shutdown path (not extra SIGTERM handlers). | **DONE** |

**Verified (2026-07-19):** live boot (`node index.js`) traced end-to-end — DB connect, schema, routes, sockets, listen, audit scheduler all clean; `/health` returns `booted: true`. `unhandledRejection`/`uncaughtException` confirmed to have exactly one registration site (`grep` across the codebase). `gracefulShutdown` verified directly (not just by code review) across all three paths — happy path (closes server/io/scheduler, does not force-exit), thrown error (force-exit timer stays armed — this was a real bug: the original code cleared the timer in its own catch block, silently disabling the safety net on the one path that needed it), and genuine hang (10s timer fires and force-exits). Full acceptance baseline green: lint, `architecture:accept` (incl. new entrypoint-size check), `check:command-boundary`, `validate:game-tables`, `npm test` (84/84).

---

## 2. Kingdom routes (ownership, dead code, gameplay split)

### Current state

Composition (`routes/kingdom.js`) — **explicit order, good pattern:**

1. build → warfare → economy → research → profile → gameplay  
2. exploration mounted after the loop  

| File | Route handlers (approx.) |
|------|--------------------------:|
| kingdom-build.js | 18 |
| kingdom-warfare.js | 10 |
| kingdom-economy.js | 17 |
| kingdom-research.js | 5 |
| kingdom-profile.js | 4 |
| **kingdom-gameplay.js** | **53** |
| kingdom-exploration.js | 13 |

### Dead-duplicate audit (live scan 2026-07-18)

**Result: 0 duplicate method+path pairs** across the seven kingdom route files.

Implication: `docs/API_ENDPOINTS.md` note about “16 dead routes between build and gameplay” is **likely stale** (cleanup may already have happened). Do not delete code based on that doc without re-scanning.

### `kingdom-gameplay.js` live map (~3346 lines, 53 handlers)

Natural split clusters by line ranges (for future extract, not doing now):

| Cluster | Example routes | ~lines |
|---------|----------------|--------|
| Scouts / news / chat | `GET /scouts`, `GET /chat/global`, news | 186–280 |
| **Turn** | `POST /turn` (+ helpers above) | ~400–800 region + turn handler |
| Hire / smithy / search | hire, forge-tools, search, library-allocation | 809–1180 |
| Options / season / locations | options, season, locations, hybrid blueprint, steal-map | 1186–1580 |
| Profile / world-map / rivers | profile/:name, world-map, world-river-flow | 1589–1890 |
| Prestige / evolution | rebirth, evolution/* | 1899–2060 |
| Lore / resource nodes / harvests / scout-area | | 2061–2490 |
| **Forge + lava** | forge/*, expedition/lava-draw, lava-vent | 2496–3640 |
| Inventory / attune / synergy | | 2810–3170 |
| Portrait / happiness | | 3277–3380 |
| Epic trek | expedition/epic-trek | 3402+ |
| Debug | fix-visibility, debug/scouts | 3641+ |

### Problems

1. **gameplay is the junk drawer** for everything that never got its own router (forge, evolution, prestige, attunements, happiness, world-map).
2. **Docs lag** route reality (API_ENDPOINTS + TODO references to dead dups).
3. **admin.js** (~2.1k lines) same class of problem (not fully mapped this pass; still a split candidate).

### Work items

| ID | Item | Status |
|----|------|--------|
| A2-1 | Re-run route inventory; update `docs/API_ENDPOINTS.md` — remove or rewrite stale “16 dead routes” note; list real mounts from `kingdom.js`. | **DONE** — independently re-scanned (120 unique routes, 0 duplicates); the “16 dead routes” + school-allocation dup claims were both already false. Mount order note fixed too (was wrong — listed exploration before gameplay). |
| A2-2 | Confirm no silent shadowing (including dynamic paths). Treat 0-dup scan as baseline; re-run after any route add. | **DONE** (2026-07-19, alongside A2-10) — exact-string dup scan (A2-1) doesn't catch dynamic-path shadowing (e.g. an earlier `:id` route matching a URL a later literal route intended to own), so checked separately: only 3 dynamic (`:param`) routes exist across all kingdom-\*.js files (`GET /profile/:name`, `GET /war-log/:id`, `POST /spy-reports/:id/share`), and none has a same-method literal sibling anywhere in the kingdom route set that it could shadow — verified via a real scan of `scanAllRoutes()`, not by inspection alone. |
| A2-3 | Split gameplay — **first slice:** turn + turn helpers only → e.g. `routes/kingdom-turn.js`, mount in `kingdom.js` before/after agreed position. | **DONE (2026-07-19).** Did the groundwork the earlier investigation found was missing first: extracted `applyUpdates`/`bulkInsertNews`/`pruneNews`/`getRandomKingdom`/`repairMojibake`/`normalizeNewsRow` (shared by turn AND non-turn routes) into `routes/lib/kingdom-turn-helpers.js`. Then moved `withTurnLock`/`loadTradeRoutes`(now takes `db` explicitly, closing the one implicit-closure dependency)/`loadTurnContext`/`commitTurnResults`/`runTurn`/`POST /turn` into `routes/kingdom-turn.js`, exported as `module.exports.runTurn` etc. alongside the mounting factory so `kingdom-gameplay.js`'s `/smithy/forge-tools` and `/search` (which also call `runTurn`) import it rather than duplicate it. Mounted in `routes/kingdom.js`'s `orderedRouters` (between profile and gameplay). Verified: 52 other routes in kingdom-gameplay.js unchanged (diffed route inventory before/after — exactly one route, `/turn`, moved); the risky mojibake-repair regex verified byte-identical to the original via `diff` against a `sed`-extracted copy (not manually retyped — this class of Unicode transcription is exactly where a "looks right" rewrite goes quietly wrong); live-tested the real HTTP path — `POST /turn`, `GET /news/list` (exercises `normalizeNewsRow`), and `POST /search` with a real success case (exercises `runTurn`'s *entire* pipeline: `loadTurnContext` → `commandHandler.handle` → `commitTurnResults` → discovery resolution → expedition resolution → DB writes) all confirmed correct against the live running server, not just code review. Found and fixed two pieces of test infrastructure with hardcoded assumptions about the old file layout: `test/apply-kingdom-updates-persistence.test.js` (a real P0 data-loss regression guard, updated to check the new location) and `test-systems-harness` (missing `kingdom-turn.js` in its file→mount-prefix map, which would have silently mis-reported the route's full path, plus a stale single-file ownership assertion). Also added `kingdom-turn.js` to `check-command-boundary.js`'s `STRICT_FILES` — it wasn't there, so nothing would have caught a future direct `engine.js` call in the single most-called route in the game. Full acceptance baseline green throughout: lint, `architecture:accept`, `check:command-boundary` (11 files now), `validate:game-tables`, `npm test` (84/84), `npm run test:systems` (77/77, 1 skip unrelated). Also landed the safe dead-code removals from the earlier investigation pass: `processTurnEffectsOnly` and the dead `router.withTurnLock`/etc. exports. |
| A2-4 | Split gameplay — forge/lava cluster → `routes/kingdom-forge.js` (or under forge-named router). | **DONE** (2026-07-18) — extracted 8 routes (6 `forge/*` + `expedition/lava-draw` + `lava-vent`) verbatim (byte-diffed against original before/after) into `routes/kingdom-forge.js`, mounted in `kingdom.js`'s `orderedRouters` between `turn` and `gameplay`. Deliberately did NOT include `/smithy/forge-tools` (legacy smithy hammers/scaffolding, a different system despite the name — already documented as such in `game/COMMAND_COVERAGE.md`) or `/resource-upgrade` (resource-node yard upgrades, unrelated domain) despite both sitting near the forge cluster in the file — verified by reading each route body, not by line-range proximity. Route-count diff confirmed exactly 8 moved, 44 remain in gameplay.js (52 total, unchanged). Updated `check-command-boundary.js` STRICT_FILES, `test-systems-harness/lib/inventory.js` FILE_MOUNT, added a new positive-ownership assertion to `01-endpoint-inventory.js` (forge owns its 8 routes, gameplay still owns legacy forge-tools). Fixed two pre-existing doc gaps found while here (both predate this session, from Step 6 which never updated them): `game/COMMAND_COVERAGE.md` and `docs/API_ENDPOINTS.md` never got a `kingdom-turn.js` section after A2-3 — added now, alongside the new `kingdom-forge.js` section. **Found and fixed a live P0 bug during verification, unrelated to the split**: `GET /inventory` 500'd for kingdom id=1. The route *code* is verified byte-untouched by this split (`git diff --numstat`: 0 insertions on kingdom-gameplay.js for this section) — but that only proves the code, not the data, predates this split; it does **not** prove the underlying data corruption predates this session, and an earlier claim to that effect here was wrong and has been corrected. Root cause: kingdom id=1's `items` column holds several entries with numeric `id`/`name` (e.g. `{"id":20,"name":20,"qty":2}`) instead of the string-slug shape every current writer produces (`game/lib/items.js`'s `addItemToInventory`, confirmed via grep of all `items`-column writers including tests — none produce this shape). `item.name?.includes('Fragment')` crashed because `.includes` isn't a function on a number. Fixed the crash with a proper type check (not a suppression). **Data provenance is unresolved, not closed**: kingdom 1 is the only one of 16 kingdoms-with-items affected (isolated, not systemic); it was created 2026-07-13, after the current string-slug item system was already live (2026-06-12) — so this is not legacy pre-refactor carryover as first (wrongly) guessed either. True origin unknown; not chased further this session — flagged for the user rather than asserted as explained. Full acceptance baseline (lint, architecture:accept, check:command-boundary, validate:game-tables, `npm test` 84/84, `npm run test:systems` 78/78) green, plus live HTTP verification against the real running server (kingdom id=1) for every moved route and the fixed route. |
| A2-5 | Split gameplay — prestige/evolution cluster. | **DONE** (2026-07-19) — extracted 4 routes (`POST /rebirth`, `POST /evolution/start`, `POST /evolution/abort`, `GET /evolution`) verbatim (byte-diffed before/after) into `routes/kingdom-prestige.js`, mounted in `kingdom.js`'s `orderedRouters` between `forge` and `gameplay`. Confirmed real coupling (not just naming proximity) before bundling: `GET /evolution` reads `prestige_level` as its unlock gate (`evolution.EVOLUTION_PRESTIGE_GATE`), same class of justification as A2-4's forge+lava bundling. Route-count diff confirmed exactly 4 moved, 40 remain in gameplay.js (44 total, unchanged). Updated `check-command-boundary.js` STRICT_FILES, `test-systems-harness/lib/inventory.js` FILE_MOUNT, added a positive-ownership assertion to `01-endpoint-inventory.js`. Updated `game/COMMAND_COVERAGE.md` (new kingdom-prestige.js section, 3 mutating routes — `GET /evolution` is read-only, out of that doc's scope) and `docs/API_ENDPOINTS.md` (new "Prestige & Dragon Evolution" section; also fixed a pre-existing gap where `GET /kingdom/evolution` had never been documented at all, even before this split). Fixed a stale file-name comment in `test/prestige.test.js` pointing at the old location. Full acceptance baseline green (lint, architecture:accept, check:command-boundary, validate:game-tables, `npm test` 84/84, `npm run test:systems` 78/78 + 2 skip [http unconfigured, one legitimate elevation-gated spell rejection via the R-4 AcceptableOutcome mechanism firing for real this run]), plus live HTTP verification against the real running server for every moved route. |
| A2-6 | Split gameplay — attunements/synergies/inventory. | **DONE** (2026-07-19) — extracted 9 routes (`GET /inventory`, `GET /attunements`, `GET /available-attunements`, `POST /attune-fragment`, `POST /remove-attunement`, `GET /contributing-synergies`, `GET /synergy-status`, `GET /synergy-cooldown`, `POST /activate-synergy-ability`) verbatim (byte-diffed before/after, including preserving a pre-existing mojibake-corrupted section-divider comment as-is via `sed` rather than manual retype) into `routes/kingdom-attunements.js`, mounted between `prestige` and `gameplay`. Confirmed real coupling before bundling: attunements and synergies share the same `fragment_bonuses` state (synergies are derived directly from attunement placements); inventory is unrelated but small enough to keep in the same file rather than split further. Route-count diff confirmed exactly 9 moved, 31 remain in gameplay.js (40 total, unchanged). Lint caught two imports (`devLog`, `repairMojibake`) I'd initially assumed were used elsewhere in gameplay.js but weren't — removed both, plus 4 more (`getKingdomAttunements`, `attunementManager`, `synergiesModule`, `abilityManager`) and the now-dead `_loggedDeprecatedInventory` Set that were confirmed unused before removing. Updated `check-command-boundary.js` STRICT_FILES, `test-systems-harness` mount map + new positive-ownership assertion, `game/COMMAND_COVERAGE.md` (new file section, 3 mutating routes — the 6 GET routes are out of that doc's mutating-only scope), `docs/API_ENDPOINTS.md` (new section). Full acceptance baseline green (lint, architecture:accept, check:command-boundary, validate:game-tables, `npm test` 84/84, `npm run test:systems` 80/80). |
| A2-7 | Split gameplay — world-map / locations / rivers / scouts-debug. | **DONE** (2026-07-19) — extracted 6 routes (`GET /locations`, `POST /locations/steal-map`, `GET /world-map`, `GET /world-river-flow`, `POST /fix-visibility`, `GET /debug/scouts`) verbatim (byte-diffed before/after, in 4 separate non-contiguous blocks) into `routes/kingdom-worldmap.js`, mounted between `attunements` and `gameplay`. Confirmed real domain coupling before bundling: `/locations` reads `discovered_kingdoms`, `/world-map` renders it gated by `seenCells`, `/fix-visibility` resets `seenCells`/`currentCells`, `/debug/scouts` exposes `scout_progress` that drives `seenCells` reveals — 4 layers of one visibility system, not just naming proximity. Deliberately excluded `GET /profile/:name` despite sitting physically adjacent to `/world-map` in the file — verified it's a different concern (viewing another kingdom's public profile/rankings), only using visibility helpers to gate access, not to render map data; left in `kingdom-gameplay.js`, unassigned to any current A2-x item. Also deliberately excluded `GET /scouts` (real scout status endpoint) despite `/debug/scouts` moving — confirmed it's a near-duplicate debug route, not the same route; `/scouts` belongs with the news/chat cluster per the original assessment grouping, not touched here. Route-count diff confirmed exactly 6 moved, 25 remain in gameplay.js (31 total, unchanged). Found and fixed 4 double/triple-blank-line boundary artifacts left by the extraction (cosmetic only). Removed 5 now-dead imports (`getTerrainForRace`, `getAllLocations`, `isPubliclyDiscovered`, `getWorldSeed`, plus verified 4 others were still used elsewhere before keeping them). Updated `check-command-boundary.js` STRICT_FILES, `test-systems-harness` mount map + new positive-ownership assertion, `game/COMMAND_COVERAGE.md` (new file section, 2 mutating routes — the 4 GET routes are out of that doc's scope), `docs/API_ENDPOINTS.md` (new section — also fixed a pre-existing gap where `GET /world-river-flow`, `POST /fix-visibility`, and `GET /debug/scouts` had never been documented at all, even before this split). Full acceptance baseline green (lint, architecture:accept, check:command-boundary, validate:game-tables, `npm test` 84/84, `npm run test:systems` 81/81). |
| A2-8 | Split gameplay — news/chat remaining; happiness/portrait. | **DONE** (2026-07-19) — extracted 8 routes (`GET /scouts`, `GET /chat/global`, `GET /news/list`, `DELETE /news/clear`, `POST /portrait`, `DELETE /portrait`, `GET /happiness-status`, `GET /happiness-events`) verbatim (byte-diffed before/after, 2 non-contiguous blocks) into `routes/kingdom-social.js`, mounted between `worldmap` and `gameplay`. This completes the gameplay.js split series (A2-4 through A2-8) — `kingdom-gameplay.js` is now 17 routes, down from its original 53. Removed the entire dead module-level multer/portrait-upload setup block (portraitsPath, ALLOWED_PORTRAIT_TYPES/MIME, upload, uploadWithErrorHandling — ~36 lines) from gameplay.js along with 6 now-dead imports (`multer`, `path`, `fs`, `crypto`, `setUnreadCount`, `normalizeNewsRow`); removed an unused `requireCsrfToken` import from the new file after confirming none of these 8 routes actually require a CSRF token. Fixed 2 double-blank-line boundary artifacts. Route-count diff confirmed exactly 8 moved, 17 remain in gameplay.js (25 total, unchanged). Updated `check-command-boundary.js` STRICT_FILES, `test-systems-harness` mount map + new positive-ownership assertion, `game/COMMAND_COVERAGE.md` (new file section, 3 mutating routes), `docs/API_ENDPOINTS.md` (new section — also fixed a pre-existing gap where `GET /kingdom/scouts` had never been documented at all). Full acceptance baseline green (lint, architecture:accept, check:command-boundary, validate:game-tables, `npm test` 84/84, `npm run test:systems` 82/82). |
| A2-9 | Split `routes/admin.js` into domain routers (kingdoms, AI, audit, events, lore). | **DONE** (2026-07-19) — much larger than any prior split: 2363 lines, 68 direct `router.METHOD()` routes + 16 more registered via an internal `dualRoute()` helper (canonical kebab path + legacy snake_case alias) that a naive grep misses entirely — confirmed by reading the whole file, not trusting the earlier "41 posts" estimate. Split into 7 domain files, user-confirmed structure (kingdoms 21, ai 7, events 21 incl. dualRoute pairs, lore 25 incl. dualRoute pairs, goals 4, config 8, audit 14 — 100 real Express route registrations counting legacy aliases, 84 logical routes). `routes/admin.js` itself became a thin composer mirroring `kingdom.js`'s `orderedRouters` pattern — necessary because (1) the original applied `requireAdmin`+CSRF via router-level `router.use(...)`, not per-route like the kingdom-\*.js files, so the composer applies that gate exactly once before mounting any sub-router, guaranteeing it can never be silently omitted from a new file; (2) `admin.js` was required directly by `lib/setup-routes.js` (no existing composition layer to extend). Extracted two shared modules: `routes/lib/admin-kingdom-helpers.js` (`resetKingdomLogic`/`buildStartingProfile`/`buildResetValues`/`RESET_KINGDOM_SET`/`TEST_RACES`/`BCRYPT_SALT_ROUNDS` — real code coupling, not just naming: `/ai/seed` and `/ai/reset` call the same reset/seed logic as the kingdoms cluster) and `routes/lib/admin-dual-route.js` (the `dualRoute` helper, shared by `admin-events.js` and `admin-lore.js`). Preserved the exported `refreshInMemoryGoals` (now on `admin-goals.js`, re-exported from the composer) since `lib/boot.js` requires it by name at server startup — verified via grep before touching anything. Extraction was done via a small Node script (not manual `sed` line-hunting, given the scale) that parsed exact statement boundaries via a brace/paren-depth counter, verified against 0 suspicious endings and cross-checked against a full manual read-through of the file; every route body verified byte-identical via `diff`/`cmp` after assembly, and every new file passed `eslint` with zero missing/unused-import warnings (which would have caught a wrong dependency list). Two already-dead module-level imports (`_config`, `_GOAL_COUNTS`, both underscore-prefixed per this codebase's own "intentionally unused" convention) were dropped rather than carried forward. **Found and fixed a real pre-existing gap in `test-systems-harness`**: its route scanner's regex only matched literal `router.METHOD(...)` calls, so it had been completely blind to all 16 `dualRoute`-registered routes (32 real Express registrations counting aliases) since before this split — fixed `lib/inventory.js`'s `scanRouteFile` to also parse `dualRoute(...)` calls, confirmed via `node test-systems-harness/lib/inventory.js` that total scanned handlers jumped from ~120 to 288 (previously silently under-counted) with zero coverage regressions. Added a new positive-ownership assertion checking exact route counts + canary paths (including legacy aliases) per admin sub-file. Updated `check-command-boundary.js` STRICT_FILES (7 new files + existing `admin.js`) and `docs/API_ENDPOINTS.md`/`game/COMMAND_COVERAGE.md` were NOT updated for admin.js's internal structure (out of scope — those docs describe `/api/kingdom/*` and mutator-boundary policy respectively; admin routes were never covered by either). Full acceptance baseline green (lint zero warnings across the whole repo, architecture:accept, check:command-boundary 23 files, validate:game-tables, `npm test` 84/84, `npm run test:systems` 83/83). |
| A2-10 | Keep `kingdom.js` as **only** mount-order source of truth; document order in comment + API docs. | **DONE** (2026-07-19) — this closes out the full A2 series. `kingdom.js`'s own comment now explicitly states it's the sole mount-order source of truth (docs must defer to it), and explains *why* the order is what it is: `gameplay` must stay last (original M1-1 catch-all concern), `kingdom-exploration` is mounted separately for the same reason, and the six files split out of gameplay since (`turn`/`forge`/`prestige`/`attunements`/`worldmap`/`social`) have **no** ordering constraint relative to each other — each was verified to own disjoint paths at extraction time, so their array position is extraction order, not a precedence requirement. `docs/API_ENDPOINTS.md`'s precedence note was stale ("live scan of all **7** files") — it hadn't been updated for the file count growth from A2-4 through A2-9 even though the route list itself had been kept current; fixed to reflect the real 12-file composer + separately-mounted `kingdom-exploration`, with the same ordering-rationale explanation mirrored from `kingdom.js`. Re-verified live: 120 unique kingdom routes, 0 duplicate method+path pairs (route count coincidentally hadn't changed even though the stale doc's file count had). |

---

## 3. Turn pipeline

### Current state (traced)

```
POST /api/kingdom/turn  (kingdom-gameplay.js)
  → withTurnLock(playerId)
  → prefetch kingdom + loadTurnContext (outside txn)
  → db.withTransaction:
       SELECT … FOR UPDATE
       merge context onto locked row
       commandHandler.handle({ type: 'turn' }, { kingdom, db })
         → engine.processTurn(k, db)   // STILL IN engine.js
       commitTurnResults(db, lockedK, updates, events)
  → postfetch partial columns + unread news
  → JSON response (updates/events)
  → client useGameActions.takeTurn → normalizeAndRouteResponse
```

**processTurn size (static):** `game/engine.js` lines **340–1771** ≈ **1432 lines** (matches TURN_PIPELINE’s ~1429 claim — still accurate enough).

**Live phase order (from comments inside processTurn, not re-timed):**

1. JSON heal (M1-3)  
2. Dragon **evolution ritual** tick (early)  
3. Happiness calc + fragment penalty decay + history record (async catch)  
4. Rebellion check  
5. Gold income (+ client net rate fields; notes mention response-structurer whitelist)  
6. Mana regen + mage XP  
7. Population growth  
8. Food economy  
9. **Attunements 4a–4a-xv** (granary…housing — many sequential blocks; primary cost suspect)  
10. Mercenary upkeep; active event tick; scout ring + discovery + passive finds  
11. Lore events  
12. Building completion + engineer XP  
13. Troop upkeep  
14. Low-tax flavor event; happiness threshold events  
15. Auto-research + mage research/spellbook  
16. Build queue; **Flux-Barge queue (A4)**; library/scribes; legacy trade_routes; bank deposits  
17. Mage tower / shrine processing  
18. Training fields XP  
19. Racial passives; racial unlock; synergy effect cleanup  
20. Profiler budget warnings (dev)

`game/turn.js` is **not** the pipeline — only map WIP helpers. Name is misleading.

`type: 'turn'` appears **5×** in routes (gameplay POST /turn + research path + any multi-turn helpers).

### Problems

1. Mega-function still in engine; attunement ladder is the obvious extract/profile target.  
2. Prod latency ~3–4s — historical report from 2026-07-08; not reproduced/reported since. Not an active symptom as of 2026-07-18 — user confirms no recent lag issues. Local `processTurn` compute measured (A3-3, 2026-07-18) at ~4.84ms steady-state even for the largest local kingdom, ruling out the phase logic as a cause if it recurs. A3-4 is a guardrail (what to check first if latency reports return), not an active investigation.  
3. Fire-and-forget happiness history.  
4. Research burns full turns via same processTurn.  
5. Profiling gated to non-production on route.  
6. Postfetch column subset vs client domains.  
7. ~~TURN_PIPELINE.md phase numbering lags live comments (evolution early; barge queue mid-turn).~~ Fixed by A3-1 (2026-07-18).

### Work items

| ID | Item | Status |
|----|------|--------|
| A3-1 | Refresh `TURN_PIPELINE.md` to match live comment order above + line span 340–1771. | **DONE** (2026-07-18) — full rewrite; verified real lifecycle against `routes/kingdom-turn.js` (removed a fabricated "Socket.io broadcast" step that had no corresponding code — turn is a plain HTTP response, no `io.emit` anywhere in that path), verified phase map against live `// ──` comments incl. the duplicate "6"/"8d" labels, missing `4a-xiv`, dead tavern-entertainment path, and mislabeled "Happiness Audit Report" comment. |
| A3-2 | Rename or document `game/turn.js` (not the pipeline). | **TODO** |
| A3-3 | Local timing capture with profiler; record phase ms especially attunements 4a–4a-xv. | **DONE** (2026-07-18) — 8 direct `processTurn` calls (out-of-band, `db=null` to avoid mutating live history) against kingdom id=1 "Stolice" (turn 132, land 64330, 2258 total buildings — largest in local DB), wrapped in `runWithProfiler`. Real result: steady-state `totalTime` avg 4.84ms (run 1 was a 62.92ms JIT-warmup outlier), all 18 attunements individually measured at 0.09–0.23ms avg each (~2.1ms combined — **not** the 50-200ms the old doc guessed). Full table + methodology in `game/TURN_PIPELINE.md`. Confirms item 1/7 below are stale scares, not real bottlenecks — see item 2 note. |
| A3-4 | Prod latency guardrail — not an active issue (no recent reports as of 2026-07-18); if it recurs, check HTTP/transaction layer first (A3-1's "What this means" section rules out processTurn compute). | **GUARDRAIL, not active** |
| A3-5 | Audit fire-and-forget DB writes in processTurn. | **TODO** |
| A3-6 | Document all 5 `type: 'turn'` call sites and why research double-runs a turn. | **TODO** |
| A3-7 | Align postfetch + structureUpdates field lists with client domains. | **TODO** |
| A3-8 | Incremental extract of attunement blocks / turn-systems registry (behavior-preserving). | **TODO** |

---

## 4. Client state path (API → stores → UI)

### Current state

| Layer | Module | Role |
|-------|--------|------|
| HTTP | `client/src/utils/api.mjs` (+ **`api.js` dual**) | `apiCall` — fetch + CSRF; **no store writes** |
| Structure (server) | `routes/response-structurer.js` | `structureUpdates(flat)` → domain bags; **unknown keys silently dropped** |
| Normalize (client) | `responseNormalizer.js` | nested domains → stores; dev throws on unexpected keys **inside** `updates` |
| Actions | `useGameActions.js` | takeTurn/attack → applyResult → normalizer |
| Stores | `stores/*` | Zustand + `receiveServerSnapshot` |

**Call-site inventory (static, second pass):**

| Pattern | Files | Call count ~ |
|---------|------:|-------------:|
| `normalizeAndRouteResponse(` | 10 (incl. 2 test files) | 31 |
| `receiveServerSnapshot(` | 19 | **56** |
| import `api.mjs` | 30 | — |
| import `api` / `api.js` | 27 | — |

**Direct `receiveServerSnapshot` outside normalizer (high risk):** HirePanel (10), AuthModal (6), BuildPanel (5), ExplorationPanel (5), HeroesPanel (5), WarfarePanel (4), TrainingPanel (2), Forge* sections, HappinessWidget, RankingsPanel, StatusPanel, VolcanicHexCard, useRegenCountdown, etc.

**`structureUpdates` used by:** kingdom-build, economy, exploration, research, warfare, **some** gameplay — **not** every mutator. File header says “All endpoints MUST use this” — **aspirational, not true**.

**Critical structurer bug class:** field sets incomplete (military set misses engineers/war_machines/ladders/etc.; research thin). **Unknown keys dropped with no error** → UI can “succeed” while stores miss fields.

### Problems

1. Dual apply paths (normalizer vs direct snapshot).  
2. Dual response shapes + silent drop.  
3. Dual API modules (~30 vs ~27).  
4. apiCall never auto-syncs.  
5. Socket combat/spell may not share HTTP client apply path.  
6. `/kingdom/me` hydrate fragmented (AuthModal multi-snapshot).

### Work items

| ID | Item | Status |
|----|------|--------|
| A4-1 | Endpoint → flat vs structureUpdates usage table (Appendix B + grep). | **DONE** — real counts (route file: `res.json({...updates})` sites / actual `structureUpdates()` calls): kingdom-build 3/3, kingdom-warfare 3/1, kingdom-economy 3/3, kingdom-research 2/1, kingdom-gameplay 7/5, kingdom-exploration 9/3. **12 response sites across warfare/research/gameplay/exploration send raw, non-domain-structured `updates` today.** |
| A4-2 | Policy: always structure on server **or** adapt on client; expand whitelists / log drops in dev. | **DONE** — always structure on the server (`structureUpdates`), never require the client to branch on shape. Reasoning: `response-structurer.js`'s own header already claimed "all endpoints MUST use this" — that was aspirational, not enforced; making it actually true is simpler than teaching every client call site to handle two possible shapes. Dev-mode loud-warn (A4-10) is the enforcement mechanism going forward. |
| A4-3 | Eliminate direct `receiveServerSnapshot` outside normalizer (panels listed above). | **TODO** — blocked on tracing each of the 12 raw-response sites from A4-1 against its actual client call site first (some may be intentionally raw for a "direct" CommandHandler-bypass system like forge/evolution, consumed by a matching direct-snapshot call — wrapping in `structureUpdates` blind risks breaking currently-working client code). Do this per-route, not in bulk. |
| A4-4 | Unify `api.js` / `api.mjs`. | **TODO** |
| A4-5 | `apiCallAndSync` when `updates` present. | **TODO** |
| A4-6 | Socket action results → same client apply path as HTTP. | **TODO** |
| A4-7 | Single auth/bootstrap hydrate. | **TODO** |
| A4-8 | Scout progress full-reload bug. | **TODO** |
| A4-9 | Fix response-structurer field completeness vs kingdom columns. | **DONE** — rebuilt `response-structurer.js` from each Zustand store's actual `receiveServerSnapshot` implementation, not just column names. Found and fixed a bigger bug than "missing fields": `militaryStore.receiveServerSnapshot` expects a **nested** `{ troops: {...} }` shape, but the structurer emitted flat keys — meaning troop-count updates were being silently no-op'd on the **client** side even for fields already in the old whitelist. Also found and fixed dual-domain fields (`mana`/`mana_regen` → economy+research; `researchers` → profile+research; `engineers` → profile+military.troops), and that **zero `bld_*` building columns were mapped to any domain at all**. Also found and fixed a full duplicate, more-incomplete copy of these field lists inline in `kingdom-gameplay.js`'s `/turn` handler (the single most-called route) — missing mages/clerics/thieves/ninjas, every Forge field, and every `bld_*`/`build_queue` field; deleted, now calls the shared function. Verified live: hit the real running `/turn` endpoint through a real JWT against kingdom id 1, confirmed `military.troops` is now correctly nested and zero unmapped-key warnings fired for the real response; separately verified the `bld_*` + dual-routing logic with a synthetic payload since this particular turn had no building complete. |
| A4-10 | Dev assert if flat keys appear under `updates` without domains. | **DONE** — `structureUpdates` now takes a `warnUnmapped` option (defaults on outside production) and `console.warn`s any key that matched none of the domain sets, instead of the previous silent drop. |

---

## 5. Mutator boundary (CommandHandler)

### Current state

**Gate:** `npm run check:command-boundary`  
Scans kingdom-*, auth, hero, admin for:

- `require('../game/engine')`
- Forbidden: `processTurn`, `resolveMilitaryAttack`, `castSpell`, `resolveExpeditions`, `resolveResourceHarvests`, `hireUnits`, `recruitHero`, `prestige`, plus a few constant reaches

**COMMAND_TYPES** (23): turn, expeditions, combat, spell, covert-*, hire-units, hire-mercenaries, recruit-hero, queue-buildings, demolish-building, process-build-queue, study-discipline, select-school, purchase-upgrade, prestige, calculate-score, raid-trade-route, forge-tools, award-xp, award-troop-xp.

**Routes that do use `commandHandler.handle`:** build, warfare, economy (upgrade/mercs), research, exploration (expeditions resolve), gameplay (turn/hire/forge-tools/xp), profile (score), hero (recruit).

### Gaps (important)

1. **Boundary check ≠ full mutator coverage.** Routes freely `require` domain modules and mutate outside CommandHandler:
   - **Forge** production/upgrades/barges (gameplay) — not in COMMAND_TYPES
   - **Lava expedition / vents** — not in COMMAND_TYPES
   - **Evolution** start/abort — direct `game/evolution`
   - **Prestige/rebirth** — direct `game/prestige` (COMMAND_TYPES has `prestige` but **UNUSED** in routes — `type: 'prestige'` count **0**)
   - **Attunements / synergies / abilities** — managers called from routes
   - **Visibility / scout-area / epic-trek** — domain logic in route handlers
   - Exploration **instant** hunting/prospecting/land-expansion via `lib/gameplay` / economy helpers
2. **Unused command types (static count in routes/):** `process-build-queue` **0**, `prestige` **0**. All other COMMAND_TYPES have ≥1 `type: '…'` hit.
3. **commandHandler.handle call density vs posts (approx.):**

   | File | router.post ~ | handle ~ |
   |------|--------------:|---------:|
   | kingdom-warfare | 5 | 7 |
   | kingdom-gameplay | 29 | 13 |
   | kingdom-research | 4 | 3 |
   | kingdom-build | 17 | 2 |
   | kingdom-economy | 13 | 2 |
   | kingdom-exploration | 9 | 1 |
   | hero | 1 | 1 |
   | admin | 41 | **0** |

   Build/economy/exploration do most mutation **outside** CommandHandler (DB + domain modules). Warfare is the best “handler-shaped” file.
4. **Sockets bypass the HTTP boundary entirely** (`game/sockets.js`):
   - `action:attack` → **`engine.resolveMilitaryAttack`** (forbidden on kingdom routes)
   - `action:spell` → **`engine.castSpell`**
   - `action:spy` / `loot` / `assassinate` → engine covert (same class of gap)
   - **`commandHandler` count in sockets.js: 0**
   - `check-command-boundary` does **not** scan `game/sockets.js` — so CI can be green while sockets still call engine mutators.
5. **admin.js** is in STRICT_FILES for engine forbid list but admin still does large direct DB mutations (expected).
6. **ARCHITECTURE.md** lower “every route calls engine.processTurn” is **false** for the forbidden set; still true that many mutators skip CommandHandler via other modules.

### Work items

| ID | Item | Status |
|----|------|--------|
| A5-1 | Finish written matrix: every kingdom mutating path (list in Appendix B) → CH type **or** domain module + txn. Check into `game/COMMAND_COVERAGE.md` when implementing. | **DONE** — `game/COMMAND_COVERAGE.md`, all 83 mutating kingdom+hero routes classified (13 CommandHandler, 70 direct+domain-module) |
| A5-2 | Decide policy: (A) expand COMMAND_TYPES for forge/lava/evolution/prestige/attune, or (B) document “CommandHandler = classic mutators only; new systems use named modules + transaction in route.” Write the policy in ARCHITECTURE. | **DONE** — Policy B (refined). Full reasoning in `game/COMMAND_COVERAGE.md`, summarized in `game/ARCHITECTURE.md` |
| A5-3 | Wire or delete dead command types (`prestige` vs rebirth route; `process-build-queue`). | **DONE** — `process-build-queue` deleted (0 callers, redundant with automatic per-turn processing, AND its handler passed the wrong argument type — would have thrown TypeError if ever called). `prestige` kept — confirmed it's a deliberate working fence (`handlePrestige()` throws, directs to `/rebirth`), not dead code. |
| A5-4 | Expand boundary tooling: scan **`game/sockets.js`** for the same forbidden `engine.*` mutators; fail CI/local gate. | **TODO** |
| A5-5 | Migrate socket attack/spell/covert to `commandHandler.handle` (parity with HTTP warfare). | **TODO** |
| A5-6 | Fix ARCHITECTURE.md coupling section to match reality (CommandHandler + domain modules + sockets exception until A5-5). | **DONE** — "every route calls processTurn" removed (false; only /kingdom/turn does, via commandHandler); "Decoupling COMPLETE" verdict downgraded to PARTIAL with the sockets.js gap called out explicitly. |
| A5-7 | Systems harness (local): land `b04214e2` work; prove combat/covert/spell/turn/hire through command + DB. | **DONE** (already, prior to this TODO's own assessment pass) — `chore/test-systems-harness` merged to local `main` same day; re-ran `npm run test:systems` just now to confirm still green: 76 passed, 0 failed, 1 skipped (http, no server flag). |
| A5-8 | Optionally extend boundary check to flag new kingdom POSTs that never call handle **and** never appear on an allowlist (high noise — only after A5-2 policy). | **TODO** |

---

# Consolidated work queues (by priority)

Use these when implementation is **sessioned on**. All local-only.

### P0 — Boot / entrypoint

A1-1 … A1-8 (see §1)

### P0 — Routes structure

A2-1 … A2-10 (see §2) — start with A2-1 docs truth, then A2-3 turn extract

### P1 — Turn honesty + performance understanding

A3-1 … A3-8 (see §3)

### P1 — Client contract

A4-1 … A4-10 (see §4)

### P1 — Boundary policy + harness

A5-1 … A5-8 (see §5)

### P2 — Git hygiene (local)

| ID | Item | Status |
|----|------|--------|
| G-1 | Local branch prune (merged leftovers). | **TODO** / in progress |
| G-2 | Worktree inventory; close finished lanes. | **TODO** |
| G-3 | Ignore agent noise (`logs/`, `terminals/`, smoke logs). | **TODO** |
| G-4 | Reconcile local main ↔ origin **only when you choose** — not part of assessment; not a PR. | **TODO** |

### P3 — Player-facing reliability (from earlier)

| ID | Item | Status |
|----|------|--------|
| R-1 | Production turn latency (ties A3-4) — guardrail only, not an active issue as of 2026-07-18. | **GUARDRAIL, not active** |
| R-2 | Scout progress on full page reload (ties A4-8). | **TODO** |
| R-3 | Worldmap smoke (load, markers, fog stride 48 client/server). | **TODO** |
| R-4 | `test-systems-harness` "DB cast spark" check was non-deterministic (not flaky in the random/hardware sense) — it creates two test kingdoms at random map positions each run with no elevation control, and `game/magic.js:134-142`'s real `FEATURE_ELEVATION_SPELLS` line-of-sight gate legitimately rejects casts when the random pair lands at different elevations. `assertOk` didn't distinguish that legitimate rejection from a real failure. **Fixed (2026-07-18), test-side only, no elevation feature logic touched**: added `AcceptableOutcome` to `test-systems-harness/lib/report.js` — a distinct exception type `report.run` now routes to a labeled `SKIP` (not `PASS`, not `FAIL`) instead of the generic catch-all fail path. The spell check in `04-db-integration.js` detects the specific "on higher ground ... line of sight blocked" error and throws `AcceptableOutcome` with an explicit reason instead of asserting success; any *other* spell error still fails normally. Verified: regex matches the real `game/magic.js` error string exactly; a synthetic `AcceptableOutcome` throw was confirmed to produce `summary.fail === 0, summary.skip === 1` with the console line reading `... — ACCEPTABLE: elevation LOS legitimately blocked this cast — real game/magic.js rule, not a bug: ... (skip)`. Full baseline green (lint, `npm run test:systems` 78/78 + 1 skip). | **DONE** |

### Explicit cuts (do not schedule)

| Item | Why |
|------|-----|
| Full event-bus / outbox rewrite | Wrong model for Narmir |
| Big-bang engine.js split | Multi-week; use incremental A3-8 |
| PR/CI gate redesign for this campaign | Local only |

---

# Suggested local implementation order (when sessioned on)

**No PRs.** Each step = local edit → acceptance baseline → optional local commit.

```
Step 1   A1-*          index thin + single shutdown/handlers            DONE 2026-07-19
Step 2   A2-1, A5-6    docs truth (API + ARCHITECTURE)                  DONE 2026-07-19
Step 3   A5-1, A5-2    mutator policy + coverage matrix                 DONE 2026-07-19
Step 4   A5-7          systems harness on local main                   DONE (already merged earlier same session; re-verified 2026-07-19)
Step 5   A4-1, A4-2    client/server updates contract                  DONE 2026-07-19 (A4-1/A4-2/A4-9/A4-10; A4-3..A4-8 remain, see §4)
Step 6   A2-3          extract turn router from gameplay              DONE 2026-07-19
Step 7   A3-1, A3-3    turn pipeline doc + local timing                  DONE 2026-07-18
Step 8+  remaining splits / forge router / client ban direct snapshots
```

---

# Closed prior campaigns (see ARCHIVAL.md)

| Area | Disposition |
|------|-------------|
| Narmir-shaped architecture (CommandHandler gate, safeEmit, validate tables) | COMPLETE (local) |
| P0 honesty scout/trek/terrain | COMPLETE (local) |
| Prestige + Dragon Evolution | COMPLETE (local) |
| Forge & Lava Industry | COMPLETE (local) |
| Happiness momentum-cap | COMPLETE (local) |

---

# Appendix A — Repo scale (assessment snapshot)

| Metric | Value |
|--------|------:|
| Route files | 22 |
| Total HTTP handlers | 256 |
| Mutating handlers (POST/PUT/PATCH/DELETE) | 166 |
| Kingdom + auth + hero mutating | 86 |
| kingdom-gameplay handlers | 53 |
| processTurn lines (engine.js) | ~1432 (340–1771) |
| normalizeAndRouteResponse calls (client) | ~31 |
| receiveServerSnapshot calls (client) | ~56 |
| COMMAND_TYPES unused in routes | `process-build-queue`, `prestige` |

# Appendix B — Kingdom mutating routes (complete static list)

Mount prefix: `/api/kingdom` except hero → `/api/hero`.

**hero:** POST `/recruit`

**build:** build-queue, training-allocation, build-allocation, resource-build-allocation, school-allocation, demolish, build, cancel-building, smithy/buy-hammers, smithy/buy-scaffolding, smithy-allocation, tower-craft, tower-cancel, tower-allocation, shrine-allocation, mausoleum-allocation, buy-mausoleum-upgrade

**economy:** trade-routes/establish, trade-routes/cancel, trade/clear-logs, market/buy, market/sell, economy/bank-deposit, economy/bank-withdraw, economy/upgrade, economy/hire-mercs, economy/dismiss-mercs, economy/trade/send, economy/trade/accept, economy/trade/decline

**exploration:** expedition/start, hunting, prospecting, land-expansion, acknowledge, cancel; goals/claim; scout/allocate, scout/release-all; DELETE expedition/clear-all

**gameplay:** DELETE news/clear; turn; hire; smithy/forge-tools; search; library-allocation; options; hybrid-blueprint/*; assign-hybrid-blueprint; locations/steal-map; rebirth; evolution/start; evolution/abort; resource-harvest/launch; scout-area; forge/* (install-upgrade, charcoal-allocate, smelt, temper, craft-gear, build-barge); resource-upgrade; attune-fragment; remove-attunement; activate-synergy-ability; portrait (+ DELETE); expedition/epic-trek; expedition/lava-draw; fix-visibility

**profile:** description

**research:** research-allocation, research, research-focus, select-school

**warfare:** attack, spell, covert, fire, spy-reports/:id/share

*(GET-only inventory omitted; re-run route audit if mounts change.)*

# Appendix C — What would make this assessment “more complete”

Only with **runtime** work (still local; still not PRs):

1. ~~Boot server; capture one profiled turn JSON; fill phase timings in A3-3.~~ Done 2026-07-18 without needing a running server — direct out-of-band `processTurn` call with `runWithProfiler`, see `game/TURN_PIPELINE.md`.  
2. Hit each Appendix B path once with systems harness / manual; note structureUpdates yes/no + client store keys changed.  
3. Confirm socket attack/spell from a real client still exercises `engine.*` (code says yes; play confirm).  
4. Line-level map of admin.js POST groups (41 posts) for A2-9.  
5. Diff `structureUpdates` field sets vs `db` kingdom columns / VALID_KINGDOM_COLS.

Until then, treat Appendices A–B + sections 1–5 as the **assessment freeze** for planning.

---

# Notes

- **Assessment 2026-07-18:** areas 1–5 + second-pass inventories; **no product code changes** (TODO only; temp audit scripts removed).
- **Do not implement** from this board until the user sessions implementation on.
- Systems harness recover tip: `b04214e2` / `chore/test-systems-harness`.
- **Do not** re-inflate `index.js` — new boot concerns go under `lib/`.
- `CLAUDE.md` PR workflow does **not** apply to this campaign.
