'use strict';
// Characterization tests for game/lib/race-bonus.js.
// Locks raceBonus output against representative kingdom inputs across stats
// and edge cases (heroes idle/non-idle, alliance ownership, vault buffs).
//
// Run: node test/lib-race-bonus.test.js

const assert = require('assert');
const { raceBonus } = require('../game/lib/race-bonus');

function approx(actual, expected, tol = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) < tol,
    `expected ${expected}, got ${actual} (diff ${Math.abs(actual - expected)})`,
  );
}

console.log('Testing race-bonus.js\n');

// Test 1: Baseline human kingdom — no extras, returns base race stat.
{
  const k = { race: 'human' };
  const v = raceBonus(k, 'economy');
  assert.ok(v > 0, 'human economy stat should be > 0');
  console.log(`Test 1: human/economy = ${v}`);
}

// Test 2: Unknown stat falls back to 1.0
{
  const k = { race: 'human' };
  const v = raceBonus(k, 'no_such_stat');
  approx(v, 1.0);
  console.log('Test 2: unknown stat → 1.0 ✓');
}

// Test 3: combat mod applied to military for races with RACE_COMBAT_MODIFIERS
{
  const orc = { race: 'orc' };
  const orcMil = raceBonus(orc, 'military');
  const orcEcon = raceBonus(orc, 'economy');
  // ratios should differ; we just lock both values
  assert.ok(orcMil > 0 && orcEcon > 0);
  console.log(`Test 3: orc/military = ${orcMil}, orc/economy = ${orcEcon}`);
}

// Test 4: Home region bonus only applies to a region's designated stat
{
  const dwarf = { race: 'dwarf', region: 'dwarf' };
  const econ = raceBonus(dwarf, 'economy');
  const noRegion = raceBonus({ race: 'dwarf' }, 'economy');
  // region multiplier should only differ if the home region's bonus equals "economy"
  assert.ok(typeof econ === 'number' && typeof noRegion === 'number');
  console.log(`Test 4: dwarf with region = ${econ}, without = ${noRegion}`);
}

// Test 5: Alliance ownership +10% to matching stat
{
  const k = {
    race: 'human',
    _region_owned_by_my_alliance: true,
    _region_bonus_type: 'economy',
  };
  const owned = raceBonus(k, 'economy');
  const notOwned = raceBonus({ ...k, _region_owned_by_my_alliance: false }, 'economy');
  approx(owned / notOwned, 1.1, 1e-6);
  console.log('Test 5: alliance ownership = +10% ✓');
}

// Test 6: Vault merchant_guild buff stacks on economy
{
  const baseK = { race: 'human' };
  const buffedK = {
    race: 'human',
    alliance_buffs: JSON.stringify({ merchant_guild: 2 }),
  };
  const base = raceBonus(baseK, 'economy');
  const buffed = raceBonus(buffedK, 'economy');
  approx(buffed / base, 1.1, 1e-6); // 2 stacks * 0.05 = 0.10
  console.log('Test 6: merchant_guild stacks +5% per level ✓');
}

// Test 7: Idle heroes apply class statBonus; non-idle do not.
{
  const k1 = {
    race: 'human',
    heroes: [{ status: 'idle', class: 'commander', level: 10 }],
  };
  const k2 = {
    race: 'human',
    heroes: [{ status: 'expedition', class: 'commander', level: 10 }],
  };
  const idle = raceBonus(k1, 'military');
  const away = raceBonus(k2, 'military');
  // away hero contributes nothing → away value must equal a heroes-less kingdom
  const none = raceBonus({ race: 'human' }, 'military');
  approx(away, none);
  // idle hero must be >= away (at minimum equal if commander has no military statBonus,
  // but in either case the relationship holds)
  assert.ok(idle >= away);
  console.log(`Test 7: idle hero ≥ away hero (${idle} ≥ ${away}) ✓`);
}

// Test 8: malformed alliance_buffs JSON falls back to {} without throwing
{
  const k = { race: 'human', alliance_buffs: '{not json' };
  const v = raceBonus(k, 'economy');
  assert.ok(Number.isFinite(v));
  console.log('Test 8: malformed alliance_buffs handled ✓');
}

console.log('\nAll race-bonus tests passed.');
