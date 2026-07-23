'use strict';

const assert = require('assert');
const {
  processInjuredTroopsTurn,
  countInjuredByType,
} = require('../game/lib/injury-recovery');
const { processTurn } = require('../game/lib/turn-pipeline');

console.log('Testing injury-recovery\n');

// Fully healed troops return to the unit column
{
  const k = {
    race: 'human',
    fighters: 10,
    clerics: 50,
    troop_levels: JSON.stringify({ clerics: { level: 10, xp: 0 } }),
    injured_troops: JSON.stringify({
      fighters: [
        { hp: 300, max_hp: 320 },
        { hp: 100, max_hp: 320 },
      ],
    }),
    bld_shrines: 2,
  };
  const updates = {};
  const events = [];
  const result = processInjuredTroopsTurn(k, updates, events);
  assert.ok(result.recovered.fighters >= 1, 'at least one fighter recovers with strong healing');
  assert.ok(updates.fighters > 10, 'recovered fighters rejoin healthy column');
  assert.ok(typeof updates.injured_troops === 'string', 'injured_troops serialized');
  const still = JSON.parse(updates.injured_troops);
  const remainingHp = (still.fighters || []).map((t) => t.hp);
  assert.ok(remainingHp.every((hp) => hp < 320), 'full-healed entries removed from pool');
  assert.ok(events.some((e) => /wounded|recover/i.test(e.message)), 'recovery event emitted');
  console.log('Test 1: heal + promote ✓');
}

// Dead entries purged, no promotion of corpses
{
  const k = {
    race: 'human',
    fighters: 5,
    clerics: 0,
    injured_troops: JSON.stringify({
      fighters: [
        { hp: 0, max_hp: 200 },
        { hp: 50, max_hp: 200 },
      ],
    }),
  };
  const updates = {};
  const events = [];
  processInjuredTroopsTurn(k, updates, events);
  const still = JSON.parse(updates.injured_troops || '{}');
  assert.ok(!(still.fighters || []).some((t) => t.hp <= 0), 'dead purged');
  assert.equal((still.fighters || []).length, 1, 'one living injured remains');
  console.log('Test 2: dead purged ✓');
}

// countInjuredByType
{
  const counts = countInjuredByType({
    fighters: [{ hp: 10, max_hp: 100 }, { hp: 0, max_hp: 100 }],
    rangers: [{ hp: 5, max_hp: 80 }],
  });
  assert.equal(counts.fighters, 1);
  assert.equal(counts.rangers, 1);
  console.log('Test 3: countInjuredByType ✓');
}

// processTurn playlist includes injury recovery
{
  const k = {
    id: 999001,
    race: 'human',
    name: 'InjuryTest',
    turn: 10,
    gold: 1000,
    food: 5000,
    population: 1000,
    happiness: 100,
    tax: 10,
    land: 50,
    fighters: 20,
    rangers: 0,
    mages: 0,
    clerics: 30,
    thieves: 0,
    ninjas: 0,
    engineers: 0,
    researchers: 0,
    scribes: 0,
    war_machines: 0,
    thralls: 0,
    bld_farms: 1,
    bld_housing: 1,
    bld_markets: 0,
    bld_barracks: 1,
    bld_training: 0,
    bld_shrines: 1,
    bld_schools: 0,
    bld_libraries: 0,
    bld_smithies: 0,
    bld_walls: 0,
    bld_castles: 0,
    troop_levels: JSON.stringify({ clerics: { level: 5 }, fighters: { level: 1 } }),
    injured_troops: JSON.stringify({
      fighters: [{ hp: 280, max_hp: 300 }],
    }),
    training_allocation: '{}',
    research_allocation: '{}',
    build_allocation: '{}',
    resource_build_allocation: '{}',
    active_effects: '{}',
    xp_sources: '{}',
    prestige_level: 0,
  };
  const out = processTurn(k, null);
  assert.ok(out.updates, 'processTurn returns updates');
  assert.ok(
    out.updates.injured_troops !== undefined || out.events.some((e) => /wounded|recover/i.test(e.message)),
    'turn touches injury recovery',
  );
  console.log('Test 4: processTurn wires injury recovery ✓');
}

console.log('\nAll injury-recovery tests passed.');
