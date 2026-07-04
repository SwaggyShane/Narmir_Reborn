'use strict';

const config = require('./config');

/**
 * Prospecting economy formulas (locked 2026-07-04).
 * Turns: 5 turns per prospecting action
 * Reward: 5 gold per engineer at level 1
 * Food cost: Same as Deep Expedition formula (scales by engineer count)
 * Terrain: Mountain biome (mountains are better for prospecting)
 * Formula: gold = 5 × engineer_count × level_multiplier × mountain_terrain_modifier × race_modifier
 *          food_cost = (engineer_count × level_multiplier) × (Deep_Exp_base_per_unit)
 */

function levelMultiplier(engineerLevel) {
  const level = Math.max(1, Math.floor(Number(engineerLevel) || 1));
  return 1 + (level - 1) * 0.05; // 5% per level above 1
}

/**
 * Calculate gold reward from prospecting with given engineers.
 * Returns gold amount before terrain/race modifiers.
 */
function prospectingBaseReward(engineerCount, engineerLevel) {
  const engineersUsed = Math.max(0, Math.floor(Number(engineerCount) || 0));
  const mult = levelMultiplier(engineerLevel);
  return Math.floor(config.PROSPECTING_CONSTANTS.GOLD_PER_ENGINEER_L1 * engineersUsed * mult);
}

/**
 * Apply terrain modifier to prospecting reward.
 * Mountain: 1.3x (excellent for prospecting)
 * Grassland: 1.0x (neutral)
 * Forest: 0.7x (poor for prospecting)
 * Other: 0.85x (mediocre)
 */
function applyTerrainModifier(baseReward, terrain) {
  const modifiers = {
    mountain: 1.3,
    grassland: 1.0,
    forest: 0.7,
    water: 0.5,
  };
  const mod = modifiers[terrain] || 0.85;
  return Math.floor(baseReward * mod);
}

/**
 * Apply race modifier to prospecting reward.
 * Use prospecting_modifier from RACE_BONUSES if available.
 */
function applyRaceModifier(baseReward, race) {
  const raceBonus = config.RACE_BONUSES[race];
  if (!raceBonus || !raceBonus.prospecting_modifier) return baseReward;
  return Math.floor(baseReward * raceBonus.prospecting_modifier);
}

/**
 * Calculate food cost for prospecting action.
 * Base formula: engineer_count × level_multiplier × (base_per_unit)
 * Similar to Deep Expedition scaling.
 */
function calculateFoodCost(engineerCount, engineerLevel) {
  const engineersUsed = Math.max(0, Math.floor(Number(engineerCount) || 0));
  const mult = levelMultiplier(engineerLevel);
  const baseCost = config.PROSPECTING_CONSTANTS.BASE_FOOD_COST_PER_HEX;
  const minCost = config.PROSPECTING_CONSTANTS.MIN_FOOD_COST_PER_HEX;

  const cost = Math.floor(baseCost * engineersUsed * mult);
  return Math.max(minCost, cost);
}

/**
 * Full prospecting calculation: turns, food cost, reward.
 * Returns { turns, foodCost, goldReward }.
 */
function calculateProspectingReward(engineerCount, engineerLevel, terrain, race) {
  const baseReward = prospectingBaseReward(engineerCount, engineerLevel);
  const withTerrain = applyTerrainModifier(baseReward, terrain);
  const withRace = applyRaceModifier(withTerrain, race);
  const foodCost = calculateFoodCost(engineerCount, engineerLevel);

  return {
    turns: config.PROSPECTING_CONSTANTS.TURN_COST,
    foodCost: foodCost,
    goldReward: Math.max(1, withRace), // At least 1 gold
  };
}

module.exports = {
  levelMultiplier,
  prospectingBaseReward,
  applyTerrainModifier,
  applyRaceModifier,
  calculateFoodCost,
  calculateProspectingReward,
};
