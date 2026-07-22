'use strict';
// Unit tests for game/lib/turn-finalize.js (engine extract S09).
// Run: node test/turn-finalize.test.js

const assert = require('assert');
const { createTurnContext } = require('../game/lib/turn-context');
const { finalizeTurn } = require('../game/lib/turn-finalize');

function fakeProfiler() {
  return {
    end: () => ({ summary: { profileNeeded: null }, jsonOperations: { totalTime: 0 }, synergyLookups: 0 }),
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

console.log('turn-finalize');

test('finalizeTurn adds end-of-turn gold event and last_turn_at', () => {
  const k = {
    turn: 10,
    gold: 1000,
    race: 'human',
    xp: 0,
    level: 1,
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
  };
  const ctx = createTurnContext(k, null);
  ctx.updates.gold = 1200;
  const result = finalizeTurn(ctx, fakeProfiler());
  assert.ok(result.updates.last_turn_at);
  assert.ok(result.events.some((e) => e.message && e.message.includes('End of Turn')));
  assert.ok(result._profileReport);
});

test('finalizeTurn cleans xp_sources_updated temp field', () => {
  const k = {
    turn: 1,
    gold: 100,
    race: 'human',
    xp: 0,
    level: 1,
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
  };
  const ctx = createTurnContext(k, null);
  ctx.updates.xp_sources_updated = { turn: 1 };
  const result = finalizeTurn(ctx, fakeProfiler());
  assert.strictEqual(result.updates.xp_sources_updated, undefined);
});

console.log('turn-finalize: all passed');
