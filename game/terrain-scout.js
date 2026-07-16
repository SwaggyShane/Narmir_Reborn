/**
 * Fog of War Phase 5C: terrain-scoped scout difficulty (server-side).
 *
 * Uses the cached world hex grid (game/world-hex-grid-cache.js) so scout
 * rates match the same terrain the WebGL map draws. When the cache is not
 * loaded (tests, pre-boot), falls back to race-home predominant biome, then 1.0.
 *
 * scoutRate: multiplies ring progress / hexes explored (higher = easier).
 * foodCostMult: multiplies food cost per hex scouted (higher = harder).
 */

'use strict';

const { getTerrainAt, hasHexGrid } = require('./world-hex-grid-cache');
const { getKingdomMapCoords } = require('./world-map-coords');
const { pixelToHex } = require('./hex-utils');
const { getTerrainForRace } = require('./terrain');

/**
 * Locked scout difficulty by terrain type.
 * Baseline plains = 1.0. Roughly tracks expSpeed intuition (open land easier).
 */
const TERRAIN_SCOUT = Object.freeze({
  plains: { scoutRate: 1.12, foodCostMult: 0.95 },
  forest: { scoutRate: 0.92, foodCostMult: 1.05 },
  mountains: { scoutRate: 0.78, foodCostMult: 1.20 },
  hills: { scoutRate: 0.95, foodCostMult: 1.05 },
  swamp: { scoutRate: 0.75, foodCostMult: 1.18 },
  desert: { scoutRate: 0.88, foodCostMult: 1.10 },
  coast: { scoutRate: 1.05, foodCostMult: 1.00 },
  tundra: { scoutRate: 0.72, foodCostMult: 1.22 },
  volcanic: { scoutRate: 0.68, foodCostMult: 1.28 },
  lake: { scoutRate: 0.55, foodCostMult: 1.35 },
  ocean: { scoutRate: 0.50, foodCostMult: 1.40 },
});

const DEFAULT_SCOUT = Object.freeze({ scoutRate: 1.0, foodCostMult: 1.0 });

/**
 * @param {string|null|undefined} terrain
 * @returns {{ scoutRate: number, foodCostMult: number }}
 */
function getTerrainScoutModifiers(terrain) {
  if (!terrain || typeof terrain !== 'string') return { ...DEFAULT_SCOUT };
  const row = TERRAIN_SCOUT[terrain.toLowerCase()];
  return row ? { scoutRate: row.scoutRate, foodCostMult: row.foodCostMult } : { ...DEFAULT_SCOUT };
}

/**
 * Resolve terrain at a kingdom's home hex (or race fallback).
 * @param {object} kingdom - needs id/race for coords
 * @returns {string|null}
 */
function getKingdomHomeTerrain(kingdom) {
  if (!kingdom) return null;
  try {
    if (hasHexGrid()) {
      const { map_x, map_y } = getKingdomMapCoords(kingdom);
      const hex = pixelToHex(map_x, map_y);
      const t = getTerrainAt(hex.col, hex.row);
      if (t) return t;
    }
  } catch {
    // fall through to race fallback
  }
  if (kingdom.race) return getTerrainForRace(kingdom.race);
  return null;
}

/**
 * Scout progress multiplier for this kingdom's home terrain.
 * @param {object} kingdom
 * @returns {number}
 */
function getKingdomScoutRate(kingdom) {
  const terrain = getKingdomHomeTerrain(kingdom);
  return getTerrainScoutModifiers(terrain).scoutRate;
}

/**
 * Food cost multiplier for scouting from this kingdom's home terrain.
 * @param {object} kingdom
 * @returns {number}
 */
function getKingdomScoutFoodMult(kingdom) {
  const terrain = getKingdomHomeTerrain(kingdom);
  return getTerrainScoutModifiers(terrain).foodCostMult;
}

module.exports = {
  TERRAIN_SCOUT,
  DEFAULT_SCOUT,
  getTerrainScoutModifiers,
  getKingdomHomeTerrain,
  getKingdomScoutRate,
  getKingdomScoutFoodMult,
};
