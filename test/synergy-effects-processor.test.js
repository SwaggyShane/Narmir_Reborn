/**
 * Synergy Effects Processor Tests
 * Verifies active ability effects are correctly applied to game calculations
 */

const assert = require('assert');
const effectsProcessor = require('../game/synergy-effects-processor');

console.log('Testing Synergy Effects Processor\n');

// Test 1: Parse active effects from kingdom
{
  console.log('Test 1: Parse active effects from kingdom');

  const kingdom = {
    turn: 5,
    active_effects: JSON.stringify({
      synergy_benefit: {
        resources: 0.30,
        production: 0.30,
        happiness: 40,
        until_turn: 8,
      },
    }),
  };

  const active = effectsProcessor.getActiveEffects(kingdom);
  assert.ok(active.synergy_benefit, 'Should parse benefit effect');
  assert.strictEqual(active.synergy_benefit.resources, 0.30, 'Resources bonus correct');

  console.log('✓ Active effects parsed correctly\n');
}

// Test 2: Identify expired effects
{
  console.log('Test 2: Identify expired effects');

  const kingdom = {
    turn: 10,
    active_effects: JSON.stringify({
      synergy_benefit: {
        resources: 0.30,
        until_turn: 8, // Expired (turn 8 < turn 10)
      },
      synergy_penalty: {
        all_stats: -0.50,
        until_turn: 12, // Active (turn 12 > turn 10)
      },
    }),
  };

  const expired = effectsProcessor.getExpiredEffects(kingdom);
  assert.ok(expired.includes('synergy_benefit'), 'Benefit should be expired');
  assert.strictEqual(expired.includes('synergy_penalty'), false, 'Penalty should be active');

  console.log('✓ Expiration detected correctly\n');
}

// Test 3: Remove expired effects
{
  console.log('Test 3: Remove expired effects from kingdom');

  const kingdom = {
    turn: 10,
    active_effects: JSON.stringify({
      synergy_benefit: { resources: 0.30, until_turn: 8 },
      synergy_penalty: { all_stats: -0.50, until_turn: 12 },
    }),
  };

  const updated = effectsProcessor.removeExpiredEffects(kingdom);
  const remaining = JSON.parse(updated.active_effects);

  assert.strictEqual(remaining.synergy_benefit, undefined, 'Expired benefit removed');
  assert.ok(remaining.synergy_penalty, 'Active penalty retained');

  console.log('✓ Expired effects removed\n');
}

// Test 4: Get troop boost multiplier
{
  console.log('Test 4: Apply troop boost multiplier');

  const kingdom = {
    turn: 5,
    active_effects: JSON.stringify({
      synergy_troop_boost: {
        troop_damage: 1.0, // +100% damage
        troop_health: 1.0, // +100% health
        until_turn: 9,
      },
    }),
  };

  const damageMult = effectsProcessor.getTroopBoostMultiplier(kingdom, 'damage');
  const healthMult = effectsProcessor.getTroopBoostMultiplier(kingdom, 'health');

  assert.strictEqual(damageMult, 2.0, 'Damage multiplier should be 2.0 (+100%)');
  assert.strictEqual(healthMult, 2.0, 'Health multiplier should be 2.0 (+100%)');

  console.log('✓ Troop boost applied correctly\n');
}

// Test 5: Get benefit multiplier
{
  console.log('Test 5: Apply benefit multiplier');

  const kingdom = {
    turn: 5,
    active_effects: JSON.stringify({
      synergy_benefit: {
        resources: 0.30, // +30% resources
        production: 0.30, // +30% production
        until_turn: 8,
      },
    }),
  };

  const resourcesMult = effectsProcessor.getBenefitMultiplier(kingdom, 'resources');
  const productionMult = effectsProcessor.getBenefitMultiplier(kingdom, 'production');

  assert.strictEqual(resourcesMult, 1.30, 'Resources multiplier should be 1.30 (+30%)');
  assert.strictEqual(productionMult, 1.30, 'Production multiplier should be 1.30 (+30%)');

  console.log('✓ Benefit multiplier applied correctly\n');
}

// Test 6: Get benefit happiness bonus
{
  console.log('Test 6: Apply benefit happiness bonus');

  const kingdom = {
    turn: 5,
    active_effects: JSON.stringify({
      synergy_benefit: {
        happiness: 40,
        until_turn: 8,
      },
    }),
  };

  const happinessBonus = effectsProcessor.getBenefitHappinessBonus(kingdom);
  assert.strictEqual(happinessBonus, 40, 'Happiness bonus should be 40');

  console.log('✓ Happiness bonus applied correctly\n');
}

// Test 7: Get penalty multiplier
{
  console.log('Test 7: Apply penalty multiplier');

  const kingdom = {
    turn: 5,
    active_effects: JSON.stringify({
      synergy_penalty: {
        defense: -0.60, // -60% defense
        food_production: -0.80, // -80% food production
        all_stats: -0.50, // -50% all stats
        until_turn: 10,
      },
    }),
  };

  const defenseMult = effectsProcessor.getPenaltyMultiplier(kingdom, 'defense');
  const foodMult = effectsProcessor.getPenaltyMultiplier(kingdom, 'food_production');
  const allStatsMult = effectsProcessor.getPenaltyMultiplier(kingdom, 'all_stats');

  // Defense: (1.0 - 0.60) * (1.0 - 0.50) = 0.40 * 0.50 = 0.20 (all_stats now accumulates)
  assert.ok(Math.abs(defenseMult - 0.20) < 0.0001, `Defense multiplier should be ~0.20 (includes all_stats), got ${defenseMult}`);
  // Food production: (1.0 - 0.80) * (1.0 - 0.50) = 0.20 * 0.50 = 0.10
  assert.ok(Math.abs(foodMult - 0.10) < 0.0001, `Food production multiplier should be ~0.10 (includes all_stats), got ${foodMult}`);
  // All stats: 1.0 - 0.50 = 0.50
  assert.strictEqual(allStatsMult, 0.50, 'All stats multiplier should be 0.50 (-50%)');

  console.log('✓ Penalty multipliers applied correctly\n');
}

// Test 8: Check if research is locked
{
  console.log('Test 8: Check research lock penalty');

  const kingdom = {
    turn: 5,
    active_effects: JSON.stringify({
      synergy_penalty: {
        research_locked: true,
        until_turn: 26, // 21 days from turn 5
      },
    }),
  };

  const locked = effectsProcessor.isResearchLocked(kingdom);
  assert.strictEqual(locked, true, 'Research should be locked');

  console.log('✓ Research lock detected correctly\n');
}

// Test 9: Apply multiplicative effects to value
{
  console.log('Test 9: Apply multiplicative effects to calculated value');

  const kingdom = {
    turn: 5,
    active_effects: JSON.stringify({
      synergy_benefit: {
        resources: 0.30,
        until_turn: 8,
      },
    }),
  };

  const baseValue = 1000;
  const result = effectsProcessor.applyMultiplicativeEffects(kingdom, baseValue, 'resources');
  // 1000 * 1.30 (benefit) = 1300
  assert.strictEqual(result, 1300, 'Should apply benefit multiplier');

  console.log('✓ Multiplicative effects applied correctly\n');
}

// Test 10: Get combined multiplier
{
  console.log('Test 10: Get combined effect multiplier for stat');

  const kingdom = {
    turn: 5,
    active_effects: JSON.stringify({
      synergy_troop_boost: {
        troop_damage: 1.0, // +100%
        until_turn: 10,
      },
    }),
  };

  const damageMult = effectsProcessor.getCombinedMultiplier(kingdom, 'damage');
  assert.strictEqual(damageMult, 2.0, 'Combined damage multiplier should be 2.0');

  console.log('✓ Combined multiplier calculated correctly\n');
}

// Test 11: No effects active (expired)
{
  console.log('Test 11: No effects when all are expired');

  const kingdom = {
    turn: 100,
    active_effects: JSON.stringify({
      synergy_benefit: {
        resources: 0.30,
        until_turn: 50, // Far expired
      },
    }),
  };

  const active = effectsProcessor.getActiveEffects(kingdom);
  assert.deepStrictEqual(active, {}, 'Should return empty object when no active effects');

  const benefit = effectsProcessor.getBenefitMultiplier(kingdom, 'resources');
  assert.strictEqual(benefit, 1.0, 'Should return 1.0 when no benefit active');

  console.log('✓ Correctly handles no active effects\n');
}

// Test 12: Penalty prevents negative multipliers
{
  console.log('Test 12: Penalty multipliers prevented from going negative');

  const kingdom = {
    turn: 5,
    active_effects: JSON.stringify({
      synergy_penalty: {
        defense: -2.0, // Extreme penalty
        until_turn: 10,
      },
    }),
  };

  const defenseMult = effectsProcessor.getPenaltyMultiplier(kingdom, 'defense');
  assert.ok(defenseMult >= 0, 'Multiplier should never go below 0');
  assert.strictEqual(defenseMult, 0, 'Extreme penalty should result in 0');

  console.log('✓ Penalties clamped to non-negative\n');
}

// Test 13: Stacked benefits and penalties
{
  console.log('Test 13: Stacking multiple benefits and penalties');

  const kingdom = {
    turn: 5,
    active_effects: JSON.stringify({
      synergy_benefit: {
        resources: 0.30,
        production: 0.30,
        until_turn: 8,
      },
      synergy_penalty: {
        food_production: -0.25,
        until_turn: 10,
      },
    }),
  };

  // Food production: 100 * 0.75 (penalty) = 75
  const foodResult = effectsProcessor.applyMultiplicativeEffects(kingdom, 100, 'food_production');
  assert.strictEqual(foodResult, 75, 'Penalty should reduce value');

  console.log('✓ Multiple effects applied correctly\n');
}

// Test 14: Parse broken JSON gracefully
{
  console.log('Test 14: Gracefully handle malformed JSON');

  const kingdom = {
    turn: 5,
    active_effects: 'not valid json {',
  };

  const active = effectsProcessor.getActiveEffects(kingdom);
  assert.deepStrictEqual(active, {}, 'Should return empty object for invalid JSON');

  console.log('✓ Malformed JSON handled gracefully\n');
}

// Test 15: Effects already parsed as objects
{
  console.log('Test 15: Handle pre-parsed active effects object');

  const kingdom = {
    turn: 5,
    active_effects: {
      synergy_benefit: {
        resources: 0.30,
        until_turn: 8,
      },
    },
  };

  const active = effectsProcessor.getActiveEffects(kingdom);
  assert.ok(active.synergy_benefit, 'Should handle already-parsed objects');
  assert.strictEqual(active.synergy_benefit.resources, 0.30, 'Data should be correct');

  console.log('✓ Pre-parsed effects handled correctly\n');
}

// Test 16: Defensive checks for undefined kingdom
{
  console.log('Test 16: Defensive checks prevent crashes on undefined kingdom');

  const active = effectsProcessor.getActiveEffects(undefined);
  assert.deepStrictEqual(active, {}, 'Should return empty object for undefined');

  const expired = effectsProcessor.getExpiredEffects(null);
  assert.deepStrictEqual(expired, [], 'Should return empty array for null');

  const removed = effectsProcessor.removeExpiredEffects(undefined);
  assert.strictEqual(removed, undefined, 'Should return undefined for undefined');

  const mult = effectsProcessor.getPenaltyMultiplier(null, 'defense');
  assert.strictEqual(mult, 1.0, 'Should return 1.0 for null kingdom');

  console.log('✓ Defensive checks prevent crashes\n');
}

// Test 17: all_stats penalty accumulates with specific penalties
{
  console.log('Test 17: all_stats penalty accumulates additively with specific penalties');

  const kingdom = {
    turn: 5,
    active_effects: JSON.stringify({
      synergy_penalty: {
        defense: -0.30, // -30% defense
        all_stats: -0.25, // -25% all stats
        until_turn: 10,
      },
    }),
  };

  const defenseMult = effectsProcessor.getPenaltyMultiplier(kingdom, 'defense');
  // (1.0 - 0.30) * (1.0 - 0.25) = 0.70 * 0.75 = 0.525 (multiplicative accumulation)
  assert.ok(Math.abs(defenseMult - 0.525) < 0.0001, `Defense with all_stats should be ~0.525, got ${defenseMult}`);

  console.log('✓ all_stats penalty accumulates correctly\n');
}

// Test 18: all_stats penalty applies to all stat types
{
  console.log('Test 18: all_stats penalty applies to resources and production');

  const kingdom = {
    turn: 5,
    active_effects: JSON.stringify({
      synergy_benefit: {
        resources: 0.50, // +50% resources
        until_turn: 8,
      },
      synergy_penalty: {
        all_stats: -0.20, // -20% all stats
        until_turn: 10,
      },
    }),
  };

  const resourcesMult = effectsProcessor.getCombinedMultiplier(kingdom, 'resources');
  // 1.0 + 0.50 (benefit) * (1.0 - 0.20) (all_stats penalty) = 1.5 * 0.8 = 1.2
  assert.ok(Math.abs(resourcesMult - 1.2) < 0.0001, `Resources multiplier should be ~1.2, got ${resourcesMult}`);

  console.log('✓ all_stats applies to all stat types\n');
}

// Test 19: all_stats penalty applies to damage and health troop stats
{
  console.log('Test 19: all_stats penalty applies to damage and health');

  const kingdom = {
    turn: 5,
    active_effects: JSON.stringify({
      synergy_troop_boost: {
        troop_damage: 1.0, // +100% damage
        until_turn: 10,
      },
      synergy_penalty: {
        all_stats: -0.25, // -25% all stats
        until_turn: 10,
      },
    }),
  };

  const damageMult = effectsProcessor.getCombinedMultiplier(kingdom, 'damage');
  // (1.0 + 1.0) * (1.0 - 0.25) = 2.0 * 0.75 = 1.5
  assert.ok(Math.abs(damageMult - 1.5) < 0.0001, `Damage multiplier should be ~1.5 (includes all_stats), got ${damageMult}`);

  console.log('✓ all_stats applies to troop stats\n');
}

console.log('✅ All 19 synergy effects processor tests passed!');
