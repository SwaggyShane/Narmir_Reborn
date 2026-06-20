# Narmir Reborn - Happiness System Tuning Suggestions

## Current Issue
Happiness recovers **too quickly** and reaches the **120 cap** very easily — even after 100% taxation and riots. This removes meaningful long-term strategic tension.

---

## Core Problems Identified
- Strong passive recovery (especially from Entertainment research + Taverns)
- Weak tax penalty at high tax rates
- Safety bonus recovers too fast
- Lack of strong late-game happiness sinks
- Happiness becomes mostly "set and forget" after mid-game

---

## Recommended Changes

### 1. Increase Tax Penalty (Highest Priority)

```js
// Current (too weak)
const taxPenalty = Math.floor(((taxRate - 42) / 58) * 60);

// Recommended
const taxPenalty = Math.floor(((taxRate - 42) / 58) * 110);
```

**Why?** 100% tax should feel painful and have lasting consequences.

### 2. Reduce Passive Recovery Rate

```js
// In getHappinessRecoveryRate()
return Math.max(0.2, Math.min(2.8, baseRecovery));
```

- Lower minimum recovery: **0.5 → 0.2**
- Lower maximum recovery: ~5+ → **2.8**

This makes sustained high happiness require active investment.

### 3. Slow Down Safety Recovery

```js
// Suggested slower recovery
const safety = Math.max(-30, Math.min(20, 20 - Math.floor(turnsSinceLastAttack * 1.6)));
```

Make recovery non-linear if possible (faster early, slower later).

### 4. Add New Late-Game Sinks

#### A. War Weariness (Strongly Recommended)
```js
let warWeariness = 0;
if (kingdom.atWar || recentRaids > 0) {
    warWeariness = -Math.min(18, (activeWars * 5) + (recentRaids * 2.5));
}
```

#### B. Empire Size / Cultural Decay
```js
const sizePenalty = Math.floor(Math.log10(totalPowerOrBuildings) * -5);
```

#### C. Stronger Overcrowding Penalty
```js
const overcrowding = Math.max(0, (population - housingCapacity * 1.3) * 0.018);
```

### 5. High Happiness Rewards Tuning

Make 110–120 happiness **rarer but more rewarding**:
- Boost `happinessCombatMult` at 110+
- Add small prestige or XP bonuses
- Unlock special events/boons only at very high happiness

---

## Suggested Testing Plan

1. Create a mid-to-late game test kingdom
2. Set tax to 100% → trigger riots
3. Simulate **40–60 turns**
4. Check how long it takes to return to 110+
5. Test peaceful vs aggressive playstyles

---

## Quick Implementation Priority

1. Tax penalty increase
2. Recovery rate reduction
3. Add War Weariness
4. Tweak Safety recovery
5. Add 1–2 additional sinks if needed

---

**Goal**: Happiness should feel like an important ongoing kingdom management system rather than something that auto-corrects to max. 

This should create more meaningful trade-offs between aggression, taxation, and internal stability.
