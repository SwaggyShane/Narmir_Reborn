# F4: engine.js Decomposition — Strategic Plan (REVISED)

**Date**: 2026-06-27  
**Scope**: Extract remaining ~38 functions from 6,041-line file into focused, testable modules  
**Approach**: Surgical extraction of remaining pieces (partial decomposition already done)
**Status**: Many domains already extracted to game/*.js and game/lib/*. Revising to focus on what remains.

---

## 1. Current State Analysis

### Module Size
- **engine.js**: 6,041 lines
- **Functions remaining in engine.js**: ~38 (down from ~50+)
- **Already extracted to separate modules**: Economy, Magic, Covert Ops, Attunements, Heroes, Exp/Leveling helpers, Defense helpers, Combat core

### Already Extracted (✅ Complete)
- **game/economy.js** — totalHiredUnits, goldPerTurn, foodBalance, processResourceYield, processFoodEconomy, commodityPrice, marketIncomeFull, etc.
- **game/magic.js** — castSpell, manaPerTurn, processMageTower, processShrine, processMausoleum, processLibrary
- **game/covert.js** — covertSpy, covertLoot, covertAssassinate, covertSabotage
- **game/attunements.js** — All 18 attunement processors (granary, vault, walls, etc.)
- **game/heroes.js** — Hero recruitment, leveling, power, turn bonuses
- **game/combat-resolver.js** — Core combat calculation (executeCombat)
- **game/lib/troops.js** — Troop XP, leveling, unit multipliers, racial bonuses
- **game/lib/defense.js** — Wall damage, Mason Sigil resistance
- **game/lib/data-transformations.js** — Pure functions (calculateHappiness, repairMojibake, etc.)

### Remaining Functions in engine.js (38 total)

#### 1. Achievements & Scoring (PHASE 1 LOW-RISK)
- `checkAchievements()` (line 2064, ~170 lines)
- `calculateScore()` (line 5803, ~45 lines)
- Pure functions over kingdom state → no external I/O
- **Status**: NOT EXTRACTED
- **Candidate module**: `game/lib/achievements.js`

#### 2. Happiness & Logging (PHASE 1 LOW-RISK)
- `recordHappinessHistory()` (line 247, async DB call)
- `logHappinessEvent()` (line 288, async DB call)
- DB logging functions — safe to extract with callbacks
- **Status**: NOT EXTRACTED
- **Candidate module**: `game/lib/happiness-logging.js`

#### 3. Building & Research (PHASE 2 MEDIUM-RISK)
- `processBuildQueue()` (line 2591, ~470 lines)
- `studyDiscipline()` (line 2333, ~35 lines)
- `_selectSchool()` (line 2368, ~30 lines)
- `queueBuildings()` (line 2401, ~190 lines)
- `forgeTools()` (line 3061, ~21 lines)
- Orchestrates building/research state mutations
- **Status**: NOT EXTRACTED (all still in engine.js)
- **Candidate module**: `game/lib/building.js`

#### 4. Combat Wrappers (PHASE 2 MEDIUM-RISK)
- `resolveMilitaryAttackV2Adapter()` (line 3228, ~225 lines, calls combatResolverV2.executeCombat)
- `resolveMilitaryAttack()` (line 3454, ~1,036 lines, legacy function)
- Combat formatting helpers: `normalizeCombatUnits()`, `formatCombatUnitCounts()`, `formatCombatBuildingsLost()`, `formatCombatV2NewsBlurb()`
- Happiness multipliers: `happinessMult()`, `happinessCombatMult()`
- **Status**: PARTIALLY EXTRACTED (core logic in combatResolverV2, wrappers still in engine)
- **Candidate module**: `game/lib/combat-wrappers.js`

#### 5. Expeditions & Locations (PHASE 2 MEDIUM-RISK)
- `resolveExpeditions()` (line 5212, async, ~378 lines)
- `processLocationMapsWip()` (line 315, ~55 lines)
- `computeExpeditionTransitions()` (line 370, ~18 lines)
- `expeditionRewards()` (line 4654, ~60 lines)
- Async DB operations, location state management
- **Status**: NOT EXTRACTED
- **Candidate module**: `game/lib/expeditions.js`

#### 6. Prestige & Special Events (PHASE 2 MEDIUM-RISK)
- `processPrestige()` (line 4542, ~43 lines)
- `canPrestige()` (line 4538, ~4 lines)
- `rebellionCheck()` (line 576, ~20 lines)
- `rebellionEvent()` (line 596, ~58 lines)
- `resolveAllianceDefense()` (line 4585, ~11 lines)
- `raidTradeRoute()` (line 4490, ~48 lines)
- Special events and state transitions
- **Status**: NOT EXTRACTED
- **Candidate module**: `game/lib/special-events.js`

#### 7. Miscellaneous Gameplay (PHASE 2 MEDIUM-RISK)
- `processMercenaries()` (line 388, ~54 lines)
- `hireMercenaries()` (line 442, ~49 lines)
- `hireUnits()` (line 2238, ~95 lines)
- `purchaseUpgrade()` (line 491, ~85 lines)
- `processActiveEffects()` (line 5590, ~98 lines)
- `demolishBuilding()` (line 5781, ~22 lines)
- `junkPrize()` (line 4596, ~58 lines)
- `wmCrewRequired()` (line 3082, ~7 lines)
- `resolveRegions()` (line 5688, async, ~93 lines)
- Various single-purpose gameplay functions
- **Status**: NOT EXTRACTED (scattered through engine.js)
- **Candidate module**: Combine into `game/lib/gameplay.js` OR extract individually by domain

#### 8. Turn Processing (PHASE 4 INTEGRATION — LAST)
- `processTurn()` (line 702, ~1,362 lines)
- Main orchestration loop — calls all sub-functions
- **Status**: ORCHESTRATOR (will refactor AFTER all others extracted)
- **Action**: Convert to thin coordinator calling extracted modules

---

## 2. Revised Decomposition Phases

### Phase 1: Low-Risk Extractions (Pure Functions, No DB)
**Goal**: Build confidence with simple, testable modules

1. **Achievements & Scoring** (game/lib/achievements.js)
   - Pure functions: checkAchievements, calculateScore
   - Takes kingdom object + updates → returns mutations + events
   - No DB calls, no async, no external deps beyond kingdom state
   - ~215 lines total

2. **Combat Formatting Helpers** (game/lib/combat-helpers.js)
   - Extract: normalizeCombatUnits, formatCombatUnitCounts, formatCombatBuildingsLost, formatCombatV2NewsBlurb
   - Also: happinessMult, happinessCombatMult, sumRecordValues
   - Pure utility functions for formatting combat reports
   - ~100 lines total
   - Used by resolveMilitaryAttackV2Adapter (stays in engine for now as wrapper)

### Phase 2: Medium-Risk Extractions (Some State Mutation, Clear Interfaces)
**Goal**: Extract gameplay domains with clear boundaries

3. **Happiness & Event Logging** (game/lib/happiness-logging.js)
   - Extract: recordHappinessHistory, logHappinessEvent
   - Async DB operations but simple interface
   - Callable from processTurn with callbacks
   - ~70 lines total

4. **Expeditions & Locations** (game/lib/expeditions.js)
   - Extract: resolveExpeditions, processLocationMapsWip, computeExpeditionTransitions, expeditionRewards
   - Async function, manages expedition state
   - Takes db, kingdom, engine objects
   - ~510 lines total

5. **Prestige & Special Events** (game/lib/special-events.js)
   - Extract: processPrestige, canPrestige, rebellionCheck, rebellionEvent, resolveAllianceDefense, raidTradeRoute
   - State mutations but isolated from turn processing
   - Takes kingdom object + params
   - ~185 lines total

6. **Combat Wrappers** (game/lib/combat-wrappers.js)
   - Extract: resolveMilitaryAttackV2Adapter, resolveMilitaryAttack (or keep legacy one as fallback)
   - Wrappers around combatResolverV2
   - State mutations but clear entry/exit
   - ~1,260 lines total (large but mostly self-contained)

### Phase 3: Large Orchestration Functions (Highest Risk)
**Goal**: Extract complex, multi-step orchestrators

7. **Building & Research** (game/lib/building.js)
   - Extract: processBuildQueue, studyDiscipline, queueBuildings, _selectSchool, forgeTools
   - Orchestrates building state mutations
   - Major side effects (queue management, research progress)
   - ~750 lines total

8. **Miscellaneous Gameplay** (game/lib/gameplay.js)
   - Extract: processMercenaries, hireMercenaries, hireUnits, purchaseUpgrade, processActiveEffects, demolishBuilding, junkPrize, wmCrewRequired, resolveRegions
   - Collection of single-purpose gameplay functions
   - No strong logical grouping (but better in lib than engine)
   - ~400 lines total

### Phase 4: Final Integration
**Goal**: Refactor engine.js as thin orchestrator

9. **Turn Processing Refactor** (game/engine.js itself)
   - Convert processTurn() to call extracted modules
   - processTurn becomes a coordinator: call building → combat → economy → etc.
   - engine.js re-exports all functions (unchanged API)
   - No logic remains in processTurn except orchestration
   - ~50 lines after refactor (from ~1,362)

---

## 3. Extraction Pattern (Template)

### Step 1: Identify the Module
- Function(s) to extract
- Dependencies (what it needs)
- Dependents (what calls it)

### Step 2: Create New Module
```javascript
// game/lib/[module].js
const { helper1, helper2 } = require('../helpers');
const config = require('../config');

function myFunction(kingdom, params) {
  // Core logic (unchanged from engine.js)
  return result;
}

module.exports = { myFunction, ... };
```

### Step 3: Update engine.js
```javascript
const { myFunction } = require('./lib/[module]');

// In processTurn or wherever it's called:
const result = myFunction(k, params);
```

### Step 4: Verify
- Lint: `npm run lint` (0 errors)
- Smoke: Fresh boot + baseline checks
- Sanity: No behavior changes (output identical to before)

### Step 5: Test (Optional, but Recommended)
- Add unit tests for the extracted module
- Run `npm test` to verify

---

## 4. Risk Mitigation

### High-Risk Areas
- **Combat resolver** (complex calculations, many edge cases)
  - *Mitigation*: Extract to separate module, add comprehensive tests
- **Building queue** (state mutation, many side effects)
  - *Mitigation*: Extract queue logic, keep mutation in engine for now, refactor after
- **Turn processing** (orchestrates everything)
  - *Mitigation*: Extract sub-functions first, then convert processTurn to coordinator

### Testing Strategy
- Phase 1–2: Manual smoke tests only
- Phase 3: Add unit tests for extracted modules
- Phase 4: Full integration tests for turn processing

### Rollback Plan
- Each commit is a checkpoint
- If a module extraction breaks behavior, reset to previous commit
- Test locally before pushing

---

## 5. Success Criteria (Revised for Actual State)

✅ **Phase 1 Complete** (Pure Functions, Low Risk):
- [ ] Achievements module (game/lib/achievements.js) created with checkAchievements, calculateScore
- [ ] Combat helpers module (game/lib/combat-helpers.js) created with formatting functions
- [ ] Verify: No lint errors, npm run lint passes
- [ ] Smoke test: Fresh boot + all 4 baseline checks pass
- [ ] Sanity: No behavior changes, identical output vs. before

✅ **Phase 2 Complete** (Medium Risk, Some Async):
- [ ] Happiness logging module (game/lib/happiness-logging.js) created
- [ ] Expeditions module (game/lib/expeditions.js) created with resolveExpeditions
- [ ] Special events module (game/lib/special-events.js) created with prestige/rebellion/alliance
- [ ] Combat wrappers module (game/lib/combat-wrappers.js) created (optional: keep legacy combat in engine as fallback)
- [ ] All modules callable from engine.js with identical behavior
- [ ] Smoke tests pass, no behavior changes
- [ ] Each commit is a checkpoint; can rollback if needed

✅ **Phase 3 Complete** (Large Orchestrators):
- [ ] Building module (game/lib/building.js) created with processBuildQueue + research
- [ ] Gameplay module (game/lib/gameplay.js) created with misc functions
- [ ] Verify: No lint errors
- [ ] Smoke tests pass, all baseline + specific gameplay endpoints functional
- [ ] Verify: Turn processing still calls sub-functions correctly

✅ **Phase 4 Complete** (Final Integration):
- [ ] processTurn refactored to orchestrator (calls extracted modules)
- [ ] engine.js becomes thin coordinator: ~50 lines, logic-free
- [ ] All ~100+ exports still re-exported from engine.js (API unchanged)
- [ ] Lint: 0 errors
- [ ] Smoke: Fresh boot + all baseline checks pass
- [ ] Sanity: Output identical, no behavior changes
- [ ] All commit messages reference this strategy
- [ ] PR ready for review + merge

---

## 6. Tooling & Commands

### Verification After Each Extraction
```bash
# Lint
npm run lint

# Smoke test (fresh boot + baseline checks)
DATABASE_URL="postgresql://postgres:smoke@localhost/narmir_smoke" \
  JWT_SECRET=test-smoke-secret \
  node index.js
# Then: curl http://localhost:3000/api/forum/boards, etc.

# Git tracking
git diff game/engine.js game/lib/[new-module].js
git log --oneline (verify extracted functions are in new module, removed from engine)
```

---

## 7. Timeline Estimate (Revised)

Given that many domains are already extracted, the remaining work is lighter:

- **Phase 1**: 30–45 min (extract 2 pure-function modules: achievements + combat helpers)
- **Phase 2**: 2–3 hours (extract 4 modules: happiness logging, expeditions, special events, combat wrappers)
- **Phase 3**: 1.5–2 hours (extract 2 large orchestrators: building + gameplay)
- **Phase 4**: 30–45 min (refactor processTurn, verify re-exports, final smoke tests)

**Total**: ~4–7 hours of focused work (non-contiguous, with breaks for testing)

---

## Next Steps (IN ORDER)

1. **Commit the revised F4 strategy** (this document)
2. **Phase 1 Part A: Achievements module** (game/lib/achievements.js)
   - Extract checkAchievements + calculateScore
   - Run lint + smoke test
   - Commit + push
3. **Phase 1 Part B: Combat helpers module** (game/lib/combat-helpers.js)
   - Extract normalizeCombatUnits, formatCombatUnitCounts, etc.
   - Update resolveMilitaryAttackV2Adapter to import from helpers
   - Run lint + smoke test
   - Commit + push
4. Continue to Phase 2 with same surgical precision
