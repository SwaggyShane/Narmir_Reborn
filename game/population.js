// Population domain: housing capacity, population growth, and research increment.

const { safeJsonParse } = require('../utils/helpers');
const fragmentBonusManager = require('./fragment-bonus-manager');
const { raceBonus } = require('./lib/race-bonus');
const { unitLevelMult } = require('./lib/troops');
const { getSynergyPassiveBonusMultiplier } = require('./lib/synergy-cache');
const config = require('./config');
const { HOUSING_CAP_BY_RACE, PRESTIGE_MODIFIERS } = config;

function housingCapPerBuilding(k) {
  const base = HOUSING_CAP_BY_RACE[k?.race] || 500;
  if (!k?.prestige_level) return base;
  const mod = PRESTIGE_MODIFIERS[Math.min(k.prestige_level, 5)]?.pop || 1.0;
  return Math.floor(base * mod);
}

function popGrowth(k) {
  const happiness = k.happiness !== undefined && k.happiness !== null ? k.happiness : 50;

  // Apply happiness-based growth multiplier
  let happinessMult = 1.0;
  if (happiness >= 80) {
    happinessMult = 1.3; // Thriving
  } else if (happiness >= 50) {
    happinessMult = 1.0; // Normal
  } else if (happiness >= 30) {
    happinessMult = 0.7; // Concerned
  } else if (happiness >= 0) {
    happinessMult = 0.3; // Unhappy
  } else {
    happinessMult = -0.05; // Fleeing (population loss)
  }

  // Handle fleeing population
  if (happiness < 0) {
    return Math.floor(k.population * happinessMult);
  }

  const capPerBuilding = housingCapPerBuilding(k);
  let housingCap = k.bld_housing * capPerBuilding;

  // Apply world fragment bonuses for housing
  const housingMult = fragmentBonusManager.getBonusMultiplier(k, 'housing', 'capacity');
  housingCap *= housingMult;

  // Apply synergy troop capacity bonus
  housingCap *= 1.0;

  const pop = k.population;

  let growthMult = happinessMult;

  // Apply Bless growth boost if active
  const effects = safeJsonParse(
    k.active_effects,
    {},
    'popGrowth:active_effects',
  );
  if (effects.bless) {
    growthMult *= 1.5; // 50% growth boost from bless
  }

  // Apply world fragment bonuses for housing growth (e.g., Tears of the World Tree)
  const housingGrowthMult = fragmentBonusManager.getBonusMultiplier(k, 'housing', 'growth');
  growthMult *= housingGrowthMult;

  // Synergy passive bonus for population growth
  const synergyPopMult = getSynergyPassiveBonusMultiplier(k, 'population_growth');
  growthMult *= synergyPopMult;

  // Hero population bonuses (Grand Chancellor's Royal Decree, Alpha's
  // Predatory Growth, Blood Matriarch's Sanguine Bond)
  growthMult *= raceBonus(k, 'population');

  if (housingCap === 0) return 0;
  if (pop >= housingCap * 2) return 0;
  if (pop > housingCap) growthMult = 0.1;

  const base = Math.floor(pop * 0.003);
  const entertainment = Math.floor(k.res_entertainment / 100) * 10;
  const raceGrowthMult =
    {
      high_elf: 0.8,
      dwarf: 0.9,
      dire_wolf: 1.0,
      dark_elf: 0.85,
      human: 1.15,
      orc: 1.1,
    }[k.race] || 1.0;
  return Math.floor((base + entertainment) * raceGrowthMult * growthMult);
}

function researchIncrement(k, discipline, researchersAssigned, currentLevel) {
  let schoolBonus = 1 + Math.floor((k.bld_schools || 0) / 5) * 0.02;
  const schoolSpeedMult = fragmentBonusManager.getBonusMultiplier(k, 'schools', 'speed');
  const schoolOutputMult = fragmentBonusManager.getBonusMultiplier(k, 'schools', 'output');
  schoolBonus *= (schoolSpeedMult * schoolOutputMult);
  const raceMulti =
    discipline === 'spellbook' || discipline === 'school_spellbook'
      ? raceBonus(k, 'magic')
      : raceBonus(k, 'research');
  const resLevelMult = unitLevelMult(k, 'researchers');
  const libraryResearchMult = fragmentBonusManager.getBonusMultiplier(k, 'libraries', 'research_speed');

  // Apply happiness multiplier
  const happiness = k.happiness !== undefined && k.happiness !== null ? k.happiness : 50;
  const happinessMult = Math.max(0, 0.5 + (happiness / 100));

  // Synergy passive bonus for research speed
  const synergyResearchMult = getSynergyPassiveBonusMultiplier(k, 'research_speed');

  const effective = Math.floor(
    researchersAssigned * schoolBonus * raceMulti * resLevelMult * libraryResearchMult * happinessMult * synergyResearchMult,
  );

  let factor = 1.0;
  if (currentLevel > 100) {
    // Exponentially harder: +5% cost compounding per point above 100
    // Level 150 requires ~11x more researchers, Level 200 requires ~131x more.
    factor = Math.pow(1.05, currentLevel - 100);
  }

  if (effective >= Math.floor(2000 * factor)) return 5;
  if (effective >= Math.floor(1200 * factor)) return 3;
  if (effective >= Math.floor(600 * factor)) return 2;
  if (effective >= Math.floor(200 * factor)) return 1;
  return 0;
}

module.exports = {
  housingCapPerBuilding,
  popGrowth,
  researchIncrement,
};
