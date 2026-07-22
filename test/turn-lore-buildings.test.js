'use strict';
// Unit tests for game/lib/turn-lore-buildings.js (engine extract S04).
// Run: node test/turn-lore-buildings.test.js

const assert = require('assert');
const { createTurnContext } = require('../game/lib/turn-context');
const { runPrelude } = require('../game/lib/turn-prelude');
const { runIncomePhase } = require('../game/lib/turn-income');
const { runLoreAndBuildings } = require('../game/lib/turn-lore-buildings');

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
    engineer_level: 1,
    engineer_xp: 0,
    ...overrides,
  };
}

function runThroughLore(k) {
  const ctx = createTurnContext(k, null);
  runPrelude(ctx);
  runIncomePhase(ctx);
  runLoreAndBuildings(ctx);
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

console.log('turn-lore-buildings');

test('runLoreAndBuildings does not throw with empty queue', () => {
  const ctx = runThroughLore(baseKingdom());
  assert.ok(ctx.updates);
});

test('completing a build job increments building and writes build_queue', () => {
  const k = baseKingdom({
    bld_farms: 5,
    build_queue: JSON.stringify({
      job1: {
        building: 'bld_farms',
        turns_remaining: 1,
        turns_needed: 100,
      },
    }),
  });
  const ctx = runThroughLore(k);
  assert.strictEqual(ctx.updates.bld_farms, 6);
  assert.ok(ctx.updates.build_queue);
  const q = JSON.parse(ctx.updates.build_queue);
  assert.strictEqual(q.job1, undefined);
  const doneEv = ctx.events.find((e) => e.message && e.message.includes('Construction complete'));
  assert.ok(doneEv);
});

test('non-complete job only decrements turns_remaining in place', () => {
  // Legacy: incomplete jobs mutate healed k.build_queue in place and do NOT
  // set updates.build_queue unless a job completed (buildQueueChanged).
  const k = baseKingdom({
    build_queue: JSON.stringify({
      job1: {
        building: 'bld_markets',
        turns_remaining: 3,
        turns_needed: 50,
      },
    }),
  });
  const ctx = runThroughLore(k);
  assert.strictEqual(ctx.updates.build_queue, undefined);
  assert.strictEqual(ctx.k.build_queue.job1.turns_remaining, 2);
  assert.strictEqual(ctx.updates.bld_markets, undefined);
});

test('count-style build_queue (processBuildQueue format) does not throw', () => {
  // Live queues are { woodyard: 1 } counts — not job objects. Regression:
  // "Cannot create property 'turns_remaining' on number '1'" crashed turns.
  const k = baseKingdom({
    build_queue: JSON.stringify({ woodyard: 1, bld_farms: 2 }),
  });
  const ctx = runThroughLore(k);
  assert.strictEqual(ctx.updates.build_queue, undefined);
  assert.strictEqual(ctx.k.build_queue.woodyard, 1);
});

test('lore path with forced Math.random may drop history event', () => {
  const orig = Math.random;
  // Force lore roll: first call < 0.001, then category pick, then event pick
  let n = 0;
  Math.random = () => {
    n += 1;
    if (n === 1) return 0; // always take lore branch
    return 0.5;
  };
  try {
    const ctx = runThroughLore(baseKingdom({ collected_lore: '[]' }));
    // Depending on LORE_EVENTS content, may or may not produce HISTORY — just no throw
    assert.ok(ctx.events);
  } finally {
    Math.random = orig;
  }
});

console.log('turn-lore-buildings: all passed');
