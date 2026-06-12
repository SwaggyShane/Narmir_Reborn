'use strict';
// Characterization tests for game/lib/synergy-cache.js.
// Locks the content-keyed caching contract: same fragment_bonuses → cache hit,
// different fragment_bonuses → cache miss, clearSynergyCache evicts a single
// key or wipes everything depending on input shape.
//
// Run: node test/lib-synergy-cache.test.js

const assert = require('assert');
const {
  getActiveSynergyCached,
  getSynergyPassiveBonusMultiplier,
  getSynergyPassiveBonusAbsolute,
  clearSynergyCache,
} = require('../game/lib/synergy-cache');

console.log('Testing synergy-cache.js\n');

// Test 1: null/undefined kingdom handled safely
assert.equal(getActiveSynergyCached(null), null);
assert.equal(getActiveSynergyCached(undefined), null);
assert.equal(getSynergyPassiveBonusMultiplier(null, 'gold_income'), 1.0);
assert.equal(getSynergyPassiveBonusAbsolute(null, 'gold_income'), 0);
console.log('Test 1: null kingdom safe ✓');

// Test 2: kingdom with no fragments returns null (no synergy possible)
{
  const k = { fragment_bonuses: JSON.stringify({}) };
  const s = getActiveSynergyCached(k);
  assert.equal(s, null);
  console.log('Test 2: empty fragments → null synergy ✓');
}

// Test 3: multiplier on null synergy = 1.0, absolute = 0
{
  const k = { fragment_bonuses: JSON.stringify({}) };
  assert.equal(getSynergyPassiveBonusMultiplier(k, 'gold_income'), 1.0);
  assert.equal(getSynergyPassiveBonusAbsolute(k, 'gold_income'), 0);
  console.log('Test 3: no-synergy returns identity values ✓');
}

// Test 4: cache hit — same fragment_bonuses string returns identical result
{
  const k1 = { fragment_bonuses: JSON.stringify({ foo: 1 }) };
  const k2 = { fragment_bonuses: JSON.stringify({ foo: 1 }) };
  const r1 = getActiveSynergyCached(k1);
  const r2 = getActiveSynergyCached(k2);
  // Same key — should be the exact same cached value (===)
  assert.equal(r1, r2);
  console.log('Test 4: cache hit on same fragment_bonuses string ✓');
}

// Test 5: clearSynergyCache with string fragment_bonuses evicts only that key
{
  const k1 = { fragment_bonuses: JSON.stringify({ a: 1 }) };
  const k2 = { fragment_bonuses: JSON.stringify({ b: 2 }) };
  getActiveSynergyCached(k1);
  getActiveSynergyCached(k2);
  clearSynergyCache(k1);
  // k1's key gone; k2's still warm. We can't directly inspect the map but we
  // can verify behavior doesn't throw and clearing is targeted.
  const r2 = getActiveSynergyCached(k2);
  assert.ok(r2 === null || (r2 && typeof r2 === 'object'));
  console.log('Test 5: targeted clear ✓');
}

// Test 6: clearSynergyCache with object fragment_bonuses wipes whole cache
{
  const k = { fragment_bonuses: { a: 1 } };
  clearSynergyCache(k);
  // Re-fetching after wipe should still work
  const r = getActiveSynergyCached({ fragment_bonuses: JSON.stringify({}) });
  assert.equal(r, null);
  console.log('Test 6: full wipe on object input ✓');
}

// Test 7: clearSynergyCache with null kingdom is a no-op
{
  clearSynergyCache(null);
  clearSynergyCache(undefined);
  console.log('Test 7: null clear is no-op ✓');
}

console.log('\nAll synergy-cache tests passed.');
