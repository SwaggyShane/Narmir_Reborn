'use strict';
// Characterization tests for game/lib/troops.js.
// Locks XP tables, level math, race-bonus multipliers, and the JSON-encoded
// troop_levels round-tripping that downstream callers rely on.
//
// Run: node test/lib-troops.test.js

const assert = require('assert');
const {
  troopXpForLevel,
  effectiveTroopLevel,
  awardTroopXp,
  unitLevelMult,
  racialUnitBonus,
  diluteTroopXp,
  awardUnitXp,
  getAvailableUnits,
  getUnitName,
  LEGENDARY_NAMES,
} = require('../game/lib/troops');

console.log('Testing troops.js\n');

// Test 1: troopXpForLevel has the documented step ladder
assert.equal(troopXpForLevel(1), 0);
assert.equal(troopXpForLevel(2), 200);     // ×100 band
assert.equal(troopXpForLevel(10), 1000);   // ×100 band
assert.equal(troopXpForLevel(11), 3300);   // ×300 band
assert.equal(troopXpForLevel(25), 7500);
assert.equal(troopXpForLevel(26), 20800);  // ×800 band
assert.equal(troopXpForLevel(50), 40000);
assert.equal(troopXpForLevel(51), 102000); // ×2000 band
assert.equal(troopXpForLevel(75), 150000);
assert.equal(troopXpForLevel(76), 380000); // ×5000 band
console.log('Test 1: XP table boundaries ✓');

// Test 2: effectiveTroopLevel without troop_levels JSON returns 1
{
  const k = { race: 'human', troop_levels: null };
  assert.equal(effectiveTroopLevel(k, 'fighters'), 1);
  console.log('Test 2: missing troop_levels → level 1 ✓');
}

// Test 3: effectiveTroopLevel respects stored level + race bonus
{
  const k = {
    race: 'human',
    troop_levels: JSON.stringify({ fighters: { level: 10, xp: 0, count: 100 } }),
  };
  const lvl = effectiveTroopLevel(k, 'fighters');
  assert.ok(lvl >= 1 && lvl <= 100);
  console.log(`Test 3: level 10 human fighter → effective ${lvl} ✓`);
}

// Test 4: awardTroopXp returns valid JSON string + levelUps array
{
  const k = {
    race: 'human',
    troop_levels: JSON.stringify({ fighters: { level: 1, xp: 0, count: 50 } }),
  };
  const result = awardTroopXp(k, 'fighters', 250);
  assert.ok(typeof result.troop_levels === 'string');
  assert.ok(Array.isArray(result.levelUps));
  // 250 XP > troopXpForLevel(2) = 200, so should level up
  assert.equal(result.levelUps.length, 1);
  const parsed = JSON.parse(result.troop_levels);
  assert.equal(parsed.fighters.level, 2);
  console.log('Test 4: awardTroopXp levels up at threshold ✓');
}

// Test 5: awardTroopXp respects level cap of 100
{
  const k = {
    race: 'human',
    troop_levels: JSON.stringify({ fighters: { level: 100, xp: 0, count: 50 } }),
  };
  const result = awardTroopXp(k, 'fighters', 1000000);
  assert.equal(result.levelUps.length, 0);
  console.log('Test 5: level 100 cap respected ✓');
}

// Test 5b: awardTroopXp must compare against the *span* to the next level,
// not the absolute cumulative threshold — regression for a bug where a
// mid-level unit's stored (relative) xp was compared against
// troopXpForLevel(level+1) (absolute), so units above level 1 could almost
// never level up regardless of how much XP they earned. Also verifies a
// single large grant cascades through multiple levels (mirrors
// diluteTroopXp's while-loop, not a single if-check).
{
  const k = {
    race: 'human',
    troop_levels: JSON.stringify({ mages: { level: 29, xp: 500, count: 50 } }),
  };
  // troopXpForLevel(29)=23200, troopXpForLevel(30)=24000 -> span is 800.
  // 500 + 2000 = 2500 clears that span comfortably and should level up,
  // even though 2500 is nowhere near the absolute threshold of 24000.
  const result = awardTroopXp(k, 'mages', 2000);
  const parsed = JSON.parse(result.troop_levels);
  assert.ok(parsed.mages.level > 29, `expected level up past 29, got ${parsed.mages.level}`);
  console.log('Test 5b: awardTroopXp levels a mid-level unit past a relative threshold ✓');
}

// Test 5c: a single oversized grant at level 1 cascades through several
// levels in one call instead of banking the remainder as stuck in-level xp.
{
  const k = { race: 'dwarf', troop_levels: JSON.stringify({}) };
  const result = awardTroopXp(k, 'engineers', 17250); // Lodge-boosted lava-draw grant
  const parsed = JSON.parse(result.troop_levels);
  assert.ok(parsed.engineers.level > 2, `expected multi-level cascade, got level ${parsed.engineers.level}`);
  assert.equal(result.levelUps.length, parsed.engineers.level - 1);
  console.log(`Test 5c: single large grant cascades to level ${parsed.engineers.level} ✓`);
}

// Test 6: unitLevelMult baseline at level 1 = 1.0; prestige rank does NOT stack
// (combat mult only via applyPrestigeCombatMultiplier).
// rangers is non-legendary for humans — isolates the rank effect.
{
  const k = { race: 'human', prestige_level: 0, troop_levels: null };
  assert.equal(unitLevelMult(k, 'rangers'), 1.0);
  const kPrestige = { ...k, prestige_level: 1 };
  assert.equal(unitLevelMult(kPrestige, 'rangers'), 1.0);
  const kP5 = { ...k, prestige_level: 5 };
  assert.equal(unitLevelMult(kP5, 'rangers'), 1.0);
  console.log('Test 6: unitLevelMult baseline; no prestige rank scaling ✓');
}

// Test 7: Legendary multiplier applies at prestige > 0 for race-specific units
{
  const k = {
    race: 'human',
    prestige_level: 1,
    troop_levels: JSON.stringify({ fighters: { level: 1, xp: 0, count: 50 } }),
  };
  // Human + fighters is legendary at prestige > 0: base 1.0 * 1.15
  const m = unitLevelMult(k, 'fighters');
  assert.ok(Math.abs(m - 1.15) < 1e-6, `expected ~1.15, got ${m}`);
  const mP5 = unitLevelMult({ ...k, prestige_level: 5 }, 'fighters');
  assert.ok(Math.abs(mP5 - 1.15) < 1e-6, `legendary must not scale with rank, got ${mP5}`);
  console.log('Test 7: legendary multiplier (+15% identity only) ✓');
}

// Test 8: racialUnitBonus gates on level 25
{
  const lowLevel = {
    race: 'orc',
    troop_levels: JSON.stringify({ fighters: { level: 5, xp: 0, count: 100 } }),
    fighters: 100,
  };
  assert.deepEqual(racialUnitBonus(lowLevel, 'fighters'), {});

  const highLevel = {
    race: 'orc',
    troop_levels: JSON.stringify({ fighters: { level: 25, xp: 0, count: 100 } }),
    fighters: 100,
  };
  const bonus = racialUnitBonus(highLevel, 'fighters');
  assert.equal(bonus.freeTrainees, 10);
  console.log('Test 8: racial bonus unlocks at level 25 ✓');
}

// Test 9: diluteTroopXp lowers average when hiring more
{
  const k = {
    race: 'human',
    troop_levels: JSON.stringify({ fighters: { level: 5, xp: 100, count: 100 } }),
    fighters: 100,
  };
  const result = diluteTroopXp(k, 'fighters', 100);
  const parsed = JSON.parse(result);
  // count should be 200 after hiring 100
  assert.equal(parsed.fighters.count, 200);
  // level should be ≤ 5 after dilution
  assert.ok(parsed.fighters.level <= 5);
  console.log('Test 9: diluteTroopXp lowers level/XP ✓');
}

// Test 10: getAvailableUnits subtracts training allocation
{
  const k = {
    fighters: 100,
    training_allocation: JSON.stringify({ fighters: 30 }),
  };
  assert.equal(getAvailableUnits(k, 'fighters'), 70);

  const noAlloc = { fighters: 100 };
  assert.equal(getAvailableUnits(noAlloc, 'fighters'), 100);

  const overTrain = {
    fighters: 50,
    training_allocation: JSON.stringify({ fighters: 200 }),
  };
  // never goes negative
  assert.equal(getAvailableUnits(overTrain, 'fighters'), 0);
  console.log('Test 10: getAvailableUnits respects training allocation ✓');
}

// Test 11: getUnitName + LEGENDARY_NAMES registry contract
{
  assert.equal(getUnitName('human', 'fighters'), 'Fighters');
  assert.ok(getUnitName('human', 'fighters', 1).includes('Lionheart'));
  assert.equal(getUnitName('vampire', 'clerics'), 'Thralls');
  assert.equal(getUnitName('vampire', 'thieves'), 'Infiltrators');
  assert.ok(LEGENDARY_NAMES.dwarf.engineers);
  console.log('Test 11: getUnitName + legendary registry ✓');
}

// Test 12: awardUnitXp returns parsed object, not JSON string
{
  const k = {
    race: 'human',
    fighters: 50,
    troop_levels: JSON.stringify({ fighters: { level: 1, xp: 0, count: 50 } }),
  };
  const result = awardUnitXp(k, 'fighters', 250);
  assert.ok(result && typeof result === 'object');
  assert.ok(typeof result !== 'string');
  // result is the parsed troop_levels object, fighters key present
  assert.ok(result.fighters);
  console.log('Test 12: awardUnitXp returns parsed object ✓');
}

// Test 13: awardUnitXp returns null when no units present
{
  const k = { race: 'human', fighters: 0 };
  assert.equal(awardUnitXp(k, 'fighters', 100), null);
  console.log('Test 13: awardUnitXp null when no units ✓');
}

console.log('\nAll troops tests passed.');
