/**
 * Shared hex-grid math for the world map. Pointy-top hexagons, odd-r offset
 * coordinates (odd rows shoved right) — matches the tessellation rendered by
 * client/src/components/react/WorldmapRenderer.jsx exactly, so server-side
 * visibility/scouting logic and the client's terrain rendering never drift
 * apart. Formulas follow the Red Blob Games hex grid guide:
 * https://www.redblobgames.com/grids/hexagons/
 *
 * The game world itself stays on continuous x,y pixel coordinates (see
 * game/world-map-coords.js) — hexes are a visual/measurement overlay, not a
 * mechanical grid. hexUnitDistance is the metric used for scouting/expedition
 * balance; pixelToHex is used to validate placement and to render fog-of-war
 * scouting areas onto the hex grid.
 */

'use strict';

const HEX_SIZE = 34; // center-to-corner radius, matches WorldmapRenderer.jsx
const HEX_W = Math.sqrt(3) * HEX_SIZE;
const HEX_VERT = HEX_SIZE * 1.5;

// odd-r offset neighbor directions (pointy-top hexes), indexed by row parity.
// Direction order is fixed regardless of parity: E, NE, NW, W, SW, SE.
const ODDR_DIRECTIONS = [
  [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]],
  [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]],
];

/**
 * Convert an odd-r offset hex cell (col, row) to its pixel center.
 */
function hexCenter(col, row) {
  const x = col * HEX_W + (row % 2 !== 0 ? HEX_W / 2 : 0);
  const y = row * HEX_VERT;
  return { x, y };
}

/**
 * Return the 6 corner points of a hex centered at (cx, cy).
 */
function hexCorners(cx, cy, size = HEX_SIZE) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push([
      Math.round((cx + size * Math.cos(angle)) * 10) / 10,
      Math.round((cy + size * Math.sin(angle)) * 10) / 10,
    ]);
  }
  return pts;
}

/**
 * Return the 6 neighbor cell keys ("col,row") of an odd-r offset hex.
 */
function hexNeighborKeys(col, row) {
  const parity = row & 1;
  return ODDR_DIRECTIONS[parity].map(([dc, dr]) => `${col + dc},${row + dr}`);
}

/**
 * Convert pixel coordinates to the odd-r offset hex cell containing them.
 * Naive rounding of offset coordinates fails near hex boundaries, so this
 * goes through fractional axial -> cube -> rounded cube -> offset, per the
 * Red Blob Games guide's "pixel to hex" derivation.
 */
function pixelToHex(x, y) {
  // 1. continuous (x, y) -> fractional axial (q, r)
  const r = y / HEX_VERT;
  const q = x / HEX_W - r / 2;

  // 2. axial -> fractional cube
  const cubeX = q;
  const cubeZ = r;
  const cubeY = -cubeX - cubeZ;

  // 3. round to nearest integer cube, fixing up the largest-error axis so the
  // three rounded components still sum to zero (a hard cube-coordinate
  // invariant that naive independent rounding would violate)
  let rx = Math.round(cubeX);
  let ry = Math.round(cubeY);
  let rz = Math.round(cubeZ);
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

  // 4. rounded cube -> odd-r offset (col, row), matching hexCenter's layout
  const row = rz;
  const col = rx + (rz - (rz & 1)) / 2;
  return { col, row };
}

/**
 * True if pixel (x, y) lands inside the hex cell (col, row) — i.e. its
 * nearest hex center (via pixelToHex) is that cell. Used to validate that a
 * kingdom/node's continuous coordinate lands where it visually renders.
 */
function isPixelInHex(x, y, col, row) {
  const hit = pixelToHex(x, y);
  return hit.col === col && hit.row === row;
}

/**
 * Distance between two pixel points, expressed in hex-units (1 hex-unit =
 * HEX_SIZE pixels). This is a pure Euclidean distance metric for exploration/
 * scouting balance — it does NOT walk the hex grid; the game world stays
 * continuous. Use hexNeighborKeys/frontier logic for grid-adjacency, not this.
 */
function hexUnitDistance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1) / HEX_SIZE;
}

module.exports = {
  HEX_SIZE,
  HEX_W,
  HEX_VERT,
  ODDR_DIRECTIONS,
  hexCenter,
  hexCorners,
  hexNeighborKeys,
  pixelToHex,
  isPixelInHex,
  hexUnitDistance,
};
