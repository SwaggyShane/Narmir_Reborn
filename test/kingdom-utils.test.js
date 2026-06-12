'use strict';
// Characterization tests for game/kingdom-utils.js.
// Locks calculateScore, demolishBuilding, and resolveAllianceDefense behavior.
//
// Run: node test/kingdom-utils.test.js

const assert = require('assert');
const { resolveAllianceDefense, demolishBuilding, calculateScore } = require('../game/kingdom-utils');

function makeKingdom(overrides = {}) {
  return {
    race: 'human',
    level: 1,
    land: 100,
    population: 5000,
    gold: 10000,
    food: 5000,
    mana: 1000,
    fighters: 0,
    rangers: 0,
    clerics: 0,
    mages: 0,
    thieves: 0,
    ninjas: 0,
    scribes: 0,
    engineers: 0,
    researchers: 0,
    war_machines: 0,
    ballistae: 0,
    hammers_stored: 0,
    scaffolding_stored: 0,
    blueprints_stored: 0,
    weapons_stockpile: 0,
    armor_stockpile: 0,
    troop_levels: null,
    bld_farms: 0,
    bld_barracks: 0,
    bld_outposts: 0,
    bld_guard_towers: 0,
    bld_schools: 0,
    bld_armories: 0,
    bld_vaults: 0,
    bld_smithies: 0,
    bld_markets: 0,
    bld_mage_towers: 0,
    bld_shrines: 0,
    bld_training: 0,
    bld_castles: 0,
    bld_housing: 0,
    bld_libraries: 0,
    bld_taverns: 0,
    bld_walls: 0,
    ...overrides,
  };
}

console.log('Testing kingdom-utils.js\n');

// ── calculateScore ──────────────────────────────────────────────────────────

// Test 1: calculateScore returns a positive number for a basic kingdom
{
  const k = makeKingdom({ land: 100, population: 5000, level: 1 });
  const score = calculateScore(k);
  assert.ok(typeof score === 'number', 'score is a number');
  assert.ok(score > 0, 'score > 0');
  assert.ok(Number.isInteger(score), 'score is integer');
  console.log(`Test 1: calculateScore basic ✓ (score=${score})`);
}

// Test 2: more land = higher score
{
  const low = calculateScore(makeKingdom({ land: 100 }));
  const high = calculateScore(makeKingdom({ land: 1000 }));
  assert.ok(high > low, 'more land = higher score');
  console.log(`Test 2: land contributes to score ✓ (100=${low}, 1000=${high})`);
}

// Test 3: higher level = higher score
{
  const low = calculateScore(makeKingdom({ level: 1 }));
  const high = calculateScore(makeKingdom({ level: 50 }));
  assert.ok(high > low, 'higher level = higher score');
  console.log(`Test 3: level contributes to score ✓ (L1=${low}, L50=${high})`);
}

// Test 4: more buildings = higher score
{
  const noBld = calculateScore(makeKingdom({ bld_farms: 0 }));
  const hasBld = calculateScore(makeKingdom({ bld_farms: 10, bld_barracks: 5 }));
  assert.ok(hasBld > noBld, 'buildings contribute to score');
  console.log(`Test 4: buildings contribute to score ✓ (no=${noBld}, has=${hasBld})`);
}

// Test 5: more troops = higher score
{
  const noTroops = calculateScore(makeKingdom({ fighters: 0 }));
  const hasTroops = calculateScore(makeKingdom({ fighters: 1000, mages: 100 }));
  assert.ok(hasTroops > noTroops, 'troops contribute to score');
  console.log(`Test 5: troops contribute to score ✓`);
}

// Test 6: calculateScore handles null troop_levels gracefully
{
  const k = makeKingdom({ troop_levels: null, fighters: 500 });
  assert.doesNotThrow(() => calculateScore(k), 'null troop_levels is safe');
  console.log('Test 6: null troop_levels handled ✓');
}

// Test 7: calculateScore handles JSON troop_levels
{
  const k = makeKingdom({
    troop_levels: JSON.stringify({ fighters: { level: 5 } }),
    fighters: 500,
  });
  const score = calculateScore(k);
  assert.ok(score > 0, 'score with troop levels > 0');
  console.log(`Test 7: JSON troop_levels handled ✓ (score=${score})`);
}

// ── demolishBuilding ────────────────────────────────────────────────────────

// Test 8: demolishBuilding returns error for unknown building
{
  const k = makeKingdom({ bld_farms: 10, gold: 5000, land: 200 });
  const result = demolishBuilding(k, 'nonexistent_building', 1);
  assert.ok(result.error, 'unknown building returns error');
  console.log(`Test 8: demolishBuilding unknown building ✓ (error=${result.error})`);
}

// Test 9: demolishBuilding returns error when count is 0
{
  const k = makeKingdom({ bld_farms: 0, gold: 5000, land: 200 });
  const result = demolishBuilding(k, 'farms', 5);
  assert.ok(result.error, 'nothing to demolish returns error');
  console.log(`Test 9: demolishBuilding nothing to demolish ✓`);
}

// Test 10: demolishBuilding reduces building count
{
  const k = makeKingdom({ bld_farms: 10, gold: 5000, land: 200 });
  const result = demolishBuilding(k, 'farms', 3);
  assert.ok(result.updates, 'has updates');
  assert.equal(result.updates.bld_farms, 7, 'farms reduced by 3');
  console.log('Test 10: demolishBuilding reduces count ✓');
}

// Test 11: demolishBuilding gives gold refund
{
  const k = makeKingdom({ bld_farms: 10, gold: 5000, land: 200 });
  const result = demolishBuilding(k, 'farms', 1);
  assert.ok(result.updates.gold >= 5000, 'gold refund applied');
  assert.ok(result.refund.gold >= 0, 'refund.gold >= 0');
  console.log(`Test 11: demolishBuilding gold refund ✓ (refund=${result.refund.gold})`);
}

// Test 12: demolishBuilding gives land refund
{
  const k = makeKingdom({ bld_farms: 10, gold: 5000, land: 200 });
  const result = demolishBuilding(k, 'farms', 2);
  assert.ok(result.updates.land >= 200, 'land refund applied');
  assert.ok(result.refund.land >= 0, 'refund.land >= 0');
  console.log(`Test 12: demolishBuilding land refund ✓ (refund=${result.refund.land})`);
}

// Test 13: demolishBuilding cannot demolish more than available
{
  const k = makeKingdom({ bld_farms: 3, gold: 5000, land: 200 });
  const result = demolishBuilding(k, 'farms', 99);
  if (!result.error) {
    assert.equal(result.refund.count, 3, 'capped at available count');
    assert.equal(result.updates.bld_farms, 0, 'all 3 demolished');
  }
  console.log('Test 13: demolishBuilding capped at available ✓');
}

// ── resolveAllianceDefense ──────────────────────────────────────────────────

// Test 14: resolveAllianceDefense returns empty when attack was lost
{
  const attackResult = { win: false };
  const allies = [{ id: 1, fighters: 1000, pledge: 50 }];
  const result = resolveAllianceDefense(attackResult, allies);
  assert.deepEqual(result, [], 'no defense pledges on attacker loss');
  console.log('Test 14: resolveAllianceDefense no-op on loss ✓');
}

// Test 15: resolveAllianceDefense returns pledged fighters on attacker win
{
  const attackResult = { win: true };
  const allies = [{ id: 1, fighters: 1000, pledge: 50 }];
  const result = resolveAllianceDefense(attackResult, allies);
  assert.equal(result.length, 1, '1 ally response');
  assert.equal(result[0].allyId, 1, 'correct ally ID');
  assert.equal(result[0].sent, 500, '50% of 1000 fighters = 500 sent');
  console.log('Test 15: resolveAllianceDefense pledged fighters ✓');
}

// Test 16: resolveAllianceDefense handles multiple allies
{
  const attackResult = { win: true };
  const allies = [
    { id: 1, fighters: 1000, pledge: 25 },
    { id: 2, fighters: 500, pledge: 100 },
  ];
  const result = resolveAllianceDefense(attackResult, allies);
  assert.equal(result.length, 2, '2 ally responses');
  assert.equal(result[0].sent, 250, 'ally1: 25% of 1000 = 250');
  assert.equal(result[1].sent, 500, 'ally2: 100% of 500 = 500');
  console.log('Test 16: resolveAllianceDefense multiple allies ✓');
}

// Test 17: resolveAllianceDefense returns empty for empty ally list
{
  const result = resolveAllianceDefense({ win: true }, []);
  assert.deepEqual(result, [], 'empty allies = empty result');
  console.log('Test 17: resolveAllianceDefense empty allies ✓');
}

// Test 18: all exports are functions
{
  const mod = require('../game/kingdom-utils');
  for (const name of ['resolveAllianceDefense', 'demolishBuilding', 'calculateScore']) {
    assert.equal(typeof mod[name], 'function', `${name} is exported`);
  }
  console.log('Test 18: all exports are functions ✓');
}

console.log('\nAll kingdom-utils tests passed.');
