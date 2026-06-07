'use strict';
const assert = require('assert');
const synergiesModule = require('../game/fragment-synergies');
const fragmentBonusManager = require('../game/fragment-bonus-manager');

// Test 1: Synergy Registry - All 10 synergies defined
console.log('Test 1: Synergy Registry');
const synergies = synergiesModule.getAllSynergies();
assert.equal(synergies.length, 10, '10 synergies exist');

const ids = synergies.map(s => s.id);
const expectedIds = [
  'infernal-forge',
  'natures-bounty',
  'arcane-nexus',
  'divine-ascension',
  'cosmic-chaos',
  'primordial-might',
  'bloodmoon-ritual',
  'eternal-recursion',
  'stellar-harmony',
  'void-touched-ascendancy',
];

expectedIds.forEach(id => {
  assert.ok(ids.includes(id), `Synergy ${id} exists`);
});
console.log('✓ All 10 synergies defined\n');

// Test 2: Synergy Detection - Infernal Forge
console.log('Test 2: Infernal Forge detection');
const kingdom1 = {
  fragment_bonuses: JSON.stringify({
    smithies: { fragment: 'Volcanic Rock', passive: {} },
    training: { fragment: 'Dragon Scale', passive: {} },
    barracks: { fragment: 'Dragon Scale', passive: {} },
  }),
};

const active1 = synergiesModule.getActiveSynergy(kingdom1);
assert.ok(active1, 'Synergy activates with required fragments');
assert.equal(active1.id, 'infernal-forge', 'Correct synergy detected');
console.log('✓ Infernal Forge synergy detected\n');

// Test 3: Synergy Detection - Nature's Bounty
console.log('Test 3: Nature\'s Bounty detection');
const kingdom2 = {
  fragment_bonuses: JSON.stringify({
    farms: { fragment: 'Ancient Elven Wood', passive: {} },
    granaries: { fragment: 'Tears of the World Tree', passive: {} },
    shrines: { fragment: 'Ancient Elven Wood', passive: {} },
  }),
};

const active2 = synergiesModule.getActiveSynergy(kingdom2);
assert.ok(active2, 'Synergy activates with required fragments');
assert.equal(active2.id, 'natures-bounty', 'Correct synergy detected');
console.log('✓ Nature\'s Bounty synergy detected\n');

// Test 4: Synergy Detection - No synergy without all fragments
console.log('Test 4: No synergy without all fragments');
const kingdom3 = {
  fragment_bonuses: JSON.stringify({
    smithies: { fragment: 'Volcanic Rock', passive: {} },
  }),
};

const active3 = synergiesModule.getActiveSynergy(kingdom3);
assert.ok(!active3, 'No synergy without all required fragments');
console.log('✓ No synergy without complete fragment set\n');

// Test 5: Synergy Hints - Near Activation
console.log('Test 5: Near Activation Detection');
const kingdom4 = {
  fragment_bonuses: JSON.stringify({
    smithies: { fragment: 'Volcanic Rock', passive: {} },
    training: { fragment: 'Dragon Scale', passive: {} },
  }),
};

const synergy5 = synergiesModule.getSynergy('infernal-forge');
const isNear = synergiesModule.isNearSynergyActivation(kingdom4, synergy5);
assert.ok(isNear, 'Synergy is near activation when missing 1 building');
console.log('✓ Near activation detection works\n');

// Test 6: Synergy Bonuses - Infernal Forge multipliers
console.log('Test 6: Infernal Forge Bonuses');
const synergy6 = synergiesModule.getSynergy('infernal-forge');

const smithyBonus = synergiesModule.getSynergyBonusMultiplier(synergy6, 'smithies');
assert.equal(smithyBonus.quality, 0.75, 'Smithies get +75% quality bonus');
assert.equal(smithyBonus.production, 0.50, 'Smithies get +50% production bonus');

const trainingBonus = synergiesModule.getSynergyBonusMultiplier(synergy6, 'training');
assert.equal(trainingBonus.speed, 1.0, 'Training gets +100% speed bonus');
console.log('✓ Synergy bonus multipliers correct\n');

// Test 7: Synergy Bonuses - Bloodmoon Ritual (any 5 buildings)
console.log('Test 7: Bloodmoon Ritual (5 buildings)');
const kingdom7 = {
  fragment_bonuses: JSON.stringify({
    smithies: { fragment: 'Cursed Bloodstone', passive: {} },
    training: { fragment: 'Void Essence', passive: {} },
    barracks: { fragment: 'Cursed Bloodstone', passive: {} },
    farms: { fragment: 'Void Essence', passive: {} },
    granaries: { fragment: 'Cursed Bloodstone', passive: {} },
  }),
};

const active7 = synergiesModule.getActiveSynergy(kingdom7);
assert.ok(active7, 'Bloodmoon Ritual activates with 5 buildings attuned');
assert.equal(active7.id, 'bloodmoon-ritual', 'Correct synergy detected');
console.log('✓ Bloodmoon Ritual (5 buildings) detected\n');

// Test 8: Synergy Integration with Fragment Bonus Manager
console.log('Test 8: Fragment Bonus Manager Integration');
const kingdom8 = {
  fragment_bonuses: JSON.stringify({
    smithies: { fragment: 'Volcanic Rock', passive: { quality: 0.15 } },
    training: { fragment: 'Dragon Scale', passive: { speed: 0.30 } },
    barracks: { fragment: 'Dragon Scale', passive: { training: 0.30 } },
  }),
};

const activeSynergy8 = fragmentBonusManager.getActiveSynergy(kingdom8);
assert.ok(activeSynergy8, 'Fragment bonus manager detects active synergy');
assert.equal(activeSynergy8.id, 'infernal-forge', 'Correct synergy ID');
console.log('✓ Fragment bonus manager integration works\n');

// Test 9: Synergy Bonus Stacking with Fragment Bonuses
console.log('Test 9: Bonus Stacking');
const kingdom9 = {
  fragment_bonuses: JSON.stringify({
    smithies: { fragment: 'Volcanic Rock', passive: { quality: 0.15 } },
    training: { fragment: 'Dragon Scale', passive: { speed: 0.30 } },
    barracks: { fragment: 'Dragon Scale', passive: { training: 0.30 } },
  }),
};

// Fragment bonus: 0.15, Synergy bonus: 0.75 = total 0.90 = 1.90x multiplier
const multiplier = fragmentBonusManager.getBonusMultiplier(kingdom9, 'smithies', 'quality');
assert.equal(multiplier, 1.90, 'Smithy quality bonus stacks correctly (1.0 + 0.15 + 0.75)');
console.log('✓ Bonus stacking works correctly\n');

// Test 10: Synergy Status Query
console.log('Test 10: Synergy Status Query');
const kingdom10 = {
  fragment_bonuses: JSON.stringify({
    smithies: { fragment: 'Volcanic Rock', passive: {} },
    training: { fragment: 'Dragon Scale', passive: {} },
    barracks: { fragment: 'Dragon Scale', passive: {} },
  }),
};

const status = fragmentBonusManager.getSynergyStatus(kingdom10);
assert.ok(status.active, 'Synergy status shows active');
assert.equal(status.synergy.id, 'infernal-forge', 'Synergy ID in status');
assert.equal(status.synergy.name, 'Infernal Forge', 'Synergy name in status');
console.log('✓ Synergy status query works\n');

// Test 11: Near Activation Synergies
console.log('Test 11: Near Activation Synergies');
const kingdom11 = {
  fragment_bonuses: JSON.stringify({
    smithies: { fragment: 'Volcanic Rock', passive: {} },
  }),
};

const nearActivation = fragmentBonusManager.getNearActivationSynergies(kingdom11);
assert.ok(nearActivation.length > 0, 'Near activation synergies detected');

const infrarnalForgNear = nearActivation.some(s => s.id === 'infernal-forge');
assert.ok(infrarnalForgNear, 'Infernal Forge is near activation');
console.log('✓ Near activation synergies detected\n');

// Test 12: Synergy Special Effects defined
console.log('Test 12: Synergy Special Effects');
const synergy12 = synergiesModule.getSynergy('natures-bounty');
assert.ok(synergy12.specialEffects, 'Synergy has special effects');
assert.ok(synergy12.specialEffects.name, 'Special effect has name');
assert.ok(synergy12.specialEffects.desc, 'Special effect has description');
assert.ok(synergy12.specialEffects.mechanic, 'Special effect has mechanic type');
console.log('✓ Special effects defined correctly\n');

// Test 13: All synergies have required fields
console.log('Test 13: All synergies have required fields');
synergies.forEach(synergy => {
  assert.ok(synergy.id, `${synergy.name}: has id`);
  assert.ok(synergy.name, `${synergy.name}: has name`);
  assert.ok(synergy.emoji, `${synergy.name}: has emoji`);
  assert.ok(synergy.description, `${synergy.name}: has description`);
  assert.ok(synergy.requiredFragments, `${synergy.name}: has requiredFragments`);
  assert.ok(synergy.requiredBuildings !== undefined, `${synergy.name}: has requiredBuildings`);
  assert.ok(synergy.minAttunedBuildings !== undefined, `${synergy.name}: has minAttunedBuildings`);
  assert.ok(synergy.passiveBonuses, `${synergy.name}: has passiveBonuses`);
  assert.ok(synergy.specialEffects, `${synergy.name}: has specialEffects`);
});
console.log('✓ All synergies have required fields\n');

// Test 14: Global bonuses (null key) are retrieved correctly
console.log('Test 14: Global bonus retrieval');
const bloodmoonSynergy = synergiesModule.getSynergy('bloodmoon-ritual');
const globalBonus = synergiesModule.getSynergyBonusMultiplier(bloodmoonSynergy, 'any_building_type');
assert.ok(globalBonus.power !== undefined, 'Global power bonus retrieved for Bloodmoon Ritual');
assert.equal(globalBonus.power, 3.0, 'Global power bonus is +300%');
const specificBonus = synergiesModule.getSynergyBonusMultiplier(bloodmoonSynergy, 'smithies');
assert.deepEqual(specificBonus, globalBonus, 'Non-existent building type falls back to global bonus');
console.log('✓ Global bonuses retrieved correctly\n');

console.log('✅ All 14 tests passed!');
