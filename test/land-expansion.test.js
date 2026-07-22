'use strict';
// Unit tests for game/land-expansion.js and game/economy.js's
// minPopulationToStaffFarms/farmWorkersNeeded (2026-07-22).
//
// Motivated by two live production incidents on the same kingdom:
// 1. Sending 47,000 rangers on an instant land-expansion mission spent
//    population down to 78 (from 101,278), with no floor at all. Also
//    found: the route read k.lands (plural, nonexistent column) instead
//    of k.land, so currentLands was always 0 -- diminishing returns never
//    reduced yield for kingdoms that already owned land.
// 2. After adding a farms-only floor (bld_farms x workersNeeded), a
//    SECOND land-expansion left population at 8,334 with every farm
//    unmanned, above the farms-only floor (6,000) the whole time. Looked
//    like the floor needed totalHiredUnits(k) added in -- but the real
//    root cause was that farmProduction (and marketIncomeFull and
//    processResourceYield) separately subtracted totalHiredUnits(k) from
//    population AGAIN before assigning workers, even though hireUnits()
//    already deducts population at hire time (confirmed against both the
//    hire and fire routes). Fixed at the source in game/economy.js; the
//    floor here correctly stays farms-only. See test/economy.test.js
//    Test 7b for the fix itself.
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

  // 4b. Regression: the floor must stay farms-only and must NOT include
  //     hired units. A second production incident on the same kingdom
  //     initially looked like the floor needed totalHiredUnits(k) added
  //     in (population sat above the farms-only floor of 6,000 while every
  //     farm still showed 0 manned) -- but the real root cause was that
  //     farmProduction itself (game/economy.js) separately subtracted
  //     totalHiredUnits(k) from population AGAIN before assigning farm
  //     workers, even though hireUnits() already deducts population at
  //     hire time (a citizen becomes a soldier and leaves the population
  //     count for good -- confirmed against both the hire and fire
  //     routes: firing N units adds N back to population). That's
  //     double-counting the same troops twice, not a missing floor term.
  //     Fixed at the source in farmProduction/marketIncomeFull/
  //     processResourceYield (see test/economy.test.js Test 7b) --
  //     population alone is already the correct free-labor figure, so the
  //     floor here stays farms * workersNeeded, unchanged.
  {
    const k = {
      race: 'dwarf',
      bld_farms: 1000,
      farm_upgrades: JSON.stringify({ iron_plows: true }),
      rangers: 38000,
      engineers: 5000,
      researchers: 100,
    };
    const floor = minPopulationToStaffFarms(k);
    assert.strictEqual(floor, 1000 * farmWorkersNeeded(k), 'floor must stay farms-only, not include hired units');
    assert.strictEqual(floor, 6000);
  }
  console.log('✓ minPopulationToStaffFarms: stays farms-only (hired units are not the floor\'s concern)');

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
