// src/game/engine.js
// Pure game logic ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â no I/O, no socket calls.
// All functions take a kingdom row (or rows) and return mutations + events.

const config = require("./config");

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

// Phase 1 extracted domains (low-risk, self-contained functions)
// Rebellion, recruitment, research, mercenaries, trade routes, prestige, combat news,
// location maps, achievements, effects, and scoring. All re-exported below for backward compat.
const rebellionMod = require('./rebellion');
const recruitmentMod = require('./recruitment');
const researchMod = require('./research');
const mercenariesMod = require('./mercenaries');
const tradeRoutesMod = require('./trade-routes');
const prestigeMod = require('./prestige');
const combatNewsMod = require('./combat-news');
const locationMapsMod = require('./location-maps');
const achievementsMod = require('./achievements');
const effectsMod = require('./effects');
const scoringMod = require('./scoring');

// Construction domain — queueBuildings, processBuildQueue, demolishBuilding. Defined in
// game/construction.js; re-exported below.
const constructionMod = require('./construction');
// Upgrades domain — purchaseUpgrade. Defined in game/upgrades.js; re-exported below.
const upgradesMod = require('./upgrades');
// Happiness domain — assignRegion, calculateHappiness, recordHappinessHistory.
// Defined in game/happiness.js; re-exported below.
const happinessMod = require('./happiness');
// Combat helpers — isNight, wmCrewRequired, moraleMult, happinessCombatMult,
// resolveAllianceDefense. Defined in game/combat-helpers.js; re-exported below.
const combatHelpersMod = require('./combat-helpers');
// Forge domain — forgeTools. Defined in game/forge.js; re-exported below.
const forgeMod = require('./forge');
// Expeditions domain — calcDiscoveryChance, junkPrize, expeditionRewards.
// Defined in game/expeditions.js; re-exported below.
const expeditionsMod = require('./expeditions');
const {
  RACE_BONUSES,
  REGION_DATA,
  UNIT_COST,
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
  SCROLL_REQUIREMENTS,
  SCRIBE_ITEMS,
  WM_CREW_REQUIRED,
  RESEARCH_MAP,
  RACIAL_UNITS,  WORLD_FRAGMENTS,
  THRONE_OF_NAZDREG,
  CAPS,  BUILDING_COL,  TOOL_COL,  TOOL_GOLD_COST,
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


// World / meta-game domain — region assignment, prestige, alliance defense,
// region control resolution, and score calculation. Defined in game/world.js;
// re-exported below via module.exports for backward compat.
const worldMod = require('./world');
const { resolveRegions } = worldMod;


// Turn domain -- processTurn and all per-turn helpers (happiness, rebellion,
// mercenaries, level caps, build queue, active effects). Defined in
// game/turn.js; re-exported below via module.exports for backward compat.
const turnMod = require('./turn');
const {
  processTurn,
  processActiveEffects,
  processBuildQueue,
  checkAchievements,
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

// Expeditions domain -- resource expeditions, loot rolls, reward calc.
// Defined in game/expeditions.js; re-exported below via module.exports.
const {
  computeExpeditionTransitions,
  junkPrize,
  expeditionRewards,
  resolveExpeditions,
} = expeditionsMod;


// totalHiredUnits + the food/market/trade economy functions live in
// game/economy.js. They're re-exported from engine.js via module.exports
// for backward compat with routes/sockets that still call engine.foo(...).

// Kingdom actions domain — player-initiated commands: hire units, purchase
// upgrades, research disciplines, queue buildings, forge tools, raid trade
// routes, demolish buildings. Defined in game/actions.js; re-exported below.
const actionsMod = require('./actions');
const {
  hireMercenaries,
  purchaseUpgrade,
  hireUnits,
  studyDiscipline,
  selectSchool: _selectSchool,
  queueBuildings,
  forgeTools,
  raidTradeRoute,
  demolishBuilding,
} = actionsMod;
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

module.exports = {
  // Re-exports from Phase 1 extracted modules for backward compatibility
  rebellionCheck: rebellionMod.rebellionCheck,
  rebellionEvent: rebellionMod.rebellionEvent,
  levelCap: recruitmentMod.levelCap,
  getCap: recruitmentMod.getCap,
  hireUnits: recruitmentMod.hireUnits,
  studyDiscipline: researchMod.studyDiscipline,
  selectSchool: researchMod._selectSchool,
  processMercenaries: mercenariesMod.processMercenaries,
  hireMercenaries: mercenariesMod.hireMercenaries,
  raidTradeRoute: tradeRoutesMod.raidTradeRoute,
  canPrestige: prestigeMod.canPrestige,
  processPrestige: prestigeMod.processPrestige,
  normalizeCombatUnits: combatNewsMod.normalizeCombatUnits,
  sumRecordValues: combatNewsMod.sumRecordValues,
  formatCombatUnitCounts: combatNewsMod.formatCombatUnitCounts,
  formatCombatBuildingsLost: combatNewsMod.formatCombatBuildingsLost,
  formatCombatV2NewsBlurb: combatNewsMod.formatCombatV2NewsBlurb,
  processLocationMapsWip: locationMapsMod.processLocationMapsWip,
  checkAchievements: achievementsMod.checkAchievements,
  processActiveEffects: effectsMod.processActiveEffects,
  calculateScore: scoringMod.calculateScore,

  // Other direct exports
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
  purchaseUpgrade: upgradesMod.purchaseUpgrade,
  SEASON_ORDER,
  SEASON_DURATION,
  SEASON_FARM_MULT,
  SEASON_ICONS,
  LOCATE_RACE_MULT,
  calcDiscoveryChance: expeditionsMod.calcDiscoveryChance,
  junkPrize: expeditionsMod.junkPrize,
  expeditionRewards: expeditionsMod.expeditionRewards,
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
  queueBuildings: constructionMod.queueBuildings,
  processBuildQueue: constructionMod.processBuildQueue,
  processLibrary,
  processMageTower,
  processShrine,
  processMausoleum,
  forgeTools: forgeMod.forgeTools,
  resolveMilitaryAttack,
  castSpell,
  covertSpy,
  covertLoot,
  covertAssassinate,
  covertSabotage,
  resolveAllianceDefense: combatHelpersMod.resolveAllianceDefense,
  isNight: combatHelpersMod.isNight,
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
  wmCrewRequired: combatHelpersMod.wmCrewRequired,
  moraleMult: combatHelpersMod.moraleMult,
  happinessCombatMult: combatHelpersMod.happinessCombatMult,
  calculateHappiness: happinessMod.calculateHappiness,
  getHappinessRecoveryRate: happinessMod.getHappinessRecoveryRate,
  recordHappinessHistory: happinessMod.recordHappinessHistory,
  logHappinessEvent,
  TROOP_RACE_BONUS,
  RACE_BONUSES,
  REGION_DATA,
  assignRegion: happinessMod.assignRegion,
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
  getUnitName,
  demolishBuilding: constructionMod.demolishBuilding,
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
