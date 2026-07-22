'use strict';
// Unit tests for game/lib/turn-income.js (engine extract S02).
// Run: node test/turn-income.test.js

const assert = require('assert');
const { createTurnContext } = require('../game/lib/turn-context');
const { runPrelude } = require('../game/lib/turn-prelude');
const { runIncomePhase } = require('../game/lib/turn-income');

/** Same shape family as process-turn-regression (goldPerTurn needs full row). */
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

function test(name, fn) {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`  FAIL ${name}`);
    throw err;
  }
}

console.log('turn-income');

test('runIncomePhase sets gold_income and gold event', () => {
  const k = baseKingdom();
  const ctx = createTurnContext(k, null);
  runPrelude(ctx);
  runIncomePhase(ctx);
  assert.ok(Number.isFinite(ctx.updates.gold));
  assert.ok(Number.isFinite(ctx.updates.gold_income));
  assert.strictEqual(ctx.updates.gold, k.gold + ctx.updates.gold_income);
  const goldEv = ctx.events.find((e) => e.message && e.message.includes('gold earned'));
  assert.ok(goldEv, 'expected gold income event');
});

test('runIncomePhase respects pre-set updates.gold (rebellion base)', () => {
  const k = baseKingdom({ gold: 1000 });
  const ctx = createTurnContext(k, null);
  runPrelude(ctx);
  ctx.updates.gold = 500; // simulate treasury looting
  runIncomePhase(ctx);
  assert.strictEqual(ctx.updates.gold, 500 + ctx.updates.gold_income);
});

test('runIncomePhase sets mana and mana_regen', () => {
  const k = baseKingdom({ mana: 50, mages: 5 });
  const ctx = createTurnContext(k, null);
  runPrelude(ctx);
  runIncomePhase(ctx);
  assert.ok(Number.isFinite(ctx.updates.mana));
  assert.ok(Number.isFinite(ctx.updates.mana_regen));
  assert.strictEqual(ctx.updates.mana, k.mana + ctx.updates.mana_regen);
  const manaEv = ctx.events.find((e) => e.message && e.message.includes('Mana:'));
  assert.ok(manaEv);
});

test('runIncomePhase sets population', () => {
  const k = baseKingdom({ population: 2000, happiness: 80 });
  const ctx = createTurnContext(k, null);
  runPrelude(ctx);
  runIncomePhase(ctx);
  assert.ok(Number.isFinite(ctx.updates.population));
  assert.ok(ctx.updates.population >= 0);
});

test('runIncomePhase runs food economy', () => {
  const k = baseKingdom({ food: 500, bld_farms: 10, population: 1000 });
  const ctx = createTurnContext(k, null);
  runPrelude(ctx);
  runIncomePhase(ctx);
  assert.ok(
    ctx.updates.food !== undefined
      || ctx.updates.food_surplus_turns !== undefined
      || ctx.updates.food_shortage_turns !== undefined
      || ctx.events.some((e) => e.message && /food|farm|starv/i.test(e.message)),
    'expected food-related updates or events',
  );
});

console.log('turn-income: all passed');
