'use strict';
const assert = require('assert');
const { clearParseCache } = require('../utils/helpers');
const {
  calculateHappiness,
  tavernEntertainmentBonus,
  processTavernAttunements,
  hireMercenaries,
  covertLoot,
} = require('../game/engine');

// Minimal kingdom with taverns, no fragment applied
function baseKingdom(overrides = {}) {
  return {
    race: 'human',
    turn: 10,
    gold: 0,
    food: 0,
    population: 100,
    tax: 42,
    bld_taverns: 5,
    bld_shrines: 0,
    bld_markets: 0,
    bld_farms: 0,
    bld_granaries: 0,
    bld_schools: 0,
    bld_mage_towers: 0,
    bld_mausoleums: 0,
    bld_libraries: 0,
    bld_vaults: 0,
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
    happiness: 50,
    mana: 0,
    prestige_level: 0,
    troop_levels: '{}',
    mercenaries: '[]',
    fragment_bonuses: '{}',
    active_effects: '{}',
    milestone_bonuses: '{}',
    tavern_upgrades: '{}',
    granary_upgrades: '{}',
    maps: 0,
    blueprints_stored: 0,
    ...overrides,
  };
}

// Build fragment_bonuses JSON for taverns
function withTavernFragment(fragmentName) {
  const FRAGMENTS = require('../game/world-fragment-bonuses');
  const config = FRAGMENTS[fragmentName]?.taverns;
  if (!config) throw new Error(`No tavern config for fragment: ${fragmentName}`);
  const bonuses = {
    taverns: {
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

// ── tavernEntertainmentBonus ─────────────────────────────────────────────────

function test_entertainmentBonus_noFragment() {
  clearParseCache();
  const k = baseKingdom({ bld_taverns: 5 });
  const result = tavernEntertainmentBonus(k);
  assert.strictEqual(result, 50, 'base: 5 taverns × 10 = 50');
}

function test_entertainmentBonus_withVolcanicRock() {
  clearParseCache();
  const k = baseKingdom({
    bld_taverns: 4,
    fragment_bonuses: withTavernFragment('Volcanic Rock'),
  });
  // morale=0.25, happiness=0.10: mult = 1.25 * 1.10 = 1.375; floor(40 * 1.375) = 55
  const result = tavernEntertainmentBonus(k);
  assert.strictEqual(result, 55, 'Volcanic Rock: floor(40 * 1.375) = 55');
}

function test_entertainmentBonus_withVoidEssence() {
  clearParseCache();
  const k = baseKingdom({
    bld_taverns: 2,
    fragment_bonuses: withTavernFragment('Void Essence'),
  });
  // morale=1.20, happiness=0.80: mult = 2.20 * 1.80 = 3.96; floor(20 * 3.96) = 79
  const result = tavernEntertainmentBonus(k);
  assert.strictEqual(result, 79, 'Void Essence: floor(20 * 3.96) = 79');
}

function test_entertainmentBonus_zeroTaverns() {
  clearParseCache();
  const k = baseKingdom({ bld_taverns: 0 });
  const result = tavernEntertainmentBonus(k);
  assert.strictEqual(result, 0, 'no taverns returns 0');
}

// ── calculateHappiness tavern fragment delta ─────────────────────────────────

function test_calculateHappiness_noFragment() {
  clearParseCache();
  const k = baseKingdom({ bld_taverns: 3 });
  const result = calculateHappiness(k);
  // No fragment → no fragment delta
  assert.strictEqual(typeof result.happiness, 'number', 'returns number');
  const withoutFrag = result.happiness;

  const k2 = baseKingdom({ bld_taverns: 3, fragment_bonuses: withTavernFragment('Volcanic Rock') });
  clearParseCache();
  const result2 = calculateHappiness(k2);
  // Volcanic Rock: morale=0.25, happiness=0.10; delta = floor(3 * (0.25*4 + 0.10*4) + 1e-9) = floor(3 * 1.4) = floor(4.2) = 4
  assert.ok(result2.happiness > withoutFrag, 'fragment raises happiness vs no-fragment');
}

function test_calculateHappiness_volcRockDelta() {
  clearParseCache();
  // Use a controlled kingdom to get predictable base happiness
  const kBase = baseKingdom({ bld_taverns: 5, gold: 0, food: 0 });
  const kFrag = baseKingdom({
    bld_taverns: 5,
    gold: 0,
    food: 0,
    fragment_bonuses: withTavernFragment('Volcanic Rock'),
  });
  clearParseCache();
  const baseH = calculateHappiness(kBase).happiness;
  clearParseCache();
  const fragH = calculateHappiness(kFrag).happiness;
  // Volcanic Rock: morale=0.25, happiness=0.10; per tavern = (0.25*4 + 0.10*4) = 1.4; 5 taverns = 7
  assert.strictEqual(fragH - baseH, 7, 'Volcanic Rock adds 7 happiness (5 taverns × 1.4)');
}

function test_calculateHappiness_celestialFeatherDelta() {
  clearParseCache();
  const kBase = baseKingdom({ bld_taverns: 5, gold: 0, food: 0 });
  const kFrag = baseKingdom({
    bld_taverns: 5,
    gold: 0,
    food: 0,
    fragment_bonuses: withTavernFragment('Celestial Feather'),
  });
  clearParseCache();
  const baseH = calculateHappiness(kBase).happiness;
  clearParseCache();
  const fragH = calculateHappiness(kFrag).happiness;
  // Celestial Feather: morale=0.40, happiness=0.35; per tavern = (0.40*4 + 0.35*4) = 3.0; 5 taverns = 15
  assert.strictEqual(fragH - baseH, 15, 'Celestial Feather adds 15 happiness (5 taverns × 3.0)');
}

function test_calculateHappiness_voidEssenceDelta() {
  clearParseCache();
  const kBase = baseKingdom({ bld_taverns: 3, gold: 0, food: 0 });
  const kFrag = baseKingdom({
    bld_taverns: 3,
    gold: 0,
    food: 0,
    fragment_bonuses: withTavernFragment('Void Essence'),
  });
  clearParseCache();
  const baseH = calculateHappiness(kBase).happiness;
  clearParseCache();
  const fragH = calculateHappiness(kFrag).happiness;
  // Void Essence: morale=1.20, happiness=0.80; per tavern = (1.20*4 + 0.80*4) = 8.0; 3 taverns = 24
  assert.strictEqual(fragH - baseH, 24, 'Void Essence adds 24 happiness (3 taverns × 8.0)');
}

function test_calculateHappiness_clampsAt120() {
  clearParseCache();
  // High base happiness + Void Essence should clamp at 120
  const k = baseKingdom({
    bld_taverns: 10,
    gold: 999999,
    food: 999999,
    population: 100,
    fragment_bonuses: withTavernFragment('Void Essence'),
  });
  const result = calculateHappiness(k);
  assert.ok(result.happiness <= 120, 'happiness clamped at 120');
}

// ── processTavernAttunements ─────────────────────────────────────────────────

function test_attunements_noFragment() {
  clearParseCache();
  const k = baseKingdom();
  const events = [];
  const updates = processTavernAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'no fragment → empty updates');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_noTaverns() {
  clearParseCache();
  const k = baseKingdom({ bld_taverns: 0, fragment_bonuses: withTavernFragment('Volcanic Rock') });
  const events = [];
  const updates = processTavernAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'no taverns → empty updates');
  assert.strictEqual(events.length, 0, 'no events');
}

function test_attunements_volcanicRock() {
  clearParseCache();
  const k = baseKingdom({ happiness: 60, fragment_bonuses: withTavernFragment('Volcanic Rock') });
  const events = [];
  const updates = processTavernAttunements(k, events);
  assert.strictEqual(updates.happiness, 61, '+1 happiness from Volcanic Rock');
  assert.ok(events.some(e => e.message.includes('Molten Mug')), 'Volcanic Rock event fired');
}

function test_attunements_celestialFeather_below50() {
  clearParseCache();
  const k = baseKingdom({ happiness: 30, fragment_bonuses: withTavernFragment('Celestial Feather') });
  const events = [];
  const updates = processTavernAttunements(k, events);
  assert.strictEqual(updates.happiness, 50, 'Celestial Feather raises happiness floor to 50');
  assert.ok(events.some(e => e.message.includes('Angel Tavern')), 'Celestial Feather event fired');
}

function test_attunements_celestialFeather_above50() {
  clearParseCache();
  const k = baseKingdom({ happiness: 75, fragment_bonuses: withTavernFragment('Celestial Feather') });
  const events = [];
  const updates = processTavernAttunements(k, events);
  assert.strictEqual(updates.happiness, undefined, 'no update when happiness already >= 50');
  assert.strictEqual(events.length, 0, 'no event when happiness already >= 50');
}

function test_attunements_cursedBloodstone_base() {
  clearParseCache();
  // Seed Math.random to return > 0.10 so no chaos penalty
  const origRandom = Math.random;
  Math.random = () => 0.50;
  try {
    const k = baseKingdom({ happiness: 60, fragment_bonuses: withTavernFragment('Cursed Bloodstone') });
    const events = [];
    const updates = processTavernAttunements(k, events);
    assert.strictEqual(updates.happiness, 62, '+2 happiness from Cursed Bloodstone (no chaos)');
    assert.ok(events.some(e => e.message.includes('Cruor Blood Club')), 'main event fired');
    assert.ok(!events.some(e => e.message.includes('chaos')), 'no chaos event');
  } finally {
    Math.random = origRandom;
  }
}

function test_attunements_cursedBloodstone_chaos() {
  clearParseCache();
  // Seed Math.random to return < 0.10 so chaos penalty fires
  const origRandom = Math.random;
  Math.random = () => 0.05;
  try {
    const k = baseKingdom({ happiness: 60, fragment_bonuses: withTavernFragment('Cursed Bloodstone') });
    const events = [];
    const updates = processTavernAttunements(k, events);
    assert.strictEqual(updates.happiness, 61, '+2 -1 chaos = net +1 happiness');
    assert.ok(events.some(e => e.message.includes('chaos')), 'chaos event fired');
  } finally {
    Math.random = origRandom;
  }
}

function test_attunements_voidEssence_base() {
  clearParseCache();
  const origRandom = Math.random;
  Math.random = () => 0.50; // > 0.15, no spatial absence
  try {
    const k = baseKingdom({ happiness: 50, fragment_bonuses: withTavernFragment('Void Essence') });
    const events = [];
    const updates = processTavernAttunements(k, events);
    assert.strictEqual(updates.happiness, 53, '+3 happiness from Void Essence (no absence)');
    assert.ok(events.some(e => e.message.includes('Singularity Saloon')), 'main event fired');
  } finally {
    Math.random = origRandom;
  }
}

function test_attunements_voidEssence_absence() {
  clearParseCache();
  const origRandom = Math.random;
  Math.random = () => 0.10; // < 0.15, spatial absence fires
  try {
    const k = baseKingdom({ happiness: 50, fragment_bonuses: withTavernFragment('Void Essence') });
    const events = [];
    const updates = processTavernAttunements(k, events);
    assert.strictEqual(updates.happiness, 51, '+3 -2 absence = net +1 happiness');
    assert.ok(events.some(e => e.message.includes('spatial absences')), 'absence event fired');
  } finally {
    Math.random = origRandom;
  }
}

function test_attunements_titanBone() {
  clearParseCache();
  const k = baseKingdom({ happiness: 80, fragment_bonuses: withTavernFragment('Titan Bone') });
  const events = [];
  const updates = processTavernAttunements(k, events);
  assert.strictEqual(updates.happiness, 81, '+1 happiness from Titan Bone');
  assert.ok(events.some(e => e.message.includes('Goliath Drink Halls')), 'Titan Bone event fired');
}

function test_attunements_happiness_clampAt120() {
  clearParseCache();
  const k = baseKingdom({ happiness: 119, fragment_bonuses: withTavernFragment('Void Essence') });
  const origRandom = Math.random;
  Math.random = () => 0.50;
  try {
    const events = [];
    const updates = processTavernAttunements(k, events);
    assert.strictEqual(updates.happiness, 120, 'clamped at 120');
  } finally {
    Math.random = origRandom;
  }
}

function test_attunements_noUpdateAt120() {
  clearParseCache();
  // At cap, Volcanic Rock should produce no update or event (no log spam)
  const k = baseKingdom({ happiness: 120, fragment_bonuses: withTavernFragment('Volcanic Rock') });
  const events = [];
  const updates = processTavernAttunements(k, events);
  assert.strictEqual(updates.happiness, undefined, 'no update when already at 120');
  assert.strictEqual(events.length, 0, 'no event when already at 120');
}

function test_attunements_cursedBloodstone_at120_noNetLoss() {
  clearParseCache();
  // When capped at 120, chaos penalty must NOT fire and cause net loss
  const origRandom = Math.random;
  Math.random = () => 0.05; // would trigger chaos if logic were wrong
  try {
    const k = baseKingdom({ happiness: 120, fragment_bonuses: withTavernFragment('Cursed Bloodstone') });
    const events = [];
    const updates = processTavernAttunements(k, events);
    assert.strictEqual(updates.happiness, undefined, 'no update when already at 120');
    assert.strictEqual(events.length, 0, 'no events at cap');
  } finally {
    Math.random = origRandom;
  }
}

// ── hireMercenaries — Tears of the World Tree discount ──────────────────────

function test_hireMerc_noDiscount() {
  clearParseCache();
  const k = baseKingdom({ gold: 100000, bld_taverns: 3 });
  // rabble tier: costPer=50, 10 mercs = 500 gold (no discount)
  const result = hireMercenaries(k, 'fighters', 'rabble', 10);
  assert.ok(!result.error, 'hire succeeds');
  assert.strictEqual(result.hired.cost, 500, 'no discount without fragment');
}

function test_hireMerc_withTearsOfWorldTree() {
  clearParseCache();
  const k = baseKingdom({
    gold: 100000,
    bld_taverns: 3,
    fragment_bonuses: withTavernFragment('Tears of the World Tree'),
  });
  // rabble tier: costPer=50, 10 mercs = 500 * 0.85 = floor(425) = 425
  const result = hireMercenaries(k, 'fighters', 'rabble', 10);
  assert.ok(!result.error, 'hire succeeds with fragment');
  assert.strictEqual(result.hired.cost, 425, '15% discount applied: 500 * 0.85 = 425');
}

function test_hireMerc_otherFragment_noDiscount() {
  clearParseCache();
  const k = baseKingdom({
    gold: 100000,
    bld_taverns: 3,
    fragment_bonuses: withTavernFragment('Volcanic Rock'),
  });
  const result = hireMercenaries(k, 'fighters', 'rabble', 10);
  assert.ok(!result.error, 'hire succeeds');
  assert.strictEqual(result.hired.cost, 500, 'no discount for non-Tears fragment');
}

// ── covertLoot — blueprint protection ───────────────────────────────────────

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
    gold: 50000,
    food: 5000,
    blueprints_stored: 20,
    war_machines: 0,
    maps: 0,
    hammers_stored: 0,
    trade_routes: 0,
    fighters: 0,
    bld_guard_towers: 0,
    bld_armories: 0,
    bld_vaults: 0,
    bld_taverns: 0,
    bank_upgrades: '{}',
    fragment_bonuses: '{}',
    troop_levels: '{}',
    milestone_bonuses: '{}',
    ...overrides,
  };
}

function test_blueprintLoot_noProtection() {
  clearParseCache();
  const thief = baseThief();
  const target = baseTarget({ blueprints_stored: 20 });
  const result = covertLoot(thief, target, 'blueprints', 30);
  assert.ok(result.success, 'loot succeeds');
  assert.ok(result.stolen > 0 || result.stolen === 0, 'stolen is a number');
}

function test_blueprintLoot_mausoleumStarMetal_protected() {
  clearParseCache();
  const thief = baseThief();
  const FRAGMENTS = require('../game/world-fragment-bonuses');
  const mausConfig = FRAGMENTS['Dwarven Star-Metal'].mausoleums;
  const masBonuses = JSON.stringify({
    mausoleums: {
      fragment: 'Dwarven Star-Metal',
      applied_turn: 1,
      passive: mausConfig.passive || {},
      special: { name: mausConfig.special?.name || '', desc: mausConfig.special?.desc || '' },
    },
  });
  const target = baseTarget({ blueprints_stored: 20, fragment_bonuses: masBonuses });
  const result = covertLoot(thief, target, 'blueprints', 30);
  assert.ok(result.success, 'loot call succeeds');
  assert.strictEqual(result.stolen, 0, 'blueprints protected by Star-Metal mausoleum');
  assert.ok(result.targetEvent.includes('0 blueprint'), 'event shows 0 stolen');
}

function test_blueprintLoot_tavernStarMetal_protected() {
  clearParseCache();
  const thief = baseThief();
  const target = baseTarget({
    bld_taverns: 3,
    blueprints_stored: 20,
    fragment_bonuses: withTavernFragment('Dwarven Star-Metal'),
  });
  const result = covertLoot(thief, target, 'blueprints', 30);
  assert.ok(result.success, 'loot call succeeds');
  assert.strictEqual(result.stolen, 0, 'blueprints protected by tavern Star-Metal');
  assert.ok(result.targetEvent.includes('0 blueprint'), 'event shows 0 stolen');
}

// ── Run all tests ─────────────────────────────────────────────────────────────

const tests = [
  test_entertainmentBonus_noFragment,
  test_entertainmentBonus_withVolcanicRock,
  test_entertainmentBonus_withVoidEssence,
  test_entertainmentBonus_zeroTaverns,
  test_calculateHappiness_noFragment,
  test_calculateHappiness_volcRockDelta,
  test_calculateHappiness_celestialFeatherDelta,
  test_calculateHappiness_voidEssenceDelta,
  test_calculateHappiness_clampsAt120,
  test_attunements_noFragment,
  test_attunements_noTaverns,
  test_attunements_volcanicRock,
  test_attunements_celestialFeather_below50,
  test_attunements_celestialFeather_above50,
  test_attunements_cursedBloodstone_base,
  test_attunements_cursedBloodstone_chaos,
  test_attunements_voidEssence_base,
  test_attunements_voidEssence_absence,
  test_attunements_titanBone,
  test_attunements_happiness_clampAt120,
  test_attunements_noUpdateAt120,
  test_attunements_cursedBloodstone_at120_noNetLoss,
  test_hireMerc_noDiscount,
  test_hireMerc_withTearsOfWorldTree,
  test_hireMerc_otherFragment_noDiscount,
  test_blueprintLoot_noProtection,
  test_blueprintLoot_mausoleumStarMetal_protected,
  test_blueprintLoot_tavernStarMetal_protected,
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
