#!/usr/bin/env node
/**
 * Comprehensive spell verification test
 * Tests all 200 spell implementations to ensure they:
 * 1. Are properly defined in config
 * 2. Can be validated by castSpell
 * 3. Return proper result structure
 */

const config = require('./game/config');
const engine = require('./game/engine');

// Mock kingdom objects for testing
// Generate scrolls for all spells
const allScrolls = {};
for (const spellId of Object.keys(config.SPELL_DEFS)) {
  allScrolls[spellId] = 50;
}

const caster = {
  id: 'test-caster',
  name: 'Test Caster',
  mana: 100000,
  fighters: 10000,
  population: 50000,
  gold: 100000,
  stone: 10000,
  iron: 10000,
  wood: 10000,
  food: 100000,
  scrolls: JSON.stringify(allScrolls),
  bld_farms: 1000,
  bld_barracks: 500,
  bld_guard_towers: 300,
  bld_markets: 200,
  bld_granaries: 100,
  bld_shrines: 100,
  bld_mage_towers: 500,
  bld_libraries: 200,
  bld_castles: 100,
  bld_walls: 50,
  bld_smithies: 100,
  bld_taverns: 100,
  bld_training_grounds: 100,
  res_spellbook: 2000,
  res_defense_magic: 100,
  res_attack_magic: 100,
};

const target = {
  id: 'test-target',
  name: 'Test Target',
  mana: 50000,
  fighters: 5000,
  population: 30000,
  gold: 50000,
  bld_farms: 500,
  bld_barracks: 300,
  bld_guard_towers: 200,
  bld_markets: 100,
  bld_granaries: 50,
  bld_shrines: 50,
  bld_mage_towers: 300,
  bld_libraries: 100,
  bld_castles: 50,
  bld_walls: 25,
  bld_smithies: 50,
  bld_taverns: 50,
  bld_training_grounds: 50,
  res_spellbook: 1100,
  active_effects: '{}',
  res_defense_magic: 100,
  res_attack_magic: 100,
};

let passed = 0;
let failed = 0;
const failures = [];

// Test each spell
for (const [spellId, def] of Object.entries(config.SPELL_DEFS)) {
  try {
    // Validate spell definition exists
    if (!def || !def.tier || !def.effect) {
      throw new Error(`Invalid spell definition for ${spellId}: missing tier or effect`);
    }

    // Create fresh copies for each test
    const testCaster = JSON.parse(JSON.stringify(caster));
    const testTarget = JSON.parse(JSON.stringify(target));

    // Call castSpell
    const result = engine.castSpell(testCaster, testTarget, spellId);

    // Validate result structure
    if (!result || typeof result !== 'object') {
      throw new Error(`Invalid result structure: not an object`);
    }

    // Check if there was an error
    if (result.error) {
      throw new Error(`Cast failed: ${result.error}`);
    }

    // Validate successful cast structure
    if (!result.casterUpdates || typeof result.casterUpdates !== 'object') {
      throw new Error(`Missing or invalid casterUpdates`);
    }
    if (!result.targetUpdates || typeof result.targetUpdates !== 'object') {
      throw new Error(`Missing or invalid targetUpdates`);
    }
    if (!result.report || typeof result.report !== 'object') {
      throw new Error(`Missing or invalid report`);
    }
    if (result.damageDesc === undefined && !result.report.damageDesc) {
      throw new Error(`Missing damageDesc`);
    }

    passed++;
  } catch (err) {
    failed++;
    failures.push(`${spellId}: ${err.message}`);
  }
}

// Print summary
console.log('\n========================================');
console.log('SPELL VERIFICATION TEST RESULTS');
console.log('========================================');
console.log(`Total Spells:    ${passed + failed}`);
console.log(`Passed:          ${passed}`);
console.log(`Failed:          ${failed}`);
console.log(`Success Rate:    ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
console.log('========================================\n');

if (failures.length > 0) {
  console.log('FAILURES:');
  failures.forEach((f, i) => {
    console.log(`${i + 1}. ${f}`);
  });
  process.exit(1);
} else {
  console.log('✓ All spells verified successfully!');
  process.exit(0);
}
