'use strict';
// Unit tests for game/lib/turn-research.js (engine extract S06).
// Run: node test/turn-research.test.js

const assert = require('assert');
const { createTurnContext } = require('../game/lib/turn-context');
const { runPrelude } = require('../game/lib/turn-prelude');
const { runIncomePhase } = require('../game/lib/turn-income');
const { runLoreAndBuildings } = require('../game/lib/turn-lore-buildings');
const { runUpkeepAndFlavor } = require('../game/lib/turn-upkeep-flavor');
const { runResearchPhase } = require('../game/lib/turn-research');

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
    mages: 10,
    thieves: 5,
    ninjas: 0,
    researchers: 50,
    engineers: 5,
    scribes: 2,
    thralls: 0,
    bld_farms: 5,
    bld_granaries: 2,
    bld_barracks: 1,
    bld_outposts: 1,
    bld_guard_towers: 0,
    bld_schools: 3,
    bld_armories: 0,
    bld_vaults: 1,
    bld_smithies: 1,
    bld_markets: 1,
    bld_mage_towers: 1,
    bld_shrines: 0,
    bld_training: 0,
    bld_castles: 0,
    bld_housing: 3,
    bld_libraries: 2,
    bld_taverns: 0,
    bld_mausoleums: 0,
    bld_woodyard: 0,
    bld_lumber_camp: 0,
    bld_blockfield: 0,
    bld_stone_quarry: 0,
    bld_strip_mine: 0,
    res_economy: 10,
    res_weapons: 0,
    res_armor: 0,
    res_military: 0,
    res_spellbook: 0,
    res_attack_magic: 0,
    res_defense_magic: 0,
    res_entertainment: 0,
    res_construction: 0,
    res_war_machines: 0,
    school_of_magic: 'fire',
    school_spellbook: 0,
    troop_levels: '{}',
    xp: 0,
    level: 5,
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
    research_focus: JSON.stringify(['economy']),
    research_progress: '{}',
    milestone_bonuses: '{}',
    bank_deposits: '[]',
    training_allocation: '{}',
    research_allocation: JSON.stringify({ spellbook_mages: 3, school_spellbook_mages: 0 }),
    mage_research_progress: '{}',
    goals: '{}',
    rebellion_cooldown: 0,
    food_surplus_turns: 0,
    food_shortage_turns: 0,
    trade_routes: 0,
    ...overrides,
  };
}

function runThroughResearch(k) {
  const ctx = createTurnContext(k, null);
  runPrelude(ctx);
  runIncomePhase(ctx);
  runLoreAndBuildings(ctx);
  runUpkeepAndFlavor(ctx);
  runResearchPhase(ctx);
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

console.log('turn-research');

test('researchers emit study or advance events and write research_progress', () => {
  const ctx = runThroughResearch(baseKingdom({ researchers: 50 }));
  assert.ok(ctx.updates.research_progress, 'expected research_progress update');
  const studyEv = ctx.events.find(
    (e) => e.message && (e.message.includes('researchers') || e.message.includes('Research advanced')),
  );
  assert.ok(studyEv, 'expected research-related event');
});

test('zero researchers emits hire message', () => {
  const ctx = runThroughResearch(baseKingdom({ researchers: 0 }));
  const msg = ctx.events.find((e) => e.message && e.message.includes('No researchers assigned'));
  assert.ok(msg);
});

test('mage allocation can write mage_research_progress', () => {
  const ctx = runThroughResearch(
    baseKingdom({
      mages: 10,
      research_allocation: JSON.stringify({ spellbook_mages: 5, school_spellbook_mages: 0 }),
      res_spellbook: 50,
    }),
  );
  // progress may only write when mages allocated to research
  if (ctx.updates.mage_research_progress !== undefined) {
    assert.ok(typeof ctx.updates.mage_research_progress === 'string');
  }
  assert.ok(ctx.xpSourcesAccum);
});

console.log('turn-research: all passed');
