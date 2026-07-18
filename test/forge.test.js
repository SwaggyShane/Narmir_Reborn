'use strict';
// Regression tests for the Forge & Lava Industry system (FORGE_SYSTEM.md).
// Covers the pure/sync logic across forge-upgrades, forge-production,
// flux-barge, lava-vents, and lava-expedition's launch gate — the parts that
// can run without a live Postgres connection. DB-dependent paths
// (getVentState/claimVent/releaseVent/resolveLavaDraw) are exercised by the
// live-DB walkthrough documented in FORGE_SYSTEM.md's Appendix I and by
// test-systems-harness, not here.
//
// This suite exists specifically to catch the class of bug found during the
// live §15.5 integration walkthrough (2026-07-18): logic that looks right
// in isolation but is wrong against the real contract (e.g. the
// engineer-level gate accepting an OR-fallback that let troop-level-1
// engineers launch). See test 12 below.
//
// Run: node test/forge.test.js

const assert = require('assert');

const forgeUpgrades = require('../game/forge-upgrades');
const forgeProduction = require('../game/forge-production');
const fluxBarge = require('../game/flux-barge');
const lavaVents = require('../game/lava-vents');
const lavaExpedition = require('../game/lava-expedition');

function makeKingdom(overrides = {}) {
  return {
    race: 'human',
    turn: 10,
    turns_stored: 1000,
    wood: 10000,
    stone: 10000,
    iron: 10000,
    gold: 1000000,
    coal: 0,
    steel: 0,
    tempered_steel: 0,
    lava_stored: 0,
    food: 100000,
    toolwright_yard: 0,
    engineers_lodge: 0,
    forge: 0,
    engineer_level: 1,
    engineer_xp: 0,
    engineers: 100,
    mages: 100,
    troop_levels: JSON.stringify({}),
    training_allocation: null,
    flux_barges: '[]',
    ...overrides,
  };
}

console.log('Testing forge system\n');

// ── forge-upgrades ──────────────────────────────────────────────────────────

// Test 1: chain order is enforced — can't install Lodge before Yard
{
  const k = makeKingdom();
  const result = forgeUpgrades.installUpgrade(k, 'engineers_lodge');
  assert.ok(result.error, 'installing Lodge before Yard should fail');
  assert.match(result.error, /toolwright_yard/, 'error should name the required prerequisite');
  console.log(`Test 1: chain order enforced ✓ (${result.error})`);
}

// Test 2: install spends exact cost and sets the flag
{
  const k = makeKingdom();
  const result = forgeUpgrades.installUpgrade(k, 'toolwright_yard');
  assert.ok(!result.error, `install should succeed, got ${result.error}`);
  assert.equal(result.updates.wood, 10000 - 500);
  assert.equal(result.updates.stone, 10000 - 2000);
  assert.equal(result.updates.iron, 10000 - 1500);
  assert.equal(result.updates.gold, 1000000 - 50000);
  assert.equal(result.updates.toolwright_yard, 1);
  console.log('Test 2: install spends exact cost + sets flag ✓');
}

// Test 3: insufficient resources block install
{
  const k = makeKingdom({ gold: 100 });
  const result = forgeUpgrades.installUpgrade(k, 'toolwright_yard');
  assert.ok(result.error, 'install should fail with insufficient gold');
  console.log(`Test 3: insufficient resources blocked ✓ (${result.error})`);
}

// Test 4: installing Forge grants a free Flux-Barge
{
  const k = makeKingdom({ toolwright_yard: 1, engineers_lodge: 1 });
  const result = forgeUpgrades.installUpgrade(k, 'forge');
  assert.ok(!result.error, `install should succeed, got ${result.error}`);
  const barges = JSON.parse(result.updates.flux_barges);
  assert.equal(barges.length, 1, 'Forge install should grant exactly one free barge');
  assert.equal(barges[0].integrity, 100);
  assert.equal(barges[0].status, 'idle');
  console.log('Test 4: Forge install grants free barge ✓');
}

// ── forge-production ────────────────────────────────────────────────────────

// Test 5: production actions are gated on the Forge flag
{
  const k = makeKingdom({ forge: 0 });
  const smelt = forgeProduction.smeltSteel(k, 1);
  const temper = forgeProduction.temperSteel(k, 1, 60);
  const craft = forgeProduction.craftGear(k, 'steel_weapons', 1, 60);
  assert.ok(smelt.error, 'smelt should be gated on Forge');
  assert.ok(temper.error, 'temper should be gated on Forge');
  assert.ok(craft.error, 'craft should be gated on Forge');
  console.log('Test 5: production gated on Forge flag ✓');
}

// Test 6: charcoal tick — wood -> coal at the documented ratio, race mult applied
{
  const k = makeKingdom({ forge: 1, race: 'dwarf', wood: 1000, charcoal_wood_allocation: 400 });
  const result = forgeProduction.processCharcoalTick(k);
  // dwarf charcoal mult = 0.8; floor(400 * 0.25 * 0.8) = floor(80) = 80
  assert.equal(result.coalGain, 80, `expected 80 coal, got ${result.coalGain}`);
  assert.equal(result.updates.wood, 600);
  assert.equal(result.updates.coal, 80);
  console.log(`Test 6: charcoal tick race mult ✓ (coalGain=${result.coalGain})`);
}

// Test 7: charcoal tick respects the coal cap
{
  const k = makeKingdom({ forge: 1, race: 'human', wood: 100000, coal: 4990, charcoal_wood_allocation: 100000 });
  const result = forgeProduction.processCharcoalTick(k);
  assert.equal(result.updates.coal, 5000, 'coal should be clamped to the 5000 cap');
  console.log('Test 7: charcoal tick respects coal cap ✓');
}

// Test 8: smelt recipe — 20 iron + 10 coal per batch, race mult on output
{
  const k = makeKingdom({ forge: 1, race: 'dwarf', iron: 1000, coal: 1000 });
  const result = forgeProduction.smeltSteel(k, 4);
  assert.ok(!result.error, `smelt should succeed, got ${result.error}`);
  assert.equal(result.updates.iron, 1000 - 80, 'should consume 20 iron per batch');
  assert.equal(result.updates.coal, 1000 - 40, 'should consume 10 coal per batch');
  // dwarf smelt mult = 1.25; floor(4 * 1.25) = 5
  assert.equal(result.updates.steel, 5, `expected 5 steel, got ${result.updates.steel}`);
  console.log('Test 8: smelt recipe + race mult ✓');
}

// Test 9: temper requires engineer level >= 50
{
  const k = makeKingdom({ forge: 1, steel: 100, lava_stored: 100 });
  const blocked = forgeProduction.temperSteel(k, 1, 49);
  const allowed = forgeProduction.temperSteel(k, 1, 50);
  assert.ok(blocked.error, 'temper should be blocked below eng level 50');
  assert.ok(!allowed.error, `temper should succeed at eng level 50, got ${allowed.error}`);
  assert.equal(allowed.updates.steel, 99);
  assert.equal(allowed.updates.lava_stored, 98);
  assert.equal(allowed.updates.tempered_steel, 1);
  console.log('Test 9: temper engineer-level gate ✓');
}

// Test 10: tempered gear requires eng level >= 50; steel gear does not
{
  const k = makeKingdom({ forge: 1, steel: 100, tempered_steel: 100, gold: 1000000 });
  const steelGear = forgeProduction.craftGear(k, 'steel_weapons', 1, 1);
  const temperedBlocked = forgeProduction.craftGear(k, 'tempered_weapons', 1, 1);
  const temperedAllowed = forgeProduction.craftGear(k, 'tempered_weapons', 1, 50);
  assert.ok(!steelGear.error, `steel gear should not require eng level, got ${steelGear.error}`);
  assert.ok(temperedBlocked.error, 'tempered gear should be blocked below eng level 50');
  assert.ok(!temperedAllowed.error, `tempered gear should succeed at eng level 50, got ${temperedAllowed.error}`);
  console.log('Test 10: gear craft eng-level gate (tempered only) ✓');
}

// ── flux-barge ───────────────────────────────────────────────────────────────

// Test 11: free barge grant respects the 3-barge max
{
  const full = fluxBarge.grantFreeBarge(JSON.stringify([
    { id: 1, integrity: 100, status: 'idle' },
    { id: 2, integrity: 100, status: 'idle' },
    { id: 3, integrity: 100, status: 'idle' },
  ]));
  assert.equal(full.length, 3, 'granting a free barge at max should not exceed the cap');
  const notFull = fluxBarge.grantFreeBarge('[]');
  assert.equal(notFull.length, 1);
  console.log('Test 11: free barge grant respects max-3 cap ✓');
}

// Test 12: THE bug found during live integration — engineer-level gate must
// read engineer_level only, not fall back to troop-level (which would let a
// kingdom with troop-level-1 engineers launch). Locks the actual fix.
{
  const k = makeKingdom({
    forge: 1,
    engineer_level: 1, // construction-skill level: too low
    troop_levels: JSON.stringify({ engineers: 99, mages: 99 }), // troop level: high
    flux_barges: JSON.stringify([{ id: 1, integrity: 100, status: 'idle' }]),
  });
  const result = lavaExpedition.canLaunch(k, 1);
  assert.ok(result.error, 'a kingdom with low engineer_level must not launch, regardless of troop-level engineers');
  assert.match(result.error, /Engineer level/, 'should fail on the engineer-level gate specifically');
  console.log(`Test 12: engineer-level gate has no troop-level fallback ✓ (${result.error})`);
}

// Test 13: hull wear — success vs empty amounts, destruction at 0
{
  const notDestroyed = fluxBarge.applyHullWear(JSON.stringify([{ id: 1, integrity: 30, status: 'deployed' }]), 1, 'success');
  assert.equal(notDestroyed.destroyed, false, `30 - 20 = 10 integrity remaining, should not be destroyed`);
  assert.equal(notDestroyed.integrity, 10);
  const destroyed = fluxBarge.applyHullWear(JSON.stringify([{ id: 1, integrity: 15, status: 'deployed' }]), 1, 'success');
  assert.equal(destroyed.destroyed, true, '15 - 20 <= 0 should destroy the barge');
  assert.equal(destroyed.list.length, 0, 'destroyed barge should be removed from the list');
  const emptyWear = fluxBarge.applyHullWear(JSON.stringify([{ id: 1, integrity: 100, status: 'deployed' }]), 1, 'empty');
  assert.equal(emptyWear.integrity, 95, 'empty-handed wear should be 5, not 20');
  console.log('Test 13: hull wear amounts + destruction threshold ✓');
}

// Test 14: findDeployableBarge only returns idle, undamaged barges
{
  const barges = JSON.stringify([
    { id: 1, integrity: 100, status: 'building', turns_left: 5 },
    { id: 2, integrity: 0, status: 'idle' },
    { id: 3, integrity: 100, status: 'idle' },
  ]);
  assert.ok(fluxBarge.findDeployableBarge(barges, 1).error, 'building barge should not be deployable');
  assert.ok(fluxBarge.findDeployableBarge(barges, 2).error, 'zero-integrity barge should not be deployable');
  assert.ok(!fluxBarge.findDeployableBarge(barges, 3).error, 'idle, healthy barge should be deployable');
  console.log('Test 14: findDeployableBarge idle+integrity check ✓');
}

// Test 15: queueExtraBarge respects max-3 cap and engineer-level gate
{
  const atCap = makeKingdom({
    forge: 1, engineer_level: 60, steel: 1000, stone: 10000,
    flux_barges: JSON.stringify([
      { id: 1, integrity: 100, status: 'idle' },
      { id: 2, integrity: 100, status: 'idle' },
      { id: 3, integrity: 100, status: 'idle' },
    ]),
  });
  const capResult = fluxBarge.queueExtraBarge(atCap, 60);
  assert.ok(capResult.error, 'queueing a 4th barge should fail at the max-3 cap');

  const lowEng = makeKingdom({ forge: 1, engineer_level: 10, steel: 1000, stone: 10000 });
  const engResult = fluxBarge.queueExtraBarge(lowEng, 10);
  assert.ok(engResult.error, 'queueing a barge should require eng level >= 50');
  console.log('Test 15: queueExtraBarge cap + eng-level gate ✓');
}

// ── lava-vents (pure) ────────────────────────────────────────────────────────

// Test 16: lava yield is race-scaled, dwarf > human > high_elf
{
  const dwarf = lavaVents.lavaYield('dwarf');
  const human = lavaVents.lavaYield('human');
  const highElf = lavaVents.lavaYield('high_elf');
  assert.ok(dwarf > human, `dwarf (${dwarf}) should yield more lava than human (${human})`);
  assert.ok(human > highElf, `human (${human}) should yield more lava than high_elf (${highElf})`);
  console.log(`Test 16: lava yield race scaling ✓ (dwarf=${dwarf}, human=${human}, high_elf=${highElf})`);
}

// ── lava-expedition launch gate ──────────────────────────────────────────────

// Test 17: canLaunch requires Forge, both level minimums, both crew minimums, and a deployable barge
{
  const base = makeKingdom({
    forge: 1,
    engineer_level: 60,
    troop_levels: JSON.stringify({ mages: 30 }),
    engineers: 30,
    mages: 10,
    flux_barges: JSON.stringify([{ id: 1, integrity: 100, status: 'idle' }]),
  });
  assert.ok(lavaExpedition.canLaunch({ ...base, forge: 0 }, 1).error, 'requires Forge upgrade');
  assert.ok(lavaExpedition.canLaunch({ ...base, troop_levels: JSON.stringify({ mages: 5 }) }, 1).error, 'requires mage level >= 25');
  assert.ok(lavaExpedition.canLaunch({ ...base, engineers: 10 }, 1).error, 'requires >= 25 available engineers');
  assert.ok(lavaExpedition.canLaunch({ ...base, mages: 2 }, 1).error, 'requires >= 5 available mages');
  assert.ok(lavaExpedition.canLaunch({ ...base, flux_barges: '[]' }, 1).error, 'requires a deployable barge');
  assert.ok(!lavaExpedition.canLaunch(base, 1).error, `all gates satisfied should pass, got ${lavaExpedition.canLaunch(base, 1).error}`);
  console.log('Test 17: canLaunch full gate chain ✓');
}

// Test 18: buildLaunch debits crew, food, and turns; marks the barge deployed
{
  const k = makeKingdom({
    forge: 1,
    engineer_level: 60,
    troop_levels: JSON.stringify({ mages: 30 }),
    engineers: 50,
    mages: 20,
    turns_stored: 100000,
    food: 1000000,
    flux_barges: JSON.stringify([{ id: 1, integrity: 100, status: 'idle' }]),
  });
  const result = lavaExpedition.buildLaunch(k, 700, 700, 1, { homeCoords: { map_x: 663, map_y: 921 } });
  assert.ok(!result.error, `buildLaunch should succeed, got ${result.error}`);
  assert.equal(result.updates.engineers, 50 - 25, 'should debit exactly 25 engineers');
  assert.equal(result.updates.mages, 20 - 5, 'should debit exactly 5 mages');
  assert.ok(result.updates.turns_stored < 100000, 'should debit turns for the round trip');
  assert.ok(result.updates.food < 1000000, 'should debit food for the round trip');
  const barges = JSON.parse(result.updates.flux_barges);
  assert.equal(barges[0].status, 'deployed', 'launched barge should be marked deployed');
  console.log('Test 18: buildLaunch debits crew/food/turns + deploys barge ✓');
}

// Test 19: buildLaunch fails cleanly when turns_stored is insufficient
{
  const k = makeKingdom({
    forge: 1,
    engineer_level: 60,
    troop_levels: JSON.stringify({ mages: 30 }),
    engineers: 50,
    mages: 20,
    turns_stored: 1,
    flux_barges: JSON.stringify([{ id: 1, integrity: 100, status: 'idle' }]),
  });
  const result = lavaExpedition.buildLaunch(k, 700, 700, 1, { homeCoords: { map_x: 663, map_y: 921 } });
  assert.ok(result.error, 'buildLaunch should fail with insufficient turns_stored');
  assert.match(result.error, /turns/i);
  console.log(`Test 19: buildLaunch insufficient-turns error ✓ (${result.error})`);
}

console.log('\nAll forge tests passed.');
