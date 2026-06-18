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
  const baseRecovery = (k.res_entertainment || 100) / 1000 + ((k.bld_taverns || 0) * 0.25);
  return Math.max(0.5, Math.min(5, baseRecovery));
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
    // Linear recovery: -10 at turn 0, +20 at turn 10, capped at 20
    safetyHappiness = -10 + Math.min(10, turnsSinceLast) * 3;
  }
  safetyHappiness = Math.max(-30, Math.min(20, safetyHappiness));

  // 4. Prosperity Happiness (0-20)
  const goldTarget = (k.population || 1) * 2;
  const goldRatio = goldTarget > 0 ? (k.gold || 0) / goldTarget : 1;
  const prosperityHappiness = Math.min(20, Math.floor(goldRatio * 20));

  // 5. Race Modifier
  const raceModifier = raceModifiers[k.race] || 0;

  // Base + components
  let happiness = 50 + foodHappiness + entertainmentHappiness + safetyHappiness + prosperityHappiness + raceModifier;

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
    const taxPenalty = Math.floor(((taxRate - 42) / 58) * 60);
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
      prosperity: prosperityHappiness,
      race: raceModifier
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

// Ã¢â€â‚¬Ã¢â€â‚¬ Season system Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

// ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ Location system ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬

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
        message: `☣️ Plague ravages your kingdom — ${lost.toLocaleString()} citizens have perished.`,
        });
      } else if (effect === "silence") {
        // Research suppressed — handled in processTurn by checking for silence
      } else if (effect === "summon_rats") {
        const foodDmg = data.food_damage_per_turn || 0;
        if (foodDmg > 0) {
          updates.food = Math.max(0, (updates.food !== undefined ? updates.food : k.food) - foodDmg);
          events.push({ type: "attack", message: `🐀 Summoned rats devour ${foodDmg.toLocaleString()} food from your stores.` });
        }
      } else if (effect === "life_drain_aura") {
        const drainPct = data.population_drain || 0.1;
        const lost = Math.floor(k.population * drainPct);
        if (lost > 0) {
          updates.population = Math.max(0, (updates.population !== undefined ? updates.population : k.population) - lost);
          events.push({ type: "attack", message: `💀 Life drain aura saps ${lost.toLocaleString()} population from your kingdom.` });
        }
      } else if (effect === "mutate_crops") {
        const penalty = data.food_penalty || 0.3;
        const foodLost = Math.floor(k.food * penalty);
        if (foodLost > 0) {
          updates.food = Math.max(0, (updates.food !== undefined ? updates.food : k.food) - foodLost);
          events.push({ type: "attack", message: `🌿 Mutated crops rot — ${foodLost.toLocaleString()} food spoiled.` });
        }
      } else if (effect === "command_legion") {
        const friendlyFire = data.damage_per_turn || 0;
        if (friendlyFire > 0) {
          updates.fighters = Math.max(0, (updates.fighters !== undefined ? updates.fighters : k.fighters) - friendlyFire);
          events.push({ type: "attack", message: `⚔️ Command legion confusion — ${friendlyFire.toLocaleString()} fighters lost to friendly fire.` });
        }
      } else if (effect === "conjure_abundance") {
        // Unlimited food: generate food equal to 20% of population each turn
        const foodGenerated = Math.floor(k.population * 0.2);
        updates.food = (updates.food !== undefined ? updates.food : k.food) + foodGenerated;
        events.push({ type: "system", message: `🌾 Conjured abundance generates ${foodGenerated.toLocaleString()} food.` });
      } else if (effect === "death_dominion") {
        // Enemy deaths reanimate under control — bonus fighters each turn based on flag
        const bonusFighters = Math.floor(k.fighters * 0.01);
        if (bonusFighters > 0) {
          updates.fighters = (updates.fighters !== undefined ? updates.fighters : k.fighters) + bonusFighters;
        }
      }
      effects[effect] = { ...data, turns_left: remaining };
    }
  }

  expired.forEach((e) => delete effects[e]);
  updates.active_effects = JSON.stringify(effects);
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




