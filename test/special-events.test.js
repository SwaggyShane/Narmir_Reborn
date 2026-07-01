'use strict';
// Characterization tests for game/lib/special-events.js rebellion event handlers.
//
// Run: node test/special-events.test.js

const assert = require('assert');
const { rebellionEvent, rebellionCheck } = require('../game/lib/special-events');

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

console.log('\nAll special-events tests passed.');
