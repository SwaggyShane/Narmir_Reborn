'use strict';
// Unit tests for game/land-expansion.js and game/economy.js's
// minPopulationToStaffFarms/farmWorkersNeeded (2026-07-22).
//
// Motivated by a live production incident: sending 47,000 rangers on an
// instant land-expansion mission spent population down to 78 (from
// 101,278), with no floor at all. Two real bugs found while investigating:
// 1. The route read k.lands (plural, nonexistent column) instead of
//    k.land, so currentLands was always 0 -- diminishing returns never
//    reduced yield for kingdoms that already owned land.
// 2. There was no independent floor on population spend at all, only a
//    clamp to "whatever population currently exists".
//
// Run: node test/land-expansion.test.js

const assert = require('assert');
const {
  calculateLandExpansionReward,
  applyDiminishingReturns,
} = require('../game/land-expansion');
const { minPopulationToStaffFarms, farmWorkersNeeded } = require('../game/economy');

function main() {
  // 1. minPopulationToStaffFarms: race-specific workers-per-farm, no upgrade.
  {
    const k = { race: 'dwarf', bld_farms: 200 };
    assert.strictEqual(farmWorkersNeeded(k), 8, 'dwarf base workers-per-farm is 8');
    assert.strictEqual(minPopulationToStaffFarms(k), 1600, '200 farms x 8 workers = 1600 floor');
  }
  console.log('✓ minPopulationToStaffFarms: race-specific base rate');

  // 2. iron_plows reduces the per-farm requirement (and therefore the floor).
  {
    const k = { race: 'human', bld_farms: 100, farm_upgrades: JSON.stringify({ iron_plows: true }) };
    assert.strictEqual(farmWorkersNeeded(k), 8, 'human 10 - 2 (iron_plows) = 8');
    assert.strictEqual(minPopulationToStaffFarms(k), 800);
  }
  console.log('✓ minPopulationToStaffFarms: iron_plows discount applied');

  // 3. Vampires staff farms with thralls, not population -- floor is 0.
  {
    const k = { race: 'vampire', bld_farms: 500 };
    assert.strictEqual(minPopulationToStaffFarms(k), 0, 'vampire farms are not population-gated');
  }
  console.log('✓ minPopulationToStaffFarms: 0 for vampires (thrall-staffed)');

  // 4. No farms built -> no floor.
  {
    assert.strictEqual(minPopulationToStaffFarms({ race: 'human', bld_farms: 0 }), 0);
    assert.strictEqual(minPopulationToStaffFarms({ race: 'human' }), 0, 'missing bld_farms treated as 0');
  }
  console.log('✓ minPopulationToStaffFarms: 0 with no farms');

  // 5. The reported incident, reproduced: with the floor applied, population
  //    never drops below what's needed to staff farms, even with a wildly
  //    oversized ranger count.
  {
    const k = { race: 'dwarf', bld_farms: 200, population: 101278, land: 17733 };
    const floor = minPopulationToStaffFarms(k);
    const reward = calculateLandExpansionReward(47000, 1, 'grassland', k.race, k.population, k.land, floor);
    const popAfter = k.population - reward.populationCost;
    assert.ok(popAfter >= floor, `population after cost (${popAfter}) must not go below the floor (${floor})`);
    assert.ok(reward.landsDiscovered > 0, 'a huge ranger count should still discover a meaningful amount of land');
  }
  console.log('✓ calculateLandExpansionReward: never spends below the population floor');

  // 6. Without a floor (default 0, back-compat for callers that don't pass
  //    one), population can still be spent all the way down -- floor is
  //    opt-in via the parameter, not force-applied inside the module.
  {
    const reward = calculateLandExpansionReward(47000, 1, 'grassland', 'dwarf', 101278, 17733);
    const popAfter = 101278 - reward.populationCost;
    assert.ok(popAfter < 1600, 'no floor passed -> old clamp-to-population-only behavior');
  }
  console.log('✓ calculateLandExpansionReward: floor is opt-in (default 0), not forced');

  // 7. Regression: currentLands must actually reduce yield (the k.lands vs
  //    k.land bug meant this never happened in production).
  {
    const noLand = applyDiminishingReturns(1000, 0);
    const lotsOfLand = applyDiminishingReturns(1000, 50000);
    assert.ok(lotsOfLand < noLand, 'diminishing returns must reduce yield as currentLands grows');
  }
  console.log('✓ applyDiminishingReturns: yield actually decreases as owned land grows');

  console.log('\nAll land-expansion tests passed.');
}

main();
