/**
 * Migrate visibility bitmaps from old CELL_INDEX_STRIDE=32 to new CELL_INDEX_STRIDE=48.
 *
 * Problem: Map was enlarged and stride changed from 32→48. Old visibility data was stored
 * with stride-32 cell indices, but new code reads with stride-48, causing bits to map to
 * wrong hex coordinates.
 *
 * Solution: Decode old bitmaps with stride-32, re-encode with stride-48.
 */

'use strict';

const OLD_STRIDE = 32;
const NEW_STRIDE = 48;
const OFFSET = 8;

/**
 * Convert a cell index from old stride to new stride.
 * Both use the same OFFSET, just different STRIDE, so the mapping is:
 *   old_index = row_old * OLD_STRIDE + col
 *   new_index = row_new * NEW_STRIDE + col
 * Since row is the same (derived from index / STRIDE), we need to recalculate.
 */
function convertCellIndex(oldIndex) {
  const row = Math.floor(oldIndex / OLD_STRIDE) - OFFSET;
  const col = (oldIndex % OLD_STRIDE) - OFFSET;
  // Verify the cell is valid
  if (col < -OFFSET || col >= (NEW_STRIDE - OFFSET) || row < -OFFSET) {
    return null; // Out of bounds in new stride
  }
  return (row + OFFSET) * NEW_STRIDE + (col + OFFSET);
}

/**
 * Decode a BigInt bitmap with given stride to array of cell indices.
 */
function decodeBitmapWithStride(bitmap, stride) {
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
 * Encode an array of cell indices to BigInt bitmap.
 */
function encodeCellSet(indices) {
  let bitmap = 0n;
  for (const index of indices) {
    if (index !== null) {
      bitmap |= (1n << BigInt(index));
    }
  }
  return bitmap;
}

/**
 * Migrate a single visibility bitmap from stride-32 to stride-48.
 */
function migrateVisibilityBitmap(oldBitmapStr) {
  if (!oldBitmapStr || oldBitmapStr === '0') {
    return '0'; // Already empty, nothing to migrate
  }

  const oldBitmap = BigInt(oldBitmapStr);
  const oldIndices = decodeBitmapWithStride(oldBitmap, OLD_STRIDE);
  const newIndices = oldIndices.map(convertCellIndex).filter(i => i !== null);
  const newBitmap = encodeCellSet(newIndices);

  return newBitmap.toString();
}

module.exports = {
  OLD_STRIDE,
  NEW_STRIDE,
  OFFSET,
  convertCellIndex,
  decodeBitmapWithStride,
  encodeCellSet,
  migrateVisibilityBitmap,
};
