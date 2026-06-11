#!/usr/bin/env node
/**
 * Comprehensive Spell Testing Suite
 * Verifies all 216 spells:
 * 1. Consume mana correctly
 * 2. Produce expected outcomes
 * 3. Generate proper descriptions
 * 4. Apply correct resource/stat changes
 */

const config = require('./game/config');
const engine = require('./game/engine');

// Rich test kingdom with all buildings and resources
const allScrolls = {};
for (const spellId of Object.keys(config.SPELL_DEFS)) {
  allScrolls[spellId] = 100;
}

const baseCaster = {
  id: 'caster-1',
  name: 'Test Caster',
  mana: 500000,
  fighters: 50000,
  rangers: 10000,
  clerics: 5000,
  population: 100000,
  gold: 100000,
  stone: 50000,
  iron: 50000,
  wood: 50000,
  food: 500000,
  scrolls: JSON.stringify(allScrolls),
  bld_farms: 2000,
  bld_barracks: 1000,
  bld_guard_towers: 500,
  bld_markets: 300,
  bld_granaries: 200,
  bld_shrines: 200,
  bld_mage_towers: 1000,
  bld_libraries: 500,
  bld_castles: 100,
  bld_walls: 50,
  bld_smithies: 200,
  bld_taverns: 200,
  bld_training_grounds: 200,
  res_spellbook: 2000,
  res_defense_magic: 100,
  res_attack_magic: 100,
  active_effects: '{}',
};

const baseTarget = {
  id: 'target-1',
  name: 'Test Target',
  mana: 200000,
  fighters: 20000,
  rangers: 5000,
  clerics: 2000,
  population: 50000,
  gold: 50000,
  stone: 25000,
  iron: 25000,
  wood: 25000,
  food: 200000,
  bld_farms: 1000,
  bld_barracks: 500,
  bld_guard_towers: 250,
  bld_markets: 150,
  bld_granaries: 100,
  bld_shrines: 100,
  bld_mage_towers: 500,
  bld_libraries: 250,
  bld_castles: 50,
  bld_walls: 25,
  bld_smithies: 100,
  bld_taverns: 100,
  bld_training_grounds: 100,
  res_spellbook: 2000,
  res_defense_magic: 100,
  res_attack_magic: 100,
  active_effects: '{}',
};

const MANA_COSTS = {
  1: 500,
  2: 2000,
  3: 8000,
  4: 50000,
  5: 200000, // Estimate for tier 5
};

let passed = 0;
let failed = 0;
const failures = [];

console.log('\n' + '='.repeat(80));
console.log('COMPREHENSIVE SPELL SYSTEM TEST SUITE');
console.log('='.repeat(80) + '\n');

// Test each spell
for (const [spellId, def] of Object.entries(config.SPELL_DEFS)) {
  try {
    const caster = JSON.parse(JSON.stringify(baseCaster));
    const target = JSON.parse(JSON.stringify(baseTarget));
    const manaBefore = caster.mana;

    // Cast spell
    const result = engine.castSpell(caster, target, spellId);

    // Check for error
    if (result.error) {
      throw new Error(`Cast failed: ${result.error}`);
    }

    // Validate result structure
    if (!result.casterUpdates || !result.targetUpdates || !result.report) {
      throw new Error('Missing required result fields');
    }

    const { damageDesc, manaCost } = result.report;

    // Verify mana consumption
    if (!manaCost || manaCost <= 0) {
      throw new Error(`Invalid mana cost: ${manaCost}`);
    }

    if (result.casterUpdates.mana === undefined) {
      throw new Error('Caster mana not updated');
    }

    const manaAfter = result.casterUpdates.mana;
    const manaConsumed = manaBefore - manaAfter;

    if (manaConsumed !== manaCost) {
      throw new Error(
        `Mana consumption mismatch: expected ${manaCost}, got ${manaConsumed}`
      );
    }

    // Verify expected tier mana cost
    const expectedBaseMana = MANA_COSTS[def.tier] || 500;
    if (manaCost < expectedBaseMana * 0.5 || manaCost > expectedBaseMana * 2) {
      throw new Error(
        `Mana cost ${manaCost} outside expected range for tier ${def.tier}`
      );
    }

    // Verify damageDesc is not empty
    if (!damageDesc || damageDesc.trim() === '') {
      throw new Error('Empty damageDesc');
    }

    // Verify outcome based on effect type
    if (def.effect === 'friendly') {
      // Friendly spells should only update target (or caster for self-cast)
      if (
        Object.keys(result.targetUpdates).length === 0 &&
        Object.keys(result.casterUpdates).length === 1
      ) {
        // Only mana was updated — no effect
        throw new Error('Friendly spell had no beneficial effect');
      }
    } else if (def.effect === 'buildings') {
      // Building damage spells should reduce some buildings
      const hasBuildings = Object.keys(result.targetUpdates).some(
        k => k.startsWith('bld_') && result.targetUpdates[k] < baseTarget[k]
      );
      if (!hasBuildings) {
        throw new Error('Building damage spell did not reduce any buildings');
      }
    } else if (def.effect === 'troops') {
      // Troop spells should affect fighters/rangers/clerics
      const hasTroops = ['fighters', 'rangers', 'clerics'].some(
        k => result.targetUpdates[k] !== undefined && result.targetUpdates[k] < baseTarget[k]
      );
      if (!hasTroops) {
        throw new Error('Troop spell did not affect any troop type');
      }
    } else if (def.effect === 'population') {
      // Population spells should reduce or increase population
      const hasPopEffect =
        result.targetUpdates.population !== undefined ||
        result.targetUpdates.food !== undefined;
      if (!hasPopEffect) {
        throw new Error('Population spell had no population/food effect');
      }
    } else if (def.effect === 'debuff') {
      // Debuff spells should apply active_effects
      const hasEffect =
        result.targetUpdates.active_effects !== undefined ||
        Object.keys(result.targetUpdates).some(
          k => !['active_effects'].includes(k) && result.targetUpdates[k] !== undefined
        );
      if (!hasEffect) {
        throw new Error('Debuff spell had no effect applied');
      }
    } else if (def.effect === 'research') {
      // Research spells should have a description (most don't affect stats)
      if (!damageDesc || damageDesc.length < 5) {
        throw new Error('Research spell has inadequate description');
      }
    } else if (def.effect === 'catastrophic') {
      // Catastrophic spells should cause massive damage
      const totalDamage = Object.keys(result.targetUpdates).filter(k =>
        ['fighters', 'rangers', 'clerics', 'population'].includes(k)
      ).length;
      if (totalDamage === 0) {
        throw new Error('Catastrophic spell did not apply expected damage');
      }
    }

    passed++;
  } catch (err) {
    failed++;
    failures.push(`${spellId}: ${err.message}`);
  }
}

// Print results
console.log('\n' + '='.repeat(80));
console.log('TEST RESULTS');
console.log('='.repeat(80));
console.log(`Total Spells:          ${passed + failed}`);
console.log(`Passed:                ${passed}`);
console.log(`Failed:                ${failed}`);
console.log(`Success Rate:          ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
console.log('='.repeat(80) + '\n');

if (failures.length > 0) {
  console.log('FAILURES:\n');
  failures.forEach((f, i) => {
    console.log(`${i + 1}. ${f}`);
  });
  process.exit(1);
} else {
  console.log('✓ All spells passed comprehensive testing!');
  console.log('  - Mana consumption verified');
  console.log('  - Outcomes produced correctly');
  console.log('  - Descriptions generated');
  console.log('  - Effect types validated\n');
  process.exit(0);
}
