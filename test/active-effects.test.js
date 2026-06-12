'use strict';
// Characterization tests for game/active-effects.js.
// Locks per-turn effect tick-down, expiry events, and damage application.
//
// Run: node test/active-effects.test.js

const assert = require('assert');
const { processActiveEffects } = require('../game/active-effects');

function makeKingdom(overrides = {}) {
  return {
    race: 'human',
    population: 10000,
    food: 50000,
    fighters: 500,
    active_effects: null,
    granary_upgrades: null,
    fragment_attunements: null,
    ...overrides,
  };
}

console.log('Testing active-effects.js\n');

// Test 1: no active effects returns empty object
{
  const k = makeKingdom({ active_effects: null });
  const events = [];
  const result = processActiveEffects(k, events);
  assert.deepEqual(result, {}, 'null effects = empty result');
  assert.deepEqual(events, [], 'no events');
  console.log('Test 1: processActiveEffects(null effects) = {} ✓');
}

// Test 2: empty effects object returns empty object
{
  const k = makeKingdom({ active_effects: '{}' });
  const events = [];
  const result = processActiveEffects(k, events);
  assert.deepEqual(result, {}, 'empty effects = empty result');
  console.log('Test 2: processActiveEffects({} effects) = {} ✓');
}

// Test 3: effect with 1 turn left expires
{
  const k = makeKingdom({
    active_effects: JSON.stringify({ bless: { turns_left: 1 } }),
  });
  const events = [];
  const result = processActiveEffects(k, events);
  assert.ok('active_effects' in result, 'active_effects updated');
  const remaining = JSON.parse(result.active_effects);
  assert.ok(!remaining.bless, 'bless expired');
  assert.equal(events.length, 1, 'expiry event generated');
  assert.ok(events[0].message.includes('expired'), 'event says expired');
  console.log('Test 3: effect expiry ✓');
}

// Test 4: effect with 3 turns counts down
{
  const k = makeKingdom({
    active_effects: JSON.stringify({ bless: { turns_left: 3 } }),
  });
  const events = [];
  const result = processActiveEffects(k, events);
  const remaining = JSON.parse(result.active_effects);
  assert.equal(remaining.bless.turns_left, 2, 'turns_left decremented');
  assert.equal(events.length, 0, 'no expiry event yet');
  console.log('Test 4: effect countdown ✓');
}

// Test 5: blight reduces food each turn
{
  const k = makeKingdom({
    food: 5000,
    active_effects: JSON.stringify({ blight: { turns_left: 3, damage: 500 } }),
  });
  const events = [];
  const result = processActiveEffects(k, events);
  assert.ok(result.food !== undefined, 'food updated');
  assert.ok(result.food < 5000, 'food reduced by blight');
  assert.equal(result.food, 4500, 'blight deals 500 food damage');
  console.log(`Test 5: blight food damage ✓ (food=${result.food})`);
}

// Test 6: plague reduces population and pushes event
{
  const k = makeKingdom({
    population: 10000,
    active_effects: JSON.stringify({ plague: { turns_left: 3 } }),
  });
  const events = [];
  const result = processActiveEffects(k, events);
  assert.ok(result.population < 10000, 'population reduced by plague');
  assert.ok(events.some(e => e.message.includes('Plague') || e.message.includes('plague')), 'plague event generated');
  console.log(`Test 6: plague population damage ✓ (pop=${result.population})`);
}

// Test 7: summon_rats with food_damage_per_turn reduces food
{
  const k = makeKingdom({
    food: 5000,
    active_effects: JSON.stringify({ summon_rats: { turns_left: 2, food_damage_per_turn: 300 } }),
  });
  const events = [];
  const result = processActiveEffects(k, events);
  assert.equal(result.food, 4700, 'rats eat 300 food');
  assert.ok(events.some(e => e.message.includes('rat') || e.message.includes('Rat')), 'rat event generated');
  console.log('Test 7: summon_rats food damage ✓');
}

// Test 8: life_drain_aura reduces population
{
  const k = makeKingdom({
    population: 10000,
    active_effects: JSON.stringify({ life_drain_aura: { turns_left: 2, population_drain: 0.1 } }),
  });
  const events = [];
  const result = processActiveEffects(k, events);
  assert.ok(result.population < 10000, 'life drain reduces population');
  const lost = Math.floor(10000 * 0.1);
  assert.equal(result.population, 10000 - lost, 'correct drain amount');
  console.log(`Test 8: life_drain_aura ✓ (lost=${lost})`);
}

// Test 9: mutate_crops reduces food by percentage
{
  const k = makeKingdom({
    food: 10000,
    active_effects: JSON.stringify({ mutate_crops: { turns_left: 2, food_penalty: 0.3 } }),
  });
  const events = [];
  const result = processActiveEffects(k, events);
  const expected = 10000 - Math.floor(10000 * 0.3);
  assert.equal(result.food, expected, 'mutate_crops removes 30% food');
  console.log(`Test 9: mutate_crops ✓ (food=${result.food})`);
}

// Test 10: command_legion with damage_per_turn reduces fighters
{
  const k = makeKingdom({
    fighters: 500,
    active_effects: JSON.stringify({ command_legion: { turns_left: 2, damage_per_turn: 50 } }),
  });
  const events = [];
  const result = processActiveEffects(k, events);
  assert.equal(result.fighters, 450, 'command_legion removes 50 fighters');
  console.log('Test 10: command_legion friendly fire ✓');
}

// Test 11: conjure_abundance generates food
{
  const k = makeKingdom({
    population: 10000,
    food: 5000,
    active_effects: JSON.stringify({ conjure_abundance: { turns_left: 3 } }),
  });
  const events = [];
  const result = processActiveEffects(k, events);
  const generated = Math.floor(10000 * 0.2);
  assert.equal(result.food, 5000 + generated, 'conjure_abundance generates food');
  assert.ok(events.some(e => e.message.includes('abundance') || e.message.includes('Conjure')), 'abundance event');
  console.log(`Test 11: conjure_abundance ✓ (food=${result.food})`);
}

// Test 12: death_dominion with fighters generates bonus fighters
{
  const k = makeKingdom({
    fighters: 1000,
    active_effects: JSON.stringify({ death_dominion: { turns_left: 3 } }),
  });
  const events = [];
  const result = processActiveEffects(k, events);
  const bonus = Math.floor(1000 * 0.01);
  if (bonus > 0) {
    assert.ok(result.fighters > 1000, 'death_dominion adds fighters');
    console.log(`Test 12: death_dominion ✓ (fighters=${result.fighters})`);
  } else {
    console.log('Test 12: death_dominion SKIPPED (bonus=0 for 1000 fighters)');
  }
}

// Test 13: silence does not apply food/population damage
{
  const k = makeKingdom({
    food: 5000,
    population: 10000,
    active_effects: JSON.stringify({ silence: { turns_left: 3 } }),
  });
  const events = [];
  const result = processActiveEffects(k, events);
  assert.ok(result.food === undefined || result.food === 5000, 'silence does not damage food');
  assert.ok(result.population === undefined || result.population === 10000, 'silence does not damage population');
  console.log('Test 13: silence no-op damage ✓');
}

// Test 14: multiple effects applied in same turn
{
  const k = makeKingdom({
    food: 10000,
    population: 10000,
    active_effects: JSON.stringify({
      blight: { turns_left: 2, damage: 200 },
      plague: { turns_left: 2 },
    }),
  });
  const events = [];
  const result = processActiveEffects(k, events);
  assert.ok(result.food < 10000, 'blight reduced food');
  assert.ok(result.population < 10000, 'plague reduced population');
  assert.ok(events.length >= 1, 'at least one event');
  console.log('Test 14: multiple effects ✓');
}

// Test 15: exported processActiveEffects is a function
{
  assert.equal(typeof processActiveEffects, 'function', 'processActiveEffects is exported as function');
  console.log('Test 15: export is function ✓');
}

console.log('\nAll active-effects tests passed.');
