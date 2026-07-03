/**
 * Fog of War Phase 2: hex-cell <-> bit-index mapping and BigInt bitmap
 * encode/decode. Kept separate from game/visibility.js (the DB-facing
 * persistence layer) so the pure bit math can be unit tested without a
 * database connection.
 *
 * Storage format (locked): a BigInt where bit N corresponds to one hex
 * cell. At HEX_SIZE=34 over the 900x650 map, buildHexGrid's loop covers
 * roughly col -1..17, row -1..14 (~200 cells) — the offset/stride below are
 * generous rather than tightly packed, since BigInt bit width isn't a
 * meaningful cost at this scale.
 */

'use strict';

const CELL_INDEX_OFFSET = 8; // shifts negative col/row (buildHexGrid starts both at -1) into positive range
const CELL_INDEX_STRIDE = 32; // must exceed the largest possible (col + OFFSET) so rows never collide

/**
 * Map a hex cell (col, row) to a unique non-negative bit index.
 */
function cellIndex(col, row) {
  return (row + CELL_INDEX_OFFSET) * CELL_INDEX_STRIDE + (col + CELL_INDEX_OFFSET);
}

/**
 * Inverse of cellIndex: recover (col, row) from a bit index.
 */
function cellIndexToColRow(index) {
  const row = Math.floor(index / CELL_INDEX_STRIDE) - CELL_INDEX_OFFSET;
  const col = (index % CELL_INDEX_STRIDE) - CELL_INDEX_OFFSET;
  return { col, row };
}

/**
 * Build a BigInt bitmap with the given cell indices set.
 */
function encodeCellSet(indices) {
  let bitmap = 0n;
  for (const index of indices) {
    bitmap |= (1n << BigInt(index));
  }
  return bitmap;
}

/**
 * Return the list of set bit indices in a BigInt bitmap.
 */
function decodeCellSet(bitmap) {
  const indices = [];
  let remaining = BigInt(bitmap);
  let index = 0;
  while (remaining > 0n) {
    if (remaining & 1n) indices.push(index);
    remaining >>= 1n;
    index++;
  }
  return indices;
}

/**
 * True if the given hex cell's bit is set in the bitmap.
 */
function bitmapHasCell(bitmap, col, row) {
  const index = cellIndex(col, row);
  return (BigInt(bitmap) & (1n << BigInt(index))) !== 0n;
}

/**
 * Return a new bitmap with the given hex cell's bit set (does not mutate
 * the input — BigInts are immutable anyway, but this makes the intent
 * explicit at call sites).
 */
function bitmapAddCell(bitmap, col, row) {
  const index = cellIndex(col, row);
  return BigInt(bitmap) | (1n << BigInt(index));
}

module.exports = {
  CELL_INDEX_OFFSET,
  CELL_INDEX_STRIDE,
  cellIndex,
  cellIndexToColRow,
  encodeCellSet,
  decodeCellSet,
  bitmapHasCell,
  bitmapAddCell,
};
