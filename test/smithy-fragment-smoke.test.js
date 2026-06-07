'use strict';
const assert = require('assert');
const { clearParseCache } = require('../utils/helpers');
const {
  processBuildQueue,
  processSmithyAttunements,
} = require('../game/engine');

// Minimal kingdom for smithy tests
function baseKingdom(overrides = {}) {
  return {
    race: 'human',
    turn: 10,
    gold: 50000,
    food: 5000,
    population: 500,
    tax: 42,
    happiness: 70,
    mana: 0,
    prestige_level: 0,
    bld_smithies: 20,
    bld_farms: 0,
    bld_granaries: 0,
    bld_markets: 0,
    bld_taverns: 0,
    bld_shrines: 0,
    bld_schools: 0,
    bld_mage_towers: 0,
    bld_mausoleums: 0,
    bld_libraries: 0,
    bld_vaults: 0,
    bld_armories: 0,
    bld_barracks: 0,
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
    engineers: 10,
    scribes: 0,
    thralls: 0,
    hammers_stored: 5,
    blueprints_stored: 0,
    scaffolding_stored: 0,
    res_construction: 100,
    troop_levels: '{}',
    mercenaries: '[]',
    fragment_bonuses: '{}',
    active_effects: '{}',
    milestone_bonuses: '{}',
    build_allocation: '{}',
    resource_build_allocation: '{}',
    hammer_turns_used: 0,
    ...overrides,
  };
}

// Build fragment_bonuses JSON for smithies
function withSmithyFragment(fragmentName) {
  const FRAGMENTS = require('../game/world-fragment-bonuses');
  const config = FRAGMENTS[fragmentName]?.smithies;
  if (!config) throw new Error(`No smithy config for fragment: ${fragmentName}`);
  const bonuses = {
    smithies: {
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

// ── processBuildQueue passive wiring ────────────────────────────────────────

function test_buildQueue_noFragment_baselineMult() {
  clearParseCache();
  // With no fragment, effectiveSmithyMult should be 1.0 (no bonus)
  // We verify this indirectly: a kingdom with no engineers produces no output,
  // and the function returns without error.
  const k = baseKingdom({ engineers: 0 });
  const events = [];
  const result = processBuildQueue(k, events, {});
  assert.ok(typeof result === 'object', 'returns an object');
}

function test_buildQueue_withFragment_doesNotThrow() {
  clearParseCache();
  const k = baseKingdom({
    fragment_bonuses: withSmithyFragment('Dwarven Star-Metal'),
  });
  const events = [];
  assert.doesNotThrow(() => processBuildQueue(k, events, {}));
}

function test_buildQueue_voidEssence_negativeSpeed_doesNotThrow() {
  clearParseCache();
  // Void Essence has speed: -0.40 — verify negative passive doesn't crash
  const k = baseKingdom({
    fragment_bonuses: withSmithyFragment('Void Essence'),
  });
  const events = [];
  assert.doesNotThrow(() => processBuildQueue(k, events, {}));
}

// ── processSmithyAttunements ─────────────────────────────────────────────────

function test_attunements_noFragment() {
  clearParseCache();
  const k = baseKingdom();
  const events = [];
  const updates = processSmithyAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'no fragment → empty updates');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_noSmithies() {
  clearParseCache();
  const k = baseKingdom({ bld_smithies: 0, fragment_bonuses: withSmithyFragment('Volcanic Rock') });
  const events = [];
  const updates = processSmithyAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'no smithies → empty updates');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_passiveOnly_noSpecial() {
  // Volcanic Rock has no per-turn special — only passive speed/production/quality
  clearParseCache();
  const k = baseKingdom({ fragment_bonuses: withSmithyFragment('Volcanic Rock') });
  const events = [];
  const updates = processSmithyAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'Volcanic Rock is passive-only');
  assert.strictEqual(events.length, 0, 'no per-turn events for passive-only fragment');
}

function test_attunements_dwarvenStarMetal_autoForge() {
  clearParseCache();
  // 20 smithies → floor(20/10) = 2 hammers auto-forged
  const k = baseKingdom({
    bld_smithies: 20,
    hammers_stored: 3,
    fragment_bonuses: withSmithyFragment('Dwarven Star-Metal'),
  });
  const events = [];
  const updates = processSmithyAttunements(k, events);
  assert.strictEqual(updates.hammers_stored, 5, '20 smithies auto-forge 2 hammers (3+2=5)');
  assert.ok(events.some(e => e.message.includes('Clockwork Star-Metal Forges')), 'event fired');
}

function test_attunements_dwarvenStarMetal_belowThreshold() {
  clearParseCache();
  // 9 smithies → floor(9/10) = 0 hammers — no update
  const k = baseKingdom({
    bld_smithies: 9,
    hammers_stored: 0,
    fragment_bonuses: withSmithyFragment('Dwarven Star-Metal'),
  });
  const events = [];
  const updates = processSmithyAttunements(k, events);
  assert.strictEqual(updates.hammers_stored, undefined, 'fewer than 10 smithies → no auto-forge');
  assert.strictEqual(events.length, 0, 'no event below threshold');
}

function test_attunements_tearsOfWorldTree_goldSavings() {
  clearParseCache();
  // 20 smithies → 20 * 10 = 200 gold fuel savings
  const k = baseKingdom({
    bld_smithies: 20,
    gold: 5000,
    fragment_bonuses: withSmithyFragment('Tears of the World Tree'),
  });
  const events = [];
  const updates = processSmithyAttunements(k, events);
  assert.strictEqual(updates.gold, 5200, '20 smithies save 200 gold (5000+200=5200)');
  assert.ok(events.some(e => e.message.includes('Yggdrasil Fuel Glands')), 'event fired');
}

function test_attunements_voidEssence_noTrigger() {
  clearParseCache();
  const origRoll = global.Math.random;
  Math.random = () => 0.50; // > 0.15, no duplication
  try {
    const k = baseKingdom({
      bld_smithies: 20,
      hammers_stored: 10,
      fragment_bonuses: withSmithyFragment('Void Essence'),
    });
    const events = [];
    const updates = processSmithyAttunements(k, events);
    assert.strictEqual(updates.hammers_stored, undefined, 'no duplication when roll fails');
    assert.strictEqual(events.length, 0, 'no event when roll fails');
  } finally {
    Math.random = origRoll;
  }
}

function test_attunements_voidEssence_triggers() {
  clearParseCache();
  const origRoll = global.Math.random;
  Math.random = () => 0.10; // < 0.15, duplication fires
  try {
    const k = baseKingdom({
      bld_smithies: 20,
      hammers_stored: 10,
      fragment_bonuses: withSmithyFragment('Void Essence'),
    });
    const events = [];
    const updates = processSmithyAttunements(k, events);
    assert.strictEqual(updates.hammers_stored, 30, '+20 hammers (1 per smithy) on trigger');
    assert.ok(events.some(e => e.message.includes('Portal Anvils')), 'event fired');
  } finally {
    Math.random = origRoll;
  }
}

function test_attunements_cursedBloodstone_hammers_noChoas() {
  clearParseCache();
  Math.random = () => 0.50; // > 0.10, no chaos
  try {
    // 20 smithies → floor(20/2) = 10 hammers
    const k = baseKingdom({
      bld_smithies: 20,
      hammers_stored: 5,
      happiness: 80,
      fragment_bonuses: withSmithyFragment('Cursed Bloodstone'),
    });
    const events = [];
    const updates = processSmithyAttunements(k, events);
    assert.strictEqual(updates.hammers_stored, 15, '+10 hammers from Sanguine Crucible (5+10=15)');
    assert.strictEqual(updates.happiness, undefined, 'no happiness penalty without chaos');
    assert.ok(events.some(e => e.message.includes('Sanguine Crucible')), 'forge event fired');
  } finally {
    Math.random = global.Math.random; // restore (was replaced before try)
  }
}

function test_attunements_cursedBloodstone_chaos() {
  clearParseCache();
  Math.random = () => 0.05; // < 0.10, chaos fires
  try {
    const k = baseKingdom({
      bld_smithies: 20,
      hammers_stored: 0,
      happiness: 80,
      fragment_bonuses: withSmithyFragment('Cursed Bloodstone'),
    });
    const events = [];
    const updates = processSmithyAttunements(k, events);
    assert.strictEqual(updates.happiness, 79, '-1 happiness from chaos');
    assert.ok(events.some(e => e.message.includes('civil tensions')), 'chaos event fired');
  } finally {
    Math.random = global.Math.random;
  }
}

function test_attunements_titanBone_blueprints() {
  clearParseCache();
  // 20 smithies → floor(20/20) = 1 blueprint; cap = 20*25 = 500
  const k = baseKingdom({
    bld_smithies: 20,
    blueprints_stored: 10,
    fragment_bonuses: withSmithyFragment('Titan Bone'),
  });
  const events = [];
  const updates = processSmithyAttunements(k, events);
  assert.strictEqual(updates.blueprints_stored, 11, '+1 blueprint from Titan Bone (10+1=11)');
  assert.ok(events.some(e => e.message.includes('Mammoth Anvil Pillars')), 'event fired');
}

function test_attunements_titanBone_belowThreshold() {
  clearParseCache();
  // 10 smithies → floor(10/20) = 0 — no blueprint gain
  const k = baseKingdom({
    bld_smithies: 10,
    blueprints_stored: 0,
    fragment_bonuses: withSmithyFragment('Titan Bone'),
  });
  const events = [];
  const updates = processSmithyAttunements(k, events);
  assert.strictEqual(updates.blueprints_stored, undefined, 'fewer than 20 smithies → no blueprint');
  assert.strictEqual(events.length, 0, 'no event below threshold');
}

function test_attunements_titanBone_atCap() {
  clearParseCache();
  // 20 smithies → cap = 500 blueprints; already at cap → no gain
  const k = baseKingdom({
    bld_smithies: 20,
    blueprints_stored: 500, // at cap (20*25)
    fragment_bonuses: withSmithyFragment('Titan Bone'),
  });
  const events = [];
  const updates = processSmithyAttunements(k, events);
  assert.strictEqual(updates.blueprints_stored, undefined, 'at cap → no blueprint gain');
  assert.strictEqual(events.length, 0, 'no event at cap');
}

function test_attunements_titanBone_partialCap() {
  clearParseCache();
  // 40 smithies → floor(40/20) = 2 bp; cap = 40*25 = 1000; stored = 999 → only 1 fits
  const k = baseKingdom({
    bld_smithies: 40,
    blueprints_stored: 999,
    fragment_bonuses: withSmithyFragment('Titan Bone'),
  });
  const events = [];
  const updates = processSmithyAttunements(k, events);
  assert.strictEqual(updates.blueprints_stored, 1000, 'partial cap: only 1 blueprint fits');
}

// ── Run all tests ─────────────────────────────────────────────────────────────

const tests = [
  test_buildQueue_noFragment_baselineMult,
  test_buildQueue_withFragment_doesNotThrow,
  test_buildQueue_voidEssence_negativeSpeed_doesNotThrow,
  test_attunements_noFragment,
  test_attunements_noSmithies,
  test_attunements_passiveOnly_noSpecial,
  test_attunements_dwarvenStarMetal_autoForge,
  test_attunements_dwarvenStarMetal_belowThreshold,
  test_attunements_tearsOfWorldTree_goldSavings,
  test_attunements_voidEssence_noTrigger,
  test_attunements_voidEssence_triggers,
  test_attunements_cursedBloodstone_hammers_noChoas,
  test_attunements_cursedBloodstone_chaos,
  test_attunements_titanBone_blueprints,
  test_attunements_titanBone_belowThreshold,
  test_attunements_titanBone_atCap,
  test_attunements_titanBone_partialCap,
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
