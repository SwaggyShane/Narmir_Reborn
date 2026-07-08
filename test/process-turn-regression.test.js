'use strict';

const assert = require('assert');
const engine = require('../game/engine');

function makeMinimalFixture() {
  return {
    id: 999,
    player_id: 1,
    name: 'TestKingdom',
    race: 'human',
    turn: 42,
    turns_stored: 10,
    gold: 1000,
    food: 500,
    population: 1200,
    land: 150,
    happiness: 60,
    tax: 10,
    fighters: 50,
    rangers: 20,
    clerics: 10,
    mages: 5,
    thieves: 5,
    ninjas: 0,
    researchers: 10,
    engineers: 5,
    scribes: 2,
    thralls: 0,
    bld_farms: 5,
    bld_granaries: 2,
    bld_barracks: 1,
    bld_outposts: 1,
    bld_guard_towers: 0,
    bld_schools: 1,
    bld_armories: 0,
    bld_vaults: 1,
    bld_smithies: 1,
    bld_markets: 1,
    bld_mage_towers: 0,
    bld_shrines: 0,
    bld_training: 0,
    bld_castles: 0,
    bld_housing: 3,
    bld_libraries: 1,
    bld_taverns: 0,
    bld_mausoleums: 0,
    bld_woodyard: 0,
    bld_lumber_camp: 0,
    bld_blockfield: 0,
    bld_stone_quarry: 0,
    bld_strip_mine: 0,
    res_economy: 1,
    res_weapons: 0,
    res_armor: 0,
    res_military: 0,
    res_spellbook: 0,
    res_attack_magic: 0,
    res_defense_magic: 0,
    res_entertainment: 0,
    res_construction: 0,
    res_war_machines: 0,
    school_spellbook: 'none',
    troop_levels: '{}',
    xp: 0,
    level: 1,
    prestige_level: 0,
    scout_allocation: 0,
    scout_progress: 0,
    war_machines: 0,
    ballistae: 0,
    weapons_stockpile: 0,
    armor_stockpile: 0,
    ladders: 0,
    hammers_stored: 0,
    scaffolding_stored: 0,
    blueprints_stored: 0,
    wood: 100,
    stone: 50,
    iron: 20,
    coal: 10,
    steel: 5,
    maps: 0,
    hp: 100,
    max_hp: 100,
    wall_hp: 100,
    discovered_kingdoms: '{}',
    location_maps_wip: '[]',
    active_event: '{}',
    xp_sources: '{}',
    racial_bonuses_unlocked: '{}',
    fragment_bonuses: '{}',
    library_progress: '{}',
    tower_progress: '{}',
    last_turn_at: Math.floor(Date.now() / 1000) - 1000,
    created_at: Math.floor(Date.now() / 1000) - 100000,
    updated_at: Math.floor(Date.now() / 1000) - 100,
    // add more as needed to avoid undefined errors in processTurn paths
    food_surplus_turns: 0,
    food_shortage_turns: 0,
    last_event_at: 0,
    // minimal for attunements etc.
  };
}

{
  const k = makeMinimalFixture();
  const originalTurn = k.turn;
  const originalGold = k.gold;
  const originalPop = k.population;
  const originalFood = k.food;

  const result = engine.processTurn(k, null);  // db null for basic path (pure logic)
  const updates = result.updates || result;

  assert.strictEqual(updates.turn, originalTurn + 1, 'processTurn should increment turn');
  assert.ok(updates.updated_at > 0, 'should update timestamp');
  assert.ok(updates.population >= 1000, 'population should not drop below min');
  assert.ok(typeof updates.gold === 'number', 'gold should be number');

  // Additional regression coverage (resources, no catastrophic loss on minimal fixture)
  assert.ok(updates.gold >= originalGold - 100, 'gold should not crash on minimal fixture');
  assert.ok(updates.food >= originalFood - 50, 'food should be reasonable');
  assert.ok(updates.population >= originalPop - 20 && updates.population <= originalPop + 50, 'pop movement bounded on basic turn');
  assert.ok(updates.turns_stored == null || updates.turns_stored >= 0, 'turns_stored non-negative or absent');

  console.log('✓ Basic processTurn regression test passed (turn incremented, no crash, basic invariants)');
}

// Multiple sequential turns regression (simulates a few ticks without DB)
{
  let k = makeMinimalFixture();
  const startTurn = k.turn;
  for (let i = 0; i < 5; i++) {
    const r = engine.processTurn(k, null);
    k = { ...k, ...(r.updates || r) };
  }
  assert.strictEqual(k.turn, startTurn + 5, '5 sequential turns should advance turn by 5');
  assert.ok(k.population > 0 && k.gold >= 0 && k.food >= 0, 'resources stay non-negative over multiple turns');
  console.log('✓ Multi-turn sequential regression passed');
}

// Minimal edge: zeroed resources + stored turns
{
  const k = makeMinimalFixture();
  k.gold = 0;
  k.food = 0;
  k.turns_stored = 3;
  const r = engine.processTurn(k, null);
  const u = r.updates || r;
  assert.strictEqual(u.turn, k.turn + 1);
  assert.ok(u.gold >= 0, 'gold stays non-negative from zero');
  assert.ok(u.food >= 0, 'food stays non-negative from zero');
  console.log('✓ Edge zero-resources + turns_stored regression passed');
}

console.log('✓ All processTurn regression checks passed');

module.exports = {}; // for runner
