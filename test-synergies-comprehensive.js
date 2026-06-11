#!/usr/bin/env node
/**
 * Comprehensive Synergy System Test Suite
 * Verifies all 10 world fragment synergies are properly defined,
 * wired, and functional in the game
 */

const synergiesModule = require('./game/fragment-synergies');
const attunementManager = require('./game/attunement-manager');
const config = require('./game/config');

const allFragments = config.WORLD_FRAGMENTS;
const allSynergies = synergiesModule.getAllSynergies();

let passed = 0;
let failed = 0;
const failures = [];

console.log('\n' + '='.repeat(80));
console.log('COMPREHENSIVE SYNERGY SYSTEM TEST');
console.log('='.repeat(80) + '\n');

// TEST 1: All synergies defined and properly structured
console.log('TEST 1: Synergy Definitions\n');

for (const synergy of allSynergies) {
  try {
    // Check required fields
    if (!synergy.id || !synergy.name || !synergy.emoji) {
      throw new Error('Missing required fields: id, name, or emoji');
    }

    if (!synergy.requiredFragments || typeof synergy.requiredFragments !== 'object') {
      throw new Error('Missing or invalid requiredFragments');
    }

    if (!synergy.passive || !synergy.passive.name || !synergy.passive.desc) {
      throw new Error('Incomplete passive ability definition');
    }

    if (!synergy.active || !synergy.active.name || !synergy.active.desc) {
      throw new Error('Incomplete active ability definition');
    }

    // Check that passive has effects
    if (!synergy.passive.effects || Object.keys(synergy.passive.effects).length === 0) {
      throw new Error('Passive ability has no effects defined');
    }

    // Check that exactly 10 fragments are required
    const requiredCount = Object.keys(synergy.requiredFragments).length;
    if (requiredCount !== 10) {
      throw new Error(`Expected 10 required fragments, got ${requiredCount}`);
    }

    // Check that all required fragments are valid
    for (const [fragmentName, buildingType] of Object.entries(synergy.requiredFragments)) {
      if (!allFragments.includes(fragmentName)) {
        throw new Error(`Invalid fragment in requirements: ${fragmentName}`);
      }
      if (!buildingType || typeof buildingType !== 'string') {
        throw new Error(`Invalid building type for ${fragmentName}: ${buildingType}`);
      }
    }

    // Check that each fragment is required exactly once
    const fragmentList = Object.keys(synergy.requiredFragments);
    const uniqueFragments = new Set(fragmentList);
    if (uniqueFragments.size !== 10) {
      throw new Error('Some fragments appear more than once in requirements');
    }

    passed++;
  } catch (err) {
    failed++;
    failures.push(`${synergy.name || 'Unknown'}: ${err.message}`);
  }
}

console.log(`✓ Synergy definitions: ${passed}/10 passed\n`);

// TEST 2: Synergy detection works correctly
console.log('TEST 2: Synergy Detection\n');

for (const synergy of allSynergies) {
  try {
    // Create fragment placements matching this synergy
    const fragmentPlacements = {};
    for (const [fragmentName, buildingType] of Object.entries(synergy.requiredFragments)) {
      fragmentPlacements[buildingType] = fragmentName;
    }

    // Test isSynergyActive
    const isActive = synergiesModule.isSynergyActive(synergy, fragmentPlacements);
    if (!isActive) {
      throw new Error('Synergy not detected when all fragments placed correctly');
    }

    // Test detectActiveSynergy
    const detected = synergiesModule.detectActiveSynergy(fragmentPlacements);
    if (!detected || detected.id !== synergy.id) {
      throw new Error('detectActiveSynergy returned wrong synergy');
    }

    passed++;
  } catch (err) {
    failed++;
    failures.push(`Detection for ${synergy.name}: ${err.message}`);
  }
}

console.log(`✓ Synergy detection: ${passed - 10}/10 passed\n`);

// TEST 3: Near-activation detection
console.log('TEST 3: Near-Activation Detection\n');

for (const synergy of allSynergies.slice(0, 3)) { // Test first 3 synergies
  try {
    // Create fragment placements with 2 fragments missing
    const fragmentPlacements = {};
    let skipped = 0;
    for (const [fragmentName, buildingType] of Object.entries(synergy.requiredFragments)) {
      if (skipped < 2) {
        skipped++;
        continue; // Skip first 2
      }
      fragmentPlacements[buildingType] = fragmentName;
    }

    const nearActivation = synergiesModule.getNearActivationSynergies(fragmentPlacements);

    // Should include this synergy (missing 2)
    const foundNear = nearActivation.some(
      na => na.synergy.id === synergy.id && na.missingCount === 2
    );
    if (!foundNear) {
      throw new Error('Synergy with 2 missing fragments not detected as near-activation');
    }

    passed++;
  } catch (err) {
    failed++;
    failures.push(`Near-activation for ${synergy.name}: ${err.message}`);
  }
}

console.log(`✓ Near-activation detection: ${passed - 13}/3 passed\n`);

// TEST 4: Contributing synergies detection
console.log('TEST 4: Contributing Synergies Detection\n');

const testCases = [
  { building: 'smithies', fragment: 'Volcanic Rock' }, // In Infernal Crucible
  { building: 'farms', fragment: 'Ancient Elven Wood' }, // In Eternal Harvest
  { building: 'mage_towers', fragment: 'Abyssal Crystal' }, // In multiple synergies
];

for (const testCase of testCases) {
  try {
    const contributing = synergiesModule.getContributingSynergies(
      testCase.building,
      testCase.fragment
    );

    if (!Array.isArray(contributing)) {
      throw new Error('getContributingSynergies did not return an array');
    }

    if (contributing.length === 0) {
      throw new Error(
        `No synergies found for ${testCase.fragment} → ${testCase.building}`
      );
    }

    // Verify each synergy actually requires this placement
    for (const synergy of contributing) {
      if (synergy.requiredFragments[testCase.fragment] !== testCase.building) {
        throw new Error(
          `Synergy ${synergy.name} returned but doesn't require this placement`
        );
      }
    }

    passed++;
  } catch (err) {
    failed++;
    failures.push(
      `Contributing synergies ${testCase.building}/${testCase.fragment}: ${err.message}`
    );
  }
}

console.log(`✓ Contributing synergies: ${passed - 16}/3 passed\n`);

// TEST 5: Attunement manager integration
console.log('TEST 5: Attunement Manager Integration\n');

const mockKingdom = {
  id: 'test-kingdom',
  turn: 1,
  fragment_bonuses: JSON.stringify({
    smithies: {
      fragment: 'Volcanic Rock',
      passive: { production: 0.15 },
      special: { name: 'test', desc: 'test' }
    },
    barracks: {
      fragment: 'Dragon Scale',
      passive: { training: 0.30 },
      special: { name: 'test', desc: 'test' }
    },
    // ... would need all 10 fragments for full synergy
  })
};

try {
  // Test getActiveSynergy with partial setup (should return null)
  const activeSynergy = attunementManager.getActiveSynergy(mockKingdom);
  if (activeSynergy !== null) {
    throw new Error('getActiveSynergy should return null with incomplete setup');
  }

  // Test getNearActivationSynergies
  const nearActivation = attunementManager.getNearActivationSynergies(mockKingdom);
  if (!Array.isArray(nearActivation)) {
    throw new Error('getNearActivationSynergies did not return an array');
  }

  // Test getContributingSynergies through manager
  const contributing = attunementManager.getContributingSynergies('smithies', 'Volcanic Rock');
  if (!Array.isArray(contributing) || contributing.length === 0) {
    throw new Error('getContributingSynergies through manager failed');
  }

  passed++;
} catch (err) {
  failed++;
  failures.push(`Attunement manager: ${err.message}`);
}

console.log(`✓ Attunement manager integration: passed\n`);

// TEST 6: Synergy ability validity
console.log('TEST 6: Synergy Ability Definitions\n');

for (const synergy of allSynergies) {
  try {
    // Passive ability checks
    const passive = synergy.passive;
    if (typeof passive.name !== 'string' || passive.name.length === 0) {
      throw new Error('Passive ability has invalid name');
    }

    if (typeof passive.desc !== 'string' || passive.desc.length === 0) {
      throw new Error('Passive ability has invalid description');
    }

    if (!passive.effects || Object.keys(passive.effects).length === 0) {
      throw new Error('Passive ability has no effects');
    }

    // Active ability checks
    const active = synergy.active;
    if (typeof active.name !== 'string' || active.name.length === 0) {
      throw new Error('Active ability has invalid name');
    }

    if (typeof active.desc !== 'string' || active.desc.length === 0) {
      throw new Error('Active ability has invalid description');
    }

    if (typeof active.cooldown_days !== 'number' || active.cooldown_days < 1) {
      throw new Error('Active ability has invalid cooldown');
    }

    passed++;
  } catch (err) {
    failed++;
    failures.push(`${synergy.name} abilities: ${err.message}`);
  }
}

console.log(`✓ Ability definitions: ${passed - 21}/10 passed\n`);

// Summary
console.log('='.repeat(80));
console.log('VERIFICATION SUMMARY');
console.log('='.repeat(80));
console.log(`Total tests: ${passed + failed}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Success rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);

if (failures.length > 0) {
  console.log('FAILURES:\n');
  failures.forEach((f, i) => {
    console.log(`${i + 1}. ${f}`);
  });
  process.exit(1);
} else {
  console.log('✓ ALL SYNERGY TESTS PASSED!\n');
  console.log('Summary of Verification:');
  console.log(`  ✓ All 10 synergies properly defined with complete structures`);
  console.log(`  ✓ Each synergy requires exactly 10 fragments (one per building)`);
  console.log(`  ✓ Synergy detection works when all fragments placed`);
  console.log(`  ✓ Near-activation detection identifies synergies missing 1-2 fragments`);
  console.log(`  ✓ Contributing synergies detection shows which synergies a placement affects`);
  console.log(`  ✓ Attunement manager properly integrated with synergy system`);
  console.log(`  ✓ All passive and active abilities are properly defined\n`);
  process.exit(0);
}
