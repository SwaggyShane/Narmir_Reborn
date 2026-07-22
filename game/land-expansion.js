'use strict';

const config = require('./config');

/**
 * Land expansion economy formulas (locked 2026-07-04; population floor
 * added 2026-07-22 after a live incident — see TODO.md/ARCHIVAL.md).
 * Turns: None (instant action)
 * Reward: Land discovery (X,Y subsections within hexes)
 * Cost: 100 population per land discovered, never spent below the caller's
 *       populationFloor (e.g. farm-staffing reserve)
 * Formula: lands = (ranger_count / 10) × level_multiplier × race_modifier × terrain_modifier
 *          population_cost = lands_discovered × 100
 *
 * Base unit: 10 rangers level 1 = 1 land discovered
 */

function levelMultiplier(rangerLevel) {
  const level = Math.max(1, Math.floor(Number(rangerLevel) || 1));
  return 1 + (level - 1) * 0.25; // 25% per level above 1
}

/**
 * Calculate lands discovered from land expansion with given rangers.
 * Returns land count before terrain/race modifiers.
 */
function landExpansionBaseReward(rangerCount, rangerLevel) {
  const rangersUsed = Math.max(0, Math.floor(Number(rangerCount) || 0));
  const mult = levelMultiplier(rangerLevel);
  const baseLands = (rangersUsed / config.LAND_EXPANSION_CONSTANTS.RANGERS_PER_LAND) * mult;
  return Math.max(0, Math.floor(baseLands));
}

/**
 * Apply terrain modifier to land expansion discovery rate.
 */
function applyTerrainModifier(baseLands, terrain) {
  if (baseLands === 0) return 0;

  const mods = {
    forest: 1.0,
    grassland: 1.0,
    mountain: 0.8,
    water: 0.3,
  };

  const mod = mods[terrain] || 1.0;
  return Math.max(0, Math.floor(baseLands * mod));
}

/**
 * Apply race modifier to land expansion discovery rate.
 * Use land_expansion_modifier from RACE_BONUSES if available.
 */
function applyRaceModifier(baseLands, race) {
  if (baseLands === 0) return 0;

  const raceBonus = config.RACE_BONUSES[race];
  if (!raceBonus || !raceBonus.land_expansion_modifier) return baseLands;
  return Math.max(0, Math.floor(baseLands * raceBonus.land_expansion_modifier));
}

/**
 * Apply exponential diminishing returns to land expansion.
 * Formula: yield = base_yield / (1 + current_lands / (base_yield × K))
 * where K = 4.7 (diminishing returns scaling factor)
 */
function applyDiminishingReturns(baseYield, currentLands) {
  if (baseYield === 0) return 0;
  const K = 4.7;
  const divisor = 1 + (currentLands / (baseYield * K));
  const final = baseYield / divisor;
  return Math.max(0, Math.floor(final));
}

/**
 * Calculate population cost for land expansion.
 * cost = lands_discovered × 100
 */
function calculatePopulationCost(landsDiscovered) {
  const lands = Math.max(0, Math.floor(Number(landsDiscovered) || 0));
  return lands * config.LAND_EXPANSION_CONSTANTS.POPULATION_COST_PER_LAND;
}

/**
 * Full land expansion calculation: land reward, population cost.
 * Instant action (no turn cost). Applies exponential diminishing returns.
 *
 * @param {number} populationFloor - Population that must remain untouched
 *   (e.g. what's needed to staff built farms — see
 *   game/economy.js's minPopulationToStaffFarms). Only availablePopulation
 *   above this floor can be spent on land discovery. Defaults to 0 for
 *   callers that don't pass one (kingdom has no farms, or a caller that
 *   deliberately wants the old no-floor behavior).
 *
 * Returns { turns, populationCost, landsDiscovered }.
 */
function calculateLandExpansionReward(rangerCount, rangerLevel, terrain, race, availablePopulation, currentLands, populationFloor = 0) {
  const baseReward = landExpansionBaseReward(rangerCount, rangerLevel);
  const withTerrain = applyTerrainModifier(baseReward, terrain);
  const withRace = applyRaceModifier(withTerrain, race);

  // Apply diminishing returns based on lands already owned
  const currentLandsCount = Math.max(0, Math.floor(Number(currentLands) || 0));
  let landsToDiscover = applyDiminishingReturns(withRace, currentLandsCount);

  // Clamp to available population, minus whatever must stay reserved
  // (e.g. to keep farms staffed) — never spend below the floor.
  const floor = Math.max(0, Math.floor(Number(populationFloor) || 0));
  const spendablePopulation = Math.max(0, availablePopulation - floor);
  const maxAffordable = Math.floor(spendablePopulation / config.LAND_EXPANSION_CONSTANTS.POPULATION_COST_PER_LAND);
  landsToDiscover = Math.min(landsToDiscover, maxAffordable);

  return {
    turns: config.LAND_EXPANSION_CONSTANTS.TURN_COST, // 0
    populationCost: calculatePopulationCost(landsToDiscover),
    landsDiscovered: landsToDiscover,
  };
}

module.exports = {
  levelMultiplier,
  landExpansionBaseReward,
  applyTerrainModifier,
  applyRaceModifier,
  calculatePopulationCost,
  applyDiminishingReturns,
  calculateLandExpansionReward,
};
