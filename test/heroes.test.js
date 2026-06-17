'use strict';
// Characterization tests for game/heroes.js.
// Locks hero XP progression, power calculation, turn bonuses, and recruitment.
//
// Run: node test/heroes.test.js

const assert = require('assert');
const heroes = require('../game/heroes');

function makeKingdom(overrides = {}) {
  return {
    race: 'human',
    gold: 50000,
    mana: 50000,
    food: 10000,
    population: 5000,
    happiness: 100,
    bld_castles: 1,
    res_stealth: 0,
    prestige: 0,
    ...overrides,
  };
}

function makeHero(overrides = {}) {
  return {
    name: 'Test Hero',
    class: 'paladin',
    level: 1,
    xp: 0,
    hp: 200,
    max_hp: 200,
    status: 'idle',
    ...overrides,
  };
}

console.log('Testing heroes.js\n');

// Test 1: heroXpForLevel returns 0 for level 1
{
  const xp = heroes.heroXpForLevel(1);
  assert.equal(xp, 0, 'level 1 requires 0 XP');
  console.log('Test 1: heroXpForLevel(1) = 0 ✓');
}

// Test 2: heroXpForLevel increases with level
{
  const xp1 = heroes.heroXpForLevel(1);
  const xp2 = heroes.heroXpForLevel(2);
  const xp10 = heroes.heroXpForLevel(10);
  assert.ok(xp2 > xp1, 'level 2 > level 1');
  assert.ok(xp10 > xp2, 'level 10 > level 2');
  console.log(`Test 2: XP increases with level ✓ (L1=0, L2=${xp2}, L10=${xp10})`);
}

// Test 3: awardHeroXp returns object with level and xp
{
  const hero = makeHero({ level: 1, xp: 0 });
  const result = heroes.awardHeroXp(hero, 1000);
  assert.ok('level' in result, 'has level');
  assert.ok('xp' in result, 'has xp');
  assert.equal(result.xp, 1000, 'xp is accumulated');
  console.log('Test 3: awardHeroXp returns shape ✓');
}

// Test 4: awardHeroXp levels up when XP threshold reached
{
  const hero = makeHero({ level: 1, xp: 0 });
  const xpForLevel2 = heroes.heroXpForLevel(2);
  const result = heroes.awardHeroXp(hero, xpForLevel2 + 1000);
  assert.ok(result.level > 1, 'hero levels up');
  console.log(`Test 4: awardHeroXp levels hero ✓ (new level=${result.level})`);
}

// Test 5: awardHeroXp caps at level 25
{
  const hero = makeHero({ level: 25, xp: 0 });
  const result = heroes.awardHeroXp(hero, 999999999);
  assert.equal(result.level, 25, 'level capped at 25');
  console.log('Test 5: awardHeroXp caps at level 25 ✓');
}

// Test 6: getHeroPower returns higher power for higher levels
{
  const hero1 = makeHero({ class: 'paladin', level: 1 });
  const hero10 = makeHero({ class: 'paladin', level: 10 });
  const power1 = heroes.getHeroPower(hero1);
  const power10 = heroes.getHeroPower(hero10);
  assert.ok(power10 > power1, 'higher level = higher power');
  console.log(`Test 6: getHeroPower scales with level ✓ (L1=${power1}, L10=${power10})`);
}

// Test 7: getHeroPower applies class multipliers
{
  const paladin = makeHero({ class: 'paladin', level: 1 });
  const warlord = makeHero({ class: 'warlord', level: 1 });
  const powerPaladin = heroes.getHeroPower(paladin);
  const powerWarlord = heroes.getHeroPower(warlord);
  assert.ok(powerWarlord > powerPaladin, 'warlord > paladin power');
  console.log(`Test 7: getHeroPower applies class bonuses ✓ (paladin=${powerPaladin}, warlord=${powerWarlord})`);
}

// Test 8: applyHeroTurnBonuses grand_chancellor adds gold
{
  const k = makeKingdom({ gold: 1000 });
  const hero = makeHero({ class: 'grand_chancellor', level: 5 });
  const updates = {};
  const events = [];
  heroes.applyHeroTurnBonuses(hero, k, updates, events);
  assert.ok(updates.gold > 1000, 'grand_chancellor adds gold');
  assert.ok(events.length > 0, 'generates event');
  console.log(`Test 8: applyHeroTurnBonuses grand_chancellor ✓ (gold bonus=${updates.gold - 1000})`);
}

// Test 9: applyHeroTurnBonuses archmage adds mana
{
  const k = makeKingdom({ mana: 1000 });
  const hero = makeHero({ class: 'archmage', level: 5 });
  const updates = {};
  const events = [];
  heroes.applyHeroTurnBonuses(hero, k, updates, events);
  assert.ok(updates.mana > 1000, 'archmage adds mana');
  console.log(`Test 9: applyHeroTurnBonuses archmage ✓ (mana bonus=${updates.mana - 1000})`);
}

// Test 10: applyHeroTurnBonuses alpha adds food and happiness
{
  const k = makeKingdom({ food: 1000, happiness: 50 });
  const hero = makeHero({ class: 'alpha', level: 5 });
  const updates = {};
  const events = [];
  heroes.applyHeroTurnBonuses(hero, k, updates, events);
  assert.ok(updates.food > 1000, 'alpha adds food');
  assert.ok(updates.happiness > 50, 'alpha adds happiness');
  console.log(`Test 10: applyHeroTurnBonuses alpha ✓ (food+${updates.food - 1000}, happiness+${updates.happiness - 50})`);
}

// Test 11: applyHeroTurnBonuses paladin adds happiness
{
  const k = makeKingdom({ happiness: 50 });
  const hero = makeHero({ class: 'paladin', level: 5 });
  const updates = {};
  const events = [];
  heroes.applyHeroTurnBonuses(hero, k, updates, events);
  assert.ok(updates.happiness > 50, 'paladin adds happiness');
  console.log(`Test 11: applyHeroTurnBonuses paladin ✓ (happiness+${updates.happiness - 50})`);
}

// Test 12: applyHeroTurnBonuses blood_shaman consumes population for mana
{
  const k = makeKingdom({ population: 5000, mana: 1000 });
  const hero = makeHero({ class: 'blood_shaman', level: 5 });
  const updates = {};
  const events = [];
  heroes.applyHeroTurnBonuses(hero, k, updates, events);
  assert.ok(updates.population < 5000, 'blood_shaman consumes population');
  assert.ok(updates.mana > 1000, 'blood_shaman generates mana');
  console.log(`Test 12: applyHeroTurnBonuses blood_shaman ✓ (pop-${5000 - updates.population}, mana+${updates.mana - 1000})`);
}

// Test 13: applyHeroTurnBonuses respects ceilings
{
  const k = makeKingdom({ happiness: 100 });
  const hero = makeHero({ class: 'warlord', level: 20 });
  const updates = {};
  const events = [];
  heroes.applyHeroTurnBonuses(hero, k, updates, events);
  assert.equal(updates.happiness, 100, 'happiness capped at 100');
  console.log('Test 13: applyHeroTurnBonuses respects ceilings ✓');
}

// Test 14: recruitHero returns error for invalid class
{
  const k = makeKingdom();
  const result = heroes.recruitHero(k, 'Test', 'invalid_class');
  assert.ok('error' in result, 'returns error object');
  assert.ok(result.error, 'error message present');
  console.log(`Test 14: recruitHero rejects invalid class ✓ (${result.error})`);
}

// Test 15: recruitHero returns error for insufficient gold
{
  const k = makeKingdom({ gold: 100 });
  const result = heroes.recruitHero(k, 'Test', 'paladin');
  assert.ok('error' in result, 'returns error for low gold');
  console.log(`Test 15: recruitHero checks gold ✓ (${result.error})`);
}

// Test 16: recruitHero returns error for insufficient mana
{
  const k = makeKingdom({ mana: 100, gold: 50000 }); // gold is enough
  const result = heroes.recruitHero(k, 'Test', 'paladin');
  assert.ok('error' in result, 'returns error for low mana');
  console.log(`Test 16: recruitHero checks mana ✓ (${result.error})`);
}

// Test 17: recruitHero returns error for no castle
{
  const k = makeKingdom({ bld_castles: 0 });
  const result = heroes.recruitHero(k, 'Test', 'paladin');
  assert.ok('error' in result, 'returns error for no castle');
  console.log(`Test 17: recruitHero checks castle ✓ (${result.error})`);
}

// Test 18: recruitHero succeeds with valid kingdom
{
  const k = makeKingdom();
  const result = heroes.recruitHero(k, 'Test Hero', 'paladin');
  assert.ok('hero' in result, 'returns hero object');
  assert.ok('cost' in result, 'returns cost object');
  assert.equal(result.hero.name, 'Test Hero', 'hero name set');
  assert.equal(result.hero.class, 'paladin', 'hero class set');
  assert.equal(result.hero.level, 1, 'hero starts at level 1');
  console.log('Test 18: recruitHero succeeds ✓');
}

// Test 19: all exports are functions
{
  const fns = [
    'heroXpForLevel',
    'awardHeroXp',
    'getHeroPower',
    'applyHeroTurnBonuses',
    'recruitHero',
  ];
  for (const name of fns) {
    assert.equal(typeof heroes[name], 'function', `${name} is exported`);
  }
  console.log('Test 19: all exports are functions ✓');
}

console.log('\nAll heroes tests passed.');
