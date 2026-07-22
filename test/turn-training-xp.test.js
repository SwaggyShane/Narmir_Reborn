'use strict';
// Unit tests for game/lib/turn-training-xp.js (engine extract S08).
// Run: node test/turn-training-xp.test.js

const assert = require('assert');
const { createTurnContext } = require('../game/lib/turn-context');
const { runPrelude } = require('../game/lib/turn-prelude');
const { runIncomePhase } = require('../game/lib/turn-income');
const { runLoreAndBuildings } = require('../game/lib/turn-lore-buildings');
const { runUpkeepAndFlavor } = require('../game/lib/turn-upkeep-flavor');
const { runResearchPhase } = require('../game/lib/turn-research');
const { runQueuesPhase } = require('../game/lib/turn-queues');
const { runTrainingAndXpPhase } = require('../game/lib/turn-training-xp');

function baseKingdom(overrides = {}) {
  return {
    id: 999,
    player_id: 1,
    name: 'TestKingdom',
    race: 'human',
    turn: 42,
    turns_stored: 10,
    gold: 10000,
    food: 500,
    population: 1200,
    land: 150,
    happiness: 70,
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
    bld_barracks: 2,
    bld_outposts: 1,
    bld_guard_towers: 0,
    bld_schools: 1,
    bld_armories: 0,
    bld_vaults: 1,
    bld_smithies: 1,
    bld_markets: 1,
    bld_mage_towers: 0,
    bld_shrines: 0,
    bld_training: 2,
    bld_castles: 0,
    bld_housing: 3,
    bld_libraries: 1,
    bld_taverns: 0,
    bld_mausoleums: 0,
    bld_woodyard: 0,
    bld_lumber_camp: 0,
    bld_blockfield: 0,
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
    school_spellbook: 0,
    troop_levels: JSON.stringify({ fighters: { level: 1, xp: 0, count: 10 } }),
    xp: 100,
    level: 2,
    prestige_level: 0,
    scout_allocation: 0,
    scout_progress: 0,
    war_machines: 0,
    ballistae: 0,
    weapons_stockpile: 10,
    armor_stockpile: 10,
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
    training_allocation: JSON.stringify({ fighters: 20 }),
    research_allocation: '{}',
    mage_research_progress: '{}',
    goals: '{}',
    rebellion_cooldown: 0,
    food_surplus_turns: 0,
    food_shortage_turns: 0,
    trade_routes: 0,
    ...overrides,
  };
}

function runThroughTraining(k) {
  const ctx = createTurnContext(k, null);
  runPrelude(ctx);
  runIncomePhase(ctx);
  runLoreAndBuildings(ctx);
  runUpkeepAndFlavor(ctx);
  runResearchPhase(ctx);
  runQueuesPhase(ctx);
  runTrainingAndXpPhase(ctx);
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

console.log('turn-training-xp');

test('training with allocation updates troop_levels object', () => {
  const ctx = runThroughTraining(baseKingdom());
  assert.ok(ctx.updates.troop_levels);
  assert.ok(typeof ctx.updates.troop_levels === 'object');
  assert.ok(ctx.updates.troop_levels.fighters);
  assert.ok((ctx.updates.troop_levels.fighters.xp || 0) >= 0);
});

test('turn XP awards write xp and xp_sources', () => {
  const ctx = runThroughTraining(baseKingdom({ xp: 50, level: 1 }));
  assert.ok(typeof ctx.updates.xp === 'number');
  assert.ok(ctx.updates.xp_sources);
  assert.ok(typeof ctx.updates.level === 'number');
});

test('no training buildings skips training events but still awards turn XP', () => {
  const ctx = runThroughTraining(baseKingdom({ bld_training: 0, training_allocation: '{}' }));
  assert.ok(typeof ctx.updates.xp === 'number');
});

console.log('turn-training-xp: all passed');
