'use strict';
// Characterization tests for game/engineers.js.
// Locks XP thresholds, construction multiplier, build time/cost scaling.
//
// Run: node test/engineers.test.js

const assert = require('assert');
const engineers = require('../game/engineers');

console.log('Testing engineers.js\n');

// Test 1: engineerXpForLevel returns 0 at level 1
{
  assert.equal(engineers.engineerXpForLevel(1), 0, 'level 1 needs 0 XP');
  console.log('Test 1: engineerXpForLevel(1) = 0 ✓');
}

// Test 2: engineerXpForLevel increases monotonically
{
  const levels = [2, 5, 10, 11, 25, 26, 50, 51, 75, 76, 100];
  for (let i = 0; i < levels.length - 1; i++) {
    const a = engineers.engineerXpForLevel(levels[i]);
    const b = engineers.engineerXpForLevel(levels[i + 1]);
    assert.ok(b > a, `L${levels[i+1]} (${b}) > L${levels[i]} (${a})`);
  }
  console.log('Test 2: engineerXpForLevel increases monotonically ✓');
}

// Test 3: engineerXpForLevel tier thresholds
{
  const xp5 = engineers.engineerXpForLevel(5);
  const xp10 = engineers.engineerXpForLevel(10);
  const xp25 = engineers.engineerXpForLevel(25);
  assert.equal(xp5, 500, 'level 5 = 5*100 = 500');
  assert.equal(xp10, 1000, 'level 10 = 10*100 = 1000');
  assert.equal(xp25, 7500, 'level 25 = 25*300 = 7500');
  console.log('Test 3: engineerXpForLevel tier thresholds ✓');
}

// Test 4: engineerConstructionMult at level 1 is 1.0
{
  const mult = engineers.engineerConstructionMult(1);
  assert.equal(mult, 1.0, 'level 1 mult = 1.0');
  console.log(`Test 4: engineerConstructionMult(1) = 1.0 ✓`);
}

// Test 5: engineerConstructionMult increases with level
{
  const m1 = engineers.engineerConstructionMult(1);
  const m50 = engineers.engineerConstructionMult(50);
  const m100 = engineers.engineerConstructionMult(100);
  assert.ok(m50 > m1, 'level 50 > level 1');
  assert.ok(m100 > m50, 'level 100 > level 50');
  console.log(`Test 5: engineerConstructionMult scales ✓ (L1=${m1}, L50=${m50.toFixed(3)}, L100=${m100.toFixed(3)})`);
}

// Test 6: engineerConstructionMult caps at 1.25 for level 100
{
  const m100 = engineers.engineerConstructionMult(100);
  const m200 = engineers.engineerConstructionMult(200);
  assert.equal(m100, m200, 'capped at level 100');
  assert.ok(Math.abs(m100 - 1.25) < 0.001, `cap should be ~1.25, got ${m100}`);
  console.log(`Test 6: engineerConstructionMult cap at 1.25 ✓ (${m100.toFixed(4)})`);
}

// Test 7: calculateBuildTime returns 0 for unknown tier
{
  const kingdom = { race: 'human', engineer_level: 1 };
  const time = engineers.calculateBuildTime(kingdom, 'unknown_tier');
  assert.equal(time, 0, 'unknown tier = 0 time');
  console.log('Test 7: calculateBuildTime unknown tier ✓');
}

// Test 8: calculateBuildTime decreases with higher engineer level
{
  const config = require('../game/config');
  const tiers = Object.keys(config.BUILDING_TIER_TIMES);
  if (tiers.length > 0) {
    const tier = tiers[0];
    const k1 = { race: 'human', engineer_level: 1 };
    const k100 = { race: 'human', engineer_level: 100 };
    const t1 = engineers.calculateBuildTime(k1, tier);
    const t100 = engineers.calculateBuildTime(k100, tier);
    assert.ok(t100 <= t1, `higher level should reduce build time (L1=${t1}, L100=${t100})`);
    console.log(`Test 8: calculateBuildTime scales with engineer level ✓ (L1=${t1}, L100=${t100})`);
  } else {
    console.log('Test 8: calculateBuildTime SKIPPED (no tiers in config)');
  }
}

// Test 9: calculateBuildCost returns object with land/wood/stone/iron
{
  const k = { race: 'human', engineer_level: 1 };
  const cost = engineers.calculateBuildCost(k, 'anything');
  assert.ok('land' in cost, 'has land');
  assert.ok('wood' in cost, 'has wood');
  assert.ok('stone' in cost, 'has stone');
  assert.ok('iron' in cost, 'has iron');
  console.log('Test 9: calculateBuildCost returns shape ✓');
}

// Test 10: awardEngineerXp accumulates XP
{
  const k = { race: 'human', engineer_level: 1, engineer_xp: 0 };
  engineers.awardEngineerXp(k, 50);
  assert.equal(k.engineer_xp, 50, 'XP accumulated');
  console.log('Test 10: awardEngineerXp accumulates XP ✓');
}

// Test 11: awardEngineerXp levels up when threshold reached
{
  const xpForL2 = engineers.engineerXpForLevel(2);
  const k = { race: 'human', engineer_level: 1, engineer_xp: 0 };
  engineers.awardEngineerXp(k, xpForL2 + 50);
  assert.ok(k.engineer_level >= 2, 'should level up');
  console.log(`Test 11: awardEngineerXp levels up ✓ (level=${k.engineer_level})`);
}

// Test 12: awardEngineerXp caps at level 100
{
  const k = { race: 'human', engineer_level: 100, engineer_xp: 0 };
  engineers.awardEngineerXp(k, 9999999);
  assert.equal(k.engineer_level, 100, 'capped at level 100');
  console.log('Test 12: awardEngineerXp caps at level 100 ✓');
}

// Test 13: all exports are functions
{
  const fns = ['engineerXpForLevel', 'engineerConstructionMult', 'calculateBuildTime', 'calculateBuildCost', 'awardEngineerXp'];
  for (const name of fns) {
    assert.equal(typeof engineers[name], 'function', `${name} is exported`);
  }
  console.log('Test 13: all exports are functions ✓');
}

console.log('\nAll engineers tests passed.');
