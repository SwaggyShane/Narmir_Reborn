// Kingdom utilities: scoring, building demolition, and alliance defense resolution.

const { safeJsonParse } = require('../utils/helpers');
const config = require('./config');
const { BUILDING_COL, BUILDING_GOLD_COST, BUILDING_LAND_COST } = config;

function resolveAllianceDefense(attackResult, allies) {
  // When a kingdom is attacked, allied kingdoms send pledge % of their fighters
  if (!attackResult.win) return [];
  return allies.map((ally) => {
    const sent = Math.floor(ally.fighters * (ally.pledge / 100));
    return { allyId: ally.id, sent };
  });
}

function demolishBuilding(k, buildingKey, amount) {
  const col = BUILDING_COL[buildingKey];
  if (!col) return { error: "Unknown building" };
  const current = k[col] || 0;
  const toDemolish = Math.min(amount, current);
  if (toDemolish <= 0) return { error: "Nothing to demolish" };

  const goldRefund = Math.floor(
    (BUILDING_GOLD_COST[buildingKey] || 0) * 0.25 * toDemolish,
  );
  const landRefund = (BUILDING_LAND_COST[buildingKey] || 0) * toDemolish;

  return {
    updates: {
      [col]: current - toDemolish,
      gold: k.gold + goldRefund,
      land: k.land + landRefund,
    },
    refund: { gold: goldRefund, land: landRefund, count: toDemolish },
  };
}

function calculateScore(k) {
  let score = 0;

  // Base stats
  score += (k.land || 0) * 1;
  score += (k.population || 0) * 0.5;
  score += (k.level || 1) * 100;

  // Resources
  score += (k.gold || 0) * 0.001;
  score += (k.food || 0) * 0.0005;
  score += (k.mana || 0) * 0.002;
  score += (k.hammers_stored || 0) * 0.1;
  score += (k.scaffolding_stored || 0) * 0.1;
  score += (k.blueprints_stored || 0) * 5;
  score += (k.weapons_stockpile || 0) * 0.005;
  score += (k.armor_stockpile || 0) * 0.01;

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
    // user said: "start at an addition .15 at level 1 increases incrementally"
    return 1 + lvl * 0.15;
  }

  // Units
  score += (k.war_machines || 0) * 1.25 * getLvlMultiplier("war_machines");
  score += (k.ballistae || 0) * 1.25 * getLvlMultiplier("war_machines");
  score += (k.fighters || 0) * 0.75 * getLvlMultiplier("fighters");
  score += (k.rangers || 0) * 1.75 * getLvlMultiplier("rangers");
  score += (k.clerics || 0) * 0.75 * getLvlMultiplier("clerics");
  score += (k.mages || 0) * 1.5 * getLvlMultiplier("mages");
  score += (k.thieves || 0) * 0.95 * getLvlMultiplier("thieves");
  score += (k.ninjas || 0) * 1.15 * getLvlMultiplier("ninjas");
  score += (k.scribes || 0) * 0.25 * getLvlMultiplier("scribes");
  score += (k.engineers || 0) * 1.25 * getLvlMultiplier("engineers");
  score += (k.researchers || 0) * 0.5 * getLvlMultiplier("researchers");

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
    score += (k[b] || 0) * 2; // Flat 2 points per building to reward infrastructure
  }

  return Math.floor(score);
}

module.exports = { resolveAllianceDefense, demolishBuilding, calculateScore };
