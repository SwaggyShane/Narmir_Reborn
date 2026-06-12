'use strict';
// Characterization tests for game/xp.js.
// Locks XP curve, level-from-XP binary search, milestone dispatch, and awardXp.
//
// Run: node test/xp.test.js

const assert = require('assert');
const xp = require('../game/xp');

function makeKingdom(overrides = {}) {
  return {
    race: 'human',
    level: 1,
    xp: 0,
    prestige_level: 0,
    milestones_claimed: null,
    milestone_bonuses: null,
    xp_sources: null,
    gold: 1000,
    land: 100,
    fighters: 0,
    researchers: 0,
    thieves: 0,
    ninjas: 0,
    ...overrides,
  };
}

console.log('Testing xp.js\n');

// Test 1: xpForLevel returns 0 for level < 1
{
  assert.equal(xp.xpForLevel(0), 0, 'level 0 = 0 XP');
  assert.equal(xp.xpForLevel(-5), 0, 'negative level = 0 XP');
  console.log('Test 1: xpForLevel(<=0) = 0 ✓');
}

// Test 2: xpForLevel increases with level
{
  const xp1 = xp.xpForLevel(1);
  const xp10 = xp.xpForLevel(10);
  const xp100 = xp.xpForLevel(100);
  assert.ok(xp10 > xp1, 'L10 > L1');
  assert.ok(xp100 > xp10, 'L100 > L10');
  console.log(`Test 2: xpForLevel increases ✓ (L1=${xp1}, L10=${xp10}, L100=${xp100})`);
}

// Test 3: xpForLevel prestige multiplier increases required XP
{
  const base = xp.xpForLevel(10, 0);
  const p1 = xp.xpForLevel(10, 1);
  const p5 = xp.xpForLevel(10, 5);
  assert.ok(p1 > base, 'prestige 1 > base');
  assert.ok(p5 > p1, 'prestige 5 > prestige 1');
  console.log(`Test 3: xpForLevel prestige scaling ✓ (p0=${base}, p1=${p1}, p5=${p5})`);
}

// Test 4: xpForLevel caps at level 500
{
  const xp500 = xp.xpForLevel(500);
  const xp501 = xp.xpForLevel(501);
  assert.equal(xp500, xp501, 'level 501+ treated as 500');
  console.log(`Test 4: xpForLevel cap at 500 ✓ (L500=${xp500})`);
}

// Test 5: xpToNextLevel returns positive value
{
  const needed = xp.xpToNextLevel(1);
  assert.ok(needed > 0, 'XP to level 2 should be positive');
  console.log(`Test 5: xpToNextLevel(1) = ${needed} ✓`);
}

// Test 6: levelFromXp at 0 XP = level 1
{
  const level = xp.levelFromXp(0);
  assert.equal(level, 1, 'no XP = level 1');
  console.log('Test 6: levelFromXp(0) = 1 ✓');
}

// Test 7: levelFromXp round-trips with xpForLevel
{
  for (const lv of [5, 25, 100, 200]) {
    const totalXp = xp.xpForLevel(lv);
    const computed = xp.levelFromXp(totalXp);
    assert.equal(computed, lv, `levelFromXp(xpForLevel(${lv})) = ${lv}`);
  }
  console.log('Test 7: levelFromXp round-trips ✓');
}

// Test 8: checkMilestones returns empty when no milestones passed
{
  const k = makeKingdom({ level: 2 });
  const result = xp.checkMilestones(k, 1, 2);
  assert.deepEqual(result.events, [], 'no events for non-milestone level');
  assert.deepEqual(result.updates, {}, 'no updates');
  console.log('Test 8: checkMilestones no-op ✓');
}

// Test 9: checkMilestones triggers at level 25
{
  const config = require('../game/config');
  if (config.MILESTONES && config.MILESTONES[25]) {
    const k = makeKingdom({ level: 24, race: 'human' });
    const result = xp.checkMilestones(k, 24, 25);
    assert.ok(result.events.length > 0, 'milestone event generated');
    assert.ok(result.updates.milestones_claimed, 'milestones_claimed updated');
    console.log(`Test 9: checkMilestones L25 ✓ (${result.events[0].message.substring(0, 50)})`);
  } else {
    console.log('Test 9: checkMilestones L25 SKIPPED (no L25 milestone in config)');
  }
}

// Test 10: checkMilestones respects already-claimed milestones
{
  const config = require('../game/config');
  if (config.MILESTONES && config.MILESTONES[25]) {
    const k = makeKingdom({
      level: 1,
      milestones_claimed: JSON.stringify({ 25: true }),
    });
    const result = xp.checkMilestones(k, 1, 25);
    assert.deepEqual(result.events, [], 'already claimed = no new events');
    console.log('Test 10: checkMilestones respects claimed ✓');
  } else {
    console.log('Test 10: SKIPPED (no L25 milestone in config)');
  }
}

// Test 11: xpRaceBonus returns >= 1.0
{
  const k = makeKingdom({ race: 'human' });
  const bonus = xp.xpRaceBonus(k, 'combat_win');
  assert.ok(bonus >= 1.0, `race bonus should be >= 1.0, got ${bonus}`);
  console.log(`Test 11: xpRaceBonus(human) >= 1.0 ✓ (${bonus})`);
}

// Test 12: awardXp returns expected shape
{
  const k = makeKingdom();
  const result = xp.awardXp(k, 'turn', 1);
  assert.ok('xp' in result, 'has xp');
  assert.ok('level' in result, 'has level');
  assert.ok('earned' in result, 'has earned');
  assert.ok('levelled' in result, 'has levelled');
  assert.ok('events' in result, 'has events');
  assert.ok('xp_sources' in result, 'has xp_sources');
  console.log('Test 12: awardXp returns shape ✓');
}

// Test 13: awardXp accumulates XP
{
  const k = makeKingdom({ xp: 0 });
  const result = xp.awardXp(k, 'turn', 1);
  assert.ok(result.xp > 0, 'XP should increase');
  console.log(`Test 13: awardXp accumulates XP ✓ (earned=${result.earned})`);
}

// Test 14: awardXp tracks xp_sources
{
  const k = makeKingdom({ xp_sources: null });
  const result = xp.awardXp(k, 'combat_win', 1);
  assert.ok('combat_win' in result.xp_sources, 'tracks combat_win source');
  console.log('Test 14: awardXp tracks xp_sources ✓');
}

// Test 15: awardXp caps at level 500
{
  const k = makeKingdom({ level: 500, xp: 999999999 });
  const result = xp.awardXp(k, 'turn', 1);
  assert.equal(result.level, 500, 'level capped at 500');
  assert.equal(result.levelled, false, 'no level-up at cap');
  console.log('Test 15: awardXp level cap ✓');
}

// Test 16: all exports are functions
{
  const fns = ['xpForLevel', 'xpToNextLevel', 'checkMilestones', 'levelFromXp', 'xpRaceBonus', 'awardXp'];
  for (const name of fns) {
    assert.equal(typeof xp[name], 'function', `${name} is exported`);
  }
  console.log('Test 16: all exports are functions ✓');
}

console.log('\nAll XP tests passed.');
