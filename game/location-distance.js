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
