import { hexCorners, pixelToHex } from './HexGeometry';
import { HEX_SIZE, HEX_W, HEX_VERT } from './HexMapConfig';

export interface Viewport {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface VisibleHexBounds {
  startCol: number;
  endCol: number;
  startRow: number;
  endRow: number;
  count: number; // For debug overlay
}

/**
 * Calculate which hexes are visible in the current viewport.
 * Critical for performance: prevents rendering thousands of offscreen hexes.
 */
export function getVisibleHexBounds(
  viewport: Viewport,
  gridWidth: number,
  gridHeight: number
): VisibleHexBounds {
  const paddedMinX = viewport.minX - HEX_W;
  const paddedMaxX = viewport.maxX + HEX_W;
  const paddedMinY = viewport.minY - HEX_SIZE;
  const paddedMaxY = viewport.maxY + HEX_SIZE;

  const topLeft = pixelToHex(paddedMinX, paddedMinY);
  const bottomRight = pixelToHex(paddedMaxX, paddedMaxY);

  const startCol = Math.max(0, Math.min(topLeft.col, bottomRight.col));
  const endCol = Math.min(gridWidth - 1, Math.max(topLeft.col, bottomRight.col));

  const startRow = Math.max(0, Math.min(topLeft.row, bottomRight.row));
  const endRow = Math.min(gridHeight - 1, Math.max(topLeft.row, bottomRight.row));

  const count = (endCol - startCol + 1) * (endRow - startRow + 1);

  return { startCol, endCol, startRow, endRow, count };
}

/**
 * Generate SVG path data for a single hex.
 */
export function generateHexPath(cx: number, cy: number, size: number = HEX_SIZE): string {
  const corners = hexCorners(cx, cy, size);
  if (corners.length === 0) return '';
  const pointsStr = corners.map(([x, y]) => `${x},${y}`).join(' L ');
  return `M ${pointsStr} Z`;
}

/**
 * Generate SVG polygon points string for a hex.
 */
export function generateHexPolygonPoints(cx: number, cy: number): string {
  const corners = hexCorners(cx, cy, HEX_SIZE);
  return corners.map(([x, y]) => `${x},${y}`).join(' ');
}
