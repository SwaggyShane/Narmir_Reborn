/**
 * Distance calculation from kingdom home to world locations.
 * Uses hex-unit distance for consistent turn cost calculation.
 */

'use strict';

const { pixelToHex, hexUnitDistance } = require('./hex-utils');
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

  // Get kingdom home coordinates
  const kingdomCoords = getKingdomMapCoords(kingdom);
  const kingdomHex = pixelToHex(kingdomCoords.map_x, kingdomCoords.map_y);

  // Get location hex coordinates
  const locationHex = pixelToHex(location.x, location.y);

  // Calculate hex distance
  return hexUnitDistance(kingdomHex, locationHex);
}

/**
 * Calculate turn cost to reach a location.
 * Dungeon: 50 + (distance × 1.5)
 * Mountain: 100 + (distance × 1.5)
 * @param {string} locationType - 'dungeon' or 'mountain'
 * @param {number} distanceInHexes - Distance in hex units
 * @returns {number} Total turn cost
 */
function getLocationTurnCost(locationType, distanceInHexes) {
  const baseCost = locationType === 'mountain' ? 100 : 50;
  const distanceCost = Math.ceil(distanceInHexes * 1.5);
  return baseCost + distanceCost;
}

module.exports = {
  getDistanceToLocation,
  getLocationTurnCost,
};
