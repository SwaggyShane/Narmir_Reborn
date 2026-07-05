# Plan: Architectural Overhaul for Turn Processing Scalability (502 Error Fix)

## Context

The game server's `/turn` endpoint exhibits a critical architectural problem: the entire turn operation is wrapped in a single monolithic database transaction that acquires one connection from a pool of 20 and holds it for ~1.6 seconds, forcing all database operations (reads, writes, parallelizable work) to execute sequentially on that single connection. This breaks scalability:

- **At 12 concurrent players**: connection pool exhaustion begins
- **At 100 concurrent players**: 80+ requests queue, timeout after 10 seconds → 502 errors
- **Even at 1 player**: sequential execution masks potential parallelism, inflates latency

The architecture violates basic principles of database concurrency by acquiring a connection for work that doesn't require a transaction, and sequencing work that could run in parallel.

---

## Root Cause Analysis (Verified by 3 Agents)

### Primary Problem: Monolithic Transaction

**File**: `routes/kingdom-gameplay.js` lines 553-590 (`/turn` endpoint)
**File**: `routes/kingdom-gameplay.js` lines 319-548 (`runTurn()` function)
**File**: `db/schema.js` lines 271-341 (`db.withTransaction()` implementation)
**File**: `db/schema.js` lines 181-199 (`withTurnLock()` function)

The /turn endpoint calls `db.withTransaction(() => runTurn())`, which:
1. Acquires **single connection** from pool (of 20 max)
2. Issues `BEGIN TRANSACTION`
3. Executes **all database operations** through that connection (no parallelism possible)
4. Issues `COMMIT TRANSACTION`
5. Releases connection back to pool (~1.6 seconds later)

During those 1.6 seconds, 1 of 20 connections is unavailable.

### Time Breakdown (from agent profiling)

| Operation | Duration | Problem |
|-----------|----------|---------|
| init-queries (3 SELECTs) | ~429ms | Marked `Promise.all()` but forced sequential on single connection |
| engine.processTurn() (CPU) | ~347ms | Repeated JSON parsing, 18 attunement functions, research synergy lookups |
| applyUpdates() (UPDATE) | ~292ms | Bulk update + JSON serialization overhead |
| resolveExpeditions() | ~285ms | Multiple sequential UPDATEs per expedition, N+1 patterns, redundant kingdom fetch |
| refresh-queries (2 SELECTs) | ~288ms | Should be 1 query, not 2; runs after transaction |
| **Total** | **~1,641ms** | |

### Secondary Problem: Engine CPU Work

**File**: `game/engine.js` lines 350-352 (`processTurn()`)

CPU-bound work (347ms) is bottlenecked by:
- Repeated `JSON.stringify()` / `JSON.parse()` of `troop_levels` object (5+ times in function)
- 18 sequential attunement processing functions, each doing JSON manipulation
- `calculateHappiness()` called early with complex component lookups
- Research synergy multiplier lookups via `getSynergyPassiveBonusMultiplier()` per hero
- Training field XP calculation loop

### Tertiary Problem: Query Inefficiency

**File**: `routes/kingdom-gameplay.js` lines 537-540 (refresh-queries)
**File**: `game/engine.js` lines 1851, 2146-2164 (resolveExpeditions)

- refresh-queries: 2 separate queries (`SELECT * FROM kingdoms WHERE id=$1` + `SELECT COUNT(*) FROM news WHERE...`) should be 1
- resolveExpeditions: Separate UPDATE per expedition instead of batched CASE/WHEN statement
- Redundant kingdom fetch in resolveExpeditions (line 1851) despite already loaded at line 559

---

## Proposed Solution: Transaction Boundary Redesign

**Principle**: Separate read-only operations from write operations. Minimize transaction scope to only writes that need atomicity.

### Phase 1: Extract Read-Only Operations (Highest Impact)

**Goal**: Move init-queries and refresh-queries outside transaction to use separate connections (parallelizable)

**Change**: Before entering transaction, fetch all needed data. After transaction, fetch refresh state.

```javascript
// BEFORE: All in one transaction
const kingdom = await db.withTransaction(async (client) => {
  const k = await getKingdom();     // 429ms sequential
  const expeditions = await getExpeditions();
  const news = await getNews();
  
  // process & write
  
  const refreshed = await getKingdom();  // 288ms sequential
  const unreadCount = await getUnreadCount();
});

// AFTER: Read outside, write inside
const kingdom = await getKingdom();        // 50ms parallel
const expeditions = await getExpeditions(); // parallel
const news = await getNews();               // parallel

await db.withTransaction(async (client) => {
  // process & write only
});

const refreshed = await getKingdom();      // 50ms parallel
const unreadCount = await getUnreadCount(); // parallel
```

**Expected improvement**: ~450-500ms saved (init 429ms + refresh 288ms, minus ~250ms overlap)

**New total after Phase 1**: ~1,100ms

**File changes required**:
- `routes/kingdom-gameplay.js` lines 553-590: Restructure endpoint to fetch before/after transaction
- `routes/kingdom-gameplay.js` lines 319-548: Separate `runTurn()` into `runTurnReadBefore()`, `runTurnWrite()`, `runTurnReadAfter()`

---

### Phase 2: Optimize Write Transaction

**Goal**: Reduce time spent inside write transaction from ~577ms to ~300ms

**Change 2a: Batch expedition updates**
```sql
-- OLD (per expedition):
UPDATE expeditions SET rewards_claimed = true WHERE id = $1;

-- NEW (all at once):
UPDATE expeditions
SET rewards_claimed = CASE 
  WHEN id = $1 THEN true
  WHEN id = $2 THEN true
  WHEN id = $3 THEN true
  ...
END
WHERE id = ANY($N);
```
**Savings**: 50-100ms

**Change 2b: Consolidate hero updates into main kingdom UPDATE**
```sql
-- OLD:
UPDATE kingdoms SET gold = $1, mana = $2, ... WHERE id = $3;
UPDATE heroes SET xp = CASE ... WHERE kingdom_id = $3;

-- NEW:
UPDATE kingdoms SET gold = $1, mana = $2, ... WHERE id = $3;
-- (heroes already in main update via JSON field or denormalized columns)
```
**Savings**: 20-30ms

**Change 2c: Remove redundant kingdom fetch in resolveExpeditions**
Use kingdom data already loaded in Phase 1 instead of re-fetching at line 1851
**Savings**: 40-50ms

**Change 2d: Combine refresh-queries into single query**
```sql
-- OLD:
SELECT rangers, fighters, ... FROM kingdoms WHERE id = $1;
SELECT COUNT(*) FROM news WHERE kingdom_id = $1 AND is_read = 0;

-- NEW:
SELECT k.rangers, k.fighters, ..., 
       (SELECT COUNT(*) FROM news WHERE kingdom_id = k.id AND is_read = 0) as unread
FROM kingdoms k WHERE k.id = $1;
```
**Savings**: 30-50ms (already done in Phase 1 by moving outside, but combine the two queries)

**Total Phase 2 savings**: ~140-230ms

**New total after Phase 2**: ~870ms

**File changes required**:
- `db/sql/kingdoms.js`: Batch expedition updates with CASE/WHEN
- `game/engine.js` lines 1840-2200: Remove kingdom refetch, use passed parameter instead
- `routes/kingdom-gameplay.js`: Consolidate refresh-query into single query

---

### Phase 3: Optimize CPU Work (engine.processTurn)

**Goal**: Reduce CPU overhead from 347ms to ~150ms

**Change 3a: Cache JSON parsing for troop_levels**
Keep `troop_levels` as object throughout `processTurn()`, not stringified/parsed 5+ times
```javascript
// OLD:
const troop_levels = JSON.parse(kingdom.troop_levels);
// ... use it
kingdom.troop_levels = JSON.stringify(troop_levels);
const newUpdates = {troop_levels: JSON.stringify(troop_levels)};
// ... later refetch and parse again

// NEW:
let troop_levels = JSON.parse(kingdom.troop_levels);
// ... use it throughout function
// ... at end: updates.troop_levels = troop_levels; (serialize once)
```
**Savings**: 30-50ms

**Change 3b: Consolidate attunement processing**
18 separate functions (`processGranaryAttunements()`, `processVaultAttunements()`, etc.) each do JSON parse/modify/stringify
Combine into single pass:
```javascript
// OLD:
const granaryUpdates = processGranaryAttunements(kingdom, ...);
const vaultUpdates = processVaultAttunements(kingdom, ...);
// ... 18 times
Object.assign(updates, granaryUpdates);
Object.assign(updates, vaultUpdates);

// NEW:
const attunementUpdates = processAllAttunements(kingdom, ...);
Object.assign(updates, attunementUpdates);
```
**Savings**: 40-80ms

**Change 3c: Lazy-evaluate expensive calculations**
Only calculate happiness, research bonuses if kingdom state changed
**Savings**: 20-40ms

**Change 3d: Cache synergy lookups**
Call `getSynergyPassiveBonusMultiplier()` once per turn, not per hero
**Savings**: 20-30ms

**Total Phase 3 savings**: ~110-200ms

**New total after Phase 3**: ~670ms

**File changes required**:
- `game/engine.js` lines 300-600: Refactor JSON handling, consolidate attunements
- `game/engine.js` lines 1050-1191: Cache synergy calculations

---

### Phase 4: Database Serialization Optimization

**Goal**: Reduce `convertNumericFields()` overhead during hydration

**Change**: Only filter columns that query actually returns, not all 50+ NUMERIC_FIELDS
```javascript
// OLD: Every row through full 50+ field loop
function convertNumericFields(row) {
  for (const field of NUMERIC_FIELDS) {
    if (row[field]) row[field] = parseInt(row[field]);
  }
  return row;
}

// NEW: Only requested fields
function convertNumericFields(row, requestedFields) {
  const fieldsToConvert = requestedFields.filter(f => NUMERIC_FIELDS.includes(f));
  for (const field of fieldsToConvert) {
    if (row[field]) row[field] = parseInt(row[field]);
  }
  return row;
}
```
**Savings**: 10-20ms per transaction

**New total after Phase 4**: ~650ms

**File changes required**:
- `db/schema.js` lines 99, 113, 240: Pass column list to `convertNumericFields()`

---

## Implementation Plan

### Order & Timeline

1. **Phase 1 (3-4 hours)**: Extract read-only operations
   - Lowest risk, highest impact
   - Test with single player first
   - Target: 1,100ms per turn
   
2. **Phase 2 (4-5 hours)**: Optimize write transaction
   - Medium complexity, medium risk
   - Batch queries, remove redundancy
   - Target: 870ms per turn
   
3. **Phase 3 (5-6 hours)**: CPU optimization
   - Highest complexity, medium risk
   - JSON caching, attunement consolidation
   - Target: 670ms per turn
   
4. **Phase 4 (2-3 hours)**: Serialization polish
   - Low complexity, low risk
   - Target: 650ms per turn

**Total estimated effort**: 14-18 hours of development + testing

---

## Expected Scalability Outcomes

### Before Optimization
- Per turn: ~1,600ms
- Max concurrent: ~12-13 turns/sec (20 connections ÷ 1.6s)
- At 100 players: 502 errors (80 requests timeout)

### After Phase 1
- Per turn: ~1,100ms
- Max concurrent: ~18 turns/sec
- At 100 players: Still insufficient

### After Phase 2
- Per turn: ~870ms
- Max concurrent: ~23 turns/sec
- At 100 players: Still insufficient

### After Phase 3
- Per turn: ~670ms
- Max concurrent: ~30 turns/sec
- At 100 players: ~3-4 request queue depth, ~100ms average wait per turn

### After Phase 4
- Per turn: ~650ms
- Max concurrent: ~31 turns/sec
- At 100 players: Acceptable (no 502 errors, <500ms p95 latency)

---

## Verification Strategy

### Phase 1 Testing
1. Profile single-player turn (baseline: ~1,600ms) ✓
2. Load test 50 concurrent players (measure: avg turn time, connection pool utilization)
3. Verify init-queries and refresh-queries now use separate connections (query logs)
4. Validate no data corruption (compare pre/post kingdom state)
5. **Pass criteria**: Single-player ~1,100ms, no 502s at 50 players

### Phase 2 Testing
1. Single-player profile (target: ~870ms)
2. Load test 50 concurrent players
3. Verify expedition updates use CASE/WHEN (query logs)
4. Validate all expeditions still complete correctly (sanity checks)
5. **Pass criteria**: Single-player ~870ms, no regressions at 50 players

### Phase 3 Testing
1. Single-player profile (target: ~670ms)
2. CPU profile via `console.time()` (verify JSON parsing reduced)
3. Load test 100 concurrent players
4. Verify attunement calculations still correct (sanity checks)
5. **Pass criteria**: Single-player ~670ms, no 502s at 100 players, <500ms p95

### Phase 4 Testing
1. Single-player profile (target: ~650ms)
2. Load test 100 concurrent players with sustained load
3. Monitor connection pool utilization (should not exceed 15-18 of 20)
4. Monitor for slow queries (PostgreSQL slow query log >100ms)
5. **Pass criteria**: p95 latency <500ms, no connection pool exhaustion, no slow queries

---

## Risk Mitigation

| Phase | Risk | Mitigation |
|-------|------|-----------|
| 1 | Data consistency (read outside txn) | Add logging at all read points, validate against snapshot |
| 2 | Query batching bugs | Test each expedition type separately before batching |
| 3 | JSON caching stale state | Add asserts to verify object not mutated, use immutable pattern |
| 4 | Serialization edge case | Add field validation, compare output before/after |

Each phase requires full test pass before proceeding. Rollback plan: revert single commit.

---

## Notes

- **Connection pool** (db/schema.js:591-648) remains 20; sufficient after Phase 1-3 optimization
- **withTurnLock()** (routes/kingdom-gameplay.js:181-199) preserved for per-player consistency—transaction lock only extends to write phase
- **AsyncLocalStorage** (db/schema.js:271-341) must support connections outside transaction context (Phase 1)
- No schema changes needed; optimization is architectural only
- All changes backward-compatible (same API, faster response)

