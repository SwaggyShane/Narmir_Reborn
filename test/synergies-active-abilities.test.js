/**
 * Phase 6: Synergy Active Abilities Tests
 * Verifies active ability configurations and mechanics
 */

const assert = require('assert');
const { SYNERGIES } = require('../game/fragment-synergies');
const attunementManager = require('../game/attunement-manager');

console.log('Testing Phase 6: Synergy Active Abilities\n');

// Test 1: All synergies have active abilities configured
{
  console.log('Test 1: All synergies have active abilities');

  for (const synergy of Object.values(SYNERGIES)) {
    assert.ok(synergy.active, `${synergy.name} should have active ability`);
    assert.ok(synergy.active.name, `${synergy.name} active should have name`);
    assert.ok(synergy.active.desc, `${synergy.name} active should have description`);
    assert.ok(synergy.active.cooldown_days !== undefined, `${synergy.name} active should have cooldown_days`);
  }

  console.log('✓ All 10 synergies have active abilities\n');
}

// Test 2: Cooldowns are real-world time (days)
{
  console.log('Test 2: All active abilities use days-based cooldowns');

  for (const synergy of Object.values(SYNERGIES)) {
    assert.ok(typeof synergy.active.cooldown_days === 'number',
      `${synergy.name} cooldown_days should be number`);
    assert.ok(synergy.active.cooldown_days > 0,
      `${synergy.name} cooldown_days should be positive`);
  }

  console.log('✓ All cooldowns are days-based\n');
}

// Test 3: Active abilities have costs or penalties
{
  console.log('Test 3: Active abilities have meaningful costs/penalties');

  let abilitiesWithCosts = 0;

  for (const synergy of Object.values(SYNERGIES)) {
    const hasDirectCost = synergy.active.cost && Object.keys(synergy.active.cost).length > 0;
    const hasPenalty = synergy.active.penalty && Object.keys(synergy.active.penalty).length > 0;
    const hasDurationEffect = synergy.active.penalty_duration_days !== undefined;

    if (hasDirectCost || hasPenalty || hasDurationEffect) {
      abilitiesWithCosts++;
    }
  }

  assert.ok(abilitiesWithCosts === 10, `All 10 synergies should have costs/penalties, found ${abilitiesWithCosts}`);
  console.log('✓ All 10 abilities have costs or penalties\n');
}

// Test 4: Infernal Crucible active ability configuration
{
  console.log('Test 4: Infernal Crucible active ability');

  const synergy = SYNERGIES['infernal-crucible'];
  assert.strictEqual(synergy.active.name, 'Forge of Gods', 'Correct name');
  assert.strictEqual(synergy.active.cooldown_days, 1, 'Cooldown 1 day');
  assert.ok(synergy.active.cost, 'Has cost');
  assert.strictEqual(synergy.active.cost.population_percent, 0.50, 'Costs 50% population');
  assert.strictEqual(synergy.active.cost.stability, -50, 'Reduces stability by 50');

  console.log('✓ Infernal Crucible ability configured correctly\n');
}

// Test 5: Eternal Harvest active ability configuration
{
  console.log('Test 5: Eternal Harvest active ability');

  const synergy = SYNERGIES['eternal-harvest'];
  assert.strictEqual(synergy.active.name, 'Bountiful Year', 'Correct name');
  assert.strictEqual(synergy.active.cooldown_days, 7, 'Cooldown 7 days');
  assert.ok(synergy.active.benefit, 'Has benefit');
  assert.strictEqual(synergy.active.benefit.food_storage_fill, true, 'Fills food storage');
  assert.strictEqual(synergy.active.benefit.population_gain, 50, 'Gains 50 population');
  assert.ok(synergy.active.penalty, 'Has penalty');
  assert.strictEqual(synergy.active.penalty.food_production, -0.80, 'Food production penalty -80%');
  assert.strictEqual(synergy.active.penalty_duration_days, 14, 'Penalty lasts 14 days');

  console.log('✓ Eternal Harvest ability configured correctly\n');
}

// Test 6: Arcane Singularity active ability configuration
{
  console.log('Test 6: Arcane Singularity active ability');

  const synergy = SYNERGIES['arcane-singularity'];
  assert.strictEqual(synergy.active.name, 'Spell Cascade', 'Correct name');
  assert.strictEqual(synergy.active.cooldown_days, 3, 'Cooldown 3 days');
  assert.ok(synergy.active.cost, 'Has cost');
  assert.strictEqual(synergy.active.cost.mana_all, true, 'Costs all mana');

  console.log('✓ Arcane Singularity ability configured correctly\n');
}

// Test 7: Blessed Citadel active ability configuration
{
  console.log('Test 7: Blessed Citadel active ability');

  const synergy = SYNERGIES['blessed-citadel'];
  assert.strictEqual(synergy.active.name, 'Divine Wrath', 'Correct name');
  assert.strictEqual(synergy.active.cooldown_days, 7, 'Cooldown 7 days');
  assert.strictEqual(synergy.active.shield_duration_days, 2, 'Shield lasts 2 days');
  assert.ok(synergy.active.penalty, 'Has penalty after shield');
  assert.strictEqual(synergy.active.penalty.defense, -0.60, 'Defense penalty -60%');

  console.log('✓ Blessed Citadel ability configured correctly\n');
}

// Test 8: Void Convergence active ability configuration
{
  console.log('Test 8: Void Convergence active ability');

  const synergy = SYNERGIES['void-convergence'];
  assert.strictEqual(synergy.active.name, 'Reality Tear', 'Correct name');
  assert.strictEqual(synergy.active.cooldown_days, 5, 'Cooldown 5 days');
  assert.ok(synergy.active.cost, 'Has cost');
  assert.strictEqual(synergy.active.cost.troops_percent, 0.50, 'Costs 50% troops');
  assert.strictEqual(synergy.active.cost.stability, -40, 'Reduces stability by 40');

  console.log('✓ Void Convergence ability configured correctly\n');
}

// Test 9: Primordial Awakening active ability configuration
{
  console.log('Test 9: Primordial Awakening active ability');

  const synergy = SYNERGIES['primordial-awakening'];
  assert.strictEqual(synergy.active.name, 'Colossal Form', 'Correct name');
  assert.strictEqual(synergy.active.cooldown_days, 4, 'Cooldown 4 days');
  assert.ok(synergy.active.benefit, 'Has benefit');
  assert.strictEqual(synergy.active.benefit.troop_damage, 1.0, 'Troop damage +100%');
  assert.strictEqual(synergy.active.benefit_duration_days, 4, 'Benefit lasts 4 days');

  console.log('✓ Primordial Awakening ability configured correctly\n');
}

// Test 10: Bloodmoon Ascension active ability configuration
{
  console.log('Test 10: Bloodmoon Ascension active ability');

  const synergy = SYNERGIES['bloodmoon-ascension'];
  assert.strictEqual(synergy.active.name, 'Life Drain', 'Correct name');
  assert.strictEqual(synergy.active.cooldown_days, 7, 'Cooldown 7 days');
  assert.ok(synergy.active.steal, 'Has steal property');
  assert.strictEqual(synergy.active.steal.gold, 100, 'Steals 100 gold');
  assert.strictEqual(synergy.active.steal.food, 50, 'Steals 50 food');
  assert.strictEqual(synergy.active.steal.mana, 20, 'Steals 20 mana');
  assert.ok(synergy.active.cost, 'Has cost');
  assert.strictEqual(synergy.active.cost.population, 60, 'Costs 60 population');
  assert.strictEqual(synergy.active.cost.stability, -35, 'Reduces stability by 35');

  console.log('✓ Bloodmoon Ascension ability configured correctly\n');
}

// Test 11: Recursive Knowledge active ability configuration
{
  console.log('Test 11: Recursive Knowledge active ability');

  const synergy = SYNERGIES['recursive-knowledge'];
  assert.strictEqual(synergy.active.name, 'Temporal Echo', 'Correct name');
  assert.strictEqual(synergy.active.cooldown_days, 14, 'Cooldown 14 days');
  assert.ok(synergy.active.benefit, 'Has benefit');
  assert.strictEqual(synergy.active.benefit.complete_all_research, true, 'Completes all research');
  assert.ok(synergy.active.penalty, 'Has penalty');
  assert.strictEqual(synergy.active.penalty_duration_days, 21, 'Penalty lasts 21 days');

  console.log('✓ Recursive Knowledge ability configured correctly\n');
}

// Test 12: Celestial Harmony active ability configuration
{
  console.log('Test 12: Celestial Harmony active ability');

  const synergy = SYNERGIES['celestial-harmony'];
  assert.strictEqual(synergy.active.name, 'Cosmic Alignment', 'Correct name');
  assert.strictEqual(synergy.active.cooldown_days, 10, 'Cooldown 10 days');
  assert.ok(synergy.active.benefit, 'Has benefit');
  assert.strictEqual(synergy.active.benefit.resources, 0.30, 'Benefit resources +30%');
  assert.strictEqual(synergy.active.benefit.production, 0.30, 'Benefit production +30%');
  assert.strictEqual(synergy.active.benefit.happiness, 40, 'Benefit happiness +40');
  assert.strictEqual(synergy.active.benefit_duration_days, 3, 'Benefit lasts 3 days');
  assert.ok(synergy.active.penalty, 'Has penalty');
  assert.strictEqual(synergy.active.penalty.all_stats, -0.50, 'Penalty all stats -50%');
  assert.strictEqual(synergy.active.penalty_duration_days, 7, 'Penalty lasts 7 days');

  console.log('✓ Celestial Harmony ability configured correctly\n');
}

// Test 13: Entropy Unbound active ability configuration
{
  console.log('Test 13: Entropy Unbound active ability');

  const synergy = SYNERGIES['entropy-unbound'];
  assert.strictEqual(synergy.active.name, 'Cataclysm', 'Correct name');
  assert.strictEqual(synergy.active.cooldown_days, 14, 'Cooldown 14 days');
  assert.ok(synergy.active.devastation_radius, 'Has devastation radius');
  assert.strictEqual(synergy.active.devastation_radius, 2, 'Radius is 2 territories');
  assert.ok(synergy.active.cost, 'Has cost');
  assert.strictEqual(synergy.active.cost.stability, -80, 'Stability cost -80');

  console.log('✓ Entropy Unbound ability configured correctly\n');
}

// Test 14: Verify all active abilities are retrievable
{
  console.log('Test 14: All active abilities accessible');

  const allSynergies = attunementManager.getAllSynergies();
  assert.strictEqual(allSynergies.length, 10, 'Should have 10 synergies');

  for (const synergy of allSynergies) {
    assert.ok(synergy.active, `${synergy.name} should have active ability`);
    assert.ok(synergy.active.name, `${synergy.name} active should have name`);
  }

  console.log('✓ All active abilities accessible\n');
}

// Test 15: Active abilities have meaningful mechanics
{
  console.log('Test 15: Active abilities have comprehensive mechanics');

  let abilitiesWithBenefits = 0;
  let abilitiesWithCosts = 0;
  let abilitiesWithPenalties = 0;

  for (const synergy of Object.values(SYNERGIES)) {
    if (synergy.active.benefit) abilitiesWithBenefits++;
    if (synergy.active.cost) abilitiesWithCosts++;
    if (synergy.active.penalty) abilitiesWithPenalties++;
  }

  assert.ok(abilitiesWithBenefits > 0, 'Some abilities should have benefits');
  assert.ok(abilitiesWithCosts > 0, 'Some abilities should have costs');
  assert.ok(abilitiesWithPenalties > 0, 'Some abilities should have penalties');

  console.log(`✓ Found ${abilitiesWithBenefits} with benefits, ${abilitiesWithCosts} with costs, ${abilitiesWithPenalties} with penalties\n`);
}

console.log('✅ All 15 Phase 6 active ability tests passed!');
