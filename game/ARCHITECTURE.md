# Game Architecture: Current State (Narmir-shaped)

**Purpose:** Describes how the game works **today** on the live runtime path.  
**Date:** 2026-07-19  
**Status:** As-is after CommandHandler boundary + safeEmit closeout (local `main`). Coupling section corrected 2026-07-19 — see below and `TODO.md` §5 for the honest state of mutator-boundary coverage (boundary check ≠ full coverage; `game/sockets.js` bypasses it entirely).

Narmir’s architecture is **not** a generic RPG JSON content engine. It is a
PostgreSQL multiplayer kingdom sim with:

- **Routes** for HTTP validation and transactions  
- **`game/command-handler.js`** as the player mutator boundary  
- **`game/engine.js`** (and focused modules) as simulation  
- **`safeEmit`** for Socket.io payloads  
- **Live game tables** validated by `npm run validate:game-tables`

## Verified status (replaces retired `ARCHITECTURE_ROADMAP.md`)

Definition of done: player mutators via **CommandHandler**, game sockets via **safeEmit**, honest reward tables + **`validate:game-tables`**, docs match live path. **Not** required: DB outbox/event-bus rewrite or fictional JSON content packs.

| Area | Verdict | Evidence |
|------|---------|----------|
| Foundation & as-is docs | **COMPLETE** | This file + turn/persistence notes |
| Decoupling (Command boundary) | **PARTIAL — corrected 2026-07-19** | `game/command-handler.js`; `npm run check:command-boundary` prevents kingdom-\*/auth/hero/admin routes from directly requiring `game/engine`, but does not require mutations to actually go through CommandHandler (most newer systems mutate via their own domain module + route-level transaction instead — real, by-design, not a gap by itself). The actual gap: `game/sockets.js` is not scanned by the boundary check at all and calls `engine.resolveMilitaryAttack`/`engine.castSpell` directly. See `TODO.md` §5 (A5-1..A5-8) for the full mutator-coverage matrix and policy. Events = turn result arrays + Socket.io — **no outbox** |
| JSON content-pack “engine” vision | **CUT** | Wrong model for Narmir |
| P0 honesty (passive scout, trek loot, terrain scout, safeEmit) | **COMPLETE in code** | Live modules on `feature/webgl-worldmap` (local; not production until ship) |
| Post-complete debt | Open / deferred | Large `engine.js`; optional balance tuning |

```bash
npm run check:command-boundary
npm run validate:game-tables
npm test
```

---

## Current Data Flow: From Input to Render

```
1. HTTP Request (Routes)
   ↓
2. Route Handler (routes/kingdom-*.js, auth, hero, admin)
   validates input, opens transactions as needed
   ↓
3. CommandHandler.handle({ type }, { kingdom, db, ... })
   (npm run check:command-boundary enforces no direct engine mutators
    on kingdom/auth/hero/admin routes)
   ↓
4. Simulation (game/engine.js + focused modules)
   e.g. processTurn, combat, expeditions, passive scout finds, epic trek
   Returns: { updates, events } (or domain-specific results)
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

### Step-by-Step Breakdown

**Step 1: HTTP Request**  
User action hits `/routes/kingdom-*.js` (or auth/hero/admin). Examples: `/turn`, build, train, expedition start.

**Step 2: Route Handler**  
Validates auth, CSRF, resources, legality. Does **not** call `engine.processTurn` / combat mutators directly. Mutators go through CommandHandler.

**Step 3: CommandHandler**  
`COMMAND_TYPES` registry + `handle()` switch. Thin façade over engine signatures so routes stay stable if simulation internals move. Read helpers: `getConstants()`, `assignRegion()`, `defenseRating()`, etc.

**Step 4: Simulation**  
`processTurn()` remains the large turn pipeline inside engine, but is reached via `commandHandler.handle({ type: 'turn' }, …)`. Focused modules own rewards honesty (e.g. `passive-scout-finds`, `epic-trek-discovery`, `terrain-scout`).

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
  mutation goes through `CommandHandler` at all. Of 83 mutating kingdom+hero routes,
  only 13 route through `CommandHandler`; the other 70 mutate via their own domain
  module + a route-level transaction. Full per-route breakdown and the policy for
  why that's correct, not a gap: `game/COMMAND_COVERAGE.md`.
- **Policy (2026-07-19):** `CommandHandler` owns the classic engine-rooted systems
  (turn, combat, spell, covert-\*, expeditions, hire/recruit, build-queue,
  study/school, purchase-upgrade, score, trade-route raid, legacy forge-tools,
  XP awards). Newer, already-modularized systems (Forge & Lava Industry, Dragon
  Evolution, Prestige rebirth, attunements/synergies) are policy-sanctioned to
  mutate via their own dedicated domain module instead — concrete precedent:
  `handlePrestige()` deliberately throws, directing callers to `POST /rebirth`,
  because rebirth's atomic wipe transaction doesn't fit `CommandHandler`'s simple
  `handle(type, payload)` shape. Full reasoning in `game/COMMAND_COVERAGE.md`.
- **`game/sockets.js` bypasses the boundary check entirely** (`check:command-boundary`
  doesn't scan it) and calls `engine.resolveMilitaryAttack`/`engine.castSpell`
  directly — the exact functions HTTP routes are forbidden from calling. This one
  *is* a real gap, unlike the above (sockets skip `engine.js`'s forbidden-mutator
  list entirely, rather than correctly using a dedicated domain module). See
  `TODO.md` A5-4/A5-5.
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
