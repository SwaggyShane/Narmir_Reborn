/**
 * In-memory cache for the built world hex grid (game/world-hex-grid.js's
 * buildHexGrid output: cells + cellMap, with real terrain including lakes).
 *
 * Mirrors game/world-seed.js's pattern: kingdom placement (game/world-map-coords.js)
 * needs synchronous per-call terrain lookups (e.g. "is this hex a lake?") on
 * hot paths, so the grid is built once at boot (db/schema.js, alongside
 * elevation) and cached here rather than rebuilt per call.
 */

'use strict';

let cachedGrid = null;

function setHexGrid(hexGrid) {
  cachedGrid = hexGrid || null;
}

function hasHexGrid() {
  return cachedGrid !== null;
}

/**
 * Non-throwing terrain lookup by pixel-derived hex col/row. Returns null if
 * the cache isn't populated yet or the hex isn't in the grid, rather than
 * throwing — callers use this for an additional placement-validity check on
 * top of the existing ocean-band check, not as a hard boot dependency.
 */
function getTerrainAt(col, row) {
  if (!cachedGrid) return null;
  const cell = cachedGrid.cellMap.get(`${col},${row}`);
  return cell ? cell.terrain : null;
}

module.exports = {
  setHexGrid,
  hasHexGrid,
  getTerrainAt,
};
