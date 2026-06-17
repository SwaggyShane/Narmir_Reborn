/**
 * Happiness System
 * Handles kingdom happiness calculation and history recording
 */

const { safeJsonParse } = require('../utils/helpers');
const { raceBonus } = require('./lib/race-bonus');
const { getSynergyPassiveBonusAbsolute } = require('./lib/synergy-cache');

function assignRegion(race) {
  return race; // simple mapping for now: race name = region id
}


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
  // Unyielding Faith, Blood Matriarch's Sanguine Bond) scaled to Ãƒâ€šÃ‚Â±20 points
  happiness += Math.round((raceBonus(k, "happiness") - 1) * 20);

  // Apply tax penalty/bonus
  const taxRate = k.tax || 42;
  if (taxRate > 42) {
    const taxPenalty = Math.floor(((taxRate - 42) / 58) * 30);
    happiness -= taxPenalty;
  } else if (taxRate < 42) {
    const taxBonus = Math.floor(45 * ((42 - taxRate) / 42));
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
module.exports = {
  assignRegion,
  getHappinessRecoveryRate,
  calculateHappiness,
  recordHappinessHistory,
};
