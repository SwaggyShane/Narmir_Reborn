// game/turn.js
// Per-turn processing domain -- processTurn and its local helpers.
// Extracted from game/engine.js (Phase 5). engine.js re-exports all symbols
// via module.exports for backward compatibility.

const config = require("./config");
const { progressGoal } = require('./goals');
const fragmentBonusManager = require("./fragment-bonus-manager");
const effectsProcessor = require("./synergy-effects-processor");
const { safeJsonParse, clearParseCache } = require('../utils/helpers');
const { raceBonus } = require('./lib/race-bonus');
const {
  troopXpForLevel,
  awardTroopXp,
  unitLevelMult,
  racialUnitBonus,
  awardUnitXp,
  getAvailableUnits,
} = require('./lib/troops');
const {
  getSynergyPassiveBonusMultiplier,
  getSynergyPassiveBonusAbsolute,
} = require('./lib/synergy-cache');
const { naturalHappinessCap } = require('./lib/happiness-cap');
const {
  goldPerTurn,
  calculateTradeIncome,
  processResourceYield,
  processFoodEconomy,
} = require('./economy');
const {
  manaPerTurn,
  processMageTower,
  processShrine,
  processMausoleum,
  processLibrary,
} = require('./magic');
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
} = require('./attunements');
const { checkDefenseTiers } = require('./defense');
const { awardEngineerXp } = require('./engineers');
const { awardXp, checkMilestones } = require('./xp');
const { housingCapPerBuilding, popGrowth } = require('./population');

const {
  PRESTIGE_MODIFIERS,
  TROOP_RACE_BONUS,
  LOCATE_RACE_MULT,
  BUILDING_COST,
  BUILDING_GOLD_COST,
  BUILDING_LAND_COST,
  SUPPORT_CAP_RACE,
  BUILDING_ALIASES,
  RACIAL_UNITS,
  CAPS,
  BUILDING_COL,
  TOOL_COL,
  RESOURCE_BUILDING_CONFIG,
  BUILDING_WOOD_COST,
  BUILDING_STONE_COST,
  BUILDING_IRON_COST,
  BLUEPRINT_REQUIRED: BP_REQ,
  SCAFFOLDING_REQUIRED: SCAFF_REQ,
} = config;

const BLUEPRINT_REQUIRED = new Set(BP_REQ);
const SCAFFOLDING_REQUIRED = new Set(SCAFF_REQ);

function getHappinessRecoveryRate(k) {
  const baseRecovery = (k.res_entertainment || 100) / 1200 + ((k.bld_taverns || 0) * 0.2);
  return Math.max(0.2, Math.min(2.8, baseRecovery));
}

function calculateHappiness(k) {
  const raceModifiers = {
    dire_wolf: 10,
    human: 5,
    orc: 5,
    dwarf: 0,
    high_elf: -5,
    dark_elf: -10,
    vampire: -10
  };

  // 1. Food Happiness (0-30)
  const foodTarget = (k.population || 1) * 0.5;
  const foodRatio = foodTarget > 0 ? (k.food || 0) / foodTarget : 1;
  const foodHappiness = Math.min(30, Math.floor(foodRatio * 30));

  // 2. Entertainment Happiness (0-20)
  const entertainmentHappiness = Math.min(20, Math.floor((k.bld_taverns || 0) * 1.5));

  // 3. Safety Happiness (-30 to +20)
  let safetyHappiness = 0;
  if (!k.last_attack_turn) {
    safetyHappiness = 20; // Never attacked
  } else {
    const turnsSinceLast = Math.max(0, (k.turn || 0) - k.last_attack_turn);
    // Slower recovery: -15 at turn 0, +15 at turn 15, capped at 20
    safetyHappiness = -15 + Math.min(15, turnsSinceLast) * 2;
  }
  safetyHappiness = Math.max(-30, Math.min(20, safetyHappiness));

  const turnsSinceAttack = k.last_attack_turn ? Math.max(0, (k.turn || 0) - k.last_attack_turn) : null;
  const warWearinessComponent = turnsSinceAttack === null
    ? 0
    : -Math.max(0, Math.min(8, Math.floor((24 - Math.min(24, turnsSinceAttack)) * 0.35)));

  // 4. Prosperity Happiness (0-20)
  const goldTarget = (k.population || 1) * 2;
  const goldRatio = goldTarget > 0 ? (k.gold || 0) / goldTarget : 1;
  const prosperityHappiness = Math.min(20, Math.floor(goldRatio * 20));

  // 5. Race Modifier
  const raceModifier = raceModifiers[k.race] || 0;

  // 6. Empire Size Pressure
  const populationBase = Math.max(1, k.population || 1);
  const sizeComponent = -Math.min(30, Math.floor(Math.log10(populationBase) * 5));

  // Base + components
  let happiness = 50 + foodHappiness + entertainmentHappiness + safetyHappiness + warWearinessComponent + prosperityHappiness + raceModifier + sizeComponent;

  // Apply active effect bonuses (Bless, Divine Favor, etc.)
  const effects = safeJsonParse(k.active_effects, {}, "calculateHappiness:active_effects");
  if (effects.bless && typeof effects.bless === "object" && typeof effects.bless.happiness_bonus === "number") {
    happiness += effects.bless.happiness_bonus;
  }
  if (effects.divine_favor && typeof effects.divine_favor === "object" && typeof effects.divine_favor.happiness_bonus === "number") {
    happiness += effects.divine_favor.happiness_bonus;
  }

  // Apply synergy passive happiness bonus (absolute value, can be positive or negative)
  const synergyHappinessBonus = getSynergyPassiveBonusAbsolute(k, 'happiness');
  happiness += synergyHappinessBonus;

  // Race + hero happiness multipliers (RACE_BONUSES.happiness, Paladin's
  // Unyielding Faith, Blood Matriarch's Sanguine Bond) scaled to ±20 points
  happiness += Math.round((raceBonus(k, "happiness") - 1) * 20);

  // Apply tax penalty/bonus
  const taxRate = k.tax ?? 42;
  if (taxRate > 42) {
    const taxPenalty = Math.floor(((taxRate - 42) / 58) * 85);
    happiness -= taxPenalty;
  } else if (taxRate < 42) {
    const taxBonus = Math.floor(12 * ((42 - taxRate) / 42));
    happiness += taxBonus;
  }

  // Apply happiness recovery based on research + taverns and clamp to -50 to 120
  const recoveryRate = getHappinessRecoveryRate(k);
  happiness = Math.floor(Math.max(-50, Math.min(120, happiness + recoveryRate)));

  // Apply persistent fragment happiness penalty (accumulated via attunement effects)
  const fragmentPenalty = effects.fragment_happiness_penalty || 0;
  if (fragmentPenalty < 0) {
    happiness = Math.max(-50, happiness + fragmentPenalty);
  }

  return {
    happiness,
    components: {
      base: 50,
      food: foodHappiness,
      entertainment: entertainmentHappiness,
      safety: safetyHappiness,
      warWeariness: warWearinessComponent,
      prosperity: prosperityHappiness,
      race: raceModifier,
      size: sizeComponent
    },
    recovery: recoveryRate
  };
}

async function recordHappinessHistory(db, kingdomId, turn, happinessData) {
  try {
    await db.run(
      `INSERT INTO happiness_history
       (kingdom_id, turn, happiness_value, food_component, entertainment_component, safety_component, prosperity_component, race_modifier)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(kingdom_id, turn) DO UPDATE SET
       happiness_value = EXCLUDED.happiness_value,
       food_component = EXCLUDED.food_component,
       entertainment_component = EXCLUDED.entertainment_component,
       safety_component = EXCLUDED.safety_component,
       prosperity_component = EXCLUDED.prosperity_component,
       race_modifier = EXCLUDED.race_modifier`,
      [
        kingdomId,
        turn,
        happinessData.happiness,
        happinessData.components.food,
        happinessData.components.entertainment,
        happinessData.components.safety,
        happinessData.components.prosperity,
        happinessData.components.race
      ]
    );
  } catch (err) {
    console.error(`[happiness] recordHappinessHistory error: ${err.message}`);
  }
}

async function logHappinessEvent(db, kingdomId, turn, eventData) {
  try {
    await db.run(
      `INSERT INTO happiness_events
       (kingdom_id, turn, event_type, old_happiness, new_happiness, component, delta, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        kingdomId,
        turn,
        eventData.event_type,
        eventData.old_happiness,
        eventData.new_happiness,
        eventData.component,
        eventData.delta,
        eventData.description
      ]
    );
  } catch (err) {
    console.error(`[happiness] logHappinessEvent error: ${err.message}`);
  }
}

// ── Season system ─────────────────────────────────────────────────────────────

// ── Location system ───────────────────────────────────────────────────────────

function calcDiscoveryChance(k) {
  const baseChance = 0.05; // 5% base
  const race = k.race || "human";
  const raceMult = LOCATE_RACE_MULT[race] || 1.0;
  return baseChance * raceMult;
}

function processLocationMapsWip(k, events) {
  const updates = {};
  const wip = safeJsonParse(
    k.location_maps_wip,
    [],
    "processLocationMapsWip:location_maps_wip",
  );
  if (!wip.length) return updates;

  const scribesAvail = k.scribes;
  let scribesUsed = 0;
  const completed = [];
  const remaining = [];

  for (const item of wip) {
    const cost = 10; // scribes required
    if (scribesUsed + cost > scribesAvail) {
      remaining.push(item);
      continue;
    }
    scribesUsed += cost;
    item.turns_remaining = (item.turns_remaining || 5) - 1;
    if (item.turns_remaining <= 0) {
      completed.push(item);
      const disc = safeJsonParse(
        k.discovered_kingdoms,
        {},
        "processLocationMapsWip:discovered_kingdoms",
      );
      disc[item.target_id] = { found: true, mapped: true };
      updates.discovered_kingdoms = JSON.stringify(disc);
      events.push({
        type: "system",
        message: `🗺️ Scribes have completed a location map for ${item.target_name}. You may now interact with them.`,
      });
    } else {
      remaining.push(item);
    }
  }

  updates.location_maps_wip = JSON.stringify(remaining);
  return updates;
}

module.exports = {
  getHappinessRecoveryRate,
  calculateHappiness,
  recordHappinessHistory,
  logHappinessEvent,
  calcDiscoveryChance,
  processLocationMapsWip,
  processMercenaries,
  rebellionCheck,
  rebellionEvent,
  processTurn,
  checkAchievements,
  levelCap,
  getCap,
  processBuildQueue,
  processActiveEffects,
};
