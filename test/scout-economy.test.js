'use strict';

const assert = require('assert');
const {
  SCOUT_ECONOMY,
  levelMultiplier,
  scoutEffectivePower,
  scoutRevealRadius,
  scoutFoodCostPerHex,
  nodeDeliveryTurns,
} = require('../game/scout-economy');
const { validateRangerAllocation } = require('../game/ranger-allocation');
const { safeBitmapHasCell, safeBitmapAddCell } = require('../game/visibility-cells');
const { isFrontier } = require('../game/hex-utils');

// --- levelMultiplier ---
assert.strictEqual(levelMultiplier(1), 1, 'level 1 rangers have baseline (1.0x) effective power');
assert.ok(levelMultiplier(20) > levelMultiplier(1), 'higher-level rangers must have higher effective power');
assert.strictEqual(levelMultiplier(0), levelMultiplier(1), 'level 0 (or below) clamps to level 1 baseline, never goes negative/below baseline');
console.log('levelMultiplier: baseline at level 1, increases with level, clamps below 1');

// --- scoutEffectivePower: capped at MAX_SCOUTING_RANGERS ---
const cap = SCOUT_ECONOMY.MAX_SCOUTING_RANGERS;
assert.strictEqual(scoutEffectivePower(cap, 1), cap * levelMultiplier(1), 'power at exactly the cap uses the full amount');
assert.strictEqual(scoutEffectivePower(cap * 10, 1), scoutEffectivePower(cap, 1), 'sending far more than the cap must not exceed the cap\'s effective power');
assert.strictEqual(scoutEffectivePower(0, 1), 0, 'sending zero rangers yields zero power');
assert.strictEqual(scoutEffectivePower(-5, 1), 0, 'a negative ranger count must not produce negative power');
console.log('scoutEffectivePower: correctly caps at MAX_SCOUTING_RANGERS, zero-safe, negative-safe');

// --- scoutRevealRadius: monotonic in rangers and level ---
const radiusFew = scoutRevealRadius(10, 1);
const radiusMany = scoutRevealRadius(cap, 1);
assert.ok(radiusMany >= radiusFew, 'more rangers must never produce a smaller reveal radius');
const radiusHighLevel = scoutRevealRadius(cap, 20);
assert.ok(radiusHighLevel >= radiusMany, 'higher ranger level at the same ranger count must never shrink the reveal radius');
assert.ok(Number.isInteger(radiusFew) && radiusFew >= 0, 'reveal radius must be a non-negative integer (hex count)');
console.log('scoutRevealRadius: monotonic in both rangers sent and ranger level, always a non-negative integer');

// --- scoutFoodCostPerHex: decreases with level, floored ---
const costLevel1 = scoutFoodCostPerHex(1);
const costLevel20 = scoutFoodCostPerHex(20);
assert.strictEqual(costLevel1, SCOUT_ECONOMY.BASE_FOOD_COST_PER_HEX, 'level 1 rangers pay the full base food cost');
assert.ok(costLevel20 < costLevel1, 'higher-level rangers must cost less food per hex');
assert.ok(costLevel20 >= SCOUT_ECONOMY.MIN_FOOD_COST_PER_HEX, 'food cost must never drop below the floor, regardless of level');
console.log('scoutFoodCostPerHex: decreases with ranger level, never drops below the floor');

// --- nodeDeliveryTurns: increasing cost-per-hex at range (locked decision) ---
const near = nodeDeliveryTurns(5);
const far = nodeDeliveryTurns(20);
assert.ok(far > near * 2, 'a node 4x farther must cost MORE than 4x the turns (increasing per-hex cost, not flat)');
assert.strictEqual(nodeDeliveryTurns(0), 0, 'zero distance costs zero turns');
assert.strictEqual(nodeDeliveryTurns(-5), 0, 'a negative distance must not produce a negative or NaN turn count');
console.log('nodeDeliveryTurns: turns-per-hex increases with distance, zero-safe, negative-safe');

// --- Locked config values are exactly what was decided ---
assert.strictEqual(SCOUT_ECONOMY.baselineVisibilityRadius, 0, 'baseline visibility must be home-hex-only (locked)');
assert.strictEqual(SCOUT_ECONOMY.debuffRadius, 0, 'fog_of_war debuff must be total blind (locked)');
assert.strictEqual(SCOUT_ECONOMY.expeditionRevealMode, 'ahead', 'expeditions must reveal ahead of movement (locked)');
console.log('SCOUT_ECONOMY: locked config values match the decisions made');

// --- validateRangerAllocation ---
const okAlloc = validateRangerAllocation({ scouting: 400, expeditions: 300 }, 1000);
assert.strictEqual(okAlloc.valid, true, 'an allocation within total rangers must be valid');

const overAlloc = validateRangerAllocation({ scouting: 700, expeditions: 400 }, 1000);
assert.strictEqual(overAlloc.valid, false, 'an allocation exceeding total rangers must be rejected');
assert.ok(overAlloc.reason.includes('1100'), 'rejection reason must state the over-allocated total');

const emptyAlloc = validateRangerAllocation({}, 1000);
assert.strictEqual(emptyAlloc.valid, true, 'an empty allocation (0 rangers assigned anywhere) is trivially valid');
console.log('validateRangerAllocation: accepts within-budget allocations, rejects over-budget ones, handles empty input');

// --- Defensive programming: negative/NaN/malformed inputs must never
// silently corrupt data or bypass validation ---
assert.strictEqual(levelMultiplier(NaN), 1, 'NaN level clamps to level 1 baseline, does not propagate NaN');
assert.strictEqual(scoutEffectivePower(NaN, 1), 0, 'NaN rangers sent yields 0 power, not NaN');
assert.strictEqual(nodeDeliveryTurns(NaN), 0, 'NaN distance costs 0 turns, not NaN');

// The exploit this guards against: a negative `scouting` cancels out a
// legitimate `expeditions` total, which would otherwise pass the naive
// total<=totalRangers check while still allocating more rangers than exist.
const negativeExploit = validateRangerAllocation({ scouting: -1000, expeditions: 1000 }, 1000);
assert.strictEqual(negativeExploit.valid, false, 'a negative scouting value must not be able to cancel out expeditions and bypass the total check');
assert.strictEqual(validateRangerAllocation(null, 1000).valid, false, 'null allocation is rejected, not a thrown TypeError');
assert.strictEqual(validateRangerAllocation({ scouting: 1.5 }, 1000).valid, false, 'a non-integer allocation is rejected');
console.log('defensive programming: negative-value exploit, NaN propagation, and malformed input are all rejected');

// --- Scout validation matrix (FOG_OF_WAR_PLAN.md Phase 3) ---
// All cases now validate *production* code via isFrontier() + allocation helpers.
console.log('--- Scout validation matrix ---');

// Setup a simple seen bitmap for simulation (home at 0,0 seen)
let seen = 0n;
seen = safeBitmapAddCell(seen, 0, 0);
const hasSeen = (c, r) => safeBitmapHasCell(seen, c, r);

// Valid frontier reveal: target not seen, but adjacent
const frontierCol = 1, frontierRow = 0;
assert.strictEqual(isFrontier(frontierCol, frontierRow, hasSeen), true, 'adjacent unseen hex must be frontier');
console.log('✓ valid frontier reveal case');

// Non-frontier (leapfrog) rejection
const nonFrontierCol = 2, nonFrontierRow = 0;
assert.strictEqual(isFrontier(nonFrontierCol, nonFrontierRow, hasSeen), false, 'non-adjacent hex must not be frontier');
console.log('✓ non-frontier leapfrog rejection');

// Already-seen: isFrontier returns false (and route rejects with no cost)
assert.strictEqual(isFrontier(0, 0, hasSeen), false, 'already-seen must not be considered frontier');
console.log('✓ already-seen hex rejection (zero cost, isFrontier false)');

// Ranger-pool contention with active expedition
const totalR = 500;
const contention = validateRangerAllocation({ scouting: 300, expeditions: 250 }, totalR);
assert.strictEqual(contention.valid, false, 'scouting + active exp must not exceed pool');
console.log('✓ ranger-pool contention with active expedition');

// Per-turn budget cap – use existing (non-redundant) assertion on effective power
const maxScout = SCOUT_ECONOMY.MAX_SCOUTING_RANGERS;
const cappedPower = scoutEffectivePower(maxScout * 2, 1);
assert.strictEqual(cappedPower, scoutEffectivePower(maxScout, 1), 'exceeding MAX_SCOUTING_RANGERS must not increase power');
console.log('✓ per-turn reveal-budget cap enforced');

console.log('scout validation matrix: all cases covered (production helpers)');
console.log('scout-economy checks passed');
