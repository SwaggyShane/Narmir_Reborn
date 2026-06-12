'use strict';
// Characterization tests for game/prestige.js.
// Locks canPrestige eligibility check and processPrestige reset behavior.
//
// Run: node test/prestige.test.js

const assert = require('assert');
const { canPrestige, processPrestige } = require('../game/prestige');

function makeKingdom(overrides = {}) {
  return {
    level: 1,
    prestige_level: 0,
    land: 500,
    gold: 100000,
    turn: 42,
    ...overrides,
  };
}

console.log('Testing prestige.js\n');

// Test 1: canPrestige returns false below level 50
{
  const k = makeKingdom({ level: 49 });
  assert.equal(canPrestige(k), false, 'level 49 cannot prestige');
  console.log('Test 1: canPrestige(level=49) = false ✓');
}

// Test 2: canPrestige returns true at level 50
{
  const k = makeKingdom({ level: 50 });
  assert.equal(canPrestige(k), true, 'level 50 can prestige');
  console.log('Test 2: canPrestige(level=50) = true ✓');
}

// Test 3: canPrestige returns true above level 50
{
  const k = makeKingdom({ level: 100 });
  assert.equal(canPrestige(k), true, 'level 100 can prestige');
  console.log('Test 3: canPrestige(level=100) = true ✓');
}

// Test 4: processPrestige returns error when level < 50
{
  const k = makeKingdom({ level: 49 });
  const result = processPrestige(k);
  assert.ok(result.error, 'should return error for ineligible kingdom');
  assert.ok(!result.updates, 'no updates on error');
  console.log(`Test 4: processPrestige ineligible ✓ (error=${result.error})`);
}

// Test 5: processPrestige increments prestige_level
{
  const k = makeKingdom({ level: 50, prestige_level: 0 });
  const result = processPrestige(k);
  assert.equal(result.updates.prestige_level, 1, 'prestige_level increments to 1');
  console.log('Test 5: processPrestige increments prestige_level ✓');
}

// Test 6: processPrestige resets level to 1
{
  const k = makeKingdom({ level: 75, prestige_level: 2 });
  const result = processPrestige(k);
  assert.equal(result.updates.level, 1, 'level resets to 1');
  assert.equal(result.updates.xp, 0, 'xp resets to 0');
  console.log('Test 6: processPrestige resets level and XP ✓');
}

// Test 7: processPrestige starting gold scales with prestige level
{
  const p1 = processPrestige(makeKingdom({ level: 50, prestige_level: 0 }));
  const p2 = processPrestige(makeKingdom({ level: 50, prestige_level: 1 }));
  assert.ok(p2.updates.gold > p1.updates.gold, 'prestige 2 gets more starting gold');
  console.log(`Test 7: gold scales with prestige ✓ (p1=${p1.updates.gold}, p2=${p2.updates.gold})`);
}

// Test 8: processPrestige preserves land
{
  const k = makeKingdom({ level: 50, land: 1234 });
  const result = processPrestige(k);
  assert.equal(result.updates.land, 1234, 'land is preserved after prestige');
  console.log('Test 8: processPrestige preserves land ✓');
}

// Test 9: processPrestige resets troop counts to 0
{
  const k = makeKingdom({ level: 50, prestige_level: 0 });
  const result = processPrestige(k);
  assert.equal(result.updates.fighters, 0, 'fighters reset');
  assert.equal(result.updates.rangers, 0, 'rangers reset');
  assert.equal(result.updates.mages, 0, 'mages reset');
  console.log('Test 9: processPrestige resets troops ✓');
}

// Test 10: processPrestige resets buildings to starter values
{
  const k = makeKingdom({ level: 50, prestige_level: 0 });
  const result = processPrestige(k);
  assert.equal(result.updates.bld_farms, 5, 'farms reset to 5');
  assert.equal(result.updates.bld_housing, 100, 'housing reset to 100');
  assert.equal(result.updates.bld_schools, 1, 'schools reset to 1');
  console.log('Test 10: processPrestige resets buildings ✓');
}

// Test 11: processPrestige resets queues to empty JSON objects
{
  const k = makeKingdom({ level: 50, prestige_level: 0 });
  const result = processPrestige(k);
  assert.equal(result.updates.build_queue, '{}', 'build_queue reset');
  assert.equal(result.updates.research_progress, '{}', 'research_progress reset');
  console.log('Test 11: processPrestige resets queues ✓');
}

// Test 12: all exports are functions
{
  const fns = ['canPrestige', 'processPrestige'];
  const mod = require('../game/prestige');
  for (const name of fns) {
    assert.equal(typeof mod[name], 'function', `${name} is exported`);
  }
  console.log('Test 12: all exports are functions ✓');
}

console.log('\nAll prestige tests passed.');
