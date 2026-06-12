// Engineers domain: XP/leveling, construction speed multipliers, build time
// and cost calculation scaled by engineer level and race bonuses.

const config = require('./config');

function engineerXpForLevel(level) {
  if (level <= 1) return 0;
  if (level <= 10) return level * 100;
  if (level <= 25) return level * 300;
  if (level <= 50) return level * 800;
  if (level <= 75) return level * 2000;
  return level * 5000;
}

function engineerConstructionMult(level) {
  return Math.max(1.0, 1.0 + ((Math.min(level, 100) - 1) / 99) * 0.25);
}

function calculateBuildTime(kingdom, tier) {
  const baseTime = config.BUILDING_TIER_TIMES[tier] || 0;
  const engineerLevel = kingdom.engineer_level || 1;
  const engineerMult = engineerConstructionMult(engineerLevel);
  const raceMult = config.RACE_BONUSES[kingdom.race]?.construction || 1.0;

  const adjustedTime = baseTime / engineerMult / raceMult;
  return Math.ceil(adjustedTime);
}

function calculateBuildCost(kingdom, tier) {
  const baseCost = config.BUILDING_TIER_COSTS[tier] || {};
  const raceMult = config.RACE_BONUSES[kingdom.race]?.construction || 1.0;

  return {
    land: Math.ceil((baseCost.land || 0) / raceMult),
    wood: Math.ceil((baseCost.wood || 0) / raceMult),
    stone: Math.ceil((baseCost.stone || 0) / raceMult),
    iron: Math.ceil((baseCost.iron || 0) / raceMult),
  };
}

function awardEngineerXp(kingdom, xpAmount) {
  kingdom.engineer_xp = (kingdom.engineer_xp || 0) + xpAmount;
  kingdom.engineer_level = kingdom.engineer_level || 1;

  while (kingdom.engineer_level < 100) {
    const nextLevelXp = engineerXpForLevel(kingdom.engineer_level + 1);
    if (kingdom.engineer_xp >= nextLevelXp) {
      kingdom.engineer_xp -= nextLevelXp;
      kingdom.engineer_level++;
    } else {
      break;
    }
  }

  return kingdom;
}

module.exports = {
  engineerXpForLevel,
  engineerConstructionMult,
  calculateBuildTime,
  calculateBuildCost,
  awardEngineerXp,
};
