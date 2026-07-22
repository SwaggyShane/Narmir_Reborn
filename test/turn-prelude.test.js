'use strict';
// Unit tests for game/lib/turn-prelude.js (engine extract S01).
// Run: node test/turn-prelude.test.js

const assert = require('assert');
const { createTurnContext } = require('../game/lib/turn-context');
const { runPrelude } = require('../game/lib/turn-prelude');

function baseKingdom(overrides = {}) {
  return {
    id: 1,
    turn: 100,
    race: 'human',
    gold: 5000,
    food: 2000,
    population: 1500,
    land: 200,
    happiness: 70,
    tax: 10,
    fighters: 20,
    rangers: 10,
    clerics: 5,
    mages: 5,
    thieves: 0,
    ninjas: 0,
    researchers: 5,
    engineers: 5,
    scribes: 0,
    thralls: 0,
    bld_farms: 5,
    bld_granaries: 2,
    bld_housing: 3,
    bld_markets: 1,
    bld_taverns: 0,
    bld_shrines: 0,
    bld_castles: 0,
    bld_barracks: 0,
    bld_walls: 0,
    bld_guard_towers: 0,
    bld_outposts: 0,
    bld_training: 0,
    bld_schools: 1,
    bld_libraries: 0,
    bld_mage_towers: 0,
    bld_mausoleums: 0,
    bld_smithies: 0,
    bld_vaults: 0,
    bld_armories: 0,
    res_economy: 1,
    res_entertainment: 0,
    res_military: 0,
    prestige_level: 0,
    level: 5,
    xp: 100,
    troop_levels: '{}',
    xp_sources: '{}',
    build_queue: '{}',
    active_effects: '{}',
    active_event: '{}',
    collected_lore: '[]',
    school_upgrades: '{}',
    research_focus: '[]',
    research_progress: '{}',
    milestone_bonuses: '{}',
    bank_deposits: '[]',
    training_allocation: '{}',
    research_allocation: '{}',
    mage_research_progress: '{}',
    racial_bonuses_unlocked: '{}',
    discovered_kingdoms: '{}',
    location_maps_wip: '[]',
    fragment_bonuses: '{}',
    goals: '{}',
    rebellion_cooldown: 0,
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

console.log('turn-prelude');

test('runPrelude sets happiness and happiness event', () => {
  const k = baseKingdom();
  const ctx = createTurnContext(k, null);
  runPrelude(ctx);
  assert.ok(typeof ctx.updates.happiness === 'number');
  assert.ok(ctx.happinessResult);
  assert.strictEqual(ctx.updates.happiness, ctx.happinessResult.happiness);
  const happyEv = ctx.events.find((e) => e.message && e.message.includes('Happiness:'));
  assert.ok(happyEv, 'expected happiness system event');
});

test('runPrelude initializes xpSourcesAccum object', () => {
  const k = baseKingdom({ xp_sources: JSON.stringify({ turn: 3 }) });
  const ctx = createTurnContext(k, null);
  runPrelude(ctx);
  assert.ok(ctx.xpSourcesAccum);
  assert.strictEqual(typeof ctx.xpSourcesAccum.turn, 'number');
});

test('runPrelude decays fragment_happiness_penalty toward 0', () => {
  const k = baseKingdom({
    active_effects: JSON.stringify({ fragment_happiness_penalty: -3 }),
  });
  const ctx = createTurnContext(k, null);
  runPrelude(ctx);
  assert.ok(ctx.updates.active_effects);
  const effects = JSON.parse(ctx.updates.active_effects);
  assert.strictEqual(effects.fragment_happiness_penalty, -2);
});

test('runPrelude removes fragment_happiness_penalty when it reaches 0', () => {
  const k = baseKingdom({
    active_effects: JSON.stringify({ fragment_happiness_penalty: -1, other: 1 }),
  });
  const ctx = createTurnContext(k, null);
  runPrelude(ctx);
  const effects = JSON.parse(ctx.updates.active_effects);
  assert.strictEqual(effects.fragment_happiness_penalty, undefined);
  assert.strictEqual(effects.other, 1);
});

test('runPrelude with fixed Math.random does not throw on low happiness', () => {
  const orig = Math.random;
  Math.random = () => 0.99; // never trigger rebellion chance
  try {
    const k = baseKingdom({ happiness: 5, tax: 50, food: 0, population: 5000, land: 50 });
    const ctx = createTurnContext(k, null);
    runPrelude(ctx);
    assert.ok(typeof ctx.updates.happiness === 'number');
  } finally {
    Math.random = orig;
  }
});

console.log('turn-prelude: all passed');
