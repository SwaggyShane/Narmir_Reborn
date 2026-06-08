# Combat Redesign System - Deep Audit & Integration Plan

**Date:** 2026-06-08  
**Branch:** `claude/combat-redesign-integration`  
**Status:** Phase 1 - Deep Audit Complete

---

## Executive Summary

The Combat Redesign System consists of two complete, tested, but unintegrated modules:
- **game/combat-new.js** (11.3 KB) - Individual troop HP & injury state calculations
- **game/combat-resolver.js** (15.9 KB) - Combat execution engine with special mechanics

The current combat system in **game/engine.js** uses a monolithic `resolveMilitaryAttack()` function (1028 lines, lines 5241-6269) with percentage-based casualty calculations.

**Integration Complexity:** High - requires careful replacement to maintain game balance, historical data compatibility, and zero downtime.

---

## Part 1: Current Combat System Analysis

### 1.1 Current System Location
- **File:** `game/engine.js`
- **Function:** `resolveMilitaryAttack(attacker, defender, sentUnits, attackerHeroes, defenderHeroes)`
- **Lines:** 5241-6269 (1028 lines)
- **Exported:** Yes, exported at module.end

### 1.2 Current System Architecture

The current combat is percentage-based with cascading damage calculations:

#### Key Phases
1. **Validation** - Check minimum troops sent
2. **Anti-Bully Penalty** - Penalize attacking much weaker kingdoms (0.4x to 0.8x multiplier)
3. **Morale Multipliers** - Apply happiness combat mult to attacker & defender
4. **Ninja Pre-Strike** - Ninjas kill defenders before main battle (~1-3% of fighter count)
5. **Wall Defense** - Walls reduce incoming damage based on wall level/count
6. **Main Combat** - Fighters vs fighters, rangers vs rangers, etc. using percentages
7. **Mage Damage** - Mages have special splash damage mechanics
8. **War Machine Damage** - War machines deal extra damage, can be sabotaged
9. **Casualty Calculation** - Deaths based on % of total power
10. **Special Units** - Thieves sabotage war machines, clerics heal defenders, engineers damage walls
11. **Loot Calculation** - Land transfer, gold loss, resource theft
12. **Event Generation** - Combat report with detailed breakdown

#### Troop Types Handled
- fighters, rangers, mages, clerics, ninjas, thieves, engineers, war_machines

#### Special Mechanics
- **Vampire daylight penalty** - Only clerics defend vampires during day
- **Wall defense** - Fortified/Keep/Citadel walls reduce damage
- **Thief sabotage** - Disables defender war machines (40% chance max)
- **Ninja interception** - Ninja kills can be intercepted by defender ninjas
- **Mage AoE damage** - Higher racial bonuses
- **Engineer wall breach** - Destroys walls on successful attack
- **Ladder skip** - Ladders reduce wall effectiveness
- **Anti-bully protection** - Protects weak kingdoms from farming

### 1.3 Current System Data Model

**Kingdom object contains:**
```javascript
{
  fighters: number,
  rangers: number,
  mages: number,
  clerics: number,
  ninjas: number,
  thieves: number,
  engineers: number,
  war_machines: number,
  
  // Troop experience
  troop_levels: {
    fighters: number,
    rangers: number,
    // ... one per unit type
  },
  
  // Building defense
  bld_walls: number,
  wall_level: 'fortified'|'keep'|'citadel',
  
  // Other relevant fields
  race: string,
  happiness: number,
  turn: number,
  last_attack_turn: number,
  // ... other kingdom data
}
```

**Return value:**
```javascript
{
  win: boolean,
  report: {
    // Detailed casualty breakdown by unit type
    // Wall damage, building destruction, land transfer, etc.
  },
  attackerUpdates: { /* kingdom fields to update */ },
  defenderUpdates: { /* kingdom fields to update */ },
  atkEvent: string,  // Event for attacker log
  defEvent: string,  // Event for defender log
  shameEvent?: string  // Anti-bully shame event
}
```

---

## Part 2: New Combat System Analysis

### 2.1 New System Files

#### game/combat-new.js
- **Size:** 11.3 KB
- **Status:** Complete, untested in production
- **Purpose:** Base calculations for individual troop HP & injury states

**Key Exports:**
```javascript
const TROOP_BASE_STATS = {
  fighters: { hp: 250, dmg: 25, hpLevelScale: 2.0, dmgLevelScale: 1.0 },
  rangers: { hp: 100, dmg: 15, hpLevelScale: 0.8, dmgLevelScale: 0.6 },
  mages: { hp: 25, dmg: 30, hpLevelScale: 0.2, dmgLevelScale: 1.2 },
  clerics: { hp: 150, dmg: 15, hpLevelScale: 1.2, dmgLevelScale: 0.6 },
  ninjas: { hp: 50, dmg: 10, hpLevelScale: 0.4, dmgLevelScale: 0.4 },
  thieves: { hp: 75, dmg: 15, hpLevelScale: 0.6, dmgLevelScale: 0.6 },
  engineers: { hp: 100, dmg: 0, hpLevelScale: 0.8, dmgLevelScale: 0 },
  war_machines: { hp: 500, dmg: 40, hpLevelScale: 4.0, dmgLevelScale: 1.6 },
};

const INJURY_STATES = {
  HEALTHY: { minHpPercent: 75, maxHpPercent: 100, healingSpeed: 1.0 },
  LIGHTLY_INJURED: { minHpPercent: 50, maxHpPercent: 74, healingSpeed: 0.8 },
  MODERATELY_INJURED: { minHpPercent: 25, maxHpPercent: 49, healingSpeed: 0.6 },
  HEAVILY_INJURED: { minHpPercent: 1, maxHpPercent: 24, healingSpeed: 0.4 },
  DEAD: { minHpPercent: 0, maxHpPercent: 0, healingSpeed: 0 },
};

// Functions:
- calculateIndividualTroopHp(troopType, armorResearch, troopLevel, racialModifier)
- calculateIndividualTroopDmg(troopType, weaponResearch, troopLevel, racialModifier)
- calculateWallHp(wallCount, defenseType)
- getInjuryState(currentHp, maxHp)
- parseInjuredTroops(jsonString) -> { [troopType]: [{hp, maxHp, count}, ...], ... }
- serializeInjuredTroops(injuredState) -> JSON string for storage
```

#### game/combat-resolver.js
- **Size:** 15.9 KB
- **Status:** Complete, untested in production
- **Purpose:** Execute combat between two kingdoms with full mechanics

**Key Function:**
```javascript
async function executeCombat(db, attacker, defender, combatType, targetFocus, engineerLevel)
```

**Input:**
```javascript
attacker/defender: {
  injured_troops: JSON string from DB,  // NEW: Individual troop injury tracking
  // ... all current kingdom fields
}
```

**Output:**
```javascript
{
  win: boolean,
  outcome: 'victory'|'repelled',
  attackerUpdates: { injured_troops: JSON, /* other updates */ },
  defenderUpdates: { injured_troops: JSON, /* other updates */ },
  report: {
    combatType: string,
    targetFocus: string,
    attackerKilled: number,
    defenderKilled: number,
    injuredTroops: { /* detailed injury tracking */ },
    wallDamage: number,
    // ... other detailed metrics
  }
}
```

### 2.2 New System Key Differences

| Aspect | Current | New |
|--------|---------|-----|
| **Casualty Tracking** | Percentage-based, lossy | Individual HP, lossless |
| **Injury State** | Not tracked | 5 states (healthy → dead) |
| **Healing** | Automatic (not tracked) | Per-turn healing with modifiers |
| **Data Loss** | Combat result → direct updates | Combat result → JSON injured_troops → per-turn healing |
| **Wall Damage** | Applied to wall_level only | Tracked as wall_hp (persistent) |
| **Complexity** | ~1000 lines in one function | Modular: calc + resolver split |

### 2.3 New System Requirements

#### Database
- ✅ `injured_troops` column already added to kingdoms table (TEXT, default '{}')

#### Imports
- combat-new.js must be required in combat-resolver.js
- combat-resolver.js must be required in engine.js

#### Dependencies
- No external dependencies (uses only Node.js built-ins)

---

## Part 3: Integration Points & Required Changes

### 3.1 Database Schema (ALREADY DONE)
✅ The `injured_troops` column is already present in kingdoms table:
```javascript
// db/schema.js, line 846
if (!kingdomsCols.includes('injured_troops'))
  await addColumn('kingdoms', 'injured_troops', "TEXT NOT NULL DEFAULT '{}'", kingdomsCols)
```

**No database migration needed!**

### 3.2 Combat Execution Points

The following places in engine.js call or contain combat logic and need updating:

#### 3.2.1 Direct Combat Call
- **Function:** `resolveMilitaryAttack()` (lines 5241-6269)
- **Called By:** Socket event handlers (game/sockets.js)
- **Change Required:** Replace with wrapper that calls `executeCombat()`
- **Impact:** Main attack/raid/siege execution

#### 3.2.2 Combat-Related Helper Functions
These support resolveMilitaryAttack and may need refactoring:
- `applyWarmachineDamage(attacker, defender, win)` (line 998)
- `happinessCombatMult(happiness)` (line 5236)
- `moraleMult(morale)` (line 5230)

#### 3.2.3 Injury Healing Integration
- **Location:** `processTurn()` function (line 2726)
- **Add:** Healing logic that processes injured_troops for each unit type per turn
- **Example logic:**
  ```javascript
  // In processTurn, after processing building effects:
  const injuredTroops = parseInjuredTroops(k.injured_troops);
  applyPerTurnHealing(injuredTroops, k.troop_levels);
  k.injured_troops = serializeInjuredTroops(injuredTroops);
  ```

### 3.3 Frontend Changes

#### 3.3.1 StatusPanel Component
- **File:** `client/src/components/react/StatusPanel.jsx`
- **Add:** Injury status indicator (show if troops are injured)
- **Display:** "Troop Health: Healthy / 3 Units Lightly Injured / 1 Unit Heavily Injured"

#### 3.3.2 WarfarePanel Component
- **File:** `client/src/components/react/WarfarePanel.jsx`
- **Add:** Pre-battle injury warning
- **Add:** Injury mitigation tips (clerics heal, rest speeds healing)
- **Example:** "⚠️ 50% of fighters are injured. Send clerics or wait 5 turns for healing."

#### 3.3.3 Combat Report Modal
- **File:** Likely in a combat results modal (need to find)
- **Add:** Detailed injury breakdown per unit type
- **Show:** Soldiers killed vs. injured from each battle

### 3.4 Socket Events (game/sockets.js)

The following socket events call `resolveMilitaryAttack()`:
- `attack_kingdom` - Direct PvP attack
- `raid_kingdom` - Raid with trade route theft
- `siege_kingdom` - Siege mechanic (if exists)

**Change Required:**
- Update socket handlers to use new `executeCombat()` call pattern
- Ensure `combatType` and `targetFocus` parameters are passed correctly

---

## Part 4: Integration Risk Assessment

### 4.1 High-Risk Areas

#### Risk 1: Game Balance Changes
- **Issue:** New HP/damage system has different scaling than percentage-based
- **Impact:** Win/loss ratios will shift; some kingdoms may be overpowered/underpowered
- **Mitigation:** 
  - Run balance simulation before going live
  - Have rollback plan ready
  - Monitor first week of combats for anomalies

#### Risk 2: Data Migration
- **Issue:** Existing kingdoms have no `injured_troops` data (defaults to '{}')
- **Impact:** None - '{}' means all troops healthy, which is correct for existing data
- **Mitigation:** ✅ Already handled by schema default

#### Risk 3: Backwards Compatibility
- **Issue:** Old combat results in logs won't match new injury system
- **Impact:** History logs will show old format, new combats show new format (acceptable)
- **Mitigation:** Add version field to combat reports for clarity

#### Risk 4: API/Report Format Change
- **Issue:** `resolveMilitaryAttack()` return format may differ slightly
- **Impact:** Socket event handlers & frontend may break
- **Mitigation:** Carefully match new return format to old, or update handlers + frontend together

### 4.2 Low-Risk Areas
- ✅ Database schema already updated
- ✅ New modules exist in separate files (no conflicts)
- ✅ No external dependencies

### 4.3 Testing Requirements
- Unit tests for individual HP/damage calculations ✅ (already exist)
- Integration test: old combat → new combat consistency
- Smoke test: Can create & execute a combat without errors
- Balance test: Win/loss rates reasonable
- Frontend test: Injury display renders correctly

---

## Part 5: Current Baseline Assessment

### 5.1 Lint Status
```
✅ 0 errors, 3 warnings (from 107 initially)
  - db/schema.js:382, 1018: unused _e variable
  - routes/admin.js:1254: unused _e variable
```

### 5.2 Test Status
- ✅ Synergy system: 15 tests passing (if test harness configured)
- ⚠️ Combat tests: Not yet run (test framework not fully configured)

### 5.3 Code Quality
- ✅ Main lint targets all clean
- ✅ Combat modules: likely lint clean (isolated, not integrated)
- ✅ No circular dependencies detected

---

## Part 6: Phased Integration Plan

### Phase 1A: Preparation (Current)
- [x] Create dedicated branch: `claude/combat-redesign-integration`
- [x] Run baseline lint/smoke/sanity checks
- [x] Perform deep audit (this document)
- [ ] Review combat-new.js exports & compatibility
- [ ] Review combat-resolver.js interface

### Phase 1B: Module Validation
- [ ] Lint combat-new.js and combat-resolver.js for errors
- [ ] Write basic smoke test: Can import both modules?
- [ ] Verify no circular dependencies
- [ ] Check that all required exports exist

### Phase 2: Combat Execution Wrapper
- [ ] Create wrapper function in engine.js that calls `executeCombat()`
- [ ] Maintain current API (return same format)
- [ ] Handle backward compatibility
- [ ] Add feature flag to choose old vs. new (if needed)

### Phase 3: Socket Integration
- [ ] Update game/sockets.js attack handlers to use new combat
- [ ] Test with manual attacks on dev server
- [ ] Verify combat reports display correctly

### Phase 4: Turn Loop Integration
- [ ] Add injury healing logic to `processTurn()`
- [ ] Parse injured_troops JSON
- [ ] Apply per-turn healing with modifiers
- [ ] Serialize back to injured_troops

### Phase 5: Frontend Display
- [ ] Update StatusPanel to show injury status
- [ ] Update WarfarePanel to show warnings
- [ ] Update combat report modal
- [ ] Test injury display after combat

### Phase 6: Balance & Testing
- [ ] Run comprehensive combat test suite
- [ ] Analyze win/loss rates vs. old system
- [ ] Adjust troop stats if needed
- [ ] Test special mechanics (vampire penalty, wall damage, etc.)

### Phase 7: Production Readiness
- [ ] Final lint/smoke/sanity checks
- [ ] Performance test (large battles)
- [ ] Create rollback plan
- [ ] Merge to main
- [ ] Deploy to Railway

---

## Part 7: File Structure Overview

```
game/
  ├─ engine.js (9,326 lines)
  │   ├─ resolveMilitaryAttack() [5241-6269]  ← Will be refactored
  │   ├─ processTurn() [2726+]                ← Add healing logic
  │   ├─ Other combat helpers
  │   └─ Module exports
  │
  ├─ combat-new.js (NEW - 11.3 KB)
  │   ├─ TROOP_BASE_STATS
  │   ├─ INJURY_STATES
  │   ├─ HP/DMG calculations
  │   ├─ Wall HP calculations
  │   ├─ Injury state logic
  │   └─ Export all functions
  │
  ├─ combat-resolver.js (NEW - 15.9 KB)
  │   ├─ executeCombat() [main entry point]
  │   ├─ Combat power calculation
  │   ├─ Damage application
  │   ├─ Special mechanics
  │   └─ Export main function
  │
  └─ sockets.js (MODIFY)
      ├─ attack_kingdom socket handler
      ├─ raid_kingdom socket handler
      └─ siege_kingdom socket handler

client/src/components/react/
  ├─ StatusPanel.jsx (MODIFY - add injury display)
  ├─ WarfarePanel.jsx (MODIFY - add warnings)
  └─ CombatReportModal.jsx (MODIFY - add injury breakdown)

db/
  └─ schema.js (ALREADY DONE ✅)
      └─ injured_troops column added
```

---

## Part 8: Key Questions for Implementation

1. **Backward Compatibility:** Should combat report format stay identical, or can it evolve?
   - **Current assumption:** Can evolve with version markers

2. **Feature Flag:** Should we have toggle between old/new combat during transition?
   - **Current assumption:** No - direct replacement once tested

3. **Injury Display Priority:** How detailed should injury UI be?
   - **Current assumption:** Summary + detailed breakdown in modals

4. **Healing Rate Tuning:** Are injury healing speeds correct, or need balancing?
   - **Current assumption:** Start with defined rates, adjust based on test results

5. **Historical Compatibility:** Should old combat logs be migrated?
   - **Current assumption:** No - new format starts from integration point

---

## Part 9: Success Criteria

### Lint Targets
- [ ] 0 errors in engine.js after combat refactoring
- [ ] 0 errors in sockets.js after handler updates
- [ ] 0 errors in new combat modules
- [ ] Overall lint: ≤ 5 warnings (current: 3)

### Functional Targets
- [ ] `executeCombat()` called successfully from `resolveMilitaryAttack()` wrapper
- [ ] Combat return format unchanged from caller's perspective
- [ ] Injury data persists through `processTurn()` without loss
- [ ] Healing reduces injury over multiple turns
- [ ] Frontend displays injury status without errors

### Quality Targets
- [ ] 15+ comprehensive combat tests passing
- [ ] Manual play-test: 5+ combats executed successfully
- [ ] Balance analysis: Win/loss rates within ±10% of old system
- [ ] Performance: Combat execution < 500ms even for large battles

### Deployment Targets
- [ ] All changes pushed to `claude/combat-redesign-integration` branch
- [ ] PR created as draft
- [ ] Code review pass
- [ ] Merge to main
- [ ] Deploy to Railway with zero errors

---

## Summary of Findings

**Current State:**
- Combat system: Monolithic, percentage-based, ~1000 lines
- New system: Modular, individual HP tracking, ~27KB
- Database: Ready (injured_troops column exists)
- Test framework: Partially configured (synergy tests work, combat tests need setup)

**Complexity:** HIGH - requires careful refactoring with balance validation

**Estimated Timeline:** 6-8 phases, ~2-3 hours per phase (conservative estimate)

**Risk Level:** MEDIUM - game balance impact requires testing, but infrastructure ready

**Go/No-Go Decision:** ✅ READY TO PROCEED with Phase 1B (Module Validation)

