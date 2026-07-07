import { buildHexGrid, HexGridData } from './HexGrid';
import { createVisibilityLookup, buildVisibilityArray, FogState } from './HexVisibility';
import { getHexNeighbors } from './HexSpatial';

export interface HexContext {
  grid: HexGridData;
  lookupFogState: (col: number, row: number) => FogState;
  visibilityArray: Uint8Array;
  getHexNeighbors: (col: number, row: number) => Array<{ col: number; row: number }>;
}

/**
 * For non-React consumers (e.g., pure utility code).
 * React consumers should use HexMapProvider instead.
 */
export function createHexContext(
  gameState: { seed: number; width: number; height: number },
  visibility: { seenCells: bigint; currentCells: bigint }
): HexContext {
  const grid = buildHexGrid(gameState.width, gameState.height, gameState.seed);
  const visibilityArray = buildVisibilityArray(
    gameState.width,
    gameState.height,
    visibility.seenCells,
    visibility.currentCells
  );
  const lookupFogState = createVisibilityLookup(visibilityArray, gameState.width, gameState.height);

  return {
    grid,
    lookupFogState,
    visibilityArray,
    getHexNeighbors: (col, row) => getHexNeighbors(col, row, gameState.width, gameState.height),
  };
}
