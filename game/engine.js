// src/game/engine.js
// Pure game logic — no I/O, no socket calls.
// All functions take a kingdom row (or rows) and return mutations + events.

const config = require("./config");
const { progressGoal } = require('./goals');
const {
  devLog,
  assignRegion,
  getHappinessRecoveryRate,
  calculateHappiness,
  getCap,
  calcDiscoveryChance,
  cleanNewsEvent,
} = require('./lib/data-transformations');

const fragmentBonusManager = require("./fragment-bonus-manager");
const effectsProcessor = require("./synergy-effects-processor");
const { safeJsonParse, clearParseCache } = require('../utils/helpers');

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
  getSynergyPassiveBonusMultiplier,
  getSynergyPassiveBonusAbsolute,
  clearSynergyCache,
} = require('./lib/synergy-cache');
const { addItemToInventory, initItemsArray } = require('./lib/items');
const { naturalHappinessCap } = require('./lib/happiness-cap');
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
  canPrestige,
  processPrestige,
  raidTradeRoute,
  resolveAllianceDefense,
} = require('./lib/special-events');
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
  const countRow = await db.get("SELECT COUNT(*) as c FROM kingdoms WHERE id != ?", [selfId]);
  const total = Number(countRow?.c || 0);
  if (total <= 0) return null;

  for (let attempt = 0; attempt < 8; attempt++) {
    const offset = Math.floor(Math.random() * total);
    const row = await db.get(
      "SELECT id, name FROM kingdoms WHERE id != ? LIMIT 1 OFFSET ?",
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
  calculateTradeIncome,
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
  checkMilestones,
  levelFromXp,
  awardXp,
} = xpMod;

// Population domain — housing capacity, population growth. Defined in
// game/population.js; re-exported below.
const populationMod = require('./population');
const {
  housingCapPerBuilding,
  popGrowth,
} = populationMod;

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
  SUPPORT_CAP_RACE,
  WM_CREW_REQUIRED,
  RACIAL_UNITS,
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

function processTurn(k, db = null) {
  clearParseCache();

  // Defensive: heal k.troop_levels from any nested stringification at the start of the turn
  // This ensures ALL subsequent code (combat, training, racial bonuses, etc.) receives clean data
  let cleanTroopLevels = safeJsonParse(k.troop_levels, {}, "processTurn:init_troop_levels");
  while (typeof cleanTroopLevels === "string") {
    cleanTroopLevels = safeJsonParse(cleanTroopLevels, {}, "processTurn:init_troop_levels_nested");
  }
  // Validate that cleanTroopLevels is a non-null, non-array object before stringifying
  if (cleanTroopLevels && typeof cleanTroopLevels === "object" && !Array.isArray(cleanTroopLevels)) {
    k.troop_levels = JSON.stringify(cleanTroopLevels);
  }

  const events = [];
  const updates = {
    turn: k.turn + 1,
    updated_at: Math.floor(Date.now() / 1000),
  };

  progressGoal(k, updates, 'turn_taken', 1);

  // Initialize XP source tracking at the very beginning
  // Defensive: heal from any nested stringification (same pattern as troop_levels above)
  const XP_SOURCES_DEFAULT = { turn: 0, gold_earned: 0, combat_win: 0, combat_loss: 0, research: 0, construction: 0, exploration: 0, spell_cast: 0, covert_op: 0 };
  let xpSourcesAccum = safeJsonParse(k.xp_sources, XP_SOURCES_DEFAULT, "processTurn:xp_sources");
  while (typeof xpSourcesAccum === "string") {
    xpSourcesAccum = safeJsonParse(xpSourcesAccum, XP_SOURCES_DEFAULT, "processTurn:xp_sources_nested");
  }
  if (!xpSourcesAccum || typeof xpSourcesAccum !== "object" || Array.isArray(xpSourcesAccum)) {
    xpSourcesAccum = { ...XP_SOURCES_DEFAULT };
  }



  // Calculate happiness using last turn's active_effects so the penalty is applied before decay
  const happinessResult = calculateHappiness(k);
  updates.happiness = happinessResult.happiness;

  // Decay fragment happiness penalty by 1 toward 0 each turn; remove the key when it reaches 0
  {
    const decayEffects = safeJsonParse(k.active_effects, {}, 'turn:fragment_penalty_decay');
    if ((decayEffects.fragment_happiness_penalty || 0) < 0) {
      decayEffects.fragment_happiness_penalty = Math.min(0, decayEffects.fragment_happiness_penalty + 1);
      if (decayEffects.fragment_happiness_penalty === 0) {
        delete decayEffects.fragment_happiness_penalty;
      }
      updates.active_effects = JSON.stringify(decayEffects);
    }
  }

  // Record happiness history for tracking and graphing
  if (db && k.id) {
    recordHappinessHistory(db, k.id, updates.turn, happinessResult).catch(err =>
      console.error(`[engine] Failed to record happiness history: ${err.message}`)
    );
  }

  {
    const comp = happinessResult.components || {};
    const happinessParts = [];
    const orderedComponents = [
      ['food', comp.food],
      ['entertainment', comp.entertainment],
      ['safety', comp.safety],
      ['prosperity', comp.prosperity],
      ['race', comp.race],
      ['effects', comp.effects],
      ['synergy', comp.synergy],
      ['tax', comp.tax],
      ['overcrowding', comp.overcrowding],
      ['fragments', comp.fragments]
    ];
    for (const [label, value] of orderedComponents) {
      const amount = Number(value || 0);
      if (!amount) continue;
      const prefix = amount > 0 ? '+' : '';
      happinessParts.push(`${label} ${prefix}${amount}`);
    }
    events.push({
      type: 'system',
      message: `😊 Happiness: ${happinessResult.happiness}/120 (recovery +${happinessResult.recovery}${happinessParts.length ? ', ' + happinessParts.join(', ') : ''})`
    });
  }

  // Check for rebellion events
  rebellionCheck(k, happinessResult.happiness, updates, events);

  // ── 1. Gold income ───────────────────────────────────────────────────────────
  const income = goldPerTurn(k);
  const tradeIncome = calculateTradeIncome(k);
  updates.gold = k.gold + income + tradeIncome;

  let incomeMsg = `🪙 Turn ${updates.turn}: +${income.toLocaleString()} gold earned.`;
  if (tradeIncome > 0) {
    incomeMsg = `🪙 Turn ${updates.turn}: +${income.toLocaleString()} gold earned (+${tradeIncome.toLocaleString()} from trade routes).`;
  }
  events.push({ type: "system", message: incomeMsg });

  // ── 2. Mana regeneration ─────────────────────────────────────────────────────
  const manaGain = manaPerTurn(k);
  updates.mana = k.mana + manaGain;
  events.push({
    type: "system",
    message: `✨ Mana: +${manaGain.toLocaleString()} restored. Total: ${updates.mana.toLocaleString()}.`,
  });

  // Mages gain XP when producing mana
  if (k.mages > 0 && manaGain > 0) {
    const resMages = awardUnitXp({ ...k, ...updates }, "mages", manaGain);
    if (resMages) updates.troop_levels = resMages;
  }

  // ── 3. Population growth ─────────────────────────────────────────────────────
  const growth = popGrowth(k);
  updates.population = Math.max(0, k.population + growth);
  if (growth > 0) {
    events.push({
      type: "system",
      message: `👥 Population grew by ${growth.toLocaleString()} to ${updates.population.toLocaleString()}.`,
    });
  } else if (growth < 0) {
    events.push({
      type: "system",
      message: `⚠️ Population declined by ${Math.abs(growth).toLocaleString()} to ${updates.population.toLocaleString()} due to low happiness.`,
    });
  }

  // ── 4. Food economy — farms, consumption, shortage consequences ──────────────
  const foodUpdates = processFoodEconomy({ ...k, ...updates }, events);
  Object.assign(updates, foodUpdates);

  // ── 4a. Granary attunement special abilities ──────────────────────────────────
  const granaryAbilityUpdates = processGranaryAttunements({ ...k, ...updates }, events);
  Object.assign(updates, granaryAbilityUpdates);

  // ── 4a-ii. Vault attunement special abilities ─────────────────────────────────
  const vaultAbilityUpdates = processVaultAttunements({ ...k, ...updates }, events);
  Object.assign(updates, vaultAbilityUpdates);

  // ── 4a-iii. Barracks attunement special abilities ─────────────────────────────
  const barracksAbilityUpdates = processBarracksAttunements({ ...k, ...updates }, events);
  Object.assign(updates, barracksAbilityUpdates);

  // ── 4a-iv. Walls attunement special abilities ─────────────────────────────────
  const wallsAbilityUpdates = processWallsAttunements({ ...k, ...updates }, events);
  Object.assign(updates, wallsAbilityUpdates);

  // ── 4a-v. Guard tower attunement special abilities ────────────────────────────
  const guardTowerAbilityUpdates = processGuardTowerAttunements({ ...k, ...updates }, events);
  Object.assign(updates, guardTowerAbilityUpdates);

  // ── 4a-vi. Outpost attunement special abilities ───────────────────────────────
  const outpostAbilityUpdates = processOutpostAttunements({ ...k, ...updates }, events);
  Object.assign(updates, outpostAbilityUpdates);

  // ── 4a-vii. Training field attunement special abilities ───────────────────────
  const trainingAbilityUpdates = processTrainingAttunements({ ...k, ...updates }, events);
  Object.assign(updates, trainingAbilityUpdates);

  // ── 4a-viii. Castle attunement special abilities ──────────────────────────────
  const castleAbilityUpdates = processCastleAttunements({ ...k, ...updates }, events);
  Object.assign(updates, castleAbilityUpdates);

  // ── 4a-ix. Mausoleum attunement special abilities ─────────────────────────────
  const mausoleumAbilityUpdates = processMausoleumAttunements({ ...k, ...updates }, events);
  Object.assign(updates, mausoleumAbilityUpdates);

  // ── 4a-x. Library attunement special abilities ────────────────────────────────
  const libraryAbilityUpdates = processLibraryAttunements({ ...k, ...updates }, events);
  Object.assign(updates, libraryAbilityUpdates);

  // ── 4a-xi. Mage tower attunement special abilities ────────────────────────────
  const mageTowerAbilityUpdates = processMageTowerAttunements({ ...k, ...updates }, events);
  Object.assign(updates, mageTowerAbilityUpdates);

  // ── 4a-xi-b. Smithy attunement special abilities ──────────────────────────────
  const smithyAbilityUpdates = processSmithyAttunements({ ...k, ...updates }, events);
  Object.assign(updates, smithyAbilityUpdates);

  // ── 4a-xi-c. Market attunement special abilities ──────────────────────────────
  const marketAbilityUpdates = processMarketAttunements({ ...k, ...updates }, events);
  Object.assign(updates, marketAbilityUpdates);

  // ── 4a-xi-d. Shrine attunement special abilities ──────────────────────────────
  const shrineAbilityUpdates = processShrineAttunements({ ...k, ...updates }, events);
  Object.assign(updates, shrineAbilityUpdates);

  // ── 4a-xi-e. Tavern attunement special abilities ──────────────────────────────
  const tavernAbilityUpdates = processTavernAttunements({ ...k, ...updates }, events);
  Object.assign(updates, tavernAbilityUpdates);

  // ── 4a-xii. School attunement special abilities ───────────────────────────────
  const schoolAbilityUpdates = processSchoolAttunements({ ...k, ...updates }, events);
  Object.assign(updates, schoolAbilityUpdates);

  // ── 4a-xiii. Farm attunement special abilities ────────────────────────────────
  const farmAbilityUpdates = processFarmAttunements({ ...k, ...updates }, events);
  Object.assign(updates, farmAbilityUpdates);

  // ── 4a-xv. Housing attunement special abilities ───────────────────────────────
  const housingAbilityUpdates = processHousingAttunements({ ...k, ...updates }, events);
  Object.assign(updates, housingAbilityUpdates);

  // ── 4b. Resource production (wood / stone / iron) ────────────────────────────
  const resourceUpdates = processResourceYield({ ...k, ...updates }, events);
  Object.assign(updates, resourceUpdates);

  // ── 4c. Tavern entertainment bonus (Disabled: taverns no longer grant entertainment study per turn) ──
  /*
  const entBonus = tavernEntertainmentBonus(k);
  if (entBonus > 0) {
    updates.res_entertainment = Math.min(
      500,
      k.res_entertainment + Math.floor(entBonus / 10),
    );
  }
  */

  // ── 4c. Mercenary upkeep and expiry ───────────────────────────────────────────
  const mercUpdates = processMercenaries({ ...k, ...updates }, events);
  Object.assign(updates, mercUpdates);

  // ── 4d. Location maps in progress ────────────────────────────────────────────
  const locUpdates = processLocationMapsWip({ ...k, ...updates }, events);
  Object.assign(updates, locUpdates);

  // ── 4e. Active event tick-down ────────────────────────────────────────────────
  const activeEv2 = safeJsonParse(
    updates.active_event || k.active_event,
    {},
    "processTurn:active_event",
  );
  let changed = false;
  for (const key of Object.keys(activeEv2)) {
    activeEv2[key].turns_remaining = (activeEv2[key].turns_remaining || 1) - 1;
    if (activeEv2[key].turns_remaining <= 0) {
      delete activeEv2[key];
    }
    changed = true;
  }
  if (changed) updates.active_event = JSON.stringify(activeEv2);

  // ── 5. Lore Events ────────────────────────────────────────────────────────────
  // 0.1% chance ~ 24000 turns needed for 24 drops
  if (Math.random() < 0.001) {
    // config.LORE_EVENTS is refreshed from the lore_entries table at boot
    // (seeded from game/lore.js); falls back to the static book before then.
    const LORE = config.LORE_EVENTS;
    const cats = ["narmir", "general", k.race];
    const cat = cats[Math.floor(Math.random() * cats.length)];
    const raceLore = LORE[cat] || [];
    if (raceLore.length > 0) {
      const loreCollected = safeJsonParse(
        updates.collected_lore || k.collected_lore,
        [],
        "processTurn:lore",
      );
      const lastId = updates.last_lore_id || k.last_lore_id;

      let available = raceLore.filter((l) => l.id !== lastId);
      if (available.length === 0) available = raceLore;
      const ev = available[Math.floor(Math.random() * available.length)];
      if (ev) {
        if (!loreCollected.includes(ev.id)) {
          loreCollected.push(ev.id);
          updates.collected_lore = JSON.stringify(loreCollected);

          // Historian unlocks when the kingdom's reachable pool is complete
          // (narmir + general + own race — other races' lore can't drop here)
          const reachableTotal = cats.reduce(
            (sum, c) => sum + (LORE[c] || []).length,
            0,
          );
          const collectedReachable = loreCollected.filter((id) =>
            cats.some((c) => (LORE[c] || []).some((l) => l.id === id)),
          ).length;
          if (collectedReachable >= reachableTotal) {
            updates._historian_unlocked = true;
          }
        }
        updates.last_lore_id = ev.id;
        events.push({
          type: "system",
          message: `📜 HISTORY: ${ev.msg || ev.content || ev}`,
        });
      }
    }
  }

  // ── 5b. Building completion ───────────────────────────────────────────────────
  let buildQueue = safeJsonParse(k.build_queue || "{}", {}, "processTurn:build_queue");
  // Defensive: handle arbitrary levels of nested stringification
  while (typeof buildQueue === "string") {
    buildQueue = safeJsonParse(buildQueue, {}, "processTurn:build_queue_nested_parse");
  }
  // Fallback: ensure buildQueue is always a non-null object
  if (!buildQueue || typeof buildQueue !== "object") {
    buildQueue = {};
  }
  let buildQueueChanged = false;
  const completedBuildings = [];

  for (const [queueId, buildJob] of Object.entries(buildQueue)) {
    buildJob.turns_remaining--;

    if (buildJob.turns_remaining <= 0) {
      completedBuildings.push(buildJob);
      delete buildQueue[queueId];
      buildQueueChanged = true;

      // Increment building count
      if (!updates[buildJob.building]) {
        updates[buildJob.building] = (k[buildJob.building] || 0) + 1;
      } else {
        updates[buildJob.building]++;
      }

      // Award engineer XP (preserve existing troop_levels)
      const xpGain = Math.ceil(buildJob.turns_needed / 100);
      const mergedK = { ...k, ...updates };
      const newTroopLevels = awardUnitXp(mergedK, "engineers", xpGain);
      if (newTroopLevels) updates.troop_levels = newTroopLevels;

      // Apply engineer level progression
      awardEngineerXp(mergedK, xpGain);
      updates.engineer_level = mergedK.engineer_level;
      updates.engineer_xp = mergedK.engineer_xp;

      events.push({
        type: "system",
        message: `✅ Construction complete: ${buildJob.building.replace(/_/g, " ")}! Engineers gained ${xpGain} XP.`,
      });
    }
  }

  if (buildQueueChanged) {
    updates.build_queue = JSON.stringify(buildQueue);
  }

  // ── 6. Troop upkeep ───────────────────────────────────────────────────────────
  // Researchers, engineers, scribes are exempt if housed in their buildings.
  // Overflow (unhomed) units pay normal upkeep.

  const capRace = SUPPORT_CAP_RACE[k.race] || {
    researcher: 1.0,
    engineer: 1.0,
    scribe: 1.0,
  };

  // Capacity per building (base × race multiplier)
  const researcherCap = Math.floor(
    k.bld_schools * 100 * capRace.researcher,
  );
  const engineerCap = Math.floor(k.bld_smithies * 50 * capRace.engineer);
  const scribeCap = Math.floor(k.bld_libraries * 20 * capRace.scribe);

  // Overflow = units beyond capacity → pay upkeep; housed units are free
  const researcherOverflow = Math.max(0, k.researchers - researcherCap);
  const engineerOverflow = Math.max(0, k.engineers - engineerCap);
  const scribeOverflow = Math.max(0, k.scribes - scribeCap);

  // Combat/support troops always pay upkeep
  const upkeepMult =
    {
      high_elf: 1.0,
      dwarf: 0.85,
      dire_wolf: 1.2,
      dark_elf: 1.1,
      human: 1.0,
      orc: 1.15,
    }[k.race] || 1.0;

  const combatTroops =
    k.fighters +
    k.rangers +
    k.clerics +
    k.mages +
    k.thieves +
    k.ninjas;
  const supportOverflow =
    researcherOverflow + engineerOverflow + scribeOverflow;
  const totalTroops = combatTroops + supportOverflow;

  const barracksTrainingMult = fragmentBonusManager.getBonusMultiplier(k, 'barracks', 'training');
  const barrackDiscount = Math.min(
    0.5,
    Math.floor(k.bld_barracks / 2) * 0.01 * barracksTrainingMult,
  );
  const upkeep = Math.floor(totalTroops * upkeepMult * (1 - barrackDiscount));

  // Build housing status message for support units
  const housedResearchers = Math.min(k.researchers, researcherCap);
  const housedEngineers = Math.min(k.engineers, engineerCap);
  const housedScribes = Math.min(k.scribes, scribeCap);
  const totalHoused = housedResearchers + housedEngineers + housedScribes;

  if (upkeep > 0) {
    updates.gold = (updates.gold || k.gold) - upkeep;
    if (updates.gold < 0) updates.gold = 0;
    let msg = `⚙️ Troop upkeep: -${upkeep.toLocaleString()} gold (${totalTroops.toLocaleString()} billable`;
    if (totalHoused > 0)
      msg += `, ${totalHoused.toLocaleString()} support units housed free`;
    if (barrackDiscount > 0) msg += `, barracks discount applied`;
    msg += `).`;
    events.push({ type: "system", message: msg });
  } else if (totalHoused > 0) {
    events.push({
      type: "system",
      message: `✅ All support units housed — no upkeep cost this turn.`,
    });
  }

  // ── 6. Happiness ─────────────────────────────────────────────────────────────────
  {
    const capPerBuilding = housingCapPerBuilding(k);
    let housingCap = k.bld_housing * capPerBuilding;
    // Apply world fragment bonuses for housing capacity
    const housingMult = fragmentBonusManager.getBonusMultiplier(k, 'housing', 'capacity');
    housingCap *= housingMult;
    const overcrowdingThreshold = housingCap * 1.3;
    const overcrowded = housingCap > 0 && k.population > overcrowdingThreshold;

    // Race overcrowding penalty modifiers
    let overcrowdMult = { dire_wolf: 0.5, high_elf: 2.0 }[k.race] || 1.0;
    const activeHousingSpecial = fragmentBonusManager.getSpecialEffect(k, 'housing');
    if (activeHousingSpecial?.name === "Goliath Dwellings") {
      overcrowdMult *= 0.2; // 80% reduction in overcrowding penalty, since they are spacious
    }
    const overcrowdPenalty = overcrowded
      ? Math.max(
          0,
          Math.floor(Math.max(0, (k.population - overcrowdingThreshold) * 0.018 * overcrowdMult)),
        )
      : 0;

    let taxPenalty = 0;
    let taxBoost = 0;
    const currentTax = k.tax || 42;

    if (currentTax >= 50) {
      taxPenalty = 15 + Math.floor(((currentTax - 50) / 50) * 80);
    } else if (currentTax < 42) {
      taxBoost = Math.floor(((42 - currentTax) / 41) * 25);
    }

    if (currentTax < 20 && Math.random() < 0.05) {
      const taxEvents = config.TAX_EVENTS || [];
      if (taxEvents.length > 0) {
        const msg = taxEvents[Math.floor(Math.random() * taxEvents.length)];
        const bonusType = Math.random();
        let bonusStr = "";
        if (bonusType < 0.33) {
          const goldBonus = Math.floor(100 + Math.random() * 900);
          updates.gold = (updates.gold || k.gold) + goldBonus;
          bonusStr = `+${goldBonus} Gold`;
        } else if (bonusType < 0.66) {
          const foodBonus = Math.floor(100 + Math.random() * 400);
          updates.food = (updates.food || k.food) + foodBonus;
          bonusStr = `+${foodBonus} Food`;
        } else {
          const cur =
            updates.happiness !== undefined
              ? updates.happiness
              : k.happiness !== undefined && k.happiness !== null
                ? k.happiness
                : 100;
          const oldHappiness = cur;
          updates.happiness = Math.min(100, cur + 2);
          const mDelta = updates.happiness - oldHappiness;
          if (mDelta > 0) {
            bonusStr = `+${mDelta} Happiness`;
          } else {
            bonusStr = `Happiness at cap`;
          }
        }
        events.push({
          type: "system",
          message: `🌟 Low Tax Event: ${msg} (${bonusStr})`,
        });
      }
    }

    if (currentTax >= 50) {
      const cur =
        updates.happiness !== undefined
          ? updates.happiness
          : k.happiness !== undefined && k.happiness !== null
            ? k.happiness
            : 100;
      const oldM = cur;
      updates.happiness = Math.max(0, cur - taxPenalty);
      if (updates.happiness !== oldM) {
      }

      if (overcrowdPenalty > 0) {
        const cur2 = updates.happiness;
        const newHappiness = Math.max(0, cur2 - overcrowdPenalty);
        if (newHappiness !== cur2) {
        }
        updates.happiness = newHappiness;
      }
    } else {
      const recovery =
        1 + taxBoost + Math.floor(k.res_entertainment / 200);
      const natCap = naturalHappinessCap(k);
      const cur =
        updates.happiness !== undefined
          ? updates.happiness
          : k.happiness !== undefined && k.happiness !== null
            ? k.happiness
            : 100;
      let newHappiness = Math.min(natCap, cur + recovery);
      let _recoveryReason = `Low taxes / Entertainment`;

      // If currently above natural cap (due to spells/events), natural decay?
      if (cur > natCap) {
        newHappiness = Math.max(natCap, cur - 2); // Natural decay towards cap
        if (newHappiness !== cur) {
        }
      } else if (newHappiness > cur) {
      }

      if (overcrowdPenalty > 0) {
        const afterCrowdHappiness = Math.max(0, newHappiness - overcrowdPenalty);
        if (afterCrowdHappiness !== newHappiness) {
        }
        newHappiness = afterCrowdHappiness;
      }

      if (newHappiness !== cur) {
        updates.happiness = newHappiness;
      }
    }
  }

  // ── 6b. Happiness Threshold Events ───────────────────────────────────────────────
  const currentHappinessThreshold =
    updates.happiness !== undefined
      ? updates.happiness
      : k.happiness !== undefined && k.happiness !== null
        ? k.happiness
        : 100;

  if (currentHappinessThreshold <= 0) {
    // RIOTS
    const currentPop =
      updates.population !== undefined ? updates.population : k.population;
    const popLossPct = 0.02 + Math.random() * 0.03; // 2% to 5%
    const popLost = Math.floor(currentPop * popLossPct);

    const currentGold = updates.gold !== undefined ? updates.gold : k.gold;
    const goldLost = Math.floor(500 + Math.random() * 1500); // 500 to 2000

    updates.population = Math.max(10, currentPop - popLost);
    updates.gold = Math.max(0, currentGold - goldLost);

    // Destroy 1 random building (farm, market, barracks, shrine, or tavern)
    const bldTypes = [];
    if (
      (updates.bld_farms !== undefined ? updates.bld_farms : k.bld_farms) >
      0
    )
      bldTypes.push("bld_farms");
    if (
      (updates.bld_markets !== undefined
        ? updates.bld_markets
        : k.bld_markets) > 0
    )
      bldTypes.push("bld_markets");
    if (
      (updates.bld_barracks !== undefined
        ? updates.bld_barracks
        : k.bld_barracks) > 0
    )
      bldTypes.push("bld_barracks");
    if (
      (updates.bld_shrines !== undefined
        ? updates.bld_shrines
        : k.bld_shrines) > 0
    )
      bldTypes.push("bld_shrines");
    if (
      (updates.bld_taverns !== undefined
        ? updates.bld_taverns
        : k.bld_taverns) > 0
    )
      bldTypes.push("bld_taverns");

    let destBldStr = "";
    if (bldTypes.length > 0) {
      const typeToDest = bldTypes[Math.floor(Math.random() * bldTypes.length)];
      const curType =
        updates[typeToDest] !== undefined
          ? updates[typeToDest]
          : k[typeToDest] || 0;
      updates[typeToDest] = Math.max(0, curType - 1);
      const typeLabel = typeToDest.replace("bld_", "");
      destBldStr = `, and 1 ${typeLabel} was destroyed`;
    }

    const _oldM = updates.happiness !== undefined ? updates.happiness : k.happiness;
    updates.happiness = 5; // Reset happiness
    events.push({
      type: "system",
      message: `RIOTS! Citizens revolt! ${popLost.toLocaleString()} citizens fled/died, ${goldLost.toLocaleString()} gold looted${destBldStr}. Happiness has been reset to 5.`,
    });
  } else if (currentHappinessThreshold > 0 && currentHappinessThreshold < 25) {
    // Critical Unrest (40% chance)
    if (Math.random() < 0.4) {
      const roll = Math.random();
      if (roll < 0.33) {
        // Crime wave
        const currentGold =
          updates.gold !== undefined ? updates.gold : k.gold;
        const goldLost = Math.floor(currentGold * 0.05);
        updates.gold = Math.max(0, currentGold - goldLost);
        events.push({
          type: "system",
          message: `Critical Unrest: Crime wave spreads! ${goldLost.toLocaleString()} gold lost.`,
        });
      } else if (roll < 0.66) {
        // Desertion
        const curFighters =
          updates.fighters !== undefined ? updates.fighters : k.fighters;
        const curRangers =
          updates.rangers !== undefined ? updates.rangers : k.rangers;
        const fLost = Math.floor(curFighters * 0.03);
        const rLost = Math.floor(curRangers * 0.03);
        updates.fighters = Math.max(0, curFighters - fLost);
        updates.rangers = Math.max(0, curRangers - rLost);
        events.push({
          type: "system",
          message: `Critical Unrest: Desertion! ${fLost.toLocaleString()} fighters and ${rLost.toLocaleString()} rangers fled the ranks.`,
        });
      } else {
        // Arson
        const blds = [
          "bld_farms",
          "bld_markets",
          "bld_barracks",
          "bld_shrines",
          "bld_taverns",
          "bld_housing",
          "bld_smithies",
        ];
        const availBlds = blds.filter(
          (b) => (updates[b] !== undefined ? updates[b] : k[b] || 0) > 0,
        );
        if (availBlds.length > 0) {
          const bToDest =
            availBlds[Math.floor(Math.random() * availBlds.length)];
          updates[bToDest] = Math.max(
            0,
            (updates[bToDest] !== undefined
              ? updates[bToDest]
              : k[bToDest] || 0) - 1,
          );
          events.push({
            type: "system",
            message: `Critical Unrest: Arson! 1 ${bToDest.replace("bld_", "")} was burned down.`,
          });
        } else {
          events.push({
            type: "system",
            message: `Critical Unrest: Rioting citizens caused chaos in the streets.`,
          });
        }
      }
    }
  } else if (currentHappinessThreshold >= 25 && currentHappinessThreshold < 50) {
    // Troubled (20% chance)
    if (Math.random() < 0.2) {
      if (Math.random() < 0.5) {
        // Tax evasion
        const currentGold =
          updates.gold !== undefined ? updates.gold : k.gold;
        const goldLost = Math.floor(currentGold * 0.03);
        updates.gold = Math.max(0, currentGold - goldLost);
        events.push({
          type: "system",
          message: `Troubled times: Widespread tax evasion. ${goldLost.toLocaleString()} gold lost.`,
        });
      } else {
        // Flavor only
        const flavors = [
          "Citizens are complaining openly in the town square.",
          "Merchants are grumbling about the state of the kingdom.",
          "Graffiti mocking your leadership has appeared on the castle walls.",
          "A minor brawl erupted in the tavern over political disagreements.",
        ];
        events.push({
          type: "system",
          message: `😒 Unrest: ${flavors[Math.floor(Math.random() * flavors.length)]}`,
        });
      }
    }
  }

  // ── 7. Auto-research — use per-discipline allocation ──────────────────────────
  let schoolBonus = 1 + Math.floor(k.bld_schools / 5) * 0.02;
  const autoSchoolSpeedMult = fragmentBonusManager.getBonusMultiplier(k, 'schools', 'speed');
  const autoSchoolOutputMult = fragmentBonusManager.getBonusMultiplier(k, 'schools', 'output');
  schoolBonus *= (autoSchoolSpeedMult * autoSchoolOutputMult);
  const researchMb = safeJsonParse(k.milestone_bonuses, {}, "research:mb");
  const raceResearch = raceBonus(k, "research") * (1 + (researchMb.research_speed_pct || 0) / 100);
  const raceMagic = raceBonus(k, "magic");
  const researchers = k.researchers;

  const schoolUpgrades = safeJsonParse(
    k.school_upgrades,
    {},
    "processTurn:school_upgrades",
  );
  const curriculumMult = schoolUpgrades.advanced_curriculum ? 1.2 : 1.0;
  const maxSlots = schoolUpgrades.repository ? 2 : 1;

  if (researchers > 0) {
    const ALL_DISCIPLINES = [
      {
        col: "res_economy",
        key: "economy",
        label: "Economy",
        multi: raceResearch,
      },
      {
        col: "res_weapons",
        key: "weapons",
        label: "Weapons",
        multi: raceResearch,
      },
      { col: "res_armor", key: "armor", label: "Armor", multi: raceResearch },
      {
        col: "res_military",
        key: "military",
        label: "Military tactics",
        multi: raceResearch,
      },
      {
        col: "res_attack_magic",
        key: "attack_magic",
        label: "Attack magic",
        multi: raceMagic,
      },
      {
        col: "res_defense_magic",
        key: "defense_magic",
        label: "Defense magic",
        multi: raceMagic,
      },
      {
        col: "res_entertainment",
        key: "entertainment",
        label: "Entertainment",
        multi: raceResearch,
      },
      {
        col: "res_construction",
        key: "construction",
        label: "Construction",
        multi: raceResearch,
      },
      {
        col: "res_war_machines",
        key: "war_machines",
        label: "War machines",
        multi: raceResearch,
      },
      {
        col: "res_spellbook",
        key: "spellbook",
        label: "Spellbook",
        multi: raceMagic,
      },
    ];

    // Research focus — single or dual discipline
    let focus = safeJsonParse(
      k.research_focus,
      [],
      "processTurn:research_focus",
    );
    if (!focus.length) {
      // Auto-select highest current discipline
      const top = ALL_DISCIPLINES.reduce(
        (best, d) => ((k[d.col] || 0) >= (k[best.col] || 0) ? d : best),
        ALL_DISCIPLINES[0],
      );
      focus = [top.key];
      updates.research_focus = JSON.stringify(focus);
    }
    focus = focus.slice(0, maxSlots);
    const perSlot = Math.floor(researchers / focus.length);

    // Get library research speed multiplier
    const libraryResearchMult = fragmentBonusManager.getBonusMultiplier(k, 'libraries', 'research_speed');

    // Get synergy research speed multiplier
    const synergyResearchMult = getSynergyPassiveBonusMultiplier(k, 'research_speed');

    // Get synergy research cost reduction (absolute value, e.g., 0.30 = 30% reduction)
    const synergyResearchCostReduction = getSynergyPassiveBonusAbsolute(k, 'research_cost_reduction');

    let rProgress = safeJsonParse(
      k.research_progress,
      {},
      "processTurn:research_progress",
    );
    const advances = [];
    let resEstimates = [];

    focus.forEach(function (fKey) {
      const d = ALL_DISCIPLINES.find((x) => x.key === fKey);
      if (!d) return;

      const current =
        updates[d.col] !== undefined ? updates[d.col] : k[d.col] || 0;
      const cap = getCap(d.col, k.level || 1);
      if (current >= cap) return; // At cap, no progress

      const effective = Math.floor(
        perSlot * schoolBonus * d.multi * curriculumMult * libraryResearchMult * synergyResearchMult,
      );
      rProgress[d.col] = (rProgress[d.col] || 0) + effective;

      let factor = 1.0;
      if (current > 100) {
        factor = Math.pow(1.05, current - 100);
      }
      let COST_PER_PCT = Math.floor(200 * factor);
      // Apply synergy research cost reduction (e.g., 0.30 means cost is 70% of normal)
      if (synergyResearchCostReduction > 0) {
        COST_PER_PCT = Math.floor(COST_PER_PCT * (1.0 - synergyResearchCostReduction));
      }

      let inc = 0;
      if (rProgress[d.col] >= COST_PER_PCT) {
        inc = Math.floor(rProgress[d.col] / COST_PER_PCT);
        rProgress[d.col] -= inc * COST_PER_PCT;
      }

      if (inc > 0) {
        const newVal = Math.min(cap, current + inc);
        if (newVal !== current) {
          updates[d.col] = newVal;
          advances.push(`${d.label} → ${newVal}%`);
        }
      }

      if (effective > 0) {
        const pct = Math.floor((rProgress[d.col] / COST_PER_PCT) * 100);
        const turnsLeft = Math.ceil(
          (COST_PER_PCT - rProgress[d.col]) / effective,
        );
        resEstimates.push(`${d.label} (${pct}%, ${turnsLeft} turns left)`);
      }
    });

    updates.research_progress = JSON.stringify(rProgress);

    // Award Researcher XP even if no technical advances occurred
    if (researchers > 0) {
      const rXpMult =
        (schoolUpgrades.grand_academy ? 1.5 : 1.0) *
        (focus.length > 0 ? 1.0 : 0.5);
      // Base XP 5 per turn for working + 5 per advance
      const totalRXp = Math.floor((5 + advances.length * 5) * rXpMult);
      const rXp = awardTroopXp(
        { ...k, troop_levels: updates.troop_levels || k.troop_levels },
        "researchers",
        totalRXp,
      );
      updates.troop_levels = typeof rXp.troop_levels === "string" ? JSON.parse(rXp.troop_levels) : rXp.troop_levels;
      if (rXp.levelUps.length)
        events.push({
          type: "system",
          message: `📚 Researchers grew more skilled!`,
        });
    }

    if (advances.length > 0) {
      events.push({
        type: "system",
        message: `📚 Research advanced: ${advances.join(", ")}.`,
      });
      const resXp = awardXp(
        {
          ...k,
          xp: updates.xp || k.xp,
          level: updates.level || k.level || 1,
          xp_sources: xpSourcesAccum,
        },
        "research",
        advances.length,
      );
      updates.xp = resXp.xp;
      updates.level = resXp.level;
      if (resXp.levelled) events.push(...resXp.events);
      Object.assign(xpSourcesAccum, resXp.xp_sources);
    } else if (researchers > 0) {
      if (resEstimates.length > 0) {
        events.push({
          type: "system",
          message: `🔬 ${researchers.toLocaleString()} researchers studying. Est: ${resEstimates.join(", ")}.`,
        });
      } else {
        events.push({
          type: "system",
          message: `🔬 ${researchers.toLocaleString()} researchers studying ${focus.join(" & ")}.`,
        });
      }
    }
  } else {
    events.push({
      type: "system",
      message: `🔬 No researchers assigned — hire researchers and allocate them to advance your kingdom's knowledge.`,
    });
  }

  // ── 7b. Mage research — mages study spellbook (100+) and school_spellbook ──────
  const mages = k.mages || 0;
  if (mages > 0) {
    let mageAlloc = safeJsonParse(k.research_allocation, {}, "processTurn:mage_allocation");
    const spellbookMages = mageAlloc.spellbook_mages || 0;
    const schoolSpellbookMages = mageAlloc.school_spellbook_mages || 0;

    if (spellbookMages > 0 || schoolSpellbookMages > 0) {
      let mageRProgress = safeJsonParse(k.mage_research_progress, {}, "processTurn:mage_research_progress");
      const mageAdvances = [];
      const mageSchoolBonus = schoolBonus; // Same multiplier as researchers
      const mageMult = raceMagic; // Magic bonus for mage research
      const mageLibraryMult = fragmentBonusManager.getBonusMultiplier(k, 'libraries', 'research_speed');

      // Process spellbook research for mages (continuation from 100+)
      if (spellbookMages > 0) {
        const spellCol = "res_spellbook";
        const currentSpell = updates[spellCol] !== undefined ? updates[spellCol] : k[spellCol] || 0;
        const spellCap = getCap(spellCol, k.level || 1);

        if (currentSpell < spellCap) {
          const spellEffective = Math.floor(
            spellbookMages * mageSchoolBonus * mageMult * curriculumMult * mageLibraryMult
          );
          mageRProgress[spellCol] = (mageRProgress[spellCol] || 0) + spellEffective;

          let spellFactor = 1.0;
          if (currentSpell > 100) {
            spellFactor = Math.pow(1.05, currentSpell - 100);
          }
          const spellCost = Math.floor(200 * spellFactor);

          let spellInc = 0;
          if (mageRProgress[spellCol] >= spellCost) {
            spellInc = Math.floor(mageRProgress[spellCol] / spellCost);
            mageRProgress[spellCol] -= spellInc * spellCost;
          }

          if (spellInc > 0) {
            const newSpellVal = Math.min(spellCap, currentSpell + spellInc);
            if (newSpellVal !== currentSpell) {
              updates[spellCol] = newSpellVal;
              mageAdvances.push(`Spellbook -> ${newSpellVal}%`);
            }
          }
        }
      }

      // Process school_spellbook research for mages (0+)
      if (schoolSpellbookMages > 0 && k.school_of_magic) {
        const schoolCol = "school_spellbook";
        const currentSchool = updates[schoolCol] !== undefined ? updates[schoolCol] : k[schoolCol] || 0;
        const schoolCap = getCap(schoolCol, k.level || 1);

        if (currentSchool < schoolCap) {
          const schoolEffective = Math.floor(
            schoolSpellbookMages * mageSchoolBonus * mageMult * curriculumMult * mageLibraryMult
          );
          mageRProgress[schoolCol] = (mageRProgress[schoolCol] || 0) + schoolEffective;

          let schoolFactor = 1.0;
          if (currentSchool > 100) {
            schoolFactor = Math.pow(1.05, currentSchool - 100);
          }
          const schoolCost = Math.floor(200 * schoolFactor);

          let schoolInc = 0;
          if (mageRProgress[schoolCol] >= schoolCost) {
            schoolInc = Math.floor(mageRProgress[schoolCol] / schoolCost);
            mageRProgress[schoolCol] -= schoolInc * schoolCost;
          }

          if (schoolInc > 0) {
            const newSchoolVal = Math.min(schoolCap, currentSchool + schoolInc);
            if (newSchoolVal !== currentSchool) {
              updates[schoolCol] = newSchoolVal;
              mageAdvances.push(`School Spellbook -> ${newSchoolVal}%`);
            }
          }
        }
      }

      updates.mage_research_progress = JSON.stringify(mageRProgress);

      // Award Mage XP
      if (spellbookMages > 0 || schoolSpellbookMages > 0) {
        const mXpMult = schoolUpgrades.grand_academy ? 1.5 : 1.0;
        const totalMXp = Math.floor((5 + mageAdvances.length * 5) * mXpMult);
        const mXp = awardTroopXp(
          { ...k, troop_levels: updates.troop_levels || k.troop_levels },
          "mages",
          totalMXp
        );
        updates.troop_levels = typeof mXp.troop_levels === "string" ? JSON.parse(mXp.troop_levels) : mXp.troop_levels;
        if (mXp.levelUps.length) {
          events.push({
            type: "system",
            message: `✨ Mages grew more skilled!`,
          });
        }
      }

      if (mageAdvances.length > 0) {
        events.push({
          type: "system",
          message: `✨ Mage research advanced: ${mageAdvances.join(", ")}.`,
        });
        const mResXp = awardXp(
          {
            ...k,
            xp: updates.xp || k.xp,
            level: updates.level || k.level || 1,
            xp_sources: xpSourcesAccum,
          },
          "magic",
          mageAdvances.length
        );
        updates.xp = mResXp.xp;
        updates.level = mResXp.level;
        if (mResXp.levelled) events.push(...mResXp.events);
        Object.assign(xpSourcesAccum, mResXp.xp_sources);
      } else if (spellbookMages > 0 || schoolSpellbookMages > 0) {
        const mageEstimates = [];
        if (spellbookMages > 0) mageEstimates.push("Spellbook");
        if (schoolSpellbookMages > 0) mageEstimates.push("School Spellbook");
        events.push({
          type: "system",
          message: `✨ ${(spellbookMages + schoolSpellbookMages).toLocaleString()} mages studying ${mageEstimates.join(" & ")}.`,
        });
      }
    }
  }

  // ── 8. Build queue — engineers work on queued buildings each turn ─────────────
  const buildUpdates = processBuildQueue({ ...k, ...updates }, events, xpSourcesAccum);
  Object.assign(updates, buildUpdates);
  if (buildUpdates.xp_sources_updated) Object.assign(xpSourcesAccum, buildUpdates.xp_sources_updated);

  // ── 8b. Library — mages produce mana, scribes craft maps/blueprints, mages craft scrolls ──
  const libUpdates = processLibrary({ ...k, ...updates }, events);
  Object.assign(updates, libUpdates);

  // ── 8d. Trade & Prestige ─────────────────────────────────────────────────────
  const prestigeLevel = k.prestige_level;
  const legacyTradeRoutes = k.trade_routes;
  const legacyTradeIncome = legacyTradeRoutes * 100 * (1 + prestigeLevel * 0.1);
  if (legacyTradeIncome > 0) {
    updates.gold = (updates.gold || k.gold) + legacyTradeIncome;
    events.push({
      type: "system",
      message: `Trade Routes generated ${legacyTradeIncome.toLocaleString()} gold.`,
    });
  }

  // Bank Deposits processing
  let deposits = safeJsonParse(
    k.bank_deposits,
    [],
    "processTurn:bank_deposits",
  );
  let depositPayout = 0;
  let hasCompleted = false;

  deposits.forEach((dep) => {
    if (dep.status === "active" && updates.turn >= dep.targetTurn) {
      dep.status = "completed";
      depositPayout += dep.returnAmount;
      hasCompleted = true;
    }
  });

  if (hasCompleted) {
    deposits = deposits.filter((d) => d.status === "active");
    updates.bank_deposits = JSON.stringify(deposits);
    updates.gold = (updates.gold || k.gold) + depositPayout;
    events.push({
      type: "system",
      message: `🏦 Bank deposits matured! Earned ${depositPayout.toLocaleString()} gold.`,
    });
  }

  // ── 8d. Defence — calculate defense tiers ───────────────────────────────────────────────
  const tierUpdates = checkDefenseTiers({ ...k, ...updates }, events);
  Object.assign(updates, tierUpdates);

  // ── 8c. Mage tower research — research from mages in towers ──────────────────
  const towerUpdates = processMageTower({ ...k, ...updates }, events);
  Object.assign(updates, towerUpdates);

  // ── 8d. Shrines — clerics boost happiness and prepare to heal ───────────────────
  if (k.race === "vampire") {
    const mausoleumUpdates = processMausoleum({ ...k, ...updates }, events);
    Object.assign(updates, mausoleumUpdates);
  } else {
    const shrineUpdates = processShrine({ ...k, ...updates }, events);
    Object.assign(updates, shrineUpdates);
  }

  // ── 8e. Active effects — tick down debuffs/buffs ─────────────────────────────
  const effectUpdates = processActiveEffects({ ...k, ...updates }, events);
  Object.assign(updates, effectUpdates);

  // ── 9. Training fields — passive troop XP each turn ──────────────────────────
  if (k.bld_training > 0) {
    // troop_levels is now kept as object throughout processTurn, not stringified until save
    let troopLevels = typeof updates.troop_levels === "string"
      ? safeJsonParse(updates.troop_levels, {}, "processTurn:troop_levels")
      : (updates.troop_levels || safeJsonParse(k.troop_levels, {}, "processTurn:troop_levels"));
    if (!troopLevels || typeof troopLevels !== "object") {
      troopLevels = {};
    }
    const allocation = safeJsonParse(
      k.training_allocation,
      {},
      "processTurn:training_allocation",
    );

    const TROOP_TYPES = [
      "fighters",
      "rangers",
      "clerics",
      "mages",
      "thieves",
      "ninjas",
    ];
    const trainingFields = k.bld_training;
    const trainingCapacity = trainingFields * 100;
    let advancedTroops = [];

    TROOP_TYPES.forEach(function (unit) {
      const assigned = Number(allocation[unit]) || 0;
      if (assigned <= 0) return;
      const currentData = troopLevels[unit] || { level: 1, xp: 0, count: 0 };
      if (currentData.level >= 100) return;
      const weaponsEquipped = Math.min(assigned, k.weapons_stockpile);
      const armorEquipped = Math.min(assigned, k.armor_stockpile);
      const equipBonus =
        1 +
        (weaponsEquipped / Math.max(assigned, 1)) * 0.5 +
        (armorEquipped / Math.max(assigned, 1)) * 0.5;
      const raceTrainBonus = TROOP_RACE_BONUS[k.race]?.[unit] || 1.0;
      const trainingSpeedMult = fragmentBonusManager.getBonusMultiplier(k, 'training', 'speed');
      const trainingOutputMult = fragmentBonusManager.getBonusMultiplier(k, 'training', 'output');
      const trainingPowerMult = fragmentBonusManager.getBonusMultiplier(k, 'training', 'power');
      const trainingEffMult = fragmentBonusManager.getBonusMultiplier(k, 'training', 'effectiveness');
      const effectiveTrainingMult = trainingSpeedMult * trainingOutputMult * trainingPowerMult * trainingEffMult;
      const xpGain = Math.floor(
        (trainingCapacity * equipBonus * raceTrainBonus * effectiveTrainingMult) / TROOP_TYPES.length,
      );
      const newXp = currentData.xp + xpGain;
      const xpNeeded = troopXpForLevel(currentData.level + 1);
      if (newXp >= xpNeeded) {
        troopLevels[unit] = {
          level: currentData.level + 1,
          xp: newXp - xpNeeded,
          count: assigned,
        };
        advancedTroops.push(`${unit} → Level ${currentData.level + 1}`);
      } else {
        troopLevels[unit] = { ...currentData, xp: newXp, count: assigned };
      }
    });

    // Keep as object, not stringified — stringify only at save time
    updates.troop_levels = troopLevels;
    if (advancedTroops.length > 0) {
      events.push({
        type: "system",
        message: `⚔️ Troop training advanced: ${advancedTroops.join(", ")}.`,
      });
    } else if (trainingFields > 0 && Object.keys(allocation).length > 0) {
      events.push({
        type: "system",
        message: `⚔️ ${trainingFields} training field(s) active — troops gaining experience.`,
      });
    }
  }

  // ── 9b. Racial passive bonuses ────────────────────────────────────────────────
  // Orc: every 10 fighters (level 5+) trains 1 free fighter per turn
  const orcBonus = racialUnitBonus(
    { ...k, troop_levels: updates.troop_levels || k.troop_levels },
    "fighters",
  );
  if (orcBonus.freeTrainees > 0) {
    const BARRACKS_TROOPS = [
      "fighters",
      "rangers",
      "clerics",
      "thieves",
      "ninjas",
    ];
    const barracksCapacityMult = fragmentBonusManager.getBonusMultiplier(k, 'barracks', 'capacity');
    const barracksCap = Math.floor(k.bld_barracks * 500 * barracksCapacityMult);
    const currentBarracksTroops = BARRACKS_TROOPS.reduce(
      (s, u) => s + (updates[u] !== undefined ? updates[u] : k[u] || 0),
      0,
    );
    const levelCapVal = getCap("fighters", k.level || 1);
    const currentFighters =
      updates.fighters !== undefined ? updates.fighters : k.fighters;

    const barracksSpace = Math.max(0, barracksCap - currentBarracksTroops);
    const levelSpace = Math.max(0, levelCapVal - currentFighters);
    const added = Math.min(orcBonus.freeTrainees, barracksSpace, levelSpace);

    if (added > 0) {
      updates.fighters = currentFighters + added;
      events.push({
        type: "system",
        message: `🪓 Orcish war culture: ${added.toLocaleString()} free fighters trained this turn.`,
      });
    }
  }
  // Human: level 5+ clerics restore 1 happiness per turn
  const humanBonus = racialUnitBonus(
    { ...k, troop_levels: updates.troop_levels || k.troop_levels },
    "clerics",
  );
  if (humanBonus.auraHeal && getAvailableUnits(k, "clerics") > 0) {
    const natCap = naturalHappinessCap(k);
    const cur =
      updates.happiness !== undefined
        ? updates.happiness
        : k.happiness !== undefined && k.happiness !== null
          ? k.happiness
          : 100;
    updates.happiness = Math.min(natCap, cur + 1);
  }

  // ── XP awards this turn ───────────────────────────────────────────────────────
  let totalXp = k.xp;
  let currentLevel = k.level || 1;
  const prevLevel = currentLevel;

  // Turn XP
  const turnXp = awardXp({ ...k, xp: totalXp, level: currentLevel, xp_sources: xpSourcesAccum }, "turn", 1);
  totalXp = turnXp.xp;
  currentLevel = turnXp.level;
  if (turnXp.levelled) events.push(...turnXp.events);
  Object.assign(xpSourcesAccum, turnXp.xp_sources);

  // Gold income XP (rate set to 0 — gold no longer drives XP)
  const goldXp = awardXp(
    { ...k, xp: totalXp, level: currentLevel, xp_sources: xpSourcesAccum },
    "gold_earned",
    income,
  );
  totalXp = goldXp.xp;
  currentLevel = goldXp.level;
  if (goldXp.levelled) events.push(...goldXp.events);
  Object.assign(xpSourcesAccum, goldXp.xp_sources);

  // Research XP (awarded after research section runs)
  // (handled below after DISCIPLINES loop)

  updates.xp = totalXp;
  updates.level = currentLevel;
  updates.xp_sources = JSON.stringify(xpSourcesAccum);

  // ── Milestone check ───────────────────────────────────────────────────────────
  if (currentLevel > prevLevel) {
    const ms = checkMilestones(k, prevLevel, currentLevel);
    if (ms.events.length > 0) {
      events.push(...ms.events);
      const mu = ms.updates;
      if (mu.goldGrant)        updates.gold        = (updates.gold        ?? k.gold        ?? 0) + mu.goldGrant;
      if (mu.landGrant)        updates.land        = (updates.land        ?? k.land        ?? 0) + mu.landGrant;
      if (mu.fightersGrant)    updates.fighters    = (updates.fighters    ?? k.fighters    ?? 0) + mu.fightersGrant;
      if (mu.researchersGrant) updates.researchers = (updates.researchers ?? k.researchers ?? 0) + mu.researchersGrant;
      if (mu.thievesGrant)     updates.thieves     = (updates.thieves     ?? k.thieves     ?? 0) + mu.thievesGrant;
      if (mu.ninjasGrant)      updates.ninjas      = (updates.ninjas      ?? k.ninjas      ?? 0) + mu.ninjasGrant;
      if (mu.milestone_bonuses)  updates.milestone_bonuses  = mu.milestone_bonuses;
      if (mu.milestones_claimed) updates.milestones_claimed = mu.milestones_claimed;
      if (mu.milestone_title)    updates.milestone_title    = mu.milestone_title;
    }
  }

  // ── Racial bonus unlock check — triggers when signature unit hits level 25 ──
  const keyUnit = RACIAL_UNITS[k.race];
  if (keyUnit) {
    // Use already-set updates value if present, else fall back to k
    const racialData = safeJsonParse(
      updates.racial_bonuses_unlocked || k.racial_bonuses_unlocked,
      {},
      "processTurn:racial_bonuses_unlocked",
    );
    if (!racialData[keyUnit]) {
      const tls = safeJsonParse(
        updates.troop_levels || k.troop_levels,
        {},
        "processTurn:troop_levels_racial_check",
      );
      const unitLevel = tls[keyUnit]?.level || 1;
      if (unitLevel >= 25) {
        racialData[keyUnit] = true;
        updates.racial_bonuses_unlocked = JSON.stringify(racialData);
        const RACIAL_MSGS = {
          dwarf:
            "⚒️ Your engineers have reached mastery — Dwarven war machines now need only 1 engineer to crew.",
          high_elf:
            "✨ Your mages have reached mastery — High Elf scrolls now produce 2 per craft.",
          orc: "⚔️ Your fighters have reached mastery — Orcish war culture now trains 1 free fighter per 10 each turn.",
          dark_elf:
            "🕵️ Your ninjas have reached mastery — Dark Elf assassinations now leave no trace.",
          dire_wolf:
            "🐺 Your rangers have reached mastery — Dire Wolf expeditions now return 1 turn early.",
          human:
            "💚 Your clerics have reached mastery — Human healing aura now restores +1 happiness per turn.",
        };
        if (RACIAL_MSGS[k.race])
          events.push({ type: "system", message: RACIAL_MSGS[k.race] });
      }
    }
  }

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

  return { updates, events: events.map(cleanNewsEvent) };
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
      );

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
        const other = await getRandomKingdom(db, freshK.id);
        if (other) {
          let disc = {};
          try {
            disc = safeJsonParse(freshK.discovered_kingdoms, {}, "auto:discovered_kingdoms");
          } catch {}
          if (!disc[other.id]) {
            disc[other.id] = { found: true, name: other.name };
            updates.discovered_kingdoms = JSON.stringify(disc);
            rewards.push({
              text: `Your rangers discovered the kingdom of ${other.name}!`,
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

      const label = {
        scout: "🔭 Scout",
        deep: "🌲 Deep",
        dungeon: "⚔️ Dungeon",
        mountain: "🏔️ Mountain",
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

      // ONE news line only — rewards go to expedition log, not news feed
      const completionMsg = `${label} expedition returned -- check the Explore tab for rewards.`;
      expeditionEvents.push({ type: "system", message: completionMsg });

      // Throne broadcast only (batch inserts to prevent memory spike)
      if (serverAnnounce) {
        const BATCH_SIZE = 1000;
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
          const batch = await db.all("SELECT id FROM kingdoms LIMIT ? OFFSET ?", [BATCH_SIZE, offset]);
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
      // Rewards failed — expedition is already marked complete (turns_left=0), troops return, no reward
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
      const errMsg = `${exp.type} expedition returned -- an error occurred calculating rewards (troops returned safely).`;
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
                message: `🚩 REGION CAPTURED: The alliance [${alliance.name}] has seized control of ${region.name}!`,
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

// ── Building demolition (extracted to game/lib/building-research.js) ────────

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
