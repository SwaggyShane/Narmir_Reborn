/**
 * Terrain utilities for hex selection / FoW UI.
 *
 * Terrain generation is canonical in worldMapBuilder.js (same path as WebGL
 * worldmap and server-side world-hex-grid). This module re-exports that grid
 * builder so HexSelectionModal / WorldmapWebGL cannot drift to a second ocean
 * band / race-home map.
 */

import { hexCenter, hexCorners, HEX_SIZE, HEX_W, HEX_VERT } from './hexMap/HexGeometry.ts';
import {
  buildHexGrid as buildCanonicalHexGrid,
  RACE_HOMES,
  RACE_TO_TERRAIN,
} from './worldMapBuilder.js';

// Re-export geometry for backward compatibility
export { hexCenter, hexCorners, HEX_SIZE, HEX_W, HEX_VERT };
export { RACE_HOMES, RACE_TO_TERRAIN };

export const TERRAIN_COLORS = {
  plains: '#556b2f',
  forest: '#2d4a2d',
  mountains: '#5c4033',
  hills: '#6b5b3f',
  swamp: '#3a3f2a',
  desert: '#8b7355',
  coast: '#3a5f7a',
  tundra: '#7a8a94',
  volcanic: '#7a2e1a',
  lake: '#2a5f8a',
  ocean: '#0d3a5c',
};

export function seedToInt32(worldSeed) {
  if (worldSeed === null || worldSeed === undefined) return 0;
  try {
    return Number(BigInt(worldSeed) % 2147483647n);
  } catch {
    return 0;
  }
}

/**
 * Canonical hex grid — delegates to worldMapBuilder.buildHexGrid.
 * @param {number} W
 * @param {number} H
 * @param {number|string|bigint} [worldSeed=0]
 */
export function buildHexGrid(W, H, worldSeed = 0) {
  const seed =
    typeof worldSeed === 'number' && Number.isFinite(worldSeed)
      ? worldSeed
      : seedToInt32(worldSeed);
  return buildCanonicalHexGrid(W, H, seed);
}
