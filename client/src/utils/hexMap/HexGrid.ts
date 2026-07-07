// Import the existing terrain generation utility
import { buildHexGrid as buildHexGridCore } from '../terrainUtils.js';

export interface HexCell {
  col: number;
  row: number;
  x: number;
  y: number;
  terrain: string;
}

export interface HexGridData {
  width: number;
  height: number;
  seed: number;
  cells: HexCell[];
}

/**
 * Build hex grid from world parameters.
 * Grid is immutable: only rebuilds if seed/dimensions change.
 * Caching is handled at React context level (HexMapProvider).
 */
export function buildHexGrid(
  width: number,
  height: number,
  seed: number
): HexGridData {
  const grid = buildHexGridCore(width, height, seed);
  return Object.freeze({
    width,
    height,
    seed,
    cells: Object.freeze([...grid.cells]),
  }) as HexGridData;
}
