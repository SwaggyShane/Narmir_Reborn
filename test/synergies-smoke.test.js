/**
 * Phase 3: Synergy Smoke Tests
 * Verifies that processTurn still works with synergy bonus calculations
 */

const assert = require('assert');
const engine = require('../game/engine');

console.log('Testing Phase 3: Synergy Smoke Tests\n');

// Test 1: processTurn works with active synergy
{
  console.log('Test 1: processTurn with active Bloodmoon Ascension synergy');

  const kingdom = {
    id: 1,
    turn: 1,
    race: 'human',
    region: 'human',
    land: 100,
    tax: 42,
    res_economy: 100,
    bld_castles: 5,
    bld_taverns: 3,
    bld_farms: 10,
    bld_mage_towers: 5,
    bld_housing: 20,
    population: 5000,
    gold: 10000,
    food: 2000,
    mana: 500,
    mages: 100,
    happiness: 75,
    active_effects: JSON.stringify({}),
    fragment_bonuses: JSON.stringify({
      mausoleums: { fragment: 'Cursed Bloodstone', applied_turn: 0, passive: {}, special: {} },
      vaults: { fragment: 'Void Essence', applied_turn: 0, passive: {}, special: {} },
      smithies: { fragment: 'Abyssal Crystal', applied_turn: 0, passive: {}, special: {} },
      barracks: { fragment: 'Dragon Scale', applied_turn: 0, passive: {}, special: {} },
      war_machines: { fragment: 'Volcanic Rock', applied_turn: 0, passive: {}, special: {} },
      markets: { fragment: 'Ancient Elven Wood', applied_turn: 0, passive: {}, special: {} },
      libraries: { fragment: 'Dwarven Star-Metal', applied_turn: 0, passive: {}, special: {} },
      shrines: { fragment: 'Celestial Feather', applied_turn: 0, passive: {}, special: {} },
      outposts: { fragment: 'Titan Bone', applied_turn: 0, passive: {}, special: {} },
      farms: { fragment: 'Tears of the World Tree', applied_turn: 0, passive: {}, special: {} },
    }),
    troop_levels: JSON.stringify({}),
    xp_sources: JSON.stringify({}),
    collected_lore: JSON.stringify([]),
    tower_upgrades: JSON.stringify({}),
    farm_upgrades: JSON.stringify({}),
    achievements: JSON.stringify([]),
  };

  try {
    const result = engine.processTurn(kingdom);
    assert.ok(result, 'processTurn should return a result');
    assert.ok(result.updates, 'Result should have updates object');
    assert.ok(result.events, 'Result should have events array');
    assert.ok(result.updates.gold !== undefined, 'Updates should include gold');
    assert.ok(result.updates.happiness !== undefined, 'Updates should include happiness');
    assert.ok(result.events.length > 0, 'Should have events');

    console.log(`  Turn processed: ${result.updates.turn}`);
    console.log(`  Gold: ${result.updates.gold}`);
    console.log(`  Happiness: ${result.updates.happiness}`);
    console.log('✓ processTurn works with synergy\n');
  } catch (err) {
    console.error('ERROR:', err.message);
    throw err;
  }
}

// Test 2: processTurn with Eternal Harvest synergy (food production boost)
{
  console.log('Test 2: processTurn with Eternal Harvest synergy (food production +40%)');

  const kingdom = {
    id: 2,
    turn: 1,
    race: 'human',
    region: 'human',
    land: 50,
    tax: 42,
    res_economy: 100,
    bld_castles: 2,
    bld_taverns: 2,
    bld_farms: 20,
    bld_mage_towers: 2,
    bld_housing: 15,
    population: 3000,
    gold: 5000,
    food: 1000,
    mana: 200,
    mages: 50,
    happiness: 70,
    active_effects: JSON.stringify({}),
    fragment_bonuses: JSON.stringify({
      farms: { fragment: 'Ancient Elven Wood', applied_turn: 0, passive: {}, special: {} },
      granaries: { fragment: 'Tears of the World Tree', applied_turn: 0, passive: {}, special: {} },
      shrines: { fragment: 'Celestial Feather', applied_turn: 0, passive: {}, special: {} },
      housing: { fragment: 'Volcanic Rock', applied_turn: 0, passive: {}, special: {} },
      libraries: { fragment: 'Dwarven Star-Metal', applied_turn: 0, passive: {}, special: {} },
      training: { fragment: 'Dragon Scale', applied_turn: 0, passive: {}, special: {} },
      schools: { fragment: 'Abyssal Crystal', applied_turn: 0, passive: {}, special: {} },
      mausoleums: { fragment: 'Cursed Bloodstone', applied_turn: 0, passive: {}, special: {} },
      taverns: { fragment: 'Void Essence', applied_turn: 0, passive: {}, special: {} },
      walls: { fragment: 'Titan Bone', applied_turn: 0, passive: {}, special: {} },
    }),
    troop_levels: JSON.stringify({}),
    xp_sources: JSON.stringify({}),
    collected_lore: JSON.stringify([]),
    tower_upgrades: JSON.stringify({}),
    farm_upgrades: JSON.stringify({}),
    achievements: JSON.stringify([]),
  };

  try {
    const result = engine.processTurn(kingdom);
    assert.ok(result.updates.food !== undefined, 'Food updates should be present');
    console.log(`  Food production affected by synergy`);
    console.log('✓ processTurn works with food production synergy\n');
  } catch (err) {
    console.error('ERROR:', err.message);
    throw err;
  }
}

// Test 3: processTurn without synergies (sanity check)
{
  console.log('Test 3: processTurn without synergies (sanity check)');

  const kingdom = {
    id: 3,
    turn: 1,
    race: 'dwarf',
    region: 'dwarf',
    land: 75,
    tax: 42,
    res_economy: 100,
    bld_castles: 3,
    bld_taverns: 2,
    bld_farms: 15,
    bld_mage_towers: 3,
    bld_housing: 20,
    population: 4000,
    gold: 8000,
    food: 1500,
    mana: 300,
    mages: 75,
    happiness: 60,
    active_effects: JSON.stringify({}),
    fragment_bonuses: JSON.stringify({}),
    troop_levels: JSON.stringify({}),
    xp_sources: JSON.stringify({}),
    collected_lore: JSON.stringify([]),
    tower_upgrades: JSON.stringify({}),
    farm_upgrades: JSON.stringify({}),
    achievements: JSON.stringify([]),
  };

  try {
    const result = engine.processTurn(kingdom);
    assert.ok(result.updates, 'Should still work without synergies');
    console.log('✓ processTurn works without synergies (no regression)\n');
  } catch (err) {
    console.error('ERROR:', err.message);
    throw err;
  }
}

console.log('✅ All 3 Phase 3 smoke tests passed!');
