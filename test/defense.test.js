'use strict';
// Characterization tests for game/defense.js.
// Locks defense rating labels, power scaling, and tier progression.
//
// Run: node test/defense.test.js

const assert = require('assert');
const defense = require('../game/defense');

function makeKingdom(overrides = {}) {
  return {
    race: 'human',
    bld_walls: 0,
    bld_guard_towers: 0,
    bld_outposts: 0,
    bld_castles: 0,
    thieves: 0,
    rangers: 0,
    ballistae: 0,
    res_war_machines: 100,
    defense_upgrades: null,
    wall_upgrades: null,
    tower_def_upgrades: null,
    outpost_upgrades: null,
    alliance_buffs: null,
    active_effects: null,
    fragment_attunements: null,
    troop_xp: null,
    ...overrides,
  };
}

console.log('Testing defense.js\n');

// Test 1: defenseRating returns Undefended by default
{
  const k = makeKingdom({ defense_upgrades: null });
  const rating = defense.defenseRating(k);
  assert.ok(rating.includes('Undefended'), `default should be Undefended, got "${rating}"`);
  console.log(`Test 1: defenseRating default ✓ (${rating})`);
}

// Test 2: defenseRating returns Fortified
{
  const k = makeKingdom({ defense_upgrades: JSON.stringify({ fortified: true }) });
  const rating = defense.defenseRating(k);
  assert.ok(rating.includes('Fortified'), `should be Fortified, got "${rating}"`);
  console.log(`Test 2: defenseRating Fortified ✓`);
}

// Test 3: defenseRating returns Keep
{
  const k = makeKingdom({ defense_upgrades: JSON.stringify({ fortified: true, keep: true }) });
  const rating = defense.defenseRating(k);
  assert.ok(rating.includes('Keep'), `should be Keep, got "${rating}"`);
  console.log(`Test 3: defenseRating Keep ✓`);
}

// Test 4: defenseRating returns Citadel (highest tier wins)
{
  const k = makeKingdom({ defense_upgrades: JSON.stringify({ fortified: true, keep: true, citadel: true }) });
  const rating = defense.defenseRating(k);
  assert.ok(rating.includes('Citadel'), `should be Citadel, got "${rating}"`);
  console.log(`Test 4: defenseRating Citadel ✓`);
}

// Test 5: wallDefensePower returns 0 with no walls
{
  const k = makeKingdom({ bld_walls: 0 });
  const power = defense.wallDefensePower(k);
  assert.equal(power, 0, 'no walls = 0 power');
  console.log('Test 5: wallDefensePower zero walls ✓');
}

// Test 6: wallDefensePower scales with wall count
{
  const k1 = makeKingdom({ bld_walls: 1 });
  const k5 = makeKingdom({ bld_walls: 5 });
  const p1 = defense.wallDefensePower(k1);
  const p5 = defense.wallDefensePower(k5);
  assert.ok(p5 > p1, `5 walls should be stronger than 1 wall (${p1} vs ${p5})`);
  console.log(`Test 6: wallDefensePower scales with walls ✓ (1wall=${p1}, 5walls=${p5})`);
}

// Test 7: wallDefensePower reinforced upgrade boosts power
{
  const base = makeKingdom({ bld_walls: 5 });
  const reinforced = makeKingdom({ bld_walls: 5, wall_upgrades: JSON.stringify({ reinforced: true }) });
  const pBase = defense.wallDefensePower(base);
  const pReinforced = defense.wallDefensePower(reinforced);
  assert.ok(pReinforced > pBase, `reinforced walls should be stronger (${pBase} vs ${pReinforced})`);
  console.log(`Test 7: wallDefensePower reinforced bonus ✓ (base=${pBase}, reinforced=${pReinforced})`);
}

// Test 8: towerDetectionPower returns 0 with no towers
{
  const k = makeKingdom({ bld_guard_towers: 0 });
  const power = defense.towerDetectionPower(k);
  assert.equal(power, 0, 'no towers = 0 detection power');
  console.log('Test 8: towerDetectionPower zero towers ✓');
}

// Test 9: towerDetectionPower scales with tower count
{
  const k1 = makeKingdom({ bld_guard_towers: 1 });
  const k5 = makeKingdom({ bld_guard_towers: 5 });
  const p1 = defense.towerDetectionPower(k1);
  const p5 = defense.towerDetectionPower(k5);
  assert.ok(p5 > p1, `5 towers stronger than 1 (${p1} vs ${p5})`);
  console.log(`Test 9: towerDetectionPower scales ✓ (1=${p1}, 5=${p5})`);
}

// Test 10: towerDetectionPower boosted by thieves on watch
{
  const noThieves = makeKingdom({ bld_guard_towers: 2 });
  const withThieves = makeKingdom({ bld_guard_towers: 2, thieves: 20 });
  const p0 = defense.towerDetectionPower(noThieves);
  const p20 = defense.towerDetectionPower(withThieves);
  assert.ok(p20 > p0, `thieves boost detection (${p0} vs ${p20})`);
  console.log(`Test 10: towerDetectionPower thieves bonus ✓ (no_thieves=${p0}, with_thieves=${p20})`);
}

// Test 11: outpostRangerPower returns 0 with no outposts
{
  const k = makeKingdom({ bld_outposts: 0 });
  const power = defense.outpostRangerPower(k);
  assert.equal(power, 0, 'no outposts = 0 ranger power');
  console.log('Test 11: outpostRangerPower zero outposts ✓');
}

// Test 12: outpostRangerPower scales with outpost count
{
  const k1 = makeKingdom({ bld_outposts: 1 });
  const k5 = makeKingdom({ bld_outposts: 5 });
  const p1 = defense.outpostRangerPower(k1);
  const p5 = defense.outpostRangerPower(k5);
  assert.ok(p5 > p1, `5 outposts stronger than 1 (${p1} vs ${p5})`);
  console.log(`Test 12: outpostRangerPower scales ✓ (1=${p1}, 5=${p5})`);
}

// Test 13: outpostRangerPower boosted by rangers
{
  const noRangers = makeKingdom({ bld_outposts: 2 });
  const withRangers = makeKingdom({ bld_outposts: 2, rangers: 40 });
  const p0 = defense.outpostRangerPower(noRangers);
  const p40 = defense.outpostRangerPower(withRangers);
  assert.ok(p40 > p0, `rangers boost outpost power (${p0} vs ${p40})`);
  console.log(`Test 13: outpostRangerPower ranger bonus ✓ (no_rangers=${p0}, with_rangers=${p40})`);
}

// Test 14: checkDefenseTiers returns {} when nothing changes
{
  const k = makeKingdom({ bld_walls: 0, bld_guard_towers: 0, bld_outposts: 0, bld_castles: 0 });
  const events = [];
  const updates = defense.checkDefenseTiers(k, events);
  assert.deepEqual(updates, {}, 'no tier change = empty updates');
  assert.equal(events.length, 0, 'no events');
  console.log('Test 14: checkDefenseTiers no change ✓');
}

// Test 15: checkDefenseTiers awards Fortified tier when requirements met
{
  const config = require('../game/config');
  const tiers = config.DEFENSE_TIERS;
  const k = makeKingdom({
    bld_walls: tiers.fortified.walls,
    bld_guard_towers: tiers.fortified.guard_towers,
    bld_outposts: tiers.fortified.outposts,
    bld_castles: tiers.fortified.castles,
    defense_upgrades: null,
  });
  const events = [];
  const updates = defense.checkDefenseTiers(k, events);
  assert.ok('defense_upgrades' in updates, 'sets defense_upgrades');
  const upg = JSON.parse(updates.defense_upgrades);
  assert.ok(upg.fortified, 'fortified flag set');
  assert.ok(events.some(e => e.message.includes('Fortified')), 'pushes Fortified event');
  console.log('Test 15: checkDefenseTiers grants Fortified ✓');
}

// Test 16: checkDefenseTiers revokes Fortified when requirements lost
{
  const k = makeKingdom({
    bld_walls: 0, bld_guard_towers: 0, bld_outposts: 0, bld_castles: 0,
    defense_upgrades: JSON.stringify({ fortified: true }),
  });
  const events = [];
  const updates = defense.checkDefenseTiers(k, events);
  assert.ok('defense_upgrades' in updates, 'sets defense_upgrades');
  const upg = JSON.parse(updates.defense_upgrades);
  assert.equal(upg.fortified, false, 'fortified revoked');
  assert.ok(events.some(e => e.message.includes('Lost Fortified')), 'pushes revocation event');
  console.log('Test 16: checkDefenseTiers revokes Fortified ✓');
}

// Test 17: all exports are functions
{
  const fns = ['defenseRating', 'wallDefensePower', 'towerDetectionPower', 'outpostRangerPower', 'checkDefenseTiers'];
  for (const name of fns) {
    assert.equal(typeof defense[name], 'function', `${name} is exported`);
  }
  console.log('Test 17: all exports are functions ✓');
}

console.log('\nAll defense tests passed.');
