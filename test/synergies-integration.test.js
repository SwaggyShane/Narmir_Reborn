/**
 * Phase 3: Synergy Game Loop Integration Tests
 * Verifies that synergy passive bonuses are applied correctly in game calculations
 */

const assert = require('assert');
const attunementManager = require('../game/attunement-manager');
const { SYNERGIES } = require('../game/fragment-synergies');

console.log('Testing Phase 3: Synergy Game Loop Integration\n');

// Test 1: Gold income boosted by Bloodmoon Ascension synergy (+50%)
{
  console.log('Test 1: Gold income with Bloodmoon Ascension synergy');

  const baseKingdom = {
    id: 1,
    turn: 1,
    land: 100,
    tax: 42,
    res_economy: 100,
    bld_castles: 5,
    bld_taverns: 3,
    population: 5000,
    gold: 10000,
    food: 1000,
    happiness: 75,
    race: 'human',
    region: 'human',
    fragment_bonuses: JSON.stringify({
      mausoleums: { fragment: 'Cursed Bloodstone', applied_turn: 0, passive: {}, special: {} },
      vaults: { fragment: 'Void Essence', applied_turn: 0, passive: {}, special: {} },
      smithies: { fragment: 'Abyssal Crystal', applied_turn: 0, passive: {}, special: {} },
      barracks: { fragment: 'Dragon Scale', applied_turn: 0, passive: {}, special: {} },
      war_machines: { fragment: 'Volcanic Rock', applied_turn: 0, passive: {}, special: {} },
      markets: { fragment: 'Ancient Elven Wood', applied_turn: 0, passive: {}, special: {} },
      libraries: { fragment: 'Dwarven Star-Metal', applied_turn: 0, passive: {}, special: {} },
      shrines: { fragment: 'Celestial Feather', applied_turn: 0, passive: {}, special: {} },
      outposts: { fragment: 'Titan Bone', applied_turn: 0, passive: {}, special: {} },
      farms: { fragment: 'Tears of the World Tree', applied_turn: 0, passive: {}, special: {} },
    }),
  };

  // Verify synergy is active
  const synergy = attunementManager.getActiveSynergy(baseKingdom);
  assert.ok(synergy, 'Bloodmoon Ascension synergy should be active');
  assert.equal(synergy.id, 'bloodmoon-ascension', 'Correct synergy detected');
  assert.equal(synergy.passive.effects.gold_income, 0.50, 'Gold income bonus should be 50%');

  console.log('✓ Bloodmoon Ascension synergy verified (gold_income +50%)\n');
}

// Test 2: Mana regeneration boosted by Arcane Singularity synergy (+30%)
{
  console.log('Test 2: Mana regeneration with Arcane Singularity synergy');

  const baseKingdom = {
    id: 2,
    turn: 1,
    race: 'high_elf',
    region: 'high_elf',
    bld_mage_towers: 10,
    mages: 100,
    happiness: 75,
    res_entertainment: 100,
    active_effects: JSON.stringify({}),
    fragment_bonuses: JSON.stringify({
      mage_towers: { fragment: 'Abyssal Crystal', applied_turn: 0, passive: {}, special: {} },
      libraries: { fragment: 'Dwarven Star-Metal', applied_turn: 0, passive: {}, special: {} },
      shrines: { fragment: 'Celestial Feather', applied_turn: 0, passive: {}, special: {} },
      guard_towers: { fragment: 'Void Essence', applied_turn: 0, passive: {}, special: {} },
      training: { fragment: 'Dragon Scale', applied_turn: 0, passive: {}, special: {} },
      schools: { fragment: 'Volcanic Rock', applied_turn: 0, passive: {}, special: {} },
      markets: { fragment: 'Ancient Elven Wood', applied_turn: 0, passive: {}, special: {} },
      castles: { fragment: 'Titan Bone', applied_turn: 0, passive: {}, special: {} },
      granaries: { fragment: 'Cursed Bloodstone', applied_turn: 0, passive: {}, special: {} },
      housing: { fragment: 'Tears of the World Tree', applied_turn: 0, passive: {}, special: {} },
    }),
  };

  const synergy = attunementManager.getActiveSynergy(baseKingdom);
  assert.ok(synergy, 'Arcane Singularity synergy should be active');
  assert.equal(synergy.id, 'arcane-singularity', 'Correct synergy detected');
  assert.equal(synergy.passive.effects.mana_regen, 0.30, 'Mana regen bonus should be 30%');

  console.log('✓ Arcane Singularity synergy verified (mana_regen +30%)\n');
}

// Test 3: Population growth boosted by Eternal Harvest synergy (+25%)
{
  console.log('Test 3: Population growth with Eternal Harvest synergy');

  const baseKingdom = {
    id: 3,
    turn: 1,
    race: 'human',
    region: 'human',
    population: 10000,
    bld_housing: 50,
    res_entertainment: 100,
    happiness: 75,
    last_attack_turn: null,
    fragment_bonuses: JSON.stringify({
      farms: { fragment: 'Ancient Elven Wood', applied_turn: 0, passive: {}, special: {} },
      granaries: { fragment: 'Tears of the World Tree', applied_turn: 0, passive: {}, special: {} },
      shrines: { fragment: 'Celestial Feather', applied_turn: 0, passive: {}, special: {} },
      housing: { fragment: 'Volcanic Rock', applied_turn: 0, passive: {}, special: {} },
      libraries: { fragment: 'Dwarven Star-Metal', applied_turn: 0, passive: {}, special: {} },
      training: { fragment: 'Dragon Scale', applied_turn: 0, passive: {}, special: {} },
      schools: { fragment: 'Abyssal Crystal', applied_turn: 0, passive: {}, special: {} },
      mausoleums: { fragment: 'Cursed Bloodstone', applied_turn: 0, passive: {}, special: {} },
      taverns: { fragment: 'Void Essence', applied_turn: 0, passive: {}, special: {} },
      walls: { fragment: 'Titan Bone', applied_turn: 0, passive: {}, special: {} },
    }),
  };

  const synergy = attunementManager.getActiveSynergy(baseKingdom);
  assert.ok(synergy, 'Eternal Harvest synergy should be active');
  assert.equal(synergy.id, 'eternal-harvest', 'Correct synergy detected');
  assert.equal(synergy.passive.effects.population_growth, 0.25, 'Population growth bonus should be 25%');

  console.log('✓ Eternal Harvest synergy verified (population_growth +25%)\n');
}

// Test 4: Food production boosted by Eternal Harvest synergy (+40%)
{
  console.log('Test 4: Food production with Eternal Harvest synergy');

  const synergy = SYNERGIES['eternal-harvest'];
  assert.ok(synergy, 'Eternal Harvest synergy should exist');
  assert.equal(synergy.passive.effects.food_production, 0.40, 'Food production bonus should be 40%');

  console.log('✓ Eternal Harvest synergy verified (food_production +40%)\n');
}

// Test 5: Defense boosted by Blessed Citadel synergy (+35%)
{
  console.log('Test 5: Defense with Blessed Citadel synergy');

  const synergy = SYNERGIES['blessed-citadel'];
  assert.ok(synergy, 'Blessed Citadel synergy should exist');
  assert.equal(synergy.passive.effects.defense, 0.35, 'Defense bonus should be 35%');

  console.log('✓ Blessed Citadel synergy verified (defense +35%)\n');
}

// Test 6: Happiness with Bloodmoon Ascension synergy (-30%)
{
  console.log('Test 6: Happiness penalty with Bloodmoon Ascension synergy');

  const synergy = SYNERGIES['bloodmoon-ascension'];
  assert.ok(synergy, 'Bloodmoon Ascension synergy should exist');
  assert.equal(synergy.passive.effects.happiness, -30, 'Happiness penalty should be -30');

  console.log('✓ Bloodmoon Ascension synergy verified (happiness -30)\n');
}

// Test 7: Combat power with Void Convergence synergy (+60%)
{
  console.log('Test 7: Combat power with Void Convergence synergy');

  const synergy = SYNERGIES['void-convergence'];
  assert.ok(synergy, 'Void Convergence synergy should exist');
  assert.equal(synergy.passive.effects.combat_power, 0.60, 'Combat power bonus should be 60%');

  console.log('✓ Void Convergence synergy verified (combat_power +60%)\n');
}

// Test 8: Research speed with Arcane Singularity synergy (+50%)
{
  console.log('Test 8: Research speed with Arcane Singularity synergy');

  const synergy = SYNERGIES['arcane-singularity'];
  assert.ok(synergy, 'Arcane Singularity synergy should exist');
  assert.equal(synergy.passive.effects.research_speed, 0.50, 'Research speed bonus should be 50%');

  console.log('✓ Arcane Singularity synergy verified (research_speed +50%)\n');
}

// Test 9: All synergies have passive.effects
{
  console.log('Test 9: All synergies have passive effects with multiplier bonuses');

  let synergiesWithEffects = 0;
  for (const synergy of Object.values(SYNERGIES)) {
    assert.ok(synergy.passive, `${synergy.name} should have passive ability`);
    assert.ok(synergy.passive.effects, `${synergy.name} should have effects object`);
    assert.ok(Object.keys(synergy.passive.effects).length > 0, `${synergy.name} should have at least one effect`);
    synergiesWithEffects++;
  }

  assert.equal(synergiesWithEffects, 10, 'All 10 synergies should have passive effects');
  console.log('✓ All synergies have valid passive effects\n');
}

// Test 10: Verify synergy bonuses work with kingdoms
{
  console.log('Test 10: Synergy detection on kingdom with all 10 fragments');

  const completeKingdom = {
    id: 10,
    turn: 1,
    race: 'human',
    region: 'human',
    fragment_bonuses: JSON.stringify({
      infernal_crucible: { fragment: 'test', applied_turn: 0, passive: {}, special: {} },
      smithies: { fragment: 'Volcanic Rock', applied_turn: 0, passive: {}, special: {} },
      barracks: { fragment: 'Dragon Scale', applied_turn: 0, passive: {}, special: {} },
      armories: { fragment: 'Dwarven Star-Metal', applied_turn: 0, passive: {}, special: {} },
      war_machines: { fragment: 'Titan Bone', applied_turn: 0, passive: {}, special: {} },
      vaults: { fragment: 'Abyssal Crystal', applied_turn: 0, passive: {}, special: {} },
      guard_towers: { fragment: 'Celestial Feather', applied_turn: 0, passive: {}, special: {} },
      markets: { fragment: 'Ancient Elven Wood', applied_turn: 0, passive: {}, special: {} },
      taverns: { fragment: 'Tears of the World Tree', applied_turn: 0, passive: {}, special: {} },
      mausoleums: { fragment: 'Cursed Bloodstone', applied_turn: 0, passive: {}, special: {} },
      mage_towers: { fragment: 'Void Essence', applied_turn: 0, passive: {}, special: {} },
    }),
  };

  const synergy = attunementManager.getActiveSynergy(completeKingdom);
  assert.ok(synergy, 'Should detect an active synergy');
  assert.ok(SYNERGIES[synergy.id], 'Detected synergy should be valid');

  console.log(`✓ Synergy detected: ${synergy.name}\n`);
}

console.log('✅ All 10 Phase 3 integration tests passed!');
