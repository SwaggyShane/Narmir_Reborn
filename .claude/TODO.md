# Expedition Processing: Future Architectural Optimizations

## Current State
- ✅ CASE/WHEN batching: 99.95% reduction in database round-trips
- ✅ Connection pool exhaustion eliminated
- Tested up to: ~20 concurrent players (60 expeditions)

## Architectural Changes for Further Optimization

### Priority 1: Async Reward Processing ⭐⭐⭐⭐⭐
**Impact**: Free connections immediately, eliminate lock contention
**Complexity**: Medium
**Timeline**: 1-2 days

**Design**:
```javascript
// Phase 1: Update expeditions (fast, single batch) - holds connection 1ms
UPDATE expeditions SET turns_left = 0, rewards_claimed = 1

// Phase 2: Queue rewards for async processing
Queue reward { type, rangers, fighters, freshK } → Redis/RabbitMQ
Release database connection immediately

// Phase 3: Worker processes rewards asynchronously (background)
// Can run in separate process/thread, no player impact
```

**Trade-off**: Rewards notification delayed by ~50-100ms, but connection pool freed instantly

**When to implement**: After hitting connection pool limits with 50+ concurrent players

---

### Priority 2: Expedited Completion + On-Demand Claiming ⭐⭐⭐⭐
**Impact**: Reduce transaction lock time by 80%
**Complexity**: Low
**Timeline**: 1 day

**Design**:
- Mark expeditions DONE immediately (single UPDATE)
- Show player "Completed! Click to claim" button
- Claim rewards on-demand OR background batch process next turn

**Trade-off**: Minor UX change (rewards not instant), massive lock time reduction

**When to implement**: If async rewards are too complex, this is faster fallback

---

### Priority 3: Cross-Kingdom Batch Processing ⭐⭐⭐
**Impact**: Single database sweep instead of 20 separate calls
**Complexity**: High (transaction isolation rethinking)
**Timeline**: 2-3 days

**Design**:
```javascript
// OLD: Sequential per-kingdom
kingdoms.forEach(k => processTurn(k))

// NEW: Single batch sweep
const allExps = await db.all("SELECT * FROM expeditions WHERE turns_left > 0")
const updates = batchProcessAllKingdoms(allExps)
await db.run("UPDATE ... CASE WHEN ...")
```

**Trade-off**: Complex state management, harder to debug, breaks kingdom isolation

**When to implement**: Only if async + expedited completion insufficient for 100+ players

---

### Priority 4: Database-Side Processing (Stored Procedures) ⭐⭐⭐
**Impact**: Maximum efficiency, all logic in database
**Complexity**: High (requires PostgreSQL expertise)
**Timeline**: 2-3 days

**Design**:
```sql
CREATE FUNCTION process_all_expeditions()
  RETURNS TABLE(kingdom_id int, rewards jsonb)
AS $$
  -- All reward calculation in PL/pgSQL
  -- Single connection, zero round-trips
$$ LANGUAGE plpgsql;
```

**Trade-off**: Business logic tied to database, harder to maintain/test

**When to implement**: If other optimizations insufficient for 200+ players

---

### Priority 5: Materialized View / Pre-calculated State ⭐⭐
**Impact**: Skip heavy computation during critical path
**Complexity**: Medium
**Timeline**: 1-2 days

**Design**:
- Pre-calculate all expedition rewards before turn processing starts
- Just apply pre-calculated results during turn cycle
- Reduces lock time but adds pre-calculation overhead

**When to implement**: If reward calculation becomes dominant bottleneck

---

## Performance Targets

| Players | Concurrent Expeditions | Current (CASE/WHEN) | Target | Solution |
|---------|----------------------|---------------------|--------|----------|
| 20      | 60                   | 3 DB calls ✅       | -      | Current sufficient |
| 50      | 150                  | 3 DB calls ✅       | -      | Current sufficient |
| 100     | 300                  | 3 DB calls ✅       | 1ms/call | Current sufficient |
| 200+    | 600+                 | 3 DB calls ⚠️       | 0.5ms/call | Async Rewards |

## Monitoring Checklist

When considering these optimizations, monitor:
- [ ] Database connection pool utilization (target: <15 of 20 used)
- [ ] Stale transaction connections reaped per turn
- [ ] ProcessTurn latency (should be <500ms)
- [ ] Reward claiming delay for player (should be <100ms)
- [ ] Failed connection timeouts (should be 0)

## Related Issues
- Production deployment: 11 stale connections reaped at 18:55:37 UTC
- Connection pool max: 20
- Mountain expeditions: 100 turns (high concurrency impact)
- Baseline optimization: CASE/WHEN batching (commit: 61b4937)
