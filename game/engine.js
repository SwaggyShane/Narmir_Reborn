// src/game/engine.js
// Pure game logic — no I/O, no socket calls.
// All functions take a kingdom row (or rows) and return mutations + events.

const config = require("./config");
const {
  devLog,
  assignRegion,
  calcDiscoveryChance,
  cleanNewsEvent,
} = require('./lib/data-transformations');
const {
  calculateHappiness,
  getHappinessRiseCap,
} = require('./happiness');

const effectsProcessor = require("./synergy-effects-processor");
const { checkFogDiscoveries } = require("./kingdom-fog-discovery");
const { safeJsonParse, safeJsonStringify, clearParseCache, roll } = require('../utils/helpers');
const { EPOCH_NOW } = require('../lib/db-sql');
const { pgInList, pgSetClauseWithNextPlaceholder } = require('../lib/pg-placeholders');
const { getProfiler, resetDevProfiler } = require('./profiling');

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
const {
  createTurnContext,
} = require('./lib/turn-context');
const {
  runPrelude,
} = require('./lib/turn-prelude');
const {
  runIncomePhase,
} = require('./lib/turn-income');
const {
  runProductionPhase,
} = require('./lib/turn-production');
const {
  runLoreAndBuildings,
} = require('./lib/turn-lore-buildings');
const {
  runUpkeepAndFlavor,
} = require('./lib/turn-upkeep-flavor');
const {
  runResearchPhase,
} = require('./lib/turn-research');
const {
  runQueuesPhase,
} = require('./lib/turn-queues');
const {
  runTrainingAndXpPhase,
} = require('./lib/turn-training-xp');

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
const { checkAchievements, calculateScore } = require('./lib/achievements');
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

async function getRandomKingdom(db, selfId) {
  const countRow = await db.get("SELECT COUNT(*) as c FROM kingdoms WHERE id != $1", [selfId]);
  const total = Number(countRow?.c || 0);
  if (total <= 0) return null;

  for (let attempt = 0; attempt < 8; attempt++) {
    const offset = Math.floor(Math.random() * total);
    const row = await db.get(
      "SELECT id, name FROM kingdoms WHERE id != $1 LIMIT 1 OFFSET $2",
      [selfId, offset],
    );
    if (row) return row;
  }

  return null;
}

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
  WORLD_FRAGMENTS,
  THRONE_OF_NAZDREG,
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

function processTurn(k, db = null) {
  const profiler = getProfiler();
  profiler.start();
  clearParseCache();

  // S00: heal JSON columns + seed updates/events (canonical: game/lib/turn-context.js)
  const ctx = createTurnContext(k, db);
  // S01: evolution, goals, XP sources, happiness, rebellion
  runPrelude(ctx);
  // S02: gold, mana, population, food
  runIncomePhase(ctx);
  const updates = ctx.updates;
  const events = ctx.events;

  // ── 4a. Building attunement special abilities (18 processors — granary,
  // vault, barracks, walls, guard tower, outpost, training, castle,
  // mausoleum, library, mage tower, smithy, market, shrine, tavern, school,
  // farm, housing — run via runBuildingAttunements, see A3-8) ──────────────
  runBuildingAttunements(k, updates, events);

  // S03: resources, mercs, maps, active events, scout (after attunements)
  runProductionPhase(ctx, { measureAttunement, fireAndForgetWithRetry });

  // S04: lore drops + free build-queue completions
  runLoreAndBuildings(ctx);

  // S05: troop upkeep, low-tax flavor, happiness threshold events
  runUpkeepAndFlavor(ctx);

  // S06: auto-research + mage research
  runResearchPhase(ctx);

  // S07: build queue, forge ticks, library/trade/defense/tower/shrine/effects
  runQueuesPhase(ctx);

  // S08: training, racial passives, XP, milestones, racial unlock
  runTrainingAndXpPhase(ctx);

  const finalGold = updates.gold !== undefined ? updates.gold : k.gold;
  const netGoldChange = finalGold - k.gold;
  const netSign = netGoldChange >= 0 ? "+" : "";
  events.push({
    type: "system",
      message: `💰 End of Turn ${updates.turn} — Net Gold: ${netSign}${netGoldChange.toLocaleString()}. Final Treasury: ${finalGold.toLocaleString()} gold.`,
  });

  updates.last_turn_at = Math.floor(Date.now() / 1000);
  checkAchievements(k, updates, events);

  // ── Happiness Audit Report ──────────────────────────────────────────────────────


  // Clean up temporary fields
  delete updates.xp_sources_updated;

  // Remove expired synergy effects at end of turn
  const kingdomForEffectCleanup = { ...k, ...updates };
  const cleanedKingdom = effectsProcessor.removeExpiredEffects(kingdomForEffectCleanup);
  if (cleanedKingdom && cleanedKingdom.active_effects && cleanedKingdom.active_effects !== kingdomForEffectCleanup.active_effects) {
    updates.active_effects = cleanedKingdom.active_effects;
  }

  const report = profiler.end();

  // Dev always-on profiler: surface budget warnings
  if (process.env.NODE_ENV !== 'production' && report && report.summary && report.summary.profileNeeded) {
    const needed = report.summary.profileNeeded;
    const { BUDGETS } = require('./profiling');  // local require to avoid top-level cycle
    if (needed.jsonHighCost) {
      console.warn(`[profiler] JSON high cost: ${report.jsonOperations.totalTime}ms (budget ${BUDGETS.jsonHighCostMs}ms)`);
    }
    if (needed.highSynergyLookups) {
      console.warn(`[profiler] High synergy lookups: ${report.synergyLookups} (budget ${BUDGETS.highSynergyLookups})`);
    }
    if (needed.slowAttunementExists) {
      console.warn('[profiler] Slow attunements detected (see _profileReport)');
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    try { resetDevProfiler(); } catch {}
  }

  return { updates, events: events.map(cleanNewsEvent), _profileReport: report };
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

/**
 * Process Epic Trek expedition completion: reveal fog along path and process discoveries.
 * Called from resolveExpeditions when an epic-trek expedition turns_left reaches 0.
 *
 * @param {object} db - Database connection
 * @param {object} exp - Expedition row (includes extra_data with path)
 * @param {object} kingdom - Fresh kingdom state
 * @returns {object} { events, updates, rewards } to merge into expedition processing
 */
async function resolveEpicTrek(db, exp, kingdom) {
  const { updateKingdomVisibility } = require('./visibility');
  const { cellIndex } = require('./visibility-cells');
  const { processPathDiscoveries } = require('./epic-trek-discovery');
  const { safeJsonParse } = require('../utils/helpers');

  const events = [];
  const updates = {};
  const rewards = [];

  // Parse path hexes from extra_data
  const extraData = safeJsonParse(exp.extra_data || '{}', {}, 'epic-trek:extra_data');
  const pathHexes = extraData.path_hexes || [];

  if (pathHexes.length === 0) {
    return { events, updates, rewards };
  }

  // Reveal fog along path
  try {
    await updateKingdomVisibility(db, kingdom.id, (current) => {
      let newSeenCells = current.seenCells;

      for (const hex of pathHexes) {
        if (hex.col !== undefined && hex.row !== undefined) {
          try {
            const idx = cellIndex(hex.col, hex.row);
            newSeenCells |= BigInt(1) << BigInt(idx);
          } catch {
            // Invalid hex coordinates — skip silently
            devLog(`[epic-trek] Invalid hex coordinate: (${hex.col}, ${hex.row})`);
          }
        }
      }

      return {
        seenCells: newSeenCells,
        currentCells: current.currentCells,
        version: current.version,
      };
    });

    rewards.push({
      text: `Your explorers revealed ${pathHexes.length} hexes along the Epic Trek path.`,
    });
  } catch (err) {
    console.error(`[epic-trek] Fog reveal failed for kingdom ${kingdom.id}:`, err.message);
    rewards.push({
      text: `Epic Trek fog reveal encountered an error.`,
    });
  }

  // Kingdom/node discovery is NOT a roll: anything sitting on a hex whose fog
  // just got removed is found unconditionally, same as scout ring-reveal.
  // Resource nodes already work this way for free (the /world-map route
  // filters purely on seenCells, no reveal event needed); kingdoms need the
  // explicit check below since discovered_kingdoms is a persisted list.
  try {
    if (db && kingdom.id) {
      const kingdomDiscoveries = await checkFogDiscoveries(db, kingdom.id);
      for (const d of kingdomDiscoveries) {
        if (d.message) rewards.push({ text: d.message });
      }
    }
  } catch (err) {
    console.error(`[epic-trek] Kingdom fog-discovery check failed for kingdom ${kingdom.id}:`, err.message);
  }

  // Dungeon/mountain hex on path unlocks that region's location — checked
  // against every region, not just the traveler's own (region-specific
  // rewards mean any region's dungeon/mountain is worth finding).
  try {
    const { findRegionalLocationsOnPath } = require('./epic-trek-discovery');
    const { pixelToHex } = require('./hex-utils');
    const { getAllLocations, markLocationDiscovered, isPubliclyDiscovered } = require('./world-locations');
    const onPath = findRegionalLocationsOnPath(pathHexes, getAllLocations, pixelToHex);
    for (const { type: locType, location } of onPath) {
      if (isPubliclyDiscovered(location)) continue;
      await markLocationDiscovered(db, location.id, kingdom.id);
      const turnColumn = locType === 'dungeon' ? 'first_dungeon_found_turn' : 'first_mountain_found_turn';
      await db.run(
        `UPDATE kingdoms SET ${turnColumn} = $1 WHERE race = $2 AND ${turnColumn} IS NULL`,
        [kingdom.turn || 0, location.region_name],
      );
      // location.region_name is the internal race key (e.g. "dark_elf",
      // "high_elf") — there's no server-side race display-name table
      // (RACE_NAMES is referenced in game/constants-schema.js but never
      // actually defined), so humanize it generically rather than leaking
      // the raw snake_case key into player-facing text.
      const raceLabel = location.region_name
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      rewards.push({
        text: `Your explorers uncovered the ${raceLabel} ${locType}!`,
      });
    }
  } catch (locErr) {
    console.error(`[epic-trek] Regional location check failed:`, locErr.message);
  }

  // Small junk-focused finds no longer roll here — they now happen turn-by-turn
  // while the expedition is actually traveling (resolveExpeditions' tick loop),
  // named and surfaced to the log as each one occurs instead of being
  // batch-simulated and dumped as a single count on arrival.

  // The bigger, end-of-trek prize: real resources/maps/troops/artifacts
  // rolled per hex crossed and delivered as one batch on arrival — a richer
  // tier than the per-turn junk finds above.
  try {
    const { applyLootDiscoveries } = require('./epic-trek-discovery');
    const discoveries = processPathDiscoveries(pathHexes, kingdom);
    if (discoveries && discoveries.length > 0) {
      const lootResult = applyLootDiscoveries({ ...kingdom, ...updates }, discoveries);
      Object.assign(updates, lootResult.updates);
      for (const r of lootResult.rewards) {
        rewards.push(r);
      }
    }
  } catch (err) {
    console.error(`[epic-trek] Path-loot processing failed for kingdom ${kingdom.id}:`, err.message);
  }

  return { events, updates, rewards };
}

// Shared by resolveExpeditions' tick loop (mid-journey finds) and its
// completion loop (final rewards) — whichever kingdom columns a reward is
// allowed to write. "stone" was missing here despite junkPrize()'s 100th
// suspicious-rock achievement granting +1000 stone: the bonus event still
// fired, but the actual stone was silently filtered out and never applied.
const EXPEDITION_VALID_KINGDOM_COLS = new Set([
  "gold",
  "mana",
  "land",
  "population",
  "happiness",
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
  "stone",
  // Forge system (A6) — lava-draw resolution writes these
  "lava_stored",
  "engineer_level",
  "engineer_xp",
  "flux_barges",
]);

// Mid-journey find chance per real turn tick, for expedition types where
// travel takes real time. Rolled once per tick in the loop below instead of
// being batch-simulated at completion — the player sees each find (and its
// actual item name) as it happens, not all at once dumped on arrival.
// mountain's rate is much lower than its old batch-simulated 60%/turn (which
// only worked because it was invisible math collapsed into one count on
// arrival — surfaced individually that would be ~60 log entries per trip);
// epic-trek and lava-draw keep roughly their old per-turn/per-hex odds.
const MID_TRAVEL_FIND_CONFIG = {
  mountain: { icon: "🏔️", title: "Mountain expedition", chance: 0.05 },
  "epic-trek": { icon: "🛤️", title: "Epic Trek", chance: 0.3 },
  "lava-draw": { icon: "🌋", title: "Lava draw", chance: 0.08 },
};

async function resolveExpeditions(db, k, engine) {
  // Pick up active ones AND unclaimed ones (turns_left=0 but rewards_claimed=0)
  const exps = await db.all(
    "SELECT * FROM expeditions WHERE kingdom_id = $1 AND (turns_left > 0 OR (turns_left = 0 AND rewards_claimed = 0))",
    [k.id],
  );
  devLog(
    `[expedition] kingdom=${k.id} active/unclaimed: ${exps.map((e) => `${e.type}(${e.turns_left}t, claimed=${e.rewards_claimed})`).join(", ") || "none"}`,
  );

  // Fetch fresh kingdom state once instead of once per expedition to prevent data corruption.
  // Rationale: processTurn returns an updates object but doesn't mutate the original kingdom in-place.
  // If we use the pre-fetched kingdom without merging all updates, resolveExpeditions will use stale
  // values when calculating XP/rewards and silently corrupt the database with outdated data.
  const freshK = (await db.get("SELECT * FROM kingdoms WHERE id = $1", [k.id])) || k;

  const expeditionEvents = [];

  // ── BATCH PROCESSING: Collect updates before executing ──────────────────────────
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
        `[expedition] kingdom=${k.id} id=${exp.id} type=${exp.type} turns_left=${exp.turns_left} → ${newTurns}`,
      );

      if (newTurns > 0) {
        tickDowns.push({ id: exp.id, newTurns });
        expsByState[exp.id] = { ...exp, turns_left: newTurns, mustProcess: false };

        const findCfg = MID_TRAVEL_FIND_CONFIG[exp.type];
        if (findCfg && roll(findCfg.chance)) {
          const findUpdates = {};
          const found = junkPrize(freshK, findUpdates);
          // Keep in-memory freshK current so a second expedition (or a second
          // roll later this same call) sees this item already in inventory,
          // rather than each write clobbering the last.
          Object.assign(freshK, findUpdates);
          const safeFindUpdates = Object.fromEntries(
            Object.entries(findUpdates).filter(
              ([col, v]) => EXPEDITION_VALID_KINGDOM_COLS.has(col) && v !== undefined && v !== null,
            ),
          );
          if (Object.keys(safeFindUpdates).length > 0) {
            const cols = Object.keys(safeFindUpdates);
            const { setClause, nextPlaceholder } = pgSetClauseWithNextPlaceholder(cols);
            await db.run(`UPDATE kingdoms SET ${setClause} WHERE id = ${nextPlaceholder}`, [
              ...Object.values(safeFindUpdates),
              k.id,
            ]);
          }
          expeditionEvents.push({
            type: "system",
            message: `${findCfg.icon} ${findCfg.title}: your crew found ${found}`,
            skipNews: true,
            expeditionLogEntry: {
              icon: findCfg.icon,
              title: findCfg.title,
              subtitle: `Found: ${found}`,
            },
          });
        }
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

  // ── Execute batched updates ──────────────────────────────────────────────────────

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
    const markResult = await db.run(
      `UPDATE expeditions SET turns_left = 0, rewards_claimed = 1, completed_at = FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER WHERE id IN (${pgInList(completions.length)}) AND rewards_claimed = 0`,
      completions,
    );
    devLog(`[expedition] Batched completion claim: ${markResult.changes} expeditions marked complete`);
  }

  // Batch update: all retry claims in one statement. COALESCE so a retry
  // (turns_left already 0 from an earlier attempt) doesn't overwrite the
  // real completion time with "now".
  if (retries.length > 0) {
    const claimResult = await db.run(
      `UPDATE expeditions SET rewards_claimed = 1, completed_at = COALESCE(completed_at, FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER) WHERE id IN (${pgInList(retries.length)}) AND rewards_claimed = 0`,
      retries,
    );
    devLog(`[expedition] Batched retry claim: ${claimResult.changes} expeditions claimed`);
  }

  // ── Process reward claims for expeditions that completed ─────────────────────────
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
        exp.rewards,
      );

      // Dungeon/mountain expeditions carry their launch-time distance/turn
      // cost in extra_data (routes/kingdom-exploration.js) — surface it as
      // the first reward line so arrival still reports what the old
      // instant-resolve flow's top-level message used to.
      if (exp.type === 'dungeon' || exp.type === 'mountain') {
        const locData = safeJsonParse(exp.extra_data, {}, 'expedition:location-distance');
        if (typeof locData.distance === 'number') {
          rewards.unshift({
            text: `Location found at distance ${locData.distance.toFixed(1)} hexes. ${locData.turnCost || '?'} turns spent exploring.`,
          });
        }
      }

      // ── Epic Trek: Reveal fog along path and process discoveries ──────────
      if (exp.type === 'epic-trek') {
        try {
          const epicTrekResult = await resolveEpicTrek(db, exp, freshK);
          if (epicTrekResult && epicTrekResult.events) {
            events.push(...epicTrekResult.events);
          }
          if (epicTrekResult && epicTrekResult.updates) {
            Object.assign(updates, epicTrekResult.updates);
          }
          if (epicTrekResult && epicTrekResult.rewards) {
            rewards.push(...epicTrekResult.rewards);
          }
        } catch (err) {
          console.error(`[epic-trek] Resolution error for kingdom ${k.id} id=${exp.id}:`, err.message);
          events.push({
            type: 'system',
            message: `Epic Trek returned -- an error occurred processing discoveries (fog reveal may be incomplete).`,
          });
        }
      }

      // ── Lava draw: arrival race, draw or empty-handed, crew return (A6) ──────
      if (exp.type === 'lava-draw') {
        try {
          const { resolveLavaDraw } = require('./lava-expedition');
          const lavaResult = await resolveLavaDraw(db, exp, freshK);
          if (lavaResult && lavaResult.events) events.push(...lavaResult.events);
          if (lavaResult && lavaResult.updates) Object.assign(updates, lavaResult.updates);
          if (lavaResult && lavaResult.rewards) rewards.push(...lavaResult.rewards);
        } catch (err) {
          console.error(`[lava-draw] Resolution error for kingdom ${k.id} id=${exp.id}:`, err.message);
          events.push({
            type: 'system',
            message: `Lava draw returned -- an error occurred processing the result.`,
          });
        }
      }

      // ── Throne of Nazdreg check ──────────────────────────────────────────────
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
            message: `${freshK.name} has found the Throne of Nazdreg Grishnak. May his memory endure forever.`,
          });
          updates._server_announce = `?? The Throne of Nazdreg Grishnak has been found by ${freshK.name}. His name is remembered.`;
        }
      }

      if (updates._find_kingdom) {
        delete updates._find_kingdom;
        const { mergeKingdomDiscovery } = require('./kingdom-discovery-resolve');
        const other = await getRandomKingdom(db, freshK.id);
        const merged = mergeKingdomDiscovery(
          { ...freshK, ...updates },
          updates,
          other,
          { source: 'expedition' },
        );
        if (merged.applied) {
          updates.discovered_kingdoms = merged.discovered_kingdoms;
          rewards.push({ text: merged.message });
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
        updates.world_fragments = safeJsonStringify(frags);
        rewards.push({
          text: `Your rangers recovered a World Fragment: ${frag}`,
        });
        events.push({
          type: "system",
          message: `A World Fragment (${frag}) was discovered during the expedition.`,
        });
      }

      if (updates._suspicious_rocks_achievement) {
        delete updates._suspicious_rocks_achievement;
        rewards.unshift({
          text: `ACHIEVEMENT UNLOCKED: Found 100 mysterious rocks! +1000 stone awarded.`,
        });
        events.push({
          type: "system",
          message: `ACHIEVEMENT: ${freshK.name} collected 100 mysterious rocks and was rewarded with 1000 stone!`,
        });
      }

      const serverAnnounce = updates._server_announce || null;
      delete updates._server_announce;
      delete updates._ultra_rare;

      // Every type resolveExpeditions can actually complete needs an entry
      // here — a miss silently produced "undefined expedition returned..."
      // (hunting/prospecting/land_expansion/epic-trek/lava-draw were missing).
      // The `|| exp.type` fallback means a future type can no longer produce
      // that "undefined" text even if someone forgets to add it here.
      const label = {
        scout: "🔭 Scout",
        deep: "🌲 Deep",
        dungeon: "⚔️ Dungeon",
        mountain: "🏔️ Mountain",
        hunting: "🥩 Hunting",
        prospecting: "⛏️ Prospecting",
        land_expansion: "🗺️ Land Expansion",
        "epic-trek": "🛤️ Epic Trek",
        "lava-draw": "🌋 Lava Draw",
      }[exp.type] || exp.type;

      // Apply kingdom updates
      const rangersReturned =
        updates._rangers_returned !== undefined ? updates._rangers_returned : 0;
      const fightersReturned =
        updates._fighters_returned !== undefined
          ? updates._fighters_returned
          : 0;
      delete updates._rangers_returned;
      delete updates._fighters_returned;

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
      updates.xp_sources = safeJsonStringify(kingdomXp.xp_sources);
      if (kingdomXp.events.length > 0) {
        events.push(...kingdomXp.events);
      }

      if (updates._achievement_unlocked) {
        rewards.push({
          text: "ACHIEVEMENT UNLOCKED: " + updates._achievement_unlocked,
        });
        events.push({
          type: "system",
          message: "ACHIEVEMENT UNLOCKED: " + updates._achievement_unlocked,
        });
        delete updates._achievement_unlocked;
      }

      // Handle location revelation for Field Collector achievement
      if (updates._reveal_all_locations) {
        try {
          let disc = safeJsonParse(updates.discovered_kingdoms || k.discovered_kingdoms, {}, "reveal_all:discovered_kingdoms");
          disc._all_revealed = true;
          updates.discovered_kingdoms = safeJsonStringify(disc);
        } catch (err) {
          console.error("[resolveExpeditions] Error revealing all locations:", err);
        }
        delete updates._reveal_all_locations;
      }

      const safeUpdates = Object.fromEntries(
        Object.entries(updates).filter(
          ([k2, v]) =>
            EXPEDITION_VALID_KINGDOM_COLS.has(k2) && v !== undefined && v !== null,
        ),
      );
      if (Object.keys(safeUpdates).length > 0) {
        const cols = Object.keys(safeUpdates);
        const { setClause, nextPlaceholder } = pgSetClauseWithNextPlaceholder(cols);
        await db.run(`UPDATE kingdoms SET ${setClause} WHERE id = ${nextPlaceholder}`, [
          ...Object.values(safeUpdates),
          k.id,
        ]);
        // Update in-memory freshK so next expedition sees the changes
        Object.assign(freshK, safeUpdates);
      }
      if (rangersReturned > 0)
        await db.run(
          "UPDATE kingdoms SET rangers  = rangers  + $1 WHERE id = $2",
          [rangersReturned, k.id],
        );
      if (fightersReturned > 0)
        await db.run(
          "UPDATE kingdoms SET fighters = fighters + $1 WHERE id = $2",
          [fightersReturned, k.id],
        );

      // Update in-memory freshK for returned units
      if (rangersReturned > 0) freshK.rangers = (freshK.rangers || 0) + rangersReturned;
      if (fightersReturned > 0) freshK.fighters = (freshK.fighters || 0) + fightersReturned;

      // ONE news line only — rewards go to expedition log, not news feed
      const completionMsg = `${label} expedition returned -- check the Explore tab for rewards.`;
      expeditionEvents.push({ type: "system", message: completionMsg });

      // Notable events accumulated above (achievement unlocks, world-fragment
      // finds, Throne of Nazdreg, level-ups) were previously built into
      // `events` but never forwarded anywhere — computed, then silently
      // discarded every time. Forward them now so their toast/sound actually
      // fires instead of the player only finding out via the expedition log.
      if (events.length > 0) {
        expeditionEvents.push(...events);
      }

      // Throne broadcast only (batch inserts to prevent memory spike)
      if (serverAnnounce) {
        const BATCH_SIZE = 1000;
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
          const batch = await db.all("SELECT id FROM kingdoms LIMIT $1 OFFSET $2", [BATCH_SIZE, offset]);
          if (batch.length === 0) {
            hasMore = false;
            break;
          }
          const placeholders = batch.map((_, i) => `($${i + 1},'system',$${batch.length + 1},$${batch.length + 2})`).join(',');
          const values = [...batch.map(ak => ak.id), serverAnnounce, k.turn];
          await db.run(
            `INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ${placeholders}`,
            values,
          );
          offset += BATCH_SIZE;
        }
        if (engine.io) {
          const { safeEmit } = require('./safe-socket-emit');
          safeEmit(engine.io, "chat:system", {
            message: serverAnnounce,
            ts: Date.now(),
          });
        }
      }

      // Save rewards to expedition row for log display
      const rewardJson = safeJsonStringify(rewards.map((r) => r.text));
      await db.run("UPDATE expeditions SET rewards = $1 WHERE id = $2", [
        rewardJson,
        exp.id,
      ]);
      console.log(
        `[expedition] completed kingdom=${k.id} type=${exp.type} rewards=${rewards.length}`,
      );
    } catch (err) {
      // Rewards failed — expedition is already marked complete (turns_left=0), troops return, no reward
      console.error(
        `[expedition] reward error kingdom=${k.id} id=${exp.id} type=${exp.type}:`,
        err.message,
        err.stack,
      );
      // Still return troops so they're not lost
      await db.run("UPDATE kingdoms SET rangers = rangers + $1 WHERE id = $2", [
        exp.rangers,
        k.id,
      ]);
      if (exp.fighters > 0)
        await db.run(
          "UPDATE kingdoms SET fighters = fighters + $1 WHERE id = $2",
          [exp.fighters, k.id],
        );
      const errMsg = `${exp.type} expedition returned -- an error occurred calculating rewards (troops returned safely).`;
      await db.run("UPDATE expeditions SET rewards = $1 WHERE id = $2", [
        safeJsonStringify([errMsg]),
        exp.id,
      ]);
      await db.run(
        "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ($1, $2, $3, $4)",
        [k.id, "system", errMsg, k.turn],
      );
      expeditionEvents.push({ type: "system", message: errMsg });
    }
  }
  return expeditionEvents;
}

// Turn-based node harvesting (replaces the old real-time resource_expeditions
// flow): each row's turns_left covers travel there+back plus the chosen
// harvest duration, ticking down by 1 per turn. Deliberately isolated from
// resolveExpeditions/expeditionRewards above -- those are built around
// rangers/fighters (attrition, troop XP, forage-rate formulas), none of
// which apply to a population-based harvesting party.
// yield = population * (richness / 100) * harvestTurns * this. richness is
// stored on a 0-100 scale: regular world-seeded nodes are randomized 25-100
// (game/world-initialization.js), while the guaranteed first-ring node
// (game/first-ring-node.js) is deliberately low (4) since it's meant as an
// easy, modest early find rather than a full-value node.
const HARVEST_YIELD_RATE = 0.1;
async function resolveResourceHarvests(db, k) {
  const events = [];
  const harvests = await db.all(
    "SELECT * FROM resource_harvests WHERE kingdom_id = $1 AND turns_left > 0",
    [k.id],
  );

  for (const h of harvests) {
    const newTurnsLeft = Math.max(0, h.turns_left - 1);
    if (newTurnsLeft > 0) {
      await db.run("UPDATE resource_harvests SET turns_left = $1 WHERE id = $2", [newTurnsLeft, h.id]);
      continue;
    }

    const yieldAmount = Math.round(h.population_sent * (h.richness / 100) * h.harvest_turns * HARVEST_YIELD_RATE);
    const col = ["wood", "stone", "iron", "gold"].includes(h.resource_type) ? h.resource_type : "wood";

    await db.run(
      `UPDATE kingdoms SET ${col} = ${col} + $1, population = population + $2 WHERE id = $3`,
      [yieldAmount, h.population_sent, k.id],
    );
    await db.run(
      "UPDATE resource_harvests SET turns_left = 0, yield_amount = $1, rewards_claimed = 1 WHERE id = $2",
      [yieldAmount, h.id],
    );

    events.push({
      type: "system",
      message: `Harvesting party returned from a node with ${yieldAmount.toLocaleString()} ${h.resource_type}.`,
    });
  }

  return events;
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
