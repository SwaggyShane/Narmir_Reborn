# Advanced Testing - Quick Start

## What You Need

Advanced level testing with all race combinations and unit level variance (1-100).

## One-Command Start

```bash
cd /home/user/Narmir_Reborn
node test-combat-harness/advanced-level-testing.js
```

**That's it!** The script will:
1. Run all 4 test phases
2. Generate a markdown report automatically
3. Save to `test-results/advanced-level-testing-TIMESTAMP.md`

## What Gets Tested

### Phase 1: Fighters Only
- 704 tests (8 races × 8 races × 11 levels from 1-100)
- ~5 minutes
- See how unit levels affect pure melee combat

### Phase 2: Fighters + Rangers
- 704 tests (mixed ranged/melee)
- ~5 minutes
- Includes research impact

### Phase 3: Full Troop Mix
- 704 tests (fighters + rangers + mages)
- ~5 minutes
- Includes magic interactions

### Phase 4: Full Armies
- 64 tests (all unit types at level 100)
- ~1 minute
- End-game balance check

**Total Duration:** ~16 minutes | **Total Tests:** 2,176

## Report Location

After running, find your report here:
```
/home/user/Narmir_Reborn/test-results/advanced-level-testing-*.md
```

Open in any markdown viewer for detailed analysis.

## Key Metrics in Report

- **Win Rates:** Should be 48-52% per race matchup
- **Same-Race Mirror:** Should be exactly 50%
- **Casualty Ratio:** Expect 1.5x-3.0x (winner kills 1.5-3x more than loses)
- **Level Impact:** Higher levels = slightly higher win rates

## Red Flags to Watch For

❌ **Bad:**
- Any race >60% or <40% win rate
- Casualty ratios >5x (power imbalance)
- Mirror matches not at 50%
- Level 100 vastly different from level 1

✅ **Good:**
- All races clustered 45-55% win rate
- Consistent casualty ratios across phases
- Mirror matches at 50%
- Smooth progression as levels increase

## Next: Integrate with Actual Combat

Currently uses placeholder simulation. To use real combat:

1. Update `advanced-level-testing.js` line ~140
2. Replace `simulateCombat()` to call actual `engine.resolveMilitaryAttack()`
3. Extract unit losses from combat report
4. Re-run tests

Then your reports will show REAL casualty data per unit type!

## Files

- `advanced-level-testing.js` - Main test runner
- `ADVANCED-TESTING.md` - Full documentation
- `ADVANCED-QUICK-START.md` - This file

---

**Remember:** This is LOCAL ONLY. Don't commit test results to remote, but save the markdown reports for analysis!
