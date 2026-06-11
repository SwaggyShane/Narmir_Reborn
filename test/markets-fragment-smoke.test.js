'use strict';
const assert = require('assert');
const { clearParseCache } = require('../utils/helpers');
const { processMarketAttunements } = require('../game/engine');

function baseKingdom(overrides = {}) {
  return {
    race: 'human', turn: 10, land: 1000, gold: 50000, food: 5000,
    population: 500, tax: 42, happiness: 70, mana: 0, prestige_level: 0,
    bld_markets: 5, bld_farms: 0, bld_granaries: 0, bld_smithies: 0,
    bld_taverns: 0, bld_shrines: 0, bld_schools: 0, bld_mage_towers: 0,
    bld_mausoleums: 0, bld_libraries: 0, bld_armories: 0, bld_vaults: 0,
    bld_barracks: 0, bld_walls: 0, bld_guard_towers: 0, bld_outposts: 0,
    bld_training: 0, bld_castles: 0, bld_housing: 0,
    fighters: 0, rangers: 0, clerics: 0, mages: 0, thieves: 0, ninjas: 0,
    researchers: 0, engineers: 0, scribes: 0, thralls: 0,
    res_economy: 100, res_construction: 100, troop_levels: '{}',
    mercenaries: '[]', fragment_bonuses: '{}', active_effects: '{}',
    milestone_bonuses: '{}', alliance_buffs: '{}', ...overrides,
  };
}

function withMarketFragment(fragmentName) {
  const FRAGMENTS = require('../game/world-fragment-bonuses');
  const config = FRAGMENTS[fragmentName]?.markets;
  if (!config) throw new Error(`No markets config for fragment: ${fragmentName}`);
  return JSON.stringify({ markets: { fragment: fragmentName, applied_turn: 1, passive: config.passive || {}, special: { name: config.special?.name || '', desc: config.special?.desc || '' } } });
}

function test_attunements_noFragment() {
  clearParseCache();
  assert.deepStrictEqual(processMarketAttunements(baseKingdom(), []), {});
}

function test_attunements_noMarkets() {
  clearParseCache();
  const k = baseKingdom({ bld_markets: 0, fragment_bonuses: withMarketFragment('Cursed Bloodstone') });
  assert.deepStrictEqual(processMarketAttunements(k, []), {});
}

function test_passiveOnly_volcanicRock() { clearParseCache(); assert.deepStrictEqual(processMarketAttunements(baseKingdom({ fragment_bonuses: withMarketFragment('Volcanic Rock') }), []), {}); }
function test_passiveOnly_ancientElvenWood() { clearParseCache(); assert.deepStrictEqual(processMarketAttunements(baseKingdom({ fragment_bonuses: withMarketFragment('Ancient Elven Wood') }), []), {}); }
function test_passiveOnly_dragonScale() { clearParseCache(); assert.deepStrictEqual(processMarketAttunements(baseKingdom({ fragment_bonuses: withMarketFragment('Dragon Scale') }), []), {}); }
function test_passiveOnly_abyssalCrystal() { clearParseCache(); assert.deepStrictEqual(processMarketAttunements(baseKingdom({ fragment_bonuses: withMarketFragment('Abyssal Crystal') }), []), {}); }
function test_passiveOnly_celestialFeather() { clearParseCache(); assert.deepStrictEqual(processMarketAttunements(baseKingdom({ fragment_bonuses: withMarketFragment('Celestial Feather') }), []), {}); }
function test_passiveOnly_dwarvenStarMetal() { clearParseCache(); assert.deepStrictEqual(processMarketAttunements(baseKingdom({ fragment_bonuses: withMarketFragment('Dwarven Star-Metal') }), []), {}); }
function test_passiveOnly_tearsOfWorldTree() { clearParseCache(); assert.deepStrictEqual(processMarketAttunements(baseKingdom({ fragment_bonuses: withMarketFragment('Tears of the World Tree') }), []), {}); }
function test_passiveOnly_titanBone() { clearParseCache(); assert.deepStrictEqual(processMarketAttunements(baseKingdom({ fragment_bonuses: withMarketFragment('Titan Bone') }), []), {}); }

function test_cursedBloodstone_noTrigger() {
  clearParseCache();
  const orig = Math.random; Math.random = () => 0.50;
  try { assert.strictEqual(processMarketAttunements(baseKingdom({ fragment_bonuses: withMarketFragment('Cursed Bloodstone') }), []).active_effects, undefined); }
  finally { Math.random = orig; }
}

function test_cursedBloodstone_trigger() {
  clearParseCache();
  const orig = Math.random; Math.random = () => 0.05;
  try {
    const events = [];
    const updates = processMarketAttunements(baseKingdom({ fragment_bonuses: withMarketFragment('Cursed Bloodstone') }), events);
    assert.strictEqual(JSON.parse(updates.active_effects || '{}').fragment_happiness_penalty, -1);
    assert.ok(events.some(e => e.message.includes('Sanguine Auction Guilds')));
  } finally { Math.random = orig; }
}

function test_cursedBloodstone_stacks() {
  clearParseCache();
  const orig = Math.random; Math.random = () => 0.05;
  try {
    const k = baseKingdom({ fragment_bonuses: withMarketFragment('Cursed Bloodstone'), active_effects: '{"fragment_happiness_penalty": -2}' });
    assert.strictEqual(JSON.parse(processMarketAttunements(k, []).active_effects || '{}').fragment_happiness_penalty, -3);
  } finally { Math.random = orig; }
}

function test_voidEssence_noTrigger() {
  clearParseCache();
  const orig = Math.random; Math.random = () => 0.50;
  try { assert.strictEqual(processMarketAttunements(baseKingdom({ fragment_bonuses: withMarketFragment('Void Essence') }), []).active_effects, undefined); }
  finally { Math.random = orig; }
}

function test_voidEssence_trigger() {
  clearParseCache();
  const orig = Math.random; Math.random = () => 0.10;
  try {
    const events = [];
    const updates = processMarketAttunements(baseKingdom({ fragment_bonuses: withMarketFragment('Void Essence') }), events);
    assert.strictEqual(JSON.parse(updates.active_effects || '{}').fragment_happiness_penalty, -1);
    assert.ok(events.some(e => e.message.includes('Quantum Shopping Matrix')));
  } finally { Math.random = orig; }
}

function test_voidEssence_stacks() {
  clearParseCache();
  const orig = Math.random; Math.random = () => 0.10;
  try {
    const k = baseKingdom({ fragment_bonuses: withMarketFragment('Void Essence'), active_effects: '{"fragment_happiness_penalty": -2}' });
    assert.strictEqual(JSON.parse(processMarketAttunements(k, []).active_effects || '{}').fragment_happiness_penalty, -3);
  } finally { Math.random = orig; }
}

const tests = [
  test_attunements_noFragment, test_attunements_noMarkets,
  test_passiveOnly_volcanicRock, test_passiveOnly_ancientElvenWood, test_passiveOnly_dragonScale,
  test_passiveOnly_abyssalCrystal, test_passiveOnly_celestialFeather, test_passiveOnly_dwarvenStarMetal,
  test_passiveOnly_tearsOfWorldTree, test_passiveOnly_titanBone,
  test_cursedBloodstone_noTrigger, test_cursedBloodstone_trigger, test_cursedBloodstone_stacks,
  test_voidEssence_noTrigger, test_voidEssence_trigger, test_voidEssence_stacks,
];

let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); console.log(`  ✓ ${t.name}`); passed++; }
  catch (err) { console.error(`  ✗ ${t.name}`); console.error(`    ${err.message}`); failed++; }
}
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
