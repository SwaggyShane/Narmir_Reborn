# Advanced Combat Level Testing

## Overview

Comprehensive testing framework for validating combat balance across all race combinations with varying unit levels.

**Test Scope:**
- **64 Race Combinations:** All 8 races attacking all 8 races (including same-race vs same-race)
- **4 Phases:** Escalating unit complexity from fighters-only to full armies
- **Unit Level Variance:** Levels 1-100 in +10 increments (11 levels per phase)
- **Detailed Reports:** Markdown format with casualty analysis per unit type and level

---

## Phase Structure

### Phase 1: Fighters Only
- **Unit Composition:** 100 fighters vs 100 fighters
- **Level Range:** 1-100 (increments of +10)
- **Test Count:** 8 × 8 races × 11 levels = **704 tests**
- **Focus:** Pure melee combat balance across unit levels

**Sample Matchup:**
```
Human (Level 50 Fighters) vs Orc (Level 50 Fighters)
Expected: Orc has +8% modifier, should win slightly more often
```

### Phase 2: Fighters + Rangers
- **Unit Composition:** 50 fighters + 50 rangers vs same
- **Level Range:** 1-100 (increments of +10)
- **Test Count:** 8 × 8 races × 11 levels = **704 tests**
- **Focus:** Mixed melee/ranged combat, research impact

**Sample Matchup:**
```
Dire Wolf (Level 30 Fighters + Rangers) vs Dark Elf (Level 30)
Expected: Dire Wolf has military advantage (1.3x base, 1.0x modifier)
```

### Phase 3: Full Troop Mix
- **Unit Composition:** 40 fighters + 30 rangers + 30 mages vs same
- **Level Range:** 1-100 (increments of +10)
- **Test Count:** 8 × 8 races × 11 levels = **704 tests**
- **Focus:** Magic vs melee, research interactions

**Sample Matchup:**
```
High Elf (Level 80 Mixed) vs Orc (Level 80 Mixed)
Expected: High Elf has magic advantage (1.2x), Orc has military (1.2x)
```

### Phase 4: Full Armies (Level 100)
- **Unit Composition:** 
  - Combat: 300 fighters + 150 rangers + 150 mages
  - Special: 50 war machines + 50 ninjas + 50 thieves + 50 clerics + 50 engineers
- **Level Range:** All units at Level 100
- **Test Count:** 8 × 8 races = **64 tests**
- **Focus:** End-game balance, special unit interactions

---

## Usage

### Run All Tests
```bash
cd /home/user/Narmir_Reborn
node test-combat-harness/advanced-level-testing.js
```

**Output:**
- Real-time progress (tests completed per phase)
- Markdown report saved to `test-results/advanced-level-testing-TIMESTAMP.md`
- Duration and statistics

### Expected Duration
- **Phase 1:** ~5 minutes (704 tests)
- **Phase 2:** ~5 minutes (704 tests)
- **Phase 3:** ~5 minutes (704 tests)
- **Phase 4:** ~1 minute (64 tests)
- **Total:** ~16 minutes

---

## Report Format

All reports are in **Markdown (.md)** format for easy reading and documentation.

### Section 1: Test Metadata
```markdown
**Generated:** 2026-06-09T12:34:56.789Z
**Duration:** 956.42s
**Total Tests:** 2176
```

### Section 2: Phase 1 Analysis
```markdown
## Fighters Only (1-100)

**Total Tests:** 704

### Win Rates by Race Combination

| Attacker  | Defender  | Win Rate | Avg Casualties Ratio |
|-----------|-----------|----------|----------------------|
| human     | orc       | 47.3%    | 2.14x               |
| orc       | human     | 52.7%    | 2.18x               |
...

### Level Impact Analysis

| Level | Avg Win Rate (Same Race) | Avg Casualty Ratio |
|-------|--------------------------|-------------------|
| 1     | 50.1%                    | 1.89x              |
| 10    | 49.8%                    | 2.01x              |
...
```

### Section 3: Casualty Details
Per-matchup detailed breakdown including:
- Fighter losses by attacker/defender
- Ranger losses by attacker/defender
- Mage losses by attacker/defender
- Casualty ratio (attacker losses / defender losses)

### Section 4: Summary Statistics
- Overall win rate across all tests
- Same-race mirror match win rate (should be ~50%)
- Average casualty ratio
- Race-by-race viability scores

---

## What to Look For

### Balance Indicators ✅

**Good Signs:**
- Win rates cluster around 48-52% per race matchup
- Same-race mirror matches show ~50% win rate
- Casualty ratios stay within 1.5x-3.0x range
- No single race dominates across all phases

**Red Flags:**
- Any matchup showing >65% or <35% win rate
- Race modifiers clearly favoring specific races
- Casualty ratios >5x (indicates power imbalance)
- Same-race matches deviating significantly from 50%

### Level Impact ⚖️

**Expected Patterns:**
- Higher level units should have slightly higher win rates
- Casualty ratios should remain consistent across levels
- Level advantage should be ~5-10% per 20 levels

**Concerns:**
- Level 100 units winning significantly more/less than level 1
- Casualty ratios spiking at specific levels
- Non-linear level scaling (indicates formula issues)

### Race Viability 🎯

**Per-Phase Metrics:**
1. **Win Rate as Attacker:** Should be 40-60% for each race
2. **Win Rate as Defender:** Should be 40-60% for each race
3. **Mirror Match Rate:** Should be exactly 50%

**Action Items:**
- If race X has <40% win rate in phase 1, may need buff
- If race X has >60% win rate, may need nerf
- If mirror match is <45% or >55%, check for deterministic advantage

---

## Integration with Combat Engine

The testing framework currently uses **placeholder combat simulation**. To connect with actual game engine:

1. **Update `simulateCombat()` method** in `advanced-level-testing.js`
2. **Call actual `resolveMilitaryAttack()`** from `game/engine.js`
3. **Track detailed unit losses** from combat report

### Example Integration:
```javascript
async simulateCombat(params) {
  const attacker = await this.buildKingdom(params.attackerRace, params.attackerUnits, params.attackerLevels);
  const defender = await this.buildKingdom(params.defenderRace, params.defenderUnits, params.defenderLevels);
  
  const result = engine.resolveMilitaryAttack(
    attacker,
    defender,
    { 
      fighters: params.attackerUnits.fighters,
      rangers: params.attackerUnits.rangers,
      mages: params.attackerUnits.mages,
    }
  );
  
  return {
    win: result.win,
    attackerLosses: {
      fighters: result.report.atkFightersLost,
      rangers: result.report.atkRangersLost,
    },
    defenderLosses: {
      fighters: result.report.defFightersLost,
      rangers: result.report.defRangersLost,
    },
    casualtyRatio: calculateRatio(result),
  };
}
```

---

## Example Report Output

```markdown
# Advanced Combat Level Testing Report

**Generated:** 2026-06-09T12:34:56.789Z
**Duration:** 956.42s
**Total Tests:** 2176

## Fighters Only (1-100)

**Total Tests:** 704

### Win Rates by Race Combination

| Attacker  | Defender  | Win Rate | Avg Casualties Ratio |
|-----------|-----------|----------|----------------------|
| human     | orc       | 47.3%    | 2.14x                |
| human     | dwarf     | 50.1%    | 2.05x                |
| human     | dark_elf  | 52.8%    | 1.98x                |
...

### Level Impact Analysis

| Level | Avg Win Rate (Same Race) | Avg Casualty Ratio |
|-------|--------------------------|-------------------|
| 1     | 50.1%                    | 1.89x              |
| 10    | 49.9%                    | 1.94x              |
| 20    | 50.2%                    | 2.01x              |
...

## Fighters + Rangers (1-100)

**Total Tests:** 704

### Win Rates by Race Combination
...

## Full Troop Mix (1-100)

**Total Tests:** 704

### Win Rates by Race Combination
...

## Full Armies (Level 100)

**Total Tests:** 64

### Win Rates by Race Combination
...

## Summary Statistics

### Overall Statistics

- **Total Tests Run:** 2176
- **Overall Win Rate:** 50.2%
- **Average Casualty Ratio (Winner):** 2.03x
- **Same-Race Win Rate:** 50.0%
```

---

## Next Steps

1. ✅ Framework structure created
2. ⏳ **Connect to actual combat engine** (resolveMilitaryAttack)
3. ⏳ **Run full test suite** (~16 minutes)
4. ⏳ **Analyze results** for balance issues
5. ⏳ **Adjust race modifiers** if needed
6. ⏳ **Run iterative tests** to verify fixes
7. ⏳ **Generate final report** for deployment

---

## Notes

- **LOCAL ONLY:** This testing framework stays local and is not pushed to remote
- **No Database Pollution:** Creates temporary test kingdoms that are cleaned up
- **Markdown Output:** All reports in `.md` format for easy review
- **Repeatable:** Same seeds produce consistent results for debugging
- **Extensible:** Framework designed to add new phases or unit combinations

