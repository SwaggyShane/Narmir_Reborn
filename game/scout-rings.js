'use strict';

const { getHexesInRadius } = require('./hex-utils');
const config = require('./config');

/**
 * Scout ring progression system (locked 2026-07-04).
 * Rings 1-17 are available; Ring 17 is the hard cap.
 * Ring N requires: SCOUT_BASE_TURNS + (N-1) × SCOUT_RING_INCREMENT turns
 * Example: Ring 1 = 20 turns, Ring 2 = 25 turns, Ring 17 = 100 turns
 */

/**
 * Get the turn cost for a specific ring.
 * Formula: 20 + (ring - 1) × 5
 *
 * @param {number} ring - Ring number (1-17)
 * @returns {number} Turns required to complete this ring
 */
function getRingTurnCost(ring) {
  const ringNum = Math.max(1, Math.min(config.SCOUT_CONSTANTS.MAX_RING, Math.floor(Number(ring) || 1)));
  return config.SCOUT_CONSTANTS.SCOUT_BASE_TURNS + (ringNum - 1) * config.SCOUT_CONSTANTS.SCOUT_RING_INCREMENT;
}

/**
 * Get all hexes in a specific ring around the kingdom's home hex.
 * Ring N includes hexes at distance N from home (not rings 1..N).
 *
 * @param {string} homeHex - Kingdom's home hex as "col,row" string
 * @param {number} ring - Ring number (1-17)
 * @returns {array} Array of hex objects in this ring
 */
function getRingHexes(homeHex, ring) {
  const ringNum = Math.max(1, Math.min(config.SCOUT_CONSTANTS.MAX_RING, Math.floor(Number(ring) || 1)));

  const [homeCol, homeRow] = homeHex.split(',').map(Number);
  const allInRadius = getHexesInRadius(homeCol, homeRow, ringNum);
  const prevInRadius = ringNum > 1 ? getHexesInRadius(homeCol, homeRow, ringNum - 1) : [];

  // Ring N = all hexes in radius N minus all hexes in radius N-1
  return allInRadius.filter(h => !prevInRadius.some(p => p.col === h.col && p.row === h.row));
}

/**
 * Get total number of hexes that would be discovered in rings 1 through N.
 * Useful for progress bars and completion metrics.
 *
 * @param {number} ring - Ring number (1-17)
 * @returns {number} Total cumulative hexes in rings 1..ring
 */
function getTotalHexesInRings(ring) {
  const ringNum = Math.max(1, Math.min(config.SCOUT_CONSTANTS.MAX_RING, Math.floor(Number(ring) || 1)));
  const allInRadius = getHexesInRadius(0, 0, ringNum);
  return allInRadius.length;
}

/**
 * Get the turn cost for completing all rings from 1 through N.
 * Cumulative sum: Ring 1 + Ring 2 + ... + Ring N
 *
 * @param {number} ring - Ring number (1-17)
 * @returns {number} Total turns to complete rings 1..ring
 */
function getTotalTurnsToCompleteRing(ring) {
  const ringNum = Math.max(1, Math.min(config.SCOUT_CONSTANTS.MAX_RING, Math.floor(Number(ring) || 1)));
  let totalTurns = 0;
  for (let i = 1; i <= ringNum; i++) {
    totalTurns += getRingTurnCost(i);
  }
  return totalTurns;
}

/**
 * Determine which ring a kingdom has completed based on scout allocation progress.
 * If a kingdom has allocated 20 rangers and they've consumed 20 turns,
 * they're 1 scout-turn complete (Ring 1 requires 20 turns).
 *
 * @param {number} scoutProgress - Total scout-turns accumulated (rangers × turns_in_turn)
 * @returns {number} Highest completed ring (0 if not started, 1-17 if completed)
 */
function getCompletedRing(scoutProgress) {
  const progress = Math.max(0, Math.floor(Number(scoutProgress) || 0));
  let ring = 0;

  for (let i = 1; i <= config.SCOUT_CONSTANTS.MAX_RING; i++) {
    const turnsRequired = getTotalTurnsToCompleteRing(i);
    if (progress >= turnsRequired) {
      ring = i;
    } else {
      break;
    }
  }

  return ring;
}

/**
 * Calculate progress toward the next ring.
 *
 * @param {number} scoutProgress - Total scout-turns accumulated
 * @returns {object} Progress metrics: {currentRing, turnsForCurrentRing, turnsTowardNext, percentComplete}
 */
function getProgressMetrics(scoutProgress) {
  const progress = Math.max(0, Math.floor(Number(scoutProgress) || 0));
  const currentRing = getCompletedRing(progress);
  const nextRing = Math.min(currentRing + 1, config.SCOUT_CONSTANTS.MAX_RING);

  const turnsRequiredForNext = getRingTurnCost(nextRing);
  const turnsPreviouslyDone = currentRing > 0 ? getTotalTurnsToCompleteRing(currentRing) : 0;
  const turnsIntoNext = progress - turnsPreviouslyDone;
  const percentComplete = (turnsIntoNext / turnsRequiredForNext) * 100;

  return {
    currentRing,
    nextRing: nextRing > config.SCOUT_CONSTANTS.MAX_RING ? null : nextRing,
    turnsForCurrentRing: turnsRequiredForNext,
    turnsTowardNext: Math.max(0, turnsIntoNext),
    percentComplete: Math.min(100, Math.max(0, percentComplete)),
  };
}

module.exports = {
  getRingTurnCost,
  getRingHexes,
  getTotalHexesInRings,
  getTotalTurnsToCompleteRing,
  getCompletedRing,
  getProgressMetrics,
};
