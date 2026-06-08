# Combat Test Harness - Complete System

## System Overview

A comprehensive automated testing framework that evaluates the combat system for:
- **Viability** - Does it work without crashing?
- **Balance** - Are all races equally strong?
- **Efficiency** - Are calculations correct?
- **Edge Cases** - What breaks under extreme conditions?

## What Was Created

### 1. **setup-test-kingdoms.js**
Initializes 8 test kingdoms (one per race) in the database.

**Purpose:** Creates baseline test data
**Input:** None (uses database)
**Output:** 8 kingdoms ready for combat testing
**Time:** ~5 seconds

```bash
node test-combat-harness/setup-test-kingdoms.js
```

### 2. **combat-test-runner.js**
Executes parameterized combat scenarios with configurable parameters.

**Purpose:** Run combat tests with specific parameters
**Input:** CLI arguments (attacker, defender, army sizes, defenses)
**Output:** JSON results file
**Modes:**
- Single matchup
- All race matchups (56 combinations)
- Comprehensive (1500+ scenarios)
- Stress test (edge cases)

```bash
# Single test
node test-combat-harness/combat-test-runner.js --attacker human --defender orc

# All scenarios
node test-combat-harness/combat-test-runner.js --all-scenarios

# Edge cases
node test-combat-harness/combat-test-runner.js --stress-test
```

### 3. **analyze-results.js**
Analyzes test results and generates comprehensive reports.

**Purpose:** Evaluate test results for viability, balance, efficiency
**Input:** JSON results file
**Output:** Formatted analysis report (stdout)
**Analyzes:**
- Viability (pass rates)
- Balance (win rates by race)
- Efficiency (casualty rates, calculations)
- Edge cases (extreme scenarios)

```bash
node test-combat-harness/analyze-results.js combat-test-results-TIMESTAMP.json
```

### 4. **run-all-tests.sh**
Bash script that orchestrates complete test suite.

**Purpose:** Run all phases in sequence
**Phases:**
1. Race matchups (56 scenarios)
2. Comprehensive testing (1500+ scenarios)
3. Stress testing (edge cases)
4. Analysis (automatic report generation)

```bash
bash test-combat-harness/run-all-tests.sh
```

### 5. **Documentation**

#### README.md
Complete detailed documentation covering:
- Full feature list
- All command options
- Workflow examples
- Expected results
- Interpretation guide
- Troubleshooting

#### QUICK-START.md
Get-started-in-5-minutes guide with:
- 30-second setup
- Common commands
- What each test does
- Success criteria
- Quick reference

#### INDEX.md (this file)
Overview of entire system and what was created.

## Test Scenarios Covered

### Race Matchups
All 8 races tested against each other:
- Human, Orc, Dwarf, Dark Elf, Vampire, Dire Wolf, Wood Elf, Ogre
- 56 total combinations (8 × 7, excluding self-battles)

### Army Sizes
- 1 fighter (minimum)
- 10, 50, 100, 500, 1000, 5000, 10000, 50000+ troops
- Tests scaling from individual soldiers to massive armies

### Defense Levels
- **None**: Undefended kingdom
- **Basic**: Basic fortifications
- **Moderate**: Moderate defenses
- **Heavy**: Heavily fortified

### Edge Cases & Extremes
- 1 attacker vs 0 defenders (should fail gracefully)
- 1 attacker vs 50,000 defenders (extreme imbalance)
- 50,000 attackers vs 1 defender (opposite imbalance)
- 100,000 vs 100,000 (massive armies)
- Heavily fortified small kingdoms

## Test Coverage Matrix

```
Scenarios = Race Matchups × Army Sizes × Defense Levels
          = 56 × 7 × 4
          = 1,568 base scenarios
          + Edge cases
          ≈ 1,600+ total scenarios
```

### Breakdown
| Category | Count | Time |
|----------|-------|------|
| Race matchups only | 56 | ~2 min |
| + Army sizes | 392 | ~10 min |
| + Defense levels | 1,568 | ~30 min |
| Edge cases | 5-10 | ~5 min |
| Analysis | 1 | ~1 min |

## Quick Start (3 Commands)

```bash
# 1. Initialize test kingdoms
node test-combat-harness/setup-test-kingdoms.js

# 2. Run tests (pick one)
node test-combat-harness/combat-test-runner.js --all-race-matchups  # Fast (56 tests)
node test-combat-harness/combat-test-runner.js --all-scenarios      # Complete (1500+ tests)

# 3. Analyze results
node test-combat-harness/analyze-results.js combat-test-results-*.json
```

## Report Sections

### Viability Analysis 🔧
- ✓ All tests pass?
- ✗ Crashes detected?
- Deployment blocking issues?

### Balance Analysis ⚖️
- Win rates by race
- Overpowered races (>65% win rate)
- Underpowered races (<35% win rate)
- Race-specific matchup data

### Efficiency Analysis ⚡
- Casualty rate validation
- XP calculation correctness
- Resource transfer calculations
- Morale impact calculations

### Edge Case Analysis 🔍
- Extreme army sizes handled?
- Defense level interactions
- NaN/Infinity checks
- Boundary condition testing

## Success Criteria

✓ **Ready to Deploy:**
- 100% test pass rate
- Win rates 40-60% for all races
- Casualty rates within bounds
- All edge cases handled

⚠️ **Review Needed:**
- 90-99% pass rate
- Win rate variance 30-70%
- Some edge cases failing

✗ **Do Not Deploy:**
- <90% pass rate
- Win rates >70% or <30%
- Crashes or calculation errors

## File Structure

```
test-combat-harness/
├── INDEX.md                        ← You are here
├── README.md                       (Full documentation)
├── QUICK-START.md                  (5-minute guide)
├── setup-test-kingdoms.js          (Create test data)
├── combat-test-runner.js           (Run tests)
├── analyze-results.js              (Generate reports)
├── run-all-tests.sh               (Orchestrate everything)
└── test-results/                   (Results saved here)
    ├── combat-test-results-1686754322.json
    ├── combat-test-results-1686754400.json
    └── ...
```

## Data Flow

```
setup-test-kingdoms.js
        ↓
    (8 kingdoms created)
        ↓
combat-test-runner.js
        ↓
    (1500+ scenarios executed)
        ↓
    combat-test-results-TIMESTAMP.json
        ↓
analyze-results.js
        ↓
    (Analysis report → stdout)
```

## Usage Examples

### For Developers
```bash
# Quick sanity check before commit
node test-combat-harness/combat-test-runner.js --all-race-matchups

# After code changes
node test-combat-harness/combat-test-runner.js --all-scenarios
```

### For Code Review
```bash
# Run comprehensive tests
node test-combat-harness/combat-test-runner.js --all-scenarios

# Analyze for issues
node test-combat-harness/analyze-results.js combat-test-results-*.json
```

### For Pre-Deployment
```bash
# Complete validation
bash test-combat-harness/run-all-tests.sh

# Generates all reports
# Results in test-results/
```

## Key Features

✓ **Parameterized** - Configure any matchup, army size, defense level
✓ **Comprehensive** - 1500+ scenarios testing all possibilities
✓ **Automated** - Set it and forget it, get detailed reports
✓ **Extensible** - Easy to add new test scenarios
✓ **Documented** - Full documentation + quick start guides
✓ **Systematic** - Tests viability, balance, efficiency, edge cases

## Next Steps

1. **Run Setup**
   ```bash
   node test-combat-harness/setup-test-kingdoms.js
   ```

2. **Start Small**
   ```bash
   node test-combat-harness/combat-test-runner.js --all-race-matchups
   ```

3. **Run Complete Suite** (when ready)
   ```bash
   node test-combat-harness/combat-test-runner.js --all-scenarios
   ```

4. **Analyze Results**
   ```bash
   node test-combat-harness/analyze-results.js combat-test-results-*.json
   ```

5. **Review Report** - Check viability, balance, efficiency, edge cases

## Support

- Full guide: See `README.md`
- Quick start: See `QUICK-START.md`
- Help: `node combat-test-runner.js --help`

---

**Created:** 2026-06-08
**Status:** Ready to use
**Test Scenarios:** ~1,600+
**Time to full audit:** ~45 minutes

Good luck testing! 🚀
