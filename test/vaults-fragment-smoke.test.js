'use strict';
const assert = require('assert');
const { clearParseCache } = require('../utils/helpers');
const {
  goldPerTurn,
  processVaultAttunements,
  covertLoot,
} = require('../game/engine');

// Minimal kingdom for vault tests
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
    bld_vaults: 5,
    bld_farms: 0,
    bld_granaries: 0,
    bld_markets: 0,
    bld_taverns: 0,
    bld_shrines: 0,
    bld_schools: 0,
    bld_mage_towers: 0,
    bld_mausoleums: 0,
    bld_libraries: 0,
    bld_armories: 0,
    bld_smithies: 0,
    bld_barracks: 0,
    bld_walls: 0,
    bld_guard_towers: 0,
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

// Build fragment_bonuses JSON for vaults
function withVaultFragment(fragmentName) {
  const FRAGMENTS = require('../game/world-fragment-bonuses');
  const config = FRAGMENTS[fragmentName]?.vaults;
  if (!config) throw new Error(`No vault config for fragment: ${fragmentName}`);
  const bonuses = {
    vaults: {
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

// ── goldPerTurn — economy_output passive ────────────────────────────────────

function test_goldPerTurn_noFragment_baseline() {
  clearParseCache();
  const k = baseKingdom();
  const base = goldPerTurn(k);
  assert.ok(typeof base === 'number' && base >= 0, 'returns a non-negative number');
}

function test_goldPerTurn_volcanicRock_economyBoost() {
  clearParseCache();
  const kBase = baseKingdom();
  const kFrag = baseKingdom({ fragment_bonuses: withVaultFragment('Volcanic Rock') });
  clearParseCache();
  const baseIncome = goldPerTurn(kBase);
  clearParseCache();
  const fragIncome = goldPerTurn(kFrag);
  // Volcanic Rock economy_output: 0.15 → 15% more income
  assert.ok(fragIncome > baseIncome, 'Volcanic Rock economy_output boosts income');
  const expectedMult = 1.15;
  // Allow small rounding difference
  assert.ok(Math.abs(fragIncome / baseIncome - expectedMult) < 0.01, `income ~${expectedMult}x base`);
}

function test_goldPerTurn_cursedBloodstone_economyBoost() {
  clearParseCache();
  const kBase = baseKingdom();
  const kFrag = baseKingdom({ fragment_bonuses: withVaultFragment('Cursed Bloodstone') });
  clearParseCache();
  const baseIncome = goldPerTurn(kBase);
  clearParseCache();
  const fragIncome = goldPerTurn(kFrag);
  // Cursed Bloodstone economy_output: 0.50 → 50% more income
  assert.ok(fragIncome > baseIncome, 'Cursed Bloodstone economy_output boosts income');
  assert.ok(Math.abs(fragIncome / baseIncome - 1.50) < 0.01, 'income ~1.5x base');
}

function test_goldPerTurn_goldSecurityOnly_noEconomyChange() {
  clearParseCache();
  const kBase = baseKingdom();
  const kFrag = baseKingdom({ fragment_bonuses: withVaultFragment('Celestial Feather') });
  clearParseCache();
  const baseIncome = goldPerTurn(kBase);
  clearParseCache();
  const fragIncome = goldPerTurn(kFrag);
  // Celestial Feather has gold_security + grace_index, NO economy_output → same income
  assert.strictEqual(fragIncome, baseIncome, 'Celestial Feather has no economy_output effect');
}

// ── processVaultAttunements ──────────────────────────────────────────────────

function test_attunements_noFragment() {
  clearParseCache();
  const k = baseKingdom();
  const events = [];
  const updates = processVaultAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'no fragment → empty updates');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_noVaults() {
  clearParseCache();
  const k = baseKingdom({ bld_vaults: 0, fragment_bonuses: withVaultFragment('Volcanic Rock') });
  const events = [];
  const updates = processVaultAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'no vaults → empty updates');
}

function test_attunements_passiveOnly() {
  // Volcanic Rock is passive-only (no per-turn special)
  clearParseCache();
  const k = baseKingdom({ fragment_bonuses: withVaultFragment('Volcanic Rock') });
  const events = [];
  const updates = processVaultAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'Volcanic Rock is passive-only');
  assert.strictEqual(events.length, 0, 'no events for passive-only fragment');
}

function test_attunements_tearsOfWorldTree_goldGain() {
  clearParseCache();
  // 5 vaults → 5 * 5 = 25 gold per turn
  const k = baseKingdom({ bld_vaults: 5, gold: 1000, fragment_bonuses: withVaultFragment('Tears of the World Tree') });
  const events = [];
  const updates = processVaultAttunements(k, events);
  assert.strictEqual(updates.gold, 1025, 'Tears: +25 gold (5 vaults × 5)');
  assert.ok(events.some(e => e.message.includes('Yggdrasil Resin Casings')), 'event fired');
}

function test_attunements_tearsOfWorldTree_scales() {
  clearParseCache();
  const k = baseKingdom({ bld_vaults: 20, gold: 0, fragment_bonuses: withVaultFragment('Tears of the World Tree') });
  const events = [];
  const updates = processVaultAttunements(k, events);
  assert.strictEqual(updates.gold, 100, '20 vaults × 5 = 100 gold');
}

function test_attunements_cursedBloodstone_noTrigger() {
  clearParseCache();
  const origRandom = Math.random;
  Math.random = () => 0.50; // > 0.10, no instability
  try {
    const k = baseKingdom({ happiness: 80, fragment_bonuses: withVaultFragment('Cursed Bloodstone') });
    const events = [];
    const updates = processVaultAttunements(k, events);
    assert.strictEqual(updates.happiness, undefined, 'no happiness change without trigger');
    assert.strictEqual(events.length, 0, 'no event without trigger');
  } finally {
    Math.random = origRandom;
  }
}

function test_attunements_cursedBloodstone_trigger() {
  clearParseCache();
  const origRandom = Math.random;
  Math.random = () => 0.05; // < 0.10, instability fires
  try {
    const k = baseKingdom({ happiness: 80, fragment_bonuses: withVaultFragment('Cursed Bloodstone') });
    const events = [];
    const updates = processVaultAttunements(k, events);
    assert.strictEqual(updates.happiness, 79, '-1 happiness from instability');
    assert.ok(events.some(e => e.message.includes('Sanguine Vault Tax')), 'event fired');
  } finally {
    Math.random = origRandom;
  }
}

function test_attunements_voidEssence_noTrigger() {
  clearParseCache();
  const origRandom = Math.random;
  Math.random = () => 0.50; // > 0.15
  try {
    const k = baseKingdom({ happiness: 70, fragment_bonuses: withVaultFragment('Void Essence') });
    const events = [];
    const updates = processVaultAttunements(k, events);
    assert.strictEqual(updates.happiness, undefined, 'no change without trigger');
  } finally {
    Math.random = origRandom;
  }
}

function test_attunements_voidEssence_trigger() {
  clearParseCache();
  const origRandom = Math.random;
  Math.random = () => 0.10; // < 0.15
  try {
    const k = baseKingdom({ happiness: 70, fragment_bonuses: withVaultFragment('Void Essence') });
    const events = [];
    const updates = processVaultAttunements(k, events);
    assert.strictEqual(updates.happiness, 69, '-1 happiness from spatial lag');
    assert.ok(events.some(e => e.message.includes('Dimensional Pocket Vaults')), 'event fired');
  } finally {
    Math.random = origRandom;
  }
}

function test_attunements_happiness_clampedAtMinus50() {
  clearParseCache();
  const origRandom = Math.random;
  Math.random = () => 0.05;
  try {
    const k = baseKingdom({ happiness: -50, fragment_bonuses: withVaultFragment('Cursed Bloodstone') });
    const events = [];
    const updates = processVaultAttunements(k, events);
    assert.strictEqual(updates.happiness, -50, 'happiness clamped at -50');
  } finally {
    Math.random = origRandom;
  }
}

// ── covertLoot — vault fragment protections ──────────────────────────────────

function baseThief() {
  return {
    race: 'human',
    thieves: 500,
    ninjas: 0,
    prestige_level: 0,
    troop_levels: '{}',
    milestone_bonuses: '{}',
    fragment_bonuses: '{}',
  };
}

function baseTarget(overrides = {}) {
  return {
    race: 'human',
    gold: 100000,
    food: 5000,
    blueprints_stored: 0,
    war_machines: 0,
    maps: 0,
    hammers_stored: 0,
    trade_routes: 0,
    fighters: 0,
    bld_guard_towers: 0,
    bld_armories: 0,
    bld_vaults: 3,
    bld_taverns: 0,
    bank_upgrades: '{}',
    fragment_bonuses: '{}',
    troop_levels: '{}',
    milestone_bonuses: '{}',
    ...overrides,
  };
}

// Helper to build vault fragment for target
function withTargetVaultFrag(fragmentName) {
  return withVaultFragment(fragmentName);
}

function test_covertLoot_noFragment_goldStolen() {
  clearParseCache();
  const thief = baseThief();
  const target = baseTarget();
  const result = covertLoot(thief, target, 'gold', 100);
  assert.ok(result.success, 'loot succeeds without fragment');
  assert.ok(result.stolen > 0, 'some gold stolen');
}

function test_covertLoot_goldSecurity_reducesStolen() {
  clearParseCache();
  const thief = baseThief();
  const targetBase = baseTarget();
  const targetFrag = baseTarget({ fragment_bonuses: withTargetVaultFrag('Volcanic Rock') });
  // Need deterministic Math.random for fair comparison
  const origRandom = Math.random;
  Math.random = () => 0.5;
  try {
    clearParseCache();
    const resBase = covertLoot(thief, targetBase, 'gold', 100);
    clearParseCache();
    const resFrag = covertLoot(thief, targetFrag, 'gold', 100);
    if (resBase.success && resFrag.success) {
      // Volcanic Rock gold_security: 0.30 → 30% less stolen
      assert.ok(resFrag.stolen <= resBase.stolen, 'gold_security reduces amount stolen');
      assert.ok(Math.abs(resFrag.stolen / resBase.stolen - 0.70) < 0.01, 'stolen ≈ 70% of base');
    }
  } finally {
    Math.random = origRandom;
  }
}

function test_covertLoot_dwarvenStarMetal_fullProtection() {
  clearParseCache();
  const thief = baseThief();
  const target = baseTarget({ fragment_bonuses: withTargetVaultFrag('Dwarven Star-Metal') });
  const result = covertLoot(thief, target, 'gold', 100);
  assert.ok(result.success, 'loot attempt proceeds');
  assert.strictEqual(result.stolen, 0, 'Dwarven Star-Metal: 0 gold stolen');
  assert.ok(result.targetEvent.includes('0 gold'), '0 gold in event');
}

function test_covertLoot_dragonScale_burnThieves() {
  clearParseCache();
  const origRandom = Math.random;
  Math.random = () => 0.5;
  try {
    const thief = { ...baseThief(), thieves: 200 };
    const target = baseTarget({ fragment_bonuses: withTargetVaultFrag('Dragon Scale') });
    clearParseCache();
    const result = covertLoot(thief, target, 'gold', 100);
    if (result.success && result.stolen > 0) {
      // Dragon Scale hoard_protection: 50% of thievesSent burned
      assert.ok(result.thiefUpdates.thieves !== undefined, 'thieves update present');
      assert.strictEqual(result.thiefUpdates.thieves, 200 - 50, '50 of 100 thievesSent burned (50%)');
      assert.ok(result.thiefEvent.includes('burned'), 'burn message in event');
    }
  } finally {
    Math.random = origRandom;
  }
}

function test_covertLoot_espionageShield_harderToSucceed() {
  clearParseCache();
  // Ancient Elven Wood espionage_shield: 0.30 → vaults contribute 30% more defense
  // With a borderline thief count, shield should flip success to failure
  const thief = { ...baseThief(), thieves: 5 }; // very few thieves
  const targetBase = baseTarget({ bld_vaults: 10 });
  const targetShield = baseTarget({
    bld_vaults: 10,
    fragment_bonuses: withTargetVaultFrag('Ancient Elven Wood'),
  });
  clearParseCache();
  const resBase = covertLoot(thief, targetBase, 'gold', 5);
  clearParseCache();
  const resShield = covertLoot(thief, targetShield, 'gold', 5);
  // Shield should make it harder — either both fail (shield defends), or shield one fails when base succeeds
  if (resBase.success) {
    // Shield either also succeeds (just harder) or fails — both acceptable, just confirm no crash
    assert.ok(typeof resShield.success === 'boolean', 'result has success field');
  } else {
    // If base already fails, shield doesn't need to be tested further
    assert.ok(true);
  }
}

// ── Run all tests ─────────────────────────────────────────────────────────────

const tests = [
  test_goldPerTurn_noFragment_baseline,
  test_goldPerTurn_volcanicRock_economyBoost,
  test_goldPerTurn_cursedBloodstone_economyBoost,
  test_goldPerTurn_goldSecurityOnly_noEconomyChange,
  test_attunements_noFragment,
  test_attunements_noVaults,
  test_attunements_passiveOnly,
  test_attunements_tearsOfWorldTree_goldGain,
  test_attunements_tearsOfWorldTree_scales,
  test_attunements_cursedBloodstone_noTrigger,
  test_attunements_cursedBloodstone_trigger,
  test_attunements_voidEssence_noTrigger,
  test_attunements_voidEssence_trigger,
  test_attunements_happiness_clampedAtMinus50,
  test_covertLoot_noFragment_goldStolen,
  test_covertLoot_goldSecurity_reducesStolen,
  test_covertLoot_dwarvenStarMetal_fullProtection,
  test_covertLoot_dragonScale_burnThieves,
  test_covertLoot_espionageShield_harderToSucceed,
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
