import { isValidHex } from './HexGeometry';

/**
 * Get immediate neighbors of a hex (odd-r offset layout).
 * Corrected implementation per Red Blob Games.
 */
export function getHexNeighbors(
  col: number,
  row: number,
  gridWidth?: number,
  gridHeight?: number
): Array<{ col: number; row: number }> {
  const parity = row & 1;
  const candidates = [
    { col: col + 1, row },           // east
    { col: col - 1, row },           // west
    { col: col + (parity ? 0 : -1), row: row - 1 }, // north-east / north-west
    { col: col + (parity ? 1 : 0), row: row - 1 },
    { col: col + (parity ? 0 : -1), row: row + 1 }, // south-east / south-west
    { col: col + (parity ? 1 : 0), row: row + 1 },
  ];

  // Filter to valid hexes if bounds provided
  if (gridWidth !== undefined && gridHeight !== undefined) {
    return candidates.filter((n) => isValidHex(n.col, n.row, gridWidth, gridHeight));
  }

  return candidates;
}

// Pathfinding, distance, etc. are separate concerns for future phases.
