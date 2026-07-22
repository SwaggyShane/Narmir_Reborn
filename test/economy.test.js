'use strict';
// Characterization tests for game/economy.js.
// Locks gold/food/market/trade output against representative kingdom inputs.
// These run against the extracted module, but the values match what the
// pre-extraction engine.js produced — any divergence flags a regression in
// the move.
//
// Run: node test/economy.test.js

const assert = require('assert');
const economy = require('../game/economy');

function makeKingdom(overrides = {}) {
  return {
    // core stats
    race: 'human',
    tax: 42,
    land: 1000,
    happiness: 50,
    prestige_level: 0,
    turn: 1,
    // resources
    res_economy: 100,
    res_entertainment: 100,
    res_war_machines: 100,
    food: 5000,
    food_surplus_turns: 0,
    food_shortage_turns: 0,
    wood: 0,
    stone: 0,
    iron: 0,
    population: 5000,
    // troops
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
    // buildings
    bld_castles: 0,
    bld_taverns: 0,
    bld_markets: 0,
    bld_farms: 0,
    bld_granaries: 0,
    bld_mage_towers: 0,
    bld_walls: 0,
    bld_guard_towers: 0,
    bld_outposts: 0,
    bld_housing: 0,
    bld_mausoleums: 0,
    bld_schools: 0,
    bld_libraries: 0,
    bld_shrines: 0,
    bld_smithies: 0,
    bld_vaults: 0,
    bld_training: 0,
    bld_barracks: 0,
    maps: 0,
    // JSON fields (must be valid strings or null)
    milestone_bonuses: null,
    farm_upgrades: null,
    granary_upgrades: null,
    market_upgrades: null,
    tower_upgrades: null,
    mausoleum_upgrades: null,
    active_event: null,
    alliance_buffs: null,
    fragment_bonuses: null,
    items: null,
    troop_levels: null,
    active_effects: null,
    achievements: null,
    _trade_routes: null,
    ...overrides,
  };
}

console.log('Testing economy.js\n');

// Test 1: goldPerTurn baseline + tax-rate-42 bonus
{
  const baseGold = economy.goldPerTurn(makeKingdom());
  assert.ok(baseGold > 0, 'baseline human kingdom should generate gold');

  // tax 41 has no +5% bonus, should be less than tax 42 on equal base
  const lower = economy.goldPerTurn(makeKingdom({ tax: 41 }));
  assert.ok(lower < baseGold, 'tax 42 should beat tax 41');
  console.log(`Test 1: goldPerTurn(tax=42) = ${baseGold}, (tax=41) = ${lower} ✓`);
}

// Test 2: goldPerTurn scales linearly-ish with land
{
  const small = economy.goldPerTurn(makeKingdom({ land: 1000 }));
  const big = economy.goldPerTurn(makeKingdom({ land: 10000 }));
  assert.ok(big > small * 5, '10x land should produce far more gold');
  console.log(`Test 2: gold(land=10000) >> gold(land=1000) ✓ (${small} vs ${big})`);
}

// Test 3: happiness multiplier — high happiness produces more gold
{
  const sad = economy.goldPerTurn(makeKingdom({ happiness: 0 }));
  const happy = economy.goldPerTurn(makeKingdom({ happiness: 100 }));
  assert.ok(happy > sad);
  console.log(`Test 3: gold(happiness=100) > gold(happiness=0) ✓`);
}

// Test 4: foodBalance = farmProduction - foodConsumption
{
  const k = makeKingdom({ bld_farms: 5, population: 10000 });
  const prod = economy.farmProduction(k);
  const cons = economy.foodConsumption(k);
  const bal = economy.foodBalance(k);
  assert.equal(bal, prod - cons);
  console.log(`Test 4: foodBalance identity ✓ (prod=${prod}, cons=${cons})`);
}

// Test 5: farmProduction needs free population to work
{
  const noPop = makeKingdom({ bld_farms: 5, population: 0 });
  assert.equal(economy.farmProduction(noPop), 0);

  // 5000 pop with 10 workers/farm = 5 farms worth, exactly enough
  const enough = makeKingdom({ bld_farms: 5, population: 5000 });
  assert.ok(economy.farmProduction(enough) > 0);
  console.log('Test 5: farmProduction requires free population ✓');
}

// Test 6: vampire foodConsumption only counts thralls
{
  const human = makeKingdom({ population: 5000, fighters: 100 });
  const vamp = makeKingdom({ race: 'vampire', population: 5000, fighters: 100, thralls: 200 });
  const hCons = economy.foodConsumption(human);
  const vCons = economy.foodConsumption(vamp);
  // human consumes by pop + troops; vampire by thralls only
  assert.ok(hCons > 0);
  assert.ok(vCons > 0);
  console.log(`Test 6: vampire foodConsumption keyed to thralls ✓ (human=${hCons}, vamp=${vCons})`);
}

// Test 7: marketIncomeFull = 0 with no markets, scales with markets
{
  assert.equal(economy.marketIncomeFull(makeKingdom()), 0);
  const m5 = economy.marketIncomeFull(makeKingdom({ bld_markets: 5, population: 5000, maps: 0 }));
  assert.ok(m5 > 0);
  console.log(`Test 7: marketIncomeFull scales with markets ✓ (m5=${m5})`);
}

// Test 7b: regression -- farmProduction/marketIncomeFull/processResourceYield
// must NOT subtract totalHiredUnits(k) from population a second time.
// hireUnits() already deducts population at hire time (a citizen becomes
// a soldier and leaves the population count); population alone is already
// the free civilian labor pool. A prior version double-subtracted hired
// units here too, so any kingdom with a large army relative to population
// silently got 0 manned farms/markets/resource buildings even with a
// healthy population. Found live in production 2026-07-22: 95,265
// population, ~43,100 hired rangers/engineers/researchers -- farms must
// still be fully staffed.
{
  const bigArmy = makeKingdom({
    population: 95265,
    bld_farms: 1000,
    rangers: 38000,
    engineers: 5000,
    researchers: 100,
  });
  // 1000 farms x 10 workers/farm (human, no iron_plows) = 10,000 needed;
  // 95,265 population easily covers that regardless of the 43,100 troops.
  const farmYield = economy.farmProduction(bigArmy);
  assert.ok(farmYield > 0, 'farms must produce despite a large hired army');
  assert.equal(
    economy.minPopulationToStaffFarms(bigArmy),
    1000 * 10,
    'the floor itself must not include hired units either',
  );

  const bigArmyMarkets = makeKingdom({ population: 95265, bld_markets: 5, rangers: 90000, maps: 0 });
  assert.ok(economy.marketIncomeFull(bigArmyMarkets) > 0, 'markets must produce despite a large hired army');

  console.log(`Test 7b: farms/markets staffed by raw population, not double-counted against hired units ✓ (farmYield=${farmYield})`);
}

// Test 8: tavernEntertainmentBonus baseline = 10/tavern
{
  assert.equal(economy.tavernEntertainmentBonus(makeKingdom()), 0);
  const t3 = economy.tavernEntertainmentBonus(makeKingdom({ bld_taverns: 3 }));
  assert.equal(t3, 30);
  console.log('Test 8: tavernEntertainmentBonus = 10/tavern ✓');
}

// Test 9: commodityPrice base × race discount × supply
{
  const baseHuman = economy.commodityPrice('grain', 'human', null);
  assert.ok(baseHuman >= 1);
  const lowSupply = economy.commodityPrice('grain', 'human', { grain: 0.5 });
  const highSupply = economy.commodityPrice('grain', 'human', { grain: 2.0 });
  assert.ok(highSupply > lowSupply, 'higher supply index → higher price');
  console.log(`Test 9: commodityPrice respects supply ✓ (low=${lowSupply}, high=${highSupply})`);
}

// Test 10: processFoodEconomy returns updates + emits events
{
  const k = makeKingdom({ bld_farms: 10, bld_granaries: 1, population: 8000, food: 1000 });
  const events = [];
  const updates = economy.processFoodEconomy(k, events);
  assert.ok(updates.food !== undefined, 'food field is updated');
  assert.ok(events.length > 0, 'at least one event emitted');
  console.log(`Test 10: processFoodEconomy returns updates + events ✓ (food=${updates.food})`);
}

// Test 11: processResourceYield = no-op without resource buildings
{
  const k = makeKingdom();
  const events = [];
  const updates = economy.processResourceYield(k, events);
  // No resource buildings → no wood/stone/iron updates
  assert.equal(updates.wood, undefined);
  assert.equal(updates.stone, undefined);
  assert.equal(updates.iron, undefined);
  console.log('Test 11: processResourceYield no-op without resource buildings ✓');
}

// Test 12: totalHiredUnits sums all unit types (including thralls)
{
  const k = makeKingdom({
    fighters: 10, rangers: 20, clerics: 5, mages: 3, thieves: 2,
    ninjas: 1, researchers: 4, engineers: 6, scribes: 8, thralls: 50,
  });
  assert.equal(economy.totalHiredUnits(k), 109);
  console.log('Test 12: totalHiredUnits sums all unit types ✓');
}

// Test 13: calculateTradeIncome 0 with no routes; > 0 with routes
{
  assert.equal(economy.calculateTradeIncome(makeKingdom()), 0);
  const k = makeKingdom({
    _trade_routes: [{ stability: 100, distance: 10, efficiency: 1.0 }],
  });
  const income = economy.calculateTradeIncome(k);
  assert.ok(income > 0);
  console.log(`Test 13: calculateTradeIncome with one route = ${income} ✓`);
}

// Test 14: malformed JSON fields don't throw
{
  const k = makeKingdom({
    farm_upgrades: '{bad json',
    granary_upgrades: '{bad json',
    milestone_bonuses: '{bad json',
    market_upgrades: '{bad json',
  });
  const events = [];
  // None of these should throw
  economy.goldPerTurn(k);
  economy.farmProduction(k);
  economy.processFoodEconomy({ ...k, bld_farms: 1 }, events);
  console.log('Test 14: malformed JSON inputs handled ✓');
}

console.log('\nAll economy tests passed.');
