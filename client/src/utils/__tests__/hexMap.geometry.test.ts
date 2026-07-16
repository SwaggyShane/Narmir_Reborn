import { describe, it, expect } from 'vitest';
import {
  getFlatIndex,
  indexToColRow,
  pixelToHex,
  hexCenter,
  hexCorners,
  hexToCube,
  isValidHex,
} from '../hexMap/HexGeometry';

describe('HexGeometry', () => {
  describe('getFlatIndex & indexToColRow round-trip', () => {
    it('should convert col/row to flat index and back', () => {
      const gridWidth = 100;
      const cases = [
        { col: 0, row: 0 },
        { col: 50, row: 50 },
        { col: 99, row: 99 },
        { col: 25, row: 75 },
      ];

      cases.forEach(({ col, row }) => {
        const idx = getFlatIndex(col, row, gridWidth);
        const { col: restoredCol, row: restoredRow } = indexToColRow(idx, gridWidth);
        expect(restoredCol).toBe(col);
        expect(restoredRow).toBe(row);
      });
    });

    it('should handle edge cases', () => {
      const idx = getFlatIndex(0, 0, 100);
      expect(idx).toBe(0);

      const idx2 = getFlatIndex(99, 99, 100);
      expect(idx2).toBe(9999);
    });
  });

  describe('pixelToHex & hexCenter round-trip', () => {
    it('should be idempotent (pixel → hex → center → same hex)', () => {
      // An arbitrary pixel need not restore to within a few px of itself —
      // hexes are ~59x51px, so any interior point can legitimately be
      // dozens of px from its assigned hex's center. The invariant that
      // actually matters (and the one the docstring above pixelToHex
      // describes) is that re-deriving the hex from that center is stable.
      const cases = [
        { x: 100, y: 100 },
        { x: 500, y: 500 },
        { x: 1000, y: 1000 },
        { x: 0, y: 0 },
      ];

      cases.forEach(({ x, y }) => {
        const hex = pixelToHex(x, y);
        const { x: cx, y: cy } = hexCenter(hex.col, hex.row);
        const hex2 = pixelToHex(cx, cy);
        expect(hex2).toEqual(hex);
      });
    });

    it('should handle origin correctly', () => {
      const hex = pixelToHex(0, 0);
      const center = hexCenter(hex.col, hex.row);
      // Origin should map to hex center at origin or nearby
      expect(center.x).toBeLessThan(100);
      expect(center.y).toBeLessThan(100);
    });
  });

  describe('hexCorners', () => {
    it('should return 6 corners for a hex', () => {
      const corners = hexCorners(100, 100);
      expect(corners).toHaveLength(6);
    });

    it('should return numbers with consistent precision', () => {
      const corners = hexCorners(100.5, 100.5);
      corners.forEach(([x, y]) => {
        expect(typeof x).toBe('number');
        expect(typeof y).toBe('number');
        // Should be rounded to 1 decimal place
        expect(x).toBe(Math.round(x * 10) / 10);
        expect(y).toBe(Math.round(y * 10) / 10);
      });
    });

    it('should form a closed polygon', () => {
      const corners = hexCorners(100, 100);
      const first = corners[0];
      const last = corners[corners.length - 1];
      // First and last should be different (not auto-closing in array)
      expect(first).not.toEqual(last);
    });
  });

  describe('hexToCube', () => {
    it('should convert hex to cube coordinates', () => {
      const hex = { col: 10, row: 10 };
      const cube = hexToCube(hex.col, hex.row);
      expect(cube).toHaveProperty('q');
      expect(cube).toHaveProperty('r');
      expect(cube).toHaveProperty('s');
      // Cube constraint: q + r + s = 0
      expect(cube.q + cube.r + cube.s).toBe(0);
    });

    it('should maintain cube constraint for various hexes', () => {
      const cases = [
        { col: 0, row: 0 },
        { col: 50, row: 50 },
        { col: 100, row: 75 },
      ];

      cases.forEach(({ col, row }) => {
        const cube = hexToCube(col, row);
        expect(cube.q + cube.r + cube.s).toBe(0);
      });
    });
  });

  describe('isValidHex', () => {
    it('should validate hexes within bounds', () => {
      const gridWidth = 100;
      const gridHeight = 100;

      expect(isValidHex(0, 0, gridWidth, gridHeight)).toBe(true);
      expect(isValidHex(50, 50, gridWidth, gridHeight)).toBe(true);
      expect(isValidHex(99, 99, gridWidth, gridHeight)).toBe(true);
    });

    it('should reject hexes outside bounds', () => {
      const gridWidth = 100;
      const gridHeight = 100;

      expect(isValidHex(-1, 50, gridWidth, gridHeight)).toBe(false);
      expect(isValidHex(50, -1, gridWidth, gridHeight)).toBe(false);
      expect(isValidHex(100, 50, gridWidth, gridHeight)).toBe(false);
      expect(isValidHex(50, 100, gridWidth, gridHeight)).toBe(false);
    });

    it('should reject negative dimensions', () => {
      expect(isValidHex(0, 0, -100, 100)).toBe(false);
      expect(isValidHex(0, 0, 100, -100)).toBe(false);
    });
  });
});
