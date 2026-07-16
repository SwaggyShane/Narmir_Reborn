# State Persistence Model

**Purpose:** Document how state flows from user intent through database writes and back to all connected clients.

**Date:** 2026-07-08 (baseline)  
**Status:** Living reference. Player mutators should go **Route → CommandHandler → engine** (not raw engine from routes). Outbox pattern sections are aspirational / deferred debt, not required.

---

## State Flow Overview

```
User Action (UI)
    ↓ [HTTP or Socket.io]
Route Handler (routes/kingdom-*.js)
    ↓ [Validation]
Game Logic (game/engine.js)
    ↓ [Calculation]
State Updates (updates object)
    ↓ [Atomic DB write]
PostgreSQL (narmir_local database)
    ↓ [Async broadcast]
Socket.io Event (game:turn)
    ↓ [WebSocket]
Client Socket Listener (socket-client.js)
    ↓ [Zustand setState]
React Render (components subscribe to store)
    ↓ [Display change]
User Sees Result
```

---

## Storage Layer: Kingdom State

The kingdom entity is stored in the `kingdoms` table in PostgreSQL with these key columns:

### Primary State Fields
| Column | Type | Updated | Purpose |
|--------|------|---------|---------|
| id | uuid | Once | Unique kingdom identifier |
| user_id | uuid | Once | Owner of this kingdom |
| turn | integer | Every turn | Current turn number |
| gold | integer | Multiple sources | Treasury |
| food | integer | Farms, consumption | Food supply |
| population | integer | Growth/decline | Population |
| happiness | integer (0-120) | Many systems | Citizen morale |
| wood | integer | Production | Resource |
| stone | integer | Production | Resource |
| iron | integer | Production | Resource |
| mana | integer | Mage towers | Magical energy |
| land | integer | One-time grants | Available land |

### Unit Counts
| Columns | Purpose |
|---------|---------|
| fighters, rangers, clerics, mages, thieves, ninjas | Combat troops |
| researchers, engineers, scribes | Support units |

### Building Counts
| Columns | Purpose |
|---------|---------|
| bld_farms, bld_barracks, bld_schools, ... | 30+ building types |

### JSON Fields
| Column | Type | Purpose |
|--------|------|---------|
| troop_levels | JSON | { unit: { level, xp, count } } |
| build_queue | JSON | { queueId: { building, turns_needed, turns_remaining } } |
| scout_progress | integer | Ring progression (0-1200) |
| active_effects | JSON | { effect_name: { turns_remaining } } |
| collected_lore | JSON array | [lore_id, ...] |
| training_allocation | JSON | { unit: allocation_count } |
| research_allocation | JSON | { discipline: allocation } |
| active_event | JSON | { event_type: { turns_remaining } } |

### Timestamps
| Column | Type | Updated |
|--------|------|---------|
| created_at | timestamp | Once |
| updated_at | timestamp | Every turn |
| last_turn_at | timestamp | Every turn |

---

## Write Path: From Command to Database

### Example: Player takes a turn

**1. User clicks "End Turn" button (UI)**
```javascript
// client/src/components/TurnButton.jsx
onClick={() => socket.emit('game:turn')}
```

**2. Route receives HTTP request (server)**
```javascript
// routes/kingdom-gameplay.js
POST /turn
  → Query: SELECT id, gold, food, ... FROM kingdoms WHERE id=$1
  → Validate: turns_stored > 0
  → Call: processTurn(kingdomRow, db)
```

**3. processTurn calculates state changes (server)**
```javascript
// game/engine.js, line 330
function processTurn(k, db) {
  const updates = {
    turn: k.turn + 1,
    gold: k.gold + goldIncome,
    food: k.food + foodProduction - foodConsumption,
    ...16 more phases...
  }
  const events = [
    { type: 'system', message: '🪙 Turn N: +X gold earned' },
    ...
  ]
  return { updates, events }
}
```

**4. Database writes atomically (PostgreSQL)**
```javascript
// db/schema.js, PgDbAdapter.run()
UPDATE kingdoms SET
  turn = $1,
  gold = $2,
  food = $3,
  population = $4,
  happiness = $5,
  mana = $6,
  troop_levels = $7,
  build_queue = $8,
  scout_progress = $9,
  ... (all 60+ fields)
  updated_at = NOW()
WHERE id = $N
```

**Key guarantee:** Either ALL fields update or NONE do (atomic transaction).

**5. Route sends response to client**
```javascript
// routes/kingdom-gameplay.js
res.status(200).json({
  success: true,
  updates: { turn, gold, food, ... },
  events: [ ... ]
})
```

---

## Broadcast Path: From Database to All Clients

### Example: Other players need to see your turn

**1. Server broadcasts event (within route handler)**
```javascript
// After DB write succeeds
io.emit('game:turn', {
  user_id: kingdom.user_id,
  kingdom_id: kingdom.id,
  updates: { turn, gold, food, ... },
  events: [ ... ]
})
```

**2. All connected clients receive broadcast**
```javascript
// client/src/socket-client.js
socket.on('game:turn', (data) => {
  handleGameTurn(data)
})
```

**3. Client updates local state (Zustand)**
```javascript
// Zustand store in client/src/stores/kingdom.js
const store = useKingdomStore()
store.setState({
  turn: data.updates.turn,
  gold: data.updates.gold,
  food: data.updates.food,
  ...
})
```

**4. React components re-render**
```javascript
// Any component subscribed to store
const gold = useKingdomStore(s => s.gold)
// Triggers re-render when gold changes
```

**5. DOM updates reflect new state**
```
Display changes: "Turn 500", "Gold: 45,000", etc.
```

---

## Read Path: Client Fetches Current State

### When client needs to refresh (e.g., after page load)

**1. Client requests current state**
```javascript
// socket-client.js, on connect
socket.emit('request:kingdom-state')
```

**2. Server queries database**
```javascript
// routes/kingdom-gameplay.js
GET /kingdom/:id
  → Query: SELECT * FROM kingdoms WHERE id=$1
  → Return: { gold, food, turn, ... }
```

**3. Server sends current state**
```javascript
io.emit('kingdom:state', kingdomRow)
```

**4. Client initializes store**
```javascript
socket.on('kingdom:state', (kingdom) => {
  store.setState(kingdom)
})
```

**5. React renders with initial state**

---

## JSON Serialization Constraints

The `troop_levels` and other complex fields are stored as JSON. Important constraints:

| Constraint | Why | Violation Result |
|-----------|-----|---------|
| No circular refs | PostgreSQL JSON limit | Data corruption |
| No functions | Can't serialize code | Data loss on save |
| No Date objects | JSON.stringify converts to string | Incorrect date parsing |
| No Infinity/NaN | JSON spec doesn't allow | JSON parse error |
| No undefined values | JSON spec omits undefined | Missing fields |

**Example valid `troop_levels`:**
```json
{
  "fighters": { "level": 5, "xp": 120, "count": 1000 },
  "rangers": { "level": 3, "xp": 45, "count": 500 },
  "clerics": { "level": 1, "xp": 0, "count": 0 }
}
```

**Example invalid:**
```json
{
  "fighters": {
    "level": 5,
    "created": new Date(),  // ❌ Can't serialize functions
    "calc": () => 5,         // ❌ Can't serialize functions
    "cache": circular_ref    // ❌ Can't serialize circular refs
  }
}
```

---

## Transaction Model

### Current Implementation (PgDbAdapter)

Uses PostgreSQL savepoints for nested transactions:

```javascript
// db/schema.js
async run(sql, params) {
  const connection = await this.pool.acquire()
  try {
    // Auto-begin transaction if not already in one
    if (!transaction) {
      await connection.query('BEGIN')
    }
    
    const result = await connection.query(sql, params)
    
    if (isOutermost) {
      await connection.query('COMMIT')
    }
    
    return result
  } catch (err) {
    await connection.query('ROLLBACK')
    throw err
  } finally {
    this.pool.release(connection)
  }
}
```

### Guarantees

✅ Atomic: All updates succeed or all fail  
✅ Consistent: Database is never in partial-update state  
✅ Isolated: Other connections don't see uncommitted changes  
✅ Durable: Committed data survives system failure  

### Problem: processTurn() Makes No Explicit Guarantee

```javascript
// Current: no explicit transaction
processTurn(kingdom, db) {
  // Phase 1: food economy
  updates.food = ...
  
  // Phase 2: gold income
  updates.gold = ...
  
  // Phase 16: end of turn
  return { updates, events }
}

// Later: single DB write
db.run('UPDATE kingdoms SET ...', updates)
```

If DB write fails after processTurn completes, the game state is:
- Server-side: updated (in memory)
- Database: old values
- Client: needs refresh to sync

**Better approach (Phase 2):** Wrap entire turn in explicit transaction.

---

## State Consistency Issues

### Current Problems

**1. JSON Parsing Overhead**
```javascript
// Every turn, these JSON fields are parsed:
const troopLevels = safeJsonParse(k.troop_levels, {}, 'turn')
const buildQueue = safeJsonParse(k.build_queue, {}, 'turn')
const activeEffects = safeJsonParse(k.active_effects, {}, 'turn')
// ... 10 more parses
```

Can be ~50-100ms per turn.

**2. Defensive Healing**
Some fields are "stringified multiple times" due to bugs:
```javascript
// Heal by detecting string-of-string and parsing again
let val = safeJsonParse(raw, fallback, context)
while (typeof val === 'string') {
  val = safeJsonParse(val, fallback, context + '_nested')
}
```

Indicates data serialization bugs in past versions.

**3. Scout Ring Async**
```javascript
// After DB write succeeds, async DB call
revealRingHexes(db, k.id, updates, ring).catch(err =>
  console.error('Failed to reveal: ' + err)
)
```

If this fails silently, visibility won't update for that player.

---

## Optimizations for Phase 2

### 1. Pre-Parse JSON on Boot
```javascript
// Cache parsed troop_levels, build_queue, etc.
// Only re-parse if values change
```

### 2. Explicit Transaction Wrapper
```javascript
async function processTurnAtomic(kingdom, db) {
  await db.begin()
  try {
    const result = await processTurn(kingdom, db)
    await db.commit()
    return result
  } catch (err) {
    await db.rollback()
    throw err
  }
}
```

### 3. Outbox Pattern
```javascript
// Instead of:
UPDATE kingdoms SET ...
io.emit('game:turn', ...)

// Use:
INSERT INTO outbox (event_type, payload) VALUES (...)
UPDATE kingdoms SET ...
COMMIT

// Separate async processor:
SELECT * FROM outbox WHERE processed=false
LIMIT 100
io.emit(event_type, payload)
UPDATE outbox SET processed=true
```

This ensures events are always broadcast, even if server crashes.

---

## Data Flow Diagram: The Entire Picture

```
User (Web Browser)
  ↓ (Click button)
React Component
  ↓ (socket.emit)
Socket.io Client
  ↓ (WebSocket)
Network
  ↓
Socket.io Server
  ↓ (Route handler)
Express Route Handler
  ↓ (processTurn call)
Game Logic Engine
  ↓ (return { updates, events })
Route Handler
  ↓ (db.run)
PostgreSQL Pool
  ↓
Database (UPDATE kingdoms...)
  ↓ (success)
Route Handler
  ↓ (io.emit)
Socket.io Server
  ↓ (broadcast to all clients)
Network
  ↓
Socket.io Client
  ↓ (on('game:turn'))
Socket Listener
  ↓ (store.setState)
Zustand Store
  ↓ (subscribers notify)
React Component
  ↓ (re-render)
HTML DOM
  ↓
User Sees Updated Display
```

---

## Next: Phase 2 Improvements

1. **Command Validation:** Commands validated before entering game loop
2. **Event Sourcing:** Events stored in database for replay/debugging
3. **Outbox Pattern:** Guaranteed broadcast even if server crashes
4. **Transaction Boundaries:** Explicit atomic scopes
5. **State Machine:** Validated state transitions per entity
6. **Pre-parsing:** Cache JSON to avoid repeat parses per turn
