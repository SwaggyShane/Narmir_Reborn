'use strict';
// Characterization tests for game/happiness.js.
// Locks happiness calculation, morale multipliers, and rebellion triggers.
//
// Run: node test/happiness.test.js

const assert = require('assert');
const happiness = require('../game/happiness');

function makeKingdom(overrides = {}) {
  return {
    race: 'human',
    tax: 42,
    land: 1000,
    happiness: 50,
    prestige_level: 0,
    turn: 10,
    mana: 0,
    res_economy: 100,
    res_entertainment: 100,
    res_war_machines: 100,
    food: 5000,
    food_surplus_turns: 0,
    food_shortage_turns: 0,
    morale: 100,
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

console.log('Testing happiness.js\n');

// Test 1: calculateHappiness returns expected shape
{
  const k = makeKingdom();
  const result = happiness.calculateHappiness(k);
  assert.ok(result && typeof result === 'object', 'result is object');
  assert.ok('happiness' in result, 'has happiness field');
  assert.ok('components' in result, 'has components field');
  assert.ok('recovery' in result, 'has recovery field');
  assert.ok(Number.isFinite(result.happiness), 'happiness is finite number');
  console.log(`Test 1: calculateHappiness returns shape ✓ (happiness=${result.happiness})`);
}

// Test 2: calculateHappiness — high happiness with plentiful food + gold
{
  const k = makeKingdom({ food: 50000, gold: 100000, population: 5000, bld_taverns: 5 });
  const result = happiness.calculateHappiness(k);
  assert.ok(result.happiness > 50, `happy kingdom should have happiness > 50, got ${result.happiness}`);
  console.log(`Test 2: calculateHappiness high happiness ✓ (happiness=${result.happiness})`);
}

// Test 3: calculateHappiness — low happiness with no food + no gold + recent attack
{
  const k = makeKingdom({ food: 0, gold: 0, population: 5000, last_attack_turn: 9, turn: 10 });
  const result = happiness.calculateHappiness(k);
  assert.ok(result.happiness < 50, `kingdom with no food/gold and recent attack should have happiness < 50, got ${result.happiness}`);
  console.log(`Test 3: calculateHappiness low happiness ✓ (happiness=${result.happiness})`);
}

// Test 4: calculateHappiness — recent attack lowers safety happiness
{
  const noAttack = happiness.calculateHappiness(makeKingdom({ last_attack_turn: null }));
  const recentAttack = happiness.calculateHappiness(makeKingdom({ last_attack_turn: 9, turn: 10 }));
  assert.ok(noAttack.happiness > recentAttack.happiness,
    `no attack should have higher happiness than recent attack (${noAttack.happiness} vs ${recentAttack.happiness})`);
  console.log(`Test 4: calculateHappiness safety component ✓ (no_attack=${noAttack.happiness}, recent=${recentAttack.happiness})`);
}

// Test 5: calculateHappiness — high tax hurts happiness, low tax helps
// Use a sad base kingdom so we're not capped at 120
{
  const base = { food: 1000, gold: 1000, population: 5000, last_attack_turn: 9, turn: 10 };
  const norm = happiness.calculateHappiness(makeKingdom({ ...base, tax: 42 }));
  const highTax = happiness.calculateHappiness(makeKingdom({ ...base, tax: 90 }));
  const lowTax = happiness.calculateHappiness(makeKingdom({ ...base, tax: 10 }));
  assert.ok(norm.happiness > highTax.happiness, 'high tax should hurt happiness');
  assert.ok(lowTax.happiness > norm.happiness, 'low tax should boost happiness');
  console.log(`Test 5: calculateHappiness tax effect ✓ (high=${highTax.happiness}, norm=${norm.happiness}, low=${lowTax.happiness})`);
}

// Test 6: calculateHappiness — tax 0% is valid (not coerced to 42%)
// Use a depressed base kingdom so we're not capped at 120
{
  const base = { food: 1000, gold: 1000, population: 5000, last_attack_turn: 9, turn: 10 };
  const zero = happiness.calculateHappiness(makeKingdom({ ...base, tax: 0 }));
  const norm = happiness.calculateHappiness(makeKingdom({ ...base, tax: 42 }));
  assert.ok(zero.happiness > norm.happiness, `0% tax should give higher happiness than 42%, got ${zero.happiness} vs ${norm.happiness}`);
  console.log(`Test 6: calculateHappiness 0% tax valid ✓ (zero=${zero.happiness}, norm=${norm.happiness})`);
}

// Test 7: getHappinessRecoveryRate returns value in [0.5, 5]
{
  const k = makeKingdom({ res_entertainment: 100, bld_taverns: 0 });
  const rate = happiness.getHappinessRecoveryRate(k);
  assert.ok(rate >= 0.5 && rate <= 5, `recovery rate should be in [0.5, 5], got ${rate}`);
  console.log(`Test 7: getHappinessRecoveryRate ✓ (rate=${rate})`);
}

// Test 8: getHappinessRecoveryRate scales with entertainment + taverns
{
  const lo = happiness.getHappinessRecoveryRate(makeKingdom({ res_entertainment: 0, bld_taverns: 0 }));
  const hi = happiness.getHappinessRecoveryRate(makeKingdom({ res_entertainment: 2000, bld_taverns: 10 }));
  assert.ok(hi > lo, `higher entertainment/taverns should give higher recovery (${lo} vs ${hi})`);
  console.log(`Test 8: getHappinessRecoveryRate scales ✓ (lo=${lo}, hi=${hi})`);
}

// Test 9: moraleMult ranges correct
{
  const lo = happiness.moraleMult(0);
  const mid = happiness.moraleMult(100);
  const hi = happiness.moraleMult(200);
  assert.ok(lo < mid, 'low morale gives lower mult than mid');
  assert.ok(hi >= mid, 'very high morale gives equal or higher mult');
  assert.ok(hi <= 1.2, 'morale mult capped at 1.2');
  assert.ok(lo >= 0.8, 'morale mult floored near 0.8');
  console.log(`Test 9: moraleMult ranges ✓ (lo=${lo}, mid=${mid}, hi=${hi})`);
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

console.log('\nAll happiness tests passed.');
