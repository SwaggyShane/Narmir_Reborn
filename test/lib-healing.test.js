'use strict';

const assert = require('assert');
const {
  cleanNestedJson,
  healKingdomForTurn,
  ensureObject,
  ensureArray,
  XP_SOURCES_DEFAULT,
  getXpSources
} = require('../game/lib/healing');

// M1-3 Healing module tests (direct execution style like other regression tests)

{
  const nested = JSON.stringify(JSON.stringify({ a: 1, b: 'x' }));
  const result = cleanNestedJson(nested, {}, 'test');
  assert.deepStrictEqual(result, { a: 1, b: 'x' });
  console.log('✓ cleanNestedJson handles double-stringified objects');
}

{
  const nested = JSON.stringify(JSON.stringify([1, 2, 3]));
  const result = cleanNestedJson(nested, [], 'test');
  assert.deepStrictEqual(result, [1, 2, 3]);
  console.log('✓ cleanNestedJson handles double-stringified arrays');
}

{
  const input = {
    troop_levels: JSON.stringify(JSON.stringify({ fighters: { level: 1 } })),
    xp_sources: JSON.stringify(JSON.stringify({ turn: 5 })),
    collected_lore: JSON.stringify(JSON.stringify([101])),
    bank_deposits: JSON.stringify('[]')
  };
  const healed = healKingdomForTurn(input);
  assert.ok(healed.troop_levels && typeof healed.troop_levels === 'object');
  assert.strictEqual(healed.xp_sources.turn, 5);
  assert.deepStrictEqual(healed.collected_lore, [101]);
  assert.deepStrictEqual(healed.bank_deposits, []);
  console.log('✓ healKingdomForTurn heals multiple fields to native types');
}

{
  assert.deepStrictEqual(ensureObject(null), {});
  assert.deepStrictEqual(ensureArray('["a"]'), ['a']);
  console.log('✓ ensureObject and ensureArray work');
}

{
  const bad = JSON.stringify(JSON.stringify({ turn: 42 }));
  const result = getXpSources(bad);
  assert.strictEqual(result.turn, 42);
  assert.ok('combat_win' in XP_SOURCES_DEFAULT);
  console.log('✓ getXpSources and XP_SOURCES_DEFAULT');
}

{
  const input = { gold: 100, troop_levels: '{}' };
  const healed = healKingdomForTurn(input);
  assert.strictEqual(healed.gold, 100);
  console.log('✓ healKingdomForTurn preserves non-JSON fields');
}

console.log('✓ All M1-3 healing module tests passed');
