// Canonical hex coordinate and visibility indexing logic.
// This is the source of truth for stride/offset used by visibility bitmaps.
//
// Server (CommonJS) canonical location.
// Client has a mirrored copy in client/src/utils/hexMap/ (see ARCHITECTURE.md for why).

const CELL_INDEX_OFFSET = 8;
const CELL_INDEX_STRIDE = 48; // must exceed the largest possible (col + OFFSET)

function cellIndex(col, row) {
  const colShifted = col + CELL_INDEX_OFFSET;
  const rowShifted = row + CELL_INDEX_OFFSET;
  if (colShifted < 0 || colShifted >= CELL_INDEX_STRIDE || rowShifted < 0) {
    throw new Error(`Invalid hex cell coordinates: (${col}, ${row})`);
  }
  return rowShifted * CELL_INDEX_STRIDE + colShifted;
}

function cellIndexToColRow(index) {
  const row = Math.floor(index / CELL_INDEX_STRIDE) - CELL_INDEX_OFFSET;
  const col = (index % CELL_INDEX_STRIDE) - CELL_INDEX_OFFSET;
  return { col, row };
}

function isValidCell(col, row) {
  const colShifted = col + CELL_INDEX_OFFSET;
  const rowShifted = row + CELL_INDEX_OFFSET;
  return colShifted >= 0 && colShifted < CELL_INDEX_STRIDE && rowShifted >= 0;
}

module.exports = {
  CELL_INDEX_OFFSET,
  CELL_INDEX_STRIDE,
  cellIndex,
  cellIndexToColRow,
  isValidCell
};
