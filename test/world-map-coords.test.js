'use strict';

const assert = require('assert');
const {
  MAP_WIDTH,
  MAP_HEIGHT,
  getKingdomMapCoords,
  placeResourceNodeCoords,
} = require('../game/world-map-coords');
const { nearestRaceHome, isWaterPoint } = require('../game/world-regions');
const { pixelToHex, hexCenter } = require('../game/hex-utils');
const { setWorldSeedForTests } = require('../game/world-seed');

// Matches WorldmapRenderer.jsx's hex-cell coloring exactly: a hex is colored
// by its CELL CENTER's nearest race, not by any raw point that happens to
// land inside it. Region-alignment checks must use the same rule the
// renderer uses, or a point can be "nearest its own race" while still
// rendering inside a neighboring race's hex at a region boundary.
function hexRegionRace(x, y) {
  const hex = pixelToHex(x, y);
  const center = hexCenter(hex.col, hex.row);
  return nearestRaceHome(center.x, center.y);
}

// Placement is seeded (Fog of War Phase 1.5) — a test seed must be primed
// before any call, same as the live server loads one from db.world_state
// at boot.
setWorldSeedForTests(424242n);

const dwarfA = getKingdomMapCoords({ id: 12, race: 'dwarf' });
const dwarfB = getKingdomMapCoords({ id: 12, race: 'dwarf' });
assert.strictEqual(dwarfA.map_x, dwarfB.map_x, 'kingdom coords must be stable for same id and seed');
assert.strictEqual(dwarfA.map_y, dwarfB.map_y, 'kingdom coords must be stable for same id and seed');
assert.ok(dwarfA.map_x >= 0 && dwarfA.map_x <= MAP_WIDTH, 'kingdom x within map');
assert.ok(dwarfA.map_y >= 0 && dwarfA.map_y <= MAP_HEIGHT, 'kingdom y within map');
console.log('stability: same id+race+seed always produces the same kingdom coords');

// --- Region alignment: a kingdom must land in a hex region matching its
// own race (the exact gap Phase 1's validation script found broken 53% of
// the time under the old fixed REGION_SEEDS placement) ---
const raceHomes = ['dwarf', 'high_elf', 'wood_elf', 'vampire', 'ogre', 'dark_elf', 'orc', 'human', 'dire_wolf'];
raceHomes.forEach((race) => {
  for (let id = 1; id <= 20; id++) {
    const coords = getKingdomMapCoords({ id, race });
    const resolvedRace = hexRegionRace(coords.map_x, coords.map_y);
    assert.strictEqual(resolvedRace, race, `kingdom id=${id} race=${race} must land in its own race's region, landed in ${resolvedRace}'s region instead`);
  }
});
console.log('region alignment: all sampled kingdoms across all 9 races land in their own race\'s region');

// --- No water spawns: a kingdom must never land in an ocean/tundra hex
// (Phase 1's validation script found 6/5,000 kingdoms violating this under
// the old placement) ---
raceHomes.forEach((race) => {
  for (let id = 1; id <= 20; id++) {
    const coords = getKingdomMapCoords({ id, race });
    assert.strictEqual(isWaterPoint(coords.map_x, coords.map_y), false, `kingdom id=${id} race=${race} at (${coords.map_x},${coords.map_y}) must not be in water`);
  }
});
console.log('water avoidance: no sampled kingdom spawns in an ocean/tundra hex');

// --- Different world seeds must produce different layouts (the actual
// point of Phase 1.5 — a player memorizing one world's layout must not be
// able to reuse that knowledge after a reset) ---
setWorldSeedForTests(1n);
const seedOneCoords = getKingdomMapCoords({ id: 12, race: 'dwarf' });
setWorldSeedForTests(999999n);
const seedTwoCoords = getKingdomMapCoords({ id: 12, race: 'dwarf' });
assert.ok(
  seedOneCoords.map_x !== seedTwoCoords.map_x || seedOneCoords.map_y !== seedTwoCoords.map_y,
  'different world seeds must produce different kingdom placement for the same id/race',
);
console.log('seed variation: changing the world seed changes kingdom placement');

// Restore the seed used for the remaining node-placement checks below.
setWorldSeedForTests(424242n);

const near = placeResourceNodeCoords({
  kingdomId: 5,
  nodeId: 9,
  race: 'human',
  distance: 600,
});
const far = placeResourceNodeCoords({
  kingdomId: 5,
  nodeId: 9,
  race: 'human',
  distance: 28800,
});
const home = getKingdomMapCoords({ id: 5, race: 'human' });
const nearDist = Math.hypot(near.map_x - home.map_x, near.map_y - home.map_y);
const farDist = Math.hypot(far.map_x - home.map_x, far.map_y - home.map_y);
assert.ok(farDist > nearDist, 'farther nodes should plot farther from kingdom on map');

const otherNode = placeResourceNodeCoords({
  kingdomId: 5,
  nodeId: 10,
  race: 'human',
  distance: 600,
});
assert.notStrictEqual(near.map_x, otherNode.map_x, 'different node ids should get different angles');

// --- Nodes must also avoid water spawns ---
for (let nodeId = 1; nodeId <= 20; nodeId++) {
  const node = placeResourceNodeCoords({ kingdomId: 5, nodeId, race: 'human', distance: 5000 });
  assert.strictEqual(isWaterPoint(node.map_x, node.map_y), false, `node id=${nodeId} at (${node.map_x},${node.map_y}) must not be in water`);
}
console.log('node water avoidance: no sampled resource node spawns in an ocean/tundra hex');

console.log('world-map-coords checks passed');
