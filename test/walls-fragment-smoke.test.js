'use strict';
const assert = require('assert');
const { clearParseCache } = require('../utils/helpers');
const {
  processWallsAttunements,
} = require('../game/engine');

// Minimal kingdom for walls tests
function baseKingdom(overrides = {}) {
  return {
    race: 'human',
    turn: 10,
    land: 1000,
    gold: 50000,
    food: 5000,
    population: 500,
    tax: 42,
    happiness: 70,
    mana: 0,
    prestige_level: 0,
    bld_walls: 5,
    bld_farms: 0,
    bld_granaries: 0,
    bld_markets: 0,
    bld_taverns: 0,
    bld_shrines: 0,
    bld_schools: 0,
    bld_mage_towers: 0,
    bld_mausoleums: 0,
    bld_libraries: 0,
    bld_armories: 0,
    bld_smithies: 0,
    bld_vaults: 0,
    bld_barracks: 0,
    bld_guard_towers: 0,
    bld_outposts: 0,
    bld_training: 0,
    bld_castles: 0,
    bld_housing: 0,
    fighters: 0,
    rangers: 0,
    clerics: 0,
    mages: 0,
    thieves: 0,
    ninjas: 0,
    researchers: 0,
    engineers: 0,
    scribes: 0,
    thralls: 0,
    res_economy: 100,
    res_construction: 100,
    troop_levels: '{}',
    mercenaries: '[]',
    fragment_bonuses: '{}',
    active_effects: '{}',
    milestone_bonuses: '{}',
    alliance_buffs: '{}',
    ...overrides,
  };
}

// Build fragment_bonuses JSON for walls
function withWallsFragment(fragmentName) {
  const FRAGMENTS = require('../game/world-fragment-bonuses');
  const config = FRAGMENTS[fragmentName]?.walls;
  if (!config) throw new Error(`No walls config for fragment: ${fragmentName}`);
  const bonuses = {
    walls: {
      fragment: fragmentName,
      applied_turn: 1,
      passive: config.passive || {},
      special: {
        name: config.special?.name || '',
        desc: config.special?.desc || '',
      },
    },
  };
  return JSON.stringify(bonuses);
}

// ── processWallsAttunements ──────────────────────────────────────────────────

function test_attunements_noFragment() {
  clearParseCache();
  const k = baseKingdom();
  const events = [];
  const updates = processWallsAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'no fragment → empty updates');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_noWalls() {
  clearParseCache();
  const k = baseKingdom({ bld_walls: 0, fragment_bonuses: withWallsFragment('Dwarven Star-Metal') });
  const events = [];
  const updates = processWallsAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'no walls → empty updates');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_passiveOnly_volcanicRock() {
  clearParseCache();
  const k = baseKingdom({ fragment_bonuses: withWallsFragment('Volcanic Rock') });
  const events = [];
  const updates = processWallsAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'Volcanic Rock is passive-only');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_passiveOnly_ancientElvenWood() {
  clearParseCache();
  const k = baseKingdom({ fragment_bonuses: withWallsFragment('Ancient Elven Wood') });
  const events = [];
  const updates = processWallsAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'Ancient Elven Wood is passive-only');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_passiveOnly_dragonScale() {
  clearParseCache();
  const k = baseKingdom({ fragment_bonuses: withWallsFragment('Dragon Scale') });
  const events = [];
  const updates = processWallsAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'Dragon Scale is passive-only');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_passiveOnly_tearsOfWorldTree() {
  clearParseCache();
  const k = baseKingdom({ fragment_bonuses: withWallsFragment('Tears of the World Tree') });
  const events = [];
  const updates = processWallsAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'Tears of the World Tree is passive-only');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_passiveOnly_voidEssence() {
  clearParseCache();
  const k = baseKingdom({ fragment_bonuses: withWallsFragment('Void Essence') });
  const events = [];
  const updates = processWallsAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'Void Essence is passive-only');
  assert.strictEqual(events.length, 0, 'no events');
}

// ── Dwarven Star-Metal: Geared Self-Construction ─────────────────────────────

function test_attunements_dwarvenStarMetal_repairsOneWall() {
  clearParseCache();
  const k = baseKingdom({ bld_walls: 5, fragment_bonuses: withWallsFragment('Dwarven Star-Metal') });
  const events = [];
  const updates = processWallsAttunements(k, events);
  assert.strictEqual(updates.bld_walls, 6, 'Dwarven Star-Metal adds 1 wall per turn');
  assert.ok(events.some(e => e.message.includes('Geared Self-Construction')), 'event fired');
}

function test_attunements_dwarvenStarMetal_scales() {
  clearParseCache();
  const k = baseKingdom({ bld_walls: 20, fragment_bonuses: withWallsFragment('Dwarven Star-Metal') });
  const events = [];
  const updates = processWallsAttunements(k, events);
  assert.strictEqual(updates.bld_walls, 21, '20 + 1 wall');
}

// ── Cursed Bloodstone: Sanguine Blood-Thorns ─────────────────────────────────

function test_attunements_cursedBloodstone_noTrigger() {
  clearParseCache();
  const origRandom = Math.random;
  Math.random = () => 0.50; // > 0.10, no unrest
  try {
    const k = baseKingdom({ happiness: 80, fragment_bonuses: withWallsFragment('Cursed Bloodstone') });
    const events = [];
    const updates = processWallsAttunements(k, events);
    assert.strictEqual(updates.happiness, undefined, 'no happiness change without trigger');
    assert.strictEqual(events.length, 0, 'no event without trigger');
  } finally {
    Math.random = origRandom;
  }
}

function test_attunements_cursedBloodstone_trigger() {
  clearParseCache();
  const origRandom = Math.random;
  Math.random = () => 0.05; // < 0.10, unrest fires
  try {
    const k = baseKingdom({ happiness: 80, fragment_bonuses: withWallsFragment('Cursed Bloodstone') });
    const events = [];
    const updates = processWallsAttunements(k, events);
    assert.strictEqual(updates.happiness, 79, '-1 happiness from blood-thorns');
    assert.ok(events.some(e => e.message.includes('Sanguine Blood-Thorns')), 'event fired');
  } finally {
    Math.random = origRandom;
  }
}

function test_attunements_cursedBloodstone_clampedAtMinus50() {
  clearParseCache();
  const origRandom = Math.random;
  Math.random = () => 0.05;
  try {
    const k = baseKingdom({ happiness: -50, fragment_bonuses: withWallsFragment('Cursed Bloodstone') });
    const events = [];
    const updates = processWallsAttunements(k, events);
    assert.strictEqual(updates.happiness, -50, 'happiness clamped at -50');
  } finally {
    Math.random = origRandom;
  }
}

// ── Run all tests ─────────────────────────────────────────────────────────────

const tests = [
  test_attunements_noFragment,
  test_attunements_noWalls,
  test_attunements_passiveOnly_volcanicRock,
  test_attunements_passiveOnly_ancientElvenWood,
  test_attunements_passiveOnly_dragonScale,
  test_attunements_passiveOnly_tearsOfWorldTree,
  test_attunements_passiveOnly_voidEssence,
  test_attunements_dwarvenStarMetal_repairsOneWall,
  test_attunements_dwarvenStarMetal_scales,
  test_attunements_cursedBloodstone_noTrigger,
  test_attunements_cursedBloodstone_trigger,
  test_attunements_cursedBloodstone_clampedAtMinus50,
];

let passed = 0;
let failed = 0;
for (const t of tests) {
  try {
    t();
    console.log(`  ✓ ${t.name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${t.name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
