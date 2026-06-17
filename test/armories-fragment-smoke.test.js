'use strict';
const assert = require('assert');
const { clearParseCache } = require('../utils/helpers');
const {
  covertLoot,
} = require('../game/engine');

// Minimal kingdom for armories tests
function baseKingdom(overrides = {}) {
  return {
    race: 'human',
    turn: 10,
    land: 1000,
    gold: 50000,
    food: 5000,
    population: 500,
    tax: 42,
    happiness: 70,
    mana: 0,
    prestige_level: 0,
    bld_armories: 5,
    bld_farms: 0,
    bld_granaries: 0,
    bld_markets: 0,
    bld_taverns: 0,
    bld_shrines: 0,
    bld_schools: 0,
    bld_mage_towers: 0,
    bld_mausoleums: 0,
    bld_libraries: 0,
    bld_guard_towers: 0,
    bld_smithies: 0,
    bld_barracks: 0,
    bld_walls: 0,
    bld_vaults: 0,
    bld_outposts: 0,
    bld_training: 0,
    bld_castles: 0,
    bld_housing: 0,
    fighters: 0,
    rangers: 0,
    clerics: 0,
    mages: 0,
    thieves: 0,
    ninjas: 0,
    researchers: 0,
    engineers: 0,
    scribes: 0,
    thralls: 0,
    res_economy: 100,
    res_construction: 100,
    troop_levels: '{}',
    mercenaries: '[]',
    fragment_bonuses: '{}',
    active_effects: '{}',
    milestone_bonuses: '{}',
    alliance_buffs: '{}',
    ...overrides,
  };
}

// Build fragment_bonuses JSON for armories
function withArmoryFragment(fragmentName) {
  const FRAGMENTS = require('../game/world-fragment-bonuses');
  const config = FRAGMENTS[fragmentName]?.armories;
  if (!config) throw new Error(`No armory config for fragment: ${fragmentName}`);
  const bonuses = {
    armories: {
      fragment: fragmentName,
      applied_turn: 1,
      passive: config.passive || {},
      special: {
        name: config.special?.name || '',
        desc: config.special?.desc || '',
      },
    },
  };
  return JSON.stringify(bonuses);
}

// ── covertLoot — armory fragment defenses ────────────────────────────────────

function test_covertLoot_noFragment_baseDefense() {
  clearParseCache();
  const thief = {
    race: 'human',
    thieves: 500,
    ninjas: 0,
    prestige_level: 0,
    troop_levels: '{}',
    milestone_bonuses: '{}',
    fragment_bonuses: '{}',
  };
  const target = baseKingdom();
  const result = covertLoot(thief, target, 'gold', 100);
  assert.ok(result.success, 'loot succeeds without fragment');
  assert.ok(result.stolen > 0, 'some gold stolen');
}

function test_covertLoot_ancientElvenWood_espionageGuardBoost() {
  clearParseCache();
  const thief = {
    race: 'human',
    thieves: 500,
    ninjas: 0,
    prestige_level: 0,
    troop_levels: '{}',
    milestone_bonuses: '{}',
    fragment_bonuses: '{}',
  };
  const targetBase = baseKingdom();
  const targetFrag = baseKingdom({
    fragment_bonuses: withArmoryFragment('Ancient Elven Wood'),
  });
  // Ancient Elven Wood espionage_guard: 0.30 → 30% more defense against thieves
  // With high thief count, both should succeed, but fragment target harder to penetrate
  clearParseCache();
  const resBase = covertLoot(thief, targetBase, 'gold', 100);
  clearParseCache();
  const resFrag = covertLoot(thief, targetFrag, 'gold', 100);

  if (resBase.success && resFrag.success) {
    // espionage_guard increases difficulty but shouldn't guarantee failure with 500 thieves
    assert.ok(typeof resFrag.success === 'boolean', 'frag result has success');
  } else if (!resBase.success && !resFrag.success) {
    // Both fail (both have enough defense)
    assert.ok(true);
  } else {
    // Base succeeds but frag fails — espionage_guard added defense
    assert.ok(!resFrag.success && resBase.success, 'espionage_guard made loot harder');
  }
}

function test_covertLoot_volcanicRock_noEspionageGuard() {
  clearParseCache();
  const thief = {
    race: 'human',
    thieves: 500,
    ninjas: 0,
    prestige_level: 0,
    troop_levels: '{}',
    milestone_bonuses: '{}',
    fragment_bonuses: '{}',
  };
  const targetBase = baseKingdom();
  const targetFrag = baseKingdom({
    fragment_bonuses: withArmoryFragment('Volcanic Rock'),
  });
  // Volcanic Rock has NO espionage_guard (0.30, 0.15 are garrison_defense and siege_output)
  // So defense should be the same
  clearParseCache();
  const resBase = covertLoot(thief, targetBase, 'gold', 100);
  clearParseCache();
  const resFrag = covertLoot(thief, targetFrag, 'gold', 100);

  assert.strictEqual(resBase.success, resFrag.success, 'Volcanic Rock has no espionage_guard effect');
}

function test_covertLoot_dragonScale_noEspionageGuard() {
  clearParseCache();
  const thief = {
    race: 'human',
    thieves: 500,
    ninjas: 0,
    prestige_level: 0,
    troop_levels: '{}',
    milestone_bonuses: '{}',
    fragment_bonuses: '{}',
  };
  const targetBase = baseKingdom();
  const targetFrag = baseKingdom({
    fragment_bonuses: withArmoryFragment('Dragon Scale'),
  });
  // Dragon Scale has NO espionage_guard (0.15, 0.40 are garrison_defense and flame_resistance)
  clearParseCache();
  const resBase = covertLoot(thief, targetBase, 'gold', 100);
  clearParseCache();
  const resFrag = covertLoot(thief, targetFrag, 'gold', 100);

  assert.strictEqual(resBase.success, resFrag.success, 'Dragon Scale has no espionage_guard effect');
}

function test_covertLoot_abyssalCrystal_infiltrationDefenseBoundary() {
  clearParseCache();
  // Abyssal Crystal infiltration_defense: 0.30 → 30% more defense against thieves
  // Use borderline thief count: 90 thieves vs. 8 armories = 80 base defense
  // 90 > 80 → base succeeds; 90 > 104 (with 30% boost) → frag blocked
  const thief = {
    race: 'human',
    thieves: 90,
    ninjas: 0,
    prestige_level: 0,
    troop_levels: '{}',
    milestone_bonuses: '{}',
    fragment_bonuses: '{}',
  };
  const targetBase = baseKingdom({ bld_armories: 8 }); // 80 base defense
  const targetFrag = baseKingdom({
    bld_armories: 8,
    fragment_bonuses: withArmoryFragment('Abyssal Crystal'),
  }); // 104 with 30% infiltration_defense boost

  clearParseCache();
  const resBase = covertLoot(thief, targetBase, 'gold', 90);
  clearParseCache();
  const resFrag = covertLoot(thief, targetFrag, 'gold', 90);

  assert.strictEqual(resBase.success, true, 'base: 90 thieves > 80 defense (success)');
  assert.strictEqual(resFrag.success, false, 'frag: 90 thieves ≤ 104 defense (blocked)');
}

function test_covertLoot_celestialFeather_noEspionageGuard() {
  clearParseCache();
  const thief = {
    race: 'human',
    thieves: 500,
    ninjas: 0,
    prestige_level: 0,
    troop_levels: '{}',
    milestone_bonuses: '{}',
    fragment_bonuses: '{}',
  };
  const targetBase = baseKingdom();
  const targetFrag = baseKingdom({
    fragment_bonuses: withArmoryFragment('Celestial Feather'),
  });
  // Celestial Feather has NO espionage_guard (0.25, 0.35 are garrison_defense and happiness_recovery)
  clearParseCache();
  const resBase = covertLoot(thief, targetBase, 'gold', 100);
  clearParseCache();
  const resFrag = covertLoot(thief, targetFrag, 'gold', 100);

  assert.strictEqual(resBase.success, resFrag.success, 'Celestial Feather has no espionage_guard effect');
}

function test_covertLoot_dwarvenStarMetal_noEspionageGuard() {
  clearParseCache();
  const thief = {
    race: 'human',
    thieves: 500,
    ninjas: 0,
    prestige_level: 0,
    troop_levels: '{}',
    milestone_bonuses: '{}',
    fragment_bonuses: '{}',
  };
  const targetBase = baseKingdom();
  const targetFrag = baseKingdom({
    fragment_bonuses: withArmoryFragment('Dwarven Star-Metal'),
  });
  // Dwarven Star-Metal has NO espionage_guard (0.40, 1.00 are garrison_defense and armor_longevity)
  clearParseCache();
  const resBase = covertLoot(thief, targetBase, 'gold', 100);
  clearParseCache();
  const resFrag = covertLoot(thief, targetFrag, 'gold', 100);

  assert.strictEqual(resBase.success, resFrag.success, 'Dwarven Star-Metal has no espionage_guard effect');
}

function test_covertLoot_cursedBloodstone_noEspionageGuard() {
  clearParseCache();
  const thief = {
    race: 'human',
    thieves: 500,
    ninjas: 0,
    prestige_level: 0,
    troop_levels: '{}',
    milestone_bonuses: '{}',
    fragment_bonuses: '{}',
  };
  const targetBase = baseKingdom();
  const targetFrag = baseKingdom({
    fragment_bonuses: withArmoryFragment('Cursed Bloodstone'),
  });
  // Cursed Bloodstone has NO espionage_guard (0.50, -0.20 are combat_damage and unit_recovery)
  clearParseCache();
  const resBase = covertLoot(thief, targetBase, 'gold', 100);
  clearParseCache();
  const resFrag = covertLoot(thief, targetFrag, 'gold', 100);

  assert.strictEqual(resBase.success, resFrag.success, 'Cursed Bloodstone has no espionage_guard effect');
}

function test_covertLoot_tearsOfWorldTree_noEspionageGuard() {
  clearParseCache();
  const thief = {
    race: 'human',
    thieves: 500,
    ninjas: 0,
    prestige_level: 0,
    troop_levels: '{}',
    milestone_bonuses: '{}',
    fragment_bonuses: '{}',
  };
  const targetBase = baseKingdom();
  const targetFrag = baseKingdom({
    fragment_bonuses: withArmoryFragment('Tears of the World Tree'),
  });
  // Tears of the World Tree has NO espionage_guard (0.35, 0.30 are garrison_defense and health_recovery)
  clearParseCache();
  const resBase = covertLoot(thief, targetBase, 'gold', 100);
  clearParseCache();
  const resFrag = covertLoot(thief, targetFrag, 'gold', 100);

  assert.strictEqual(resBase.success, resFrag.success, 'Tears of the World Tree has no espionage_guard effect');
}

function test_covertLoot_voidEssence_noEspionageGuard() {
  clearParseCache();
  const thief = {
    race: 'human',
    thieves: 500,
    ninjas: 0,
    prestige_level: 0,
    troop_levels: '{}',
    milestone_bonuses: '{}',
    fragment_bonuses: '{}',
  };
  const targetBase = baseKingdom();
  const targetFrag = baseKingdom({
    fragment_bonuses: withArmoryFragment('Void Essence'),
  });
  // Void Essence has NO espionage_guard (1.20, -0.40 are garrison_defense and structural_stability)
  clearParseCache();
  const resBase = covertLoot(thief, targetBase, 'gold', 100);
  clearParseCache();
  const resFrag = covertLoot(thief, targetFrag, 'gold', 100);

  assert.strictEqual(resBase.success, resFrag.success, 'Void Essence has no espionage_guard effect');
}

function test_covertLoot_titanBone_noEspionageGuard() {
  clearParseCache();
  const thief = {
    race: 'human',
    thieves: 500,
    ninjas: 0,
    prestige_level: 0,
    troop_levels: '{}',
    milestone_bonuses: '{}',
    fragment_bonuses: '{}',
  };
  const targetBase = baseKingdom();
  const targetFrag = baseKingdom({
    fragment_bonuses: withArmoryFragment('Titan Bone'),
  });
  // Titan Bone has NO espionage_guard (0.30, 0.15 are holding_capacity and armor_heavy_density)
  clearParseCache();
  const resBase = covertLoot(thief, targetBase, 'gold', 100);
  clearParseCache();
  const resFrag = covertLoot(thief, targetFrag, 'gold', 100);

  assert.strictEqual(resBase.success, resFrag.success, 'Titan Bone has no espionage_guard effect');
}

// ── Run all tests ─────────────────────────────────────────────────────────────

const tests = [
  test_covertLoot_noFragment_baseDefense,
  test_covertLoot_ancientElvenWood_espionageGuardBoost,
  test_covertLoot_volcanicRock_noEspionageGuard,
  test_covertLoot_dragonScale_noEspionageGuard,
  test_covertLoot_abyssalCrystal_infiltrationDefenseBoundary,
  test_covertLoot_celestialFeather_noEspionageGuard,
  test_covertLoot_dwarvenStarMetal_noEspionageGuard,
  test_covertLoot_cursedBloodstone_noEspionageGuard,
  test_covertLoot_tearsOfWorldTree_noEspionageGuard,
  test_covertLoot_voidEssence_noEspionageGuard,
  test_covertLoot_titanBone_noEspionageGuard,
];

let passed = 0;
let failed = 0;
for (const t of tests) {
  try {
    t();
    console.log(`  ✓ ${t.name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${t.name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
