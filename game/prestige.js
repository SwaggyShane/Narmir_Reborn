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
      bld_granaries: 0,
      bld_taverns: 0,
      bld_markets: 0,
      bld_libraries: 0,
      bld_shrines: 0,
      bld_mausoleums: 0,
      bld_guard_towers: 0,
      bld_walls: 0,
      bld_outposts: 0,
      bld_smithies: 0,
      bld_armories: 0,
      bld_vaults: 0,
      bld_mage_towers: 0,
      bld_training: 0,
      bld_castles: 0,
      bld_woodyard: 0,
      bld_lumber_camp: 0,
      bld_sawmill: 0,
      bld_gravel_pit: 0,
      bld_blockfield: 0,
      bld_stone_quarry: 0,
      bld_open_pit: 0,
      bld_strip_mine: 0,
      bld_deep_mine: 0,
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
