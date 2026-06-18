// Happiness domain: happiness calculation, rebellion events, and combat
// multipliers derived from happiness.

const { safeJsonParse } = require('../utils/helpers');
const { raceBonus } = require('./lib/race-bonus');
const { getSynergyPassiveBonusAbsolute } = require('./lib/synergy-cache');

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
  const effects = safeJsonParse(k.active_effects, {}, 'calculateHappiness:active_effects');
  if (effects.bless && typeof effects.bless === 'object' && typeof effects.bless.happiness_bonus === 'number') {
    happiness += effects.bless.happiness_bonus;
  }
  if (effects.divine_favor && typeof effects.divine_favor === 'object' && typeof effects.divine_favor.happiness_bonus === 'number') {
    happiness += effects.divine_favor.happiness_bonus;
  }

  // Apply synergy passive happiness bonus (absolute value, can be positive or negative)
  const synergyHappinessBonus = getSynergyPassiveBonusAbsolute(k, 'happiness');
  happiness += synergyHappinessBonus;

  // Race + hero happiness multipliers (RACE_BONUSES.happiness, Paladin's
  // Unyielding Faith, Blood Matriarch's Sanguine Bond) scaled to ±20 points
  happiness += Math.round((raceBonus(k, 'happiness') - 1) * 20);

  // Apply tax penalty/bonus — use nullish coalesce to allow 0% tax
  const taxRate = k.tax !== undefined && k.tax !== null ? k.tax : 42;
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

function happinessMult(happiness) {
  if (happiness < 50) return 0.8 + (happiness / 50) * 0.1; // 0.80–0.90
  if (happiness < 100) return 0.9 + ((happiness - 50) / 50) * 0.1; // 0.90–1.00
  return Math.min(1.2, 1.0 + ((happiness - 100) / 100) * 0.1); // 1.00–1.20 (capped at 1.20)
}

function happinessCombatMult(happiness) {
  const mult = 0.5 + (happiness / 120);
  return Math.max(0.5, Math.min(1.5, mult));
}

function rebellionEvent(k, updates, events) {
  const eventType = Math.floor(Math.random() * 5) + 1; // 1-5

  updates.rebellion_cooldown = k.turn + 20;

  let newsMessage = '';

  switch (eventType) {
    case 1: { // Unrest - population loss
      const lossPercent = 0.05 + Math.random() * 0.05; // 5-10%
      const populationLoss = Math.floor((k.population || 0) * lossPercent);
      updates.population = Math.max(100, (updates.population || k.population) - populationLoss);
      newsMessage = `⚠️ UNREST: Population fleeing due to unhappiness! Lost ${populationLoss.toLocaleString()} people.`;
      break;
    }

    case 2: { // Tax Revolt
      const newTaxCap = Math.max(10, (updates.tax || k.tax) - 10);
      updates.tax = newTaxCap;
      newsMessage = `⚠️ TAX REVOLT: Population refuses higher taxes. Tax reduced to ${newTaxCap}%!`;
      break;
    }

    case 3: { // Building Sabotage
      const buildingTypes = ['bld_taverns', 'bld_markets', 'bld_shrines', 'bld_schools', 'bld_mage_towers'];
      const buildingNames = {
        bld_taverns: 'taverns',
        bld_markets: 'markets',
        bld_shrines: 'shrines',
        bld_schools: 'schools',
        bld_mage_towers: 'mage towers'
      };
      const availableBuildings = buildingTypes.filter(b => (k[b] || 0) > 0);

      if (availableBuildings.length > 0) {
        const randomBuilding = availableBuildings[Math.floor(Math.random() * availableBuildings.length)];
        const buildingCount = k[randomBuilding];
        const damageCount = Math.min(buildingCount, Math.floor(Math.random() * 3) + 1); // 1-3 buildings
        updates[randomBuilding] = Math.max(0, (updates[randomBuilding] || buildingCount) - damageCount);
        newsMessage = `⚠️ SABOTAGE: Rioters destroyed ${damageCount} ${buildingNames[randomBuilding]}!`;
      } else {
        const lossPercent = 0.02 + Math.random() * 0.03; // 2-5%
        const populationLoss = Math.floor((k.population || 0) * lossPercent);
        updates.population = Math.max(100, (updates.population || k.population) - populationLoss);
        newsMessage = `⚠️ UNREST: Rioters clashed with guards! Lost ${populationLoss.toLocaleString()} people.`;
      }
      break;
    }

    case 4: { // Food Riot
      let foodRiotTriggered = false;
      if ((k.food || 0) < (k.population || 0) * 0.1) {
        const buildingTypes = ['bld_granaries', 'bld_farms'];
        const buildingNames = { bld_granaries: 'granaries', bld_farms: 'farms' };
        const availableBuildings = buildingTypes.filter(b => (k[b] || 0) > 0);

        if (availableBuildings.length > 0) {
          const randomBuilding = availableBuildings[Math.floor(Math.random() * availableBuildings.length)];
          const buildingCount = k[randomBuilding];
          const damageCount = Math.min(buildingCount, Math.floor(Math.random() * 3) + 1);
          updates[randomBuilding] = Math.max(0, (updates[randomBuilding] || buildingCount) - damageCount);
          newsMessage = `⚠️ FOOD RIOT: Desperate population destroyed food facilities! Lost ${damageCount} ${buildingNames[randomBuilding]}.`;
          foodRiotTriggered = true;
        }
      }

      if (!foodRiotTriggered) {
        const lossPercent = 0.05 + Math.random() * 0.05;
        const populationLoss = Math.floor((k.population || 0) * lossPercent);
        updates.population = Math.max(100, (updates.population || k.population) - populationLoss);
        newsMessage = `⚠️ UNREST: Population fleeing due to unhappiness! Lost ${populationLoss.toLocaleString()} people.`;
      }
      break;
    }

    case 5: { // Military Mutiny
      const troopsToLose = ['fighters', 'rangers', 'clerics', 'mages', 'thieves', 'ninjas', 'engineers'];
      let totalLost = 0;
      for (const unit of troopsToLose) {
        const count = k[unit] || 0;
        const loss = Math.floor(count * (0.05 + Math.random() * 0.05));
        if (loss > 0) {
          updates[unit] = Math.max(0, (updates[unit] || count) - loss);
          totalLost += loss;
        }
      }
      newsMessage = `⚠️ MILITARY MUTINY: Troops are refusing orders due to low happiness! ${totalLost} units deserted.`;
      break;
    }
  }

  if (newsMessage) {
    events.push({
      type: 'rebellion',
      message: newsMessage,
      turn: k.turn
    });
  }
}

function rebellionCheck(k, happiness, updates, events) {
  if (happiness >= 50) return; // No rebellion risk if happiness >= 50

  const cooldown = k.rebellion_cooldown || 0;
  if (cooldown > (k.turn || 0)) return; // Still in cooldown

  let rebellionChance = 0;
  if (happiness <= 0) {
    rebellionChance = 0.05; // 5% chance
  } else if (happiness < 20) {
    rebellionChance = 0.02; // 2% chance
  } else if (happiness < 50) {
    rebellionChance = 0.005; // 0.5% chance
  }

  if (Math.random() < rebellionChance) {
    rebellionEvent(k, updates, events);
  }
}

module.exports = {
  calculateHappiness,
  getHappinessRecoveryRate,
  happinessMult,
  happinessCombatMult,
  rebellionCheck,
  rebellionEvent,
};
