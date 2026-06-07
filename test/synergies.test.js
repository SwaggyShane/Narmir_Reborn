'use strict';
const assert = require('assert');
const synergiesModule = require('../game/fragment-synergies');
const attunementManager = require('../game/attunement-manager');

console.log('Testing World Fragment Synergies System\n');

// Test 1: All 10 synergies registered
console.log('Test 1: All 10 synergies registered');
const allSynergies = synergiesModule.getAllSynergies();
assert.equal(allSynergies.length, 10, 'Should have exactly 10 synergies');
const expectedIds = [
  'infernal-crucible',
  'eternal-harvest',
  'arcane-singularity',
  'blessed-citadel',
  'void-convergence',
  'primordial-awakening',
  'bloodmoon-ascension',
  'recursive-knowledge',
  'celestial-harmony',
  'entropy-unbound',
];
expectedIds.forEach(id => {
  assert.ok(synergiesModule.getSynergy(id), `Synergy ${id} exists`);
});
console.log('✓ All 10 synergies registered\n');

// Test 2: Synergy requires all 10 fragments
console.log('Test 2: Each synergy requires all 10 fragments');
allSynergies.forEach(synergy => {
  const fragments = Object.keys(synergy.requiredFragments);
  assert.equal(fragments.length, 10, `${synergy.name} requires exactly 10 fragments`);
});
console.log('✓ All synergies require 10 fragments\n');

// Test 3: Detect Infernal Crucible synergy
console.log('Test 3: Detect Infernal Crucible synergy');
const infernoFragments = {
  smithies: 'Volcanic Rock',
  barracks: 'Dragon Scale',
  armories: 'Dwarven Star-Metal',
  war_machines: 'Titan Bone',
  vaults: 'Abyssal Crystal',
  guard_towers: 'Celestial Feather',
  markets: 'Ancient Elven Wood',
  taverns: 'Tears of the World Tree',
  mausoleums: 'Cursed Bloodstone',
  mage_towers: 'Void Essence',
};
const detected = synergiesModule.detectActiveSynergy(infernoFragments);
assert.ok(detected, 'Synergy should be detected');
assert.equal(detected.id, 'infernal-crucible', 'Should detect Infernal Crucible');
console.log('✓ Infernal Crucible synergy detected\n');

// Test 4: Detect no synergy with incomplete placement
console.log('Test 4: No synergy with incomplete placement');
const incompleteFragments = {
  smithies: 'Volcanic Rock',
  barracks: 'Dragon Scale',
};
const notDetected = synergiesModule.detectActiveSynergy(incompleteFragments);
assert.ok(!notDetected, 'Should not detect synergy with incomplete placement');
console.log('✓ No synergy detected when incomplete\n');

// Test 5: Detect Eternal Harvest synergy
console.log('Test 5: Detect Eternal Harvest synergy');
const harvestFragments = {
  farms: 'Ancient Elven Wood',
  granaries: 'Tears of the World Tree',
  shrines: 'Celestial Feather',
  housing: 'Volcanic Rock',
  libraries: 'Dwarven Star-Metal',
  training: 'Dragon Scale',
  schools: 'Abyssal Crystal',
  mausoleums: 'Cursed Bloodstone',
  taverns: 'Void Essence',
  walls: 'Titan Bone',
};
const harvest = synergiesModule.detectActiveSynergy(harvestFragments);
assert.equal(harvest.id, 'eternal-harvest', 'Should detect Eternal Harvest');
console.log('✓ Eternal Harvest synergy detected\n');

// Test 6: Near activation detection
console.log('Test 6: Near activation detection');
const nearFragments = {
  smithies: 'Volcanic Rock',
  barracks: 'Dragon Scale',
  armories: 'Dwarven Star-Metal',
  war_machines: 'Titan Bone',
  vaults: 'Abyssal Crystal',
  guard_towers: 'Celestial Feather',
  markets: 'Ancient Elven Wood',
  taverns: 'Tears of the World Tree',
  mausoleums: 'Cursed Bloodstone',
};
const near = synergiesModule.getNearActivationSynergies(nearFragments);
assert.ok(near.length > 0, 'Should detect near-activation synergies');
const infraNear = near.find(item => item.synergy.id === 'infernal-crucible');
assert.ok(infraNear, 'Infernal Crucible should be near activation');
assert.equal(infraNear.missingCount, 1, 'Should be missing 1 fragment');
console.log('✓ Near activation detection works\n');

// Test 7: Contributing synergies detection
console.log('Test 7: Contributing synergies detection');
const contributing = synergiesModule.getContributingSynergies('smithies', 'Volcanic Rock');
assert.ok(contributing.length > 0, 'Should find contributing synergies');
const hasInferno = contributing.some(s => s.id === 'infernal-crucible');
assert.ok(hasInferno, 'Infernal Crucible should use Volcanic Rock on smithies');
console.log('✓ Contributing synergies detected\n');

// Test 8: Synergy has passive and active abilities
console.log('Test 8: Synergies have passive and active abilities');
allSynergies.forEach(synergy => {
  assert.ok(synergy.passive, `${synergy.name} has passive ability`);
  assert.ok(synergy.passive.name, `${synergy.name} passive has name`);
  assert.ok(synergy.passive.desc, `${synergy.name} passive has description`);
  assert.ok(synergy.passive.effects, `${synergy.name} passive has effects`);

  assert.ok(synergy.active, `${synergy.name} has active ability`);
  assert.ok(synergy.active.name, `${synergy.name} active has name`);
  assert.ok(synergy.active.desc, `${synergy.name} active has description`);
  assert.ok(synergy.active.cooldown_days !== undefined, `${synergy.name} active has cooldown`);
});
console.log('✓ All synergies have passive and active abilities\n');

// Test 9: Synergy passive has risk/reward
console.log('Test 9: Synergy passives have risk/reward balance');
const withNegative = allSynergies.filter(s => {
  const effects = s.passive.effects || {};
  return Object.values(effects).some(v => typeof v === 'number' && v < 0);
});
assert.ok(withNegative.length > 0, 'Should have synergies with negative effects');
console.log(`✓ ${withNegative.length} synergies have negative passive effects\n`);

// Test 10: Synergy active abilities have costs
console.log('Test 10: Synergy active abilities have penalties/costs');
allSynergies.forEach(synergy => {
  assert.ok(synergy.active.cost || synergy.active.penalty, `${synergy.name} has cost or penalty`);
});
console.log('✓ All active abilities have costs/penalties\n');

// Test 11: Attunement manager synergy integration
console.log('Test 11: Attunement manager synergy integration');
const properAttunements = {
  smithies: { fragment: 'Volcanic Rock', passive: {}, special: {} },
  barracks: { fragment: 'Dragon Scale', passive: {}, special: {} },
  armories: { fragment: 'Dwarven Star-Metal', passive: {}, special: {} },
  war_machines: { fragment: 'Titan Bone', passive: {}, special: {} },
  vaults: { fragment: 'Abyssal Crystal', passive: {}, special: {} },
  guard_towers: { fragment: 'Celestial Feather', passive: {}, special: {} },
  markets: { fragment: 'Ancient Elven Wood', passive: {}, special: {} },
  taverns: { fragment: 'Tears of the World Tree', passive: {}, special: {} },
  mausoleums: { fragment: 'Cursed Bloodstone', passive: {}, special: {} },
  mage_towers: { fragment: 'Void Essence', passive: {}, special: {} },
};
const mockKingdom = {
  fragment_bonuses: JSON.stringify(properAttunements),
};
const activeSynergy = attunementManager.getActiveSynergy(mockKingdom);
assert.ok(activeSynergy, 'Should detect active synergy via attunement manager');
assert.equal(activeSynergy.id, 'infernal-crucible', 'Correct synergy detected');
console.log('✓ Attunement manager detects synergy\n');

// Test 12: Synergy status report
console.log('Test 12: Synergy status report');
const status = attunementManager.getSynergyStatus(mockKingdom);
assert.ok(status.activeSynergy, 'Should have active synergy in status');
assert.equal(status.activeSynergy.id, 'infernal-crucible', 'Correct synergy in status');
assert.ok(status.activeSynergy.passive, 'Status includes passive effects');
assert.ok(status.activeSynergy.active, 'Status includes active effects');
console.log('✓ Synergy status report works\n');

// Test 13: All synergies have correct structure and valid fragment names
console.log('Test 13: All synergies have correct structure and valid fragment names');
const { isValidFragment } = require('../game/fragment-attunements');
allSynergies.forEach(synergy => {
  assert.ok(synergy.id, `${synergy.name}: has id`);
  assert.ok(synergy.name, `${synergy.name}: has name`);
  assert.ok(synergy.emoji, `${synergy.name}: has emoji`);
  assert.ok(synergy.description, `${synergy.name}: has description`);
  assert.equal(Object.keys(synergy.requiredFragments).length, 10, `${synergy.name}: has 10 fragments`);
  Object.keys(synergy.requiredFragments).forEach(fragmentName => {
    assert.ok(isValidFragment(fragmentName), `${synergy.name}: fragment '${fragmentName}' is a valid fragment name`);
  });
  assert.ok(synergy.passive.effects, `${synergy.name}: passive has effects object`);
  assert.ok(synergy.active.cooldown_days, `${synergy.name}: active has cooldown_days`);
});
console.log('✓ All synergies have correct structure and valid fragment names\n');

// Test 14: All cooldowns are in days (real-world time)
console.log('Test 14: All cooldowns are real-world time (days)');
allSynergies.forEach(synergy => {
  assert.ok(typeof synergy.active.cooldown_days === 'number', `${synergy.name}: cooldown_days is number`);
  assert.ok(synergy.active.cooldown_days > 0, `${synergy.name}: cooldown_days is positive`);
});
console.log('✓ All cooldowns are in days\n');

// Test 15: Negative effects are present and significant
console.log('Test 15: Negative effects are present and significant');
const significantNegatives = allSynergies.filter(s => {
  const effects = s.passive.effects || {};
  const hasHappinessPenalty = effects.happiness !== undefined && effects.happiness < -20;
  const hasProductionPenalty = effects.production !== undefined && effects.production < -0.40;
  return hasHappinessPenalty || hasProductionPenalty;
});
assert.ok(significantNegatives.length > 0, 'Should have synergies with significant penalties');
console.log(`✓ ${significantNegatives.length} synergies have significant negative effects\n`);

console.log('✅ All 15 tests passed!');
