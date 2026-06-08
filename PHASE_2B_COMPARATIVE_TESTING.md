# Phase 2B: Comparative Testing - New vs. Legacy Combat

**Date:** 2026-06-08  
**Status:** Planning & Implementation  
**Objective:** Validate wrapper produces output compatible with legacy system

---

## Overview

Phase 2A created the wrapper function `resolveMilitaryAttackV2()` that replicates the old combat logic while preparing to integrate the new combat system. Phase 2B will:

1. Create test harness to compare old vs. wrapper output
2. Run 100+ test combats with both systems
3. Verify all fields match (within tolerance)
4. Identify any discrepancies
5. Build confidence before enabling feature flag

---

## Test Harness Design

### Test Parameters

We'll test across a variety of kingdom states:

```javascript
const testScenarios = [
  // Balanced fight
  { name: "Balanced", atkPower: 1000, defPower: 1000 },
  // Attacker advantage
  { name: "Attacker 2x", atkPower: 2000, defPower: 1000 },
  // Defender advantage
  { name: "Defender 2x", atkPower: 1000, defPower: 2000 },
  // Massive advantage (bully case)
  { name: "Bully 10x", atkPower: 10000, defPower: 1000 },
  // Small skirmish
  { name: "Small", atkPower: 100, defPower: 100 },
  // Huge armies
  { name: "Large", atkPower: 100000, defPower: 100000 },
];

const unitConfigs = [
  { fighters: 1000, rangers: 0, mages: 0, ninjas: 0, clerics: 0, thieves: 0, engineers: 0, war_machines: 0 },
  { fighters: 500, rangers: 500, mages: 0, ninjas: 0, clerics: 0, thieves: 0, engineers: 0, war_machines: 0 },
  { fighters: 300, rangers: 300, mages: 200, ninjas: 100, clerics: 50, thieves: 50, engineers: 0, war_machines: 0 },
  { fighters: 100, rangers: 100, mages: 100, ninjas: 100, clerics: 100, thieves: 100, engineers: 100, war_machines: 10 },
];
```

### Test Implementation

```javascript
async function runComparativeTest(testCount = 100) {
  const results = {
    passCount: 0,
    failCount: 0,
    discrepancies: [],
    stats: {
      atkPowerDiff: [],
      defPowerDiff: [],
      casualtyDiff: [],
      landTransferDiff: [],
    }
  };

  for (let i = 0; i < testCount; i++) {
    const attacker = generateRandomKingdom();
    const defender = generateRandomKingdom();
    const sentUnits = generateRandomSentUnits(attacker);

    // Run old system (legacy)
    USE_NEW_COMBAT_SYSTEM = false;
    const resultOld = engine.resolveMilitaryAttack(attacker, defender, sentUnits);

    // Run new system (wrapper)
    USE_NEW_COMBAT_SYSTEM = true;
    const resultNew = engine.resolveMilitaryAttack(attacker, defender, sentUnits);

    // Compare results
    const comparison = compareResults(resultOld, resultNew, attacker, defender);
    
    if (comparison.pass) {
      results.passCount++;
    } else {
      results.failCount++;
      results.discrepancies.push(comparison.issues);
    }

    // Track statistics
    results.stats.atkPowerDiff.push(comparison.atkPowerDiff);
    results.stats.defPowerDiff.push(comparison.defPowerDiff);
    results.stats.casualtyDiff.push(comparison.casualtyDiff);
    results.stats.landTransferDiff.push(comparison.landTransferDiff);
  }

  return results;
}
```

### Comparison Logic

```javascript
function compareResults(old, new, attacker, defender) {
  const issues = [];
  const pass = true;

  // Core fields
  if (old.win !== new.win) {
    issues.push(`Win result mismatch: ${old.win} vs ${new.win}`);
    pass = false;
  }

  // Power ratio (allow 5% tolerance)
  const atkPowerDiff = Math.abs(old.report.atkPower - new.report.atkPower);
  const defPowerDiff = Math.abs(old.report.defPower - new.report.defPower);
  
  if (atkPowerDiff > old.report.atkPower * 0.05) {
    issues.push(`Attacker power diff: ${atkPowerDiff} (>${old.report.atkPower * 0.05})`);
    pass = false;
  }

  // Casualties (allow 3 unit tolerance)
  const casualtyTypes = ['fighters', 'rangers', 'mages', 'ninjas'];
  let totalCasualtyDiff = 0;
  casualtyTypes.forEach(type => {
    const oldLost = old.report[`atk${capitalize(type)}Lost`];
    const newLost = new.report[`atk${capitalize(type)}Lost`];
    const diff = Math.abs(oldLost - newLost);
    totalCasualtyDiff += diff;
    if (diff > 3) {
      issues.push(`${type} casualty diff: ${oldLost} vs ${newLost}`);
      pass = false;
    }
  });

  // Land transfer (must match exactly)
  if (old.report.landTransferred !== new.report.landTransferred) {
    issues.push(`Land transfer mismatch: ${old.report.landTransferred} vs ${new.report.landTransferred}`);
    pass = false;
  }

  // Events (structure check only)
  if (!new.atkEvent || !new.defEvent) {
    issues.push(`Events missing: atkEvent=${!!new.atkEvent}, defEvent=${!!new.defEvent}`);
    pass = false;
  }

  return {
    pass,
    issues,
    atkPowerDiff,
    defPowerDiff,
    casualtyDiff: totalCasualtyDiff,
    landTransferDiff: old.report.landTransferred - new.report.landTransferred,
  };
}
```

---

## Expected Results

### Pass Criteria

- **Win/Loss Consistency:** Old and wrapper should agree on win result in >98% of cases
  - Tolerance: Can differ due to randomization

- **Power Calculation:** Attacker/Defender power within 5% of legacy
  - Both use same formula: (unit counts × power weights) × multipliers

- **Casualty Calculations:** Within 3 units per type
  - Slight variance due to rounding differences

- **Land Transfer:** Must match exactly
  - Deterministic calculation, should be identical

- **Event Generation:** Must produce valid strings
  - Content may differ, but both must exist

### Failure Scenarios

- Win result differs (indicates critical bug)
- Land transfer differs (indicates casualty calculation error)
- Events are missing/invalid (indicates data structure issue)
- Power calculation off by >10% (indicates formula mismatch)

---

## Test Execution Plan

### Step 1: Manual Verification (Current)
- Run a single combat with both systems
- Compare output manually
- Verify all fields are present

### Step 2: Automated Test Suite (Next)
- Create test file: `test/combat-comparative.test.js`
- Implement `runComparativeTest(100)`
- Generate report with statistics

### Step 3: Analysis & Debugging
- If tests fail, identify root cause
- Compare power calculations step-by-step
- Check casualty rate application
- Debug land transfer formula

### Step 4: Statistical Validation
- Calculate mean difference across all tests
- Determine standard deviation
- Ensure <3% variance on win results

---

## Files & Implementation

### New Test File
**Path:** `test/combat-comparative.test.js`

**Structure:**
```javascript
const engine = require('../game/engine');

describe('Combat System Comparative Testing', () => {
  it('should produce identical results between legacy and wrapper', async () => {
    const results = runComparativeTest(100);
    assert(results.passCount >= 98, `Only ${results.passCount} passes out of 100`);
  });

  it('should maintain win/loss consistency', () => {
    // Verify win probability is reasonable (40-60% for balanced fight)
  });

  it('should calculate casualties consistently', () => {
    // Verify casualty rates within tolerance
  });
});
```

### Test Utilities
**Add to:** `test/combat-utils.js`

```javascript
function generateRandomKingdom() {
  // Create random kingdom with varied stats
}

function generateRandomSentUnits(attacker) {
  // Generate realistic sent unit counts
}

function compareResults(old, new) {
  // Detailed comparison with tolerance checking
}
```

---

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Test Pass Rate | ≥98% | TBD |
| Win Consistency | ±2% variance | TBD |
| Casualty Accuracy | ±3 units | TBD |
| Land Transfer | 100% match | TBD |
| Performance | <500ms per combat | TBD |
| Lint | 0 errors | ✅ 0 errors |

---

## Timeline

**Phase 2B Estimated:** 2-3 hours
- Test harness creation: 1 hour
- Test execution & analysis: 1 hour
- Debugging & fixes: 1 hour

---

## Next Steps

After Phase 2B passes:
1. Enable feature flag for 10% of production attacks
2. Monitor combat logs for anomalies
3. Gradually increase percentage to 100%
4. Move to Phase 3: Socket Integration

---

## Notes

- Tests should use seeded random() for reproducibility
- Compare outputs without worrying about event text content
- Focus on data fields and calculations
- Document any legitimate differences found
- Create rollback plan if >5% of tests fail

