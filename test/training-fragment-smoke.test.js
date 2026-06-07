'use strict';
const assert = require('assert');
const { clearParseCache } = require('../utils/helpers');
const {
  processTrainingAttunements,
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
    bld_training: 5,
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
    bld_guard_towers: 0,
    bld_outposts: 0,
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

function withTrainingFragment(fragmentName) {
  const FRAGMENTS = require('../game/world-fragment-bonuses');
  const config = FRAGMENTS[fragmentName]?.training;
  if (!config) throw new Error(`No training config for fragment: ${fragmentName}`);
  const bonuses = {
    training: {
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

// ── processTrainingAttunements ────────────────────────────────────────────────

function test_attunements_noFragment() {
  clearParseCache();
  const k = baseKingdom();
  const events = [];
  const updates = processTrainingAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'no fragment → empty updates');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_noTrainingFields() {
  clearParseCache();
  const k = baseKingdom({ bld_training: 0, fragment_bonuses: withTrainingFragment('Cursed Bloodstone') });
  const events = [];
  const updates = processTrainingAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'no training fields → empty updates');
  assert.strictEqual(events.length, 0, 'no events');
}

// ── Passive-only fragments (8) ────────────────────────────────────────────────

function test_attunements_passiveOnly_volcanicRock() {
  clearParseCache();
  const k = baseKingdom({ fragment_bonuses: withTrainingFragment('Volcanic Rock') });
  const events = [];
  const updates = processTrainingAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'Volcanic Rock is passive-only');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_passiveOnly_ancientElvenWood() {
  clearParseCache();
  const k = baseKingdom({ fragment_bonuses: withTrainingFragment('Ancient Elven Wood') });
  const events = [];
  const updates = processTrainingAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'Ancient Elven Wood is passive-only');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_passiveOnly_dragonScale() {
  clearParseCache();
  const k = baseKingdom({ fragment_bonuses: withTrainingFragment('Dragon Scale') });
  const events = [];
  const updates = processTrainingAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'Dragon Scale is passive-only');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_passiveOnly_abyssalCrystal() {
  clearParseCache();
  const k = baseKingdom({ fragment_bonuses: withTrainingFragment('Abyssal Crystal') });
  const events = [];
  const updates = processTrainingAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'Abyssal Crystal is passive-only');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_passiveOnly_celestialFeather() {
  clearParseCache();
  const k = baseKingdom({ fragment_bonuses: withTrainingFragment('Celestial Feather') });
  const events = [];
  const updates = processTrainingAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'Celestial Feather is passive-only');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_passiveOnly_dwarvenStarMetal() {
  clearParseCache();
  const k = baseKingdom({ fragment_bonuses: withTrainingFragment('Dwarven Star-Metal') });
  const events = [];
  const updates = processTrainingAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'Dwarven Star-Metal is passive-only');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_passiveOnly_tearsOfWorldTree() {
  clearParseCache();
  const k = baseKingdom({ fragment_bonuses: withTrainingFragment('Tears of the World Tree') });
  const events = [];
  const updates = processTrainingAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'Tears of the World Tree is passive-only');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_passiveOnly_titanBone() {
  clearParseCache();
  const k = baseKingdom({ fragment_bonuses: withTrainingFragment('Titan Bone') });
  const events = [];
  const updates = processTrainingAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'Titan Bone is passive-only');
  assert.strictEqual(events.length, 0, 'no events');
}

// ── Cursed Bloodstone: Crucible Agony Training ────────────────────────────────

function test_attunements_cursedBloodstone_noTrigger() {
  clearParseCache();
  const origRandom = Math.random;
  Math.random = () => 0.50; // > 0.10
  try {
    const k = baseKingdom({ happiness: 80, fragment_bonuses: withTrainingFragment('Cursed Bloodstone') });
    const events = [];
    const updates = processTrainingAttunements(k, events);
    assert.strictEqual(updates.active_effects, undefined, 'no penalty without trigger');
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
    const k = baseKingdom({ happiness: 80, fragment_bonuses: withTrainingFragment('Cursed Bloodstone') });
    const events = [];
    const updates = processTrainingAttunements(k, events);
    const ae = JSON.parse(updates.active_effects || '{}');
    assert.strictEqual(ae.fragment_happiness_penalty, -1, 'penalty stored in active_effects');
    assert.ok(events.some(e => e.message.includes('Crucible Agony Training')), 'event fired');
  } finally {
    Math.random = origRandom;
  }
}

function test_attunements_cursedBloodstone_stacks() {
  clearParseCache();
  const origRandom = Math.random;
  Math.random = () => 0.05;
  try {
    const k = baseKingdom({
      fragment_bonuses: withTrainingFragment('Cursed Bloodstone'),
      active_effects: '{"fragment_happiness_penalty": -2}',
    });
    const events = [];
    const updates = processTrainingAttunements(k, events);
    const ae = JSON.parse(updates.active_effects || '{}');
    assert.strictEqual(ae.fragment_happiness_penalty, -3, 'penalty stacks: -2 + -1 = -3');
  } finally {
    Math.random = origRandom;
  }
}

// ── Void Essence: Dimensional Slip Sparring ───────────────────────────────────

function test_attunements_voidEssence_noTrigger() {
  clearParseCache();
  const origRandom = Math.random;
  Math.random = () => 0.50; // > 0.15
  try {
    const k = baseKingdom({ happiness: 70, fragment_bonuses: withTrainingFragment('Void Essence') });
    const events = [];
    const updates = processTrainingAttunements(k, events);
    assert.strictEqual(updates.active_effects, undefined, 'no penalty without trigger');
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
    const k = baseKingdom({ happiness: 70, fragment_bonuses: withTrainingFragment('Void Essence') });
    const events = [];
    const updates = processTrainingAttunements(k, events);
    const ae = JSON.parse(updates.active_effects || '{}');
    assert.strictEqual(ae.fragment_happiness_penalty, -1, 'penalty stored in active_effects');
    assert.ok(events.some(e => e.message.includes('Dimensional Slip Sparring')), 'event fired');
  } finally {
    Math.random = origRandom;
  }
}

function test_attunements_voidEssence_stacks() {
  clearParseCache();
  const origRandom = Math.random;
  Math.random = () => 0.10;
  try {
    const k = baseKingdom({
      fragment_bonuses: withTrainingFragment('Void Essence'),
      active_effects: '{"fragment_happiness_penalty": -2}',
    });
    const events = [];
    const updates = processTrainingAttunements(k, events);
    const ae = JSON.parse(updates.active_effects || '{}');
    assert.strictEqual(ae.fragment_happiness_penalty, -3, 'penalty stacks: -2 + -1 = -3');
  } finally {
    Math.random = origRandom;
  }
}

// ── Run all tests ─────────────────────────────────────────────────────────────

const tests = [
  test_attunements_noFragment,
  test_attunements_noTrainingFields,
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
  test_attunements_cursedBloodstone_stacks,
  test_attunements_voidEssence_noTrigger,
  test_attunements_voidEssence_trigger,
  test_attunements_voidEssence_stacks,
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
