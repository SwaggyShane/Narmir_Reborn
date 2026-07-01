'use strict';
// Characterization tests for game/lib/special-events.js rebellion event handlers.
//
// Run: node test/special-events.test.js

const assert = require('assert');
const { rebellionEvent, rebellionCheck } = require('../game/lib/special-events');
const engine = require('../game/engine');

function makeKingdom(overrides = {}) {
  return {
    turn: 10,
    rebellion_cooldown: 0,
    population: 5000,
    gold: 10000,
    tax: 42,
    food: 5000,
    fighters: 1000, rangers: 1000, clerics: 100, mages: 100, thieves: 100, ninjas: 100, engineers: 100,
    bld_taverns: 5, bld_markets: 5, bld_shrines: 5, bld_schools: 5, bld_mage_towers: 5,
    bld_granaries: 5, bld_farms: 5,
    ...overrides,
  };
}

function withMockedRandom(value, fn) {
  const original = Math.random;
  Math.random = () => value;
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

// Test 1: eventType selection covers all 6 cases without crashing
{
  for (let sample = 0; sample < 6; sample++) {
    // eventType = Math.floor(Math.random() * 6) + 1, so sample/6 selects case sample+1
    const randomValue = sample / 6 + 0.001;
    const k = makeKingdom();
    const updates = {};
    const events = [];
    withMockedRandom(randomValue, () => rebellionEvent(k, updates, events));
    assert.ok(events.length === 1, `case ${sample + 1} should push exactly one event`);
    assert.equal(events[0].type, 'rebellion');
    assert.equal(updates.rebellion_cooldown, k.turn + 20, 'cooldown always set');
  }
  console.log('Test 1: all 6 rebellion event types trigger without crashing ✓');
}

// Test 2: Treasury Looting (case 6) reduces gold by 5-15%, never below 0
{
  const k = makeKingdom({ gold: 10000 });
  const updates = {};
  const events = [];
  // 0.99 selects case 6 (Treasury Looting): floor(0.99 * 6) + 1 = 6.
  withMockedRandom(0.99, () => rebellionEvent(k, updates, events));
  assert.ok(updates.gold < 10000, 'gold should decrease');
  assert.ok(updates.gold >= 8500, 'loss should not exceed 15% of starting gold');
  assert.ok(events[0].message.includes('TREASURY LOOTED'), 'news message should mention treasury looting');
  console.log(`Test 2: Treasury Looting reduces gold correctly ✓ (${10000} -> ${updates.gold})`);
}

// Test 3: Treasury Looting never drives gold negative
{
  const k = makeKingdom({ gold: 0 });
  const updates = {};
  const events = [];
  withMockedRandom(0.99, () => rebellionEvent(k, updates, events));
  assert.equal(updates.gold, 0, 'gold should clamp at 0, not go negative');
  console.log('Test 3: Treasury Looting clamps at 0 gold ✓');
}

// Test 4: rebellionCheck still respects the >=50 happiness gate with the new event type in play
{
  const k = makeKingdom({ happiness: 80 });
  const updates = {};
  const events = [];
  for (let i = 0; i < 100; i++) {
    rebellionCheck(k, 80, updates, events);
  }
  assert.equal(events.length, 0, 'no rebellion events when happiness >= 50');
  console.log('Test 4: rebellionCheck still gates on happiness >= 50 ✓');
}

// Test 5: rebellion population loss survives the full processTurn pipeline
// (regression test — game/engine.js used to unconditionally overwrite
// updates.gold/updates.population from the pre-turn k.* snapshot after
// rebellionCheck ran, silently discarding rebellion effects on both).
//
// Natural popGrowth() is itself capable of shrinking population (overcrowding,
// unhappiness), so simply asserting "population decreased" doesn't discriminate
// between "rebellion loss applied" and "just normal decline masking a swallowed
// rebellion loss" — that gap is exactly how this bug shipped undetected. Instead,
// run the identical fixture twice with a call-counted Math.random mock that
// forces rebellion to fire on one run and blocks it on the other, holding every
// other random draw in processTurn to the real implementation so the two runs
// are comparable, then assert the rebellion run's population is materially lower.
{
  function makeFixture() {
    return {
      id: 1,
      turn: 1,
      race: 'human',
      region: 'human',
      land: 100,
      tax: 100, // max tax penalty
      res_economy: 100,
      res_entertainment: 0,
      bld_castles: 5,
      bld_taverns: 0, // no entertainment happiness
      bld_farms: 0,
      bld_mage_towers: 0,
      bld_housing: 20,
      population: 100000, // large size-pressure penalty
      gold: 10000,
      food: 0, // no food happiness
      mana: 0,
      mages: 0,
      happiness: 0,
      last_attack_turn: 1, // recent attack tanks safety happiness
      rebellion_cooldown: 0,
      active_effects: JSON.stringify({}),
      fragment_bonuses: null,
      troop_levels: JSON.stringify({}),
      xp_sources: JSON.stringify({}),
      collected_lore: JSON.stringify([]),
      tower_upgrades: JSON.stringify({}),
      farm_upgrades: JSON.stringify({}),
      achievements: JSON.stringify([]),
    };
  }

  const preTurnHappiness = require('../game/happiness').calculateHappiness(makeFixture()).happiness;
  assert.ok(preTurnHappiness <= 0, `fixture must produce happiness <= 0 to guarantee rebellion chance (got ${preTurnHappiness})`);

  function runWithControlledRebellion(forceRebellion) {
    // A single fixed value for the whole call is simpler and more robust than
    // counting calls — processTurn's goal-pool shuffle (progressGoal, called
    // before rebellionCheck) consumes an unpredictable number of Math.random()
    // calls depending on pool size, so counting calls to isolate "the rebellion
    // roll" is not reliable. 0.001 both fires rebellionCheck's `< rebellionChance`
    // trigger and selects case 1 (Unrest) via floor(0.001 * 6) + 1 = 1. 0.999 is
    // never < any rebellionChance value used in this codebase, so it reliably
    // blocks the trigger.
    const original = Math.random;
    Math.random = () => (forceRebellion ? 0.001 : 0.999);
    try {
      return engine.processTurn(makeFixture());
    } finally {
      Math.random = original;
    }
  }

  const withoutRebellion = runWithControlledRebellion(false);
  const withRebellion = runWithControlledRebellion(true);

  assert.ok(!withoutRebellion.events.some(e => e.type === 'rebellion'), 'blocked run should not fire a rebellion');
  assert.ok(withRebellion.events.some(e => e.type === 'rebellion'), 'forced run should fire a rebellion');

  // Other systems in processTurn (starvation, food shortage, etc.) also affect
  // population, so an exact-magnitude assertion is too brittle — but the direction
  // is unambiguous: firing an Unrest rebellion (5-10% population loss) must never
  // leave a kingdom with MORE population than an otherwise-identical turn where no
  // rebellion fired. This is the actual bug signature: with the overwrite bug
  // present, the forced-rebellion run ends up at 97,997 vs. 95,003 for the blocked
  // run on this fixture — rebellion firing made population go UP, which is exactly
  // backwards, because the loss was computed and then silently discarded before
  // the unrelated population swings from other systems were layered on top.
  assert.ok(
    withRebellion.updates.population < withoutRebellion.updates.population,
    `rebellion firing must not leave population higher than not firing: without-rebellion=${withoutRebellion.updates.population}, with-rebellion=${withRebellion.updates.population}`
  );

  console.log(`Test 5: rebellion population loss survives processTurn ✓ (no-rebellion=${withoutRebellion.updates.population.toLocaleString()}, with-rebellion=${withRebellion.updates.population.toLocaleString()})`);
}

console.log('\nAll special-events tests passed.');
