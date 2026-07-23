'use strict';

const assert = require('assert');
const { getLocationTurnCost } = require('../game/location-distance');
const { getEpicTrekTurns, getPathHexes } = require('../game/epic-trek-paths');
const { calculateLandExpansionReward } = require('../game/land-expansion');
const { EPIC_TREK_DISCOVERY, rollBiomeResourceDiscovery } = require('../game/epic-trek-discovery');
const { getUnitName, racialUnitBonus } = require('../game/lib/troops');
const config = require('../game/config');

console.log('Testing half-wire terrain / race / elevation paths\n');

// Wood elf expedition speed shortens dungeon/mountain turn cost
{
  const base = getLocationTurnCost('dungeon', 10);
  const wood = getLocationTurnCost('dungeon', 10, 'wood_elf');
  const human = getLocationTurnCost('dungeon', 10, 'human');
  assert.ok(wood < base, `wood_elf cost ${wood} < base ${base}`);
  assert.ok(human <= base, 'human at or below base (speed 1.1)');
  assert.ok(wood < human, 'wood_elf faster than human');
  console.log('Test 1: getLocationTurnCost race speed ✓');
}

// Wood elf land expansion +75%
{
  const rangers = 100;
  const level = 1;
  const human = calculateLandExpansionReward(rangers, level, 'forest', 'human', 100000, 0, 0);
  const wood = calculateLandExpansionReward(rangers, level, 'forest', 'wood_elf', 100000, 0, 0);
  assert.ok(wood.landsDiscovered > human.landsDiscovered, 'wood_elf discovers more land');
  // 1.75× before diminishing/pop clamp
  assert.ok(
    wood.landsDiscovered >= Math.floor(human.landsDiscovered * 1.5),
    `expected ~1.75×, got wood=${wood.landsDiscovered} human=${human.landsDiscovered}`,
  );
  console.log('Test 2: wood_elf land_expansion_modifier ✓');
}

// Ogre warrior naming + racial bonus
{
  assert.equal(getUnitName('ogre', 'fighters', 0), 'Ogre Warriors');
  const bonus = racialUnitBonus(
    { race: 'ogre', troop_levels: JSON.stringify({ fighters: { level: 25 } }) },
    'fighters',
  );
  assert.equal(bonus.ogreWarriorDamage, 1.25);
  assert.ok(config.TROOP_RACE_BONUS.ogre.fighters >= 1.25);
  assert.ok(config.RACE_COMBAT_MODIFIERS.ogre >= 1.2);
  console.log('Test 3: ogre warriors wired ✓');
}

// Volcanic biome resources
{
  assert.equal(EPIC_TREK_DISCOVERY.BIOME_RESOURCES.volcanic, 'iron');
  assert.equal(EPIC_TREK_DISCOVERY.BIOME_RESOURCES.tundra, 'stone');
  let hits = 0;
  const k = { id: 3, turn: 1 };
  for (let c = 0; c < 80; c++) {
    for (let r = 0; r < 20; r++) {
      if (rollBiomeResourceDiscovery(c, r, 'volcanic', k)) hits++;
    }
  }
  assert.ok(hits > 0, 'volcanic biome can yield resources');
  console.log('Test 4: volcanic biome resource rolls ✓');
}

// Full-path elevation multiplies epic trek cost when flag+grid present
{
  const startX = 100;
  const startY = 100;
  const targetX = 400;
  const targetY = 400;
  const path = getPathHexes(startX, startY, targetX, targetY);
  assert.ok(path.length >= 2, 'path has multiple hexes');

  const flatGrid = {};
  const climbGrid = {};
  path.forEach((h, i) => {
    flatGrid[`${h.col},${h.row}`] = 10;
    climbGrid[`${h.col},${h.row}`] = 10 + i * 20;
  });

  const getFlag = (name) => name === 'FEATURE_ELEVATION_MOVEMENT';
  const base = getEpicTrekTurns(startX, startY, targetX, targetY, {});
  const flat = getEpicTrekTurns(startX, startY, targetX, targetY, {
    getFlag,
    elevationGrid: flatGrid,
  });
  const climb = getEpicTrekTurns(startX, startY, targetX, targetY, {
    getFlag,
    elevationGrid: climbGrid,
  });
  assert.ok(flat > base, 'elevation path costs more than no-elevation baseline');
  assert.ok(climb >= flat, 'climbing path >= flat elevation path');

  const wood = getEpicTrekTurns(startX, startY, targetX, targetY, {
    raceSpeed: config.RACE_BONUSES.wood_elf.expedition_speed,
  });
  assert.ok(wood < base, 'wood_elf raceSpeed reduces trek turns');
  console.log('Test 5: full-path elevation + raceSpeed on epic trek ✓');
}

console.log('\nAll half-wire terrain/race tests passed.');
