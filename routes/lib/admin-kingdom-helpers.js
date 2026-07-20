'use strict';

// Shared reset/seed logic for admin kingdom management — split out of
// routes/admin.js (A2-9, 2026-07-19). Used by BOTH routes/admin-kingdoms.js
// (reset-kingdom, reset-all-kingdoms, test-kingdoms/setup) and
// routes/admin-ai.js (ai/seed, ai/reset) — extracted here rather than
// duplicated, same pattern as routes/lib/kingdom-turn-helpers.js (A2-3).

const commandHandler = require('../../game/command-handler');
const { DEFAULT_VISIBILITY } = require('../../game/visibility-migration');

const BCRYPT_SALT_ROUNDS = 10;

const TEST_RACES = [
  "human",
  "high_elf",
  "dwarf",
  "dire_wolf",
  "dark_elf",
  "orc",
  "vampire",
  "wood_elf",
  "ogre",
];

function buildStartingProfile(race) {
  const buildings = {
    bld_farms: 10,
    bld_schools: 1,
    bld_barracks: 1,
    bld_armories: 1,
    bld_housing: 100,
    bld_markets: 0,
    bld_smithies: 0,
    bld_mage_towers: 0,
    bld_shrines: 0,
    bld_outposts: 0,
    bld_training: 0,
    bld_mausoleums: 0,
  };

  let fighters = 0;
  let rangers = 50;
  let food = 5000;
  let thralls = 0;

  if (race === "human") buildings.bld_markets = 1;
  if (race === "dwarf") buildings.bld_smithies = 1;
  if (race === "high_elf") buildings.bld_mage_towers = 1;
  if (race === "dark_elf") buildings.bld_shrines = 1;
  if (race === "orc") buildings.bld_training = 1;
  if (race === "vampire") {
    buildings.bld_mausoleums = 1;
    buildings.bld_housing = 50;
    thralls = 50;
  }
  if (race === "dire_wolf") {
    buildings.bld_barracks = 2;
    fighters = 100;
    rangers = 100;
  }
  if (race === "wood_elf") {
    buildings.bld_outposts = 1;
    rangers = 100;
  }
  if (race === "ogre") {
    buildings.bld_training = 1;
    fighters = 100;
    rangers = 0;
  }

  const buildingKeys = {
    bld_farms: "farms",
    bld_schools: "schools",
    bld_barracks: "barracks",
    bld_armories: "armories",
    bld_housing: "housing",
    bld_markets: "markets",
    bld_smithies: "smithies",
    bld_mage_towers: "mage_towers",
    bld_shrines: "shrines",
    bld_outposts: "outposts",
    bld_training: "training",
    bld_mausoleums: "mausoleums",
  };

  let land = 1000;
  const landCosts = commandHandler.getConstants().BUILDING_LAND_COST || {};
  for (const [dbCol, configKey] of Object.entries(buildingKeys)) {
    const count = buildings[dbCol] || 0;
    const cost = landCosts[configKey] || 0;
    land += count * cost;
  }

  return { buildings, fighters, rangers, food, thralls, land };
}

const buildResetValues = (race) => {
  const buildings = {
    bld_farms: 10,
    bld_schools: 1,
    bld_barracks: 1,
    bld_armories: 1,
    bld_housing: 100,
    bld_markets: 0,
    bld_smithies: 0,
    bld_mage_towers: 0,
    bld_shrines: 0,
    bld_outposts: 0,
    bld_training: 0,
  };
  let fighters = 0,
    rangers = 50,
    food = 5000;

  if (race === "human") buildings.bld_markets = 1;
  if (race === "dwarf") buildings.bld_smithies = 1;
  if (race === "high_elf") buildings.bld_mage_towers = 1;
  if (race === "dark_elf") buildings.bld_shrines = 1;
  if (race === "orc") buildings.bld_training = 1;
  if (race === "dire_wolf") {
    buildings.bld_barracks = 2; // Extra barracks for wolf
    fighters = 100;
    rangers = 100;
  }

  // Land must cover what these starting buildings actually cost, same
  // formula as buildStartingProfile() above (base 1000 + real per-building
  // BUILDING_LAND_COST) — RESET_KINGDOM_SET previously hardcoded `land =
  // 504`, disconnected from the buildings it grants alongside it. For a
  // dwarf (bld_housing:100 alone costs 2500 land) that landed a fresh
  // reset kingdom at -2800ish land before the player did anything, which
  // silently blocked construction from turn 0.
  const landCosts = commandHandler.getConstants().BUILDING_LAND_COST || {};
  const resetBuildingKeys = {
    bld_farms: "farms",
    bld_schools: "schools",
    bld_barracks: "barracks",
    bld_armories: "armories",
    bld_housing: "housing",
    bld_markets: "markets",
    bld_smithies: "smithies",
    bld_mage_towers: "mage_towers",
    bld_shrines: "shrines",
    bld_outposts: "outposts",
    bld_training: "training",
  };
  let land = 1000;
  for (const [dbCol, configKey] of Object.entries(resetBuildingKeys)) {
    land += (buildings[dbCol] || 0) * (landCosts[configKey] || 0);
  }

  return [
    food,
    fighters,
    rangers,
    buildings.bld_farms,
    buildings.bld_barracks,
    buildings.bld_outposts,
    buildings.bld_schools,
    buildings.bld_armories,
    buildings.bld_smithies,
    buildings.bld_markets,
    buildings.bld_mage_towers,
    buildings.bld_training,
    buildings.bld_shrines,
    buildings.bld_housing,
    JSON.stringify(DEFAULT_VISIBILITY),
    land,
  ];
};

const RESET_KINGDOM_SET = `UPDATE kingdoms SET
    gold = 10000, mana = 0, land = $16, population = 50000, food = $1, happiness = 100,
    turn = 0, turns_stored = 400,
    fighters = $2, rangers = $3, clerics = 0, mages = 0, thieves = 0, ninjas = 0,
    researchers = 100, engineers = 100, scribes = 0,
    war_machines = 0, ballistae = 0, weapons_stockpile = 0, armor_stockpile = 0,
    bld_farms = $4, bld_barracks = $5, bld_outposts = $6, bld_guard_towers = 0,
    bld_schools = $7, bld_armories = $8, bld_vaults = 0, bld_smithies = $9,
    bld_markets = $10, bld_mage_towers = $11, bld_training = $12,
    bld_castles = 0, bld_shrines = $13, bld_libraries = 0, bld_taverns = 0, bld_housing = $14,
    bld_walls = 0, bld_granaries = 0, bld_mausoleums = 0,
    res_economy = 100, res_weapons = 100, res_armor = 100, res_military = 100,
    res_attack_magic = 100, res_defense_magic = 100, res_entertainment = 100,
    res_construction = 100, res_war_machines = 100, res_spellbook = 0,
    xp = 0, level = 1, xp_sources = '{}'::jsonb, troop_levels = '{}'::jsonb,
    research_allocation = '{}'::jsonb, build_allocation = '{}'::jsonb, build_queue = '{}'::jsonb,
    mage_tower_allocation = '{}'::jsonb, shrine_allocation = '{}'::jsonb, library_allocation = '{}'::jsonb,
    library_progress = '{}'::jsonb, tower_progress = '{}'::jsonb, scrolls = '{}'::jsonb, active_effects = '{}'::jsonb,
    world_fragments = '[]'::jsonb, collected_lore = '[]'::jsonb, collected_events = '[]'::jsonb,
    achievements = '[]'::jsonb, fortified_blueprints = 0, fortified_buildings = '{}'::jsonb,
    hybrid_blueprints = '{}'::jsonb, maps = 0, blueprints_stored = 0,
    scaffolding_stored = 0, hammers_stored = 0,
    certified_blueprints_stored = 0, prestige_level = 0,
    thralls = 0, last_event_at = 0, active_event = '{}'::jsonb,
    discovered_kingdoms = '{}'::jsonb, location_maps_wip = '[]'::jsonb,
    farm_upgrades = '{}'::jsonb, market_upgrades = '{}'::jsonb, tavern_upgrades = '{}'::jsonb,
    tower_upgrades = '{}'::jsonb, school_upgrades = '{}'::jsonb, shrine_upgrades = '{}'::jsonb, library_upgrades = '{}'::jsonb,
    wall_upgrades = '{}'::jsonb, tower_def_upgrades = '{}'::jsonb, outpost_upgrades = '{}'::jsonb,
    defense_upgrades = '{}'::jsonb, granary_upgrades = '{}'::jsonb, mausoleum_upgrades = '{}'::jsonb,
    food_shortage_turns = 0, food_surplus_turns = 0, mercenaries = '[]'::jsonb,
    wood = 0, stone = 0, iron = 0, coal = 0, steel = 0,
    bld_woodyard = 0, bld_lumber_camp = 0, bld_sawmill = 0,
    bld_gravel_pit = 0, bld_blockfield = 0, bld_stone_quarry = 0,
    bld_open_pit = 0, bld_strip_mine = 0, bld_deep_mine = 0,
    resource_sequence = '{}'::jsonb, ladders = 0, trade_routes = 0, active_trade_routes = '[]'::jsonb,
    milestones_claimed = '[]'::jsonb, milestone_bonuses = '{}'::jsonb, milestone_title = '',
    scout_allocation = 0, scout_progress = 0, visibility = $15`;

const resetKingdomLogic = async (db, kingdomId, race) => {
  await db.run(`${RESET_KINGDOM_SET} WHERE id = $17`, [
    ...buildResetValues(race),
    kingdomId,
  ]);

  // Clear all related tables and data
  await db.run("DELETE FROM expeditions WHERE kingdom_id = $1", [kingdomId]);
  await db.run("DELETE FROM news WHERE kingdom_id = $1", [kingdomId]);
  await db.run(
    "DELETE FROM war_log WHERE attacker_id = $1 OR defender_id = $2",
    [kingdomId, kingdomId],
  );
  await db.run("DELETE FROM heroes WHERE kingdom_id = $1", [kingdomId]);
  await db.run("DELETE FROM trade_routes WHERE kingdom_id = $1 OR partner_id = $2", [kingdomId, kingdomId]);
  await db.run("DELETE FROM bounties WHERE target_id = $1", [kingdomId]);
  await db.run("DELETE FROM spy_reports WHERE kingdom_id = $1 OR target_id = $2", [kingdomId, kingdomId]);
};

module.exports = {
  BCRYPT_SALT_ROUNDS,
  TEST_RACES,
  buildStartingProfile,
  buildResetValues,
  RESET_KINGDOM_SET,
  resetKingdomLogic,
};
