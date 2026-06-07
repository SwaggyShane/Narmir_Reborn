'use strict';
const assert = require('assert');
const { clearParseCache } = require('../utils/helpers');
const {
  processBarracksAttunements,
} = require('../game/engine');

// Minimal kingdom for barracks tests
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
    bld_barracks: 5,
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
    bld_walls: 0,
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

// Build fragment_bonuses JSON for barracks
function withBarracksFragment(fragmentName) {
  const FRAGMENTS = require('../game/world-fragment-bonuses');
  const config = FRAGMENTS[fragmentName]?.barracks;
  if (!config) throw new Error(`No barracks config for fragment: ${fragmentName}`);
  const bonuses = {
    barracks: {
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

// ── processBarracksAttunements ───────────────────────────────────────────────

function test_attunements_noFragment() {
  clearParseCache();
  const k = baseKingdom();
  const events = [];
  const updates = processBarracksAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'no fragment → empty updates');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_noBarracks() {
  clearParseCache();
  const k = baseKingdom({ bld_barracks: 0, fragment_bonuses: withBarracksFragment('Cursed Bloodstone') });
  const events = [];
  const updates = processBarracksAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'no barracks → empty updates');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_passiveOnly_volcanicRock() {
  clearParseCache();
  const k = baseKingdom({ fragment_bonuses: withBarracksFragment('Volcanic Rock') });
  const events = [];
  const updates = processBarracksAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'Volcanic Rock is passive-only');
  assert.strictEqual(events.length, 0, 'no events for passive-only fragment');
}

function test_attunements_passiveOnly_ancientElvenWood() {
  clearParseCache();
  const k = baseKingdom({ fragment_bonuses: withBarracksFragment('Ancient Elven Wood') });
  const events = [];
  const updates = processBarracksAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'Ancient Elven Wood is passive-only');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_passiveOnly_dragonScale() {
  clearParseCache();
  const k = baseKingdom({ fragment_bonuses: withBarracksFragment('Dragon Scale') });
  const events = [];
  const updates = processBarracksAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'Dragon Scale is passive-only');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_passiveOnly_voidEssence() {
  clearParseCache();
  const k = baseKingdom({ fragment_bonuses: withBarracksFragment('Void Essence') });
  const events = [];
  const updates = processBarracksAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'Void Essence is passive-only');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_cursedBloodstone_noTrigger() {
  clearParseCache();
  const origRandom = Math.random;
  Math.random = () => 0.50; // > 0.10, no instability
  try {
    const k = baseKingdom({ happiness: 80, fragment_bonuses: withBarracksFragment('Cursed Bloodstone') });
    const events = [];
    const updates = processBarracksAttunements(k, events);
    assert.strictEqual(updates.happiness, undefined, 'no happiness change without trigger');
    assert.strictEqual(events.length, 0, 'no event without trigger');
  } finally {
    Math.random = origRandom;
  }
}

function test_attunements_cursedBloodstone_trigger() {
  clearParseCache();
  const origRandom = Math.random;
  Math.random = () => 0.05; // < 0.10, instability fires
  try {
    const k = baseKingdom({ happiness: 80, fragment_bonuses: withBarracksFragment('Cursed Bloodstone') });
    const events = [];
    const updates = processBarracksAttunements(k, events);
    assert.strictEqual(updates.happiness, 79, '-1 happiness from blood rites');
    assert.ok(events.some(e => e.message.includes('Sanguine Ritual Circles')), 'event fired');
  } finally {
    Math.random = origRandom;
  }
}

function test_attunements_cursedBloodstone_clampedAtMinus50() {
  clearParseCache();
  const origRandom = Math.random;
  Math.random = () => 0.05;
  try {
    const k = baseKingdom({ happiness: -50, fragment_bonuses: withBarracksFragment('Cursed Bloodstone') });
    const events = [];
    const updates = processBarracksAttunements(k, events);
    assert.strictEqual(updates.happiness, -50, 'happiness clamped at -50');
  } finally {
    Math.random = origRandom;
  }
}

// ── Run all tests ─────────────────────────────────────────────────────────────

const tests = [
  test_attunements_noFragment,
  test_attunements_noBarracks,
  test_attunements_passiveOnly_volcanicRock,
  test_attunements_passiveOnly_ancientElvenWood,
  test_attunements_passiveOnly_dragonScale,
  test_attunements_passiveOnly_voidEssence,
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
