/**
 * Prestige System
 * Handles kingdom prestige resets and level progression
 */

function canPrestige(k) {
  return k.level >= 50; // Prestige at Level 50
}

function processPrestige(k) {
  if (!canPrestige(k))
    return { error: "Kingdom level 50 required for Prestige" };

  const currentLevel = k.prestige_level || 0;
  const nextLevel = currentLevel + 1;

  // New Kingdom defaults
  return {
    updates: {
      prestige_level: nextLevel,
      level: 1,
      xp: 0,
      gold: 50000 * nextLevel, // Bonus starting gold
      land: k.land, // Keeping land as requested
      population: 5000,
      food: 25000,
      mana: 1000,
      fighters: 0,
      rangers: 0,
      clerics: 0,
      mages: 0,
      thieves: 0,
      war_machines: 0,
      bld_farms: 5,
      bld_barracks: 2,
      bld_schools: 1,
      bld_housing: 100,
      build_queue: "{}",
      build_progress: "{}",
      research_progress: "{}",
      training_allocation: "{}",
      smithy_allocation: "{}",
      mage_tower_allocation: "{}",
      shrine_allocation: "{}",
      turn: k.turn,
    }
  };
}

module.exports = {
  canPrestige,
  processPrestige,
};
