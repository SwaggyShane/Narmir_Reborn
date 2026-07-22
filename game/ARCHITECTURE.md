# Game Architecture: Current State (Narmir-shaped)

**Purpose:** Describes how the game works **today** on the live runtime path.  
**Date:** 2026-07-22  
**Status:** As-is after CommandHandler boundary + safeEmit closeout + **engine extract S00–S14** (local `main`). Coupling section corrected 2026-07-19 — see below and `TODO.md` §5 for the honest state of mutator-boundary coverage (boundary check ≠ full coverage).

Narmir’s architecture is **not** a generic RPG JSON content engine. It is a
PostgreSQL multiplayer kingdom sim with:

- **Routes** for HTTP validation and transactions  
- **`game/command-handler.js`** as the player mutator boundary  
- **`game/lib/turn-pipeline.js`** as the turn playlist; **`game/engine.js`** as composition root + compatibility barrel  
- Focused domain modules under `game/` and `game/lib/` for simulation  
- **`safeEmit`** for Socket.io payloads  
- **Live game tables** validated by `npm run validate:game-tables`

**Engine export diet:** Prefer canonical modules for new code (see comment above `module.exports` in `game/engine.js`). Full extract plan: `docs/dev/ENGINE_EXTRACT_PLAN.md`.

## Verified status (replaces retired `ARCHITECTURE_ROADMAP.md`)

Definition of done: player mutators via **CommandHandler**, game sockets via **safeEmit**, honest reward tables + **`validate:game-tables`**, docs match live path. **Not** required: DB outbox/event-bus rewrite or fictional JSON content packs.

| Area | Verdict | Evidence |
|------|---------|----------|
| Foundation & as-is docs | **COMPLETE** | This file + turn/persistence notes |
| Decoupling (Command boundary) | **PARTIAL by design** — CH required only for Policy A types | `game/command-handler.js`; `npm run check:command-boundary` prevents kingdom-\*/auth/hero/admin routes (and, since A5-4, `game/sockets.js`) from directly requiring `game/engine` or calling its forbidden mutators. It does not require mutations to go through CommandHandler at all — that's intentional: Policy B systems (Forge, Prestige, Evolution, attunements, most allocations) mutate via their own domain module + route-level transaction instead, by policy, not by gap. `game/sockets.js` no longer calls forbidden mutators either (A5-5 deleted the code that did) — no known socket gap remains. Authoritative per-route classification (Policy A/B/S, decision tree, current counts): `game/COMMAND_COVERAGE.md`. Events = turn result arrays + Socket.io — **no outbox** |
| JSON content-pack “engine” vision | **CUT** | Wrong model for Narmir |
| P0 honesty (passive scout, trek loot, terrain scout, safeEmit) | **COMPLETE in code** | Live modules on `feature/webgl-worldmap` (local; not production until ship) |
| Engine extract (S00–S14) | **COMPLETE (local)** | Turn playlist in `turn-pipeline.js`; expeditions/regions in lib; barrel diet docs only |
| Post-complete debt | Open / deferred | Optional balance tuning; barrel shrink over time |

```bash
npm run check:command-boundary
npm run validate:game-tables
npm test
```

---

## Current Data Flow: From Input to Render

There are **two player-mutator paths**, not one — which one a route takes is Policy A vs.
Policy B (see `game/COMMAND_COVERAGE.md`, authoritative for per-route classification), plus a
third, non-player path (Policy S) for ticks/jobs. Steps 1–2 and 5–9 are shared; step 3/4 forks.

```
1. HTTP Request (Routes)
   ↓
2. Route Handler (routes/kingdom-*.js, auth, hero, admin)
   validates input, opens transactions as needed
   ↓
   ├─ Policy A (classic sim verbs — turn, combat, spell, covert-*, expeditions,
   │  hire/recruit, build-queue, study/school, purchase-upgrade, score,
   │  trade-route raid, legacy forge-tools, XP awards):
   │  3a. CommandHandler.handle({ type }, { kingdom, db, ... })
   │      (npm run check:command-boundary enforces no direct engine mutators
   │       on kingdom/auth/hero/admin routes, and on game/sockets.js since A5-4)
   │      ↓
   │  4a. Simulation via the CH façade — game/lib/turn-pipeline.js (turn),
   │      game/lib/combat-wrappers.js, game/magic.js, game/covert.js, etc.
   │      Returns: { updates, events } (or a small fixed result shape)
   │
   └─ Policy B (Forge & Lava, Prestige rebirth, Dragon Evolution,
      attunements/synergies, most allocations, market/bank, many
      build/exploration helpers — 67 of 82 kingdom+hero mutating routes):
      3b. Route calls its own domain module directly
          (game/prestige/, game/evolution/, game/forge-*.js, etc.)
          ↓
      4b. Domain module owns the mutation, wrapped in db.withTransaction
          for multi-write flows. CommandHandler is not involved by design —
          see COMMAND_COVERAGE.md's policy for why (Prestige fence precedent).
   ↓
5. Database Write (db/schema.js - PgDbAdapter / withTransaction)
   ↓
6. Socket.io via safeEmit (game/sockets.js, admin, messages, engine/world)
   ↓
7. Client Receives (client/src/socket-client.js)
   ↓
8. Zustand Store Update (client/src/stores/*.js)
   ↓
9. React Re-render (client/src/components/)
```

Separately, **Policy S** (regen timer, `resolveRegions` on tick, boot repair, scheduled
audits) enters at step 5/6 directly — no player HTTP request, no CommandHandler, no route.

### Step-by-Step Breakdown

**Step 1: HTTP Request**  
User action hits `/routes/kingdom-*.js` (or auth/hero/admin). Examples: `/turn`, build, train, expedition start.

**Step 2: Route Handler**  
Validates auth, CSRF, resources, legality. Does **not** call `engine.processTurn` / combat mutators directly regardless of which policy it takes.

**Step 3a/4a: CommandHandler (Policy A)**  
`COMMAND_TYPES` registry + `handle()` switch. Thin façade over simulation signatures so routes stay stable if internals move — after the engine extract (`docs/dev/ENGINE_EXTRACT_PLAN.md`), that simulation mostly lives in `game/lib/turn-pipeline.js` and sibling `game/lib/*` modules, not in `game/engine.js` itself (which is now a 526-line composition root + re-export barrel). Read helpers: `getConstants()`, `assignRegion()`, `defenseRating()`, etc.

**Step 3b/4b: Domain module (Policy B)**  
Route calls a dedicated domain module directly, wrapped in the route's own transaction. Intentional, not a gap — see `game/COMMAND_COVERAGE.md` for the full policy and per-system list.

**Step 5: Database Write**  
Parameterized queries / transactions. Synchronous request path for turns.

**Step 6: Socket.io**  
Production game/admin paths use `safeEmit` (`game/safe-socket-emit.js`) so payloads stay JSON-safe. Dev-only `routes/test-results.js` may still use raw emit (documented exception).

**Steps 7–9: Client**  
Socket → Zustand → React. UI does not mutate server truth.

---

## Architecture gates (run locally)

```bash
npm run check:command-boundary
npm run validate:game-tables
npm test
```

---

## Coupling Relationships

### Current Tight Couplings

**Routes ↔ Engine**
- **Corrected 2026-07-19** — "every route calls `engine.processTurn()`" was false.
  `check:command-boundary` forbids direct `engine.processTurn`/`resolveMilitaryAttack`/
  `castSpell`/etc. calls from kingdom-\*/auth/hero/admin route files, and only
  `POST /kingdom/turn` (plus the research-allocation path, which reuses the full
  turn pipeline — see `TODO.md` A3-6) actually reaches `processTurn`, via
  `commandHandler.handle({ type: 'turn' }, …)`, not directly.
- **But the boundary check ≠ full mutator coverage.** It only prevents route files
  from `require('../game/engine')` directly — it says nothing about whether a
  mutation goes through `CommandHandler` at all. Of 82 mutating kingdom+hero routes
  (2026-07-22 recount, `docs/dev/MUTATOR_POLICY_PLAN.md` M3 — supersedes the old
  2026-07-19 "83"), only 15 route through `CommandHandler`; the other 67 mutate via
  their own domain module + a route-level transaction. Full per-route breakdown and
  the policy for why that's correct, not a gap: `game/COMMAND_COVERAGE.md`.
- **Policy A/B/S (see `game/COMMAND_COVERAGE.md`, authoritative for per-route
  classification — this is a summary, not the source of truth):** `CommandHandler`
  (Policy A) owns the classic sim verbs (turn, combat, spell, covert-\*, expeditions,
  hire/recruit, build-queue, study/school, purchase-upgrade, score, trade-route raid,
  legacy forge-tools, XP awards). Newer, already-modularized systems (Forge & Lava
  Industry, Dragon Evolution, Prestige rebirth, attunements/synergies — Policy B) are
  policy-sanctioned to mutate via their own dedicated domain module instead —
  concrete precedent: `handlePrestige()` deliberately throws, directing callers to
  `POST /rebirth`, because rebirth's atomic wipe transaction doesn't fit
  `CommandHandler`'s simple `handle(type, payload)` shape. Non-player ticks/jobs
  (regen timer, region-tick resolution, boot repair) are Policy S — no route, no CH.
- **`game/sockets.js` no longer bypasses the boundary check, and no longer calls
  forbidden mutators.** This section previously described a real gap here (sockets
  skipping `engine.js`'s forbidden-mutator list and calling
  `engine.resolveMilitaryAttack`/`engine.castSpell` directly) — that was accurate
  through 2026-07-19 but is stale now: A5-4 (same day) added `game/sockets.js` to
  `check:command-boundary`'s scan list, and A5-5 (same day) deleted the socket
  attack/spell/covert handlers outright (the shipped client never emitted those
  socket events, so nothing depended on them) rather than migrating them. Verified
  2026-07-22: zero forbidden calls remain in `game/sockets.js`, and it's included in
  `check:command-boundary`'s "1 other" scanned-file count. No known socket gap
  remains. See `TODO.md` A5-4/A5-5 for the original fix.
- Routes reach into `game/*.js` with no abstraction beyond the above.

**Engine ↔ Database**
- `processTurn()` receives `db` parameter and calls it directly
- No abstraction layer or transaction wrapper

**Engine ↔ Managers**
- Combat calls damage calculator
- Construction calls cost calculator
- Scout calls progression system
- Each is tightly wired to the next

**Engine ↔ Config**
- `processTurn()` reads from `config.EXPEDITION_TURNS`
- Constants are global, immutable, scattered

### Cross-System Calls

These represent coupling points to decouple:

- Routes call engine functions directly
- Engine calls combat manager directly
- Combat calls effect system directly
- Expedition system calls combat resolution
- No abstraction layers between subsystems

---

## State Ownership

Who owns what state currently:

| State | Owner | Access |
|-------|-------|--------|
| Kingdom (primary) | Database | Engine reads, modifies, writes back |
| Entities | Kingdom object | Embedded JSON or rows |
| Active effects | Kingdom | active_effects JSON |
| Expedition progress | Expeditions table | Separate rows |
| Scout progress | Kingdom | scout_progress field |
| Discovered kingdoms | Kingdom | JSON field |
| Combat log | Database | combat_log table |
| Market prices | Database | market_prices table |

**Problem:** Multiple systems can write to the same fields without clear ownership rules.

---

## Architecture Violations (Current)

By the principles we want to enforce:

❌ **Routes call engine directly** — UI depends on game logic implementation  
❌ **Mutable state passed through** — Kingdom object modified in-place  
❌ **No command/event boundary** — Results returned, not events broadcast  
❌ **Hardcoded behaviors** — Damage, healing, effects hardcoded in functions  
❌ **Multiple systems write shared state** — kingdom.gold updated by many subsystems  
❌ **Database queries scattered** — processTurn calls db multiple times  

---

## Next Steps

Phase 1 continues with:
1. Turn Pipeline Diagram (detailed timing and bottlenecks)
2. State Persistence Model (how state syncs to DB and clients)
3. Coupling Points Analysis (what needs decoupling first)

Then Phase 2: Introduce Command → Simulation → Events pattern.
