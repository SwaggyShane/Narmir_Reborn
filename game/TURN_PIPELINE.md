# Turn Pipeline: Detailed Flow & Bottlenecks

**Purpose:** Document the exact sequence of operations during a single turn, including timing, bottlenecks, and state mutation points.

**Date:** 2026-07-08 (baseline)  
**Status:** Living reference — line counts/latencies may drift; confirm against `game/engine.js` / `processTurn` before trusting exact numbers. Architecture boundary: routes → CommandHandler → engine (see `ARCHITECTURE.md`).

---

## High-Level Turn Lifecycle

```
Input (HTTP POST /turn)
  ↓
Route validation (kingdom exists, has turns)
  ↓
processTurn(kingdom, db) — 1429 lines, 16 major phases
  ↓
Database write (atomic transaction)
  ↓
Socket.io broadcast (game:turn event)
  ↓
Client receives + Zustand store updates + React renders
```

**Total latency:** ~3000-4000ms on production (likely DB + JSON parsing)

---

## processTurn() Execution Sequence

The `processTurn()` function in `game/engine.js` (line 330) executes in this exact order:

### 1. Initialization
Clear caches, create updates/events, initialize XP tracking.
**Estimated time:** < 1ms

### 2. Gold Income
Calculate production from cities, trade routes, and investments.
**State mutation:** `updates.gold`  
**Estimated time:** 1-5ms

### 3. Mana Regeneration
Calculate from Mage Towers and award XP to mages.
**State mutation:** `updates.mana`, possibly `updates.troop_levels`  
**Estimated time:** 1-3ms

### 4. Population Growth
Calculate from housing and happiness.
**State mutation:** `updates.population`  
**Estimated time:** 1-3ms

### 5. Food Economy + Attunements (SLOW)
- Farm production & consumption
- Handle starvation from shortage
- Process 13 different building attunement abilities
- Mercenary upkeep & expiry
- Location map progress
- Active event tick-down
- Scout ring progression (may async DB call for reveal)

**State mutation:** `updates.food`, `updates.scout_progress`, 15+ attunement fields  
**Estimated time:** 50-200ms (attunements are expensive)

### 6. Lore Events
0.1% chance per turn to grant random lore entry.
**State mutation:** `updates.collected_lore`  
**Estimated time:** < 1ms

### 7. Building Completion
Process build queue: complete buildings, award engineer XP.
**State mutation:** `updates.build_queue`, building counts, `updates.troop_levels`  
**Estimated time:** 2-10ms

### 8. Troop Upkeep
Calculate upkeep cost (population × multiplier - barracks discount).
**State mutation:** `updates.gold`  
**Estimated time:** 5-10ms

### 9. Happiness Calculation
Tax penalty/boost, overcrowding, entertainment bonus, recovery rate.
**State mutation:** `updates.happiness`  
**Estimated time:** 10-20ms

### 10. Auto-Research (SLOW)
Calculate progress for 14 research disciplines with allocations.
**State mutation:** 16 research fields, `updates.xp`, `updates.level`  
**Estimated time:** 20-50ms

### 11. Build Queue Processing
Start new buildings if slots available.
**State mutation:** `updates.build_queue`  
**Estimated time:** 5-15ms

### 12. Training Fields (SLOW)
Award XP to 6 troop types based on allocation and equipment.
**State mutation:** `updates.troop_levels`  
**Estimated time:** 20-40ms

### 13. Racial Passive Bonuses
Orc free fighters, Human cleric healing aura.
**State mutation:** `updates.fighters`, `updates.happiness`  
**Estimated time:** 1-3ms

### 14. XP Awards
Award turn XP, calculate level-ups.
**State mutation:** `updates.xp`, `updates.level`, `updates.xp_sources`  
**Estimated time:** 10-20ms

### 15. Milestone Check
Grant rewards for level milestones.
**State mutation:** Multiple reward fields  
**Estimated time:** 2-5ms

### 16. Racial Unlock & End of Turn
Check if signature unit reached mastery, record achievement progress.
**State mutation:** `updates.last_turn_at`, `updates.active_effects`  
**Estimated time:** 5-10ms

---

## Bottleneck Summary

| Bottleneck | Time | Cause | Fix Priority |
|-----------|------|-------|---|
| Attunement processing | 50-200ms | 13 building systems × calculations | High |
| Auto-research | 20-50ms | 14 disciplines × allocations | High |
| Training fields | 20-40ms | 6 troops × XP checks | High |
| Scattered JSON parsing | varies | safeJsonParse() per phase | Medium |
| Synchronous DB write | ~2000ms | Single atomic transaction | Low |

---

## State Persistence After Turn

1. `processTurn()` returns `{ updates, events }`
2. Route writes to DB: `UPDATE kingdoms SET gold=$1, food=$2, ... WHERE id=$3`
3. Socket.io broadcasts: `emit('game:turn', { updates, events })`
4. Client updates Zustand store
5. React components re-render

---

## Architecture Issues in Current Pipeline

❌ No event system — results returned, not events broadcast  
❌ Tight coupling — processTurn calls game/*.js directly  
❌ Mutable state — kingdom object modified in-place  
❌ No transaction guarantee — DB write failure = inconsistent state  
❌ JSON parsing overhead — Multiple parses per phase  
❌ No parallelization — All phases sequential  
❌ Attunements hardcoded — 13 systems, each with unique logic  

---

## Next: Phase 2 Improvements

1. Introduce Command → Simulation → Events pattern
2. Replace tight coupling with explicit dependencies
3. Make processTurn pure (no side effects)
4. Batch attunement/research/training processing
5. Implement Outbox Pattern for transaction safety
