'use strict';
// Characterization tests for game/magic.js.
// Locks the magic domain entry points: manaPerTurn output shape, castSpell
// validation gates (school/general spellbook, scroll, mana cost), and the
// per-turn processors (processMageTower/processShrine/processMausoleum/
// processLibrary) returning the expected update + event shape.
//
// These run against the extracted module — pre-extraction engine.js
// produced the same values; any divergence flags a regression in the move.
//
// Run: node test/magic.test.js

const assert = require('assert');
const magic = require('../game/magic');
const config = require('../game/config');

function makeKingdom(overrides = {}) {
  return {
    race: 'human',
    tax: 42,
    land: 1000,
    happiness: 50,
    prestige_level: 0,
    turn: 1,
    mana: 0,
    res_economy: 100,
    res_entertainment: 100,
    res_war_machines: 100,
    res_attack_magic: 100,
    res_defense_magic: 100,
    res_spellbook: 0,
    school_spellbook: 0,
    school_of_magic: null,
    food: 5000,
    food_surplus_turns: 0,
    food_shortage_turns: 0,
    population: 5000,
    fighters: 0, rangers: 0, clerics: 0, mages: 0, thieves: 0, ninjas: 0,
    researchers: 0, engineers: 0, scribes: 0, thralls: 0,
    bld_castles: 0, bld_taverns: 0, bld_markets: 0, bld_farms: 0,
    bld_granaries: 0, bld_mage_towers: 0, bld_walls: 0, bld_guard_towers: 0,
    bld_outposts: 0, bld_housing: 0, bld_mausoleums: 0, bld_schools: 0,
    bld_libraries: 0, bld_shrines: 0, bld_smithies: 0, bld_vaults: 0,
    bld_training: 0, bld_barracks: 0,
    maps: 0,
    troop_levels: null,
    scrolls: null,
    tower_upgrades: null,
    school_upgrades: null,
    shrine_upgrades: null,
    mausoleum_upgrades: null,
    library_upgrades: null,
    active_event: null,
    active_effects: null,
    alliance_buffs: null,
    fragment_bonuses: null,
    achievements: null,
    items: null,
    milestone_bonuses: null,
    certified_blueprints_stored: 0,
    ...overrides,
  };
}

console.log('Testing magic.js\n');

// Test 1: manaPerTurn returns a positive integer for a baseline human kingdom
{
  const m = magic.manaPerTurn(makeKingdom({ bld_mage_towers: 1, mages: 5 }));
  assert.ok(Number.isInteger(m) && m >= 0, `mana should be a non-negative int, got ${m}`);
  console.log(`Test 1: manaPerTurn baseline = ${m} ✓`);
}

// Test 2: mage tower count + mages scale mana up
{
  const lo = magic.manaPerTurn(makeKingdom({ bld_mage_towers: 1, mages: 5 }));
  const hi = magic.manaPerTurn(makeKingdom({ bld_mage_towers: 5, mages: 50 }));
  assert.ok(hi > lo, `more towers + mages should produce more mana (lo=${lo} hi=${hi})`);
  console.log(`Test 2: mana scales with towers + mages (${lo} → ${hi}) ✓`);
}

// Test 3: castSpell rejects unknown spell
{
  const caster = makeKingdom();
  const target = makeKingdom();
  const r = magic.castSpell(caster, target, 'no_such_spell', false);
  assert.equal(r.error, 'Unknown spell');
  console.log('Test 3: castSpell unknown spell ✓');
}

// Test 4: castSpell rejects when general spellbook below min and no school
{
  // Pick any tier-1 spell from SPELL_DEFS
  const spellId = Object.keys(config.SPELL_DEFS).find((id) => config.SPELL_DEFS[id].tier === 1);
  assert.ok(spellId, 'expected at least one tier-1 spell');

  const caster = makeKingdom({
    turn: 400,
    res_spellbook: 0,
    school_spellbook: 0,
    school_of_magic: null,
    discovered_kingdoms: JSON.stringify({ 2: { mapped: true } }),
  });
  const target = makeKingdom({ id: 2, turn: 400 });
  const r = magic.castSpell(caster, target, spellId, false);
  assert.ok(/spellbook too low/i.test(r.error || ''), `expected spellbook-too-low, got: ${r.error}`);
  console.log(`Test 4: castSpell rejects when spellbook low (${spellId}) ✓`);
}

// Test 5: castSpell rejects when no scroll
{
  const spellId = Object.keys(config.SPELL_DEFS).find((id) => config.SPELL_DEFS[id].tier === 1);
  const def = config.SPELL_DEFS[spellId];

  // Meet the spellbook requirement but provide no scroll
  const caster = makeKingdom({
    turn: 400,
    res_spellbook: def.minSB,
    scrolls: null,
    discovered_kingdoms: JSON.stringify({ 2: { mapped: true } }),
  });
  const target = makeKingdom({ id: 2, turn: 400 });
  const r = magic.castSpell(caster, target, spellId, false);
  assert.ok(/scroll/i.test(r.error || ''), `expected scroll-required error, got: ${r.error}`);
  console.log(`Test 5: castSpell rejects when no scroll ✓`);
}

// Test 6: castSpell rejects when out of mana
{
  const spellId = Object.keys(config.SPELL_DEFS).find((id) => config.SPELL_DEFS[id].tier === 1);
  const def = config.SPELL_DEFS[spellId];

  const caster = makeKingdom({
    turn: 400,
    res_spellbook: def.minSB,
    scrolls: JSON.stringify({ [spellId]: 1 }),
    mana: 0,
    discovered_kingdoms: JSON.stringify({ 2: { mapped: true } }),
  });
  const target = makeKingdom({ id: 2, turn: 400 });
  const r = magic.castSpell(caster, target, spellId, false);
  assert.ok(/mana/i.test(r.error || ''), `expected mana error, got: ${r.error}`);
  console.log('Test 6: castSpell rejects when out of mana ✓');
}

// Test 7: tier-5 spells use the tier-5 mana cost, not the fallback
{
  const spellId = Object.keys(config.SPELL_DEFS).find(
    (id) => config.SPELL_DEFS[id].tier === 5 && config.SPELL_DEFS[id].effect === 'friendly',
  );
  assert.ok(spellId, 'expected at least one tier-5 friendly spell');
  const def = config.SPELL_DEFS[spellId];

  const caster = makeKingdom({
    res_spellbook: def.minSB,
    scrolls: JSON.stringify({ [spellId]: 1 }),
    mana: 250000,
  });
  const target = makeKingdom();
  const r = magic.castSpell(caster, target, spellId, false);
  assert.ok(!r.error, `expected tier-5 spell to cast, got: ${r.error}`);
  assert.equal(r.casterUpdates.mana, 50000, `expected 200000 mana cost, got ${caster.mana - r.casterUpdates.mana}`);
  console.log(`Test 7: tier-5 mana cost enforced (${spellId}) ✓`);
}

// Test 8: spell target validation blocks offensive casts without a map
{
  const spellId = Object.keys(config.SPELL_DEFS).find((id) => config.SPELL_DEFS[id].tier === 1 && config.SPELL_DEFS[id].effect !== 'friendly');
  assert.ok(spellId, 'expected at least one offensive tier-1 spell');

  const caster = makeKingdom({
    turn: 400,
    res_spellbook: config.SPELL_DEFS[spellId].minSB,
    scrolls: JSON.stringify({ [spellId]: 1 }),
  });
  const target = makeKingdom({ id: 2, turn: 400 });
  const r = magic.validateSpellTarget(caster, target, spellId);
  assert.ok(/location map/i.test(r.error || ''), `expected map-required error, got: ${r.error}`);
  console.log('Test 8: validateSpellTarget enforces map requirement ✓');
}

// Test 7: processMageTower returns updates shape (object)
{
  const k = makeKingdom({ bld_mage_towers: 2, mages: 10 });
  const events = [];
  const updates = magic.processMageTower(k, events);
  assert.ok(updates && typeof updates === 'object');
  console.log('Test 7: processMageTower returns updates object ✓');
}

// Test 8: processShrine returns updates shape (no clerics → no-op)
{
  const k = makeKingdom({ bld_shrines: 1 });
  const events = [];
  const updates = magic.processShrine(k, events);
  assert.ok(updates && typeof updates === 'object');
  console.log('Test 8: processShrine returns updates object ✓');
}

// Test 9: processMausoleum returns updates shape (non-vampire → no-op)
{
  const k = makeKingdom({ race: 'human', bld_mausoleums: 0 });
  const events = [];
  const updates = magic.processMausoleum(k, events);
  assert.ok(updates && typeof updates === 'object');
  console.log('Test 9: processMausoleum returns updates object ✓');
}

// Test 10: processLibrary returns updates shape
{
  const k = makeKingdom({ bld_libraries: 1, scribes: 5 });
  const events = [];
  const updates = magic.processLibrary(k, events);
  assert.ok(updates && typeof updates === 'object');
  console.log('Test 10: processLibrary returns updates object ✓');
}

// Test 11: malformed JSON tolerance — bad upgrade strings shouldn't throw
{
  const k = makeKingdom({
    tower_upgrades: '{bad',
    library_upgrades: '{bad',
    shrine_upgrades: '{bad',
    mausoleum_upgrades: '{bad',
    school_upgrades: '{bad',
    bld_mage_towers: 1,
    mages: 5,
  });
  magic.manaPerTurn(k);
  magic.processMageTower(k, []);
  magic.processShrine(k, []);
  magic.processMausoleum(k, []);
  magic.processLibrary(k, []);
  console.log('Test 11: malformed JSON inputs handled ✓');
}

console.log('\nAll magic tests passed.');
