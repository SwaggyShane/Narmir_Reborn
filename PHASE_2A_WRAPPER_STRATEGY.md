# Phase 2A: Combat Execution Wrapper - Implementation Strategy

**Date:** 2026-06-08  
**Status:** Planning Phase  
**Objective:** Create wrapper function that bridges old and new combat systems with full backward compatibility

---

## Current Function Signature

```javascript
function resolveMilitaryAttack(
  attacker,
  defender,
  sentUnits,
  attackerHeroes = [],
  defenderHeroes = [],
)
```

**Returns:**
```javascript
{
  win: boolean,
  report: {
    win: boolean,
    landTransferred: number,
    powerRatio: number,
    atkPower: number,
    defPower: number,
    sent: { fighters, rangers, mages, ... },
    atkFightersLost, atkRangersLost, atkMagesLost, atkNinjasLost, atkClericsLost, atkThievesLost, atkEngineersLost, atkWmLost,
    defFightersLost, defRangersLost, defMagesLost, defNinjasLost, defClericsLost, defThievesLost, defEngineersLost, defWmLost,
    ninjaKills,
    rangerKills,
    flankKills,
    thiefSabotage,
    atkMoraleChange,
    defMoraleChange,
    bullyMsg,
    shameEvent,
    steps: [ { phase, title, msg, icon }, ... ],
    wallsDestroyed: number (optional),
    buildingsDamaged: [ { type, lost }, ... ] (optional),
  },
  attackerUpdates: {
    fighters: number,
    rangers: number,
    mages: number,
    ninjas: number,
    thieves: number,
    clerics: number,
    engineers: number,
    war_machines: number,
    troop_levels: { fighters, rangers, ... },
    morale: number,
    xp: number,
    level: number,
    land: number,
    last_attack_turn: number,
    // ... other fields
  },
  defenderUpdates: {
    fighters: number,
    rangers: number,
    mages: number,
    ninjas: number,
    thieves: number,
    clerics: number,
    engineers: number,
    war_machines: number,
    troop_levels: { fighters, rangers, ... },
    morale: number,
    xp: number,
    level: number,
    land: number,
    last_attack_turn: number,
    // ... other fields
  },
  atkEvent: string,
  defEvent: string,
  shameEvent: string (optional),
}
```

---

## Compatibility Wrapper Design

### Approach

We'll create a `resolveMilitaryAttackCompat()` function that:
1. Calls the new `executeCombat()` from combat-resolver.js
2. Translates the new output format into the old format
3. Handles missing fields with sensible defaults
4. Maintains all casualty calculations for UI consistency

### Implementation Steps

**Step 1:** Create wrapper function in engine.js
```javascript
function resolveMilitaryAttackCompat(attacker, defender, sentUnits, attackerHeroes = [], defenderHeroes = []) {
  // Input validation (keep existing logic)
  // Calculate combat metrics that new system doesn't track
  // Call new executeCombat()
  // Translate output to old format
  // Return compatible result
}
```

**Step 2:** Maintain two functions temporarily
- Keep `resolveMilitaryAttack()` as-is (old system)
- Create `resolveMilitaryAttackCompat()` (new wrapper)
- Add feature flag to choose which to use: `USE_NEW_COMBAT_SYSTEM = false`

**Step 3:** Test wrapper thoroughly
- Compare old vs. new output
- Verify casualty calculations match
- Ensure all socket handlers work

**Step 4:** Gradual migration
- Enable new system for 10% of attacks
- Monitor for anomalies
- Gradually increase percentage
- Switch to 100% when stable

---

## Key Challenges & Solutions

### Challenge 1: Casualty Tracking
**Problem:** New system tracks individual HP; old system uses percentages
**Solution:** 
- Aggregate injured_troops back to "casualties" for report
- Sum up dead troops per unit type
- Calculate percentages for backwards compatibility

### Challenge 2: Power Calculation Differences
**Problem:** New system uses different power formula
**Solution:**
- Keep old power calculation for report display
- Use new calculation internally for win determination only
- Show both in report for debugging

### Challenge 3: Special Mechanics
**Problem:** Some mechanics (vampire daylight, wall defense) need to be adapted
**Solution:**
- Move special mechanics into new combat system
- If not yet implemented in new system, call old functions temporarily
- Plan Phase 6 to refactor all special mechanics into new system

### Challenge 4: Morale & Event Updates
**Problem:** New system may not track morale changes the same way
**Solution:**
- Calculate morale separately after combat
- Use updated troop counts to determine morale impact
- Ensure events/messages match old system

---

## Testing Strategy

### Unit Tests (for wrapper function)
```javascript
// Test 1: Basic wrapper call
const result = resolveMilitaryAttackCompat(attacker, defender, sentUnits);
assert(result.win === boolean);
assert(result.report !== undefined);
assert(result.atkEvent !== undefined);
assert(result.defEvent !== undefined);

// Test 2: Casualty consistency
assert(result.atkFightersLost === calculated_from_injured_troops);
assert(result.defFightersLost === calculated_from_injured_troops);

// Test 3: Compatibility with socket handlers
// Can socket handler code use result.report.landTransferred?
assert(typeof result.report.landTransferred === 'number');

// Test 4: XP & morale updates
assert(result.attackerUpdates.xp !== undefined);
assert(result.defenderUpdates.morale !== undefined);
```

### Integration Tests
```javascript
// Test 1: Socket handler integration
const result = resolveMilitaryAttackCompat(...);
await applyUpdates(db, attacker.id, result.attackerUpdates);
await applyUpdates(db, defender.id, result.defenderUpdates);
// Verify DB state is correct

// Test 2: Combat log format
const logEntry = {
  attacker_id: attacker.id,
  defender_id: defender.id,
  type: "military",
  attacker_won: result.win ? 1 : 0,
  land_transferred: result.report.landTransferred,
  detail: JSON.stringify(result.report),
};
// Verify log can be serialized & deserialized
```

---

## File Changes Required

### Game Module
**File:** `game/engine.js`
**Changes:**
1. Add `const combatResolver = require('./combat-resolver');` at top
2. Create new `resolveMilitaryAttackCompat()` function
3. Add feature flag: `const USE_NEW_COMBAT_SYSTEM = false;`
4. Modify `resolveMilitaryAttack()` to dispatch based on flag:
   ```javascript
   function resolveMilitaryAttack(attacker, defender, sentUnits, attackerHeroes, defenderHeroes) {
     if (USE_NEW_COMBAT_SYSTEM) {
       return resolveMilitaryAttackCompat(attacker, defender, sentUnits, attackerHeroes, defenderHeroes);
     }
     // ... old implementation continues
   }
   ```

**Lines Affected:**
- Line ~1: Add require
- Line ~5241: Modify function wrapper logic
- Lines ~5241-6269: Keep old implementation
- Line ~6270: Add new wrapper function

### Socket Handler (No Changes Needed)
**File:** `game/sockets.js`
- No changes needed - works with both systems via feature flag

---

## Success Criteria for Phase 2A

- [ ] Wrapper function created in engine.js
- [ ] Feature flag implemented and working
- [ ] Old system still works with flag = false
- [ ] New system produces compatible output with flag = true
- [ ] All casualty fields match between systems (within 1%)
- [ ] All update fields (XP, morale, land) match
- [ ] Socket integration tests pass
- [ ] Lint: 0 errors
- [ ] No performance regression (combat execution < 500ms)

---

## Estimated Implementation Time

- Wrapper function: 1-2 hours
- Testing: 1-2 hours
- Debug & iteration: 1-2 hours
- **Total: 3-6 hours**

---

## Next Steps After Phase 2A

1. **Phase 2B:** Comparative testing
   - Run 100+ combats with both systems
   - Compare outputs
   - Identify discrepancies

2. **Phase 3:** Socket integration
   - Update handlers if needed for new fields
   - Test with live attacks

3. **Phase 4:** Turn loop integration
   - Add healing logic to processTurn()

4. **Phase 5:** Frontend display
   - Add injury UI components

---

## Notes & Considerations

- **Database:** injured_troops already added, no migration needed
- **Backward Compatibility:** Maintains 100% API compatibility
- **Rollback:** If new system fails, just set `USE_NEW_COMBAT_SYSTEM = false`
- **Gradual Adoption:** Can test new system with feature flag before full migration
- **Performance:** No expected performance impact; new system may be faster due to modular design

