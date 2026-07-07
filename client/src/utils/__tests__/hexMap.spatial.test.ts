import { describe, it, expect } from 'vitest';
import { getHexNeighbors } from '../hexMap/HexSpatial';

describe('HexSpatial', () => {
  describe('getHexNeighbors', () => {
    it('should return 6 neighbors for interior hex', () => {
      const neighbors = getHexNeighbors(50, 50);
      expect(neighbors).toHaveLength(6);
    });

    it('should return neighbors with correct offsets (even row)', () => {
      // Even row (parity 0)
      const neighbors = getHexNeighbors(10, 10).sort((a, b) => {
        if (a.col !== b.col) return a.col - b.col;
        return a.row - b.row;
      });

      // East/West (same row)
      expect(neighbors.some((n) => n.col === 11 && n.row === 10)).toBe(true);
      expect(neighbors.some((n) => n.col === 9 && n.row === 10)).toBe(true);

      // Northwest/Northeast (row - 1)
      expect(neighbors.some((n) => n.col === 9 && n.row === 9)).toBe(true);
      expect(neighbors.some((n) => n.col === 10 && n.row === 9)).toBe(true);

      // Southwest/Southeast (row + 1)
      expect(neighbors.some((n) => n.col === 9 && n.row === 11)).toBe(true);
      expect(neighbors.some((n) => n.col === 10 && n.row === 11)).toBe(true);
    });

    it('should return neighbors with correct offsets (odd row)', () => {
      // Odd row (parity 1)
      const neighbors = getHexNeighbors(10, 11).sort((a, b) => {
        if (a.col !== b.col) return a.col - b.col;
        return a.row - b.row;
      });

      // East/West (same row)
      expect(neighbors.some((n) => n.col === 11 && n.row === 11)).toBe(true);
      expect(neighbors.some((n) => n.col === 9 && n.row === 11)).toBe(true);

      // Northwest/Northeast (row - 1)
      expect(neighbors.some((n) => n.col === 10 && n.row === 10)).toBe(true);
      expect(neighbors.some((n) => n.col === 11 && n.row === 10)).toBe(true);

      // Southwest/Southeast (row + 1)
      expect(neighbors.some((n) => n.col === 10 && n.row === 12)).toBe(true);
      expect(neighbors.some((n) => n.col === 11 && n.row === 12)).toBe(true);
    });

    it('should filter to valid hexes when bounds provided', () => {
      const gridWidth = 20;
      const gridHeight = 20;

      // Corner hex - should only return valid neighbors
      const neighbors = getHexNeighbors(0, 0, gridWidth, gridHeight);
      expect(neighbors.length).toBeLessThan(6);
      expect(neighbors.every((n) => n.col >= 0 && n.col < gridWidth)).toBe(true);
      expect(neighbors.every((n) => n.row >= 0 && n.row < gridHeight)).toBe(true);
    });

    it('should return neighbors without bounds check when not provided', () => {
      const neighbors = getHexNeighbors(0, 0);
      expect(neighbors).toHaveLength(6);
      expect(neighbors.some((n) => n.col < 0 || n.row < 0)).toBe(true);
    });

    it('should handle edge cases correctly', () => {
      const gridWidth = 100;
      const gridHeight = 100;

      // Top-left corner
      const topLeft = getHexNeighbors(0, 0, gridWidth, gridHeight);
      expect(topLeft.length).toBeGreaterThan(0);
      expect(topLeft.length).toBeLessThan(6);

      // Bottom-right corner
      const bottomRight = getHexNeighbors(99, 99, gridWidth, gridHeight);
      expect(bottomRight.length).toBeGreaterThan(0);
      expect(bottomRight.length).toBeLessThan(6);

      // Edge hexes
      const topEdge = getHexNeighbors(50, 0, gridWidth, gridHeight);
      expect(topEdge.length).toBeGreaterThan(2);
      expect(topEdge.length).toBeLessThan(6);
    });

    it('should not return duplicate neighbors', () => {
      const neighbors = getHexNeighbors(50, 50, 200, 200);
      const uniqueNeighbors = new Set(neighbors.map((n) => `${n.col},${n.row}`));
      expect(uniqueNeighbors.size).toBe(neighbors.length);
    });

    it('should be reciprocal (if A is neighbor of B, B is neighbor of A)', () => {
      const col = 50;
      const row = 50;
      const gridWidth = 200;
      const gridHeight = 200;

      const neighborsOfA = getHexNeighbors(col, row, gridWidth, gridHeight);

      neighborsOfA.forEach((neighbor) => {
        const neighborsOfB = getHexNeighbors(neighbor.col, neighbor.row, gridWidth, gridHeight);
        expect(neighborsOfB.some((n) => n.col === col && n.row === row)).toBe(true);
      });
    });
  });
});
