# Game Architecture Roadmap

**Note:** This roadmap is AI-assisted. Execution will be much faster than timelines suggest (likely 1-3 days vs. 11 weeks). Phases and acceptance criteria remain valid; timeline is conservative.

## Executive Summary

The project is at an inflection point. We're moving from **"a game with lots of code"** to **"a game engine."** This requires a deliberate architectural shift to prevent coupling explosion and enable scalable content creation.

**Key principle:** Systems should communicate through explicit data flows, not through mutual references. Content should be data-driven, not behavior-driven. Managers should fade away as systems become independent.

---

## Long-Term Vision: Game → Game Engine

**Current mindset:**
> "How do we implement this feature?"

**Target mindset:**
> "What engine capability does this feature require?"

This shift naturally produces systems that are reusable, modular, and significantly easier to extend. Every architectural decision should be evaluated through this lens: does it move us toward a solid engine, or toward one-off features?

---

## Architecture Principles (The Constitution)

These 10 principles are immutable. Every future design decision should respect them. They are the "constitution" that prevents architectural debates:

1. **Simulation owns game truth.** The game state is the single source of truth; everything else is a view of it.
2. **Rendering never mutates game state.** UI is read-only.
3. **UI generates Commands only.** Input never directly calls simulation.
4. **Simulation emits Events only.** State changes are broadcast as immutable facts.
5. **Commands express intent.** A command says "the player wants to do X."
6. **Events express facts.** An event says "X happened in the world."
7. **Content is data.** Items, monsters, locations, quests live in JSON/YAML.
8. **Behavior is code.** Logic lives in functions, not data files.
9. **Every piece of state has exactly one owner.** No shared ownership; reduces coordination overhead.
10. **Dependencies always point toward the simulation layer.** Never have simulation depend on UI or rendering.

These principles prevent scope creep and keep the architecture coherent as the codebase grows.

---

## Things We Never Do (Anti-Patterns)

Code review clarity: if you see these patterns, they are architectural violations:

❌ **UI modifies world state** — UI calls `world.entity.health = 0` directly  
❌ **Renderer changes simulation** — React component emits non-UI events  
❌ **Managers calling Managers** — CombatManager calls InventoryManager  
❌ **Circular imports** — A imports B, B imports A  
❌ **Global mutable singleton state** — `const gameState = {...}; export gameState;`  
❌ **Game logic inside React components** — Damage calculation in a component  
❌ **Content files containing executable logic** — items.json has a `function` field  
❌ **State owned by multiple systems** — Two managers both write to the same entity  
❌ **Events that aren't JSON-serializable** — Events with Date objects or circular refs  
❌ **Commands that query state** — A command shouldn't read the world; it should assume valid input  

---

---

## Event Bus Ownership Rules

Define who may emit what to prevent the event system from becoming unstructured as the project grows:

```
UI Layer
    ↓ Creates
Commands (user intent)

Simulation Layer
    ↓ Emits
Events (facts about what happened)

Renderer / Client
    ↓ Cannot emit
(Renderer is read-only)

Database
    ↓ Cannot emit
(Database is a sink, not a source)

Network / Socket.io
    ↓ Translates only
(Never generates events; broadcasts existing ones)
```

**Consequence:** If you find yourself writing an event generator outside the simulation layer, you've violated the architecture. Refactor it.

---

## Blocked Work: Expedition Reward Systems

**Status:** Waiting for Phase 1-2 architecture completion

Two expedition systems need reward wiring that should be implemented AFTER the Command → Simulation → Events architecture is in place (Phase 2 complete). Implementation will be cleaner and won't require refactoring if we build in the new architecture rather than patching the old one.

### Epic-Trek Per-Hex Discovery & Loot

**What's missing:**
- Per-hex discovery rolls as expedition travels (1.5 hexes/turn)
- Dungeon/mountain location discovery during travel
- Accumulated loot (gold, resources, mana, troops, items)
- Proper reward wiring in expeditionRewards() function

### Passive Scouting Continuous Finds

**What's missing:**
- Per-turn discovery chance when scout allocation active
- Per-turn resource node discovery (scaled by allocation)
- Per-turn passive finds (gold, wood, land, mana, troops, maps, kingdoms)
- Integration with scout-progress system

**Unblock condition:** Phase 2 (Command + Event system) is complete and tested

Both systems follow the same pattern: allocate units → accumulate discoveries over time → receive loot when allocation ends or completes. Better to design this pattern once in the new architecture than patch it twice in the old one.

---

## Rapid Development Guardrails (For 1-3 Day Execution)

Execution will compress an 11-week roadmap into days. These 3 operational constraints prevent common failure modes during rapid development:

### 1. Outbox Cleanup Policy (Prevents Table Bloat)
**Problem:** Rapid movement commands (10+ per second per player) bloat the outbox table instantly, causing transaction locking and performance degradation.

**Solution:**
- Background worker processes outbox table: broadcast event → mark as sent → delete record
- Cleanup must happen **immediately after successful Socket.io broadcast** (not batched hourly)
- If cleanup lags, monitoring will alert (outbox table size > threshold)

**Implementation:**
```typescript
// game/services/outboxWorker.ts
async function processOutbox() {
  const pending = await db.query(
    'SELECT * FROM outbox WHERE sent_at IS NULL LIMIT 100'
  );
  
  for (const event of pending) {
    try {
      io.emit('game:event', event); // Broadcast
      await db.query('DELETE FROM outbox WHERE id = $1', [event.id]); // Cleanup
    } catch (err) {
      console.error(`Outbox broadcast failed: ${err}`);
      // Retry on next cycle
    }
  }
}
```

**Acceptance:** Outbox table size stays <1000 rows even under load.

---

### 2. Pre-Commit Validation Hook (Prevents Bad Data)
**Problem:** Developers might skip `npm run validate:content` in fast sprints, allowing corrupted JSON into commits (missing IDs, broken references).

**Solution:**
- Set up Git pre-commit hook on **Day 1** (Husky or native Git hook)
- Hook runs validation automatically; blocks commits with errors
- No manual step = no developer discretion to skip

**Implementation:**
```bash
# .husky/pre-commit
#!/bin/sh
npm run validate:content
if [ $? -ne 0 ]; then
  echo "❌ Content validation failed. Fix errors and try again."
  exit 1
fi
npm run lint
npm test
```

Or (if Husky feels heavy):
```bash
# .git/hooks/pre-commit (native)
#!/bin/sh
node scripts/validate-content.js || exit 1
```

**Acceptance:** All commits automatically validated; zero corrupted data in history.

---

### 3. Adapter Isolation (Prevents Cleanup Debt)
**Problem:** Temporary bridge adapters scatter through legacy code blocks. When deleting old systems, adapters are forgotten; codebase becomes hybrid and confusing.

**Solution:**
- **All coexistence adapters go in `/adapters/` directory.** Period.
- Adapters are temporary; path isolation makes them visible for deletion.
- No adapters inline with legacy code; no exceptions.

**File structure:**
```
game/
  adapters/
    damageAdapter.js        // Bridge old combatManager → new event system
    inventoryAdapter.js     // Bridge old inventory → new item registry
    questAdapter.js         # Bridge old quest hooks → new events
  engine.js                 # New code
  terrain.js
  visibility.js
  turn.js
```

**Principle:** When Phase 3 is complete and old systems are deleted, `/adapters/` directory gets deleted entirely. Clean.

**Acceptance:** No adapter code exists outside `/adapters/`. Code review enforces this.

---

## Current State vs. Target State

### Current Architecture (Tangled)
```
Renderer
    ↓ references
Game State
    ↓ references
World
    ↓ references
Entities
    ↓ references
UI + Combat + Inventory + Quests + ...
```

**Problems:**
- Everything knows about everything
- Adding a feature touches 5+ systems
- Testing individual systems is hard
- Changing one system risks breaking others
- Managers proliferate: CombatManager, QuestManager, InventoryManager, etc.

### Target Architecture (Clean)
```
Input (Keyboard, UI, Network)
    ↓
Commands (structured intent)
    ↓
Simulation (pure game logic)
    ↓
Events (broadcast results)
    ↓
Renderer (consume state, display)
```

**Benefits:**
- Clear data flow
- Systems are testable in isolation
- New mechanics mostly = new data, not new code
- Easier to add multiplayer, replay, AI, etc.

---

## Phase 1: Foundation & Visibility (Weeks 1-2)

**Owner:** Lead Architect  
**Timeline:** 2 weeks  
**Goal:** Full visibility into current architecture and coupling points

### 1.1 Document Current Architecture
Create `ARCHITECTURE.md` that describes:
- Entity lifecycle (how entities are created, updated, destroyed)
- Turn processing pipeline (input → simulation → render)
- Combat flow (turn structure, targeting, damage)
- World simulation (time, weather, NPC movement)
- Data flow between systems
- Current manager responsibilities

**Success criteria:** Team can read the doc and explain how a combat turn flows through the system.

**Acceptance criteria:**
- [ ] Document is 2000-3000 words, includes diagrams
- [ ] All team members read and sign off
- [ ] No unexplained manager responsibilities

### 1.2 Current Turn Pipeline Diagram
Create a detailed diagram showing how a turn flows TODAY (before refactoring):

```
Input (keyboard, UI button, API)
    ↓
Route/Handler (routes/*.js)
    ↓
Game Logic (game/turn.js, game/engine.js)
    ↓
Database Write (db/schema.js queries)
    ↓
Socket.io Broadcast (game/sockets.js)
    ↓
Client Receives (socket-client.js)
    ↓
React Update (Zustand store)
    ↓
Render
```

**Deliverable:** Diagram with:
- Timing estimates per stage (e.g., "turn.js processes in <100ms")
- Which files are involved at each stage
- Where state lives (memory vs. PostgreSQL vs. client)
- Potential bottlenecks (from memory: /turn endpoint ~3000ms on production)

**Acceptance criteria:**
- [ ] Diagram matches actual code flow (verify with git log + code reading)
- [ ] Shows where turn state is persisted (DB)
- [ ] Shows where broadcasting happens (Socket.io)
- [ ] Team can walk through it and predict where refactoring impacts

**Why:** This is the flow you're about to refactor. If you don't understand it first, you'll miss coupling and break things.

### 1.3 State Persistence Model: Command → DB → Event → Socket.io
Define how game state persists to PostgreSQL and how it syncs with events. **CRITICAL: This phase establishes the transaction boundary that prevents client/server desync.**

**Status: Foundation already in place.** The new database layer (`db/transaction.js`, `db/schema.js` PgDbAdapter) already has:
- ✅ AsyncLocalStorage for transaction context
- ✅ Nested transaction support (savepoints)
- ✅ Error recovery and connection pooling
- ✅ Atomic write capability via `db.run(sql)`

**Problem to solve:**
If you write to DB first, then emit Socket.io event, a crash in between leaves the client permanently out of sync:
1. Command "recruit 5 troops" → DB write succeeds (count = 55)
2. Event emission starts... CRASH
3. Client still shows 50 troops
4. User refreshes → sees 55 (from DB)
5. Inconsistency and support burden

**Solution: Outbox Pattern with Atomic Transactions**

```
Command → Atomic Transaction (using db.run) {
  1. Apply state change in memory
  2. Generate GameEvent
  3. Write state + event to DB (single transaction)
  4. Return (success, event)
} → Async Background {
  5. Read pending events from outbox table
  6. Broadcast via Socket.io
  7. Mark as sent (or retry on failure)
}
```

**Implementation note:** Use `db.run()` with explicit BEGIN/COMMIT to wrap state + event writes in a single transaction. The AsyncLocalStorage system ensures all nested queries use the same connection.

**Design decisions to document (create table):**

| Decision | Your Approach | Rationale |
|---|---|---|
| Transaction boundary | Commands + events atomic in DB | Prevents inconsistency |
| Event persistence | Events stored in outbox table | For audit, replay, recovery |
| Broadcast timing | After DB commit succeeds | Client only sees confirmed state |
| Failure handling | Async retry loop on broadcast failures | Client syncs on next turn tick |
| Event ordering | Timestamp + sequence number in DB | Prevents duplicate/out-of-order processing |

**Acceptance criteria:**
- [ ] State ownership clear (who writes what to DB)
- [ ] Outbox pattern documented (or alternative transaction model)
- [ ] Diagram shows: Command → Atomic(State + Event) → Async Broadcast → Retry
- [ ] Team understands: DB write succeeds BEFORE Socket.io broadcast
- [ ] Rollback scenarios defined (what happens if DB transaction fails?)
- [ ] Client sync strategy defined (how does client recover if broadcast fails?)

**Why:** This is CRITICAL for a persistent multiplayer game. Without atomic transactions between state + events, you'll have silent desync bugs that only show up under load or network failure.

### 1.4 Identify Coupling Points
Quick audit of codebase for coupling issues. **Focus areas: `game/`, `routes/`, `client/` (DB layer in `db/` is already modularized).**

Audit for:
- Modules that import from 5+ other modules
- Circular dependencies (use `npm ls` or static analysis)
- Cross-system method calls (e.g., game/engine.js calling routes/kingdom-gameplay.js)

**Output:** A coupling map (simple spreadsheet) showing:
- System A depends on System B (reason: X)
- Number of cross-system calls per system pair
- Priority: which to decouple first

**Acceptance criteria:**
- [ ] Coupling map identifies 10+ cross-system dependencies in game/routes/client
- [ ] Identifies the 3-5 most coupled pairs
- [ ] Assessment of whether movement is a good Phase 2 pilot (does it connect to visibility, terrain, etc.?)
- [ ] Note which systems are already modularized (db/ is baseline, don't re-audit)

**Why:** Take 3-4 days max. Movement might be perfect OR too thin depending on what it touches. This audit will tell you.

---

## Phase 2: Decoupling (Weeks 3-5)

**Owner:** Combat/Engine Lead  
**Timeline:** 3 weeks (not 4)  
**Goal:** Pick ONE system (movement), decouple it completely. Validate the pattern works. CRITICAL: Establish Command/Event contract and Socket.io serialization rules.

### 2.0 Define Command & Event TypeScript Interfaces + Serialization Testing (Week 3, Day 1)
Before any implementation, define the contracts AND the serialization test utility:

**Create `types/commands.ts`:**
```typescript
// All possible commands in the game
export type Command =
  | { type: 'MOVE'; entityId: string; targetPos: { x: number; y: number } }
  | { type: 'ATTACK'; attackerId: string; targetId: string }
  | { type: 'USE_ITEM'; entityId: string; itemId: string }
  | // ... more as game grows

// Command handler returns events + new state
export type CommandHandler = (world: World, cmd: Command) => Event[];
```

**Create `types/events.ts`:**
```typescript
// All possible events — VERSIONED for future protocol evolution
export type GameEvent =
  | { 
      version: 1;
      type: 'entity:moved';
      eventId: string; // Unique event ID for deduplication
      entityId: string;
      position: { x: number; y: number };
      turnNumber: number; // Which turn this happened in
      worldTick: number; // Global time counter
      timestamp: number; // Unix timestamp (not Date object)
    }
  | { 
      version: 1;
      type: 'entity:damaged';
      eventId: string;
      entityId: string;
      amount: number;
      sourceId: string;
      turnNumber: number;
      worldTick: number;
      timestamp: number;
    }
  | // ... more as game grows

// CRITICAL: Events must be JSON-serializable for Socket.io broadcast
// Rule: No circular refs, class instances, functions, Dates (use timestamps instead)
// Metadata enables: replay, deterministic debugging, multiplayer sync, duplicate detection
```

**Create `test/helpers/assertSerializable.ts` (CRITICAL for Socket.io safety):**
```typescript
// Utility: Test that data survives JSON round-trip
// Catches: Date objects becoming strings, functions being dropped, circular refs
export function assertSerializable<T>(data: T): void {
  const serialized = JSON.stringify(data);
  const deserialized = JSON.parse(serialized);
  
  // Verify structure matches exactly after round-trip
  expect(deserialized).toEqual(JSON.parse(JSON.stringify(data)));
  
  // If this fails, the event won't work over Socket.io
  // Common culprits: new Date(), function, Map, Set, circular references
}
```

**Usage in Phase 2 tests:**
```typescript
// Every event test MUST verify serialization
test('entity:moved event is Socket.io safe', () => {
  const event: GameEvent = {
    type: 'entity:moved',
    entityId: 'hero_1',
    position: { x: 5, y: 10 },
    timestamp: Date.now(), // ✓ number, not Date object
  };
  
  assertSerializable(event); // Fails if event can't JSON.stringify
});
```

**Acceptance criteria:**
- [ ] Command union type covers 80% of current game actions
- [ ] All events are JSON-serializable (verified by assertSerializable utility)
- [ ] `assertSerializable<T>` utility exists and is used in every event test
- [ ] TypeScript compiler confirms types are correct
- [ ] **Every event includes metadata: version, eventId, turnNumber, worldTick, timestamp**
- [ ] **Events follow Event Bus Ownership Rules** (only Simulation emits GameEvents)
- [ ] Events use timestamps (number, not Date) for ordering

**Why:** Events work locally in Node.js but fail silently over Socket.io if they contain non-serializable types. Metadata enables replay, deterministic debugging, and multiplayer sync. Versioning allows future protocol evolution without breaking existing clients.

### 2.1 Refactor Movement to Use Commands + Events
Pick movement because:
- Smallest scope (fewer dependents)
- Validates command + event pattern
- Isolatable test surface
- **Coupling audit (Phase 1.4) will confirm this is appropriate**

**Do:**
1. Create `command/moveCommand.ts` 
2. Movement input → MoveCommand creation (old code stays)
3. Simulation processes MoveCommand → MoveExecuted event
4. Update UI via event listener, not method calls
5. Write test: MoveCommand → MoveExecuted event
6. **Verify: Events broadcast over Socket.io correctly (serialize to JSON, no errors)**

**Don't:**
- Refactor combat yet (too big)
- Refactor inventory (depends on items)
- Add undo/redo (future optimization)
- Use non-serializable data types in events

```typescript
// All this is new; old movement code stays untouched for now
type MoveCommand = { type: 'MOVE'; entityId: string; targetPos: { x: number; y: number } };
function processMove(world: World, cmd: MoveCommand): GameEvent[] {
  const entity = world.getEntity(cmd.entityId);
  if (!entity || !isValidMove(entity, cmd.targetPos)) return [];
  
  entity.position = cmd.targetPos;
  // CRITICAL: Event must be serializable for Socket.io
  return [{ 
    type: 'entity:moved', 
    entityId: entity.id, 
    position: cmd.targetPos,
    timestamp: Date.now() // Use timestamp, not Date object
  }];
}
```

**Acceptance criteria:**
- [ ] Movement works without calling into UI directly
- [ ] Events are emitted for all move outcomes (success, blocked, out-of-range)
- [ ] **Events serialize to JSON and deserialize without data loss (Socket.io compatibility, use assertSerializable)**
- [ ] **3+ test cases verify ACTUAL WORLD STATE MUTATION (not just event generation):**
  ```typescript
  // BAD: Only tests event, not state change
  test('move command generates event', () => {
    const events = processMove(world, cmd);
    expect(events[0].type).toBe('entity:moved'); // Passes but world may not change
  });
  
  // GOOD: Tests actual state mutation
  test('move command changes entity position', () => {
    const entity = world.getEntity('hero_1');
    const originalPos = entity.position;
    
    const events = processMove(world, cmd);
    
    expect(entity.position).not.toEqual(originalPos); // ACTUAL state changed
    expect(events[0].type).toBe('entity:moved');
  });
  ```
- [ ] No breaking changes to existing movement (old code still works)

### 2.2 Introduce Event Broadcasting for Movement Results (CRITICAL: Socket.io serialization)
Only movement systems emit/listen to events for now. Don't touch combat or inventory yet.

**CRITICAL CONSTRAINT:** Events will broadcast over Socket.io to clients.
- Test: `JSON.stringify(event)` succeeds for all events
- No circular refs, class instances, functions, Date objects
- Use timestamps (numbers) instead of Date objects
- Use enums/strings instead of Map/Set

**Implementation:**
```typescript
// Server emits event
events.emit('entity:moved', { 
  type: 'entity:moved',
  entityId: 'hero_1',
  position: { x: 5, y: 10 },
  timestamp: Date.now() // Number, not Date
});

// Socket.io broadcasts it (must be JSON-serializable)
socket.on('game:event', (event) => {
  // Client receives and processes
  handleMoveEvent(event);
});
```

**Acceptance criteria:**
- [ ] UI updates via `events.on('entity:moved', ...)`
- [ ] Quest system can listen to `entity:moved` without touching movement code
- [ ] **Events JSON-serialize correctly for Socket.io broadcast (no serialization errors)**
- [ ] Client receives events over Socket.io and processes them
- [ ] Event system is documented (what events exist, what data they carry, serialization rules)

### 2.3 (Skip for now)
Don't reduce manager responsibilities yet. That comes after Phase 3 when patterns are proven.

---

## Migration & Coexistence Policy

During Phase 2 and 3, old and new systems will coexist. Here's how:

### Rule 1: Create Adapters, Not Rewrites
Old code stays. New code wraps it with adapters:

```typescript
// OLD: CombatManager.onEntityDamaged(entity, 30) called from everywhere
// NEW: Events are emitted instead
// COEXISTENCE: Old code continues to work; damage pipeline gradually switches to events

// Adapter layer:
function damageEntity(world: World, entity: Entity, amount: number): Event[] {
  // Old behavior (for backward compatibility)
  const oldManager = world.combatManager;
  if (oldManager) oldManager.onEntityDamaged(entity, amount); // Still works
  
  // New behavior (what we're moving to)
  events.emit('entity:damaged', { entity, amount });
  
  return [{type: 'entity:damaged', entity, amount}];
}
```

### Rule 2: Boundary Between Old & New is Clear
- **Old world:** CombatManager, InventoryManager, etc. call each other directly
- **New world:** Systems emit events, don't call each other
- **Boundary:** Adapters live in `/adapters/` directory
- **Never mix:** Don't half-refactor a system (don't emit events AND call methods from the same code path)

### Rule 3: New Content Uses New Patterns Immediately
- Items added in Phase 3 are JSON + behavior lookup, never hardcoded classes
- Monsters added in Phase 3 are data-driven
- This forces a "commit point" — once Phase 3 content is added, you can't easily go back to old patterns

### Rule 4: Data Files Are Never Old
Once you create `data/items.json` in Phase 3, there's no "old item system" vs "new item system" — there's just the new one. This prevents hybrid confusion.

---

## State Ownership Matrix

Clarify who owns what state to prevent fights during refactoring:

| State | Owner System | Source of Truth | Who Can Write | Observers |
|-------|--------------|-----------------|---------------|-----------|
| Entity Position | World/Movement | World state | Movement command handler | UI (reads), Combat (validates range), Visibility (updates sight lines) |
| Entity Health | Combat/Entities | Entity object in world | Damage/heal functions | UI (reflects bar), Quest system (checks objectives), Effects system |
| Inventory Items | Inventory | Player entity's items array | Inventory add/remove functions | UI (shows items), Crafting (checks requirements), Quests |
| Active Effects | Combat/Effects | Entity's effects array | Effect applicator | Combat (damage modifiers), UI (shows icons), Rendering |
| World State (time, weather) | World/Sim | World object | Turn processor | Rendering (affects visuals), Spawn system (affects spawns), UI (displays) |
| Turn Queue | Combat | Queue data structure | Turn processor | UI (shows order), Combat actions (process in order) |

**Rule:** Each state has exactly ONE owner. Other systems can read, but only the owner can write.

**During transition:**
- Mark old code that violates this rule with `// DEPRECATED: use X instead`
- Don't enforce during Phase 1-2; just document
- Enforce in Phase 3 (new data files must follow these rules)

---

## Testing Strategy Matrix

Define testing approach for each component type:

| Component Type | Test Strategy | Tools | Examples |
|---|---|---|---|
| **Commands** | Unit test: input → command → events | Jest/Vitest | MoveCommand, AttackCommand, UseItemCommand |
| **Events** | Integration test: command → event → listener side effects | Jest + event listener mocks | DamageEvent → UI updates, DamageEvent → Quest checks |
| **Data Files (JSON)** | Validation script catches schema errors and references | Custom validator | All items.json, monsters.json reference valid behaviors |
| **Behaviors (pure functions)** | Unit test: input → output | Jest | damage calculation, heal calculation, effect logic |
| **Simulation (world state changes)** | Integration test: command → simulation → world state | Harness + world inspection | Move command changes position, combat changes health |
| **UI (render state)** | End-to-end browser test | Playwright/Cypress | UI updates when damage event fires, health bar reflects state |
| **Adapters** | Smoke test: old system + new system produce same results | Jest | Old CombatManager.onDamage + new events.emit produce same world state |

**Phase 1-2 focus:** Unit tests for commands, integration tests for events, adapters  
**Phase 3+ focus:** Expand validation scripts to catch data errors  

**Budget:** If a system has 0% test coverage, start with 50% (happy path + one failure case).

---

## Phase 3: Data-Driven Design (Weeks 6-9)

**Owner:** Content Lead  
**Timeline:** 4 weeks  
**Goal:** Prove that content can be data-only; no code changes needed to add items/monsters

### 3.0 Establish GameDataManager with Explicit Loading Order (Week 6, Day 1 - CRITICAL)
**Problem:** If MonsterLoader and ItemLoader run in parallel, MonsterLoader might try to validate loot item references before ItemLoader has populated the item registry. Validation fails or passes incorrectly.

**Solution:** Centralized GameDataManager with strict loading sequence and atomic database writes:

```typescript
// game/loaders/GameDataManager.ts
class GameDataManager {
  constructor(db) {
    this.db = db;
  }

  async loadAll(): Promise<void> {
    // MUST load in this exact order
    console.log('Loading items...');
    await this.loadItems(); // Items must be first (no dependencies)
    
    console.log('Loading monsters...');
    await this.loadMonsters(); // Monsters depend on items (loot references)
    
    console.log('Loading locations...');
    await this.loadLocations(); // Locations depend on monsters (spawns)
    
    console.log('Data loaded successfully');
  }

  private async loadItems() {
    const itemsData = require('../data/items.json');
    this.itemRegistry = itemsData.map(validateAndCreateItem);
    // Atomically persist all items in single transaction
    await this.db.run('BEGIN');
    try {
      for (const item of this.itemRegistry) {
        await this.db.run('INSERT INTO items (id, data) VALUES ($1, $2)', [item.id, JSON.stringify(item)]);
      }
      await this.db.run('COMMIT');
    } catch (err) {
      await this.db.run('ROLLBACK');
      throw err;
    }
  }

  private async loadMonsters() {
    const monstersData = require('../data/monsters.json');
    // At this point, this.itemRegistry is fully populated
    this.monsterRegistry = monstersData.map(m => validateMonster(m, this.itemRegistry));
    // Atomically persist
    await this.db.run('BEGIN');
    try {
      for (const monster of this.monsterRegistry) {
        await this.db.run('INSERT INTO monsters (id, data) VALUES ($1, $2)', [monster.id, JSON.stringify(monster)]);
      }
      await this.db.run('COMMIT');
    } catch (err) {
      await this.db.run('ROLLBACK');
      throw err;
    }
  }

  private async loadLocations() {
    const locationsData = require('../data/locations.json');
    // At this point, both registries are populated
    this.locationRegistry = locationsData.map(l => validateLocation(l, this.monsterRegistry));
    // Atomically persist
    await this.db.run('BEGIN');
    try {
      for (const location of this.locationRegistry) {
        await this.db.run('INSERT INTO locations (id, data) VALUES ($1, $2)', [location.id, JSON.stringify(location)]);
      }
      await this.db.run('COMMIT');
    } catch (err) {
      await this.db.run('ROLLBACK');
      throw err;
    }
  }
}
```

**Implementation note:** Use `db.run()` with explicit BEGIN/COMMIT blocks. The AsyncLocalStorage system ensures all nested queries use the same connection, making transactions safe and atomic.

**Validation scripts must also respect this order:**
```bash
# scripts/validate-content.js
validate-items.js    # First
validate-monsters.js # Second (can reference items)
validate-locations.js # Third (can reference monsters)
```

**Acceptance criteria:**
- [ ] `GameDataManager` exists and loads in strict order: Items → Monsters → Locations
- [ ] Validation scripts follow same order
- [ ] If loading fails at any stage, error message is clear (e.g., "Monster goblin references invalid item item_does_not_exist")
- [ ] Cross-file references can only fail if data is actually broken, not due to loading order

**Why:** Prevents race conditions and silent validation failures. Ensures that when MonsterLoader references an item, that item is guaranteed to exist.

### 3.1 Migrate Items to JSON (Week 6)
Move item definitions out of code into `data/items.json`. **Items load FIRST via GameDataManager (no dependencies).**

**Deliverables:**
1. **Item data schema (Zod or JSON Schema):** Define valid structure for items (required fields, types, constraints)
   ```typescript
   // Using Zod (recommended)
   const ItemSchema = z.object({
     id: z.string().regex(/^item_/),
     type: z.enum(['weapon', 'armor', 'potion']),
     name: z.string().min(1),
     damage: z.number().min(0),
     rarity: z.enum(['common', 'uncommon', 'rare']),
     behavior: z.string(), // Must match a registered behavior
   });
   ```
2. `data/items.json` with 10+ existing items (validated against schema)
3. `game/loaders/ItemLoader.js` (parses JSON, validates with Zod, returns usable items)
4. `game/behaviors/itemBehaviors.js` (lookup table: `weapon:basic_damage` → function, registered at startup)
5. **Validation script:** `scripts/validate-items.js` 
   - Checks IDs (no duplicates, match naming convention)
   - Checks behavior references (all behaviors exist)
   - Uses same Zod schema as runtime
   - **Runs FIRST in validation sequence (no dependencies)**
6. Integration with GameDataManager: `GameDataManager.loadItems()` calls ItemLoader and validates
7. Test: 5+ test cases (item creation, behavior execution, invalid data caught)

**Acceptance criteria:**
- [ ] All existing items are in `data/items.json`
- [ ] ItemLoader produces functionally identical item objects to old system
- [ ] Can add a new item (edit JSON) without touching code
- [ ] Validation script catches bad behavior references (uses Zod schema)
- [ ] ItemLoader integrated into GameDataManager.loadItems()
- [ ] All 5 tests pass

**Example item in JSON:**
```json
{
  "id": "item_iron_sword",
  "type": "weapon",
  "name": "Iron Sword",
  "damage": 10,
  "rarity": "common",
  "behavior": "weapon:basic_damage"
}
```

### 3.2 Migrate Monsters to JSON (Week 7)
Same pattern as items. **Monsters load SECOND via GameDataManager (depends on items being loaded first).**

**Deliverables:**
1. **Monster data schema (Zod):** Define valid structure
   ```typescript
   const MonsterSchema = z.object({
     id: z.string().regex(/^monster_/),
     type: z.string(),
     name: z.string(),
     health: z.number().min(1),
     damage: z.number().min(0),
     ai: z.string(), // Must match registered AI pattern
     loot: z.array(z.string()), // Each must be valid item ID
   });
   ```
2. `data/monsters.json` with all current monsters (validated against schema)
3. `game/loaders/MonsterLoader.js` (parses, validates, returns)
4. `game/behaviors/aiPatterns.js` (lookup: `monster:basic_aggro` → function)
5. Validation: `scripts/validate-monsters.js` 
   - Checks item references (guaranteed valid because items loaded first)
   - Checks AI patterns exist
   - **Runs SECOND in validation sequence (after items)**
6. Integration with GameDataManager: `GameDataManager.loadMonsters()` validates against itemRegistry
7. Test: 5+ test cases

**Acceptance criteria:**
- [ ] All existing monsters are in `data/monsters.json`
- [ ] MonsterLoader produces functionally identical objects to old system
- [ ] AI behaviors execute correctly from JSON reference
- [ ] **Validation catches invalid item references in loot (uses Zod schema + itemRegistry)**
- [ ] MonsterLoader integrated into GameDataManager.loadMonsters()
- [ ] Zod schema reused in validation script (schema is source of truth)

**Example monster in JSON:**
```json
{
  "id": "monster_goblin",
  "type": "monster",
  "name": "Goblin",
  "health": 15,
  "damage": 5,
  "ai": "monster:basic_aggro",
  "loot": ["item_gold_coin"]
}
```

### 3.3 Migrate Locations/World to JSON (Week 8-9)
Same pattern for map/world data. **Locations load THIRD via GameDataManager (depends on monsters being loaded first).**

**Deliverables:**
1. **Location data schema (Zod):** Define valid structure
   ```typescript
   const LocationSchema = z.object({
     id: z.string().regex(/^location_/),
     name: z.string(),
     terrain: z.enum(['forest', 'mountain', 'plains']), // from real spec
     biome: z.enum(['temperate', 'desert', 'arctic']),
     connections: z.record(z.string()), // north, south, east, west → location IDs
     spawns: z.array(z.object({
       monsterId: z.string(), // Must be valid monster ID
       weight: z.number().min(0).max(1),
     })),
   });
   ```
2. `data/locations.json` with all map data (validated against schema)
3. `game/loaders/LocationLoader.js`
4. Validation: `scripts/validate-locations.js`
   - Check all location connections point to valid locations
   - Check all monster references are valid (guaranteed valid because monsters loaded first)
   - Uses Zod schema (schema is source of truth)
   - **Runs THIRD in validation sequence (after items and monsters)**
5. Integration with GameDataManager: `GameDataManager.loadLocations()` validates against monsterRegistry
6. Test: 5+ test cases (connections, spawns, terrain, cross-location refs)

**Acceptance criteria:**
- [ ] All world locations in `data/locations.json`
- [ ] LocationLoader produces identical terrain/connection data
- [ ] **Validation catches broken location references and invalid monsters (Zod validation)**
- [ ] LocationLoader integrated into GameDataManager.loadLocations()
- [ ] Can add a new location by editing JSON only

**Example location in JSON:**
```json
{
  "id": "location_forest",
  "name": "Dark Forest",
  "terrain": "forest",
  "biome": "temperate",
  "connections": {
    "north": "location_mountains",
    "east": "location_village"
  },
  "spawns": [
    { "monsterId": "monster_goblin", "weight": 0.6 },
    { "monsterId": "monster_wolf", "weight": 0.4 }
  ]
}
```

**Milestone (end of Phase 3):** 
All core world data (items, monsters, locations) is in JSON files. Adding new content requires 0 code changes.

---

## Phase 4: Automation & Docs (Weeks 10-11)

**Owner:** QA Lead + Documentation Owner  
**Timeline:** 2 weeks  
**Goal:** Automate quality checks; codify design decisions

### 4.1 Expand Validation Scripts (Week 10)

**Status: Partially complete.** Database repair/validation already exists:
- ✅ `db/json-repair.js` (131 LOC) — JSON validation/repair utilities
- ✅ `db/numeric-fields.js` (64 LOC) — Type conversion and validation
- ✅ `db/column-utils.js` (60 LOC) — Column introspection

**Still needed:** Content data file validation (items.json, monsters.json, locations.json)

**Deliverables:**
1. `scripts/validate-content.js` (consolidated validator for JSON data files)
2. Hook into pre-commit (run validation before commit)
3. CI integration (fail build if validation fails)
4. Documentation of validation rules

**Validation checks (content files only):**
- [ ] No duplicate IDs across all JSON files (items, monsters, locations)
- [ ] All monster loot references point to valid items
- [ ] All location connections point to valid locations
- [ ] All behavior references exist in behavior lookup tables
- [ ] No orphaned data (unused items, unreachable locations)
- [ ] No circular location connections
- [ ] ID naming convention enforced (e.g., `item_*`, `monster_*`, `location_*`)

**Acceptance criteria:**
- [ ] Validation script catches 3+ real errors in sample data
- [ ] Output is human-readable (shows which file, which line, what's wrong)
- [ ] Pre-commit hook blocks commits with validation errors
- [ ] CI fails if validation fails (gated on merge)

**Example validation output:**
```
✓ 247 items verified
✓ 43 monsters verified
✓ 18 locations verified
✗ 3 broken references found:
  - monster.json line 45: loot references item_invalid_gold
  - location.json line 12: connection "north" points to location_does_not_exist
  - item.json line 89: behavior reference "weapon:fire_blaze" not found
```

### 4.2 Write Permanent Architecture Docs (Week 11)

**Deliverables:**

1. **ARCHITECTURE_EXECUTION.md** (from Phase 1 ARCHITECTURE.md)
   - Finalized entity lifecycle diagrams
   - Turn processing with timing info
   - Data ownership rules (from migration policy)
   - 2000 words

2. **ENTITY_LIFECYCLE.md**
   - How entities spawn (from input to world state)
   - State transitions (alive → dead → despawned)
   - Event timeline per transition
   - 500 words + diagrams

3. **TURN_PROCESSING.md**
   - Input → Command → Simulation → Events → Render
   - Timing budget per stage
   - Concurrency rules (single-threaded? turn-locked?)
   - 800 words + sequence diagram

4. **COMBAT_PIPELINE.md**
   - Turn order determination
   - Action resolution (sequence of steps)
   - Damage/heal calculation
   - Effect application order
   - 600 words + flowchart

5. **CONTENT_AUTHORING.md**
   - How to add items (step-by-step)
   - How to add monsters (step-by-step)
   - How to add locations (step-by-step)
   - How to add behaviors (where to register, how to test)
   - JSON schema reference
   - 1000 words + examples

**Acceptance criteria:**
- [ ] All 5 docs exist and are linked together
- [ ] New team member can onboard in <2 hours using these docs
- [ ] Docs match actual code (not aspirational)
- [ ] Diagrams are included (at least one per doc)

---

## Phase 5: Content Scaling (Weeks 12+)

**Owner:** Game Designer / Content Team  
**Timeline:** Ongoing  
**Goal:** Prove engine is stable; content velocity increases

**Milestones:**
1. **Week 12:** Add 10+ new items to items.json (content team only, 0 code changes)
2. **Week 13:** Add 5+ new monsters (content team only)
3. **Week 14:** Add 1+ new location (designer adds it, validates with validation script)

**Success criteria (end of Phase 5):**
- [ ] 80%+ of new content additions are JSON-only
- [ ] No new "Manager" classes created in Phase 5
- [ ] Content validation catches all proposed errors before merge
- [ ] Content team can work independently (no code review needed for JSON)

**When this works:**
- New items added in 5 minutes (vs. 30 min with code changes)
- New monsters balanced by editing JSON numbers
- New locations added without touching game code
- Non-programmers can contribute mechanics

This is where you see the payoff: development velocity increases because you're mostly writing data, not debugging code.

---

## Current System Analysis

### Systems to Decouple (Priority Order)

1. **Combat System** (HIGH)
   - Currently tightly coupled to entities
   - Touches damage, effects, UI, quests
   - Refactoring here unblocks a lot
   - **Plan:** Extract turn queue, damage calculation, effect application

2. **Terrain/World System** (HIGH)
   - Multiple unfinished versions (see memory: PR #753, Phase 3)
   - This creates coupling uncertainty
   - **Plan:** Finish data spec first, then implement as clean config-based system

3. **Inventory System** (MEDIUM)
   - Likely intertwined with items, UI, quests
   - Benefit from item-as-data refactor
   - **Plan:** Move after items are data-driven

4. **Quest System** (MEDIUM)
   - Probably hooks into everything
   - Hard to refactor before combat/inventory work
   - **Plan:** Phase 3-4

5. **UI System** (MEDIUM)
   - Should be read-only consumer of events
   - Likely currently calls back into game state
   - **Plan:** Refactor after event system is in place

### Managers to Consolidate

- WorldManager → WorldData (no manager needed for static config)
- CombatManager → Split into TurnOrchestrator + DamageCalculator + EffectApplier
- InventoryManager → ItemContainer (simple data structure)
- QuestManager → QuestTracker (event listener, no orchestration)

---

## Phase Recap & Success Criteria

| Phase | Owner | Weeks | Key Deliverable | Go/No-Go Criteria |
|-------|-------|-------|---|---|
| **Phase 1** | Lead Architect | 1-2 | ARCHITECTURE.md + coupling map | Team reads docs; no major surprises in coupling analysis |
| **Phase 2** | Combat/Engine Lead | 3-5 | Movement refactored to commands + events | Movement works; zero regressions in existing code |
| **Checkpoint** | — | — | **Pattern validation** | Does command + event pattern feel right? If not, iterate Phase 2 before continuing. |
| **Phase 3** | Content Lead | 6-9 | Items, monsters, locations in JSON | 0 code changes to add new item/monster/location |
| **Checkpoint** | — | — | **Content author test** | Non-programmer can add item by editing JSON alone |
| **Phase 4** | QA + Docs | 10-11 | Validation in CI + 5 arch docs | Pre-commit blocks bad data; new hire onboards in <2h |
| **Phase 5** | Content Team | 12+ | New content velocity | 80%+ of additions are JSON-only |

---

## Decision Points & Risks

### Should we refactor everything at once?
**No.** The phased approach lets you validate each step before committing to the next. If Phase 2 (commands) feels clunky, fix it before moving to Phase 3.

### What if halfway through we realize the architecture is still wrong?
**That's fine.** The goal is to build visibility (docs) and reduce coupling. If you discover a better approach mid-way, you'll have the flexibility to pivot because systems are decoupled.

### What about existing content/features?
**Don't migrate them all at once.** Pick one system (items) as the pilot. Once that works and the team believes in the approach, migrate others. Some old systems can coexist with new ones temporarily.

### Performance concerns?
**Address after architecture stabilizes.** Decoupling often makes optimization easier (you can profile individual systems in isolation). Don't optimize for coupling you're about to remove.

---

## Timeline Estimate

- **Phase 1:** 2 weeks (documentation, coupling analysis)
- **Phase 2:** 3 weeks (movement only; commands + events)
- **Checkpoint:** Team validates pattern works (1-2 days, no phase time)
- **Phase 3:** 4 weeks (items → monsters → locations as data)
- **Checkpoint:** Content author test (1-2 days)
- **Phase 4:** 2 weeks (validation scripting + docs)
- **Phase 5:** Ongoing (content team uses the engine)

**Total:** ~11 weeks to a fundamentally more scalable architecture.

**Key difference from first plan:**
- Phase 2 was 4 weeks (too big); now 3 weeks (movement only)
- Phase 3 unchanged; this is where the big payoff starts
- Checkpoints added to validate approach before investing further

---

## Execution Readiness Checklist

Before starting Phase 1, confirm:
- [ ] Lead Architect assigned (owns ARCHITECTURE.md)
- [ ] Combat/Engine Lead assigned (owns Phase 2)
- [ ] Content Lead assigned (owns Phase 3)
- [ ] QA Lead assigned (owns Phase 4)
- [ ] This roadmap is read by all stakeholders
- [ ] Checkpoints understood (pattern validation after Phase 2)
- [ ] Timeline is realistic for team size (adjust if needed)

## Week 1 Action Items (Phase 1, Week 1)

**Lead Architect:**
1. Create `docs/ARCHITECTURE.md` (stub with outline)
2. Schedule 3-4 interviews with team members: "Walk me through how a combat turn works"
3. Create coupling map spreadsheet (columns: Module A, Module B, # of calls)
4. Post-kickoff meeting: share initial findings, get feedback

**No code changes in Week 1.** Pure documentation and discovery.

---

## Critical Success Factors

1. **Checkpoints are go/no-go decisions.** Don't proceed to Phase 3 if Phase 2 pattern feels wrong. Fix it first.
2. **Reduce scope, not ambition.** Phase 2 is movement ONLY (not combat). This focuses validation and lets you catch issues early.
3. **Owners are real people with time.** If roles aren't filled, delay start. Don't proceed with "everyone owns it."
4. **Migration policy prevents chaos.** Systems coexist during transition. Old code doesn't disappear; it adapts via bridges.

---

## Notes

- This roadmap assumes Node.js/TypeScript codebase. Adjust language examples as needed.
- The phased approach is deliberate. Each phase should feel solid before starting the next.
- Documentation should be *kept up to date during work*, not written at the end.
- If you hit unexpected complexity, that signals the system is more coupled than your ARCHITECTURE.md reflected. Update the doc.
