'use strict';
// Unit tests for game/lib/turn-context.js (engine extract S00).
// Run: node test/turn-context.test.js

const assert = require('assert');
const {
  createTurnContext,
  mergeState,
  assignUpdates,
  TURN_JSON_FIELDS,
} = require('../game/lib/turn-context');
const { healKingdomForTurn } = require('../game/lib/healing');

function baseKingdom(overrides = {}) {
  return {
    turn: 42,
    gold: 1000,
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

console.log('turn-context');

test('createTurnContext seeds turn and updated_at', () => {
  const k = baseKingdom({ turn: 10 });
  const before = Math.floor(Date.now() / 1000);
  const ctx = createTurnContext(k, null);
  const after = Math.floor(Date.now() / 1000);
  assert.strictEqual(ctx.updates.turn, 11);
  assert.ok(ctx.updates.updated_at >= before && ctx.updates.updated_at <= after);
  assert.deepStrictEqual(ctx.events, []);
  assert.strictEqual(ctx.db, null);
  assert.strictEqual(ctx.k, k);
});

test('createTurnContext heals JSON string fields onto k in place', () => {
  const k = baseKingdom({
    troop_levels: JSON.stringify({ fighters: { level: 2, xp: 5 } }),
    research_focus: JSON.stringify(['economy']),
  });
  createTurnContext(k, null);
  assert.strictEqual(typeof k.troop_levels, 'object');
  assert.strictEqual(k.troop_levels.fighters.level, 2);
  assert.ok(Array.isArray(k.research_focus));
  assert.strictEqual(k.research_focus[0], 'economy');
});

test('createTurnContext JSON field set matches healKingdomForTurn coverage applied to k', () => {
  const k = baseKingdom();
  const healed = healKingdomForTurn({ ...k });
  createTurnContext(k, null);
  for (const f of TURN_JSON_FIELDS) {
    if (healed[f] !== undefined) {
      assert.deepStrictEqual(
        k[f],
        healed[f],
        `field ${f} should match healKingdomForTurn`,
      );
    }
  }
});

test('mergeState overlays updates on k without mutating k', () => {
  const k = baseKingdom({ gold: 100, turn: 5 });
  const ctx = createTurnContext(k, null);
  ctx.updates.gold = 250;
  const merged = mergeState(ctx);
  assert.strictEqual(merged.gold, 250);
  assert.strictEqual(merged.turn, 6);
  assert.strictEqual(k.gold, 100);
});

test('assignUpdates mutates ctx.updates in place', () => {
  const k = baseKingdom();
  const ctx = createTurnContext(k, null);
  assignUpdates(ctx, { gold: 99, food: 12 });
  assert.strictEqual(ctx.updates.gold, 99);
  assert.strictEqual(ctx.updates.food, 12);
  assert.strictEqual(ctx.updates.turn, 43);
});

test('createTurnContext stores db handle', () => {
  const db = { tag: 'fake-db' };
  const ctx = createTurnContext(baseKingdom(), db);
  assert.strictEqual(ctx.db, db);
});

console.log('turn-context: all passed');
