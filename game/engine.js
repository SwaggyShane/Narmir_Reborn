// src/game/engine.js
// Pure game logic ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â no I/O, no socket calls.
// All functions take a kingdom row (or rows) and return mutations + events.

const config = require("./config");

const fragmentBonusManager = require("./fragment-bonus-manager");
const { safeJsonParse, roll, rand, devLog } = require('../utils/helpers');

// Shared domain helpers extracted to game/lib. These are the canonical
// implementations; engine.js still re-exports them via module.exports so
// external callers (routes, sockets, tests) keep working.
const { raceBonus } = require('./lib/race-bonus');
const {
  getUnitName,
  troopXpForLevel,
  effectiveTroopLevel,
  awardTroopXp,
  unitLevelMult,
  racialUnitBonus,
  diluteTroopXp,
  awardUnitXp,
  getAvailableUnits,
} = require('./lib/troops');
const {
  clearSynergyCache,
} = require('./lib/synergy-cache');
const { addItemToInventory, initItemsArray } = require('./lib/items');
const { applyWarmachineDamage } = require('./lib/defense');

// Economy domain ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â gold/food/trade per-turn calculations, food economy
// settlement, resource yield, market and commodity pricing. Defined in
// game/economy.js; re-exported below.
const economy = require('./economy');
const {
  totalHiredUnits,
  goldPerTurn,
  foodBalance,
  farmProduction,
  foodConsumption,
  marketIncomeFull,
  tavernEntertainmentBonus,
  commodityPrice,
  processResourceYield,
  processFoodEconomy,
} = economy;

// Magic domain ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â castSpell, mage tower / shrine / mausoleum / library
// per-turn processing, and mana regeneration. Defined in game/magic.js;
// re-exported below.
const magic = require('./magic');
const {
  manaPerTurn,
  castSpell,
  processMageTower,
  processShrine,
  processMausoleum,
  processLibrary,
} = magic;

// Covert operations domain ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â spy, loot, assassinate, sabotage. Defined in
// game/covert.js; re-exported below.
const covert = require('./covert');
const {
  covertSpy,
  covertLoot,
  covertAssassinate,
  covertSabotage,
} = covert;

// Attunements domain ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â per-building fragment per-turn effects. Defined in
// game/attunements.js; re-exported below.
const attunementsMod = require('./attunements');
const {
  processGranaryAttunements,
  processVaultAttunements,
  processWallsAttunements,
  processGuardTowerAttunements,
  processOutpostAttunements,
  processTrainingAttunements,
  processBarracksAttunements,
  processCastleAttunements,
  processMausoleumAttunements,
  processLibraryAttunements,
  processMageTowerAttunements,
  processSchoolAttunements,
  processFarmAttunements,
  processSmithyAttunements,
  processMarketAttunements,
  processShrineAttunements,
  processTavernAttunements,
  processHousingAttunements,
} = attunementsMod;
// Heroes domain ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â hero recruitment, leveling, power calculation, and passive
// turn bonuses. Defined in game/heroes.js; re-exported below.
const heroesMod = require('./heroes');
const {
  heroXpForLevel,
  awardHeroXp,
  getHeroPower,
  applyHeroTurnBonuses,
  recruitHero,
} = heroesMod;

// Defense domain Ã¢â‚¬â€ wall/tower/outpost power, defense rating labels, and tier
// progression (Fortified/Keep/Citadel). Defined in game/defense.js; re-exported below.
const defenseMod = require('./defense');
const {
  defenseRating,
  wallDefensePower,
  towerDetectionPower,
  outpostRangerPower,
  checkDefenseTiers,
} = defenseMod;

// Engineers domain Ã¢â‚¬â€ XP/leveling, construction speed, and build time/cost
// calculations. Defined in game/engineers.js; re-exported below.
const engineersMod = require('./engineers');
const {
  engineerXpForLevel,
  engineerConstructionMult,
  calculateBuildTime,
  calculateBuildCost,
  awardEngineerXp,
} = engineersMod;

// XP and leveling domain â€” kingdom XP curve, level-from-XP search, milestone
// rewards, and per-activity XP awards. Defined in game/xp.js; re-exported below.
const xpMod = require('./xp');
const {
  xpForLevel,
  xpToNextLevel,
  levelFromXp,
  awardXp,
} = xpMod;

// Population domain â€” housing capacity, population growth, and research
// increment. Defined in game/population.js; re-exported below.
const populationMod = require('./population');
const {
  researchIncrement,
} = populationMod;

const {
  RACE_BONUSES,
  REGION_DATA,
  UNIT_COST,
  MAX_RESEARCH,
  RESEARCH_DISCIPLINE_CAPS,
  HOUSING_CAP_BY_RACE,
  TROOP_RACE_BONUS,
  WALL_STRENGTH_MULT,
  TOWER_DETECT_MULT,
  OUTPOST_RANGER_MULT,
  WALL_UPGRADES,
  TOWER_DEF_UPGRADES,
  OUTPOST_UPGRADES,
  DEFENSE_TIERS,
  SEASON_ORDER,
  SEASON_DURATION,
  SEASON_FARM_MULT,
  SEASON_ICONS,
  LOCATE_RACE_MULT,
  FARM_YIELD_MULT,
  FOOD_CONSUMPTION_MULT,
  MARKET_INCOME_MULT,
  TRADE_RATE_MULT,
  COMMODITY_VALUES,
  TOWER_UPGRADES,
  SCHOOL_UPGRADES,
  SHRINE_UPGRADES,
  MAUSOLEUM_UPGRADES,
  LIBRARY_UPGRADES,
  BANK_UPGRADES,
  FARM_UPGRADES,
  GRANARY_UPGRADES,
  MARKET_UPGRADES,
  TAVERN_UPGRADES,
  MERC_TIERS,
  BUILDING_COST,
  BUILDING_GOLD_COST,
  BUILDING_LAND_COST,
  SPELL_DEFS,
  MAGIC_SCHOOLS,
  SCROLL_REQUIREMENTS,
  SCRIBE_ITEMS,
  WM_CREW_REQUIRED,
  RESEARCH_MAP,
  BUILDING_ALIASES,
  WORLD_FRAGMENTS,
  JUNK_PRIZES,
  INVENTORY_ITEMS,
  ULTRA_RARE_PRIZES,
  THRONE_OF_NAZDREG,
  EXPEDITION_TURNS,
  BUILDING_COL,
  TOOL_COL,
  TOOL_GOLD_COST,
  BLUEPRINT_REQUIRED: BP_REQ,
  SCAFFOLDING_REQUIRED: SCAFF_REQ,
  SCAFFOLDING_BONUS_BUILDINGS: SCAFF_BONUS,
  HERO_CLASSES,
  TRADE_ROUTE_MAX,
  TRADE_ROUTE_ESTABLISH_COST,
  RESOURCE_BUILDING_CONFIG,
  _RESOURCE_STAGE1_COL,
  _RESOURCE_STAGE2_COL,
  _RESOURCE_STAGE3_COL,
  BUILDING_WOOD_COST,
  BUILDING_STONE_COST,
  BUILDING_IRON_COST,
} = config;

const BLUEPRINT_REQUIRED = new Set(BP_REQ);
const SCAFFOLDING_REQUIRED = new Set(SCAFF_REQ);
const SCAFFOLDING_BONUS_BUILDINGS = new Set(SCAFF_BONUS);


// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Helpers ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬


function assignRegion(race) {
  return race; // simple mapping for now: race name = region id
}


// Turn domain -- processTurn and all per-turn helpers (happiness, rebellion,
// mercenaries, level caps, build queue, active effects). Defined in
// game/turn.js; re-exported below via module.exports for backward compat.
const turnMod = require('./turn');
const {
  processTurn,
  processActiveEffects,
  processBuildQueue,
  checkAchievements,
  getCap,
  calculateHappiness,
  getHappinessRecoveryRate,
  recordHappinessHistory,
  logHappinessEvent,
  calcDiscoveryChance,
  processLocationMapsWip,
  processMercenaries,
  rebellionCheck,
  rebellionEvent,
} = turnMod;


// addItemToInventory + initItemsArray live in game/lib/items.js.
// processResourceYield lives in game/economy.js. All three are re-exported
// from engine.js via module.exports for backward compat.

/**
 * Process resource expeditions ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â called from processTurn.
 * Accepts current time (unixepoch seconds) to allow testability.
 * Returns { updates, expeditionEvents } ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â the caller merges updates.
 * This function does NOT do DB ops; it just returns what should change.
 * The actual DB writes happen in routes/kingdom.js via processResourceExpeditionsDb.
 */
function computeExpeditionTransitions(expeditions, now) {
  const transitions = [];
  for (const exp of expeditions) {
    if (exp.status === 'outbound' && now >= exp.arrive_at) {
      const harvestDuration = exp._harvestDuration || 3600; // fallback
      transitions.push({ id: exp.id, newStatus: 'harvesting', harvest_ends_at: now + harvestDuration, ...exp });
    } else if (exp.status === 'harvesting' && exp.harvest_ends_at && now >= exp.harvest_ends_at) {
      transitions.push({ id: exp.id, newStatus: 'returning', ...exp });
    } else if (exp.status === 'returning' && exp.return_at && now >= exp.return_at) {
      transitions.push({ id: exp.id, newStatus: 'completed', ...exp });
    }
  }
  return transitions;
}

// totalHiredUnits + the food/market/trade economy functions live in
// game/economy.js. They're re-exported from engine.js via module.exports
// for backward compat with routes/sockets that still call engine.foo(...).

function hireMercenaries(k, unitType, tier, count) {
  const tierDef = MERC_TIERS[tier];
  if (!tierDef) return { error: "Invalid tier" };
  const tavUpgrades = safeJsonParse(
    k.tavern_upgrades,
    {},
    "hireMercenaries:tavern_upgrades",
  );
  if (tierDef.requires && !tavUpgrades[tierDef.requires])
    return { error: `Requires ${tierDef.requires.replace("_", " ")} upgrade` };
  if (!(k.bld_taverns > 0)) return { error: "Need at least 1 tavern" };

  const level =
    tierDef.levelMin +
    Math.floor(Math.random() * (tierDef.levelMax - tierDef.levelMin + 1));
  const cost = tierDef.costPer * count;
  const upkeep = Math.ceil((cost * tierDef.upkeepPct) / tierDef.duration);
  if (k.gold < cost)
    return { error: `Need ${cost.toLocaleString()} gold` };

  const mercs = safeJsonParse(k.mercenaries, [], "hireMercenaries:mercenaries");
  mercs.push({
    unit_type: unitType,
    tier,
    level,
    count,
    hired_at_turn: k.turn,
    duration_turns: tierDef.duration,
    upkeep_per_turn: upkeep,
  });

  return {
    updates: {
      gold: k.gold - cost,
      [unitType]: (k[unitType] || 0) + count,
      mercenaries: JSON.stringify(mercs),
    },
    hired: {
      tier,
      level,
      count,
      unitType,
      duration: tierDef.duration,
      upkeep,
      cost,
    },
  };
}

function purchaseUpgrade(k, category, upgradeKey) {
  category = (category || "").toLowerCase();
  const defs = {
    farm: FARM_UPGRADES,
    granary: GRANARY_UPGRADES,
    market: MARKET_UPGRADES,
    tavern: TAVERN_UPGRADES,
    tower: TOWER_UPGRADES,
    school: SCHOOL_UPGRADES,
    shrine: SHRINE_UPGRADES,
    mausoleum: MAUSOLEUM_UPGRADES,
    library: LIBRARY_UPGRADES,
    wall: WALL_UPGRADES,
    tower_def: TOWER_DEF_UPGRADES,
    outpost: OUTPOST_UPGRADES,
    bank: BANK_UPGRADES,
  }[category];
  if (!defs) return { error: "Invalid category" };
  const def = defs[upgradeKey];
  if (!def) return { error: "Invalid upgrade" };
  const colName = `${category}_upgrades`;
  const upgrades = safeJsonParse(k[colName], {}, `purchaseUpgrade:${colName}`);
  if (upgrades[upgradeKey]) return { error: "Already purchased" };
  if (def.requires && !upgrades[def.requires])
    return { error: `Requires ${def.requires.replace(/_/g, " ")} first` };
  if (def.raceOnly && k.race !== def.raceOnly)
    return { error: `Only available to ${def.raceOnly.replace(/_/g, " ")}` };
  if (k.gold < def.cost)
    return { error: `Need ${def.cost.toLocaleString()} gold` };

  // Check resource costs
  const costWood = def.costWood || 0;
  const costStone = def.costStone || 0;
  const costIron = def.costIron || 0;

  const currentWood = k.wood || 0;
  const currentStone = k.stone || 0;
  const currentIron = k.iron || 0;

  const shortWood = Math.max(0, costWood - currentWood);
  const shortStone = Math.max(0, costStone - currentStone);
  const shortIron = Math.max(0, costIron - currentIron);

  const shortages = [];
  if (shortWood > 0) shortages.push(`${shortWood.toLocaleString()} more wood`);
  if (shortStone > 0) shortages.push(`${shortStone.toLocaleString()} more stone`);
  if (shortIron > 0) shortages.push(`${shortIron.toLocaleString()} more iron`);

  if (shortages.length > 0) {
    return { error: `Need ${shortages.join(", ")}` };
  }

  const bldCheck = {
    farm: "bld_farms",
    market: "bld_markets",
    tavern: "bld_taverns",
    tower: "bld_mage_towers",
    school: "bld_schools",
    shrine: "bld_shrines",
    mausoleum: "bld_mausoleums",
    library: "bld_libraries",
    bank: "bld_vaults",
    wall: "bld_walls",
    tower_def: "bld_guard_towers",
    outpost: "bld_outposts",
  };
  if (bldCheck[category] && !((k[bldCheck[category]] || 0) > 0))
    return { error: `Need at least 1 ${category}` };
  if (def.reqVaults && k.bld_vaults < def.reqVaults)
    return {
      error: `Need at least ${def.reqVaults} Vaults for this bank upgrade.`,
    };

  upgrades[upgradeKey] = true;
  return {
    updates: {
      gold: k.gold - def.cost,
      ...(costWood > 0 ? { wood: currentWood - costWood } : {}),
      ...(costStone > 0 ? { stone: currentStone - costStone } : {}),
      ...(costIron > 0 ? { iron: currentIron - costIron } : {}),
      [colName]: JSON.stringify(upgrades),
    },
  };
}


// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Hire units ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

function hireUnits(k, unit, amount) {
  const validUnits = [
    "fighters",
    "rangers",
    "clerics",
    "mages",
    "thieves",
    "ninjas",
    "researchers",
    "engineers",
    "scribes",
  ];
  if (!validUnits.includes(unit)) return { error: "Invalid unit type" };
  if (amount <= 0) return { error: "Amount must be positive" };

  // School cap ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â researchers need schools (100 per school)
  if (unit === "researchers") {
    const schoolCap = k.bld_schools * 100;
    const currentResearchers = k.researchers;
    if (schoolCap === 0)
      return { error: "You need at least 1 school to hire researchers" };
    if (currentResearchers >= schoolCap)
      return {
        error: `School capacity full ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â ${schoolCap.toLocaleString()} researchers max with ${k.bld_schools} school${k.bld_schools > 1 ? "s" : ""} (100 per school)`,
      };
    if (currentResearchers + amount > schoolCap)
      return {
        error: `Only room for ${(schoolCap - currentResearchers).toLocaleString()} more researchers ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â build more schools (100 per school)`,
      };
  }

  // Barracks cap ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â military troops need barracks (500 per barracks)
  const BARRACKS_TROOPS = [
    "fighters",
    "rangers",
    "clerics",
    "thieves",
    "ninjas",
  ];
  if (BARRACKS_TROOPS.includes(unit)) {
    const barracksCapacityMult = fragmentBonusManager.getBonusMultiplier(k, 'barracks', 'capacity');
    const barracksCap = Math.floor(k.bld_barracks * 500 * barracksCapacityMult);
    const currentTroops = BARRACKS_TROOPS.reduce((s, u) => s + (k[u] || 0), 0);
    if (barracksCap === 0)
      return { error: "You need at least 1 barracks to hire troops" };
    if (currentTroops >= barracksCap)
      return {
        error: `Barracks full ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â ${barracksCap.toLocaleString()} troops max with ${k.bld_barracks} barracks (500 per barracks)`,
      };
    if (currentTroops + amount > barracksCap)
      return {
        error: `Only room for ${(barracksCap - currentTroops).toLocaleString()} more troops ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â build more barracks (500 per barracks)`,
      };
  }

  // Level cap check (researchers, engineers, scribes have no level cap)
  if (!["researchers", "engineers", "scribes"].includes(unit)) {
    let cap = getCap(unit, k.level || 1);
    // Orc: Unit capacity -50% rangers
    if (k.race === "orc" && unit === "rangers") {
      cap = Math.floor(cap * 0.5);
    }
    const current = k[unit] || 0;
    if (current >= cap)
      return {
        error: `Level ${k.level || 1} cap reached for ${unit} (max ${cap.toLocaleString()}) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â gain levels to increase`,
      };
    if (current + amount > cap)
      return {
        error: `Level ${k.level || 1} cap: can only hire ${(cap - current).toLocaleString()} more ${unit} (max ${cap.toLocaleString()})`,
      };
  }

  const cost = amount * UNIT_COST;
  if (k.gold < cost)
    return { error: `Not enough gold ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â need ${cost.toLocaleString()} gold` };
  if (amount > k.population)
    return { error: "Not enough population available" };

  // Dilute unit XP pool when new recruits join ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â new troops lower the average
  const dilutedLevels = diluteTroopXp(k, unit, amount);

  return {
    updates: {
      gold: k.gold - cost,
      population: k.population - amount,
      [unit]: (k[unit] || 0) + amount,
      ...(dilutedLevels ? { troop_levels: dilutedLevels } : {}),
      updated_at: Math.floor(Date.now() / 1000),
    },
  };
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Research ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

function studyDiscipline(k, discipline, researchersAssigned) {
  const col = RESEARCH_MAP[discipline];
  if (!col) return { error: "Unknown discipline" };
  if (researchersAssigned > k.researchers)
    return { error: "Not enough researchers" };

  const currentLevel = k[col] || 100;
  const increment = researchIncrement(
    k,
    discipline,
    researchersAssigned,
    currentLevel,
  );
  if (increment === 0)
    return { error: "Need more researchers for any progress" };

  let cap = MAX_RESEARCH;
  if (discipline === "spellbook" || discipline === "school_spellbook") {
    cap = Infinity;
  } else {
    // Apply race-specific hard cap for this discipline (if any)
    const raceCaps = RESEARCH_DISCIPLINE_CAPS[k.race] || {};
    cap = raceCaps[discipline] || MAX_RESEARCH;
  }
  const newVal = Math.min(cap, k[col] + increment);

  return {
    updates: { [col]: newVal, updated_at: Math.floor(Date.now() / 1000) },
    increment,
  };
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Magic Schools ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

// Select a school of magic (one-time choice when res_spellbook >= 100)
function _selectSchool(k, schoolName) {
  // Validate school name
  if (!MAGIC_SCHOOLS[schoolName]) {
    return { error: `Unknown school: ${schoolName}` };
  }

  // Can only choose if: school_of_magic is null AND res_spellbook >= 100
  if (k.school_of_magic) {
    return { error: `You have already chosen the school of ${k.school_of_magic}` };
  }

  if (k.res_spellbook < 100) {
    return { error: `You must reach spellbook research level 100 to choose a school` };
  }

  // Set school choice
  const schoolLabel = schoolName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return {
    updates: { school_of_magic: schoolName, school_spellbook: 0 },
    events: [{ type: 'system', message: `ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â® You have chosen the school of ${schoolLabel}. You can now research school-specific spells!` }]
  };
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Experience & Levelling ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

// XP required to reach each level (cumulative from level 1).
// Single smooth quadratic: 10*(level-1)^2
// Level 500 = 2,490,010 XP ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â a dedicated player taking all turns (~403/day) hits
// this in ~124 days at 50 XP/turn base.

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Construction ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

// Add buildings to the queue ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â charges gold, no turn cost
function queueBuildings(k, orders) {
  const queue = safeJsonParse(k.build_queue, {}, "queueBuildings:build_queue");

  let totalCost = 0;
  let totalLand = 0;
  const processedOrders = {};

  for (const [building, qty] of Object.entries(orders)) {
    // Normalize building name (e.g., 'library' -> 'libraries')
    const key = BUILDING_ALIASES[building] || building;
    if (!BUILDING_COST[key]) {
      console.warn(
        `[queueBuildings] Unknown building type: ${building} (normalized to ${key})`,
      );
      continue;
    }
    const n = Math.max(0, Number(qty));
    if (n <= 0) continue;

    // Check Cap
    const col = BUILDING_COL[key];
    const currentBuilt = k[col] || 0;
    const currentQueued = queue[key] || 0;
    const cap = getCap(col, k.level || 1);

    if (currentBuilt + currentQueued + n > cap) {
      if (currentBuilt + currentQueued >= cap) {
        return {
          error: `${key.replace(/_/g, " ")} cap reached (max ${cap.toLocaleString()}).`,
        };
      }
      return {
        error: `Cannot queue ${n} more ${key.replace(/_/g, " ")}. Only room for ${cap - currentBuilt - currentQueued}.`,
      };
    }

    const goldPerUnit = BUILDING_GOLD_COST[key] ?? 100;
    const landPerUnit = BUILDING_LAND_COST[key] || 0;
    totalCost += goldPerUnit * n;
    totalLand += landPerUnit * n;
    processedOrders[key] = n;
  }

  let usedLand = 0;
  const landBreakdown = {};
  for (const [key, cost] of Object.entries(BUILDING_LAND_COST)) {
    const col = BUILDING_COL[key];
    const builtCost = (col && k[col]) ? (k[col] || 0) * cost : 0;
    const queuedCost = (queue[key] || 0) * cost;
    const buildingLandCost = builtCost + queuedCost;
    if (buildingLandCost > 0) {
      landBreakdown[key] = { built: k[col] || 0, queued: queue[key] || 0, cost, total: buildingLandCost };
    }
    if (col) usedLand += builtCost;
    usedLand += queuedCost;
  }
  const freeLand = Math.max(0, k.land - usedLand);

  if (totalLand > 0) {
    devLog(`[queueBuildings] Land calculation for ${k.name}: total=${k.land}, used=${usedLand}, free=${freeLand}, requesting=${totalLand}`);
    if (Object.keys(landBreakdown).length > 0) {
      devLog('[queueBuildings] Breakdown:', JSON.stringify(landBreakdown, null, 2));
    }
  }

  if (totalCost > k.gold) {
    return {
      error: `Need ${totalCost.toLocaleString()} gold but only have ${k.gold.toLocaleString()} gold`,
    };
  }

  if (totalLand > freeLand) {
    return {
      error: `Need ${totalLand.toLocaleString()} land but only have ${freeLand.toLocaleString()} free land`,
    };
  }

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Resource building bracket-lock validation + resource cost ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  const level = k.level || 1;
  const resSeqRaw = safeJsonParse(k.resource_sequence, {}, 'queueBuildings:resource_sequence');
  let totalWoodCost = 0;
  let totalStoneCost = 0;
  let totalIronCost = 0;

  for (const [key, n] of Object.entries(processedOrders)) {
    const rbCfg = RESOURCE_BUILDING_CONFIG[key];
    if (!rbCfg) continue; // Not a resource building

    // Enforce one-slot-per-resource-type: reject if any building of this type is already queued
    for (const [qKey, qCount] of Object.entries(queue)) {
      if (qCount <= 0) continue;
      const qRbCfg = RESOURCE_BUILDING_CONFIG[qKey];
      if (qRbCfg && qRbCfg.type === rbCfg.type) {
        return { error: `A ${rbCfg.type} building (${qKey.replace(/_/g, ' ')}) is already in progress. Only one ${rbCfg.type} build slot is allowed at a time.` };
      }
    }

    const seq = resSeqRaw[rbCfg.type] || { s2_paid_at_bracket: -1, s3_paid_at_bracket: -1, last_s3_bracket: -1 };
    const s3Col = config.RESOURCE_STAGE3_COL[rbCfg.type];
    const s3Cap = Math.floor((level - 1) / 10) + 1;
    const s3Current = k[s3Col] || 0;

    const s1Col = config.RESOURCE_STAGE1_COL[rbCfg.type];
    const s2Col = config.RESOURCE_STAGE2_COL[rbCfg.type];

    if (rbCfg.stage === 1) {
      if (s3Current >= s3Cap) {
        return { error: `${key.replace(/_/g, ' ')} is locked ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â you have reached the maximum number of stage-3 ${rbCfg.type} buildings (${s3Cap}) for your level.` };
      }
      // Stage 1 hard cap of 3
      const s1Current = k[s1Col] || 0;
      if (s1Current + n > 3) {
        return { error: `${key.replace(/_/g, ' ')} cap reached (max 3).` };
      }
      const s2Current = (k[s2Col] || 0) + (queue[config.RESOURCE_STAGE2_BUILDINGS[rbCfg.type]] || 0);
      if (s2Current > 0) {
        return { error: `${key.replace(/_/g, ' ')} is locked ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â you already have Stage 2 ${rbCfg.type} buildings in progress or built.` };
      }
    } else if (rbCfg.stage === 2) {
      if (s3Current >= s3Cap) {
        return { error: `${key.replace(/_/g, ' ')} is locked ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â you have reached the maximum number of stage-3 ${rbCfg.type} buildings (${s3Cap}) for your level.` };
      }
      if (seq.s2_paid_at_bracket <= -1) {
        return { error: `You must purchase the Stage 2 ${rbCfg.type} upgrade before building ${key.replace(/_/g, ' ')}.` };
      }
      const s2Built = k[s2Col] || 0;
      const s2Queued = queue[config.RESOURCE_STAGE2_BUILDINGS[rbCfg.type]] || 0;
      const s1Current = k[s1Col] || 0;
      // If none built or queued, need 3 stage 1s to start
      if (s2Built + s2Queued === 0 && s1Current < 3) {
         return { error: `You need 3 ${s1Col.replace('bld_', '').replace(/_/g, ' ')} built to start building ${key.replace(/_/g, ' ')}.` };
      }
      // Stage 2 hard cap of 5
      if (s2Built + s2Queued + n > 5) {
        return { error: `${key.replace(/_/g, ' ')} cap reached (max 5).` };
      }
    } else if (rbCfg.stage === 3) {
      if (seq.s3_paid_at_bracket <= -1) {
        return { error: `You must purchase the Stage 3 ${rbCfg.type} upgrade before building ${key.replace(/_/g, ' ')}.` };
      }
      const s3Built = k[s3Col] || 0;
      const s3Queued = queue[config.RESOURCE_STAGE3_BUILDINGS[rbCfg.type]] || 0;
      const s2Current = k[s2Col] || 0;
      // If none built or queued, need 5 stage 2s to start
      if (s3Built + s3Queued === 0 && s2Current < 5) {
         return { error: `You need 5 ${s2Col.replace('bld_', '').replace(/_/g, ' ')} built to start building ${key.replace(/_/g, ' ')}.` };
      }
      // Check s3 cap (bracket + 1 total allowed)
      if (s3Current + n > s3Cap) {
        return { error: `${key.replace(/_/g, ' ')} cap reached for your level (max ${s3Cap}).` };
      }
    }

    // Tally resource costs
    totalWoodCost += (BUILDING_WOOD_COST[key] || 0) * n;
    totalStoneCost += (BUILDING_STONE_COST[key] || 0) * n;
    totalIronCost += (BUILDING_IRON_COST[key] || 0) * n;
  }

  // Check resource stockpile sufficiency
  if (totalWoodCost > 0 && k.wood < totalWoodCost) {
    return { error: `Need ${totalWoodCost.toLocaleString()} wood but only have ${k.wood.toLocaleString()}.` };
  }
  if (totalStoneCost > 0 && k.stone < totalStoneCost) {
    return { error: `Need ${totalStoneCost.toLocaleString()} stone but only have ${k.stone.toLocaleString()}.` };
  }
  if (totalIronCost > 0 && k.iron < totalIronCost) {
    return { error: `Need ${totalIronCost.toLocaleString()} iron but only have ${k.iron.toLocaleString()}.` };
  }

  for (const [key, n] of Object.entries(processedOrders)) {
    queue[key] = (queue[key] || 0) + n;
  }

  const queueUpdates = {
    build_queue: JSON.stringify(queue),
    gold: k.gold - totalCost,
  };
  if (totalWoodCost > 0)  queueUpdates.wood  = Math.max(0, k.wood - totalWoodCost);
  if (totalStoneCost > 0) queueUpdates.stone = Math.max(0, k.stone - totalStoneCost);
  if (totalIronCost > 0)  queueUpdates.iron  = Math.max(0, k.iron - totalIronCost);

  return {
    updates: queueUpdates,
    totalCost,
    totalLand,
  };
}

// Process build queue each turn ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â engineers work on allocated buildings continuously

// Forge construction tools ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â costs gold, no engineer requirement
function forgeTools(k, toolType, quantity) {
  const cost = TOOL_GOLD_COST[toolType];
  const col = TOOL_COL[toolType];
  if (!cost || !col) return { error: "Unknown tool type" };
  const totalCost = cost * quantity;
  if (totalCost > k.gold)
    return {
      error: `Need ${totalCost.toLocaleString()} gold but only have ${k.gold.toLocaleString()} gold`,
    };
  return {
    updates: {
      [col]: (k[col] || 0) + quantity,
      gold: k.gold - totalCost,
      updated_at: Math.floor(Date.now() / 1000),
    },
    totalCost,
  };
}


// Combat helpers domain - isNight, happinessCombatMult, wmCrewRequired.
// Defined in game/combat-helpers.js; re-exported below.
const combatHelpers = require('./combat-helpers');
const { happinessCombatMult, wmCrewRequired } = combatHelpers;

// Combat domain - resolveMilitaryAttack (full battle resolver),
// resolveMilitaryAttackV2Adapter (v2 adapter), formatCombatV2NewsBlurb,
// moraleMult, and formatting helpers. Defined in game/combat.js; re-exported below.
const combatMod = require('./combat');
const {
  moraleMult,
  formatCombatV2NewsBlurb,
  resolveMilitaryAttack,
} = combatMod;

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Orc Trade Route Raiding ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
function raidTradeRoute(attacker, defender, unitCount) {
  if (attacker.race !== "orc")
    return { error: "Only Orcs can raid trade routes" };
  const currentAttackerThieves = attacker.thieves || 0;
  if (currentAttackerThieves < 500)
    return { error: "Need at least 500 thieves to raid trade routes" };
  const defenderTradeRoutes = defender.trade_routes || 0;
  if (defenderTradeRoutes < 1)
    return { error: "Target has no trade routes to raid" };

  const atkLvl = unitLevelMult(attacker, "thieves");
  const defLvl = unitLevelMult(defender, "thieves");
  const successChance = 0.4 + (atkLvl - defLvl) * 0.2;
  const roll = Math.random();

  if (roll < successChance) {
    const raided = Math.min(defenderTradeRoutes, Math.floor(unitCount / 500));
    const loot = raided * 5000;
    const losses = Math.floor(unitCount * 0.05);

    return {
      success: true,
      looted: loot,
      raidedRoutes: raided,
      attackerUpdates: {
        gold: (attacker.gold || 0) + loot,
        thieves: Math.max(0, (attacker.thieves || 0) - losses),
      },
      defenderUpdates: {
        trade_routes: Math.max(0, (defender.trade_routes || 0) - raided),
      },
      atkEvent: `ÃƒÂ°Ã…Â¸Ã‚ÂÃ‚Â´ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã‹Å“Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â SUCCESS: You raided ${raided} trade routes of ${defender.name} and looted ${loot.toLocaleString()} gold! (Losses: ${losses} thieves)`,
      defEvent: `ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂºÃ‚Â¶ RAIDED: ${attacker.name}'s Orcs raided your trade routes! You lost ${raided} routes and ${loot.toLocaleString()} gold was stolen!`,
    };
  } else {
    const losses = Math.floor(unitCount * 0.15);
    return {
      success: false,
      attackerUpdates: {
        thieves: Math.max(0, (attacker.thieves || 0) - losses),
      },
      atkEvent: `ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã¢â€šÂ¬ FAILURE: Your raid on ${defender.name}'s trade routes failed. You lost ${losses} thieves in the ambush.`,
      defEvent: `ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂºÃ‚Â¡ÃƒÂ¯Ã‚Â¸Ã‚Â Your guards repelled an Orc raid from ${attacker.name} on your trade routes!`,
    };
  }
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Prestige System ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
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


// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Alliance pledge defense ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

function resolveAllianceDefense(attackResult, allies) {
  // When a kingdom is attacked, allied kingdoms send pledge % of their fighters
  if (!attackResult.win) return [];
  return allies.map((ally) => {
    const sent = Math.floor(ally.fighters * (ally.pledge / 100));
    return { allyId: ally.id, sent };
  });
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Expedition rewards ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

function junkPrize(k, updates) {
  if (!JUNK_PRIZES || JUNK_PRIZES.length === 0)
    return "a particularly shiny pebble";
  const eventsCollected = safeJsonParse(
    updates.collected_events || k.collected_events,
    [],
    "junkPrize",
  );
  const lastId = updates.last_event_id || k.last_event_id;

  let available = JUNK_PRIZES.filter((p) => p.id !== lastId);
  if (available.length === 0) available = JUNK_PRIZES;
  const ev = available[Math.floor(Math.random() * available.length)];

  if (ev) {
    if (!eventsCollected.includes(ev.id)) {
      eventsCollected.push(ev.id);
      updates.collected_events = JSON.stringify(eventsCollected);

      if (eventsCollected.length >= 50) {
        updates._collector_unlocked = true;
      }
    }
    updates.last_event_id = ev.id;

    // Add item to inventory
    let inventory = safeJsonParse(updates.items || k.items, [], "junkPrize:items");
    if (!Array.isArray(inventory)) inventory = [];

    const existingItem = inventory.find((i) => i.id === ev.id);
    if (existingItem) {
      existingItem.qty = (existingItem.qty || 0) + 1;
    } else {
      // Get item name from INVENTORY_ITEMS if available
      const itemDef = INVENTORY_ITEMS?.[ev.id];
      inventory.push({ id: ev.id, name: itemDef?.name || ev.id, qty: 1 });
    }
    updates.items = JSON.stringify(inventory);

    // Check for 100 suspicious rocks achievement (only trigger once)
    if (ev.id === "suspicious_rock") {
      const rockCount = (existingItem?.qty || 0) + 1;
      if (rockCount >= 100) {
        let achievements = safeJsonParse(updates.achievements || k.achievements, [], "junkPrize:achievements");
        if (!achievements.includes("suspicious_rocks_100")) {
          achievements.push("suspicious_rocks_100");
          updates.achievements = JSON.stringify(achievements);
          updates.stone = (updates.stone ?? k.stone ?? 0) + 1000;
          updates._suspicious_rocks_achievement = true;
        }
      }
    }

    return ev.msg || ev.content || "a mysterious rock";
  }
  return "a strange pebble";
}

function expeditionRewards(type, rangers, fighters, k) {
  const tacBonus = 1 + k.res_military / 2000;

  // Race exploration bonus ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â affects all reward quantities
  const exploreBonus =
    {
      dire_wolf: 1.4,
      dark_elf: 1.25,
      human: 1.1,
      orc: 1.05,
      dwarf: 0.9,
      high_elf: 0.95,
    }[k.race] || 1.0;

  // Ranger level bonus ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â higher level rangers are better scouts
  const rangerLvBonus = unitLevelMult(k, "rangers");

  // Attrition reduced for skilled explorer races
  const attritionMult = { dire_wolf: 0.5, dark_elf: 0.6 }[k.race] || 1.0;
  const rewards = [];
  const events = [];
  const updates = {};

  // Attrition ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â skilled explorer races lose fewer rangers
  const attritionPct = type === "dungeon" ? rand(0, 3) : rand(0, 2);
  const lost = Math.floor(((rangers * attritionPct) / 100) * attritionMult);
  const returned = rangers - lost;
  if (lost > 0)
    rewards.push({
      text: `${lost} ranger${lost > 1 ? "s" : ""} did not return from the expedition`,
    });
  // Rangers returned stored separately so resolveExpeditions can use SQL increment
  updates._rangers_returned = returned;

  const expTurns = EXPEDITION_TURNS[type] || 10;

  // Gold base = forage rate (rangers ÃƒÆ’Ã¢â‚¬â€ 12 ÃƒÆ’Ã¢â‚¬â€ tacBonus) ÃƒÆ’Ã¢â‚¬â€ turns ÃƒÆ’Ã¢â‚¬â€ race bonus ÃƒÆ’Ã¢â‚¬â€ random 5ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“30% bonus
  const foragePerTurn = rangers * 2 * tacBonus * exploreBonus * rangerLvBonus;
  const randomBonus = 1 + rand(5, 30) / 100;
  const goldBase = Math.floor(foragePerTurn * expTurns * randomBonus);

  if (type === "scout") {
    rewards.push({ text: `+${goldBase.toLocaleString()} gold from foraging` });
    updates.gold = k.gold + goldBase;

    // Resource Yield: Wood
    const rollWood = Math.random() * 100;
    let woodGained = 0;
    if (rollWood < 0.5) {
      woodGained = 25;
    } else if (rollWood < 5.5) {
      woodGained = 5;
    } else if (rollWood < 30.5) {
      woodGained = 2;
    } else if (rollWood < 80.5) {
      woodGained = 1;
    }

    if (woodGained > 0) {
      updates.wood = (updates.wood !== undefined ? updates.wood : k.wood || 0) + woodGained;
      rewards.push({ text: `ÃƒÂ°Ã…Â¸Ã‚ÂªÃ‚Âµ +${woodGained} wood discovered` });
    }

    const land = Math.max(
      1,
      Math.floor(rand(rangers * 0.01, rangers * 0.03) * exploreBonus),
    );
    rewards.push({
      text: `+${land} acre${land > 1 ? "s" : ""} of unclaimed land`,
    });
    updates.land = k.land + land;

    if (roll(0.3)) {
      const mana = rand(
        Math.floor(rangers * 0.2 * exploreBonus),
        Math.floor(rangers * 0.8 * exploreBonus),
      );
      rewards.push({ text: `+${mana} mana from a hidden shrine` });
      updates.mana = k.mana + mana;
    }
    if (roll(0.1)) {
      const troops = rand(
        2,
        Math.max(3, Math.floor(rangers * 0.02 * exploreBonus)),
      );
      if (k.race === "vampire") {
        rewards.push({
          text: `Your troops captured ${troops} wandering souls and bound them as Thralls`,
        });
        updates.clerics = k.clerics + troops;
      } else {
        rewards.push({
          text: `${troops} wandering fighter${troops > 1 ? "s" : ""} pledge allegiance to your kingdom`,
        });
        updates.fighters = k.fighters + troops;
      }
    }
    if (roll(0.03)) {
      const bonus = rand(
        Math.floor(rangers * 0.03 * exploreBonus),
        Math.floor(rangers * 0.08 * exploreBonus),
      );
      rewards.push({
        text: `An ancient map reveals ${bonus} additional acres ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â scouts claim them!`,
      });
      updates.land = (updates.land || k.land) + bonus;
    }
    if (roll(0.45))
      rewards.push({
        text: `Your rangers also found ${junkPrize(k, updates)}`,
      });

    // Map drop ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 5% chance on scout
    if (roll(0.05)) {
      updates.maps = k.maps + 1;
      rewards.push({
        text: `ÃƒÂ°Ã…Â¸Ã¢â‚¬â€Ã‚ÂºÃƒÂ¯Ã‚Â¸Ã‚Â A map was found ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â you can now interact with other kingdoms`,
      });
    }

    // DISCOVERY: Chance to find another kingdom
    if (roll(calcDiscoveryChance(k))) {
      updates._find_kingdom = true;
    }
  } else if (type === "deep") {
    rewards.push({
      text: `+${goldBase.toLocaleString()} gold from deep wilderness caches`,
    });
    updates.gold = k.gold + goldBase;

    // Resource Yield: Wood and Stone
    const rollDeep = Math.random() * 100;
    let deepWood = 0;
    let deepStone = 0;
    if (rollDeep < 0.5) {
      deepWood = 25;
      deepStone = 25;
    } else if (rollDeep < 5.5) {
      deepWood = 5;
      deepStone = 5;
    } else if (rollDeep < 30.5) {
      deepWood = 2;
      deepStone = 2;
    } else if (rollDeep < 80.5) {
      deepWood = 1;
      deepStone = 1;
    }

    if (deepWood > 0) {
      updates.wood = (updates.wood !== undefined ? updates.wood : k.wood || 0) + deepWood;
      updates.stone = (updates.stone !== undefined ? updates.stone : k.stone || 0) + deepStone;
      rewards.push({ text: `ÃƒÂ°Ã…Â¸Ã‚ÂªÃ‚Âµ +${deepWood} wood and ÃƒÂ°Ã…Â¸Ã‚ÂªÃ‚Â¨ +${deepStone} stone unearthed` });
    }

    const land = Math.max(
      2,
      Math.floor(rand(rangers * 0.04, rangers * 0.1) * exploreBonus),
    );
    rewards.push({ text: `+${land} acres of fertile territory` });
    updates.land = k.land + land;

    if (roll(0.55)) {
      const mana = rand(
        Math.floor(rangers * 0.5 * exploreBonus),
        Math.floor(rangers * 2 * exploreBonus),
      );
      rewards.push({
        text: `+${mana} mana from ley lines discovered deep in the wilderness`,
      });
      updates.mana = k.mana + mana;
    }
    if (roll(0.25)) {
      const disc = [
        "res_economy",
        "res_weapons",
        "res_armor",
        "res_military",
        "res_entertainment",
      ][rand(0, 4)];
      const boost = rand(1, Math.max(2, Math.floor(5 * exploreBonus)));
      const discLabel = disc.replace("res_", "").replace("_", " ");
      rewards.push({
        text: `A research scroll found ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â ${discLabel} +${boost}%`,
      });
      updates[disc] = (k[disc] || 0) + boost;
    }
    if (roll(0.2)) {
      const troops = rand(
        Math.floor(rangers * 0.03 * exploreBonus),
        Math.floor(rangers * 0.08 * exploreBonus),
      );
      const ttype = roll(0.5) ? "fighters" : "rangers";
      if (troops > 0) {
        if (k.race === "vampire") {
          rewards.push({
            text: `${troops} mercenaries were subdued and turned into Thralls`,
          });
          updates.clerics = k.clerics + troops;
        } else {
          rewards.push({
            text: `${troops} mercenary ${ttype} join your cause`,
          });
          updates[ttype] = (k[ttype] || 0) + troops;
        }
      }
    }
    if (roll(0.08)) {
      const bonus = rand(
        Math.floor(rangers * 0.05 * exploreBonus),
        Math.floor(rangers * 0.15 * exploreBonus),
      );
      rewards.push({
        text: `Ruins of an abandoned kingdom found ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â you claim ${bonus} acres of its former territory`,
      });
      updates.land = (updates.land || k.land) + bonus;
    }
    if (roll(0.02)) {
      const disc = [
        "res_spellbook",
        "res_attack_magic",
        "res_defense_magic",
        "res_war_machines",
        "res_construction",
      ][rand(0, 4)];
      const boost = rand(
        Math.floor(5 * exploreBonus),
        Math.floor(15 * exploreBonus),
      );
      const discLabel = disc.replace("res_", "").replace("_", " ");
      rewards.push({
        text: `ÃƒÂ¢Ã…Â¡Ã‚Â¡ An ancient artifact of ${discLabel} ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â permanent +${boost}%`,
      });
      updates[disc] = (k[disc] || 0) + boost;
    }

    if (roll(calcDiscoveryChance(k))) {
      updates._find_kingdom = true;
    }
    if (roll(0.6))
      rewards.push({
        text: `Hidden deep in the wilderness, your rangers also discovered ${junkPrize(k, updates)}`,
      });

    // Map drop ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 15% chance on deep
    if (roll(0.15)) {
      updates.maps = (updates.maps || k.maps) + 1;
      rewards.push({ text: `ÃƒÂ°Ã…Â¸Ã¢â‚¬â€Ã‚ÂºÃƒÂ¯Ã‚Â¸Ã‚Â A map was discovered in the deep wilderness` });
    }

    if (roll(0.05)) {
      updates._find_world_fragment = true;
    }
  } else if (type === "dungeon") {
    const power = (rangers + fighters * 2) * tacBonus * exploreBonus;
    const successChance = Math.min(0.9, 0.25 + power / 24000);
    const success = roll(successChance);

    if (!success) {
      const fLost = Math.min(
        fighters,
        rand(Math.floor(fighters * 0.05), Math.floor(fighters * 0.15)),
      );
      const fReturned = fighters - fLost;
      if (fReturned > 0) updates._fighters_returned = fReturned;
      rewards.push({
        text: `The dungeon proved too dangerous ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â ${fLost} fighters lost in retreat`,
      });
      events.push({
        type: "attack",
        message: `ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã¢â€šÂ¬ Dungeon raid FAILED ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â your forces were overwhelmed. ${fLost.toLocaleString()} fighters lost.`,
      });
    } else {
      updates._fighters_returned = fighters;

      const dungeonMult =
        { orc: 2.0, dire_wolf: 1.5, high_elf: 0.5 }[k.race] || 1.0;

      const dungeonGold = Math.floor(
        fighters *
          rand(8, 12) *
          tacBonus *
          exploreBonus *
          randomBonus *
          dungeonMult,
      );
      rewards.push({
        text: `+${dungeonGold.toLocaleString()} gold plundered from the dungeon`,
      });
      updates.gold = k.gold + dungeonGold;

      // Resource Yield: Iron only (on success)
      const rollDungeon = Math.random() * 100;
      let ironGained = 0;
      if (rollDungeon < 0.5) {
        ironGained = 150;
      } else if (rollDungeon < 5.5) {
        ironGained = 50;
      } else if (rollDungeon < 30.5) {
        ironGained = 10;
      } else if (rollDungeon < 80.5) {
        ironGained = 2;
      }

      if (ironGained > 0) {
        updates.iron = (updates.iron !== undefined ? updates.iron : k.iron || 0) + ironGained;
        rewards.push({ text: `ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬â€ +${ironGained} iron plundered` });
      }

      const mana = Math.floor(
        rand(
          Math.floor(rangers * 1 * exploreBonus),
          Math.floor(rangers * 4 * exploreBonus),
        ) * dungeonMult,
      );
      rewards.push({ text: `+${mana} mana from dungeon ley stones` });
      updates.mana = k.mana + mana;

      const disc = [
        "res_weapons",
        "res_armor",
        "res_military",
        "res_attack_magic",
        "res_spellbook",
      ][rand(0, 4)];
      const boost = Math.floor(
        rand(3, Math.floor(12 * exploreBonus)) * dungeonMult,
      );
      const discLabel = disc.replace("res_", "").replace("_", " ");
      rewards.push({
        text: `Dungeon tome found ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â ${discLabel} permanently +${boost}%`,
      });
      updates[disc] = (k[disc] || 0) + boost;

      if (roll(0.12)) {
        const wm = Math.max(
          1,
          Math.floor(
            rand(1, Math.max(2, Math.floor((fighters / 500) * exploreBonus))) *
              dungeonMult,
          ),
        );
        rewards.push({
          text: `ÃƒÂ¢Ã…Â¡Ã‚Â¡ Ancient war machine${wm > 1 ? "s" : ""} recovered from the dungeon depths ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â +${wm}`,
        });
        updates.war_machines = k.war_machines + wm;
      }
      if (roll(0.06)) {
        const boost2 = Math.floor(
          rand(10, Math.floor(40 * exploreBonus)) * dungeonMult,
        );
        rewards.push({
          text: `ÃƒÂ¢Ã…Â¡Ã‚Â¡ The dungeon's heart pulsed with ancient magic ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â spellbook permanently +${boost2}`,
        });
        updates.res_spellbook =
          (updates.res_spellbook || k.res_spellbook) + boost2;
      }
      if (roll(0.5))
        rewards.push({
          text: `Amid the carnage, someone pocketed ${junkPrize(k, updates)}`,
        });

      // Map drop ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 25% chance on dungeon
      if (roll(0.25)) {
        updates.maps = (updates.maps || k.maps) + 1;
        rewards.push({ text: `ÃƒÂ°Ã…Â¸Ã¢â‚¬â€Ã‚ÂºÃƒÂ¯Ã‚Â¸Ã‚Â A map was found among the dungeon spoils` });
      }
      // Blueprint drop ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 20% chance on dungeon
      if (roll(0.2)) {
        const smithyCap = k.bld_smithies * 25;
        const curBP =
          updates.blueprints_stored !== undefined
            ? updates.blueprints_stored
            : k.blueprints_stored;
        if (smithyCap === 0 || curBP < smithyCap) {
          updates.blueprints_stored = curBP + 1;
          rewards.push({
            text: `ÃƒÂ¢Ã…Â¡Ã¢â€žÂ¢ÃƒÂ¯Ã‚Â¸Ã‚Â A blueprint was recovered from the dungeon depths`,
          });
        }
      }

      if (roll(0.1)) {
        updates._find_world_fragment = true;
      }
    }
  } else if (type === "mountain") {
    // Mountain Expedition: Rangers only, balanced high-risk/high-reward attrition
    const mountainMult = { dire_wolf: 0.8, human: 1.0, dwarf: 1.1 }[k.race] || 1.0;
    const rangerLevel = effectiveTroopLevel(k, "rangers");

    // Avalanche attrition per turn: random between 0 and level-based max (targeting ~75% total attrition)
    const expTurns = EXPEDITION_TURNS["mountain"] || 100;
    let totalArriving = rangers;
    const attritionLog = [];

    for (let turn = 1; turn <= expTurns; turn++) {
      // Determine max loss % based on ranger level (BALANCED: 0-8/6/5/4% per turn)
      let maxLoss = 8;
      if (rangerLevel >= 21 && rangerLevel <= 30) maxLoss = 6;
      else if (rangerLevel >= 31 && rangerLevel <= 40) maxLoss = 5;
      else if (rangerLevel >= 41) maxLoss = 4;

      // Roll between 0 and maxLoss (always allows zero-loss outcome)
      const lossPercent = rand(0, maxLoss);
      const lostThisTurn = Math.ceil((totalArriving * lossPercent) / 100);
      totalArriving -= lostThisTurn;

      if (lostThisTurn > 0) {
        attritionLog.push(lostThisTurn);
      }
    }

    const survived = totalArriving;
    const totalLost = rangers - survived;
    const casualtyRate = (totalLost / rangers * 100).toFixed(1);

    if (totalLost > 0) {
      rewards.push({
        text: `Avalanches claimed ${totalLost.toLocaleString()} rangers (${casualtyRate}%) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â ${survived.toLocaleString()} returned`,
      });
    } else {
      rewards.push({
        text: `Against the odds, all ${rangers.toLocaleString()} rangers navigated the mountain unscathed`,
      });
    }

    updates._rangers_returned = survived;

    // Apply casualty losses to kingdom ranger count
    updates.rangers = Math.max(0, (k.rangers || 0) - totalLost);

    // Mountain rewards only granted if rangers survived the expedition
    if (survived > 0) {
      // Gold scaled to troop count and level (200-500 per ranger)
      const goldPerRanger = rand(200, 500);
      const mountainGold = Math.floor(
        rangers * goldPerRanger * tacBonus * exploreBonus * mountainMult * (1 + rand(5, 30) / 100)
      );
      rewards.push({
        text: `+${mountainGold.toLocaleString()} gold from mountain artifacts`,
      });
      updates.gold = k.gold + mountainGold;

      // Mana from ley lines (scaled)
      const mountainMana = Math.floor(
        rand(rangers * 10, rangers * 50) * mountainMult * exploreBonus
      );
      rewards.push({
        text: `+${mountainMana} mana from ancient ley lines`,
      });
      updates.mana = k.mana + mountainMana;

      // Research boost from ancient knowledge (scaled)
      const res = ["res_weapons", "res_armor", "res_construction"][rand(0, 2)];
      const resBoost = Math.floor(rand(50, 150) * mountainMult);
      rewards.push({
        text: `Ancient runes revealed ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â ${res.replace("res_", "").replace("_", " ")} +${resBoost}`,
      });
      updates[res] = (k[res] || 0) + resBoost;

      // Junk prizes more frequent on mountain (60% chance per turn) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â consolidated summary
      let junkCount = 0;
      for (let t = 0; t < expTurns; t++) {
        if (roll(0.6)) {
          junkPrize(k, updates);
          junkCount++;
        }
      }
      if (junkCount > 0) {
        rewards.push({
          text: `Rangers discovered ${junkCount} artifacts in the mountain passes`,
        });
      }
    }

    // No land rewards from mountain ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â focus purely on artifacts/magic
    // (explicitly 0 land)
  }

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Ultra-rare prizes ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  // deep: 0.5%, dungeon success: 1%, mountain: 2.5% per turn (MAX 1 per expedition for mountain)
  const ultraChance = type === "dungeon" ? 0.01 : type === "deep" ? 0.005 : type === "mountain" ? 0.025 : 0;

  // For mountain expeditions, track if we already got an ultra-rare during the 100 turns
  if (type === "mountain" && updates._rangers_returned > 0) {
    let ultraRareObtained = false;
    const mountainUltraRares = ULTRA_RARE_PRIZES.filter(p =>
      ["iceflow_crown", "snowpeak_chalice", "frostbind_amulet", "avalanche_heart", "stormcaller_gem"].includes(p.id)
    );
    for (let turn = 1; turn <= (EXPEDITION_TURNS["mountain"] || 100); turn++) {
      if (!ultraRareObtained && roll(ultraChance)) {
        if (mountainUltraRares.length > 0) {
          const prize = mountainUltraRares[Math.floor(Math.random() * mountainUltraRares.length)];
          prize.effect(k, updates);
          rewards.push({ text: `ÃƒÂ¢Ã…â€œÃ‚Â¨ÃƒÂ¢Ã…â€œÃ‚Â¨ÃƒÂ¢Ã…â€œÃ‚Â¨ ULTRA RARE: ${prize.text}` });

          // Add ultra-rare item to inventory
          let inventory = safeJsonParse(updates.items || k.items, [], "expeditionRewards:ultra_rare_items");
          if (!Array.isArray(inventory)) inventory = [];
          const itemDef = INVENTORY_ITEMS?.[prize.id];
          addItemToInventory(inventory, prize.id, itemDef?.name || prize.id, 1);
          updates.items = JSON.stringify(inventory);

          ultraRareObtained = true; // Prevent more ultra-rares this expedition
        }
      }
    }
  } else if (ultraChance > 0 && roll(ultraChance)) {
    // Non-mountain expeditions: regular ultra-rare drop (can be multiple)
    const prize =
      ULTRA_RARE_PRIZES[Math.floor(Math.random() * ULTRA_RARE_PRIZES.length)];
    prize.effect(k, updates);
    rewards.push({ text: `ÃƒÂ¢Ã…â€œÃ‚Â¨ÃƒÂ¢Ã…â€œÃ‚Â¨ÃƒÂ¢Ã…â€œÃ‚Â¨ ULTRA RARE: ${prize.text}` });

    // Add ultra-rare item to inventory
    let inventory = safeJsonParse(updates.items || k.items, [], "expeditionRewards:ultra_rare_items");
    if (!Array.isArray(inventory)) inventory = [];
    const itemDef = INVENTORY_ITEMS?.[prize.id];
    addItemToInventory(inventory, prize.id, itemDef?.name || prize.id, 1);
    updates.items = JSON.stringify(inventory);
  }

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Throne of Nazdreg (0.1% on deep/dungeon, unique forever) ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  const throneChance = type === "deep" || type === "dungeon" ? 0.001 : 0;
  if (throneChance > 0 && roll(throneChance)) {
    updates._check_throne = true; // resolveExpeditions will check server_state and apply if unclaimed
  }

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Air Fragment (rare mountain drop, ~1-2% chance, only if rangers survive) ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  if (type === "mountain" && updates._rangers_returned > 0 && roll(0.015)) {
    // Add air fragment to inventory
    let inventory = safeJsonParse(updates.items || k.items, [], "expeditionRewards:air_fragment");
    if (!Array.isArray(inventory)) inventory = [];
    const itemDef = INVENTORY_ITEMS?.["air_fragment"];
    addItemToInventory(inventory, "air_fragment", itemDef?.name || "Air Fragment", 1);
    updates.items = JSON.stringify(inventory);
    rewards.push({
      text: `ÃƒÂ°Ã…Â¸Ã…â€™Ã‚Â¬ÃƒÂ¯Ã‚Â¸Ã‚Â An Air Fragment pulses with the fury of ancient storms ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â a collectible of immense power`,
    });
  }

  const preAchLength = events.length;
  checkAchievements(k, updates, events);
  for (let i = preAchLength; i < events.length; i++) {
    rewards.push({ text: events[i].message });
  }

  return { rewards, updates, events };
}

async function resolveExpeditions(db, k, engine) {
  // Pick up active ones AND unclaimed ones (turns_left=0 but rewards_claimed=0)
  const exps = await db.all(
    "SELECT * FROM expeditions WHERE kingdom_id = ? AND (turns_left > 0 OR (turns_left = 0 AND rewards_claimed = 0))",
    [k.id],
  );
  devLog(
    `[expedition] kingdom=${k.id} active/unclaimed: ${exps.map((e) => `${e.type}(${e.turns_left}t, claimed=${e.rewards_claimed})`).join(", ") || "none"}`,
  );

  // Fetch fresh kingdom state once instead of once per expedition
  const freshK = (await db.get("SELECT * FROM kingdoms WHERE id = ?", [k.id])) || k;

  const expeditionEvents = [];

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ BATCH PROCESSING: Collect updates before executing ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  // This reduces database round-trips from O(exps*turns) to O(turns)
  const tickDowns = [];  // { id, newTurns }
  const completions = []; // ids that complete this turn
  const retries = [];     // ids already completed, retrying claim
  const expsByState = {}; // track by id for later reward processing

  for (const exp of exps) {
    if (exp.turns_left > 0) {
      const direWolfBonus = racialUnitBonus(freshK, "rangers");
      const tickDown = direWolfBonus.earlyReturn ? 2 : 1;
      const newTurns = Math.max(0, exp.turns_left - tickDown);
      devLog(
        `[expedition] kingdom=${k.id} id=${exp.id} type=${exp.type} turns_left=${exp.turns_left} ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ ${newTurns}`,
      );

      if (newTurns > 0) {
        tickDowns.push({ id: exp.id, newTurns });
        expsByState[exp.id] = { ...exp, turns_left: newTurns, mustProcess: false };
      } else {
        completions.push(exp.id);
        expsByState[exp.id] = { ...exp, turns_left: 0, mustProcess: true };
        devLog(`[expedition] COMPLETING kingdom=${k.id} id=${exp.id} type=${exp.type}`);
      }
    } else {
      retries.push(exp.id);
      expsByState[exp.id] = { ...exp, mustProcess: true };
      devLog(`[expedition] RETRYING completion for kingdom=${k.id} id=${exp.id} type=${exp.type}`);
    }
  }

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Execute batched updates ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

  // Batch update: ALL tick-downs in ONE statement using CASE/WHEN
  if (tickDowns.length > 0) {
    const ids = tickDowns.map(t => t.id);
    const caseWhen = tickDowns
      .map(({ id, newTurns }) => `WHEN ${id} THEN ${newTurns}`)
      .join(" ");
    const updateSql = `UPDATE expeditions SET turns_left = CASE id ${caseWhen} END WHERE id = ANY($1)`;
    const result = await db.run(updateSql, [ids]);
    devLog(`[expedition] Batched ${result.changes} turn decrements in single UPDATE`);
  }

  // Batch update: all completions in one statement
  if (completions.length > 0) {
    const placeholders = completions.map(() => "?").join(",");
    const markResult = await db.run(
      `UPDATE expeditions SET turns_left = 0, rewards_claimed = 1 WHERE id IN (${placeholders}) AND rewards_claimed = 0`,
      completions,
    );
    devLog(`[expedition] Batched completion claim: ${markResult.changes} expeditions marked complete`);
  }

  // Batch update: all retry claims in one statement
  if (retries.length > 0) {
    const placeholders = retries.map(() => "?").join(",");
    const claimResult = await db.run(
      `UPDATE expeditions SET rewards_claimed = 1 WHERE id IN (${placeholders}) AND rewards_claimed = 0`,
      retries,
    );
    devLog(`[expedition] Batched retry claim: ${claimResult.changes} expeditions claimed`);
  }

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Process reward claims for expeditions that completed ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  for (const exp of exps) {
    const expState = expsByState[exp.id];
    if (!expState || !expState.mustProcess) continue;

    try {
      // Use pre-fetched kingdom state to avoid stale merged values
      const { rewards, updates, events } = expeditionRewards(
        exp.type,
        exp.rangers,
        exp.fighters,
        freshK,
        db,
      );

      // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Throne of Nazdreg check ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
      if (updates._check_throne) {
        delete updates._check_throne;
        // Atomic claim: a single conditional insert decides the winner. The row
        // count tells us whether THIS expedition seized the unique drop. This
        // closes the read-then-write race where two kingdoms finishing in the
        // same tick could both observe the throne as unclaimed across the await
        // boundary and each award it.
        const claim = await db.run(
          "INSERT INTO server_state (key, value) VALUES ('throne_found', '1') ON CONFLICT (key) DO NOTHING",
        );
        if (claim && claim.changes === 1) {
          THRONE_OF_NAZDREG.effect(freshK, updates);
          rewards.unshift({ text: THRONE_OF_NAZDREG.text });
          events.push({
            type: "system",
            message: `ÃƒÂ°Ã…Â¸Ã¢â‚¬ËœÃ¢â‚¬Ëœ ${freshK.name} has found the Throne of Nazdreg Grishnak. May his memory endure forever.`,
          });
          updates._server_announce = `ÃƒÂ°Ã…Â¸Ã¢â‚¬ËœÃ¢â‚¬Ëœ The Throne of Nazdreg Grishnak has been found by ${freshK.name}. His name is remembered.`;
        }
      }

      if (updates._find_kingdom) {
        delete updates._find_kingdom;
        const other = await db.get(
          "SELECT id, name FROM kingdoms WHERE id != ? ORDER BY RANDOM() LIMIT 1",
          [freshK.id],
        );
        if (other) {
          let disc = {};
          try {
            disc = safeJsonParse(freshK.discovered_kingdoms, {}, "auto:discovered_kingdoms");
          } catch {}
          if (!disc[other.id]) {
            disc[other.id] = { found: true, name: other.name };
            updates.discovered_kingdoms = JSON.stringify(disc);
            rewards.push({
              text: `ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â­ Your rangers discovered the kingdom of ${other.name}!`,
            });
          }
        }
      }

      if (updates._find_world_fragment) {
        delete updates._find_world_fragment;
        let frags = [];
        try {
          frags = safeJsonParse(freshK.world_fragments, [], "auto:world_fragments");
        } catch {}
        const frag =
          WORLD_FRAGMENTS[Math.floor(Math.random() * WORLD_FRAGMENTS.length)];
        frags.push(frag);
        updates.world_fragments = JSON.stringify(frags);
        rewards.push({
          text: `ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â® Your rangers recovered a World Fragment: ${frag}`,
        });
        events.push({
          type: "system",
          message: `ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â® A World Fragment (${frag}) was discovered during the expedition.`,
        });
      }

      if (updates._suspicious_rocks_achievement) {
        delete updates._suspicious_rocks_achievement;
        rewards.unshift({
          text: `ÃƒÂ°Ã…Â¸Ã‚ÂÃ¢â‚¬Â  ACHIEVEMENT UNLOCKED: Found 100 mysterious rocks! +1000 stone awarded.`,
        });
        events.push({
          type: "system",
          message: `ÃƒÂ°Ã…Â¸Ã‚ÂÃ¢â‚¬Â  ACHIEVEMENT: ${freshK.name} collected 100 mysterious rocks and was rewarded with 1000 stone!`,
        });
      }

      const serverAnnounce = updates._server_announce || null;
      delete updates._server_announce;
      delete updates._ultra_rare;

      const label = {
        scout: "ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â­ Scout",
        deep: "ÃƒÂ°Ã…Â¸Ã…â€™Ã‚Â² Deep",
        dungeon: "ÃƒÂ¢Ã…Â¡Ã¢â‚¬ÂÃƒÂ¯Ã‚Â¸Ã‚Â Dungeon",
        mountain: "ÃƒÂ°Ã…Â¸Ã‚ÂÃ¢â‚¬ÂÃƒÂ¯Ã‚Â¸Ã‚Â Mountain",
      }[exp.type];

      // Apply kingdom updates
      const rangersReturned =
        updates._rangers_returned !== undefined ? updates._rangers_returned : 0;
      const fightersReturned =
        updates._fighters_returned !== undefined
          ? updates._fighters_returned
          : 0;
      delete updates._rangers_returned;
      delete updates._fighters_returned;

      const VALID_KINGDOM_COLS = new Set([
        "gold",
        "mana",
        "land",
        "population",
        "morale",
        "food",
        "fighters",
        "rangers",
        "clerics",
        "mages",
        "thieves",
        "ninjas",
        "researchers",
        "engineers",
        "war_machines",
        "weapons_stockpile",
        "armor_stockpile",
        "res_economy",
        "res_weapons",
        "res_armor",
        "res_military",
        "res_attack_magic",
        "res_defense_magic",
        "res_entertainment",
        "res_construction",
        "res_war_machines",
        "res_spellbook",
        "bld_farms",
        "bld_barracks",
        "bld_markets",
        "bld_mage_towers",
        "blueprints_stored",
        "certified_blueprints_stored",
        "maps",
        "troop_levels",
        "xp",
        "level",
        "xp_sources",
        "discovered_kingdoms",
        "world_fragments",
        "collected_events",
        "last_event_id",
        "achievements",
        "items",
      ]);

      // Award XP
      const expXpAmount = { scout: 8, deep: 20, dungeon: 40, mountain: 100 }[exp.type] || 8;
      const rXp = awardTroopXp(freshK, "rangers", expXpAmount * exp.rangers);
      updates.troop_levels = rXp.troop_levels;
      if (exp.type === "dungeon" && exp.fighters > 0) {
        const fXp = awardTroopXp(
          { ...freshK, troop_levels: updates.troop_levels },
          "fighters",
          40 * exp.fighters,
        );
        updates.troop_levels = fXp.troop_levels;
      }

      // Award kingdom-level exploration XP (divide by XP_BASE.exploration=5 to get final amounts matching stated values)
      const kingdomXpBase = { scout: 1, deep: 4, dungeon: 8, mountain: 20 }[exp.type] || 1;
      const kingdomXp = awardXp(freshK, "exploration", kingdomXpBase * (exp.rangers + (exp.fighters || 0)));
      updates.xp = kingdomXp.xp;
      updates.level = kingdomXp.level;
      updates.xp_sources = JSON.stringify(kingdomXp.xp_sources);
      if (kingdomXp.events.length > 0) {
        events.push(...kingdomXp.events);
      }

      if (updates._achievement_unlocked) {
        rewards.push({
          text: "ÃƒÂ°Ã…Â¸Ã‚ÂÃ¢â‚¬Â  ACHIEVEMENT UNLOCKED: " + updates._achievement_unlocked,
        });
        events.push({
          type: "system",
          message: "ÃƒÂ°Ã…Â¸Ã‚ÂÃ¢â‚¬Â  ACHIEVEMENT UNLOCKED: " + updates._achievement_unlocked,
        });
        delete updates._achievement_unlocked;
      }

      // Handle location revelation for Field Collector achievement
      if (updates._reveal_all_locations) {
        try {
          let disc = safeJsonParse(updates.discovered_kingdoms || k.discovered_kingdoms, {}, "reveal_all:discovered_kingdoms");
          disc._all_revealed = true;
          updates.discovered_kingdoms = JSON.stringify(disc);
        } catch (err) {
          console.error("[resolveExpeditions] Error revealing all locations:", err);
        }
        delete updates._reveal_all_locations;
      }

      const safeUpdates = Object.fromEntries(
        Object.entries(updates).filter(
          ([k2, v]) =>
            VALID_KINGDOM_COLS.has(k2) && v !== undefined && v !== null,
        ),
      );
      if (Object.keys(safeUpdates).length > 0) {
        const cols = Object.keys(safeUpdates)
          .map((c) => `${c} = ?`)
          .join(", ");
        await db.run(`UPDATE kingdoms SET ${cols} WHERE id = ?`, [
          ...Object.values(safeUpdates),
          k.id,
        ]);
        // Update in-memory freshK so next expedition sees the changes
        Object.assign(freshK, safeUpdates);
      }
      if (rangersReturned > 0)
        await db.run(
          "UPDATE kingdoms SET rangers  = rangers  + ? WHERE id = ?",
          [rangersReturned, k.id],
        );
      if (fightersReturned > 0)
        await db.run(
          "UPDATE kingdoms SET fighters = fighters + ? WHERE id = ?",
          [fightersReturned, k.id],
        );

      // Update in-memory freshK for returned units
      if (rangersReturned > 0) freshK.rangers = (freshK.rangers || 0) + rangersReturned;
      if (fightersReturned > 0) freshK.fighters = (freshK.fighters || 0) + fightersReturned;

      // ONE news line only ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â rewards go to expedition log, not news feed
      const completionMsg = `${label} expedition returned ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â check the Explore tab for rewards.`;
      expeditionEvents.push({ type: "system", message: completionMsg });

      // Throne broadcast only
      if (serverAnnounce) {
        const allKingdoms = await db.all("SELECT id FROM kingdoms");
        if (allKingdoms.length > 0) {
          const placeholders = allKingdoms.map((_, i) => `($${i + 1},'system',$${allKingdoms.length + 1},$${allKingdoms.length + 2})`).join(',');
          const values = [...allKingdoms.map(ak => ak.id), serverAnnounce, k.turn];
          await db.run(
            `INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ${placeholders}`,
            values,
          );
        }
        if (engine.io)
          engine.io.emit("chat:system", {
            message: serverAnnounce,
            ts: Date.now(),
          });
      }

      // Save rewards to expedition row for log display
      const rewardJson = JSON.stringify(rewards.map((r) => r.text));
      await db.run("UPDATE expeditions SET rewards = ? WHERE id = ?", [
        rewardJson,
        exp.id,
      ]);
      console.log(
        `[expedition] completed kingdom=${k.id} type=${exp.type} rewards=${rewards.length}`,
      );
    } catch (err) {
      // Rewards failed ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â expedition is already marked complete (turns_left=0), troops return, no reward
      console.error(
        `[expedition] reward error kingdom=${k.id} id=${exp.id} type=${exp.type}:`,
        err.message,
        err.stack,
      );
      // Still return troops so they're not lost
      await db.run("UPDATE kingdoms SET rangers = rangers + ? WHERE id = ?", [
        exp.rangers,
        k.id,
      ]);
      if (exp.fighters > 0)
        await db.run(
          "UPDATE kingdoms SET fighters = fighters + ? WHERE id = ?",
          [exp.fighters, k.id],
        );
      const errMsg = `${exp.type} expedition returned ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â an error occurred calculating rewards (troops returned safely).`;
      await db.run("UPDATE expeditions SET rewards = ? WHERE id = ?", [
        JSON.stringify([errMsg]),
        exp.id,
      ]);
      await db.run(
        "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?, ?, ?, ?)",
        [k.id, "system", errMsg, k.turn],
      );
      expeditionEvents.push({ type: "system", message: errMsg });
    }
  }
  return expeditionEvents;
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Mage Tower ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â scroll crafting and mana production ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

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
              SET owner_alliance_id = ?, contest_alliance_id = NULL, contest_progress = 0, last_captured_at = unixepoch()
              WHERE name = ?
            `,
              [topAllianceId, region.name],
            );

            const alliance = await db.get(
              "SELECT name FROM alliances WHERE id = ?",
              [topAllianceId],
            );
            if (io)
              io.emit("chat", {
                room: "global",
                username: "System",
                message: `ÃƒÂ°Ã…Â¸Ã…Â¡Ã‚Â© REGION CAPTURED: The alliance [${alliance.name}] has seized control of ${region.name}!`,
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
    // user said: "start at an addition .15 at level 1 increases incrementally"
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
  score += k.researchers * 0.5 * getLvlMultiplier("researchers"); // Assumed baseline

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
  calculateScore,
  totalHiredUnits,
  getAvailableUnits,
  resolveRegions,
  goldPerTurn,
  manaPerTurn,
  foodBalance,
  farmProduction,
  foodConsumption,
  marketIncomeFull,
  tavernEntertainmentBonus,
  commodityPrice,
  processFoodEconomy,
  processGranaryAttunements,
  processVaultAttunements,
  processBarracksAttunements,
  processWallsAttunements,
  processGuardTowerAttunements,
  processOutpostAttunements,
  processTrainingAttunements,
  processCastleAttunements,
  processMausoleumAttunements,
  processLibraryAttunements,
  processMageTowerAttunements,
  processSmithyAttunements,
  processMarketAttunements,
  processShrineAttunements,
  processTavernAttunements,
  processSchoolAttunements,
  processFarmAttunements,
  processHousingAttunements,
  processMercenaries,
  hireMercenaries,
  purchaseUpgrade,
  SEASON_ORDER,
  SEASON_DURATION,
  SEASON_FARM_MULT,
  SEASON_ICONS,
  LOCATE_RACE_MULT,
  calcDiscoveryChance,
  processLocationMapsWip,
  WALL_UPGRADES,
  TOWER_DEF_UPGRADES,
  OUTPOST_UPGRADES,
  WALL_STRENGTH_MULT,
  TOWER_DETECT_MULT,
  OUTPOST_RANGER_MULT,
  DEFENSE_TIERS,
  defenseRating,
  wallDefensePower,
  towerDetectionPower,
  outpostRangerPower,
  checkDefenseTiers,
  applyWarmachineDamage,
  TOWER_UPGRADES,
  SCHOOL_UPGRADES,
  SHRINE_UPGRADES,
  MAUSOLEUM_UPGRADES,
  LIBRARY_UPGRADES,
  BANK_UPGRADES,
  FARM_UPGRADES,
  GRANARY_UPGRADES,
  MARKET_UPGRADES,
  TAVERN_UPGRADES,
  MERC_TIERS,
  COMMODITY_VALUES,
  FARM_YIELD_MULT,
  FOOD_CONSUMPTION_MULT,
  MARKET_INCOME_MULT,
  TRADE_RATE_MULT,
  processTurn,
  hireUnits,
  studyDiscipline,
  selectSchool: _selectSchool,
  queueBuildings,
  processBuildQueue,
  processLibrary,
  processMageTower,
  processShrine,
  processMausoleum,
  processActiveEffects,
  forgeTools,
  resolveMilitaryAttack,
  formatCombatV2NewsBlurb,
  castSpell,
  covertSpy,
  covertLoot,
  covertAssassinate,
  covertSabotage,
  resolveAllianceDefense,
  resolveExpeditions,
  awardXp,
  xpForLevel,
  xpToNextLevel,
  levelFromXp,
  awardTroopXp,
  awardUnitXp,
  diluteTroopXp,
  unitLevelMult,
  racialUnitBonus,
  troopXpForLevel,
  effectiveTroopLevel,
  WM_CREW_REQUIRED,
  wmCrewRequired,
  moraleMult,
  happinessCombatMult,
  calculateHappiness,
  getHappinessRecoveryRate,
  recordHappinessHistory,
  logHappinessEvent,
  rebellionCheck,
  rebellionEvent,
  TROOP_RACE_BONUS,
  RACE_BONUSES,
  REGION_DATA,
  assignRegion,
  UNIT_COST,
  BUILDING_COST,
  BUILDING_GOLD_COST,
  BUILDING_LAND_COST,
  BUILDING_COL,
  SPELL_DEFS,
  SCROLL_REQUIREMENTS,
  SCRIBE_ITEMS,
  HOUSING_CAP_BY_RACE,
  TOOL_COL,
  TOOL_GOLD_COST,
  BLUEPRINT_REQUIRED,
  SCAFFOLDING_REQUIRED,
  SCAFFOLDING_BONUS_BUILDINGS,
  HERO_CLASSES,
  heroXpForLevel,
  awardHeroXp,
  getHeroPower,
  applyHeroTurnBonuses,
  recruitHero,
  raidTradeRoute,
  canPrestige,
  processPrestige,
  getUnitName,
  demolishBuilding,
  TRADE_ROUTE_MAX,
  TRADE_ROUTE_ESTABLISH_COST,
  processResourceYield,
  computeExpeditionTransitions,
  initItemsArray,
  addItemToInventory,
  RESOURCE_BUILDING_CONFIG,
  BUILDING_WOOD_COST,
  BUILDING_STONE_COST,
  BUILDING_IRON_COST,
  raceBonus,
  calculateBuildTime,
  calculateBuildCost,
  awardEngineerXp,
  engineerXpForLevel,
  engineerConstructionMult,
  clearSynergyCache,
};
