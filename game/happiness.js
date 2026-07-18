// Happiness domain: happiness calculation, rebellion events, and combat
// multipliers derived from happiness.

const { safeJsonParse } = require('../utils/helpers');
const { raceBonus } = require('./lib/race-bonus');
const { getSynergyPassiveBonusAbsolute } = require('./lib/synergy-cache');
const fragmentBonusManager = require('./fragment-bonus-manager');
const { housingCapPerBuilding } = require('./population');
const { happinessMult, happinessCombatMult } = require('./lib/combat-helpers');
const { rebellionCheck, rebellionEvent } = require('./lib/special-events');

// Max points happiness can CLIMB in a single turn when conditions are improving.
// Falling has no cap (bad conditions hit immediately) — this only throttles recovery,
// so a kingdom can't undo several bad turns with one good one. Taverns/entertainment
// raise the cap (investment = faster recovery); high tax drags it down even while
// recovering. Tuned so a modestly-invested kingdom (~4 taverns, ~150 entertainment,
// default tax) takes roughly 15 turns to climb from crashed back to healthy.
function getHappinessRiseCap(k) {
  const taverns = k.bld_taverns || 0;
  const entertainment = k.res_entertainment || 100;
  const taxRate = Number(k.tax ?? 42);
  const taxDrag = taxRate > 42 ? Math.min(3, Math.floor((taxRate - 42) / 20)) : 0;
  const raw = 2 + taverns * 0.7 + entertainment / 200 - taxDrag;
  return Math.max(1, Math.min(15, raw));
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

  // 4b. War Weariness (-8 to 0) — a lighter lingering penalty after attacks
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
  const effects = safeJsonParse(k.active_effects, {}, 'calculateHappiness:active_effects');
  let effectComponent = 0;
  if (effects.bless && typeof effects.bless === 'object' && typeof effects.bless.happiness_bonus === 'number') {
    effectComponent += effects.bless.happiness_bonus;
  }
  if (effects.divine_favor && typeof effects.divine_favor === 'object' && typeof effects.divine_favor.happiness_bonus === 'number') {
    effectComponent += effects.divine_favor.happiness_bonus;
  }
  happiness += effectComponent;

  // Apply synergy passive happiness bonus (absolute value, can be positive or negative)
  const synergyHappinessBonus = getSynergyPassiveBonusAbsolute(k, 'happiness');
  happiness += synergyHappinessBonus;

  // Race + hero happiness multipliers (RACE_BONUSES.happiness, Paladin's
  // Unyielding Faith, Blood Matriarch's Sanguine Bond) scaled to ±20 points
  happiness += Math.round((raceBonus(k, 'happiness') - 1) * 20);

  // Apply tax penalty/bonus — use nullish coalesce to allow 0% tax
  let taxComponent = 0;
  const taxRate = k.tax !== undefined && k.tax !== null ? k.tax : 42;
  if (taxRate > 42) {
    taxComponent = -Math.floor(((taxRate - 42) / 58) * 85);
    happiness += taxComponent;
  } else if (taxRate < 42) {
    taxComponent = Math.floor(12 * ((42 - taxRate) / 42));
    happiness += taxComponent;
  }

  // Housing overcrowding penalty
  const capPerBuilding = housingCapPerBuilding(k);
  let housingCap = (k.bld_housing || 0) * capPerBuilding;
  const housingMult = fragmentBonusManager.getBonusMultiplier(k, 'housing', 'capacity');
  housingCap *= housingMult;
  const overcrowdingThreshold = housingCap * 1.3;
  const overcrowded = housingCap > 0 && (k.population || 0) > overcrowdingThreshold;
  let overcrowdingComponent = 0;
  if (overcrowded) {
    let overcrowdMult = { dire_wolf: 0.5, high_elf: 2.0 }[k.race] || 1.0;
    const activeHousingSpecial = fragmentBonusManager.getSpecialEffect(k, 'housing');
    if (activeHousingSpecial?.name === 'Goliath Dwellings') {
      overcrowdMult *= 0.2;
    }
    overcrowdingComponent = -Math.max(
      0,
      Math.floor(Math.max(0, ((k.population || 0) - overcrowdingThreshold) * 0.018 * overcrowdMult))
    );
    happiness += overcrowdingComponent;
  }

  // Apply persistent fragment happiness penalty (accumulated via attunement effects)
  // into the target itself, so a lingering curse also slows recovery, not just the
  // final number.
  const fragmentPenalty = effects.fragment_happiness_penalty || 0;
  happiness += fragmentPenalty;

  // `happiness` above is the TARGET the kingdom is pulling toward given this turn's
  // conditions. The actual stored value only moves toward it — falling is immediate
  // (bad conditions bite right away), but climbing is capped per turn via
  // getHappinessRiseCap, so a single good turn can't erase several bad ones. This is
  // the only place happiness is written; there is no second recovery pass.
  const target = Math.floor(Math.max(-50, Math.min(120, happiness)));
  const current = (k.happiness !== undefined && k.happiness !== null) ? k.happiness : target;
  const riseCap = getHappinessRiseCap(k);
  const finalHappiness = Math.floor(target <= current ? target : Math.min(target, current + riseCap));

  return {
    happiness: finalHappiness,
    components: {
      base: 50,
      food: foodHappiness,
      entertainment: entertainmentHappiness,
      safety: safetyHappiness,
      warWeariness: warWearinessComponent,
      prosperity: prosperityHappiness,
      race: raceModifier,
      size: sizeComponent,
      effects: effectComponent,
      synergy: synergyHappinessBonus,
      tax: taxComponent,
      overcrowding: overcrowdingComponent,
      fragments: fragmentPenalty
    },
    target,
    recovery: riseCap
  };
}

// happinessMult, happinessCombatMult (game/lib/combat-helpers.js) and
// rebellionCheck, rebellionEvent (game/lib/special-events.js) are the canonical
// implementations — engine.js imports them from those modules directly. They're
// re-exported here so `require('./happiness')` remains a single entry point for
// all happiness-related behavior, without maintaining a second copy of the logic.

module.exports = {
  calculateHappiness,
  getHappinessRiseCap,
  happinessMult,
  happinessCombatMult,
  rebellionCheck,
  rebellionEvent,
};
