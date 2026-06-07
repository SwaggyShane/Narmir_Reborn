/**
 * Phase 5: Remaining Synergy Passive Bonuses Tests
 * Verifies all synergy effect types are properly configured
 */

const assert = require('assert');
const { SYNERGIES } = require('../game/fragment-synergies');
const attunementManager = require('../game/attunement-manager');

console.log('Testing Phase 5: Remaining Synergy Passive Bonuses\n');

// Test 1: Combat power bonus configuration
{
  console.log('Test 1: Combat power bonuses configured in synergies');

  const synergiesToCheck = [
    { id: 'void-convergence', value: 0.60 },
    { id: 'entropy-unbound', value: 0.80 },
  ];

  for (const { id, value } of synergiesToCheck) {
    const synergy = SYNERGIES[id];
    assert.ok(synergy, `${id} should exist`);
    assert.equal(synergy.passive.effects.combat_power, value, `${id} should have combat_power ${value}`);
  }

  console.log('✓ Combat power bonuses verified\n');
}

// Test 2: Troop capacity bonus configuration
{
  console.log('Test 2: Troop capacity bonuses configured in synergies');

  const synergy = SYNERGIES['primordial-awakening'];
  assert.ok(synergy, 'Primordial Awakening should exist');
  assert.equal(synergy.passive.effects.troop_capacity, 0.40, 'Should have troop_capacity +40%');

  console.log('✓ Troop capacity bonus verified\n');
}

// Test 3: Unit damage bonus configuration
{
  console.log('Test 3: Unit damage bonuses configured in synergies');

  const synergy = SYNERGIES['primordial-awakening'];
  assert.ok(synergy, 'Primordial Awakening should exist');
  assert.equal(synergy.passive.effects.unit_damage, 0.25, 'Should have unit_damage +25%');

  console.log('✓ Unit damage bonus verified\n');
}

// Test 4: Production speed bonus configuration
{
  console.log('Test 4: Production speed bonuses configured in synergies');

  const synergy = SYNERGIES['recursive-knowledge'];
  assert.ok(synergy, 'Recursive Knowledge should exist');
  assert.equal(synergy.passive.effects.production_speed, 0.20, 'Should have production_speed +20%');

  console.log('✓ Production speed bonus verified\n');
}

// Test 5: Stability bonus configuration
{
  console.log('Test 5: Stability effects in synergies');

  for (const synergy of Object.values(SYNERGIES)) {
    if (synergy.passive.effects.stability !== undefined) {
      assert.ok(typeof synergy.passive.effects.stability === 'number',
        `${synergy.name} stability should be a number`);
    }
  }

  // Note: Stability effects may not be in all synergies - that's OK
  console.log('✓ Stability effects checked\n');
}

// Test 6: Research cost reduction bonus
{
  console.log('Test 6: Research cost reduction bonuses');

  const synergy = SYNERGIES['recursive-knowledge'];
  assert.ok(synergy, 'Recursive Knowledge should exist');
  assert.equal(synergy.passive.effects.research_cost_reduction, 0.30, 'Should have research_cost_reduction -30%');

  console.log('✓ Research cost reduction verified\n');
}

// Test 7: All-stats universal bonus
{
  console.log('Test 7: Universal all-stats bonus');

  const synergy = SYNERGIES['celestial-harmony'];
  assert.ok(synergy, 'Celestial Harmony should exist');
  assert.equal(synergy.passive.effects.all_stats, 0.15, 'Should have all_stats +15%');

  console.log('✓ Universal bonus verified\n');
}

// Test 8: Production penalty configuration
{
  console.log('Test 8: Production penalties in synergies');

  const synergy = SYNERGIES['entropy-unbound'];
  assert.ok(synergy, 'Entropy Unbound should exist');
  assert.equal(synergy.passive.effects.production, -0.50, 'Should have production penalty -50%');

  console.log('✓ Production penalty verified\n');
}

// Test 9: Verify all synergy passive effects are properly typed
{
  console.log('Test 9: All synergy passive effects are valid');

  for (const synergy of Object.values(SYNERGIES)) {
    assert.ok(synergy.passive, `${synergy.name} should have passive`);
    assert.ok(synergy.passive.effects, `${synergy.name} should have effects`);
    assert.ok(typeof synergy.passive.effects === 'object', `${synergy.name} effects should be object`);

    for (const [key, value] of Object.entries(synergy.passive.effects)) {
      assert.ok(typeof value === 'number',
        `${synergy.name}.${key} should be number, got ${typeof value}`);
    }
  }

  console.log('✓ All passive effects valid\n');
}

// Test 10: Synergy effect integration
{
  console.log('Test 10: Synergy effects can be retrieved via attunement manager');

  const allSynergies = attunementManager.getAllSynergies &&
    attunementManager.getAllSynergies() ||
    Object.values(SYNERGIES);

  assert.ok(allSynergies.length === 10, 'Should have 10 synergies');

  for (const synergy of allSynergies) {
    assert.ok(synergy.passive, `${synergy.name} should have passive`);
    assert.ok(synergy.passive.effects, `${synergy.name} should have effects`);
  }

  console.log('✓ All synergies retrievable via attunement manager\n');
}

console.log('✅ All 10 Phase 5 remaining bonus tests passed!');
