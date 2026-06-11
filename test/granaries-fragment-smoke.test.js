'use strict';
const assert = require('assert');
const { clearParseCache } = require('../utils/helpers');
const {
  processGranaryAttunements,
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
    bld_granaries: 5,
    bld_farms: 0,
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
    bld_trainings: 0,
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

function withGranaryFragment(fragmentName) {
  const FRAGMENTS = require('../game/world-fragment-bonuses');
  const config = FRAGMENTS[fragmentName]?.granaries;
  if (!config) throw new Error(`No granaries config for fragment: ${fragmentName}`);
  const bonuses = {
    granaries: {
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

// ── processGranaryAttunements ────────────────────────────────────────────────

function test_attunements_noFragment() {
  clearParseCache();
  const k = baseKingdom();
  const events = [];
  const updates = processGranaryAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'no fragment → empty updates');
  assert.strictEqual(events.length, 0, 'no events');
}

// ── Passive-only fragments (7) ────────────────────────────────────────────────

function test_attunements_passiveOnly_volcanicRock() {
  clearParseCache();
  const k = baseKingdom({ fragment_bonuses: withGranaryFragment('Volcanic Rock') });
  const events = [];
  const updates = processGranaryAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'Volcanic Rock is passive-only');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_passiveOnly_ancientElvenWood() {
  clearParseCache();
  const k = baseKingdom({ fragment_bonuses: withGranaryFragment('Ancient Elven Wood') });
  const events = [];
  const updates = processGranaryAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'Ancient Elven Wood is passive-only');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_passiveOnly_dragonScale() {
  clearParseCache();
  const k = baseKingdom({ fragment_bonuses: withGranaryFragment('Dragon Scale') });
  const events = [];
  const updates = processGranaryAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'Dragon Scale is passive-only');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_passiveOnly_abyssalCrystal() {
  clearParseCache();
  const k = baseKingdom({ fragment_bonuses: withGranaryFragment('Abyssal Crystal') });
  const events = [];
  const updates = processGranaryAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'Abyssal Crystal is passive-only');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_passiveOnly_dwarvenStarMetal() {
  clearParseCache();
  const k = baseKingdom({ fragment_bonuses: withGranaryFragment('Dwarven Star-Metal') });
  const events = [];
  const updates = processGranaryAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'Dwarven Star-Metal is passive-only');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_passiveOnly_titanBone() {
  clearParseCache();
  const k = baseKingdom({ fragment_bonuses: withGranaryFragment('Titan Bone') });
  const events = [];
  const updates = processGranaryAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'Titan Bone is passive-only');
  assert.strictEqual(events.length, 0, 'no events');
}

// ── Tears of the World Tree: Cellular Biosphere ──────────────────────────────
// Existing function: +2% of current food (not per-granary), no bld_granaries guard

function test_attunements_tearsOfWorldTree_foodGain() {
  clearParseCache();
  // 2% of 1000 food = 20 gain
  const k = baseKingdom({ food: 1000, fragment_bonuses: withGranaryFragment('Tears of the World Tree') });
  const events = [];
  const updates = processGranaryAttunements(k, events);
  assert.strictEqual(updates.food, 1020, '2% of 1000 food = +20');
  assert.ok(events.some(e => e.message.includes('Tears of the World Tree')), 'event fired');
}

function test_attunements_tearsOfWorldTree_scales() {
  clearParseCache();
  // 2% of 5000 food = 100 gain
  const k = baseKingdom({ food: 5000, fragment_bonuses: withGranaryFragment('Tears of the World Tree') });
  const events = [];
  const updates = processGranaryAttunements(k, events);
  assert.strictEqual(updates.food, 5100, '2% of 5000 food = +100');
}

function test_attunements_tearsOfWorldTree_noGainWhenEmpty() {
  clearParseCache();
  const k = baseKingdom({ food: 0, fragment_bonuses: withGranaryFragment('Tears of the World Tree') });
  const events = [];
  const updates = processGranaryAttunements(k, events);
  assert.strictEqual(updates.food, undefined, 'no food gain when stores are empty');
  assert.strictEqual(events.length, 0, 'no event when gain is 0');
}

// ── Celestial Feather: Manna Manifestation ───────────────────────────────────
// Only fires when happiness < 30, distributes 5% food → +10 happiness

function test_attunements_celestialFeather_noTriggerHighHappiness() {
  clearParseCache();
  const k = baseKingdom({ happiness: 70, food: 2000, fragment_bonuses: withGranaryFragment('Celestial Feather') });
  const events = [];
  const updates = processGranaryAttunements(k, events);
  assert.strictEqual(updates.food, undefined, 'no food distributed when happiness is high');
  assert.strictEqual(events.length, 0, 'no event');
}

function test_attunements_celestialFeather_triggerLowHappiness() {
  clearParseCache();
  // happiness < 30 → distribute 5% of 2000 = 100 food, +10 happiness
  const k = baseKingdom({ happiness: 20, food: 2000, fragment_bonuses: withGranaryFragment('Celestial Feather') });
  const events = [];
  const updates = processGranaryAttunements(k, events);
  assert.strictEqual(updates.food, 1900, '5% of 2000 food distributed = 1900 remaining');
  assert.strictEqual(updates.happiness, 30, '+10 happiness: 20 + 10 = 30');
  assert.ok(events.some(e => e.message.includes('Manna Manifestation')), 'event fired');
}

// ── Cursed Bloodstone: Vampiric Silos ────────────────────────────────────────

function test_attunements_cursedBloodstone_noTrigger() {
  clearParseCache();
  const origRandom = Math.random;
  Math.random = () => 0.50; // > 0.10
  try {
    const k = baseKingdom({ happiness: 80, fragment_bonuses: withGranaryFragment('Cursed Bloodstone') });
    const events = [];
    const updates = processGranaryAttunements(k, events);
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
    const k = baseKingdom({ happiness: 80, fragment_bonuses: withGranaryFragment('Cursed Bloodstone') });
    const events = [];
    const updates = processGranaryAttunements(k, events);
    const ae = JSON.parse(updates.active_effects || '{}');
    assert.strictEqual(ae.fragment_happiness_penalty, -1, 'penalty stored in active_effects');
    assert.ok(events.some(e => e.message.includes('Vampiric Silos')), 'event fired');
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
      fragment_bonuses: withGranaryFragment('Cursed Bloodstone'),
      active_effects: '{"fragment_happiness_penalty": -2}',
    });
    const events = [];
    const updates = processGranaryAttunements(k, events);
    const ae = JSON.parse(updates.active_effects || '{}');
    assert.strictEqual(ae.fragment_happiness_penalty, -3, 'penalty stacks: -2 + -1 = -3');
  } finally {
    Math.random = origRandom;
  }
}

// ── Void Essence: Void Pantry ────────────────────────────────────────────────
// Existing function uses two Math.random calls: first < 0.05 to trigger, second for loss %

function test_attunements_voidEssence_noTrigger() {
  clearParseCache();
  const origRandom = Math.random;
  Math.random = () => 0.50; // > 0.05: first call doesn't trigger
  try {
    const k = baseKingdom({ food: 2000, fragment_bonuses: withGranaryFragment('Void Essence') });
    const events = [];
    const updates = processGranaryAttunements(k, events);
    assert.strictEqual(updates.food, undefined, 'no food loss without trigger');
    assert.strictEqual(events.length, 0, 'no event');
  } finally {
    Math.random = origRandom;
  }
}

function test_attunements_voidEssence_trigger() {
  clearParseCache();
  let call = 0;
  const origRandom = Math.random;
  // call 0: 0.02 < 0.05 → trigger; call 1: 0.0 → loss = floor(2000 * (0.1 + 0.0)) = 200
  Math.random = () => call++ === 0 ? 0.02 : 0.0;
  try {
    const k = baseKingdom({ food: 2000, fragment_bonuses: withGranaryFragment('Void Essence') });
    const events = [];
    const updates = processGranaryAttunements(k, events);
    assert.strictEqual(updates.food, 1800, '10% of 2000 = 200 food vanishes');
    assert.ok(events.some(e => e.message.includes('Void Essence')), 'event fired');
  } finally {
    Math.random = origRandom;
  }
}

// ── Run all tests ─────────────────────────────────────────────────────────────

const tests = [
  test_attunements_noFragment,
  test_attunements_passiveOnly_volcanicRock,
  test_attunements_passiveOnly_ancientElvenWood,
  test_attunements_passiveOnly_dragonScale,
  test_attunements_passiveOnly_abyssalCrystal,
  test_attunements_passiveOnly_dwarvenStarMetal,
  test_attunements_passiveOnly_titanBone,
  test_attunements_tearsOfWorldTree_foodGain,
  test_attunements_tearsOfWorldTree_scales,
  test_attunements_tearsOfWorldTree_noGainWhenEmpty,
  test_attunements_celestialFeather_noTriggerHighHappiness,
  test_attunements_celestialFeather_triggerLowHappiness,
  test_attunements_cursedBloodstone_noTrigger,
  test_attunements_cursedBloodstone_trigger,
  test_attunements_cursedBloodstone_stacks,
  test_attunements_voidEssence_noTrigger,
  test_attunements_voidEssence_trigger,
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
