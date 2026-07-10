/**
 * Epic Trek path calculation and distance metrics.
 *
 * Provides straight-line hex enumeration (Bresenham-style for hexes)
 * and distance calculation for turn cost scaling. No obstacles, no
 * terrain penalties, unrestricted by region boundaries.
 */

'use strict';

const { pixelToHex, hexUnitDistance } = require('./hex-utils');

/**
 * Get ordered list of hexes from start to target using straight-line
 * hex enumeration. Path includes start and target hexes.
 *
 * Uses linear interpolation between start and target pixel coordinates,
 * then snaps each interpolated point to its nearest hex. This avoids
 * complex Bresenham-for-hex implementations and matches player expectations
 * (straight line visually = straight line hex-wise).
 *
 * @param {number} startX - Kingdom X coordinate
 * @param {number} startY - Kingdom Y coordinate
 * @param {number} targetX - Target X coordinate
 * @param {number} targetY - Target Y coordinate
 * @returns {Array} List of {col, row} hex cells along path
 */
function getPathHexes(startX, startY, targetX, targetY) {
  const startHex = pixelToHex(startX, startY);
  const targetHex = pixelToHex(targetX, targetY);

  // Early exit: same hex
  if (startHex.col === targetHex.col && startHex.row === targetHex.row) {
    return [startHex];
  }

  const distance = hexUnitDistance(startX, startY, targetX, targetY);
  const steps = Math.max(1, Math.ceil(distance * 2)); // 2 interpolations per hex-distance

  const path = [];
  const seen = new Set();

  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    const x = startX + (targetX - startX) * t;
    const y = startY + (targetY - startY) * t;
    const hex = pixelToHex(x, y);
    const key = `${hex.col},${hex.row}`;

    if (!seen.has(key)) {
      seen.add(key);
      path.push(hex);
    }
  }

  return path.length > 0 ? path : [startHex];
}

/**
 * Calculate turn cost for Epic Trek to target.
 * Cost = 1.5 turns per hex distance (EPIC_TREK_TURNS_PER_HEX from config).
 *
 * Phase 3B TODO: Apply elevation movement penalties via calculateMovementCost()
 * Currently requires elevation_grid lookup for each hex along path.
 * Would add 1.3x-1.5x multiplier for high-elevation routes.
 *
 * @param {number} startX - Kingdom X
 * @param {number} startY - Kingdom Y
 * @param {number} targetX - Target X
 * @param {number} targetY - Target Y
 * @param {object} opts - Optional {elevationGrid, getFlag}
 * @returns {number} Turn cost (ceiling)
 */
function getEpicTrekTurns(startX, startY, targetX, targetY, opts = {}) {
  const distance = hexUnitDistance(startX, startY, targetX, targetY);
  const EPIC_TREK_TURNS_PER_HEX = 1.5; // Locked constant
  let cost = distance * EPIC_TREK_TURNS_PER_HEX;

  // Phase 3B: Apply elevation penalties if enabled and elevation data available
  if (opts.getFlag?.('FEATURE_ELEVATION_MOVEMENT') && opts.elevationGrid) {
    const { calculateMovementCost } = require('./world-elevation');
    const pathHexes = getPathHexes(startX, startY, targetX, targetY);

    // Simple approximation: use start/end elevation delta
    const startElev = opts.elevationGrid[`${pathHexes[0].col},${pathHexes[0].row}`] || 0;
    const endElev = opts.elevationGrid[`${pathHexes[pathHexes.length - 1].col},${pathHexes[pathHexes.length - 1].row}`] || 0;
    const movementMult = calculateMovementCost(startElev, endElev, { FEATURE_ELEVATION_MOVEMENT: true });
    cost *= movementMult;
  }

  return Math.ceil(cost);
}

/**
 * Get distance in hex units between two points.
 *
 * @param {number} startX - Start X
 * @param {number} startY - Start Y
 * @param {number} targetX - Target X
 * @param {number} targetY - Target Y
 * @returns {number} Hex distance
 */
function getDistanceInHexes(startX, startY, targetX, targetY) {
  return hexUnitDistance(startX, startY, targetX, targetY);
}

/**
 * Validate that a target coordinate is within map bounds.
 * Map is 1999×1380 pixels (from EXPLORATION_SYSTEM_LOCKED.md).
 *
 * @param {number} x - Target X
 * @param {number} y - Target Y
 * @returns {boolean} True if in bounds
 */
function isTargetInBounds(x, y) {
  const MAP_WIDTH = 1999;
  const MAP_HEIGHT = 1380;
  return x >= 0 && x <= MAP_WIDTH && y >= 0 && y <= MAP_HEIGHT;
}

module.exports = {
  getPathHexes,
  getEpicTrekTurns,
  getDistanceInHexes,
  isTargetInBounds,
};
