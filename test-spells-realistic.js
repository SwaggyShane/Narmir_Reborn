#!/usr/bin/env node
/**
 * Realistic Spell Testing Suite
 * Tests all 216 spells for:
 * 1. Proper mana consumption
 * 2. Non-empty descriptions
 * 3. Reasonable outcomes
 * 4. No errors or crashes
 */

const config = require('./game/config');
const engine = require('./game/engine');

// Generate scrolls for all spells
const allScrolls = {};
for (const spellId of Object.keys(config.SPELL_DEFS)) {
  allScrolls[spellId] = 100;
}

// Minimal test kingdom (no libraries to get clean base mana costs)
const caster = {
  id: 'caster-1',
  name: 'Test Caster',
  mana: 1000000,
  fighters: 50000,
  rangers: 10000,
  clerics: 5000,
  population: 100000,
  gold: 500000,
  stone: 100000,
  iron: 100000,
  wood: 100000,
  food: 500000,
  scrolls: JSON.stringify(allScrolls),
  bld_farms: 100,
  bld_barracks: 100,
  bld_guard_towers: 50,
  bld_markets: 50,
  bld_granaries: 50,
  bld_shrines: 50,
  bld_mage_towers: 50,
  bld_libraries: 0, // No libraries = no spell efficiency bonus
  bld_castles: 10,
  bld_walls: 10,
  res_spellbook: 2000,
  res_defense_magic: 100,
  res_attack_magic: 100,
  active_effects: '{}',
};

const target = {
  id: 'target-1',
  name: 'Test Target',
  mana: 500000,
  fighters: 20000,
  rangers: 5000,
  clerics: 2000,
  population: 50000,
  gold: 100000,
  stone: 50000,
  iron: 50000,
  wood: 50000,
  food: 200000,
  bld_farms: 500,
  bld_barracks: 300,
  bld_guard_towers: 150,
  bld_markets: 100,
  bld_granaries: 100,
  bld_shrines: 100,
  bld_mage_towers: 200,
  bld_libraries: 100,
  bld_castles: 20,
  bld_walls: 20,
  res_spellbook: 2000,
  res_defense_magic: 100,
  res_attack_magic: 100,
  active_effects: '{}',
};

const EXPECTED_MANA_BY_TIER = {
  1: 500,
  2: 2000,
  3: 8000,
  4: 50000,
  5: 200000,
};

let passed = 0;
let failed = 0;
const failures = [];
const tierCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
const tierPassed = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

for (const [spellId, def] of Object.entries(config.SPELL_DEFS)) {
  tierCounts[def.tier]++;

  try {
    const c = JSON.parse(JSON.stringify(caster));
    const t = JSON.parse(JSON.stringify(target));
    const manaBefore = c.mana;

    const result = engine.castSpell(c, t, spellId);

    // Error check
    if (result.error) {
      throw new Error(`Cast failed: ${result.error}`);
    }

    // Structure check
    if (!result.report || !result.casterUpdates) {
      throw new Error('Missing required result fields');
    }

    const { damageDesc, manaCost } = result.report;

    // Mana check
    if (!manaCost || manaCost < 0) {
      throw new Error(`Invalid mana cost: ${manaCost}`);
    }

    const manaAfter = result.casterUpdates.mana;
    if (manaAfter === undefined) {
      throw new Error('Caster mana not updated');
    }

    // Check mana was actually consumed (deducted from starting mana + any spell-generated mana)
    const manaConsumed = manaBefore - manaAfter;
    if (manaConsumed < 0) {
      // Spell generated net positive mana (drain spell), that's okay
      // But should still consume base cost
      if (manaCost > Math.abs(manaConsumed)) {
        throw new Error(
          `Mana cost (${manaCost}) exceeds spell result (${manaConsumed} net)`
        );
      }
    } else if (manaConsumed < manaCost * 0.8) {
      // Allow up to 20% variance for spells with secondary costs (materialize_wealth, etc)
      throw new Error(
        `Mana consumption too low: expected at least ${manaCost * 0.8}, got ${manaConsumed}`
      );
    } else if (manaConsumed > manaCost * 20) {
      // Allow up to 20x for resource spells with special secondary costs (materialize_wealth costs 10% kingdom mana)
      throw new Error(
        `Mana consumption unreasonable: expected ~${manaCost}, got ${manaConsumed}`
      );
    }

    // Description check
    if (!damageDesc || typeof damageDesc !== 'string' || damageDesc.trim() === '') {
      throw new Error(`Invalid damageDesc: ${damageDesc}`);
    }

    // At least SOMETHING changed (either caster or target updated)
    const casterChanged = Object.keys(result.casterUpdates).length > 1; // More than just mana
    const targetChanged = Object.keys(result.targetUpdates).length > 0;
    if (!casterChanged && !targetChanged) {
      throw new Error('Spell produced no meaningful effect');
    }

    passed++;
    tierPassed[def.tier]++;
  } catch (err) {
    failed++;
    failures.push(`${spellId} (T${def.tier}): ${err.message}`);
  }
}

console.log('\n' + '='.repeat(80));
console.log('REALISTIC SPELL SYSTEM TEST');
console.log('='.repeat(80) + '\n');

// By tier breakdown
console.log('PASS RATE BY TIER:');
for (const tier of [1, 2, 3, 4, 5]) {
  const rate = tierCounts[tier] > 0
    ? ((tierPassed[tier] / tierCounts[tier]) * 100).toFixed(1)
    : '0.0';
  console.log(
    `  Tier ${tier}: ${tierPassed[tier]}/${tierCounts[tier]} passed (${rate}%)`
  );
}

console.log('\n' + '='.repeat(80));
console.log(`Total:  ${passed}/${passed + failed} spells passed (${((passed / (passed + failed)) * 100).toFixed(1)}%)`);
console.log('='.repeat(80) + '\n');

if (failures.length > 0) {
  console.log('FAILURES:\n');
  const byType = {};
  failures.forEach(f => {
    const type = f.split(': ')[1];
    byType[type] = (byType[type] || 0) + 1;
  });

  console.log('Failure Summary:');
  Object.entries(byType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  console.log('\nFirst 30 failures:');
  failures.slice(0, 30).forEach((f, i) => {
    console.log(`${i + 1}. ${f}`);
  });
  if (failures.length > 30) {
    console.log(`\n... and ${failures.length - 30} more failures`);
  }

  process.exit(1);
} else {
  console.log('✓ ALL SPELLS PASSED!\n');
  console.log('All 216 spells:');
  console.log('  ✓ Cast successfully without errors');
  console.log('  ✓ Consumed mana correctly');
  console.log('  ✓ Produced valid descriptions');
  console.log('  ✓ Generated meaningful effects\n');
  process.exit(0);
}
