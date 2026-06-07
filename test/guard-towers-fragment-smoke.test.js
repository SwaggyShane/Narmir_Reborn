'use strict';
const assert = require('assert');
const { clearParseCache } = require('../utils/helpers');
const {
  processGuardTowerAttunements,
} = require('../game/engine');

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
    bld_guard_towers: 5,
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
    bld_walls: 0,
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

function withGuardTowerFragment(fragmentName) {
  const FRAGMENTS = require('../game/world-fragment-bonuses');
  const config = FRAGMENTS[fragmentName]?.guard_towers;
  if (!config) throw new Error(`No guard_towers config for fragment: ${fragmentName}`);
  const bonuses = {
    guard_towers: {
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

// ── processGuardTowerAttunements ─────────────────────────────────────────────

function test_attunements_noFragment() {
  clearParseCache();
  const k = baseKingdom();
  const events = [];
  const updates = processGuardTowerAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'no fragment → empty updates');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_noTowers() {
  clearParseCache();
  const k = baseKingdom({ bld_guard_towers: 0, fragment_bonuses: withGuardTowerFragment('Cursed Bloodstone') });
  const events = [];
  const updates = processGuardTowerAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'no towers → empty updates');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_passiveOnly_volcanicRock() {
  clearParseCache();
  const k = baseKingdom({ fragment_bonuses: withGuardTowerFragment('Volcanic Rock') });
  const events = [];
  const updates = processGuardTowerAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'Volcanic Rock is passive-only');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_passiveOnly_ancientElvenWood() {
  clearParseCache();
  const k = baseKingdom({ fragment_bonuses: withGuardTowerFragment('Ancient Elven Wood') });
  const events = [];
  const updates = processGuardTowerAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'Ancient Elven Wood is passive-only');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_passiveOnly_dragonScale() {
  clearParseCache();
  const k = baseKingdom({ fragment_bonuses: withGuardTowerFragment('Dragon Scale') });
  const events = [];
  const updates = processGuardTowerAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'Dragon Scale is passive-only');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_passiveOnly_abyssalCrystal() {
  clearParseCache();
  const k = baseKingdom({ fragment_bonuses: withGuardTowerFragment('Abyssal Crystal') });
  const events = [];
  const updates = processGuardTowerAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'Abyssal Crystal is passive-only');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_passiveOnly_celestialFeather() {
  clearParseCache();
  const k = baseKingdom({ fragment_bonuses: withGuardTowerFragment('Celestial Feather') });
  const events = [];
  const updates = processGuardTowerAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'Celestial Feather is passive-only');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_passiveOnly_dwarvenStarMetal() {
  clearParseCache();
  const k = baseKingdom({ fragment_bonuses: withGuardTowerFragment('Dwarven Star-Metal') });
  const events = [];
  const updates = processGuardTowerAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'Dwarven Star-Metal is passive-only');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_passiveOnly_tearsOfWorldTree() {
  clearParseCache();
  const k = baseKingdom({ fragment_bonuses: withGuardTowerFragment('Tears of the World Tree') });
  const events = [];
  const updates = processGuardTowerAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'Tears of the World Tree is passive-only');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_passiveOnly_titanBone() {
  clearParseCache();
  const k = baseKingdom({ fragment_bonuses: withGuardTowerFragment('Titan Bone') });
  const events = [];
  const updates = processGuardTowerAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'Titan Bone is passive-only');
  assert.strictEqual(events.length, 0, 'no events');
}

// ── Cursed Bloodstone: Brimstone Signal Fire ─────────────────────────────────

function test_attunements_cursedBloodstone_noTrigger() {
  clearParseCache();
  const origRandom = Math.random;
  Math.random = () => 0.50; // > 0.10
  try {
    const k = baseKingdom({ happiness: 80, fragment_bonuses: withGuardTowerFragment('Cursed Bloodstone') });
    const events = [];
    const updates = processGuardTowerAttunements(k, events);
    assert.strictEqual(updates.happiness, undefined, 'no happiness change without trigger');
    assert.strictEqual(events.length, 0, 'no event without trigger');
  } finally {
    Math.random = origRandom;
  }
}

function test_attunements_cursedBloodstone_trigger() {
  clearParseCache();
  const origRandom = Math.random;
  Math.random = () => 0.05; // < 0.10
  try {
    const k = baseKingdom({ happiness: 80, fragment_bonuses: withGuardTowerFragment('Cursed Bloodstone') });
    const events = [];
    const updates = processGuardTowerAttunements(k, events);
    assert.strictEqual(updates.happiness, 79, '-1 happiness from brimstone horror');
    assert.ok(events.some(e => e.message.includes('Brimstone Signal Fire')), 'event fired');
  } finally {
    Math.random = origRandom;
  }
}

function test_attunements_cursedBloodstone_clampedAtMinus50() {
  clearParseCache();
  const origRandom = Math.random;
  Math.random = () => 0.05;
  try {
    const k = baseKingdom({ happiness: -50, fragment_bonuses: withGuardTowerFragment('Cursed Bloodstone') });
    const events = [];
    const updates = processGuardTowerAttunements(k, events);
    assert.strictEqual(updates.happiness, -50, 'happiness clamped at -50');
  } finally {
    Math.random = origRandom;
  }
}

// ── Void Essence: Astral Sight Rifts ─────────────────────────────────────────

function test_attunements_voidEssence_noTrigger() {
  clearParseCache();
  const origRandom = Math.random;
  Math.random = () => 0.50; // > 0.15
  try {
    const k = baseKingdom({ happiness: 70, fragment_bonuses: withGuardTowerFragment('Void Essence') });
    const events = [];
    const updates = processGuardTowerAttunements(k, events);
    assert.strictEqual(updates.happiness, undefined, 'no change without trigger');
    assert.strictEqual(events.length, 0, 'no event');
  } finally {
    Math.random = origRandom;
  }
}

function test_attunements_voidEssence_trigger() {
  clearParseCache();
  const origRandom = Math.random;
  Math.random = () => 0.10; // < 0.15
  try {
    const k = baseKingdom({ happiness: 70, fragment_bonuses: withGuardTowerFragment('Void Essence') });
    const events = [];
    const updates = processGuardTowerAttunements(k, events);
    assert.strictEqual(updates.happiness, 69, '-1 happiness from spatial vertigo');
    assert.ok(events.some(e => e.message.includes('Astral Sight Rifts')), 'event fired');
  } finally {
    Math.random = origRandom;
  }
}

function test_attunements_voidEssence_clampedAtMinus50() {
  clearParseCache();
  const origRandom = Math.random;
  Math.random = () => 0.10;
  try {
    const k = baseKingdom({ happiness: -50, fragment_bonuses: withGuardTowerFragment('Void Essence') });
    const events = [];
    const updates = processGuardTowerAttunements(k, events);
    assert.strictEqual(updates.happiness, -50, 'happiness clamped at -50');
  } finally {
    Math.random = origRandom;
  }
}

// ── Run all tests ─────────────────────────────────────────────────────────────

const tests = [
  test_attunements_noFragment,
  test_attunements_noTowers,
  test_attunements_passiveOnly_volcanicRock,
  test_attunements_passiveOnly_ancientElvenWood,
  test_attunements_passiveOnly_dragonScale,
  test_attunements_passiveOnly_abyssalCrystal,
  test_attunements_passiveOnly_celestialFeather,
  test_attunements_passiveOnly_dwarvenStarMetal,
  test_attunements_passiveOnly_tearsOfWorldTree,
  test_attunements_passiveOnly_titanBone,
  test_attunements_cursedBloodstone_noTrigger,
  test_attunements_cursedBloodstone_trigger,
  test_attunements_cursedBloodstone_clampedAtMinus50,
  test_attunements_voidEssence_noTrigger,
  test_attunements_voidEssence_trigger,
  test_attunements_voidEssence_clampedAtMinus50,
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
