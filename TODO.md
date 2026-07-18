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
| A2-1 | Re-run route inventory; update `docs/API_ENDPOINTS.md` — remove or rewrite stale “16 dead routes” note; list real mounts from `kingdom.js`. | **TODO** |
| A2-2 | Confirm no silent shadowing (including dynamic paths). Treat 0-dup scan as baseline; re-run after any route add. | **TODO** |
| A2-3 | Split gameplay — **first slice:** turn + turn helpers only → e.g. `routes/kingdom-turn.js`, mount in `kingdom.js` before/after agreed position. | **TODO** |
| A2-4 | Split gameplay — forge/lava cluster → `routes/kingdom-forge.js` (or under forge-named router). | **TODO** |
| A2-5 | Split gameplay — prestige/evolution cluster. | **TODO** |
| A2-6 | Split gameplay — attunements/synergies/inventory. | **TODO** |
| A2-7 | Split gameplay — world-map / locations / rivers / scouts-debug. | **TODO** |
| A2-8 | Split gameplay — news/chat remaining; happiness/portrait. | **TODO** |
| A2-9 | Split `routes/admin.js` into domain routers (kingdoms, AI, audit, events, lore). | **TODO** |
| A2-10 | Keep `kingdom.js` as **only** mount-order source of truth; document order in comment + API docs. | **TODO** |

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
2. Prod latency ~3–4s — **not measured this session**.  
3. Fire-and-forget happiness history.  
4. Research burns full turns via same processTurn.  
5. Profiling gated to non-production on route.  
6. Postfetch column subset vs client domains.  
7. TURN_PIPELINE.md phase numbering lags live comments (evolution early; barge queue mid-turn).

### Work items

| ID | Item | Status |
|----|------|--------|
| A3-1 | Refresh `TURN_PIPELINE.md` to match live comment order above + line span 340–1771. | **TODO** |
| A3-2 | Rename or document `game/turn.js` (not the pipeline). | **TODO** |
| A3-3 | Local timing capture with profiler; record phase ms especially attunements 4a–4a-xv. | **TODO** |
| A3-4 | Prod latency investigation (when allowed). | **TODO** |
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
| A4-1 | Endpoint → flat vs structureUpdates usage table (Appendix B + grep). | **TODO** |
| A4-2 | Policy: always structure on server **or** adapt on client; expand whitelists / log drops in dev. | **TODO** |
| A4-3 | Eliminate direct `receiveServerSnapshot` outside normalizer (panels listed above). | **TODO** |
| A4-4 | Unify `api.js` / `api.mjs`. | **TODO** |
| A4-5 | `apiCallAndSync` when `updates` present. | **TODO** |
| A4-6 | Socket action results → same client apply path as HTTP. | **TODO** |
| A4-7 | Single auth/bootstrap hydrate. | **TODO** |
| A4-8 | Scout progress full-reload bug. | **TODO** |
| A4-9 | Fix response-structurer field completeness vs kingdom columns. | **TODO** |
| A4-10 | Dev assert if flat keys appear under `updates` without domains. | **TODO** |

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
| A5-1 | Finish written matrix: every kingdom mutating path (list in Appendix B) → CH type **or** domain module + txn. Check into `game/COMMAND_COVERAGE.md` when implementing. | **TODO** |
| A5-2 | Decide policy: (A) expand COMMAND_TYPES for forge/lava/evolution/prestige/attune, or (B) document “CommandHandler = classic mutators only; new systems use named modules + transaction in route.” Write the policy in ARCHITECTURE. | **TODO** |
| A5-3 | Wire or delete dead command types (`prestige` vs rebirth route; `process-build-queue`). | **TODO** |
| A5-4 | Expand boundary tooling: scan **`game/sockets.js`** for the same forbidden `engine.*` mutators; fail CI/local gate. | **TODO** |
| A5-5 | Migrate socket attack/spell/covert to `commandHandler.handle` (parity with HTTP warfare). | **TODO** |
| A5-6 | Fix ARCHITECTURE.md coupling section to match reality (CommandHandler + domain modules + sockets exception until A5-5). | **TODO** |
| A5-7 | Systems harness (local): land `b04214e2` work; prove combat/covert/spell/turn/hire through command + DB. | **TODO** |
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
| R-1 | Production turn latency (ties A3-4). | **TODO** |
| R-2 | Scout progress on full page reload (ties A4-8). | **TODO** |
| R-3 | Worldmap smoke (load, markers, fog stride 48 client/server). | **TODO** |

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
Step 2   A2-1, A5-6    docs truth (API + ARCHITECTURE)
Step 3   A5-1, A5-2    mutator policy + coverage matrix
Step 4   A5-7          systems harness on local main
Step 5   A4-1, A4-2    client/server updates contract
Step 6   A2-3          extract turn router from gameplay
Step 7   A3-1, A3-3    turn pipeline doc + local timing
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

1. Boot server; capture one profiled turn JSON; fill phase timings in A3-3.  
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
