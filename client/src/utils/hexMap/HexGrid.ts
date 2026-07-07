// Import the existing terrain generation utility
// We'll call buildHexGrid from the existing terrainUtils
declare function buildHexGridCore(
  width: number,
  height: number,
  seed: number
): { width: number; height: number; seed: number; cells: HexCell[] };

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
  // In actual implementation, this will call buildHexGridCore from terrainUtils
  // For now, we'll use a placeholder that can be replaced
  const grid = {
    width,
    height,
    seed,
    cells: [],
  };

  return Object.freeze({
    ...grid,
    cells: Object.freeze([...grid.cells]),
  }) as HexGridData;
}
