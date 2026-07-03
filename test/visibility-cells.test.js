'use strict';

const assert = require('assert');
const {
  cellIndex,
  cellIndexToColRow,
  encodeCellSet,
  decodeCellSet,
  bitmapHasCell,
  bitmapAddCell,
} = require('../game/visibility-cells');

// --- Round-trip: cellIndex -> cellIndexToColRow recovers the original cell ---
// Sweep the actual range buildHexGrid produces (col -1..17, row -1..14),
// plus a little margin on each side.
for (let row = -2; row <= 16; row++) {
  for (let col = -2; col <= 19; col++) {
    const index = cellIndex(col, row);
    const back = cellIndexToColRow(index);
    assert.strictEqual(back.col, col, `round-trip col mismatch at (${col},${row}) -> index ${index} -> (${back.col},${back.row})`);
    assert.strictEqual(back.row, row, `round-trip row mismatch at (${col},${row}) -> index ${index} -> (${back.col},${back.row})`);
  }
}
console.log('round-trip: cellIndex -> cellIndexToColRow recovers original cell across full grid range');

// --- No collisions: every (col, row) in range maps to a distinct index ---
const seen = new Set();
for (let row = -2; row <= 16; row++) {
  for (let col = -2; col <= 19; col++) {
    const index = cellIndex(col, row);
    assert.ok(!seen.has(index), `collision at index ${index} for (${col},${row})`);
    seen.add(index);
  }
}
console.log('no collisions: every cell in range maps to a unique bit index');

// --- Bitmap encode/decode round-trip ---
const indices = [0, 5, 12, 100, 8];
const bitmap = encodeCellSet(indices);
const decoded = decodeCellSet(bitmap);
assert.deepStrictEqual(decoded.sort((a, b) => a - b), [...indices].sort((a, b) => a - b), 'decodeCellSet must recover exactly the encoded indices');
console.log('bitmap round-trip: encodeCellSet -> decodeCellSet recovers the original index set');

// Empty set encodes to 0n and decodes to an empty array.
assert.strictEqual(encodeCellSet([]), 0n, 'empty index list encodes to 0n');
assert.deepStrictEqual(decodeCellSet(0n), [], 'decoding 0n yields an empty array');
console.log('bitmap edge case: empty set encodes to 0n and decodes to []');

// --- bitmapHasCell / bitmapAddCell ---
let map = 0n;
assert.strictEqual(bitmapHasCell(map, 3, 4), false, 'a fresh empty bitmap has no cells');
map = bitmapAddCell(map, 3, 4);
assert.strictEqual(bitmapHasCell(map, 3, 4), true, 'bitmapAddCell must set the cell so bitmapHasCell finds it');
assert.strictEqual(bitmapHasCell(map, 3, 5), false, 'adding one cell must not mark a different cell as seen');

// Adding the same cell twice is idempotent (bitwise OR).
const mapAgain = bitmapAddCell(map, 3, 4);
assert.strictEqual(mapAgain, map, 'adding an already-set cell must not change the bitmap');
console.log('bitmapHasCell/bitmapAddCell: set/check work correctly and adding is idempotent');

// --- BigInt round-trip through decimal string (the actual DB storage format) ---
const original = encodeCellSet([1, 2, 3, 500]);
const asString = original.toString();
const recovered = BigInt(asString);
assert.strictEqual(recovered, original, 'BigInt -> decimal string -> BigInt must round-trip exactly (the DB storage path)');
console.log('storage format: BigInt <-> decimal string round-trips exactly');

console.log('visibility-cells checks passed');
