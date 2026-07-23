/**
 * Distance calculation from kingdom home to world locations.
 * Uses hex-unit distance for consistent turn cost calculation.
 */

'use strict';

const { hexUnitDistance } = require('./hex-utils');
const { getKingdomMapCoords } = require('./world-map-coords');

/**
 * Calculate hex distance from kingdom home to a location.
 * @param {object} kingdom - Kingdom object (with id and race)
 * @param {object} location - Location object (with x, y coordinates)
 * @returns {number} Distance in hex units
 */
function getDistanceToLocation(kingdom, location) {
  if (!kingdom || !location || location.x === undefined || location.y === undefined) {
    return 0;
  }

  // Get kingdom home coordinates and calculate distance directly using pixel coordinates
  const kingdomCoords = getKingdomMapCoords(kingdom);

  // hexUnitDistance expects four numeric pixel coordinates (x1, y1, x2, y2)
  // Location coordinates may be returned as strings from database, so wrap in Number()
  return hexUnitDistance(
    kingdomCoords.map_x,
    kingdomCoords.map_y,
    Number(location.x),
    Number(location.y)
  );
}

/**
 * Calculate turn cost to reach a location.
 * Dungeon: 50 + (distance × 1.5)
 * Mountain: 100 + (distance × 1.5)
 * Divided by race expedition_speed when provided (higher = faster / fewer turns).
 * @param {string} locationType - 'dungeon' or 'mountain'
 * @param {number} distanceInHexes - Distance in hex units
 * @param {string} [race] - optional kingdom race for RACE_BONUSES.expedition_speed
 * @returns {number} Total turn cost
 */
function getLocationTurnCost(locationType, distanceInHexes, race) {
  const baseCost = locationType === 'mountain' ? 100 : 50;
  const distanceCost = Math.ceil(distanceInHexes * 1.5);
  let cost = baseCost + distanceCost;
  if (race) {
    try {
      const { RACE_BONUSES } = require('./config');
      const speed = Number(RACE_BONUSES[race]?.expedition_speed) || 1;
      if (speed > 0 && speed !== 1) cost = cost / speed;
    } catch { /* config optional for pure distance callers */ }
  }
  return Math.max(1, Math.ceil(cost));
}

module.exports = {
  getDistanceToLocation,
  getLocationTurnCost,
};
