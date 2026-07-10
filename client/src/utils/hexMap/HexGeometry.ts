import { HEX_SIZE, HEX_W, HEX_VERT } from './HexMapConfig';

// Re-export for convenience
export { HEX_SIZE, HEX_W, HEX_VERT } from './HexMapConfig';

/**
 * Convert flat array index to hex coordinates.
 */
export function getFlatIndex(col: number, row: number, gridWidth: number): number {
  return row * gridWidth + col;
}

/**
 * Inverse: convert flat array index to hex coordinates.
 */
export function indexToColRow(
  index: number,
  gridWidth: number
): { col: number; row: number } {
  const row = Math.floor(index / gridWidth);
  const col = index % gridWidth;
  return { col, row };
}

/**
 * Convert pixel coordinates to hex coordinates (odd-r offset layout).
 * Uses cubic coordinate approach per Red Blob Games reference.
 * CRITICAL: Must round-trip correctly (pixelToHex → hexCenter → pixelToHex).
 */
export function pixelToHex(x: number, y: number): { col: number; row: number } {
  // Convert pixel to cube coordinates via axial
  const r = y / HEX_VERT;
  const q = x / HEX_W - r / 2;

  const cubeX = q;
  const cubeZ = r;
  const cubeY = -cubeX - cubeZ;

  // Round to nearest cube
  let rx = Math.round(cubeX);
  let ry = Math.round(cubeY);
  let rz = Math.round(cubeZ);

  // Fix rounding errors (cube constraint: x + y + z = 0)
  const dx = Math.abs(rx - cubeX);
  const dy = Math.abs(ry - cubeY);
  const dz = Math.abs(rz - cubeZ);

  if (dx > dy && dx > dz) {
    rx = -ry - rz;
  } else if (dy > dz) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  // Convert cube back to offset (odd-r)
  const col = rx + Math.floor((rz - (rz & 1)) / 2);
  const row = rz;
  return { col, row };
}

/**
 * Get center pixel coordinates of a hex (odd-r offset layout).
 */
export function hexCenter(col: number, row: number): { x: number; y: number } {
  const x = col * HEX_W + (row % 2 !== 0 ? HEX_W / 2 : 0);
  const y = row * HEX_VERT;
  return { x, y };
}

/**
 * Get the 6 corner points for a hex polygon.
 */
export function hexCorners(
  cx: number,
  cy: number,
  size: number = HEX_SIZE
): Array<[number, number]> {
  const corners: Array<[number, number]> = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    corners.push([
      Math.round((cx + size * Math.cos(angle)) * 4) / 4,
      Math.round((cy + size * Math.sin(angle)) * 4) / 4,
    ]);
  }
  return corners;
}

/**
 * Convert hex to cube coordinates (for robustness and debugging).
 */
export function hexToCube(col: number, row: number) {
  const q = col;
  const r = row - Math.floor((col + (row % 2 !== 0 ? 1 : 0)) / 2);
  const s = -q - r;
  return { q, r, s };
}

/**
 * Validate hex coordinates against grid bounds.
 */
export function isValidHex(
  col: number,
  row: number,
  gridWidth: number,
  gridHeight: number
): boolean {
  return col >= 0 && col < gridWidth && row >= 0 && row < gridHeight;
}
