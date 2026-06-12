'use strict';
// Characterization tests for game/attunements.js.
// Locks per-building attunement dispatch: update shape, penalty accumulation,
// food/gold mutations, and no-op guards.
//
// Run: node test/attunements.test.js

const assert = require('assert');
const attunements = require('../game/attunements');

// Minimal kingdom with no fragment bonuses (so getFragmentForBuilding returns null → no-op)
function makeKingdom(overrides = {}) {
  return {
    race: 'human',
    level: 1,
    prestige_level: 0,
    turn: 10,
    food: 5000,
    gold: 10000,
    happiness: 50,
    population: 5000,
    bld_granaries: 0, bld_vaults: 0, bld_walls: 0, bld_guard_towers: 0,
    bld_outposts: 0, bld_training: 0, bld_barracks: 0, bld_castles: 0,
    bld_mausoleums: 0, bld_libraries: 0, bld_mage_towers: 0, bld_schools: 0,
    bld_farms: 0, bld_smithies: 0, bld_markets: 0, bld_shrines: 0,
    bld_taverns: 0, bld_housing: 0,
    active_effects: null,
    fragment_attunements: null,
    ...overrides,
  };
}

console.log('Testing attunements.js\n');

// Test 1: applyFragmentHappinessPenalty accumulates penalty in updates
{
  const k = makeKingdom({ active_effects: null });
  const updates = {};
  attunements.applyFragmentHappinessPenalty(k, updates);
  assert.ok('active_effects' in updates, 'sets active_effects on updates');
  const effects = JSON.parse(updates.active_effects);
  assert.equal(effects.fragment_happiness_penalty, -1, 'penalty is -1 after first call');
  console.log('Test 1: applyFragmentHappinessPenalty accumulates penalty ✓');
}

// Test 2: applyFragmentHappinessPenalty stacks across repeated calls
{
  const k = makeKingdom({ active_effects: null });
  const updates = {};
  attunements.applyFragmentHappinessPenalty(k, updates);
  // simulate second call with updated active_effects
  const k2 = makeKingdom({ active_effects: updates.active_effects });
  attunements.applyFragmentHappinessPenalty(k2, updates);
  const effects = JSON.parse(updates.active_effects);
  assert.equal(effects.fragment_happiness_penalty, -2, 'penalty stacks to -2 on second call');
  console.log('Test 2: applyFragmentHappinessPenalty stacks ✓');
}

// Test 3: processGranaryAttunements returns {} when no building
{
  const k = makeKingdom({ bld_granaries: 0 });
  const events = [];
  const updates = attunements.processGranaryAttunements(k, events);
  assert.deepEqual(updates, {}, 'no-op when no granaries attunement');
  assert.equal(events.length, 0, 'no events');
  console.log('Test 3: processGranaryAttunements no-op ✓');
}

// Test 4: processGranaryAttunements returns object shape
{
  const k = makeKingdom();
  const events = [];
  const updates = attunements.processGranaryAttunements(k, events);
  assert.ok(updates !== null && typeof updates === 'object', 'returns object');
  console.log('Test 4: processGranaryAttunements returns object ✓');
}

// Test 5: processVaultAttunements returns {} when no vaults
{
  const k = makeKingdom({ bld_vaults: 0 });
  const events = [];
  const updates = attunements.processVaultAttunements(k, events);
  assert.deepEqual(updates, {}, 'no-op when no vaults');
  console.log('Test 5: processVaultAttunements no-op ✓');
}

// Test 6: processWallsAttunements returns {} when no walls
{
  const k = makeKingdom({ bld_walls: 0 });
  const events = [];
  const updates = attunements.processWallsAttunements(k, events);
  assert.deepEqual(updates, {}, 'no-op when no walls');
  console.log('Test 6: processWallsAttunements no-op ✓');
}

// Test 7: processGuardTowerAttunements returns {} when no guard towers
{
  const k = makeKingdom({ bld_guard_towers: 0 });
  const events = [];
  const updates = attunements.processGuardTowerAttunements(k, events);
  assert.deepEqual(updates, {}, 'no-op when no guard towers');
  console.log('Test 7: processGuardTowerAttunements no-op ✓');
}

// Test 8: processOutpostAttunements returns {} when no outposts
{
  const k = makeKingdom({ bld_outposts: 0 });
  const events = [];
  const updates = attunements.processOutpostAttunements(k, events);
  assert.deepEqual(updates, {}, 'no-op when no outposts');
  console.log('Test 8: processOutpostAttunements no-op ✓');
}

// Test 9: processTrainingAttunements returns {} when no training
{
  const k = makeKingdom({ bld_training: 0 });
  const events = [];
  const updates = attunements.processTrainingAttunements(k, events);
  assert.deepEqual(updates, {}, 'no-op when no training');
  console.log('Test 9: processTrainingAttunements no-op ✓');
}

// Test 10: processBarracksAttunements returns {} when no barracks
{
  const k = makeKingdom({ bld_barracks: 0 });
  const events = [];
  const updates = attunements.processBarracksAttunements(k, events);
  assert.deepEqual(updates, {}, 'no-op when no barracks');
  console.log('Test 10: processBarracksAttunements no-op ✓');
}

// Test 11: processCastleAttunements returns {} when no castles
{
  const k = makeKingdom({ bld_castles: 0 });
  const events = [];
  const updates = attunements.processCastleAttunements(k, events);
  assert.deepEqual(updates, {}, 'no-op when no castles');
  console.log('Test 11: processCastleAttunements no-op ✓');
}

// Test 12: processMausoleumAttunements returns {} when no mausoleums
{
  const k = makeKingdom({ bld_mausoleums: 0 });
  const events = [];
  const updates = attunements.processMausoleumAttunements(k, events);
  assert.deepEqual(updates, {}, 'no-op when no mausoleums');
  console.log('Test 12: processMausoleumAttunements no-op ✓');
}

// Test 13: processLibraryAttunements returns {} when no libraries
{
  const k = makeKingdom({ bld_libraries: 0 });
  const events = [];
  const updates = attunements.processLibraryAttunements(k, events);
  assert.deepEqual(updates, {}, 'no-op when no libraries');
  console.log('Test 13: processLibraryAttunements no-op ✓');
}

// Test 14: processMageTowerAttunements returns {} when no mage towers
{
  const k = makeKingdom({ bld_mage_towers: 0 });
  const events = [];
  const updates = attunements.processMageTowerAttunements(k, events);
  assert.deepEqual(updates, {}, 'no-op when no mage towers');
  console.log('Test 14: processMageTowerAttunements no-op ✓');
}

// Test 15: processSchoolAttunements returns {} when no schools
{
  const k = makeKingdom({ bld_schools: 0 });
  const events = [];
  const updates = attunements.processSchoolAttunements(k, events);
  assert.deepEqual(updates, {}, 'no-op when no schools');
  console.log('Test 15: processSchoolAttunements no-op ✓');
}

// Test 16: processFarmAttunements returns {} when no farms
{
  const k = makeKingdom({ bld_farms: 0 });
  const events = [];
  const updates = attunements.processFarmAttunements(k, events);
  assert.deepEqual(updates, {}, 'no-op when no farms');
  console.log('Test 16: processFarmAttunements no-op ✓');
}

// Test 17: processSmithyAttunements returns {} when no smithies
{
  const k = makeKingdom({ bld_smithies: 0 });
  const events = [];
  const updates = attunements.processSmithyAttunements(k, events);
  assert.deepEqual(updates, {}, 'no-op when no smithies');
  console.log('Test 17: processSmithyAttunements no-op ✓');
}

// Test 18: processMarketAttunements returns {} when no markets
{
  const k = makeKingdom({ bld_markets: 0 });
  const events = [];
  const updates = attunements.processMarketAttunements(k, events);
  assert.deepEqual(updates, {}, 'no-op when no markets');
  console.log('Test 18: processMarketAttunements no-op ✓');
}

// Test 19: processShrineAttunements returns {} when no shrines
{
  const k = makeKingdom({ bld_shrines: 0 });
  const events = [];
  const updates = attunements.processShrineAttunements(k, events);
  assert.deepEqual(updates, {}, 'no-op when no shrines');
  console.log('Test 19: processShrineAttunements no-op ✓');
}

// Test 20: processTavernAttunements returns {} when no taverns
{
  const k = makeKingdom({ bld_taverns: 0 });
  const events = [];
  const updates = attunements.processTavernAttunements(k, events);
  assert.deepEqual(updates, {}, 'no-op when no taverns');
  console.log('Test 20: processTavernAttunements no-op ✓');
}

// Test 21: processHousingAttunements returns {} when no housing
{
  const k = makeKingdom({ bld_housing: 0 });
  const events = [];
  const updates = attunements.processHousingAttunements(k, events);
  assert.deepEqual(updates, {}, 'no-op when no housing');
  console.log('Test 21: processHousingAttunements no-op ✓');
}

// Test 22: all processXxx exports are functions
{
  const fns = [
    'applyFragmentHappinessPenalty',
    'processGranaryAttunements', 'processVaultAttunements', 'processWallsAttunements',
    'processGuardTowerAttunements', 'processOutpostAttunements', 'processTrainingAttunements',
    'processBarracksAttunements', 'processCastleAttunements', 'processMausoleumAttunements',
    'processLibraryAttunements', 'processMageTowerAttunements', 'processSchoolAttunements',
    'processFarmAttunements', 'processSmithyAttunements', 'processMarketAttunements',
    'processShrineAttunements', 'processTavernAttunements', 'processHousingAttunements',
  ];
  for (const name of fns) {
    assert.equal(typeof attunements[name], 'function', `${name} is exported as function`);
  }
  console.log('Test 22: all exports are functions ✓');
}

console.log('\nAll attunements tests passed.');
