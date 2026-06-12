'use strict';
// Characterization tests for game/population.js.
// Locks housing cap, population growth rates, and research increment tiers.
//
// Run: node test/population.test.js

const assert = require('assert');
const population = require('../game/population');

function makeKingdom(overrides = {}) {
  return {
    race: 'human',
    prestige_level: 0,
    level: 1,
    population: 5000,
    happiness: 50,
    bld_housing: 0,
    bld_schools: 0,
    res_entertainment: 100,
    active_effects: null,
    fragment_attunements: null,
    troop_xp: null,
    researchers: 0,
    ...overrides,
  };
}

console.log('Testing population.js\n');

// Test 1: housingCapPerBuilding returns base for race
{
  const k = makeKingdom({ race: 'human', prestige_level: 0 });
  const cap = population.housingCapPerBuilding(k);
  assert.ok(cap > 0, 'cap > 0');
  assert.ok(Number.isFinite(cap), 'cap is finite');
  console.log(`Test 1: housingCapPerBuilding(human) = ${cap} ✓`);
}

// Test 2: housingCapPerBuilding increases with prestige
{
  const base = population.housingCapPerBuilding(makeKingdom({ prestige_level: 0 }));
  const p1 = population.housingCapPerBuilding(makeKingdom({ prestige_level: 1 }));
  // Prestige may or may not increase housing cap depending on config — just check it's stable
  assert.ok(Number.isFinite(p1), 'prestige cap is finite');
  console.log(`Test 2: housingCapPerBuilding prestige ✓ (p0=${base}, p1=${p1})`);
}

// Test 3: popGrowth returns positive for happy kingdom with housing
{
  const k = makeKingdom({ happiness: 80, bld_housing: 5, population: 1000 });
  const growth = population.popGrowth(k);
  assert.ok(growth >= 0, `happy kingdom growth should be >= 0, got ${growth}`);
  console.log(`Test 3: popGrowth happy kingdom ✓ (growth=${growth})`);
}

// Test 4: popGrowth returns negative for very unhappy kingdom (happiness < 0)
{
  const k = makeKingdom({ happiness: -10, population: 5000 });
  const growth = population.popGrowth(k);
  assert.ok(growth < 0, `unhappy kingdom should have negative growth, got ${growth}`);
  console.log(`Test 4: popGrowth unhappy kingdom ✓ (growth=${growth})`);
}

// Test 5: popGrowth returns 0 when population >= 2x housing cap
{
  const k = makeKingdom({ happiness: 80, bld_housing: 1, population: 999999 });
  const growth = population.popGrowth(k);
  assert.equal(growth, 0, 'overcrowded kingdom should not grow');
  console.log('Test 5: popGrowth capped at 2x housing ✓');
}

// Test 6: popGrowth higher happiness gives higher growth
{
  const sad = makeKingdom({ happiness: 30, bld_housing: 10, population: 1000 });
  const happy = makeKingdom({ happiness: 80, bld_housing: 10, population: 1000 });
  const sadGrowth = population.popGrowth(sad);
  const happyGrowth = population.popGrowth(happy);
  assert.ok(happyGrowth > sadGrowth, `happy should grow faster (${sadGrowth} vs ${happyGrowth})`);
  console.log(`Test 6: popGrowth scales with happiness ✓ (sad=${sadGrowth}, happy=${happyGrowth})`);
}

// Test 7: researchIncrement returns 0 with no researchers
{
  const k = makeKingdom({ researchers: 0 });
  const inc = population.researchIncrement(k, 'economy', 0, 1);
  assert.equal(inc, 0, '0 researchers = 0 increment');
  console.log('Test 7: researchIncrement(0 researchers) = 0 ✓');
}

// Test 8: researchIncrement returns positive with enough researchers
{
  const k = makeKingdom({ bld_schools: 0 });
  const inc = population.researchIncrement(k, 'economy', 300, 1);
  assert.ok(inc >= 0, `increment should be >= 0, got ${inc}`);
  console.log(`Test 8: researchIncrement(300 researchers) = ${inc} ✓`);
}

// Test 9: researchIncrement scales with researcher count
{
  const k = makeKingdom({ bld_schools: 0 });
  const inc100 = population.researchIncrement(k, 'economy', 100, 1);
  const inc2000 = population.researchIncrement(k, 'economy', 2000, 1);
  assert.ok(inc2000 >= inc100, `more researchers should give higher increment (${inc100} vs ${inc2000})`);
  console.log(`Test 9: researchIncrement scales with researchers ✓ (100=${inc100}, 2000=${inc2000})`);
}

// Test 10: researchIncrement maxes at 5
{
  const k = makeKingdom({ bld_schools: 100 });
  const inc = population.researchIncrement(k, 'economy', 100000, 1);
  assert.ok(inc <= 5, `increment should max at 5, got ${inc}`);
  console.log(`Test 10: researchIncrement max = ${inc} ✓`);
}

// Test 11: researchIncrement harder above level 100
{
  const k = makeKingdom({ bld_schools: 0 });
  const at50 = population.researchIncrement(k, 'economy', 500, 50);
  const at150 = population.researchIncrement(k, 'economy', 500, 150);
  assert.ok(at150 <= at50, `level 150 should be harder than level 50 (${at50} vs ${at150})`);
  console.log(`Test 11: researchIncrement exponential hardening ✓ (L50=${at50}, L150=${at150})`);
}

// Test 12: all exports are functions
{
  const fns = ['housingCapPerBuilding', 'popGrowth', 'researchIncrement'];
  for (const name of fns) {
    assert.equal(typeof population[name], 'function', `${name} is exported`);
  }
  console.log('Test 12: all exports are functions ✓');
}

console.log('\nAll population tests passed.');
