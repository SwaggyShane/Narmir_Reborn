# Game Architecture: Current State (Phase 1 Documentation)

**Purpose:** This document describes how the game currently works, the data flows, and system interactions. It is the baseline for architectural improvements.

**Date:** 2026-07-08  
**Status:** As-is, pre-refactoring

---

## Current Data Flow: From Input to Render

```
1. HTTP Request (Routes)
   ↓
2. Route Handler (routes/kingdom-*.js)
   ↓
3. Game Logic (game/engine.js - processTurn)
   ↓
4. Database Write (db/schema.js - PgDbAdapter)
   ↓
5. Socket.io Broadcast (game/sockets.js)
   ↓
6. Client Receives (client/src/socket-client.js)
   ↓
7. Zustand Store Update (client/src/stores/*.js)
   ↓
8. React Re-render (client/src/components/)
```

### Step-by-Step Breakdown

**Step 1: HTTP Request**
- User action triggers route handler in `/routes/kingdom-*.js`
- Examples: `/turn`, `/build`, `/train`, `/expedition/start`
- Request carries user ID, intent, and parameters

**Step 2: Route Handler**
- Route validates input (user exists, has resources, action is legal)
- Route calls game logic directly: `engine.processTurn(kingdom, db)`
- Multiple routes call into same game functions (tight coupling point)

**Step 3: Game Logic (engine.js)**
- `processTurn()` is the main engine function (~2500 lines)
- Processes entire turn: regen, combat, expeditions, construction, etc.
- Returns: `{ updates: {...}, events: [...] }`
- Updates = state changes (gold, troops, etc.)
- Events = what happened (combat result, resource gained, etc.)

**Step 4: Database Write**
- Updates are written to PostgreSQL via `db.run(sql, params)`
- Uses new PgDbAdapter with transaction support
- Synchronous: turns must complete before response sent

**Step 5: Socket.io Broadcast**
- Game events broadcast to client: `io.emit('game:turn', { updates, events })`
- Broadcasting happens inside the HTTP response handler
- Clients listening on socket receive the broadcast

**Step 6: Client Receives Event**
- Client socket listener in `socket-client.js` receives game state
- Example: `socket.on('game:turn', (data) => handleTurn(data))`

**Step 7: Zustand Store Update**
- State update triggers Zustand store: `store.setState({ ...newState })`
- Store is source of truth for client-side UI state
- No direct DOM manipulation; React reconciliation only

**Step 8: React Re-render**
- Component subscribed to store detects state change
- React re-renders component tree
- Only changed elements update in DOM

---

## Coupling Relationships

### Current Tight Couplings

**Routes ↔ Engine**
- Every route calls `engine.processTurn()`
- Routes also call specific functions directly
- Routes reach into `game/*.js` with no abstraction

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
