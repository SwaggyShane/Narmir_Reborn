# Combat System Test Harness

Comprehensive automated testing for the Narmir Reborn combat system.

## Overview

This harness tests the combat system across:
- **All 8 races** (Human, Orc, Dwarf, Dark Elf, Vampire, Dire Wolf, Wood Elf, Ogre)
- **All race matchups** (8×8 combinations)
- **Variable army sizes** (1 to 100,000 troops)
- **Defense levels** (None, Basic, Moderate, Heavy)
- **Edge cases** (0 troops, extremely imbalanced armies, etc.)

## Quick Start

### 1. Initialize Test Kingdoms

Creates 8 test kingdoms (one per race) in the database:

```bash
node test-combat-harness/setup-test-kingdoms.js
```

**Output:**
```
✓ Connected to database: /path/to/narmir.db
✓ Created test kingdom: Test-HUMAN-1 (ID: X)
✓ Created test kingdom: Test-ORC-1 (ID: X)
...
✓ Setup complete! Created 8 test kingdoms.
```

### 2. Run Combat Tests

#### Single Test (Basic)
```bash
node test-combat-harness/combat-test-runner.js --attacker human --defender orc
```

#### Extreme Scenario (1 fighter vs 5000 fortified troops)
```bash
node test-combat-harness/combat-test-runner.js \
  --attacker human \
  --defender orc \
  --attacker-army 1 \
  --defender-army 5000 \
  --defense heavy
```

#### All Race Matchups (64 combinations)
```bash
node test-combat-harness/combat-test-runner.js --all-race-matchups
```

#### Comprehensive Testing (ALL POSSIBILITIES)
```bash
node test-combat-harness/combat-test-runner.js --all-scenarios
```

This runs:
- 8 races × 7 other races = 56 matchup combinations
- 7 army sizes (1, 10, 100, 500, 1000, 5000, 10000)
- 4 defense levels (none, basic, moderate, heavy)
- **Total: ~1,568 test scenarios**

#### Stress Test (Edge Cases)
```bash
node test-combat-harness/combat-test-runner.js --stress-test
```

Tests extreme scenarios:
- 1 fighter vs 0 defenders
- 1 fighter vs 50,000 heavily fortified troops
- 50,000 vs 1 fighter
- 100,000 vs 100,000 heavily fortified

### 3. Analyze Results

After tests complete, analyze results:

```bash
node test-combat-harness/analyze-results.js combat-test-results-1686754322.json
```

**Output includes:**
```
✓ Viability Analysis - Are all tests passing?
⚖️  Balance Analysis - Which races are OP/weak?
⚡ Efficiency Analysis - Are calculations correct?
🔍 Edge Case Analysis - What breaks?
```

## Test Results

Results are saved to `test-results/` directory as JSON with:
- Complete test metadata
- Individual scenario results
- Combat calculations and outcomes
- Validation status

### Example Result
```json
{
  "scenario": {
    "attacker": "human",
    "defender": "orc",
    "attackerTroops": 1000,
    "defenderTroops": 1000,
    "defenseLevel": "basic"
  },
  "result": {
    "attacker": {
      "initialTroops": 1000,
      "casualties": 100,
      "finalTroops": 900,
      "xpGained": 10000
    },
    "defender": {
      "initialTroops": 1000,
      "casualties": 150,
      "finalTroops": 850,
      "xpGained": 8000
    },
    "combat": {
      "attackerWon": true,
      "landTransferred": 10,
      "goldTransferred": 50000,
      "powerRatio": 1.0
    }
  }
}
```

## Analysis Report

The analyzer generates insights on:

### Viability
- ✓ Do all tests pass?
- ✗ Are there crashes or calculation errors?
- → Deployment blocking issues

### Balance
- Win rates by race (as attacker)
- Overpowered races (>65% win rate)
- Underpowered races (<35% win rate)
- Race-specific matchup data

### Efficiency
- Casualty rate validation (5-15% winner, 2-10% loser)
- XP calculation correctness
- Resource transfer calculations
- Happiness impact calculations

### Edge Cases
- Army size boundaries (0, 1, 100k+)
- Defense level interactions
- Unusual unit compositions
- NaN/Infinity/overflow checks

## Workflow

### For Development
```bash
# Test single change
node test-combat-harness/combat-test-runner.js --attacker human --defender orc

# Test all matchups after code change
node test-combat-harness/combat-test-runner.js --all-race-matchups

# Full audit before PR
node test-combat-harness/combat-test-runner.js --all-scenarios
```

### For Code Review
```bash
# Run comprehensive tests
node test-combat-harness/combat-test-runner.js --all-scenarios

# Analyze for balance issues
node test-combat-harness/analyze-results.js combat-test-results-*.json
```

### For Deployment
```bash
# Stress test edge cases
node test-combat-harness/combat-test-runner.js --stress-test

# Full comprehensive audit
node test-combat-harness/combat-test-runner.js --all-scenarios

# Generate final report
node test-combat-harness/analyze-results.js combat-test-results-*.json
```

## What Gets Tested

### Combat Mechanics
- Casualty calculations
- Power ratio calculations
- Land transfer
- Gold transfer
- XP gains
- Happiness changes
- Anti-bully penalties
- Defense bonuses

### Race Interactions
- All 56 race vs race matchups
- Unique racial modifiers
- Balanced win rates

### Army Dynamics
- Army size scaling (1 to 100,000)
- Unit composition effects
- Troop level calculations
- Mixed unit battles

### Defense Systems
- Undefended kingdoms
- Basic fortifications
- Moderate defenses
- Heavy fortifications
- Wall effectiveness
- Defense bonuses

### Edge Cases
- Minimum troops (1 fighter)
- Extreme imbalances (1 vs 50,000)
- Zero defenders
- Large armies (100,000+)
- Unusual scenarios

## Expected Results

### Viability
- **✓ All tests should pass (100% pass rate)**
- No crashes or calculation errors
- All combat results valid

### Balance
- **⚖️ Win rates 40-60% for each race**
- No race >70% or <30% overall win rate
- Race matchups mostly symmetric

### Efficiency
- **⚡ Casualty rates within bounds**
- Attackers: 5-15% casualties (winners)
- Defenders: 2-10% casualties (losers)
- XP calculations consistent

### Edge Cases
- **✓ All handled gracefully**
- No NaN, Infinity, or negative values
- Proper bounds checking
- Sensible calculations for extremes

## Interpreting Results

### Green Flags ✓
- 100% test pass rate
- Win rates 40-60% for all races
- Casualty rates within expected ranges
- Edge cases handled gracefully

### Yellow Flags ⚠️
- 90-99% pass rate → minor issues to fix
- Win rate variance 30-70% → some balance tuning needed
- Casualty rates occasionally outside bounds → edge cases to address

### Red Flags ✗
- <90% pass rate → deployment blocking issues
- Win rates >70% or <30% → fundamental balance problem
- Crashes or NaN values → calculation bugs

## Next Steps

After testing:

1. **If all tests pass:**
   - PR review with test results attached
   - Merge to main
   - Deploy to production
   - Monitor player feedback

2. **If some tests fail:**
   - Review failure details
   - Fix identified issues
   - Re-run specific test scenarios
   - Iterate until pass rate ≥95%

3. **If balance issues found:**
   - Note which races are OP/weak
   - Adjust racial modifiers
   - Re-run balance tests
   - Iterate until win rates ~50%

## Files

- `setup-test-kingdoms.js` - Initialize test kingdoms
- `combat-test-runner.js` - Execute parameterized tests
- `analyze-results.js` - Analyze and report results
- `test-results/` - Saved test result JSON files
- `README.md` - This file

## Help

```bash
node test-combat-harness/combat-test-runner.js --help
```
