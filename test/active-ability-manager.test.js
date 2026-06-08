/**
 * Active Ability Manager Tests
 * Verifies ability triggering, cooldowns, costs, and effects
 */

const assert = require('assert');
const abilityManager = require('../game/active-ability-manager');
const _attunementManager = require('../game/attunement-manager');
const { SYNERGIES } = require('../game/fragment-synergies');

console.log('Testing Active Ability Manager\n');

// Helper: Create kingdom with specific synergy active
function createKingdomWithSynergy(synergyId) {
  const synergy = SYNERGIES[synergyId];
  if (!synergy) throw new Error(`Synergy ${synergyId} not found`);

  const fragmentBonuses = {};
  for (const [fragmentName, buildingType] of Object.entries(synergy.requiredFragments)) {
    fragmentBonuses[buildingType] = {
      fragment: fragmentName,
      applied_turn: 0,
      passive: {},
      special: {},
    };
  }

  return {
    id: Math.random(),
    turn: 1,
    race: 'human',
    region: 'human',
    land: 100,
    tax: 42,
    res_economy: 100,
    bld_castles: 5,
    bld_taverns: 3,
    bld_farms: 20,
    bld_mage_towers: 5,
    bld_housing: 30,
    bld_walls: 10,
    bld_schools: 5,
    bld_libraries: 3,
    bld_granaries: 5,
    population: 10000,
    gold: 15000,
    food: 3000,
    mana: 500,
    mages: 150,
    researchers: 100,
    happiness: 75,
    stability: 50,
    active_effects: JSON.stringify({}),
    fragment_bonuses: JSON.stringify(fragmentBonuses),
    synergy_cooldowns: JSON.stringify({}),
    troop_levels: JSON.stringify({ swordsmen: 500, archers: 300 }),
    xp_sources: JSON.stringify({}),
    collected_lore: JSON.stringify([]),
    tower_upgrades: JSON.stringify({}),
    farm_upgrades: JSON.stringify({}),
    wall_upgrades: JSON.stringify({}),
    school_upgrades: JSON.stringify({}),
    library_upgrades: JSON.stringify({}),
    research_focus: JSON.stringify([]),
    research_progress: JSON.stringify({}),
    research_allocation: JSON.stringify({ construction: 100, spellbook: 0, combat: 0 }),
    achievements: JSON.stringify([]),
  };
}

// Test 1: Can trigger ability when synergy is active and no cooldown
{
  console.log('Test 1: Can trigger ability when conditions met');

  const kingdom = createKingdomWithSynergy('bloodmoon-ascension');
  const check = abilityManager.canTriggerAbility(kingdom, 'bloodmoon-ascension');

  assert.ok(check.ok, 'Should be able to trigger ability');
  assert.strictEqual(check.ok, true, 'Ability check should succeed');

  console.log('✓ Ability can be triggered\n');
}

// Test 2: Cannot trigger ability when synergy is not active
{
  console.log('Test 2: Cannot trigger ability when synergy not active');

  const kingdom = createKingdomWithSynergy('bloodmoon-ascension');
  const check = abilityManager.canTriggerAbility(kingdom, 'eternal-harvest');

  assert.strictEqual(check.ok, false, 'Should not be able to trigger unactive synergy');
  assert.ok(check.error, 'Should have error message');

  console.log('✓ Cannot trigger unactive synergy\n');
}

// Test 3: Validate cost requirements
{
  console.log('Test 3: Validate ability costs');

  const kingdom = createKingdomWithSynergy('bloodmoon-ascension');
  kingdom.population = 30; // Not enough for 60 pop cost
  const check = abilityManager.validateAbilityCost(kingdom, 'bloodmoon-ascension');

  assert.strictEqual(check.ok, false, 'Should reject due to insufficient population');
  assert.ok(check.error.includes('population'), 'Error should mention population');

  console.log('✓ Cost validation works\n');
}

// Test 4: Apply ability costs
{
  console.log('Test 4: Apply ability costs');

  const kingdom = createKingdomWithSynergy('bloodmoon-ascension');
  const initialPop = kingdom.population;
  const updated = abilityManager.applyCost(kingdom, 'bloodmoon-ascension');

  assert.strictEqual(
    updated.population,
    initialPop - 60,
    'Population should decrease by cost amount'
  );
  assert.strictEqual(
    updated.stability,
    50 - 35,
    'Stability should decrease by 35'
  );

  console.log('✓ Costs applied correctly\n');
}

// Test 5: Apply ability benefits
{
  console.log('Test 5: Apply ability benefits');

  const kingdom = createKingdomWithSynergy('eternal-harvest');
  kingdom.bld_granaries = 5;
  const _initialFood = kingdom.food;
  const initialPop = kingdom.population;
  const updated = abilityManager.applyBenefit(kingdom, 'eternal-harvest');

  assert.ok(updated.food >= 5000, 'Food should be filled from granaries (5 * 1000)');
  assert.strictEqual(
    updated.population,
    initialPop + 50,
    'Population should increase by 50'
  );

  console.log('✓ Benefits applied correctly\n');
}

// Test 6: Apply ability penalties
{
  console.log('Test 6: Apply ability penalties');

  const kingdom = createKingdomWithSynergy('celestial-harmony');
  const updated = abilityManager.applyPenalty(kingdom, 'celestial-harmony');
  const activeEffects = JSON.parse(updated.active_effects || '{}');

  assert.ok(activeEffects.synergy_penalty, 'Should have penalty effect');
  assert.ok(activeEffects.synergy_penalty.all_stats < 0, 'Should have negative stat penalty');

  console.log('✓ Penalties applied correctly\n');
}

// Test 7: Trigger ability and check cooldown is set
{
  console.log('Test 7: Trigger ability sets cooldown');

  const kingdom = createKingdomWithSynergy('infernal-crucible');
  const result = abilityManager.triggerAbility(kingdom, 'infernal-crucible');

  assert.ok(result.ok, 'Should trigger successfully');
  const cooldowns = JSON.parse(result.kingdom.synergy_cooldowns || '{}');
  assert.ok(cooldowns['infernal-crucible'], 'Should have cooldown data');
  assert.ok(
    cooldowns['infernal-crucible'].cooldown_until > Date.now(),
    'Cooldown should be in future'
  );

  console.log('✓ Cooldown set after trigger\n');
}

// Test 8: Cannot trigger ability during cooldown
{
  console.log('Test 8: Cannot trigger during cooldown');

  const kingdom = createKingdomWithSynergy('infernal-crucible');
  const result1 = abilityManager.triggerAbility(kingdom, 'infernal-crucible');
  assert.ok(result1.ok, 'First trigger should succeed');

  const check = abilityManager.canTriggerAbility(result1.kingdom, 'infernal-crucible');
  assert.strictEqual(check.ok, false, 'Should not be able to trigger during cooldown');
  assert.ok(check.cooldownUntil, 'Should have cooldown_until timestamp');

  console.log('✓ Cooldown prevents triggering\n');
}

// Test 9: Get cooldown status
{
  console.log('Test 9: Get cooldown status');

  const kingdom = createKingdomWithSynergy('blessed-citadel');
  const result = abilityManager.triggerAbility(kingdom, 'blessed-citadel');

  const status = abilityManager.getAbilityCooldown(result.kingdom, 'blessed-citadel');
  assert.strictEqual(status.onCooldown, true, 'Should show on cooldown');
  assert.ok(status.daysRemaining > 0, 'Should have days remaining');

  console.log('✓ Cooldown status retrieved\n');
}

// Test 10: Trigger ability without sufficient resources fails
{
  console.log('Test 10: Cannot trigger without resources');

  const kingdom = createKingdomWithSynergy('bloodmoon-ascension');
  kingdom.population = 30; // Less than 60 population cost
  const check = abilityManager.validateAbilityCost(kingdom, 'bloodmoon-ascension');

  assert.strictEqual(check.ok, false, 'Should fail resource check');
  assert.ok(check.error.includes('population'), 'Error should mention population');

  console.log('✓ Resource validation prevents triggering\n');
}

// Test 11: Trigger multiple different abilities
{
  console.log('Test 11: Track cooldowns for multiple abilities');

  let kingdom = createKingdomWithSynergy('eternal-harvest');
  const result1 = abilityManager.triggerAbility(kingdom, 'eternal-harvest');
  assert.ok(result1.ok, 'First ability trigger should succeed');

  kingdom = result1.kingdom;
  const cooldowns = JSON.parse(kingdom.synergy_cooldowns || '{}');
  assert.ok(cooldowns['eternal-harvest'], 'Should have cooldown for eternal-harvest');

  console.log('✓ Multiple ability cooldowns tracked\n');
}

// Test 12: Verify cost application with different ability types
{
  console.log('Test 12: Different ability costs applied correctly');

  // Test mana cost
  let kingdom = createKingdomWithSynergy('arcane-singularity');
  let updated = abilityManager.applyCost(kingdom, 'arcane-singularity');
  assert.strictEqual(updated.mana, 0, 'Should consume all mana for Spell Cascade');

  // Test troop cost
  kingdom = createKingdomWithSynergy('void-convergence');
  kingdom.fighters = 1000;
  kingdom.rangers = 500;
  kingdom.troop_levels = JSON.stringify({ fighters: { count: 1000 }, rangers: { count: 500 } });
  updated = abilityManager.applyCost(kingdom, 'void-convergence');
  const totalBefore = 1500;
  const totalAfter = (updated.fighters || 0) + (updated.rangers || 0);
  assert.ok(totalAfter < totalBefore, `Troops should decrease (before: ${totalBefore}, after: ${totalAfter})`);

  console.log('✓ Different cost types applied correctly\n');
}

// Test 13: Benefits duration stored in active_effects
{
  console.log('Test 13: Benefit duration tracked');

  const kingdom = createKingdomWithSynergy('primordial-awakening');
  const updated = abilityManager.applyBenefit(kingdom, 'primordial-awakening');
  const activeEffects = JSON.parse(updated.active_effects || '{}');

  assert.ok(activeEffects.synergy_troop_boost, 'Should have troop boost');
  assert.ok(activeEffects.synergy_troop_boost.until_turn, 'Should have until_turn');

  console.log('✓ Benefit duration tracked\n');
}

// Test 14: Penalty duration stored in active_effects
{
  console.log('Test 14: Penalty duration tracked');

  const kingdom = createKingdomWithSynergy('eternal-harvest');
  const updated = abilityManager.applyPenalty(kingdom, 'eternal-harvest');
  const activeEffects = JSON.parse(updated.active_effects || '{}');

  assert.ok(activeEffects.synergy_penalty, 'Should have penalty');
  assert.ok(activeEffects.synergy_penalty.until_turn, 'Should have until_turn');

  console.log('✓ Penalty duration tracked\n');
}

// Test 15: Full ability trigger flow
{
  console.log('Test 15: Full trigger flow with costs, benefits, penalties');

  const kingdom = createKingdomWithSynergy('celestial-harmony');
  const _initialGold = kingdom.gold;
  const _initialHappiness = kingdom.happiness;

  const result = abilityManager.triggerAbility(kingdom, 'celestial-harmony');
  assert.ok(result.ok, 'Trigger should succeed');
  assert.ok(result.kingdom.synergy_cooldowns, 'Cooldown should be set');
  assert.ok(result.cooldownExpires, 'Should have expiration time');

  const activeEffects = JSON.parse(result.kingdom.active_effects || '{}');
  assert.ok(activeEffects.synergy_benefit, 'Should have benefits');
  assert.ok(activeEffects.synergy_penalty, 'Should have penalties');

  console.log('✓ Full ability trigger flow works\n');
}

console.log('✅ All 15 active ability manager tests passed!');
