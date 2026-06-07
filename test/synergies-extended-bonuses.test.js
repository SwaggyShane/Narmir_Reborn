/**
 * Phase 4: Extended Synergy Bonuses Tests
 * Verifies additional synergy passive bonuses beyond Phase 3
 */

const assert = require('assert');
const { SYNERGIES } = require('../game/fragment-synergies');

console.log('Testing Phase 4: Extended Synergy Passive Bonuses\n');

// Test 1: Defense bonus in Blessed Citadel synergy
{
  console.log('Test 1: Blessed Citadel defense bonus');
  const synergy = SYNERGIES['blessed-citadel'];
  assert.ok(synergy, 'Blessed Citadel synergy should exist');
  assert.ok(synergy.passive.effects.defense !== undefined, 'Should have defense bonus');
  assert.equal(synergy.passive.effects.defense, 0.35, 'Defense bonus should be +35%');
  console.log('✓ Blessed Citadel: defense +35%\n');
}

// Test 2: Research speed bonus in Arcane Singularity synergy
{
  console.log('Test 2: Arcane Singularity research speed bonus');
  const synergy = SYNERGIES['arcane-singularity'];
  assert.ok(synergy, 'Arcane Singularity synergy should exist');
  assert.ok(synergy.passive.effects.research_speed !== undefined, 'Should have research_speed bonus');
  assert.equal(synergy.passive.effects.research_speed, 0.50, 'Research speed bonus should be +50%');
  console.log('✓ Arcane Singularity: research_speed +50%\n');
}

// Test 3: Combat power bonus in Void Convergence synergy
{
  console.log('Test 3: Void Convergence combat power bonus');
  const synergy = SYNERGIES['void-convergence'];
  assert.ok(synergy, 'Void Convergence synergy should exist');
  assert.ok(synergy.passive.effects.combat_power !== undefined, 'Should have combat_power bonus');
  assert.equal(synergy.passive.effects.combat_power, 0.60, 'Combat power bonus should be +60%');
  console.log('✓ Void Convergence: combat_power +60%\n');
}

// Test 4: Troop capacity bonus in Primordial Awakening synergy
{
  console.log('Test 4: Primordial Awakening troop capacity bonus');
  const synergy = SYNERGIES['primordial-awakening'];
  assert.ok(synergy, 'Primordial Awakening synergy should exist');
  assert.ok(synergy.passive.effects.troop_capacity !== undefined, 'Should have troop_capacity bonus');
  assert.equal(synergy.passive.effects.troop_capacity, 0.40, 'Troop capacity bonus should be +40%');
  console.log('✓ Primordial Awakening: troop_capacity +40%\n');
}

// Test 5: Unit damage bonus in Primordial Awakening synergy
{
  console.log('Test 5: Primordial Awakening unit damage bonus');
  const synergy = SYNERGIES['primordial-awakening'];
  assert.ok(synergy, 'Primordial Awakening synergy should exist');
  assert.ok(synergy.passive.effects.unit_damage !== undefined, 'Should have unit_damage bonus');
  assert.equal(synergy.passive.effects.unit_damage, 0.25, 'Unit damage bonus should be +25%');
  console.log('✓ Primordial Awakening: unit_damage +25%\n');
}

// Test 6: Production speed bonus in Recursive Knowledge synergy
{
  console.log('Test 6: Recursive Knowledge production speed bonus');
  const synergy = SYNERGIES['recursive-knowledge'];
  assert.ok(synergy, 'Recursive Knowledge synergy should exist');
  assert.ok(synergy.passive.effects.production_speed !== undefined, 'Should have production_speed bonus');
  assert.equal(synergy.passive.effects.production_speed, 0.20, 'Production speed bonus should be +20%');
  console.log('✓ Recursive Knowledge: production_speed +20%\n');
}

// Test 7: Entropy Unbound has high combat power but production penalty
{
  console.log('Test 7: Entropy Unbound combat vs production trade-off');
  const synergy = SYNERGIES['entropy-unbound'];
  assert.ok(synergy, 'Entropy Unbound synergy should exist');
  assert.equal(synergy.passive.effects.combat_power, 0.80, 'Combat power should be +80%');
  assert.equal(synergy.passive.effects.production, -0.50, 'Production should be -50%');
  console.log('✓ Entropy Unbound: combat_power +80% vs production -50%\n');
}

// Test 8: Celestial Harmony has universal stat boost
{
  console.log('Test 8: Celestial Harmony universal bonus');
  const synergy = SYNERGIES['celestial-harmony'];
  assert.ok(synergy, 'Celestial Harmony synergy should exist');
  assert.ok(synergy.passive.effects.all_stats !== undefined, 'Should have all_stats bonus');
  assert.equal(synergy.passive.effects.all_stats, 0.15, 'All stats bonus should be +15%');
  console.log('✓ Celestial Harmony: all_stats +15%\n');
}

// Test 9: All synergies have effects object
{
  console.log('Test 9: All synergies have complete effects definitions');
  let synergiesWithAllEffects = 0;

  for (const synergy of Object.values(SYNERGIES)) {
    assert.ok(synergy.passive.effects, `${synergy.name} should have effects`);
    const effectCount = Object.keys(synergy.passive.effects).length;
    assert.ok(effectCount > 0, `${synergy.name} should have at least one effect`);
    synergiesWithAllEffects++;
  }

  assert.equal(synergiesWithAllEffects, 10, 'All 10 synergies should have effects');
  console.log('✓ All synergies have complete effects definitions\n');
}

// Test 10: Verify synergy effects are numeric
{
  console.log('Test 10: All effect values are valid numbers');
  for (const synergy of Object.values(SYNERGIES)) {
    for (const [effectKey, effectValue] of Object.entries(synergy.passive.effects)) {
      assert.ok(typeof effectValue === 'number', `${synergy.name}.${effectKey} should be a number, got ${typeof effectValue}`);
    }
  }
  console.log('✓ All effect values are valid numbers\n');
}

console.log('✅ All 10 Phase 4 extended bonus tests passed!');
