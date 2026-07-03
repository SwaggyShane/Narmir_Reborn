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
 *
 * Throws if the shifted column falls outside [0, CELL_INDEX_STRIDE) — that's
 * the only way two different cells could collide on the same index (a
 * col overflow bleeding into the next row's band), so it's the one bound
 * that must be enforced. Guards against a future map expansion or a
 * coordinate-generation bug silently corrupting the bitmap instead of
 * failing loudly.
 */
function cellIndex(col, row) {
  const colShifted = col + CELL_INDEX_OFFSET;
  const rowShifted = row + CELL_INDEX_OFFSET;
  if (colShifted < 0 || colShifted >= CELL_INDEX_STRIDE || rowShifted < 0) {
    throw new Error(`Invalid hex cell coordinates: (${col}, ${row})`);
  }
  return rowShifted * CELL_INDEX_STRIDE + colShifted;
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

/**
 * Safe versions for use in user-facing paths (e.g. scouting).
 * Return safe fallbacks instead of throwing on out-of-bounds hex coords.
 */
function isValidCell(col, row) {
  const colShifted = col + CELL_INDEX_OFFSET;
  const rowShifted = row + CELL_INDEX_OFFSET;
  return colShifted >= 0 && colShifted < CELL_INDEX_STRIDE && rowShifted >= 0;
}

function safeBitmapHasCell(bitmap, col, row) {
  if (!isValidCell(col, row)) return false;
  return bitmapHasCell(bitmap, col, row);
}

function safeBitmapAddCell(bitmap, col, row) {
  if (!isValidCell(col, row)) return BigInt(bitmap);
  return bitmapAddCell(bitmap, col, row);
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
  isValidCell,
  safeBitmapHasCell,
  safeBitmapAddCell,
};
