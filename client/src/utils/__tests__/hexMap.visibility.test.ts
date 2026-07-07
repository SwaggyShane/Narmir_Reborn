import { describe, it, expect } from 'vitest';
import {
  FogState,
  buildVisibilityArray,
  createVisibilityLookup,
} from '../hexMap/HexVisibility';

describe('HexVisibility', () => {
  describe('buildVisibilityArray', () => {
    it('should create a Uint8Array with correct dimensions', () => {
      const gridWidth = 100;
      const gridHeight = 100;
      const visArray = buildVisibilityArray(gridWidth, gridHeight, 0n, 0n);

      expect(visArray instanceof Uint8Array).toBe(true);
      expect(visArray.length).toBe(gridWidth * gridHeight);
    });

    it('should mark all cells as unseen when no bits set', () => {
      const visArray = buildVisibilityArray(10, 10, 0n, 0n);

      for (let i = 0; i < visArray.length; i++) {
        expect(visArray[i]).toBe(FogState.Unseen);
      }
    });

    it('should mark current cells correctly', () => {
      const gridWidth = 10;
      const gridHeight = 10;
      // Set bit 0 and bit 5 as current
      const currentCells = (1n << 0n) | (1n << 5n);
      const visArray = buildVisibilityArray(gridWidth, gridHeight, 0n, currentCells);

      expect(visArray[0]).toBe(FogState.Current);
      expect(visArray[5]).toBe(FogState.Current);
      expect(visArray[1]).toBe(FogState.Unseen);
    });

    it('should mark seen cells correctly', () => {
      const gridWidth = 10;
      const gridHeight = 10;
      const seenCells = (1n << 0n) | (1n << 5n);
      const visArray = buildVisibilityArray(gridWidth, gridHeight, seenCells, 0n);

      expect(visArray[0]).toBe(FogState.Seen);
      expect(visArray[5]).toBe(FogState.Seen);
      expect(visArray[1]).toBe(FogState.Unseen);
    });

    it('should prioritize current over seen', () => {
      const gridWidth = 10;
      const gridHeight = 10;
      // Bit 0: both seen and current (current should win)
      const seenCells = 1n << 0n;
      const currentCells = 1n << 0n;
      const visArray = buildVisibilityArray(gridWidth, gridHeight, seenCells, currentCells);

      expect(visArray[0]).toBe(FogState.Current);
    });

    it('should handle large grids', () => {
      const gridWidth = 1000;
      const gridHeight = 1380;
      const visArray = buildVisibilityArray(gridWidth, gridHeight, 0n, 0n);

      expect(visArray.length).toBe(gridWidth * gridHeight);
      expect(visArray instanceof Uint8Array).toBe(true);
    });
  });

  describe('createVisibilityLookup', () => {
    it('should return a function', () => {
      const visArray = buildVisibilityArray(10, 10, 0n, 0n);
      const lookup = createVisibilityLookup(visArray, 10, 10);

      expect(typeof lookup).toBe('function');
    });

    it('should look up fog state by coordinates', () => {
      const gridWidth = 10;
      const gridHeight = 10;
      const currentCells = (1n << 0n) | (1n << 5n);
      const visArray = buildVisibilityArray(gridWidth, gridHeight, 0n, currentCells);
      const lookup = createVisibilityLookup(visArray, gridWidth, gridHeight);

      expect(lookup(0, 0)).toBe(FogState.Current);
      expect(lookup(0, 5)).toBe(FogState.Unseen); // col 0, row 5 = index 50, not set
      expect(lookup(5, 0)).toBe(FogState.Current); // col 5, row 0 = index 5
    });

    it('should return Unseen for out-of-bounds coordinates', () => {
      const visArray = buildVisibilityArray(10, 10, 0n, 0n);
      const lookup = createVisibilityLookup(visArray, 10, 10);

      expect(lookup(-1, 0)).toBe(FogState.Unseen);
      expect(lookup(10, 0)).toBe(FogState.Unseen);
      expect(lookup(0, -1)).toBe(FogState.Unseen);
      expect(lookup(0, 10)).toBe(FogState.Unseen);
    });

    it('should handle all three fog states', () => {
      const gridWidth = 10;
      const gridHeight = 10;
      const seenCells = 1n << 1n;
      const currentCells = 1n << 0n;
      const visArray = buildVisibilityArray(gridWidth, gridHeight, seenCells, currentCells);
      const lookup = createVisibilityLookup(visArray, gridWidth, gridHeight);

      expect(lookup(0, 0)).toBe(FogState.Current);
      expect(lookup(1, 0)).toBe(FogState.Seen);
      expect(lookup(2, 0)).toBe(FogState.Unseen);
    });

    it('should perform O(1) lookups efficiently', () => {
      const gridWidth = 1000;
      const gridHeight = 1000;
      const visArray = buildVisibilityArray(gridWidth, gridHeight, 0n, 0n);
      const lookup = createVisibilityLookup(visArray, gridWidth, gridHeight);

      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        lookup(Math.random() * gridWidth | 0, Math.random() * gridHeight | 0);
      }
      const end = performance.now();

      // Should be very fast for 10k lookups (< 10ms expected)
      expect(end - start).toBeLessThan(100);
    });
  });

  describe('FogState enum', () => {
    it('should have correct values', () => {
      expect(FogState.Unseen).toBe(0);
      expect(FogState.Seen).toBe(1);
      expect(FogState.Current).toBe(2);
    });
  });
});
