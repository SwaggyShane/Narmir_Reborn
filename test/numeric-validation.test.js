'use strict';
// Numeric validation tests
// Ensures numeric inputs (troops, gold, research, builds) are validated to prevent exploits.
// Run: node test/numeric-validation.test.js

const assert = require('assert');
const {
  validatePositiveInteger,
  validateNonNegativeInteger,
  validateTroopAmount,
  validateResearchAmount,
  validateQueueAmount,
  validateAllocationAmount,
  validateGoldAmount,
  validateAllocationObject,
  MAX_TROOPS,
} = require('../utils/numeric-validation');

console.log('Testing numeric-validation.js\n');

// Test 1: validatePositiveInteger accepts valid values
{
  const result = validatePositiveInteger(100);
  assert.ok(result.valid, 'should accept 100');
  assert.equal(result.value, 100, 'value should be 100');
  console.log('Test 1: validatePositiveInteger accepts valid values ✓');
}

// Test 2: validatePositiveInteger rejects zero
{
  const result = validatePositiveInteger(0);
  assert.ok(!result.valid, 'should reject 0');
  assert.ok(result.error.includes('at least 1'), 'error should mention minimum');
  console.log('Test 2: validatePositiveInteger rejects zero ✓');
}

// Test 3: validatePositiveInteger rejects non-integers
{
  const result = validatePositiveInteger(10.5);
  assert.ok(!result.valid, 'should reject 10.5');
  assert.ok(result.error.includes('integer'), 'error should mention integer');
  console.log('Test 3: validatePositiveInteger rejects non-integers ✓');
}

// Test 4: validatePositiveInteger rejects NaN
{
  const result = validatePositiveInteger(NaN);
  assert.ok(!result.valid, 'should reject NaN');
  console.log('Test 4: validatePositiveInteger rejects NaN ✓');
}

// Test 5: validatePositiveInteger rejects Infinity
{
  const result = validatePositiveInteger(Infinity);
  assert.ok(!result.valid, 'should reject Infinity');
  console.log('Test 5: validatePositiveInteger rejects Infinity ✓');
}

// Test 6: validatePositiveInteger accepts string numbers
{
  const result = validatePositiveInteger('100');
  assert.ok(result.valid, 'should accept "100"');
  assert.equal(result.value, 100, 'should coerce to number');
  console.log('Test 6: validatePositiveInteger accepts string numbers ✓');
}

// Test 7: validateNonNegativeInteger accepts zero
{
  const result = validateNonNegativeInteger(0);
  assert.ok(result.valid, 'should accept 0');
  assert.equal(result.value, 0, 'value should be 0');
  console.log('Test 7: validateNonNegativeInteger accepts zero ✓');
}

// Test 8: validateNonNegativeInteger rejects negative
{
  const result = validateNonNegativeInteger(-1);
  assert.ok(!result.valid, 'should reject -1');
  console.log('Test 8: validateNonNegativeInteger rejects negative ✓');
}

// Test 9: validateTroopAmount accepts valid values
{
  const result = validateTroopAmount(500);
  assert.ok(result.valid, 'should accept 500 troops');
  assert.equal(result.value, 500, 'value should be 500');
  console.log('Test 9: validateTroopAmount accepts valid values ✓');
}

// Test 10: validateTroopAmount rejects zero
{
  const result = validateTroopAmount(0);
  assert.ok(!result.valid, 'should reject 0 troops');
  console.log('Test 10: validateTroopAmount rejects zero ✓');
}

// Test 10b: validateResearchAmount accepts valid values
{
  const result = validateResearchAmount(200);
  assert.ok(result.valid, 'should accept 200 researchers');
  assert.equal(result.value, 200, 'value should be 200');
  console.log('Test 10b: validateResearchAmount accepts valid values ✓');
}

// Test 10c: validateResearchAmount rejects zero
{
  const result = validateResearchAmount(0);
  assert.ok(!result.valid, 'should reject 0 researchers');
  console.log('Test 10c: validateResearchAmount rejects zero ✓');
}

// Test 10d: validateQueueAmount accepts valid values
{
  const result = validateQueueAmount(50);
  assert.ok(result.valid, 'should accept 50 in queue');
  assert.equal(result.value, 50, 'value should be 50');
  console.log('Test 10d: validateQueueAmount accepts valid values ✓');
}

// Test 10e: validateQueueAmount has lower max than troops
{
  const result = validateQueueAmount(10001);
  assert.ok(!result.valid, 'should reject amount exceeding queue max');
  console.log('Test 10e: validateQueueAmount enforces queue max ✓');
}

// Test 10f: MAX_TROOPS constant is defined
{
  assert.ok(MAX_TROOPS > 0, 'MAX_TROOPS should be positive');
  assert.ok(Number.isInteger(MAX_TROOPS), 'MAX_TROOPS should be an integer');
  console.log(`Test 10f: MAX_TROOPS constant defined (${MAX_TROOPS}) ✓`);
}

// Test 11: validateAllocationAmount accepts zero
{
  const result = validateAllocationAmount(0);
  assert.ok(result.valid, 'should accept 0 allocation');
  console.log('Test 11: validateAllocationAmount accepts zero ✓');
}

// Test 12: validateAllocationAmount rejects negative
{
  const result = validateAllocationAmount(-1);
  assert.ok(!result.valid, 'should reject -1');
  console.log('Test 12: validateAllocationAmount rejects negative ✓');
}

// Test 13: validateAllocationObject accepts valid allocations
{
  const allocation = { fighters: 100, rangers: 50 };
  const result = validateAllocationObject(allocation, {
    validKeys: ['fighters', 'rangers', 'clerics'],
  });
  assert.ok(result.valid, 'should accept valid allocation');
  assert.deepEqual(result.values, allocation, 'values should match');
  assert.equal(result.total, 150, 'total should be 150');
  console.log('Test 13: validateAllocationObject accepts valid allocations ✓');
}

// Test 14: validateAllocationObject rejects invalid keys
{
  const allocation = { fighters: 100, invalid_unit: 50 };
  const result = validateAllocationObject(allocation, {
    validKeys: ['fighters', 'rangers'],
  });
  assert.ok(!result.valid, 'should reject invalid key');
  assert.ok(result.error.includes('Invalid'), 'error should mention invalid key');
  console.log('Test 14: validateAllocationObject rejects invalid keys ✓');
}

// Test 15: validateAllocationObject filters zero values
{
  const allocation = { fighters: 100, rangers: 0, clerics: 50 };
  const result = validateAllocationObject(allocation);
  assert.ok(result.valid, 'should accept allocation with zeros');
  assert.deepEqual(result.values, { fighters: 100, clerics: 50 }, 'should filter zeros');
  assert.equal(result.total, 150, 'total should exclude zeros');
  console.log('Test 15: validateAllocationObject filters zero values ✓');
}

// Test 16: validateAllocationObject enforces per-item max
{
  const allocation = { fighters: 10001 };
  const result = validateAllocationObject(allocation, { maxPerItem: 10000 });
  assert.ok(!result.valid, 'should reject exceeding per-item max');
  assert.ok(result.error.includes('exceeds maximum'), 'error should mention max');
  console.log('Test 16: validateAllocationObject enforces per-item max ✓');
}

// Test 17: validateAllocationObject enforces total max
{
  const allocation = { fighters: 6000, rangers: 5000 };
  const result = validateAllocationObject(allocation, { maxTotal: 10000 });
  assert.ok(!result.valid, 'should reject exceeding total max');
  assert.ok(result.error.includes('total exceeds'), 'error should mention total');
  console.log('Test 17: validateAllocationObject enforces total max ✓');
}

// Test 18: validateAllocationObject rejects non-objects
{
  const result1 = validateAllocationObject('not an object');
  const result2 = validateAllocationObject([1, 2, 3]);
  const result3 = validateAllocationObject(null);
  assert.ok(!result1.valid, 'should reject string');
  assert.ok(!result2.valid, 'should reject array');
  assert.ok(!result3.valid, 'should reject null');
  console.log('Test 18: validateAllocationObject rejects non-objects ✓');
}

// Test 19: validateAllocationObject rejects non-integer values
{
  const allocation = { fighters: 50.5 };
  const result = validateAllocationObject(allocation);
  assert.ok(!result.valid, 'should reject float');
  assert.ok(result.error.includes('integer'), 'error should mention integer');
  console.log('Test 19: validateAllocationObject rejects non-integer values ✓');
}

// Test 20: validateGoldAmount accepts positive gold
{
  const result = validateGoldAmount(1000);
  assert.ok(result.valid, 'should accept positive gold');
  console.log('Test 20: validateGoldAmount accepts positive gold ✓');
}

// Test 21: validateGoldAmount rejects zero by default
{
  const result = validateGoldAmount(0);
  assert.ok(!result.valid, 'should reject 0 gold');
  console.log('Test 21: validateGoldAmount rejects zero by default ✓');
}

// Test 22: validateGoldAmount accepts zero when allowZero=true
{
  const result = validateGoldAmount(0, { allowZero: true });
  assert.ok(result.valid, 'should accept 0 when allowZero=true');
  console.log('Test 22: validateGoldAmount accepts zero when allowZero=true ✓');
}

// Test 23: validatePositiveInteger rejects insecure type coercions
{
  const resultBoolTrue = validatePositiveInteger(true);
  const resultBoolFalse = validatePositiveInteger(false);
  const resultArray = validatePositiveInteger([10]);
  const resultEmptyStr = validatePositiveInteger('');
  const resultWhitespace = validatePositiveInteger('   ');
  assert.ok(!resultBoolTrue.valid, 'should reject true');
  assert.ok(!resultBoolFalse.valid, 'should reject false');
  assert.ok(!resultArray.valid, 'should reject [10]');
  assert.ok(!resultEmptyStr.valid, 'should reject empty string');
  assert.ok(!resultWhitespace.valid, 'should reject whitespace string');
  console.log('Test 23: validatePositiveInteger rejects insecure type coercions ✓');
}

// Test 24: validateAllocationObject rejects insecure type coercions
{
  const allocation = { fighters: true, rangers: [10], clerics: '' };
  const result = validateAllocationObject(allocation);
  assert.ok(!result.valid, 'should reject invalid types in allocation');
  console.log('Test 24: validateAllocationObject rejects insecure type coercions ✓');
}

console.log('\nAll 30 numeric validation tests passed.');
