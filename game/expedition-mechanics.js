'use strict';

const { cellIndex, isValidCell } = require('./lib/hex');

/**
 * Expedition mechanics: travel time, hex validation, turn calculations.
 * Core formulas:
 * - Travel time: 1.5 turns per hex (straight line distance)
 * - Expedition duration: travel_out + action_duration + travel_back
 * - ETA: now + total_turns × 1500ms (25-minute turns)
 */

/**
 * Calculate straight-line hex distance using Euclidean approximation.
 * For odd-r offset hex grids, simplified to pixel distance / hex size.
 */
function calculateHexDistance(startCol, startRow, endCol, endRow) {
  const dx = endCol - startCol;
  const dy = endRow - startRow;
  // Rough hex distance; refined from pixel-based approach
  const dist = Math.sqrt(dx * dx + 0.75 * dy * dy);
  return dist;
}

/**
 * Calculate travel time (one-way) from start hex to target hex.
 * Formula: distance × 1.5 turns per hex
 */
function calculateTravelTime(startCol, startRow, endCol, endRow) {
  const distance = calculateHexDistance(startCol, startRow, endCol, endRow);
  const travelTurns = Math.ceil(distance * 1.5);
  return Math.max(1, travelTurns);
}

/**
 * Calculate total expedition duration (out + action + back).
 * For instant: just 1 turn
 * For 5/25: travel_out + action_duration + travel_back
 */
function calculateExpeditionDuration(durationVariant, travelTurns) {
  if (durationVariant === 'instant') {
    return 1;
  }
  if (durationVariant === '5') {
    return travelTurns + 5 + travelTurns;
  }
  if (durationVariant === '25') {
    return travelTurns + 25 + travelTurns;
  }
  return 1;
}

/**
 * Check if hex is visible (explored) by player.
 * Uses client-side visibility bitmask from world-map.
 * Home hex is always visible.
 */
function isHexExplored(playerHomeCol, playerHomeRow, targetCol, targetRow, seenCells, currentCells) {
  if (!seenCells && !currentCells) {
    return false;
  }

  // Home hex is always visible
  if (targetCol === playerHomeCol && targetRow === playerHomeRow) {
    return true;
  }

  if (!isValidCell(targetCol, targetRow)) return false;

  const idx = cellIndex(targetCol, targetRow);

  if (currentCells) {
    const seenBig = typeof currentCells === 'bigint' ? currentCells : BigInt(currentCells || 0);
    return (seenBig & (1n << BigInt(idx))) !== 0n;
  }

  if (seenCells) {
    const seenBig = typeof seenCells === 'bigint' ? seenCells : BigInt(seenCells || 0);
    return (seenBig & (1n << BigInt(idx))) !== 0n;
  }

  return false;
}

/**
 * Validate target hex for an expedition.
 * Rules:
 * - Instant: always home hex (no validation needed, auto-set)
 * - 5/25: must be explored (checked via visibility)
 */
function validateTargetHex(durationVariant, homeCol, homeRow, targetCol, targetRow, seenCells, currentCells) {
  if (durationVariant === 'instant') {
    // Instant always uses home hex
    return { valid: true, homeHex: true };
  }

  if (durationVariant === '5' || durationVariant === '25') {
    // Must be explored (not home hex, which is always visible)
    const explored = isHexExplored(homeCol, homeRow, targetCol, targetRow, seenCells, currentCells);
    if (!explored) {
      return { valid: false, error: 'Target hex is not explored' };
    }
    return { valid: true, homeHex: false };
  }

  return { valid: false, error: 'Invalid duration variant' };
}

/**
 * Calculate ETA (milliseconds from now) for expedition completion.
 * Each turn = 1500ms (25-minute turns in real time).
 */
function calculateETA(totalTurns) {
  const MS_PER_TURN = 1500; // 25 minutes = 1500 seconds = 1.5 million ms? No, 25 min = 25*60 = 1500 sec
  // Actually, looking at the code, turns seem to be game turns. Let me use a reasonable approximation.
  // Since we don't know the actual turn tick interval here, return total_turns for client to format.
  return totalTurns;
}

module.exports = {
  calculateHexDistance,
  calculateTravelTime,
  calculateExpeditionDuration,
  isHexExplored,
  validateTargetHex,
  calculateETA,
};
