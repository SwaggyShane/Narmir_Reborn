'use strict';
// Unit tests for game/lib/turn-upkeep-flavor.js (engine extract S05).
// Run: node test/turn-upkeep-flavor.test.js

const assert = require('assert');
const { createTurnContext } = require('../game/lib/turn-context');
const { runPrelude } = require('../game/lib/turn-prelude');
const { runIncomePhase } = require('../game/lib/turn-income');
const { runLoreAndBuildings } = require('../game/lib/turn-lore-buildings');
const { runUpkeepAndFlavor } = require('../game/lib/turn-upkeep-flavor');

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
    fighters: 100,
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
    bld_barracks: 4,
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
    ...overrides,
  };
}

function runThroughUpkeep(k) {
  const ctx = createTurnContext(k, null);
  runPrelude(ctx);
  runIncomePhase(ctx);
  runLoreAndBuildings(ctx);
  runUpkeepAndFlavor(ctx);
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

console.log('turn-upkeep-flavor');

test('upkeep deducts gold when troops are billable', () => {
  const k = baseKingdom({ fighters: 200, gold: 5000, bld_barracks: 0 });
  const ctx = runThroughUpkeep(k);
  const upkeepEv = ctx.events.find((e) => e.message && e.message.includes('Troop upkeep'));
  assert.ok(upkeepEv, 'expected troop upkeep event');
  assert.ok(ctx.updates.gold < 5000 + (ctx.updates.gold_income || 0));
});

test('riots path at happiness <= 0 resets happiness to 5', () => {
  const orig = Math.random;
  Math.random = () => 0.5; // deterministic losses
  try {
    const k = baseKingdom({ happiness: 0, gold: 5000, population: 2000, bld_farms: 3 });
    // Force happiness in updates to 0 after prelude would set real happiness
    const ctx = createTurnContext(k, null);
    runPrelude(ctx);
    ctx.updates.happiness = 0;
    runIncomePhase(ctx);
    runLoreAndBuildings(ctx);
    runUpkeepAndFlavor(ctx);
    assert.strictEqual(ctx.updates.happiness, 5);
    const riot = ctx.events.find((e) => e.message && e.message.includes('RIOTS'));
    assert.ok(riot);
  } finally {
    Math.random = orig;
  }
});

test('high happiness skips threshold disasters with fixed RNG', () => {
  const orig = Math.random;
  Math.random = () => 0; // would fire chance rolls if gates open
  try {
    const k = baseKingdom({ happiness: 80, tax: 42 });
    const ctx = runThroughUpkeep(k);
    assert.ok(!ctx.events.some((e) => e.message && e.message.includes('RIOTS')));
    assert.ok(!ctx.events.some((e) => e.message && e.message.includes('Critical Unrest')));
  } finally {
    Math.random = orig;
  }
});

console.log('turn-upkeep-flavor: all passed');
