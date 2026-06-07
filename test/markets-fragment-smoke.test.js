'use strict';

const assert = require('assert');
const {
  marketIncomeFull,
  calculateHappiness,
  processMarketAttunements,
  covertLoot,
} = require('../game/engine');
const { clearParseCache } = require('../utils/helpers');

function makeFragmentBonuses(buildingType, fragmentName, passive, specialName) {
  return JSON.stringify({
    [buildingType]: {
      fragment: fragmentName,
      applied_turn: 1,
      passive,
      special: { name: specialName, desc: '' },
    },
  });
}

function baseKingdom(overrides = {}) {
  return {
    race: 'human',
    land: 500,
    bld_walls: 0, bld_shrines: 0, bld_mage_towers: 0, bld_libraries: 0,
    bld_farms: 0, bld_granaries: 0, bld_housing: 0, bld_barracks: 0,
    bld_schools: 0, bld_training: 0, bld_markets: 0, bld_smithies: 0,
    bld_guard_towers: 0, bld_outposts: 0, bld_armories: 0, bld_vaults: 0,
    bld_castles: 0, bld_taverns: 0, bld_mausoleums: 0,
    fighters: 0, rangers: 0, clerics: 0, mages: 0, thieves: 10,
    ninjas: 0, scribes: 0, thralls: 0, researchers: 0, engineers: 0,
    war_machines: 0,
    res_war_machines: 100,
    food: 5000, gold: 10000, mana: 100, res_spellbook: 0,
    res_mana_potions: 0, happiness: 50, population: 1000,
    prestige_level: 0, level: 1,
    maps: 5, trade_routes: 0,
    troop_levels: JSON.stringify({}), active_effects: JSON.stringify({}),
    alliance_buffs: JSON.stringify({}), wall_upgrades: JSON.stringify({}),
    tower_def_upgrades: JSON.stringify({}), defense_upgrades: JSON.stringify({}),
    magic_schools: JSON.stringify({}), scrolls: JSON.stringify({}),
    library_allocation: JSON.stringify({}), library_progress: JSON.stringify({}),
    library_upgrades: JSON.stringify({}), mausoleum_upgrades: JSON.stringify({}),
    market_upgrades: JSON.stringify({}), bank_upgrades: JSON.stringify({}),
    granary_upgrades: JSON.stringify({}), milestone_bonuses: JSON.stringify({}),
    fragment_bonuses: JSON.stringify({}),
    ...overrides,
  };
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  clearParseCache();
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// ── income passive — already wired, validate multiplier stacking ─────────────
console.log('\nincome passive in marketIncomeFull');

test('no fragment: baseline income calculated correctly', () => {
  const k = baseKingdom({ bld_markets: 5, population: 1000 });
  const income = marketIncomeFull(k);
  assert.ok(income > 0, 'Should produce positive income');
});

test('Cursed Bloodstone income 0.50 increases market income by 1.50×', () => {
  const k = baseKingdom({ bld_markets: 5, population: 1000 });
  const base = marketIncomeFull(k);
  const kFrag = {
    ...k,
    fragment_bonuses: makeFragmentBonuses('markets', 'Cursed Bloodstone', { income: 0.50, chaos_index: 0.15 }, 'Sanguine Auction Guilds'),
  };
  const withFrag = marketIncomeFull(kFrag);
  assert.ok(withFrag > base, `Fragment income (${withFrag}) should exceed base (${base})`);
  assert.strictEqual(withFrag, Math.floor(base * 1.50), `Expected 1.50× income, got ratio ${withFrag / base}`);
});

test('Void Essence income 1.20 mind_stability -0.40 — net is 1.20 × 0.60 = 0.72× base', () => {
  const k = baseKingdom({ bld_markets: 5, population: 1000 });
  const base = marketIncomeFull(k);
  const kFrag = {
    ...k,
    fragment_bonuses: makeFragmentBonuses('markets', 'Void Essence', { income: 1.20, mind_stability: -0.40 }, 'Quantum Shopping Matrix'),
  };
  const withFrag = marketIncomeFull(kFrag);
  // net mult = (1 + 1.20) * (1 + -0.40) = 2.20 * 0.60 = 1.32
  const expected = Math.floor(base * 2.20 * 0.60);
  assert.strictEqual(withFrag, expected, `Expected net 1.32× income (${expected}), got ${withFrag}`);
});

// ── capacity_expansion passive (Titan Bone) ──────────────────────────────────
console.log('\ncapacity_expansion passive in marketIncomeFull');

test('Titan Bone capacity_expansion 0.15 increases trade route slots', () => {
  // 10 markets, 20 maps → base tradeRoutes = min(20, 10) = 10
  // with fragment: tradeRoutes = min(20, floor(10 * 1.15)) = min(20, 11) = 11
  const k = baseKingdom({ bld_markets: 10, maps: 20, population: 1000 });
  const base = marketIncomeFull(k);
  const kFrag = {
    ...k,
    fragment_bonuses: makeFragmentBonuses('markets', 'Titan Bone', { income: 0.30, capacity_expansion: 0.15 }, 'Goliath Trade Halls'),
  };
  const withFrag = marketIncomeFull(kFrag);
  assert.ok(withFrag > base, `Capacity expansion + income fragment (${withFrag}) should exceed base (${base})`);
});

test('capacity_expansion with maps=0: no extra routes (nothing to expand into)', () => {
  const k = baseKingdom({ bld_markets: 5, maps: 0, population: 1000 });
  const base = marketIncomeFull(k);
  const kFrag = {
    ...k,
    fragment_bonuses: makeFragmentBonuses('markets', 'Titan Bone', { income: 0.30, capacity_expansion: 0.15 }, 'Goliath Trade Halls'),
  };
  const withFrag = marketIncomeFull(kFrag);
  // income bonus (0.30) still applies; capacity expansion just can't add routes from 0 maps
  assert.ok(withFrag > base, 'Income multiplier still applies even when maps=0');
});

// ── merchant_morale passive (Celestial Feather) in calculateHappiness ────────
console.log('\nmerchant_morale passive in calculateHappiness');

test('no fragment: merchant_morale adds no happiness', () => {
  const kBase = baseKingdom({ bld_markets: 10 });
  const kFrag = baseKingdom({ bld_markets: 10 });
  const base = calculateHappiness(kBase).happiness;
  const withFrag = calculateHappiness(kFrag).happiness;
  assert.strictEqual(withFrag, base, 'No fragment → no change');
});

test('Celestial Feather merchant_morale 0.35 adds per-market happiness', () => {
  // Use low gold so base happiness is not clamped at 120
  const kBase = baseKingdom({ bld_markets: 10, gold: 0, food: 0 });
  const k = baseKingdom({
    bld_markets: 10,
    gold: 0,
    food: 0,
    fragment_bonuses: makeFragmentBonuses('markets', 'Celestial Feather', { income: 0.25, merchant_morale: 0.35 }, 'Heavenly Tithes'),
  });
  const base = calculateHappiness(kBase).happiness;
  const withFrag = calculateHappiness(k).happiness;
  // Expected delta: floor(10 * 0.35 * 5 + 1e-9) = floor(17.5) = 17
  assert.ok(withFrag > base, `Fragment happiness (${withFrag}) should exceed base (${base})`);
  assert.strictEqual(withFrag - base, 17, `Expected +17, got +${withFrag - base}`);
});

// ── anti_theft_security and core_protection in covertLoot ────────────────────
console.log('\nanti_theft_security and core_protection in covertLoot');

function baseThief(overrides = {}) {
  return baseKingdom({ thieves: 500, ...overrides });
}

function baseTarget(overrides = {}) {
  return baseKingdom({
    name: 'Target Kingdom',
    fighters: 0, bld_guard_towers: 0, bld_armories: 0, bld_vaults: 0,
    gold: 100000,
    ...overrides,
  });
}

test('Dragon Scale anti_theft_security 0.40 reduces gold stolen by 40%', () => {
  const thief = baseThief();
  const target = baseTarget({
    fragment_bonuses: makeFragmentBonuses('markets', 'Dragon Scale', { income: 0.05, anti_theft_security: 0.40 }, 'Draconic Coinage'),
  });

  let totalBase = 0, totalFrag = 0;
  const TRIALS = 30;
  for (let i = 0; i < TRIALS; i++) {
    clearParseCache();
    const rBase = covertLoot(baseThief(), baseTarget(), 'gold', 100);
    const rFrag = covertLoot(thief, target, 'gold', 100);
    if (rBase.success) totalBase += rBase.stolen;
    if (rFrag.success) totalFrag += rFrag.stolen;
  }
  assert.ok(totalBase > 0, 'Base should steal some gold');
  assert.ok(totalFrag < totalBase, `Anti-theft (${totalFrag}) should steal less than base (${totalBase})`);
  // approx 60% of base
  const ratio = totalFrag / totalBase;
  assert.ok(ratio > 0.3 && ratio < 0.85, `Ratio ${ratio.toFixed(2)} should be ~0.60`);
});

test('Dwarven Star-Metal core_protection 1.0 blocks all gold theft', () => {
  const thief = baseThief();
  const target = baseTarget({
    fragment_bonuses: makeFragmentBonuses('markets', 'Dwarven Star-Metal', { income: 0.40, core_protection: 1.0 }, 'Star-Metal Lockbox Ledgers'),
  });

  for (let i = 0; i < 10; i++) {
    clearParseCache();
    const r = covertLoot(thief, target, 'gold', 100);
    if (r.success) {
      assert.strictEqual(r.stolen, 0, 'Star-Metal Lockbox Ledgers should block all gold theft');
      assert.ok(r.thiefEvent.includes('Star-Metal Lockbox Ledgers'), 'Should mention protection name');
    }
  }
});

test('non-gold loot not affected by anti_theft_security', () => {
  const thief = baseThief();
  const target = baseTarget({
    food: 50000,
    fragment_bonuses: makeFragmentBonuses('markets', 'Dragon Scale', { income: 0.05, anti_theft_security: 0.40 }, 'Draconic Coinage'),
  });
  clearParseCache();
  const r = covertLoot(thief, target, 'food', 100);
  if (r.success) {
    assert.ok(r.stolen > 0, 'Food theft should not be reduced by market anti_theft');
  }
});

// ── processMarketAttunements ─────────────────────────────────────────────────
console.log('\nprocessMarketAttunements');

test('no fragment: returns empty updates', () => {
  const k = baseKingdom({ bld_markets: 5 });
  const events = [];
  const updates = processMarketAttunements(k, events);
  assert.deepStrictEqual(updates, {});
  assert.strictEqual(events.length, 0);
});

test('no markets: returns early', () => {
  const k = baseKingdom({
    bld_markets: 0,
    fragment_bonuses: makeFragmentBonuses('markets', 'Volcanic Rock', { income: 0.15, metal_trading: 0.10 }, 'Geothermal Foundry-Market'),
  });
  const updates = processMarketAttunements(k, []);
  assert.deepStrictEqual(updates, {});
});

test('Geothermal Foundry-Market (Volcanic Rock): +markets×10 gold/turn', () => {
  const k = baseKingdom({
    bld_markets: 5,
    gold: 10000,
    fragment_bonuses: makeFragmentBonuses('markets', 'Volcanic Rock', { income: 0.15, metal_trading: 0.10 }, 'Geothermal Foundry-Market'),
  });
  const events = [];
  const updates = processMarketAttunements(k, events);
  assert.strictEqual(updates.gold, 10050, 'Should add 5 × 10 = 50 gold');
  assert.ok(events.some(e => e.message && e.message.includes('Geothermal Foundry-Market')));
});

test('Shadow Exchanges (Abyssal Crystal): +markets×15 gold/turn', () => {
  const k = baseKingdom({
    bld_markets: 4,
    gold: 10000,
    fragment_bonuses: makeFragmentBonuses('markets', 'Abyssal Crystal', { secret_decoding: 0.30, dark_trade_gains: 0.15 }, 'Shadow Exchanges'),
  });
  const events = [];
  const updates = processMarketAttunements(k, events);
  assert.strictEqual(updates.gold, 10060, 'Should add 4 × 15 = 60 gold');
  assert.ok(events.some(e => e.message && e.message.includes('Shadow Exchanges')));
});

test('Heavenly Tithes (Celestial Feather): +2 happiness/turn', () => {
  const k = baseKingdom({
    bld_markets: 5,
    happiness: 60,
    fragment_bonuses: makeFragmentBonuses('markets', 'Celestial Feather', { income: 0.25, merchant_morale: 0.35 }, 'Heavenly Tithes'),
  });
  const events = [];
  const updates = processMarketAttunements(k, events);
  assert.strictEqual(updates.happiness, 62, 'Should add +2 happiness');
  assert.ok(events.some(e => e.message && e.message.includes('Heavenly Tithes')));
});

test('Heavenly Tithes: clamps at 120', () => {
  const k = baseKingdom({
    bld_markets: 5,
    happiness: 119,
    fragment_bonuses: makeFragmentBonuses('markets', 'Celestial Feather', { income: 0.25, merchant_morale: 0.35 }, 'Heavenly Tithes'),
  });
  const updates = processMarketAttunements(k, []);
  assert.strictEqual(updates.happiness, 120, 'Should clamp at 120');
});

test('Sanguine Auction Guilds (Cursed Bloodstone): +markets×25 gold/turn', () => {
  const k = baseKingdom({
    bld_markets: 3,
    gold: 10000,
    happiness: 50,
    fragment_bonuses: makeFragmentBonuses('markets', 'Cursed Bloodstone', { income: 0.50, chaos_index: 0.15 }, 'Sanguine Auction Guilds'),
  });
  const events = [];
  const updates = processMarketAttunements(k, events);
  assert.strictEqual(updates.gold, 10075, 'Should add 3 × 25 = 75 gold');
  assert.ok(events.some(e => e.message && e.message.includes('Sanguine Auction Guilds')));
});

test('Sanguine Auction Guilds: chaos happiness penalty fires statistically (~10%)', () => {
  const k = baseKingdom({
    bld_markets: 3,
    gold: 10000,
    happiness: 50,
    fragment_bonuses: makeFragmentBonuses('markets', 'Cursed Bloodstone', { income: 0.50, chaos_index: 0.15 }, 'Sanguine Auction Guilds'),
  });
  let penaltyCount = 0;
  const TRIALS = 300;
  for (let i = 0; i < TRIALS; i++) {
    clearParseCache();
    const updates = processMarketAttunements(k, []);
    if (updates.happiness !== undefined && updates.happiness < 50) penaltyCount++;
  }
  const rate = penaltyCount / TRIALS;
  assert.ok(rate > 0.01 && rate < 0.25, `Chaos rate ${(rate * 100).toFixed(1)}% should be ~10%`);
});

test('Quantum Shopping Matrix (Void Essence): 15% chance -3 happiness — statistical', () => {
  const k = baseKingdom({
    bld_markets: 5,
    happiness: 50,
    fragment_bonuses: makeFragmentBonuses('markets', 'Void Essence', { income: 1.20, mind_stability: -0.40 }, 'Quantum Shopping Matrix'),
  });
  let triggered = 0;
  const TRIALS = 200;
  for (let i = 0; i < TRIALS; i++) {
    clearParseCache();
    const updates = processMarketAttunements(k, []);
    if (updates.happiness !== undefined && updates.happiness < 50) triggered++;
  }
  const rate = triggered / TRIALS;
  assert.ok(rate > 0.03 && rate < 0.35, `Trigger rate ${(rate * 100).toFixed(1)}% should be ~15%`);
});

test('Quantum Shopping Matrix: when triggered, happiness drops by exactly 3', () => {
  const k = baseKingdom({
    bld_markets: 5,
    happiness: 50,
    fragment_bonuses: makeFragmentBonuses('markets', 'Void Essence', { income: 1.20, mind_stability: -0.40 }, 'Quantum Shopping Matrix'),
  });
  let found = false;
  for (let i = 0; i < 500; i++) {
    clearParseCache();
    const events = [];
    const updates = processMarketAttunements(k, events);
    if (updates.happiness !== undefined) {
      assert.strictEqual(updates.happiness, 47, 'Should be 50 - 3 = 47');
      assert.ok(events.some(e => e.message && e.message.includes('Quantum Shopping Matrix')));
      found = true;
      break;
    }
  }
  assert.ok(found, 'Should trigger at least once in 500 trials');
});

test('Ancient Elven Wood / Sylvan Whispering Bazaars: no per-turn event (passive-only)', () => {
  const k = baseKingdom({
    bld_markets: 5,
    fragment_bonuses: makeFragmentBonuses('markets', 'Ancient Elven Wood', { income: 0.20, forest_trade: 0.25 }, 'Sylvan Whispering Bazaars'),
  });
  const events = [];
  const updates = processMarketAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'Sylvan Whispering Bazaars has no per-turn special effect');
  assert.strictEqual(events.length, 0);
});

test('Dragon Scale / Draconic Coinage: no per-turn event (passive-only)', () => {
  const k = baseKingdom({
    bld_markets: 5,
    fragment_bonuses: makeFragmentBonuses('markets', 'Dragon Scale', { income: 0.05, anti_theft_security: 0.40 }, 'Draconic Coinage'),
  });
  const events = [];
  const updates = processMarketAttunements(k, events);
  assert.deepStrictEqual(updates, {}, 'Draconic Coinage has no per-turn special effect');
});

// Summary
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
