// Client mirror of game/lib/hex.js
// See ARCHITECTURE.md for rationale (build system separation).
//
// Keep this in sync with the server canonical version.

export const CELL_INDEX_OFFSET = 8;
export const CELL_INDEX_STRIDE = 48;

export function cellIndex(col, row) {
  const colShifted = col + CELL_INDEX_OFFSET;
  const rowShifted = row + CELL_INDEX_OFFSET;
  if (colShifted < 0 || colShifted >= CELL_INDEX_STRIDE || rowShifted < 0) {
    return -1;
  }
  return rowShifted * CELL_INDEX_STRIDE + colShifted;
}

export function cellIndexToColRow(index) {
  const row = Math.floor(index / CELL_INDEX_STRIDE) - CELL_INDEX_OFFSET;
  const col = (index % CELL_INDEX_STRIDE) - CELL_INDEX_OFFSET;
  return { col, row };
}
