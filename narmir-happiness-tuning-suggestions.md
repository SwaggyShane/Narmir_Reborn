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
// Current (too weak — max penalty of 60 barely dents a strong kingdom)
const taxPenalty = Math.floor(((taxRate - 42) / 58) * 60);

// Recommended — target ~85 max penalty, not 110
// 110 risks pushing past the -50 floor at 100% tax when combined with other sinks
const taxPenalty = Math.floor(((taxRate - 42) / 58) * 85);
```

**Why?** 100% tax should feel painful and have lasting consequences, but the penalty
should not alone be enough to hard-floor a kingdom. The curve is intentionally linear
here — steeper non-linear options can be revisited after playtesting.

### 2. Reduce Passive Recovery Rate (Implement First — Highest Impact)

```js
// In getHappinessRecoveryRate()
// Current: clamped [0.5, 5.0]
return Math.max(0.2, Math.min(2.8, baseRecovery));
```

- Lower minimum recovery: **0.5 → 0.2**
- Lower maximum recovery: **5.0 → 2.8**

This is the single highest-impact change. The current 5.0 ceiling lets heavy Entertainment
investment auto-heal almost any crisis within 20 turns. Cutting to 2.8 means sustained
high happiness requires ongoing active management, not just a one-time research investment.

### 3. Slow Down Safety Recovery

**Bug in original formula** — the previous suggestion (`20 - turnsSinceLastAttack * 1.6`)
returned +20 at turn 0 (just attacked), eliminating the initial penalty entirely. Corrected:

```js
// Start at -20 instead of -10, recover at 1.6/turn instead of 3/turn
// Current: -10 + min(10, turnsSinceLastAttack) * 3  (full recovery in ~10 turns)
// Revised: starts lower, recovers slower (~19 turns to full recovery)
const safety = Math.max(-30, Math.min(20, -20 + Math.floor(turnsSinceLastAttack * 2.1)));
```

Being attacked now stings harder and lingers longer without feeling permanent.

### 4. Add New Late-Game Sinks

#### A. War Weariness (Strongly Recommended)
```js
let warWeariness = 0;
if (kingdom.atWar || recentRaids > 0) {
    warWeariness = -Math.min(18, (activeWars * 5) + (recentRaids * 2.5));
}
```

Requires tracking `recentRaids` — non-trivial but high design value. Aggression should
carry a domestic cost.

#### B. Empire Size / Population Pressure

```js
// Raw population, capped at -30
const sizePenalty = Math.min(30, Math.floor(Math.log10(kingdom.population || 1) * 5)) * -1;
```

- 10,000 pop  → -20
- 100,000 pop → -25
- 1,000,000 pop → -30 (cap)
- Graceful zero-pop handling via `|| 1` (log10(0) is -Infinity)

Large empires pay an ongoing happiness cost just for existing. Scales naturally with
growth — early kingdoms barely feel it, late-game empires need active management.

#### C. Stronger Overcrowding Penalty
```js
const overcrowding = Math.max(0, (population - housingCapacity * 1.3) * 0.018);
```

### 5. High Happiness Rewards Tuning

Make 110–120 happiness **rarer but more rewarding**:
- Boost `happinessCombatMult` at 110+ (currently maxes at 1.5× at 120 — consider 1.6×)
- Add small prestige or XP bonuses
- Unlock special events/boons only at very high happiness

Treat this as a separate design pass after the sinks are balanced.

---

## Suggested Testing Plan

1. Create a mid-to-late game test kingdom
2. Set tax to 100% → trigger riots
3. Simulate **40–60 turns**
4. Check how long it takes to return to 110+
5. Test peaceful vs aggressive playstyles
6. Verify large-population kingdoms feel the size penalty without being unplayable

---

## Implementation Priority

1. Recovery rate reduction (#2) — highest impact, lowest risk, implement first
2. Tax penalty increase to ~85 (#1)
3. Safety recovery fix (#3)
4. War Weariness (#4A) — most design depth, needs `recentRaids` tracking
5. Population pressure (#4B) — clean formula, ready to implement
6. Overcrowding tweak (#4C)
7. High happiness rewards (#5) — separate pass after sinks are balanced

---

**Goal**: Happiness should feel like an important ongoing kingdom management system
rather than something that auto-corrects to max. These changes create meaningful
trade-offs between aggression, taxation, growth, and internal stability.
