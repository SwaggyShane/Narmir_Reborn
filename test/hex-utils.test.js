'use strict';

const assert = require('assert');
const {
  HEX_SIZE,
  HEX_W,
  HEX_VERT,
  hexCenter,
  hexCorners,
  hexNeighborKeys,
  pixelToHex,
  isPixelInHex,
  hexUnitDistance,
} = require('../game/hex-utils');

// --- Round-trip: hexCenter -> pixelToHex should recover the same cell ---
// Sweep a grid range covering both row parities and negative coordinates.
for (let row = -3; row <= 12; row++) {
  for (let col = -3; col <= 12; col++) {
    const { x, y } = hexCenter(col, row);
    const back = pixelToHex(x, y);
    assert.strictEqual(back.col, col, `round-trip col mismatch at (${col},${row}) -> (${x},${y}) -> (${back.col},${back.row})`);
    assert.strictEqual(back.row, row, `round-trip row mismatch at (${col},${row}) -> (${x},${y}) -> (${back.col},${back.row})`);
  }
}
console.log('round-trip: hexCenter -> pixelToHex recovers original cell across grid sweep');

// --- Boundary cases: points exactly on hex edges must resolve to exactly
// one neighboring cell, and must not throw or produce NaN ---
const originCenter = hexCenter(5, 5);
const neighborCenter = hexCenter(6, 5); // E neighbor, same row parity
const midpoint = {
  x: (originCenter.x + neighborCenter.x) / 2,
  y: (originCenter.y + neighborCenter.y) / 2,
};
const midpointHex = pixelToHex(midpoint.x, midpoint.y);
assert.ok(!Number.isNaN(midpointHex.col) && !Number.isNaN(midpointHex.row), 'boundary point must not produce NaN');
assert.ok(
  (midpointHex.col === 5 && midpointHex.row === 5) || (midpointHex.col === 6 && midpointHex.row === 5),
  `boundary point between two hex centers must resolve to one of them, got (${midpointHex.col},${midpointHex.row})`,
);
console.log('boundary: midpoint between two hex centers resolves cleanly to one neighbor');

// --- isPixelInHex agrees with pixelToHex ---
const { x: cx, y: cy } = hexCenter(4, 7);
assert.strictEqual(isPixelInHex(cx, cy, 4, 7), true, 'a hex center must be inside its own cell');
assert.strictEqual(isPixelInHex(cx, cy, 5, 7), false, 'a hex center must not be inside a different cell');
console.log('isPixelInHex: agrees with pixelToHex for center and non-center cells');

// --- Neighbor math: exactly 6 neighbors, all distinct, symmetric adjacency ---
[[0, 0], [1, 0], [0, 1], [-2, 3], [3, -2]].forEach(([col, row]) => {
  const neighbors = hexNeighborKeys(col, row);
  assert.strictEqual(neighbors.length, 6, `hex (${col},${row}) must have exactly 6 neighbor keys`);
  assert.strictEqual(new Set(neighbors).size, 6, `hex (${col},${row}) neighbor keys must be distinct`);
  assert.ok(!neighbors.includes(`${col},${row}`), 'a hex must not list itself as its own neighbor');
});
console.log('neighbors: every cell has exactly 6 distinct neighbors, none self-referential');

// Symmetric adjacency: if B is a neighbor of A, A must be a neighbor of B.
const a = { col: 2, row: 4 };
const aNeighbors = hexNeighborKeys(a.col, a.row);
aNeighbors.forEach((key) => {
  const [bCol, bRow] = key.split(',').map(Number);
  const bNeighbors = hexNeighborKeys(bCol, bRow);
  assert.ok(bNeighbors.includes(`${a.col},${a.row}`), `adjacency must be symmetric: ${bCol},${bRow} must list ${a.col},${a.row} as a neighbor`);
});
console.log('neighbors: adjacency is symmetric in both row parities');

// --- Distance metric: commutative, zero for same point, scales with HEX_SIZE ---
assert.strictEqual(hexUnitDistance(10, 10, 10, 10), 0, 'distance from a point to itself is 0');
const d1 = hexUnitDistance(0, 0, 100, 0);
const d2 = hexUnitDistance(100, 0, 0, 0);
assert.strictEqual(d1, d2, 'distance must be commutative');
assert.strictEqual(hexUnitDistance(0, 0, HEX_SIZE, 0), 1, 'one HEX_SIZE of pixel distance equals exactly 1 hex-unit');
console.log('distance: hexUnitDistance is commutative, zero-safe, and correctly scaled by HEX_SIZE');

// --- Frontier detection (Phase 3 building block): a "frontier" cell is any
// seen cell with at least one unseen neighbor ---
function isFrontier(col, row, seenSet) {
  if (!seenSet.has(`${col},${row}`)) return false;
  return hexNeighborKeys(col, row).some((key) => !seenSet.has(key));
}
const seen = new Set(['0,0', '1,0', '0,1']);
assert.strictEqual(isFrontier(0, 0, seen), true, 'a seen cell with unseen neighbors is a frontier cell');
const fullySurrounded = new Set(['5,5', ...hexNeighborKeys(5, 5)]);
assert.strictEqual(isFrontier(5, 5, fullySurrounded), false, 'a seen cell with all neighbors also seen is not a frontier cell');
assert.strictEqual(isFrontier(9, 9, seen), false, 'an unseen cell is never a frontier cell');
console.log('frontier: correctly identifies seen cells adjacent to unseen territory');

// --- Constants sanity: HEX_W/HEX_VERT derive from HEX_SIZE as documented ---
assert.strictEqual(HEX_W, Math.sqrt(3) * HEX_SIZE, 'HEX_W must equal sqrt(3) * HEX_SIZE');
assert.strictEqual(HEX_VERT, HEX_SIZE * 1.5, 'HEX_VERT must equal HEX_SIZE * 1.5');
assert.strictEqual(hexCorners(0, 0, HEX_SIZE).length, 6, 'hexCorners must return exactly 6 points');

console.log('hex-utils checks passed');
