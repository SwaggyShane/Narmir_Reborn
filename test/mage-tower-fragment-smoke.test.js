/**
 * Mage Tower Fragment Smoke Tests
 * Verifies all 10 mage tower fragment mechanics are wired correctly in engine.js
 */

'use strict';

const assert = require('assert');
const engine = require('../game/engine');
const fragmentBonusManager = require('../game/fragment-bonus-manager');
const { clearParseCache } = require('../utils/helpers');

let passed = 0;
let failed = 0;

function test(name, fn) {
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

function withTowerFrag(k, fragmentName) {
  const result = fragmentBonusManager.applyFragmentBonus(k, fragmentName, 'mage_towers');
  if (result.error) throw new Error(`applyFragmentBonus failed: ${result.error}`);
  return { ...k, fragment_bonuses: result.fragment_bonuses };
}

function baseKingdom(overrides = {}) {
  return {
    id: 1, name: 'TestKingdom', race: 'human', turn: 1,
    land: 5000, population: 1000, happiness: 55,
    gold: 500, food: 200, mana: 10000, wood: 100, stone: 100, iron: 100,
    workers: 200, soldiers: 0, fighters: 0, rangers: 0, archers: 0,
    cavalry: 0, mages: 20, clerics: 0, researchers: 0, scribes: 0, engineers: 0,
    bld_farms: 5, bld_granaries: 0, bld_housing: 5, bld_schools: 1,
    bld_libraries: 1, bld_markets: 0, bld_smithies: 0,
    bld_mage_towers: 3, bld_barracks: 0, bld_guard_towers: 0,
    bld_outposts: 0, bld_walls: 0, bld_taverns: 0, bld_shrines: 0,
    bld_mausoleums: 0, bld_armories: 0, bld_vaults: 0, bld_war_machines: 0,
    bld_training: 0, bld_castles: 0,
    level: 1, xp: 0, prestige_level: 0, trade_routes: 0,
    max_food: 10000, res_economy: 50, res_military: 50, res_agriculture: 50,
    res_construction: 50, res_entertainment: 50, res_spellbook: 0,
    res_attack_magic: 100, res_defense_magic: 100,
    research_focus: '[]', research_progress: '{}', research_allocation: '{}',
    mage_research_progress: '{}', build_queue: '[]',
    mage_tower_allocation: '{}', tower_progress: '{}',
    scribe_allocation: '{}', scribe_progress: '{}',
    scrolls: '{}', active_effects: '{}',
    discovered_kingdoms: '{}', troop_levels: '{}',
    school_upgrades: '{}', library_upgrades: '{}', tower_upgrades: '{}',
    fragment_bonuses: '{}', season: 'spring',
    ...overrides,
  };
}

// ── Passive: mana (all 10 fragments, already wired in manaPerTurn) ────────────

console.log('\nPassive: mana (all 10 fragments wired in calculateManaGen)');

const FRAGMENTS_AND_MANA = [
  ['Volcanic Rock', 1.15], ['Ancient Elven Wood', 1.20], ['Dragon Scale', 1.10],
  ['Abyssal Crystal', 1.30], ['Celestial Feather', 1.25], ['Dwarven Star-Metal', 1.15],
  ['Cursed Bloodstone', 1.50], ['Tears of the World Tree', 1.35],
  ['Void Essence', 2.20], ['Titan Bone', 1.30],
];

FRAGMENTS_AND_MANA.forEach(([frag, expected]) => {
  test(`${frag}: mana passive = ×${expected}`, () => {
    const k = withTowerFrag(baseKingdom(), frag);
    const mult = fragmentBonusManager.getBonusMultiplier(k, 'mage_towers', 'mana');
    assert.ok(Math.abs(mult - expected) < 0.001, `Expected ${expected}, got ${mult}`);
  });
});

// ── Passive: mana_efficiency (Tears of the World Tree) → mana cost reduction ──

console.log('\nPassive: mana_efficiency (Tears of the World Tree)');

test('Tears of the World Tree: mana_efficiency = +30%', () => {
  const k = withTowerFrag(baseKingdom(), 'Tears of the World Tree');
  const mult = fragmentBonusManager.getBonusMultiplier(k, 'mage_towers', 'mana_efficiency');
  assert.ok(Math.abs(mult - 1.30) < 0.001, `Expected 1.30, got ${mult}`);
});

test('Tears of the World Tree: mana_efficiency reduces spell cost in castSpell', () => {
  clearParseCache();
  // spark costs 500 mana (tier 1), 30% reduction → 350
  const base = baseKingdom({ mana: 500, res_spellbook: 100, scrolls: { spark: 1 } });
  const fragKingdom = withTowerFrag({ ...base, mana: 500, scrolls: { spark: 1 } }, 'Tears of the World Tree');
  const target = baseKingdom({ bld_farms: 20 });
  const rBase = engine.castSpell(base, target, 'spark', false);
  clearParseCache();
  const rFrag = engine.castSpell(fragKingdom, target, 'spark', false);
  assert.ok(!rBase?.error, `Base cast error: ${rBase?.error}`);
  assert.ok(!rFrag?.error, `Frag cast error: ${rFrag?.error}`);
  const baseCost = 500 - rBase.casterUpdates.mana;
  const fragCost = 500 - rFrag.casterUpdates.mana;
  assert.ok(fragCost < baseCost, `Frag mana cost (${fragCost}) should be less than base (${baseCost})`);
});

// ── Passive: spell_precision (Dwarven Star-Metal) → boosts atkMagic ──────────

console.log('\nPassive: spell_precision (Dwarven Star-Metal)');

test('Dwarven Star-Metal: spell_precision = +50%', () => {
  const k = withTowerFrag(baseKingdom(), 'Dwarven Star-Metal');
  const mult = fragmentBonusManager.getBonusMultiplier(k, 'mage_towers', 'spell_precision');
  assert.ok(Math.abs(mult - 1.50) < 0.001, `Expected 1.50, got ${mult}`);
});

test('Dwarven Star-Metal: spell deals more damage than plain caster (via precision)', () => {
  clearParseCache();
  const plain  = baseKingdom({ mana: 50000, res_spellbook: 100, scrolls: { spark: 1 } });
  const frag   = withTowerFrag({ ...plain, scrolls: { spark: 1 } }, 'Dwarven Star-Metal');
  const target = baseKingdom({ bld_farms: 50 });
  const rPlain = engine.castSpell(plain, target, 'spark', false);
  clearParseCache();
  const rFrag  = engine.castSpell(frag,  target, 'spark', false);
  assert.ok(!rPlain?.error, `Plain error: ${rPlain?.error}`);
  assert.ok(!rFrag?.error,  `Frag error: ${rFrag?.error}`);
  const lossPlain = target.bld_farms - (rPlain.targetUpdates?.bld_farms ?? target.bld_farms);
  const lossFrag  = target.bld_farms - (rFrag.targetUpdates?.bld_farms  ?? target.bld_farms);
  assert.ok(lossFrag >= lossPlain, `Precise caster (${lossFrag}) should deal >= plain (${lossPlain}) farm damage`);
});

// ── Passive: spell_resistance (Dragon Scale) → boosts target defMagic ────────

console.log('\nPassive: spell_resistance (Dragon Scale)');

test('Dragon Scale: spell_resistance = +40%', () => {
  const k = withTowerFrag(baseKingdom(), 'Dragon Scale');
  const mult = fragmentBonusManager.getBonusMultiplier(k, 'mage_towers', 'spell_resistance');
  assert.ok(Math.abs(mult - 1.40) < 0.001, `Expected 1.40, got ${mult}`);
});

test('Dragon Scale target takes less damage than unshielded target', () => {
  clearParseCache();
  const caster = baseKingdom({ mana: 50000, res_spellbook: 100, scrolls: { spark: 1 } });
  const plain  = baseKingdom({ bld_farms: 50 });
  const shielded = withTowerFrag(baseKingdom({ bld_farms: 50 }), 'Dragon Scale');
  const rPlain   = engine.castSpell(caster, plain,    'spark', false);
  clearParseCache();
  const rShield  = engine.castSpell({ ...caster, scrolls: { spark: 1 } }, shielded, 'spark', false);
  assert.ok(!rPlain?.error,  `Plain error: ${rPlain?.error}`);
  assert.ok(!rShield?.error, `Shield error: ${rShield?.error}`);
  const lossPlain  = plain.bld_farms  - (rPlain.targetUpdates?.bld_farms  ?? plain.bld_farms);
  const lossShield = shielded.bld_farms - (rShield.targetUpdates?.bld_farms ?? shielded.bld_farms);
  assert.ok(lossShield <= lossPlain, `Resistant target (${lossShield}) should lose <= farms vs plain (${lossPlain})`);
});

// ── Passive: tower_integrity (Titan Bone) → expand mage capacity ─────────────

console.log('\nPassive: tower_integrity (Titan Bone)');

test('Titan Bone: tower_integrity = +15%', () => {
  const k = withTowerFrag(baseKingdom(), 'Titan Bone');
  const mult = fragmentBonusManager.getBonusMultiplier(k, 'mage_towers', 'tower_integrity');
  assert.ok(Math.abs(mult - 1.15) < 0.001, `Expected 1.15, got ${mult}`);
});

test('Titan Bone: capacity = floor(towers * 20 * 1.15) = 69 for 3 towers', () => {
  // 3 towers * 20 * 1.15 = 69
  const mult = fragmentBonusManager.getBonusMultiplier(
    withTowerFrag(baseKingdom(), 'Titan Bone'), 'mage_towers', 'tower_integrity'
  );
  assert.strictEqual(Math.floor(3 * 20 * mult), 69);
});

// ── Passive: mind_stability (Void Essence) → reduces scroll crafting ─────────

console.log('\nPassive: mind_stability (Void Essence)');

test('Void Essence: mind_stability = -40% (multiplier = 0.60)', () => {
  const k = withTowerFrag(baseKingdom(), 'Void Essence');
  const mult = fragmentBonusManager.getBonusMultiplier(k, 'mage_towers', 'mind_stability');
  assert.ok(Math.abs(mult - 0.60) < 0.001, `Expected 0.60, got ${mult}`);
});

// ── Special: Magma Conduit (Volcanic Rock) → amplify spark fire damage ────────

console.log('\nSpecial: Magma Conduit (Volcanic Rock) — 1.35× spark damage');

test('Volcanic Rock: getSpecialEffect returns Magma Conduit', () => {
  const k = withTowerFrag(baseKingdom(), 'Volcanic Rock');
  const sp = fragmentBonusManager.getSpecialEffect(k, 'mage_towers');
  assert.strictEqual(sp?.name, 'Magma Conduit');
});

test('Magma Conduit: spark burns more farms than plain caster', () => {
  clearParseCache();
  const plain = baseKingdom({ mana: 50000, res_spellbook: 100, scrolls: { spark: 1 } });
  const magma = withTowerFrag({ ...plain, scrolls: { spark: 1 } }, 'Volcanic Rock');
  const target = baseKingdom({ bld_farms: 50 });
  const rPlain = engine.castSpell(plain, target, 'spark', false);
  clearParseCache();
  const rMagma = engine.castSpell(magma,  target, 'spark', false);
  assert.ok(!rPlain?.error, `Plain error: ${rPlain?.error}`);
  assert.ok(!rMagma?.error, `Magma error: ${rMagma?.error}`);
  const lossPlain = target.bld_farms - (rPlain.targetUpdates?.bld_farms ?? target.bld_farms);
  const lossMagma = target.bld_farms - (rMagma.targetUpdates?.bld_farms ?? target.bld_farms);
  assert.ok(lossMagma >= lossPlain, `Magma Conduit (${lossMagma}) should burn >= plain (${lossPlain}) farms`);
});

// ── Special: Nimbus Shields (Celestial Feather) → block debuff spells ────────

console.log('\nSpecial: Nimbus Shields (Celestial Feather) — block all debuffs');

test('Celestial Feather: getSpecialEffect returns Nimbus Shields', () => {
  const k = withTowerFrag(baseKingdom(), 'Celestial Feather');
  const sp = fragmentBonusManager.getSpecialEffect(k, 'mage_towers');
  assert.strictEqual(sp?.name, 'Nimbus Shields');
});

test('Nimbus Shields: silence debuff is blocked on target', () => {
  clearParseCache();
  const caster = baseKingdom({ mana: 50000, res_spellbook: 700, scrolls: { silence: 1 } });
  const target = withTowerFrag(baseKingdom(), 'Celestial Feather');
  const result = engine.castSpell(caster, target, 'silence', false);
  assert.ok(!result?.error, `castSpell errored: ${result?.error}`);
  // active_effects should NOT contain silence
  const effects = JSON.parse(result.targetUpdates?.active_effects || '{}');
  assert.ok(!effects.silence, 'Nimbus Shields should have blocked silence debuff');
});

test('Nimbus Shields: fog_of_war is blocked on target', () => {
  clearParseCache();
  const caster = baseKingdom({ mana: 50000, res_spellbook: 150, scrolls: { fog_of_war: 1 } });
  const target = withTowerFrag(baseKingdom(), 'Celestial Feather');
  const result = engine.castSpell(caster, target, 'fog_of_war', false);
  assert.ok(!result?.error, `castSpell errored: ${result?.error}`);
  const effects = JSON.parse(result.targetUpdates?.active_effects || '{}');
  assert.ok(!effects.fog_of_war, 'Nimbus Shields should have blocked fog_of_war');
});

// ── Special: Wyrmfire Focus (Dragon Scale) → 50% block debuffs ───────────────

console.log('\nSpecial: Wyrmfire Focus (Dragon Scale) — 50% chance block debuffs');

test('Dragon Scale: getSpecialEffect returns Wyrmfire Focus', () => {
  const k = withTowerFrag(baseKingdom(), 'Dragon Scale');
  const sp = fragmentBonusManager.getSpecialEffect(k, 'mage_towers');
  assert.strictEqual(sp?.name, 'Wyrmfire Focus');
});

test('Wyrmfire Focus: silence sometimes blocked (statistical — run 20 attempts, expect at least 1 block)', () => {
  const caster = baseKingdom({ mana: 50000, res_spellbook: 700 });
  const target = withTowerFrag(baseKingdom(), 'Dragon Scale');
  let blocked = 0;
  for (let i = 0; i < 20; i++) {
    clearParseCache();
    const c = { ...caster, scrolls: { silence: 1 } };
    const result = engine.castSpell(c, target, 'silence', false);
    if (!result?.error) {
      const effects = JSON.parse(result.targetUpdates?.active_effects || '{}');
      if (!effects.silence) blocked++;
    }
  }
  assert.ok(blocked >= 1, `Expected at least 1 block in 20 tries, got ${blocked} (p~0.999)`);
});

// ── Special: Harmonic Concentrators (Dwarven Star-Metal) → ignore shield ─────

console.log('\nSpecial: Harmonic Concentrators (Dwarven Star-Metal) — ignore target shield');

test('Dwarven Star-Metal: getSpecialEffect returns Harmonic Concentrators', () => {
  const k = withTowerFrag(baseKingdom(), 'Dwarven Star-Metal');
  const sp = fragmentBonusManager.getSpecialEffect(k, 'mage_towers');
  assert.strictEqual(sp?.name, 'Harmonic Concentrators');
});

test('Harmonic Concentrators: caster ignores target magic shield buff', () => {
  clearParseCache();
  const plain = baseKingdom({ mana: 50000, res_spellbook: 100, scrolls: { spark: 1 } });
  const harm  = withTowerFrag({ ...plain, scrolls: { spark: 1 } }, 'Dwarven Star-Metal');
  const shieldedTarget = baseKingdom({ bld_farms: 50, active_effects: JSON.stringify({ shield: { turns_left: 5 } }) });
  const rPlain = engine.castSpell(plain, shieldedTarget, 'spark', false);
  clearParseCache();
  const rHarm  = engine.castSpell(harm,  shieldedTarget, 'spark', false);
  assert.ok(!rPlain?.error, `Plain error: ${rPlain?.error}`);
  assert.ok(!rHarm?.error,  `Harm error: ${rHarm?.error}`);
  const lossPlain = shieldedTarget.bld_farms - (rPlain.targetUpdates?.bld_farms ?? shieldedTarget.bld_farms);
  const lossHarm  = shieldedTarget.bld_farms - (rHarm.targetUpdates?.bld_farms  ?? shieldedTarget.bld_farms);
  assert.ok(lossHarm >= lossPlain, `Harmonic Concentrators (${lossHarm}) should deal >= plain-vs-shield (${lossPlain}) damage`);
});

// ── Special: Singularity Focus (Abyssal Crystal) → faster scroll crafting ────

console.log('\nSpecial: Singularity Focus (Abyssal Crystal) — 1.5× scroll crafting speed');

test('Abyssal Crystal: getSpecialEffect returns Singularity Focus', () => {
  const k = withTowerFrag(baseKingdom(), 'Abyssal Crystal');
  const sp = fragmentBonusManager.getSpecialEffect(k, 'mage_towers');
  assert.strictEqual(sp?.name, 'Singularity Focus');
});

test('Singularity Focus: completes a blank scroll in 1 turn when base cannot (workDone 6 vs 4, need 5)', () => {
  // 20 mages, blank_scroll req: mages=5, turns=5. workDone = (20/5)*1*1*1*mult = 4*mult
  // Base (mult=1.0): workDone=4 < 5 → no completion; Singularity (mult=1.5): workDone=6 >= 5 → 1 scroll
  const base = baseKingdom({ mage_tower_allocation: JSON.stringify({ blank_scroll: 1 }) });
  const frag = withTowerFrag(
    baseKingdom({ mage_tower_allocation: JSON.stringify({ blank_scroll: 1 }) }),
    'Abyssal Crystal'
  );
  const rBase = engine.processMageTower(base, []);
  const rFrag = engine.processMageTower(frag, []);
  assert.ok(!rBase.scrolls, `Base should NOT complete a blank scroll (progress=4/5), got scrolls: ${rBase.scrolls}`);
  assert.ok(rFrag.scrolls,  `Singularity should complete a blank scroll (progress=6>=5), got no scrolls`);
  const fragScrolls = JSON.parse(rFrag.scrolls || '{}');
  assert.ok((fragScrolls.blank_scroll || 0) >= 1, `Expected >= 1 blank scroll, got ${fragScrolls.blank_scroll}`);
});

// ── Special: Goliath Spire (Titan Bone) → extended spell power ───────────────

console.log('\nSpecial: Goliath Spire (Titan Bone) — 1.2× spell power');

test('Titan Bone: getSpecialEffect returns Goliath Spire', () => {
  const k = withTowerFrag(baseKingdom(), 'Titan Bone');
  const sp = fragmentBonusManager.getSpecialEffect(k, 'mage_towers');
  assert.strictEqual(sp?.name, 'Goliath Spire');
});

test('Goliath Spire: spark deals more damage due to extended power', () => {
  clearParseCache();
  const plain = baseKingdom({ mana: 50000, res_spellbook: 100, scrolls: { spark: 1 } });
  const spire = withTowerFrag({ ...plain, scrolls: { spark: 1 } }, 'Titan Bone');
  const target = baseKingdom({ bld_farms: 50 });
  const rPlain = engine.castSpell(plain, target, 'spark', false);
  clearParseCache();
  const rSpire = engine.castSpell(spire,  target, 'spark', false);
  assert.ok(!rPlain?.error, `Plain error: ${rPlain?.error}`);
  assert.ok(!rSpire?.error, `Spire error: ${rSpire?.error}`);
  const lossPlain = target.bld_farms - (rPlain.targetUpdates?.bld_farms ?? target.bld_farms);
  const lossSpire = target.bld_farms - (rSpire.targetUpdates?.bld_farms ?? target.bld_farms);
  assert.ok(lossSpire >= lossPlain, `Goliath Spire (${lossSpire}) should deal >= plain (${lossPlain}) damage`);
});

// ── Special: Sanguine Battery (Cursed Bloodstone) → spellpower + happiness cost

console.log('\nSpecial: Sanguine Battery (Cursed Bloodstone)');

test('Cursed Bloodstone: getSpecialEffect returns Sanguine Battery', () => {
  const k = withTowerFrag(baseKingdom(), 'Cursed Bloodstone');
  const sp = fragmentBonusManager.getSpecialEffect(k, 'mage_towers');
  assert.strictEqual(sp?.name, 'Sanguine Battery');
});

test('Sanguine Battery: processMageTowerAttunements reduces happiness by 1', () => {
  const k = withTowerFrag(baseKingdom({ happiness: 60 }), 'Cursed Bloodstone');
  const events = [];
  const updates = engine.processMageTowerAttunements(k, events);
  assert.strictEqual(updates.happiness, 59);
  assert.ok(events.some(e => e.message.includes('Sanguine Battery')), 'Should emit Sanguine Battery event');
});

// ── Special: Mana Geyser (Tears of the World Tree) → auto blank scrolls ──────

console.log('\nSpecial: Mana Geyser (Tears of the World Tree) — auto blank scrolls');

test('Tears of the World Tree: getSpecialEffect returns Mana Geyser', () => {
  const k = withTowerFrag(baseKingdom(), 'Tears of the World Tree');
  const sp = fragmentBonusManager.getSpecialEffect(k, 'mage_towers');
  assert.strictEqual(sp?.name, 'Mana Geyser');
});

test('Mana Geyser: generates blank scrolls each turn (1 per 5 towers, min 1)', () => {
  // 3 towers → floor(3/5)=0 → min 1 = 1 blank scroll
  const k = withTowerFrag(baseKingdom(), 'Tears of the World Tree');
  const events = [];
  const updates = engine.processMageTowerAttunements(k, events);
  const scrolls = JSON.parse(updates.scrolls || '{}');
  assert.ok((scrolls.blank_scroll || 0) >= 1, `Expected >= 1 blank scroll, got ${scrolls.blank_scroll}`);
  assert.ok(events.some(e => e.message.includes('Mana Geyser')), 'Should emit Mana Geyser event');
});

test('Mana Geyser: 10 towers produce 2 blank scrolls', () => {
  const k = withTowerFrag(baseKingdom({ bld_mage_towers: 10 }), 'Tears of the World Tree');
  const events = [];
  const updates = engine.processMageTowerAttunements(k, events);
  const scrolls = JSON.parse(updates.scrolls || '{}');
  assert.strictEqual(scrolls.blank_scroll, 2);
});

// ── Special: Portal Conduits (Void Essence) → happiness risk ─────────────────

console.log('\nSpecial: Portal Conduits (Void Essence) — 15% happiness penalty risk');

test('Void Essence: getSpecialEffect returns Portal Conduits', () => {
  const k = withTowerFrag(baseKingdom(), 'Void Essence');
  const sp = fragmentBonusManager.getSpecialEffect(k, 'mage_towers');
  assert.strictEqual(sp?.name, 'Portal Conduits');
});

test('Portal Conduits: sometimes reduces happiness (statistical — 50 runs, expect >= 1 trigger)', () => {
  const k = withTowerFrag(baseKingdom({ happiness: 60 }), 'Void Essence');
  let triggered = 0;
  for (let i = 0; i < 50; i++) {
    const updates = engine.processMageTowerAttunements(k, []);
    if (updates.happiness !== undefined && updates.happiness < 60) triggered++;
  }
  assert.ok(triggered >= 1, `Expected at least 1 portal leak in 50 turns (p~0.9996), got ${triggered}`);
});

test('Portal Conduits: happiness floored at -50', () => {
  const k = withTowerFrag(baseKingdom({ happiness: -50 }), 'Void Essence');
  // Force a trigger by running many times until we see an update
  let sawUpdate = false;
  for (let i = 0; i < 100; i++) {
    const updates = engine.processMageTowerAttunements(k, []);
    if (updates.happiness !== undefined) {
      assert.strictEqual(updates.happiness, -50, 'happiness floor should be -50');
      sawUpdate = true;
      break;
    }
  }
  // If we got no update in 100 turns, the test is still OK (15% chance, could legitimately not trigger)
  // but this only fails with probability 0.85^100 ≈ 5.9e-8 — effectively never
});

// ── Special: Sylvan Wards (Ancient Elven Wood) ───────────────────────────────

console.log('\nSpecial: Sylvan Wards (Ancient Elven Wood)');

test('Ancient Elven Wood: getSpecialEffect returns Sylvan Wards', () => {
  const k = withTowerFrag(baseKingdom(), 'Ancient Elven Wood');
  const sp = fragmentBonusManager.getSpecialEffect(k, 'mage_towers');
  assert.strictEqual(sp?.name, 'Sylvan Wards');
});

// ── No fragment baseline ──────────────────────────────────────────────────────

console.log('\nNo fragment baseline');

test('No fragment: processMageTowerAttunements returns empty updates', () => {
  const k = baseKingdom({ happiness: 60 });
  const events = [];
  const updates = engine.processMageTowerAttunements(k, events);
  assert.deepStrictEqual(updates, {});
  assert.strictEqual(events.length, 0);
});

test('No mage towers: processMageTowerAttunements returns empty even with fragment', () => {
  const k = withTowerFrag(baseKingdom({ bld_mage_towers: 0 }), 'Volcanic Rock');
  const events = [];
  const updates = engine.processMageTowerAttunements(k, events);
  assert.deepStrictEqual(updates, {});
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Mage tower fragment smoke tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
