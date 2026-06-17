// game/world.js
// World / meta-game functions: region assignment, prestige, alliance defense,
// region control resolution, and kingdom score calculation.

const { safeJsonParse } = require('../utils/helpers');

function assignRegion(race) {
  return race; // simple mapping for now: race name = region id
}

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
      ninjas: 0,
      scribes: 0,
      engineers: 0,
      researchers: 0,
      wood: 0,
      stone: 0,
      iron: 0,
      bld_farms: 5,
      bld_barracks: 2,
      bld_schools: 1,
      bld_housing: 100,
      bld_granaries: 0,
      bld_taverns: 0,
      bld_markets: 0,
      bld_guard_towers: 0,
      bld_outposts: 0,
      bld_smithies: 0,
      bld_armories: 0,
      bld_vaults: 0,
      bld_mage_towers: 0,
      bld_shrines: 0,
      bld_training: 0,
      bld_castles: 0,
      bld_libraries: 0,
      bld_walls: 0,
      bld_mausoleums: 0,
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

function resolveAllianceDefense(attackResult, allies) {
  // When a kingdom is attacked, allied kingdoms send pledge % of their fighters
  if (!attackResult.win) return [];
  return allies.map((ally) => {
    const sent = Math.floor(ally.fighters * (ally.pledge / 100));
    return { allyId: ally.id, sent };
  });
}

async function resolveRegions(db, io) {
  const regions = await db.all("SELECT name, owner_alliance_id, contest_alliance_id, contest_progress FROM regions");
  for (const region of regions) {
    // Calculate current influence in this region
    // Influence = Sum of Land for each alliance
    const tallies = await db.all(
      `
      SELECT am.alliance_id, SUM(k.land) as alliance_land
      FROM kingdoms k
      JOIN alliance_members am ON k.id = am.kingdom_id
      WHERE k.region = ?
      GROUP BY am.alliance_id
      ORDER BY alliance_land DESC
    `,
      [region.name],
    );

    if (!tallies.length) continue;

    const top = tallies[0];
    const topAllianceId = top.alliance_id;
    const topLand = top.alliance_land;

    // To capture, you need either the most land OR a minimum threshold
    // Let's say: if the top alliance has > 50% of the total LAND in the region, they start/continue capture
    const totalLandInRegion = tallies.reduce(
      (sum, t) => sum + t.alliance_land,
      0,
    );
    const hasDominance = topLand > totalLandInRegion * 0.51;

    if (hasDominance) {
      if (region.owner_alliance_id === topAllianceId) {
        // Owner still dominate, reset contest if any
        if (region.contest_alliance_id) {
          await db.run(
            "UPDATE regions SET contest_alliance_id = NULL, contest_progress = 0 WHERE name = ?",
            [region.name],
          );
        }
      } else {
        // Challenging or starting capture
        if (region.contest_alliance_id === topAllianceId) {
          const progress = Math.min(100, region.contest_progress + 10); // 10% per turn cycle?
          if (progress >= 100) {
            // CAPTURED!
            await db.run(
              `
              UPDATE regions
              SET owner_alliance_id = ?, contest_alliance_id = NULL, contest_progress = 0, last_captured_at = ?
              WHERE name = ?
            `,
              [topAllianceId, Math.floor(Date.now() / 1000), region.name],
            );

            const alliance = await db.get(
              "SELECT name FROM alliances WHERE id = ?",
              [topAllianceId],
            );
            if (io)
              io.emit("chat", {
                room: "global",
                username: "System",
                message: `\u{1F3F0} REGION CAPTURED: The alliance [${alliance?.name || "Unknown Alliance"}] has seized control of ${region.name}!`,
                is_system: true,
              });
          } else {
            await db.run(
              "UPDATE regions SET contest_progress = ? WHERE name = ?",
              [progress, region.name],
            );
          }
        } else {
          // New challenger
          await db.run(
            "UPDATE regions SET contest_alliance_id = ?, contest_progress = 10 WHERE name = ?",
            [topAllianceId, region.name],
          );
        }
      }
    } else {
      // No dominance, decay contest
      if (region.contest_progress > 0) {
        const progress = Math.max(0, region.contest_progress - 5);
        await db.run("UPDATE regions SET contest_progress = ? WHERE name = ?", [
          progress,
          region.name,
        ]);
      }
    }
  }
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

module.exports = {
  assignRegion,
  canPrestige,
  processPrestige,
  resolveAllianceDefense,
  resolveRegions,
  calculateScore,
};
