'use strict';

const assert = require('assert');
const {
  MAP_WIDTH,
  MAP_HEIGHT,
  getKingdomMapCoords,
  placeResourceNodeCoords,
} = require('../game/world-map-coords');

const dwarfA = getKingdomMapCoords({ id: 12, race: 'dwarf' });
const dwarfB = getKingdomMapCoords({ id: 12, race: 'dwarf' });
assert.strictEqual(dwarfA.map_x, dwarfB.map_x, 'kingdom coords must be stable for same id');
assert.strictEqual(dwarfA.map_y, dwarfB.map_y, 'kingdom coords must be stable for same id');
assert.ok(dwarfA.map_x >= 0 && dwarfA.map_x <= MAP_WIDTH, 'kingdom x within map');
assert.ok(dwarfA.map_y >= 0 && dwarfA.map_y <= MAP_HEIGHT, 'kingdom y within map');

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

console.log('world-map-coords checks passed');