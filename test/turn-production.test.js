'use strict';
// Unit tests for game/lib/turn-production.js (engine extract S03).
// Run: node test/turn-production.test.js

const assert = require('assert');
const { createTurnContext } = require('../game/lib/turn-context');
const { runPrelude } = require('../game/lib/turn-prelude');
const { runIncomePhase } = require('../game/lib/turn-income');
const { runProductionPhase } = require('../game/lib/turn-production');
const { runBuildingAttunements } = require('../game/engine');

function baseKingdom(overrides = {}) {
  return {
    id: 999,
    player_id: 1,
    name: 'TestKingdom',
    race: 'human',
    turn: 42,
    turns_stored: 10,
    gold: 1000,
    food: 500,
    population: 1200,
    land: 150,
    happiness: 60,
    tax: 10,
    mana: 50,
    fighters: 50,
    rangers: 20,
    clerics: 10,
    mages: 5,
    thieves: 5,
    ninjas: 0,
    researchers: 10,
    engineers: 5,
    scribes: 2,
    thralls: 0,
    bld_farms: 5,
    bld_granaries: 2,
    bld_barracks: 1,
    bld_outposts: 1,
    bld_guard_towers: 0,
    bld_schools: 1,
    bld_armories: 0,
    bld_vaults: 1,
    bld_smithies: 1,
    bld_markets: 1,
    bld_mage_towers: 0,
    bld_shrines: 0,
    bld_training: 0,
    bld_castles: 0,
    bld_housing: 3,
    bld_libraries: 1,
    bld_taverns: 0,
    bld_mausoleums: 0,
    bld_woodyard: 2,
    bld_lumber_camp: 0,
    bld_blockfield: 1,
    bld_stone_quarry: 0,
    bld_strip_mine: 0,
    res_economy: 1,
    res_weapons: 0,
    res_armor: 0,
    res_military: 0,
    res_spellbook: 0,
    res_attack_magic: 0,
    res_defense_magic: 0,
    res_entertainment: 0,
    res_construction: 0,
    res_war_machines: 0,
    school_spellbook: 'none',
    troop_levels: '{}',
    xp: 0,
    level: 1,
    prestige_level: 0,
    scout_allocation: 0,
    scout_progress: 0,
    war_machines: 0,
    ballistae: 0,
    weapons_stockpile: 0,
    armor_stockpile: 0,
    ladders: 0,
    hammers_stored: 0,
    scaffolding_stored: 0,
    blueprints_stored: 0,
    wood: 100,
    stone: 50,
    iron: 20,
    coal: 10,
    steel: 5,
    maps: 0,
    hp: 100,
    max_hp: 100,
    wall_hp: 100,
    discovered_kingdoms: '{}',
    location_maps_wip: '[]',
    active_event: '{}',
    active_effects: '{}',
    xp_sources: '{}',
    racial_bonuses_unlocked: '{}',
    fragment_bonuses: '{}',
    library_progress: '{}',
    tower_progress: '{}',
    build_queue: '{}',
    collected_lore: '[]',
    school_upgrades: '{}',
    research_focus: '[]',
    research_progress: '{}',
    milestone_bonuses: '{}',
    bank_deposits: '[]',
    training_allocation: '{}',
    research_allocation: '{}',
    mage_research_progress: '{}',
    goals: '{}',
    rebellion_cooldown: 0,
    food_surplus_turns: 0,
    food_shortage_turns: 0,
    trade_routes: 0,
    mercenaries: '[]',
    ...overrides,
  };
}

function passthroughHelpers() {
  return {
    measureAttunement: (_name, fn) => fn(),
    fireAndForgetWithRetry: async () => {},
  };
}

function runThroughProduction(k, helpers = passthroughHelpers()) {
  const ctx = createTurnContext(k, null);
  runPrelude(ctx);
  runIncomePhase(ctx);
  runBuildingAttunements(ctx.k, ctx.updates, ctx.events);
  runProductionPhase(ctx, helpers);
  return ctx;
}

function test(name, fn) {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`  FAIL ${name}`);
    throw err;
  }
}

console.log('turn-production');

test('runProductionPhase does not throw on minimal kingdom', () => {
  const ctx = runThroughProduction(baseKingdom());
  assert.ok(ctx.updates);
  assert.ok(Array.isArray(ctx.events));
});

test('runProductionPhase ticks active_event turns_remaining', () => {
  const k = baseKingdom({
    active_event: JSON.stringify({
      feast: { turns_remaining: 2, label: 'feast' },
    }),
  });
  const ctx = runThroughProduction(k);
  assert.ok(ctx.updates.active_event, 'expected active_event update');
  const ev = JSON.parse(ctx.updates.active_event);
  assert.strictEqual(ev.feast.turns_remaining, 1);
});

test('runProductionPhase removes active_event when turns hit 0', () => {
  const k = baseKingdom({
    active_event: JSON.stringify({
      feast: { turns_remaining: 1, label: 'feast' },
    }),
  });
  const ctx = runThroughProduction(k);
  const ev = JSON.parse(ctx.updates.active_event);
  assert.strictEqual(ev.feast, undefined);
});

test('runProductionPhase with scout allocation and progress may update scout_progress', () => {
  const k = baseKingdom({
    scout_allocation: 500,
    scout_progress: 1,
    rangers: 100,
  });
  const ctx = runThroughProduction(k);
  // progress may or may not gain depending on ring math; just ensure no throw and updates finite
  if (ctx.updates.scout_progress !== undefined) {
    assert.ok(Number.isFinite(ctx.updates.scout_progress));
  }
});

test('runProductionPhase uses measureAttunement for scout progress', () => {
  let measured = false;
  const helpers = {
    measureAttunement: (name, fn) => {
      if (name === 'processScoutProgress') measured = true;
      return fn();
    },
    fireAndForgetWithRetry: async () => {},
  };
  runThroughProduction(baseKingdom({ scout_allocation: 10, rangers: 10 }), helpers);
  assert.strictEqual(measured, true);
});

console.log('turn-production: all passed');
