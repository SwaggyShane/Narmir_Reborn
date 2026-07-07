'use strict';

const config = require('./config');

/**
 * Hunting economy formulas (locked 2026-07-04).
 * Turns: 5 turns per hunt action
 * Reward: 10 food per ranger at level 1
 * Food cost: FREE (no food cost for hunting)
 * Terrain: Forest biome (forests are better for hunting)
 * Formula: food = 10 × ranger_count × level_multiplier × forest_terrain_modifier × race_modifier
 */

function levelMultiplier(rangerLevel) {
  const level = Math.max(1, Math.floor(Number(rangerLevel) || 1));
  return 1 + (level - 1) * 0.25; // 25% per level above 1
}

/**
 * Calculate food reward from hunting with given rangers.
 * Returns food amount before terrain/race modifiers.
 */
function huntingBaseReward(rangerCount, rangerLevel) {
  const rangersUsed = Math.max(0, Math.floor(Number(rangerCount) || 0));
  const mult = levelMultiplier(rangerLevel);
  return Math.floor(config.HUNTING_CONSTANTS.FOOD_PER_RANGER_L1 * rangersUsed * mult);
}

/**
 * Apply terrain modifier to hunting reward.
 * Forest: 1.3x (excellent for hunting)
 * Grassland: 1.0x (neutral)
 * Mountain: 0.7x (poor for hunting)
 * Other: 0.85x (mediocre)
 */
function applyTerrainModifier(baseReward, terrain) {
  const modifiers = {
    forest: 1.3,
    grassland: 1.0,
    mountain: 0.7,
    water: 0.5,
  };
  const mod = modifiers[terrain] || 0.85;
  return Math.floor(baseReward * mod);
}

/**
 * Apply race modifier to hunting reward.
 * Use hunting_modifier from RACE_BONUSES if available.
 */
function applyRaceModifier(baseReward, race) {
  const raceBonus = config.RACE_BONUSES[race];
  if (!raceBonus || !raceBonus.hunting_modifier) return baseReward;
  return Math.floor(baseReward * raceBonus.hunting_modifier);
}

/**
 * Apply duration scaling to hunting reward.
 * Instant: 1x (1 turn, home hex)
 * 5-turn: 3x (travel + 5 turns + return)
 * 25-turn: 10x (travel + 25 turns + return)
 */
function applyDurationScaling(baseReward, durationVariant) {
  const scalars = {
    instant: 1,
    '5': 3,
    '25': 10,
  };
  const scalar = scalars[durationVariant] || 1;
  return Math.floor(baseReward * scalar);
}

/**
 * Full hunting calculation: turns, food cost, reward with duration scaling.
 * Returns { foodReward, scalingMultiplier }.
 * Caller determines turns based on duration variant.
 */
function calculateHuntingReward(rangerCount, rangerLevel, terrain, race, durationVariant = 'instant') {
  const baseReward = huntingBaseReward(rangerCount, rangerLevel);
  const withTerrain = applyTerrainModifier(baseReward, terrain);
  const withRace = applyRaceModifier(withTerrain, race);
  const withDuration = applyDurationScaling(withRace, durationVariant);

  return {
    foodReward: Math.max(1, withDuration),
    scalingMultiplier: { instant: 1, '5': 3, '25': 10 }[durationVariant] || 1,
  };
}

module.exports = {
  levelMultiplier,
  huntingBaseReward,
  applyTerrainModifier,
  applyRaceModifier,
  applyDurationScaling,
  calculateHuntingReward,
};
