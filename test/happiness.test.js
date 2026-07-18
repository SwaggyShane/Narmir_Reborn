'use strict';
// Characterization tests for game/happiness.js.
// Locks happiness calculation (target + capped-rise momentum), happiness multipliers,
// and rebellion triggers.
//
// Run: node test/happiness.test.js

const assert = require('assert');
const happiness = require('../game/happiness');

function makeKingdom(overrides = {}) {
  return {
    race: 'human',
    tax: 42,
    land: 1000,
    prestige_level: 0,
    turn: 10,
    mana: 0,
    res_economy: 100,
    res_entertainment: 100,
    res_war_machines: 100,
    food: 5000,
    food_surplus_turns: 0,
    food_shortage_turns: 0,
    happiness: 100,
    population: 5000,
    gold: 10000,
    fighters: 0, rangers: 0, clerics: 0, mages: 0, thieves: 0, ninjas: 0,
    researchers: 0, engineers: 0, scribes: 0, thralls: 0,
    bld_castles: 0, bld_taverns: 0, bld_markets: 0, bld_farms: 0,
    bld_granaries: 0, bld_mage_towers: 0, bld_walls: 0, bld_guard_towers: 0,
    bld_outposts: 0, bld_housing: 0, bld_mausoleums: 0, bld_schools: 0,
    bld_libraries: 0, bld_shrines: 0, bld_smithies: 0, bld_vaults: 0,
    bld_training: 0, bld_barracks: 0,
    active_effects: null,
    alliance_buffs: null,
    fragment_bonuses: null,
    milestone_bonuses: null,
    last_attack_turn: null,
    rebellion_cooldown: 0,
    ...overrides,
  };
}

// Runs calculateHappiness turn-over-turn, feeding each turn's output happiness
// back in as next turn's k.happiness, simulating sustained conditions.
function simulateTurns(kingdomOverrides, turns) {
  let k = makeKingdom(kingdomOverrides);
  let result;
  for (let i = 0; i < turns; i++) {
    result = happiness.calculateHappiness(k);
    k = { ...k, happiness: result.happiness, turn: k.turn + 1 };
  }
  return result;
}

console.log('Testing happiness.js\n');

// Test 1: calculateHappiness returns expected shape
{
  const k = makeKingdom();
  const result = happiness.calculateHappiness(k);
  assert.ok(result && typeof result === 'object', 'result is object');
  assert.ok('happiness' in result, 'has happiness field');
  assert.ok('components' in result, 'has components field');
  assert.ok('target' in result, 'has target field');
  assert.ok('recovery' in result, 'has recovery field (rise cap)');
  assert.ok(Number.isFinite(result.happiness), 'happiness is finite number');
  console.log(`Test 1: calculateHappiness returns shape ✓ (happiness=${result.happiness})`);
}

// Test 2: calculateHappiness — sustained high food/gold/taverns converges above 50
{
  const k = { food: 50000, gold: 100000, population: 5000, bld_taverns: 5, happiness: 50 };
  const result = simulateTurns(k, 60);
  assert.ok(result.happiness > 50, `sustained happy conditions should converge above 50, got ${result.happiness}`);
  console.log(`Test 2: calculateHappiness converges to high happiness ✓ (happiness=${result.happiness})`);
}

// Test 3: calculateHappiness — no food/gold + recent attack drops happiness below 50
// (falling is immediate, so this shows up in a single turn from a neutral start)
{
  const k = makeKingdom({ food: 0, gold: 0, population: 5000, last_attack_turn: 9, turn: 10, happiness: 50 });
  const result = happiness.calculateHappiness(k);
  assert.ok(result.happiness < 50, `kingdom with no food/gold and recent attack should have happiness < 50, got ${result.happiness}`);
  console.log(`Test 3: calculateHappiness low happiness ✓ (happiness=${result.happiness})`);
}

// Test 4: calculateHappiness — recent attack lowers the happiness target.
// Compares .target (unaffected by rise-cap momentum) since two targets that are
// both far above the same starting happiness would otherwise saturate at the same
// capped .happiness value on a single turn.
{
  const noAttack = happiness.calculateHappiness(makeKingdom({ last_attack_turn: null }));
  const recentAttack = happiness.calculateHappiness(makeKingdom({ last_attack_turn: 9, turn: 10 }));
  assert.ok(noAttack.target > recentAttack.target,
    `no attack should have higher target than recent attack (${noAttack.target} vs ${recentAttack.target})`);
  console.log(`Test 4: calculateHappiness safety component ✓ (no_attack=${noAttack.target}, recent=${recentAttack.target})`);
}

// Test 5: calculateHappiness — high tax hurts the target, low tax helps it
{
  const base = { food: 1000, gold: 1000, population: 5000, last_attack_turn: 9, turn: 10 };
  const norm = happiness.calculateHappiness(makeKingdom({ ...base, tax: 42 }));
  const highTax = happiness.calculateHappiness(makeKingdom({ ...base, tax: 90 }));
  const lowTax = happiness.calculateHappiness(makeKingdom({ ...base, tax: 10 }));
  assert.ok(norm.target > highTax.target, 'high tax should hurt the target');
  assert.ok(lowTax.target > norm.target, 'low tax should boost the target');
  console.log(`Test 5: calculateHappiness tax effect ✓ (high=${highTax.target}, norm=${norm.target}, low=${lowTax.target})`);
}

// Test 6: calculateHappiness — tax 0% is valid (not coerced to 42%)
{
  const base = { food: 1000, gold: 1000, population: 5000, last_attack_turn: 9, turn: 10 };
  const zero = happiness.calculateHappiness(makeKingdom({ ...base, tax: 0 }));
  const norm = happiness.calculateHappiness(makeKingdom({ ...base, tax: 42 }));
  assert.ok(zero.target > norm.target, `0% tax should give higher target than 42%, got ${zero.target} vs ${norm.target}`);
  console.log(`Test 6: calculateHappiness 0% tax valid ✓ (zero=${zero.target}, norm=${norm.target})`);
}

// Test 7: getHappinessRiseCap returns value in [1, 15]
{
  const k = makeKingdom({ res_entertainment: 100, bld_taverns: 0 });
  const cap = happiness.getHappinessRiseCap(k);
  assert.ok(cap >= 1 && cap <= 15, `rise cap should be in [1, 15], got ${cap}`);
  console.log(`Test 7: getHappinessRiseCap ✓ (cap=${cap})`);
}

// Test 8: getHappinessRiseCap scales with entertainment + taverns
{
  const lo = happiness.getHappinessRiseCap(makeKingdom({ res_entertainment: 0, bld_taverns: 0, tax: 90 }));
  const hi = happiness.getHappinessRiseCap(makeKingdom({ res_entertainment: 2000, bld_taverns: 10, tax: 10 }));
  assert.ok(hi > lo, `higher entertainment/taverns/low tax should give higher rise cap (${lo} vs ${hi})`);
  console.log(`Test 8: getHappinessRiseCap scales ✓ (lo=${lo}, hi=${hi})`);
}

// Test 9: happinessMult ranges correct
{
  const lo = happiness.happinessMult(0);
  const mid = happiness.happinessMult(100);
  const hi = happiness.happinessMult(200);
  assert.ok(lo < mid, 'low happiness gives lower mult than mid');
  assert.ok(hi >= mid, 'very high happiness gives equal or higher mult');
  assert.ok(hi <= 1.2, 'happiness mult capped at 1.2');
  assert.ok(lo >= 0.8, 'happiness mult floored near 0.8');
  console.log(`Test 9: happinessMult ranges ✓ (lo=${lo}, mid=${mid}, hi=${hi})`);
}

// Test 10: happinessCombatMult clamps to [0.5, 1.5]
{
  const lo = happiness.happinessCombatMult(-100);
  const mid = happiness.happinessCombatMult(60);
  const hi = happiness.happinessCombatMult(200);
  assert.ok(lo >= 0.5, `combat mult should be >= 0.5, got ${lo}`);
  assert.ok(hi <= 1.5, `combat mult should be <= 1.5, got ${hi}`);
  assert.ok(mid > lo && mid < hi, 'mid happiness should give mid mult');
  console.log(`Test 10: happinessCombatMult clamps ✓ (lo=${lo}, mid=${mid}, hi=${hi})`);
}

// Test 11: rebellionCheck — no rebellion when happiness >= 50
{
  const k = makeKingdom({ happiness: 80, turn: 10, rebellion_cooldown: 0 });
  const updates = {};
  const events = [];
  for (let i = 0; i < 100; i++) {
    happiness.rebellionCheck(k, 80, updates, events);
  }
  assert.equal(events.length, 0, 'no rebellion events when happiness >= 50');
  console.log('Test 11: rebellionCheck no rebellion at high happiness ✓');
}

// Test 12: rebellionCheck — rebellion can trigger at very low happiness
{
  const k = makeKingdom({ happiness: 0, turn: 10, rebellion_cooldown: 0, population: 5000 });
  let triggered = false;
  for (let i = 0; i < 200; i++) {
    const u = {};
    const e = [];
    happiness.rebellionCheck(k, 0, u, e);
    if (e.length > 0) { triggered = true; break; }
  }
  assert.ok(triggered, 'rebellion should eventually trigger at 0 happiness with 5% chance');
  console.log('Test 12: rebellionCheck triggers at 0 happiness ✓');
}

// Test 13: rebellionCheck — respects cooldown
{
  const k = makeKingdom({ happiness: 0, turn: 5, rebellion_cooldown: 20 }); // cooldown > turn
  const updates = {};
  const events = [];
  for (let i = 0; i < 100; i++) {
    happiness.rebellionCheck(k, 0, updates, events);
  }
  assert.equal(events.length, 0, 'no rebellion during cooldown');
  console.log('Test 13: rebellionCheck respects cooldown ✓');
}

// Test 14: malformed JSON inputs don't throw
{
  const k = makeKingdom({ active_effects: '{bad json', fragment_bonuses: '{bad json' });
  // Should not throw
  happiness.calculateHappiness(k);
  console.log('Test 14: malformed JSON inputs handled ✓');
}

// Test 15: falling is immediate — one bad turn from a high starting happiness drops
// straight to (or toward) the target, not gradually.
{
  const crashTarget = happiness.calculateHappiness(
    makeKingdom({ tax: 100, food: 0, gold: 0, last_attack_turn: 9, turn: 10, happiness: 100 })
  );
  assert.ok(crashTarget.happiness <= crashTarget.target + 1, 'falling should land at (or essentially at) the target in one turn');
  assert.ok(crashTarget.happiness < 50, `one turn of max tax + no food/gold should already crash happiness below 50, got ${crashTarget.happiness}`);
  console.log(`Test 15: falling is immediate ✓ (happiness=${crashTarget.happiness}, target=${crashTarget.target})`);
}

// Test 16: rising is capped — one great turn after a crash does NOT fully restore
// happiness; it can only climb by the rise cap.
{
  const crashed = makeKingdom({ tax: 42, food: 50000, gold: 100000, bld_taverns: 5, happiness: 0 });
  const oneGoodTurn = happiness.calculateHappiness(crashed);
  assert.ok(oneGoodTurn.happiness < oneGoodTurn.target,
    `one turn should not fully reach a much higher target (happiness=${oneGoodTurn.happiness}, target=${oneGoodTurn.target})`);
  assert.ok(oneGoodTurn.happiness <= 0 + 15, `single-turn rise should never exceed the max rise cap of 15, got ${oneGoodTurn.happiness}`);
  console.log(`Test 16: rising is capped ✓ (happiness=${oneGoodTurn.happiness}, target=${oneGoodTurn.target})`);
}

// Test 17: recovery from a crash takes multiple turns for a modestly-invested kingdom
{
  const modest = { tax: 42, food: 10000, gold: 20000, population: 5000, bld_taverns: 4, res_entertainment: 150, happiness: 0 };
  let k = makeKingdom(modest);
  let turnsToRecover = 0;
  let result;
  for (let i = 0; i < 100; i++) {
    result = happiness.calculateHappiness(k);
    k = { ...k, happiness: result.happiness, turn: k.turn + 1 };
    turnsToRecover++;
    if (result.happiness >= 80) break;
  }
  assert.ok(result.happiness >= 80, `modest investment should eventually recover to 80+, got ${result.happiness} after ${turnsToRecover} turns`);
  assert.ok(turnsToRecover >= 8, `recovery should take a meaningful number of turns, not snap back instantly (took ${turnsToRecover})`);
  console.log(`Test 17: gradual recovery ✓ (${turnsToRecover} turns to reach ${result.happiness})`);
}

console.log('\nAll happiness tests passed.');
