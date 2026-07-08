import { describe, it, expect } from 'vitest';
import { CELL_INDEX_OFFSET, CELL_INDEX_STRIDE, cellIndex, cellIndexToColRow } from '../hex-constants.js';

describe('hex-constants', () => {
  it('has correct constants', () => {
    expect(CELL_INDEX_OFFSET).toBe(8);
    expect(CELL_INDEX_STRIDE).toBe(48);
  });

  it('cellIndex and inverse roundtrip', () => {
    const cases = [[0,0], [-1,-1], [5,3], [33,27]];
    for (const [c, r] of cases) {
      const idx = cellIndex(c, r);
      const { col, row } = cellIndexToColRow(idx);
      expect(col).toBe(c);
      expect(row).toBe(r);
    }
  });

  it('invalid returns -1 for client version', () => {
    expect(cellIndex(100, 100)).toBe(-1);
  });
});
