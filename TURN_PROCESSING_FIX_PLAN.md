# Plan: Fix Connection Pool Exhaustion (502 Error Root Cause)

## Context: The Core Problem

**The 502 Error Root Cause**: Connection pool exhaustion.

The `/turn` endpoint wraps the entire operation in a single database transaction that acquires one connection from the pool (max 20) and holds it for ~1.6 seconds before releasing it. This means:

- Max concurrent turns = 20 connections ÷ 1.6 seconds/turn = **~12-13 turns/sec**
- At 100 concurrent players requesting turns: (100 requests - 12 processed) = 88 requests waiting in queue
- After 10 seconds: queued requests timeout → **502 Bad Gateway errors**

The transaction holds the connection even during work that doesn't require atomicity:
- **init-queries** (429ms): Reading kingdom state for context — doesn't need transaction
- **refresh-queries** (288ms): Reading final state after write — doesn't need transaction

These two reads account for **717ms of 1,641ms** (44% of total time) and keep the connection locked unnecessarily.

**Simple fix**: Move init-queries and refresh-queries outside the transaction. This reduces per-turn from 1.6s to ~900ms, improving throughput from 12 to **~22 concurrent turns/sec** — still not enough for 100 players, but enough to eliminate the immediate 502 errors and test whether other bottlenecks exist.

**Scope of this plan**: Fix pool exhaustion first. Only optimize CPU/batching if pool exhaustion is still an issue after this change.

---

## Root Cause: Connection Pool Math

**File**: `routes/kingdom-gameplay.js` lines 553-590 (`/turn` endpoint)  
**File**: `db/schema.js` lines 271-341 (`db.withTransaction()` implementation)

```
GET /turn for player 1
├─ Acquire connection from pool (1 of 20 available)
├─ BEGIN TRANSACTION
├─ init-queries (429ms)          ← Reading data, no writes, doesn't need txn
├─ engine.processTurn() (347ms)  ← CPU-only, doesn't need txn
├─ applyUpdates() (292ms)        ← Writes, needs txn
├─ resolveExpeditions() (285ms)  ← Writes, needs txn
├─ refresh-queries (288ms)       ← Reading final data, doesn't need txn
├─ COMMIT TRANSACTION
└─ Release connection (1.6s later)
```

**Total time holding connection**: 1,641ms

**Pool math**:
- 20 connections in pool
- Each held for 1,641ms per turn
- Throughput = 20 ÷ 1.641 = **~12 turns/sec**
- At 100 concurrent players: 100 requests arrive/sec, 12 can acquire connection, 88 queue
- Queue wait = 88 ÷ 12 = 7+ seconds
- With 10s timeout: requests fail with **502 Bad Gateway**

**What must stay in transaction** (determinism required):
- `applyUpdates()` (292ms) — writes kingdom state
- `resolveExpeditions()` (285ms) — writes expedition rewards
- `engine.processTurn()` (347ms) — calculates what gets written, reads reference data

**What can move outside** (no atomicity requirement):
- `init-queries` (429ms) — reading context data before calculation
- `refresh-queries` (288ms) — reading final state for client response
- **Total: 717ms (44% of 1,641ms)**

**Expected improvement**: Moving these outside reduces per-turn from 1,641ms to ~924ms (560ms of overhead removed due to parallelization).

New throughput = 20 ÷ 0.924 = **~21-22 turns/sec** (improvement from 12)

At 100 concurrent players: 100 requests/sec, 21 processed/sec, ~4 second queue depth. Requests no longer timeout (within 10s window).

**This is the fix.** Simple. Focused. Addresses the root cause directly.

---

## The Fix: Release Connection Sooner

**Principle**: Acquire connection only for operations that require atomicity. Release it as soon as writes are committed.

### Phase 1: Move init-queries and refresh-queries Outside Transaction

**Goal**: Release connection after COMMIT, before reading final state. Reduce per-turn from 1,641ms to ~924ms.

**Current code** (`routes/kingdom-gameplay.js` lines 553-590):
```javascript
const result = await db.withTransaction(async (client) => {
  // init-queries (429ms)
  const kingdom = await getKingdom();
  const expeditions = await getExpeditions();
  const heroes = await getHeroes();
  
  // processTurn (347ms)
  const updates = await engine.processTurn(kingdom, expeditions, heroes);
  
  // applyUpdates (292ms) 
  await applyUpdates(kingdom.id, updates);
  
  // resolveExpeditions (285ms)
  const rewards = await resolveExpeditions(kingdom.id);
  
  // refresh-queries (288ms) ← PROBLEM: Still inside transaction
  const refreshedKingdom = await getKingdom();
  const unreadCount = await getUnreadCount();
  
  return { refreshedKingdom, unreadCount, rewards };
});
```

**New code** (after fix):
```javascript
// PREFETCH: Outside transaction, parallel reads
const kingdom = await getKingdom();
const expeditions = await getExpeditions();
const heroes = await getHeroes();

// TRANSACTION: Only necessary writes
const updates = await db.withTransaction(async (client) => {
  // processTurn (347ms)
  const updates = await engine.processTurn(kingdom, expeditions, heroes);
  
  // applyUpdates (292ms)
  await applyUpdates(kingdom.id, updates);
  
  // resolveExpeditions (285ms)
  const rewards = await resolveExpeditions(kingdom.id);
  
  return { rewards };
});

// POSTFETCH: Outside transaction, parallel reads
const refreshedKingdom = await getKingdom();
const unreadCount = await getUnreadCount();

const result = { refreshedKingdom, unreadCount, ...updates };
```

**Key changes**:
- Move getKingdom/getExpeditions/getHeroes calls BEFORE `db.withTransaction()`
- Move refresh queries AFTER `db.withTransaction()`
- Transaction now only wraps processTurn + applyUpdates + resolveExpeditions (~924ms instead of 1,641ms)

**Correctness concern**: init-queries prefetch data; what if kingdom state changes between prefetch and write?

**Answer**: This is fine. The prefetch is for *input* to the game logic (what was the situation when the turn started). If another request modifies the kingdom between prefetch and write, those modifications apply *after* this turn completes. Order of turns is preserved by `withTurnLock()` (per-player serialization at line 181).

**File changes required**:
- `routes/kingdom-gameplay.js` lines 553-590: Move init-queries before transaction, refresh-queries after transaction

**Measurement after Phase 1**:
- [ ] Single-player turn latency: measure (target: <1,000ms, was 1,641ms)
- [ ] Transaction duration only: measure (target: <600ms, was 1,641ms)
- [ ] Load test 50 concurrent players: measure p50, p95, error rate
- [ ] Load test 100 concurrent players: measure p50, p95, error rate (502 errors should cease)
- [ ] Correctness: Run same kingdom 5 times, verify identical outputs

**Pass gate**: Single-player <1,000ms AND 100 concurrent <10% error rate (down from 502s)

---

### Phase 2: Optimize Write Transaction (Only if Phase 1 insufficient)

**Conditional**: Only implement if Phase 1 measurement shows:
- Still >10% 502 errors at 100 concurrent, OR
- p95 latency still >2 seconds

**Changes** (in priority order):

**2a: Batch expedition updates** (50-100ms savings)
```sql
-- OLD: Separate UPDATE per completed expedition
-- NEW: CASE/WHEN to batch all into single UPDATE
UPDATE expeditions
SET rewards_claimed = CASE 
  WHEN id = $1 THEN true
  WHEN id = $2 THEN true
  ...
END
WHERE id = ANY($N);
```

**2b: Remove redundant kingdom fetch in resolveExpeditions** (40-50ms savings)
File: `game/engine.js` line 1851 — currently re-fetches kingdom despite already loaded in prefetch phase

**2c: Consolidate hero updates** (20-30ms savings)
Batch hero XP updates into single statement with CASE/WHEN

**Total Phase 2 savings if needed**: ~110-180ms additional (reduces per-turn from 924ms to ~800ms)

---

### Phase 3: Optimize CPU Work (Only if Phases 1-2 insufficient)

**Conditional**: Only implement if Phase 2 measurement shows:
- Still >5% 502 errors at 100 concurrent, OR
- p95 latency still >1.5 seconds

**Note**: CPU work is only 347ms of 1,641ms (21%). After Phase 1 (save 717ms), CPU becomes 347/924 = 38% of remaining time. Only optimize if it's blocking.

**Changes**:

**3a: Profile before refactoring** (REQUIRED, 2-3 hours)
Add timing instrumentation to the 18 attunement functions and JSON operations:
- Which attunement functions actually take >10ms?
- How many JSON.parse/stringify calls per turn?
- How many synergy lookups?

**3b: Optimize based on profiling data, not blind refactoring**
- If JSON parsing is the culprit: Cache parsed objects
- If attunements are slow: Refactor only the slow ones, leave others as-is
- If synergy lookups are >100/turn: Add caching

**Total Phase 3 savings if needed**: ~50-150ms (depends on profiling findings)

---

## Implementation Plan

### Phase 1: Simple 2-Hour Fix

**Effort**: 2-3 hours (code change 30 mins, measurement 1.5-2 hours)

**Steps**:
1. Move init-queries before `db.withTransaction()` call
2. Move refresh-queries after `db.withTransaction()` returns
3. Measure single-player latency (target: <1,000ms)
4. Measure load test at 50 and 100 concurrent players
5. Check if 502 errors cease

**Success criteria**: 
- Single-player <1,000ms
- 100 concurrent players: <10% error rate (was ~100% 502s)

**If success**: Deploy. Done. Pool exhaustion fixed.

**If still insufficient**: Proceed to Phase 2 (conditional).

### Phase 2: Batch Operations (Conditional)

**Effort**: 3-4 hours (only if Phase 1 insufficient)

**Only implement if**:
- Phase 1 shows >10% errors at 100 concurrent, OR
- p95 latency >2 seconds

**Changes**: Batch expedition/hero updates, remove redundant kingdom fetch

**Success criteria**: 
- p95 latency <1.5 seconds at 100 concurrent

### Phase 3: CPU Optimization (Conditional)

**Effort**: 4-6 hours (only if Phase 1-2 insufficient)

**Only implement if**:
- Phases 1-2 show >5% errors at 100 concurrent

**Approach**: Profile first, optimize based on data (don't blindly consolidate)

---

## Expected Impact

### Before Phase 1
- Per-turn duration: ~1,641ms
- Max concurrent throughput: ~12 turns/sec
- At 100 concurrent players: 88 requests queue, timeout, **502 errors**

### After Phase 1
- Per-turn duration: ~924ms (transaction only, reads parallelized)
- Max concurrent throughput: ~21-22 turns/sec
- At 100 concurrent players: Queue depth ~5, no timeouts, **502 errors cease**

### If Phase 2 needed
- Per-turn duration: ~800ms
- Max concurrent throughput: ~25 turns/sec

### If Phase 3 needed
- Per-turn duration: ~650-750ms
- Max concurrent throughput: ~26-30 turns/sec

---

## Measurement Strategy

### Phase 1 Measurement

**Before changes** (baseline):
```bash
# Single-player turn latency (10 runs)
curl -X POST http://localhost/turn -u player123 | time
# Record: avg time, min, max

# Load test 50 concurrent players
ab -n 500 -c 50 -X POST http://localhost/turn
# Record: mean, median, p95, failed requests

# Load test 100 concurrent players  
ab -n 1000 -c 100 -X POST http://localhost/turn
# Record: mean, median, p95, failed requests, error rate
```

**After Phase 1 changes**:
```bash
# Repeat same measurements
# Target: Single-player <1,000ms (was 1,641ms)
# Target: 100 concurrent errors <10% (was ~100% 502s)
```

**Correctness check**:
```bash
# Run same kingdom 5 times, diff outputs
for i in {1..5}; do
  curl -X POST http://localhost/turn -u player123 > /tmp/run$i.json
done
diff /tmp/run1.json /tmp/run2.json  # Should be identical
diff /tmp/run2.json /tmp/run3.json  # Should be identical
```

**Success criteria**:
- Single-player <1,000ms ✓
- 100 concurrent <10% error ✓
- Correctness: identical outputs ✓

**If all three pass**: Phase 1 complete. Pool exhaustion fixed. Deploy.

**If any fail**: Investigate and revert, do not proceed.

---

## Risk Assessment

| Phase | Risk | Mitigation |
|-------|------|-----------|
| 1 | Prefetch stale between read and write | `withTurnLock()` ensures per-player turn serialization; other players' modifications happen after this turn |
| 2 | Batch UPDATE syntax errors | Test on staging before production |
| 3 | CPU profiling data drives wrong conclusions | Measure 3+ times, profile specific functions not just totals |

## Key Constraints

- **Connection pool** (db/schema.js:591-648): Remains 20 connections; Phase 1 fix sufficient
- **withTurnLock()** (routes/kingdom-gameplay.js:181-199): Stays—per-player serialization preserves turn order
- **No schema changes**: Optimization is architectural only
- **Backward compatible**: Same API, faster responses

## Files to Change (Phase 1 Only)

- `routes/kingdom-gameplay.js` lines 553-590: Move init-queries before transaction, refresh-queries after
- That's it. Single file, ~50 lines of code change.

