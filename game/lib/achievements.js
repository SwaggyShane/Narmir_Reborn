// game/lib/achievements.js
// Achievement checking and score calculation.
// Pure functions over kingdom state → no I/O, no external side effects.

const { safeJsonParse } = require('../../utils/helpers');
const { BUILDING_COL } = require('../config');

function checkAchievements(k, updates, events) {
  const ach = safeJsonParse(
    updates.achievements || k.achievements,
    [],
    "checkAchievements",
  );
  let achUpdated = false;

  const currentTowers =
    updates.bld_mage_towers !== undefined
      ? updates.bld_mage_towers
      : k.bld_mage_towers;
  const currentLibraries =
    updates.bld_libraries !== undefined
      ? updates.bld_libraries
      : k.bld_libraries;
  const currentSchools =
    updates.bld_schools !== undefined
      ? updates.bld_schools
      : k.bld_schools;
  if (
    !ach.includes("ach_grandmaster") &&
    currentTowers >= 25 &&
    currentLibraries >= 25 &&
    currentSchools >= 25
  ) {
    ach.push("ach_grandmaster");
    updates.land =
      (updates.land !== undefined ? updates.land : k.land) + 10000;
    updates.maps =
      (updates.maps !== undefined ? updates.maps : k.maps) + 5000;
    events.push({
      type: "system",
      message:
        "ACHIEVEMENT UNLOCKED: Grandmaster! Rewarded +10000 Land and +5000 Maps.",
    });
    achUpdated = true;
  }

  // Calculate total buildings from all building types
  const totalBuildings = Object.values(BUILDING_COL)
    .filter(col => col.startsWith('bld_'))
    .reduce((sum, col) => sum + (updates[col] !== undefined ? updates[col] : k[col] || 0), 0);

  if (!ach.includes("ach_constructor") && totalBuildings >= 1500) {
    ach.push("ach_constructor");
    const currentSmithies = updates.bld_smithies !== undefined ? updates.bld_smithies : k.bld_smithies || 0;
    const smithiesToAdd = Math.max(0, 100 - currentSmithies);
    updates.bld_smithies = currentSmithies + smithiesToAdd;
    events.push({
      type: "system",
      message:
        `🏆 ACHIEVEMENT UNLOCKED: Constructor! Your expertise grants ${smithiesToAdd} Smithies, bringing your total to ${currentSmithies + smithiesToAdd}.`,
    });
    achUpdated = true;
  }

  // Founder achievement: Build first building
  if (!ach.includes("ach_founder") && totalBuildings >= 1) {
    ach.push("ach_founder");
    updates.gold =
      (updates.gold !== undefined ? updates.gold : k.gold) + 5000;
    events.push({
      type: "system",
      message: "ACHIEVEMENT UNLOCKED: Founder! You've built your first structure. Rewarded +5000 Gold.",
    });
    achUpdated = true;
  }

  const currentPop =
    updates.population !== undefined ? updates.population : k.population;
  if (!ach.includes("ach_warlord") && currentPop >= 50000) {
    ach.push("ach_warlord");
    updates.land =
      (updates.land !== undefined ? updates.land : k.land) + 10000;
    events.push({
      type: "system",
      message: "ACHIEVEMENT UNLOCKED: Warlord! Rewarded +10000 Land.",
    });
    achUpdated = true;
  }

  // Colossus achievement: 10 million+ population
  if (!ach.includes("ach_colossus") && currentPop >= 10000000) {
    ach.push("ach_colossus");
    updates.land =
      (updates.land !== undefined ? updates.land : k.land) + 50000;
    updates.mana =
      (updates.mana !== undefined ? updates.mana : k.mana) + 100000;
    updates.gold =
      (updates.gold !== undefined ? updates.gold : k.gold) + 1000000;
    events.push({
      type: "system",
      message: "ACHIEVEMENT UNLOCKED: Colossus! Your empire has swollen to 10 million souls. Rewarded +50000 Land, +100000 Mana, and +1000000 Gold.",
    });
    achUpdated = true;
  }

  const currentGold = updates.gold !== undefined ? updates.gold : k.gold;
  if (!ach.includes("ach_wealthy") && currentGold >= 10000000) {
    ach.push("ach_wealthy");
    events.push({
      type: "system",
      message:
        "ACHIEVEMENT UNLOCKED: Merchant King! All trade routes now generate +10% income permanently.",
    });
    achUpdated = true;
  }

  const currentMana = updates.mana !== undefined ? updates.mana : k.mana;
  if (!ach.includes("ach_arcane") && currentMana >= 1000000) {
    ach.push("ach_arcane");
    const scrolls = safeJsonParse(
      updates.scrolls !== undefined ? updates.scrolls : k.scrolls,
      {},
      "ach_arcane:scrolls",
    );
    scrolls.blank_scroll = (scrolls.blank_scroll || 0) + 10000;
    updates.scrolls = JSON.stringify(scrolls);
    updates.res_spellbook =
      (updates.res_spellbook !== undefined ? updates.res_spellbook : k.res_spellbook || 0) + 10000;
    events.push({
      type: "system",
      message:
        "ACHIEVEMENT UNLOCKED: Arcane Overlord! Rewarded +10,000 Spellbook and +10,000 Blank Scrolls.",
    });
    achUpdated = true;
  }

  const collectorAchieved = updates._collector_unlocked;
  if (collectorAchieved) {
    if (!ach.includes("collector")) {
      ach.push("collector");
      achUpdated = true;
      let _disc = safeJsonParse(updates.discovered_kingdoms || k.discovered_kingdoms, {}, "collector:discovered_kingdoms");
      updates._reveal_all_locations = true;
      events.push({
        type: "system",
        message:
          "ACHIEVEMENT UNLOCKED: Field Collector (Found all 50 expedition events). All world locations have been revealed!",
      });
    }
    delete updates._collector_unlocked;
  }

  const historianAchieved = updates._historian_unlocked;
  if (historianAchieved) {
    if (!ach.includes("historian")) {
      ach.push("historian");
      achUpdated = true;
      updates.maps =
        (updates.maps !== undefined ? updates.maps : k.maps) + 5000;
      events.push({
        type: "system",
        message:
          "ACHIEVEMENT UNLOCKED: Historian (Found all library lore). Rewarded +5000 Maps.",
      });
    }
    delete updates._historian_unlocked;
  }

  if (achUpdated) {
    updates.achievements = JSON.stringify(ach);
  }
}

function calculateScore(k) {
  let score = 0;

  // Base stats
  score += k.land * 1;
  score += k.population * 0.5;
  score += (k.level || 1) * 100;

  // Resources
  score += k.gold * 0.001;
  score += k.food * 0.0005;
  score += k.mana * 0.002;
  score += k.hammers_stored * 0.1;
  score += k.scaffolding_stored * 0.1;
  score += k.blueprints_stored * 5;
  score += k.weapons_stockpile * 0.005;
  score += k.armor_stockpile * 0.01;

  // Troop levels (multiplier)
  let troopLevels = {};
  if (k.troop_levels) {
    try {
      troopLevels =
        typeof k.troop_levels === "string"
          ? safeJsonParse(k.troop_levels, {}, "auto:troop_levels")
          : k.troop_levels;
    } catch {}
  }

  function getLvlMultiplier(unitType) {
    const unitInfo = troopLevels[unitType];
    const lvl =
      (unitInfo && typeof unitInfo === "object"
        ? Number(unitInfo.level)
        : Number(unitInfo)) || 1;
    return 1 + lvl * 0.15;
  }

  // Units
  score += k.war_machines * 1.25 * getLvlMultiplier("war_machines");
  score += (k.ballistae || 0) * 1.25 * getLvlMultiplier("war_machines");
  score += k.fighters * 0.75 * getLvlMultiplier("fighters");
  score += k.rangers * 1.75 * getLvlMultiplier("rangers");
  score += k.clerics * 0.75 * getLvlMultiplier("clerics");
  score += k.mages * 1.5 * getLvlMultiplier("mages");
  score += k.thieves * 0.95 * getLvlMultiplier("thieves");
  score += k.ninjas * 1.15 * getLvlMultiplier("ninjas");
  score += k.scribes * 0.25 * getLvlMultiplier("scribes");
  score += k.engineers * 1.25 * getLvlMultiplier("engineers");
  score += k.researchers * 0.5 * getLvlMultiplier("researchers");

  // Buildings (everything else -> balanced scoring)
  const bldAttrs = [
    "bld_farms",
    "bld_barracks",
    "bld_outposts",
    "bld_guard_towers",
    "bld_schools",
    "bld_armories",
    "bld_vaults",
    "bld_smithies",
    "bld_markets",
    "bld_mage_towers",
    "bld_shrines",
    "bld_training",
    "bld_castles",
    "bld_housing",
    "bld_libraries",
    "bld_taverns",
    "bld_walls",
  ];
  for (const b of bldAttrs) {
    score += (k[b] || 0) * 2;
  }

  return Math.floor(score);
}

module.exports = {
  checkAchievements,
  calculateScore,
};
