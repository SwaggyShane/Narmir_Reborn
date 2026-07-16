'use strict';

const assert = require('assert');
const {
  TERRAIN_SCOUT,
  DEFAULT_SCOUT,
  getTerrainScoutModifiers,
  getKingdomHomeTerrain,
  getKingdomScoutRate,
  getKingdomScoutFoodMult,
} = require('../game/terrain-scout');
const { getScoutProgressThisTurn } = require('../game/scout-progress');
const { hexesExploredPerAction, scoutFoodCostPerHex } = require('../game/scout-economy');

// ── table coverage ──────────────────────────────────────────────────────────
{
  for (const t of ['plains', 'forest', 'mountains', 'hills', 'swamp', 'desert', 'tundra', 'volcanic', 'lake', 'ocean']) {
    assert.ok(TERRAIN_SCOUT[t], `TERRAIN_SCOUT has ${t}`);
    assert.ok(TERRAIN_SCOUT[t].scoutRate > 0);
    assert.ok(TERRAIN_SCOUT[t].foodCostMult > 0);
  }
  assert.ok(TERRAIN_SCOUT.plains.scoutRate > TERRAIN_SCOUT.mountains.scoutRate, 'plains easier than mountains');
  assert.ok(TERRAIN_SCOUT.mountains.foodCostMult > TERRAIN_SCOUT.plains.foodCostMult, 'mountains cost more food');
}
console.log('TERRAIN_SCOUT: coverage and plains > mountains scout rate');

// ── modifiers ───────────────────────────────────────────────────────────────
{
  assert.deepStrictEqual(getTerrainScoutModifiers(null), DEFAULT_SCOUT);
  assert.deepStrictEqual(getTerrainScoutModifiers('nope'), DEFAULT_SCOUT);
  const m = getTerrainScoutModifiers('mountains');
  assert.strictEqual(m.scoutRate, TERRAIN_SCOUT.mountains.scoutRate);
}
console.log('getTerrainScoutModifiers: defaults + lookup');

// ── race fallback when no hex grid cache ────────────────────────────────────
{
  // Without setHexGrid, home terrain falls back to race predominant biome
  const dwarf = { id: 1, race: 'dwarf' };
  const terrain = getKingdomHomeTerrain(dwarf);
  assert.strictEqual(terrain, 'mountains', 'dwarf race fallback is mountains');
  assert.ok(getKingdomScoutRate(dwarf) < 1, 'dwarf home scout rate < 1 (mountains)');
  assert.ok(getKingdomScoutFoodMult(dwarf) > 1, 'dwarf food mult > 1');

  const human = { id: 2, race: 'human' };
  assert.strictEqual(getKingdomHomeTerrain(human), 'plains');
  assert.ok(getKingdomScoutRate(human) > 1, 'human plains scout rate > 1');
}
console.log('getKingdomHomeTerrain: race fallback without cache');

// ── scout progress uses terrain rate ────────────────────────────────────────
{
  const base = {
    scout_allocation: 1000,
    troop_levels: { rangers: { level: 1 } },
    race: 'human',
    id: 10,
  };
  const humanProg = getScoutProgressThisTurn(base);
  const dwarfProg = getScoutProgressThisTurn({ ...base, race: 'dwarf', id: 11 });
  // Same allocation; dwarf race scout_rate * mountain terrain both lower than human+plains
  assert.ok(humanProg > dwarfProg, `human ${humanProg} > dwarf ${dwarfProg}`);
  assert.ok(humanProg > 0 && dwarfProg > 0);
}
console.log('getScoutProgressThisTurn: terrain/race slows mountain dwarves vs plains humans');

// ── economy helpers accept terrain mults ────────────────────────────────────
{
  const baseHex = hexesExploredPerAction(1000, 1, 1);
  const easyHex = hexesExploredPerAction(1000, 1, 1.12);
  const hardHex = hexesExploredPerAction(1000, 1, 0.78);
  assert.ok(easyHex > baseHex && baseHex > hardHex);

  const baseFood = scoutFoodCostPerHex(1, 1);
  const hardFood = scoutFoodCostPerHex(1, 1.2);
  assert.ok(hardFood >= baseFood, 'harder terrain costs at least as much food');
}
console.log('hexesExploredPerAction / scoutFoodCostPerHex: terrain mults applied');

// ── alloc 0 still zero progress ─────────────────────────────────────────────
{
  assert.strictEqual(
    getScoutProgressThisTurn({ scout_allocation: 0, race: 'human', id: 1 }),
    0,
  );
}
console.log('scout progress: zero allocation still zero');

console.log('\n✅ All terrain-scout tests passed!');
