'use strict';
// Unit tests for game/engine.js's runBuildingAttunements (A3-8, 2026-07-19).
//
// Extracted from 18 near-identical hand-written blocks in processTurn (each
// was `measureAttunement(name, () => fn({...k, ...updates}, events))` then
// `Object.assign(updates, result)`) into a single data-driven loop over
// BUILDING_ATTUNEMENT_PROCESSORS. Verified byte-identical against the
// pre-refactor code via a git-stash before/after comparison with a fixed
// Math.random and a high-happiness fixture (rules out rebellionCheck's own
// randomness as a confound) — this test locks that in going forward by
// checking the loop wires at least one real, active attunement (granary /
// Tears of the World Tree) exactly the same way the direct function call
// does, and that updates/events are mutated in place as the original inline
// code required.
//
// Run: node test/engine-building-attunements.test.js

const assert = require('assert');
const { clearParseCache } = require('../utils/helpers');
const { runBuildingAttunements, processGranaryAttunements } = require('../game/engine');

function baseKingdom(overrides = {}) {
  return {
    race: 'human', turn: 10, land: 1000, gold: 50000, food: 5000, population: 500,
    tax: 42, happiness: 70, mana: 0, prestige_level: 0,
    bld_granaries: 5, bld_farms: 0, bld_markets: 0, bld_taverns: 0, bld_shrines: 0,
    bld_schools: 0, bld_mage_towers: 0, bld_mausoleums: 0, bld_libraries: 0,
    bld_armories: 0, bld_smithies: 0, bld_vaults: 0, bld_barracks: 0, bld_walls: 0,
    bld_guard_towers: 0, bld_outposts: 0, bld_training: 0, bld_castles: 0, bld_housing: 0,
    fighters: 0, rangers: 0, clerics: 0, mages: 0, thieves: 0, ninjas: 0,
    researchers: 0, engineers: 0, scribes: 0, thralls: 0,
    res_economy: 100, res_construction: 100,
    troop_levels: '{}', mercenaries: '[]', fragment_bonuses: '{}',
    active_effects: '{}', milestone_bonuses: '{}', alliance_buffs: '{}',
    ...overrides,
  };
}

function withGranaryFragment(fragmentName) {
  const FRAGMENTS = require('../game/world-fragment-bonuses');
  const config = FRAGMENTS[fragmentName]?.granaries;
  const bonuses = {
    granaries: {
      fragment: fragmentName,
      applied_turn: 1,
      passive: config.passive || {},
      special: { name: config.special?.name || '', desc: config.special?.desc || '' },
    },
  };
  return JSON.stringify(bonuses);
}

function main() {
  // 1. No fragments anywhere → runBuildingAttunements leaves updates untouched
  //    (all 18 processors return {} on a bare fixture with no attunements).
  {
    clearParseCache();
    const k = baseKingdom();
    const updates = {};
    const events = [];
    runBuildingAttunements(k, updates, events);
    assert.deepStrictEqual(updates, {}, 'no attunements configured → no updates produced');
    assert.strictEqual(events.length, 0, 'no attunements configured → no events produced');
  }
  console.log('✓ no attunements configured → runBuildingAttunements is a no-op');

  // 2. A real, active attunement (granary / Tears of the World Tree) wired
  //    through the loop produces the exact same result as calling
  //    processGranaryAttunements directly — proving the loop's dispatch
  //    (name, merged-state call, Object.assign) is correct for this entry.
  {
    clearParseCache();
    const k = baseKingdom({ food: 1000, fragment_bonuses: withGranaryFragment('Tears of the World Tree') });
    const directEvents = [];
    const directUpdates = processGranaryAttunements(k, directEvents);

    clearParseCache();
    const loopUpdates = {};
    const loopEvents = [];
    runBuildingAttunements(k, loopUpdates, loopEvents);

    assert.strictEqual(loopUpdates.food, directUpdates.food, 'loop must produce the same food update as the direct call');
    assert.strictEqual(loopUpdates.food, 1020, '2% of 1000 food = +20 (sanity, matches direct-call fixture)');
    assert.ok(loopEvents.some(e => e.message.includes('Tears of the World Tree')), 'loop must still fire the attunement event');
  }
  console.log('✓ a real active attunement (granary) is wired identically through the loop and the direct call');

  // 3. updates/events are mutated in place, not replaced — the original
  //    inline code relied on this (Object.assign(updates, result) into the
  //    same object processTurn already holds a reference to).
  {
    clearParseCache();
    const k = baseKingdom({ food: 1000, fragment_bonuses: withGranaryFragment('Tears of the World Tree') });
    const updates = { unrelated_field: 'must survive' };
    const events = [{ type: 'system', message: 'pre-existing event must survive' }];
    const updatesRef = updates;
    const eventsRef = events;
    runBuildingAttunements(k, updates, events);
    assert.strictEqual(updates, updatesRef, 'updates object identity must be preserved (mutated in place)');
    assert.strictEqual(events, eventsRef, 'events array identity must be preserved (mutated in place)');
    assert.strictEqual(updates.unrelated_field, 'must survive', 'pre-existing updates fields must not be clobbered');
    assert.strictEqual(events[0].message, 'pre-existing event must survive', 'pre-existing events must not be clobbered');
    assert.ok(events.length > 1, 'new attunement events must be appended, not replacing existing ones');
  }
  console.log('✓ updates/events are mutated in place, preserving pre-existing content');

  console.log('\nAll runBuildingAttunements tests passed.');
}

main();
