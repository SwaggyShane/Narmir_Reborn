'use strict';

const assert = require('assert');
const serverHex = require('../game/lib/hex');

// Mirror of the client constants (kept in sync via this test)
const clientConstants = {
  CELL_INDEX_OFFSET: 8,
  CELL_INDEX_STRIDE: 48,
  cellIndex(col, row) {
    const colShifted = col + 8;
    const rowShifted = row + 8;
    if (colShifted < 0 || colShifted >= 48 || rowShifted < 0) return -1;
    return rowShifted * 48 + colShifted;
  }
};

{
  assert.strictEqual(serverHex.CELL_INDEX_OFFSET, clientConstants.CELL_INDEX_OFFSET);
  assert.strictEqual(serverHex.CELL_INDEX_STRIDE, clientConstants.CELL_INDEX_STRIDE);
  console.log('✓ Hex constants match between server and client mirror');
}

{
  const testCases = [
    [0, 0], [-1, -1], [10, 5], [33, 27], [-8, -8]
  ];
  for (const [col, row] of testCases) {
    const serverIdx = serverHex.cellIndex(col, row);
    const clientIdx = clientConstants.cellIndex(col, row);
    assert.strictEqual(serverIdx, clientIdx, `Mismatch for (${col},${row})`);
  }
  console.log('✓ cellIndex produces identical results on both sides');
}
