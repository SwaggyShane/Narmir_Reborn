// src/game/engine.js
// Pure game logic — no I/O, no socket calls.
// All functions take a kingdom row (or rows) and return mutations + events.

const config = require("./config");
const {
  assignRegion,
  calcDiscoveryChance,
} = require('./lib/data-transformations');
const {
  calculateHappiness,
  getHappinessRiseCap,
} = require('./happiness');

const { EPOCH_NOW } = require('../lib/db-sql');
const { getProfiler } = require('./profiling');

// Healing (M1-3): centralized defensive repair for double-/nested-stringified JSON columns.
// Imported from canonical location in game/lib so it can be unit tested independently
// and reused by other turn-adjacent modules.
const {
  cleanNestedJson,
  healKingdomForTurn,
  ensureObject,
  ensureArray,
  XP_SOURCES_DEFAULT,
  getXpSources
} = require('./lib/healing');
const turnPipeline = require('./lib/turn-pipeline');

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
const { calculateScore } = require('./lib/achievements');
const {
  happinessMult,
  happinessCombatMult,
  formatCombatV2NewsBlurb,
} = require('./lib/combat-helpers');
const { recordHappinessHistory, logHappinessEvent } = require('./lib/happiness-logging');
const { processLocationMapsWip, computeExpeditionTransitions } = require('./lib/expeditions');
const {
  rebellionCheck,
  rebellionEvent,
  raidTradeRoute,
  resolveAllianceDefense,
} = require('./lib/special-events');
const { canPrestige, processPrestige } = require('./prestige');
const {
  resolveMilitaryAttack,
  wmCrewRequired,
} = require('./lib/combat-wrappers');
const {
  studyDiscipline,
  _selectSchool,
  queueBuildings,
  processBuildQueue,
  forgeTools,
  demolishBuilding,
} = require('./lib/building-research');
const {
  processMercenaries,
  hireMercenaries,
  purchaseUpgrade,
  hireUnits,
  junkPrize,
  expeditionRewards,
  processActiveEffects,
} = require('./lib/gameplay');

// Economy domain — gold/food/trade per-turn calculations, food economy
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

// Magic domain — castSpell, mage tower / shrine / mausoleum / library
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

// Covert operations domain — spy, loot, assassinate, sabotage. Defined in
// game/covert.js; re-exported below.
const covert = require('./covert');
const {
  covertSpy,
  covertLoot,
  covertAssassinate,
  covertSabotage,
} = covert;

// Attunements domain — per-building fragment per-turn effects. Defined in
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
// Heroes domain — hero recruitment, leveling, power calculation, and passive
// turn bonuses. Defined in game/heroes.js; re-exported below.
const heroesMod = require('./heroes');
const {
  heroXpForLevel,
  awardHeroXp,
  getHeroPower,
  applyHeroTurnBonuses,
  recruitHero,
} = heroesMod;

// Defense domain — wall/tower/outpost power, defense rating labels, and tier
// progression (Fortified/Keep/Citadel). Defined in game/defense.js; re-exported below.
const defenseMod = require('./defense');
const {
  defenseRating,
  wallDefensePower,
  towerDetectionPower,
  outpostRangerPower,
  checkDefenseTiers,
} = defenseMod;

// Engineers domain — XP/leveling, construction speed, and build time/cost
// calculations. Defined in game/engineers.js; re-exported below.
const engineersMod = require('./engineers');
const {
  engineerXpForLevel,
  engineerConstructionMult,
  calculateBuildTime,
  calculateBuildCost,
  awardEngineerXp,
} = engineersMod;

// XP and leveling domain — kingdom XP curve, level-from-XP search, milestone
// rewards, and per-activity XP awards. Defined in game/xp.js; re-exported below.
const xpMod = require('./xp');
const {
  xpForLevel,
  xpToNextLevel,
  levelFromXp,
  awardXp,
} = xpMod;

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

// ── Season system ─────────────────────────────────────────────────────────────

// ── Location system ───────────────────────────────────────────────────────────
// calcDiscoveryChance imported from lib/data-transformations.js

// addItemToInventory + initItemsArray live in game/lib/items.js.
// processResourceYield lives in game/economy.js. All three are re-exported
// from engine.js via module.exports for backward compat.


// totalHiredUnits + the food/market/trade economy functions live in
// game/economy.js. They're re-exported from engine.js via module.exports
// for backward compat with routes/sockets that still call engine.foo(...).
// ── Gameplay (processMercenaries extracted to game/lib/gameplay.js) ──

// ── Gameplay (hireMercenaries extracted to game/lib/gameplay.js) ──

// ── Gameplay (purchaseUpgrade extracted to game/lib/gameplay.js) ──

// Measure attunement function execution time for profiling
function measureAttunement(name, fn) {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;
  const profiler = getProfiler();
  profiler.recordAttunementCall(name, duration);
  return result;
}

// ── Building attunement processors, run in this exact order every turn ──────
// (A3-8, 2026-07-19: extracted from 18 near-identical inline blocks in
// processTurn — each was `measureAttunement(name, () => fn({...k, ...updates},
// events))` followed by `Object.assign(updates, result)`. Order is
// significant and preserved exactly: each processor sees {...k, ...updates}
// freshly merged with every prior processor's updates already applied.)
const BUILDING_ATTUNEMENT_PROCESSORS = [
  ['processGranaryAttunements', processGranaryAttunements],
  ['processVaultAttunements', processVaultAttunements],
  ['processBarracksAttunements', processBarracksAttunements],
  ['processWallsAttunements', processWallsAttunements],
  ['processGuardTowerAttunements', processGuardTowerAttunements],
  ['processOutpostAttunements', processOutpostAttunements],
  ['processTrainingAttunements', processTrainingAttunements],
  ['processCastleAttunements', processCastleAttunements],
  ['processMausoleumAttunements', processMausoleumAttunements],
  ['processLibraryAttunements', processLibraryAttunements],
  ['processMageTowerAttunements', processMageTowerAttunements],
  ['processSmithyAttunements', processSmithyAttunements],
  ['processMarketAttunements', processMarketAttunements],
  ['processShrineAttunements', processShrineAttunements],
  ['processTavernAttunements', processTavernAttunements],
  ['processSchoolAttunements', processSchoolAttunements],
  ['processFarmAttunements', processFarmAttunements],
  ['processHousingAttunements', processHousingAttunements],
];

function runBuildingAttunements(k, updates, events) {
  for (const [name, fn] of BUILDING_ATTUNEMENT_PROCESSORS) {
    const result = measureAttunement(name, () => fn({ ...k, ...updates }, events));
    Object.assign(updates, result);
  }
}

// processTurn is synchronous (cannot await), so revealRingHexes/
// checkFogDiscoveries are necessarily fire-and-forget (A3-5 audit,
// 2026-07-19). checkFogDiscoveries is self-healing by design — it re-scans
// every turn scouts are allocated and skips already-discovered kingdoms, so
// one failed call is caught by the next. revealRingHexes is NOT: it's gated
// on scout-progress crossing a NEW ring threshold, a one-time transition
// derived from the already-persisted scout_progress total — if the write
// fails on the exact turn a ring completes, that ring's hexes are never
// revealed again, since the transition never re-fires. A single retry
// covers the realistic failure mode (a transient connection blip) without
// changing the trigger frequency or touching the hot per-turn path.
async function fireAndForgetWithRetry(fn, label) {
  try {
    await fn();
  } catch (err) {
    console.error(`[engine] ${label} failed, retrying once: ${err.message}`);
    try {
      await fn();
    } catch (retryErr) {
      console.error(`[engine] ${label} failed on retry, giving up: ${retryErr.message}`);
    }
  }
}

// S10: phase playlist lives in game/lib/turn-pipeline.js
function processTurn(k, db = null) {
  return turnPipeline.processTurn(k, db, {
    measureAttunement,
    fireAndForgetWithRetry,
    runBuildingAttunements,
  });
}

// ── Level-based caps ──────────────────────────────────────────────────────────
// levelCap and getCap imported from lib/data-transformations.js

// ── Hire units ────────────────────────────────────────────────────────────────

// ── Gameplay (hireUnits extracted to game/lib/gameplay.js) ──

// ── Research & Magic Schools (extracted to game/lib/building-research.js) ───

// ── Experience & Levelling ────────────────────────────────────────────────────

// XP required to reach each level (cumulative from level 1).
// Single smooth quadratic: 10*(level-1)^2
// Level 500 = 2,490,010 XP — a dedicated player taking all turns (~403/day) hits
// this in ~124 days at 50 XP/turn base.

// ── Construction (extracted to game/lib/building-research.js) ───────────────

// ── Construction processing (extracted to game/lib/building-research.js) ──

// ── Tool forging (extracted to game/lib/building-research.js) ──────────────

// ── Military combat (extracted to game/lib/combat-wrappers.js) ──────────────────
// resolveMilitaryAttack, resolveMilitaryAttackV2Adapter, wmCrewRequired, awardXp

// ── Gameplay (junkPrize extracted to game/lib/gameplay.js) ──

// ── Gameplay (expeditionRewards extracted to game/lib/gameplay.js) ──

// S11: expedition resolution (epic trek, expeditions, resource harvests)
const expeditionResolution = require('./lib/expedition-resolution');
const {
  resolveEpicTrek,
  resolveExpeditions: resolveExpeditionsImpl,
  resolveResourceHarvests,
} = expeditionResolution;
// resolveEpicTrek re-exported via module.exports

// Preserve call sites that pass engine as third arg (commandHandler uses this.engine).
async function resolveExpeditions(db, k, engineOrDeps) {
  const deps = engineOrDeps && engineOrDeps.io !== undefined
    ? { io: engineOrDeps.io }
    : (engineOrDeps || {});
  return resolveExpeditionsImpl(db, k, deps);
}


// ── Mage Tower — scroll crafting and mana production ──────────────────────────

// ── Gameplay (processActiveEffects extracted to game/lib/gameplay.js) ──

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
      WHERE k.region = $1
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
            "UPDATE regions SET contest_alliance_id = NULL, contest_progress = 0 WHERE name = $1",
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
              SET owner_alliance_id = $1, contest_alliance_id = NULL, contest_progress = 0, last_captured_at = ${EPOCH_NOW}
              WHERE name = $2
            `,
              [topAllianceId, region.name],
            );

            const alliance = await db.get(
              "SELECT name FROM alliances WHERE id = $1",
              [topAllianceId],
            );
            if (io) {
              const { safeEmit } = require('./safe-socket-emit');
              safeEmit(io, "chat", {
                room: "global",
                username: "System",
                message: `🚩 REGION CAPTURED: The alliance [${alliance.name}] has seized control of ${region.name}!`,
                is_system: true,
              });
              // A4-6: client/src/hooks/useSocket.js listens for this to
              // trigger a worldmap refresh — the chat message above is the
              // player-readable announcement, this is what actually updates
              // the map's region-ownership display.
              safeEmit(io, "event:world_updated", {});
            }
          } else {
            await db.run(
              "UPDATE regions SET contest_progress = $1 WHERE name = $2",
              [progress, region.name],
            );
          }
        } else {
          // New challenger
          await db.run(
            "UPDATE regions SET contest_alliance_id = $1, contest_progress = 10 WHERE name = $2",
            [topAllianceId, region.name],
          );
        }
      }
    } else {
      // No dominance, decay contest
      if (region.contest_progress > 0) {
        const progress = Math.max(0, region.contest_progress - 5);
        await db.run("UPDATE regions SET contest_progress = $1 WHERE name = $2", [
          progress,
          region.name,
        ]);
      }
    }
  }
}

// ── Building demolition (extracted to game/lib/building-research.js) ────────

module.exports = {
  fireAndForgetWithRetry, // exported for unit testing (A3-5); not part of the game-logic surface
  runBuildingAttunements, // exported for unit testing (A3-8); not part of the game-logic surface
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
  junkPrize,
  expeditionRewards,
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
  resolveEpicTrek,
  resolveExpeditions,
  resolveResourceHarvests,
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
  happinessMult,
  happinessCombatMult,
  calculateHappiness,
  getHappinessRiseCap,
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
  // M1-3 healing exports (re-exported for callers/tests that require('game/engine'))
  cleanNestedJson,
  healKingdomForTurn,
  ensureObject,
  ensureArray,
  XP_SOURCES_DEFAULT,
  getXpSources,
};
