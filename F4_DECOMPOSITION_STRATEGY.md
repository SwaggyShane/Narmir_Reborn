# F4: engine.js Decomposition — Strategic Plan

**Date**: 2026-06-27  
**Scope**: Break 6,041-line monolith into focused, testable modules  
**Approach**: Surgical extraction (one module at a time, with verification)

---

## 1. Current State Analysis

### Module Size
- **engine.js**: 6,041 lines
- **Exports**: ~100+ symbols
- **Functions**: ~50+ named functions
- **Constants**: Upgrade configs, unit types, multipliers, etc.

### Identified Domains (Logical Groupings)

#### A. Turn Processing (Core Loop)
- `processTurn(k)` — Main orchestration function
- Supporting: building queue, research, troop training, etc.
- **Lines**: ~1,400 (processTurn is massive)
- **Candidate module**: `game/lib/turn-processor.js`

#### B. Military & Combat
- `resolveMilitaryAttack()` — Main combat resolver
- `resolveMilitaryAttackV2Adapter()` — V2 wrapper
- Combat utility functions (unit normalization, formatting)
- **Lines**: ~1,000+
- **Candidate module**: `game/lib/combat.js`

#### C. Covert Operations
- `covertSpy()`, `covertLoot()`, `covertAssassinate()`, `covertSabotage()`
- Shared spy mechanics, roll/validation logic
- **Lines**: ~300
- **Candidate module**: `game/lib/covert-ops.js`

#### D. Economy & Resources
- `processFoodEconomy()`, `processGranaryAttunements()`
- Market functions: `commodityPrice()`, `marketIncomeFull()`
- Trade routes, vault logic
- **Lines**: ~800
- **Candidate module**: `game/lib/economy.js`

#### E. Defense & Walls
- Wall upgrades, tower detection, outpost rangers
- Defense rating calculations
- Warmachine damage application
- **Lines**: ~400
- **Candidate module**: `game/lib/defense.js`

#### F. Building & Research
- Building queue processing (`processBuildQueue`)
- Research/disciplines (`studyDiscipline`, `_selectSchool`)
- Building attunements (castle, smithy, library, etc.)
- **Lines**: ~800
- **Candidate module**: `game/lib/building.js`

#### G. Expeditions & Locations
- `resolveExpeditions()` — Main expedition resolver
- Location maps (`processLocationMapsWip`)
- Expedition rewards, transitions
- **Lines**: ~400
- **Candidate module**: `game/lib/expeditions.js`

#### H. Magic & Spells
- `castSpell()` main entry point
- Magic tower processing
- Spell validation, mana consumption
- **Lines**: ~300
- **Candidate module**: `game/lib/magic.js`

#### I. Experience & Leveling
- `awardXp()`, `xpForLevel()`, `troopXpForLevel()`
- Troop/unit XP management
- Racial unit bonuses
- **Lines**: ~250
- **Candidate module**: `game/lib/experience.js`

#### J. Happiness & Morale
- `calculateHappiness()` — Comprehensive happiness calc (already extracted to data-transformations.js, but may have engine-specific hooks)
- `recordHappinessHistory()`, `logHappinessEvent()`
- **Lines**: ~200
- **Candidate module**: May not need separate module (already in data-transformations.js)

#### K. Achievements & Scoring
- `checkAchievements()`
- `calculateScore()`
- **Lines**: ~200
- **Candidate module**: `game/lib/achievements.js`

#### L. Constants & Config
- All the upgrade configs, multipliers, season data
- Should stay in engine.js or move to game/config.js
- **Lines**: ~500
- **Action**: Consider consolidating with game/config.js

#### M. Prestige & Special Events
- `canPrestige()`, `processPrestige()`
- Rebellion checks/events
- Alliance defense
- **Lines**: ~200
- **Candidate module**: `game/lib/special-events.js`

---

## 2. Decomposition Phases

### Phase 1: Low-Risk Extractions (No Cross-Module Dependencies)
**Goal**: Build confidence and infrastructure

1. **Experience & Leveling** (game/lib/experience.js)
   - Copy-paste with minimal deps
   - Few external calls
   - Fully testable

2. **Achievements & Scoring** (game/lib/achievements.js)
   - Mostly self-contained
   - Takes kingdom object, returns result
   - Can add tests immediately

### Phase 2: Medium-Risk Extractions (Some Dependencies)
**Goal**: Extract larger modules with clear interfaces

3. **Expeditions & Locations** (game/lib/expeditions.js)
   - Calls into economy/rewards logic (pass as parameters)
   - Needs: database, kingdom object
   - Testable with mock data

4. **Defense & Walls** (game/lib/defense.js)
   - Utility functions for calculations
   - No heavy external deps
   - Can be fully tested offline

5. **Magic & Spells** (game/lib/magic.js)
   - Most spell logic self-contained
   - Calls event logging (pass as callback)
   - Testable with mock events array

### Phase 3: Core Business Logic (Highest Risk)
**Goal**: Extract the heart of the game

6. **Combat** (game/lib/combat.js)
   - Large, complex logic
   - Heavy calculations
   - Needs: event logging, damage application
   - Strategy: Extract to shared functions, call from engine

7. **Covert Operations** (game/lib/covert-ops.js)
   - Parallel to combat (similar structure)
   - Mutates kingdom state
   - Extract similar to combat

8. **Building & Research** (game/lib/building.js)
   - Orchestrates many sub-functions
   - Major state mutation
   - Extract incrementally (building queue first, then research)

9. **Economy & Resources** (game/lib/economy.js)
   - Many attunement processors
   - Food/vault/market logic
   - Extract each attunement processor separately

### Phase 4: Final Integration
**Goal**: Refactor engine.js as orchestrator

10. **Turn Processing** (game/lib/turn-processor.js)
    - Convert engine.js's processTurn() to call extracted modules
    - engine.js becomes a thin orchestration layer
    - No logic remains except calling sub-modules

11. **Constants Migration** (Optional)
    - Move constants to game/config.js (may already be there)
    - Or keep in game/lib/constants.js for clarity

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

## 5. Success Criteria

✅ **Phase 1 Complete**:
- [ ] Experience module extracted & tested
- [ ] Achievements module extracted & tested
- [ ] No lint errors, smoke tests pass

✅ **Phase 2 Complete**:
- [ ] Expeditions module extracted & tested
- [ ] Defense module extracted & tested
- [ ] Magic module extracted & tested
- [ ] Smoke tests pass, no behavior changes

✅ **Phase 3 Complete**:
- [ ] Combat module extracted (with comprehensive tests)
- [ ] Covert ops module extracted (with comprehensive tests)
- [ ] Building module extracted (buildQueue first)
- [ ] Economy module extracted (one processor at a time)
- [ ] All smoke tests pass, no behavior changes

✅ **Phase 4 Complete**:
- [ ] engine.js converted to orchestrator (calls extracted modules)
- [ ] No logic remains in processTurn except module calls
- [ ] All 100+ exports re-exported from engine.js
- [ ] Full test suite passes, smoke tests pass
- [ ] Code review + merge

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

## 7. Timeline Estimate

- **Phase 1**: 1–2 hours (low-risk extraction)
- **Phase 2**: 2–3 hours (medium-risk)
- **Phase 3**: 4–6 hours (complex logic, testing)
- **Phase 4**: 1–2 hours (integration, verification)

**Total**: ~8–13 hours of focused work (non-contiguous, with breaks for testing)

---

## Next Step

Proceed with Phase 1: Extract **Experience & Leveling** module first.
