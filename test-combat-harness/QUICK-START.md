# Combat Test Harness - Quick Start Guide

## What This Is

An AI-controlled automated testing system that validates the new combat system across:
- **All 8 races** competing against each other
- **All army sizes** from 1 soldier to 100,000+
- **All defense levels** from undefended to heavily fortified
- **Edge cases** that might break the system

Think of it as an automated stress test that tries to break combat in every possible way.

## 30-Second Setup

```bash
# 1. Initialize test kingdoms (one per race)
node test-combat-harness/setup-test-kingdoms.js

# 2. Run comprehensive test suite (1500+ scenarios)
node test-combat-harness/combat-test-runner.js --all-scenarios

# 3. Get detailed analysis report
node test-combat-harness/analyze-results.js combat-test-results-*.json
```

That's it! Results go to `test-results/` directory as JSON files.

## What Gets Tested

### Viability ✓
Does combat work without crashing?
- 100% pass rate = ✓ System works
- <90% pass rate = ✗ System has bugs

### Balance ⚖️
Are all races equally strong?
- Each race should win ~50% of battles as attacker
- If one race wins >70% = overpowered
- If one race wins <30% = underpowered

### Efficiency ⚡
Are calculations correct?
- Casualty rates should be 5-15% (attacker), 2-10% (defender)
- XP gains should be consistent
- Resources should transfer correctly

### Edge Cases 🔍
What breaks under extreme conditions?
- 1 fighter attacking 50,000 troops?
- 0 defenders?
- 100,000 vs 100,000?
- Heavily fortified with extreme imbalance?

## Common Commands

### Quick Test (Single Matchup)
```bash
# Human attacks Orc (1000 vs 1000, no defense)
node test-combat-harness/combat-test-runner.js --attacker human --defender orc
```

### Extreme Test
```bash
# 1 human fighter attacks 5000 heavily fortified orcs
node test-combat-harness/combat-test-runner.js \
  --attacker human \
  --defender orc \
  --attacker-army 1 \
  --defender-army 5000 \
  --defense heavy
```

### All Race Matchups (64 combinations)
```bash
node test-combat-harness/combat-test-runner.js --all-race-matchups
```

### COMPREHENSIVE (1500+ scenarios)
```bash
# Takes longer but tests EVERYTHING
node test-combat-harness/combat-test-runner.js --all-scenarios
```

### Stress Test
```bash
# Test edge cases that might break things
node test-combat-harness/combat-test-runner.js --stress-test
```

## Reading Results

Results files are in `test-results/` named like:
```
combat-test-results-1686754322.json
```

Analyze with:
```bash
node test-combat-harness/analyze-results.js combat-test-results-1686754322.json
```

### Report Shows

```
🎮 Combat System Analysis Report

✓ Tests Run: 1500
✓ Passed: 1500
✗ Failed: 0

🔧 VIABILITY - All tests pass? YES ✓
⚖️  BALANCE - Races fairly matched? YES ✓ (45-55% win rates)
⚡ EFFICIENCY - Calculations correct? YES ✓ (casualties in bounds)
🔍 EDGE CASES - Extremes handled? YES ✓
```

## What's Testing What

| Test Type | What It Does | Time | Scenarios |
|-----------|-------------|------|-----------|
| Single | One race vs another | <1s | 1 |
| All Matchups | All 8 races vs all 8 races | ~2min | 56 |
| All Scenarios | Matchups + sizes + defenses | ~30min | 1500+ |
| Stress Test | Edge cases & extremes | ~5min | 5-10 |

## Race List

The 8 races being tested:
1. **Human** - Balanced
2. **Orc** - Warrior strength
3. **Dwarf** - Mountain craftsmanship
4. **Dark Elf** - Shadow & magic
5. **Vampire** - Undying power
6. **Dire Wolf** - Pack hunters
7. **Wood Elf** - Nature & exploration
8. **Ogre** - Brute strength

## Success Criteria

### Before Deployment
- ✓ 100% pass rate (all tests pass)
- ✓ Balance: 40-60% win rates for each race
- ✓ Edge cases: No crashes on extremes
- ✓ Calculations: Casualties in expected ranges

### If Tests Fail
1. **Red Flags** (<90% pass):
   - Fix bugs
   - Re-test
   - Don't deploy

2. **Yellow Flags** (90-99% pass):
   - Review failures
   - Fix identified issues
   - Re-test
   - Can deploy with caution

3. **Balance Issues** (>70% or <30% win rate):
   - Note which race is OP/weak
   - Adjust racial stats
   - Re-test balance only

## File Structure

```
test-combat-harness/
├── README.md                      (Full documentation)
├── QUICK-START.md                (This file)
├── setup-test-kingdoms.js         (Initialize 8 kingdoms)
├── combat-test-runner.js          (Run parameterized tests)
├── analyze-results.js             (Generate reports)
├── run-all-tests.sh              (Run everything)
└── test-results/                  (Where results go)
    └── combat-test-results-TIMESTAMP.json
```

## Next Steps

1. **Initial Setup**
   ```bash
   node test-combat-harness/setup-test-kingdoms.js
   ```

2. **Test Something Small**
   ```bash
   node test-combat-harness/combat-test-runner.js --all-race-matchups
   ```

3. **Run Everything** (when ready)
   ```bash
   node test-combat-harness/combat-test-runner.js --all-scenarios
   ```

4. **Analyze Results**
   ```bash
   node test-combat-harness/analyze-results.js combat-test-results-*.json
   ```

5. **Review Report** - Look for:
   - All tests passing ✓
   - Balanced win rates ⚖️
   - Reasonable casualties ⚡
   - No edge case crashes 🔍

## Troubleshooting

**"Database not found"**
- Run from project root directory
- Ensure `narmir.db` exists
- Set `DATABASE_FILE` environment variable

**"Tests taking too long"**
- Start with `--all-race-matchups` (56 tests, ~2 min)
- Then try `--all-scenarios` (1500+ tests, ~30 min)
- Can run `--stress-test` anytime (~5 min)

**"Some tests failed"**
- Check test-results JSON for error details
- Look at which scenarios failed
- Run analysis report for insights

## Support

See `README.md` for full documentation and advanced options.
