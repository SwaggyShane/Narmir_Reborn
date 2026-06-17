/**
 * Rebellion System
 * Handles kingdom unrest, population dissatisfaction, and rebellion events
 */

function rebellionCheck(k, happiness, updates, events) {
  if (happiness >= 50) return; // No rebellion risk if happiness >= 50

  const cooldown = k.rebellion_cooldown || 0;
  if (cooldown > k.turn) return; // Still in cooldown

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

function rebellionEvent(k, updates, events) {
  const eventType = Math.floor(Math.random() * 5) + 1; // 1-5

  updates.rebellion_cooldown = k.turn + 20;

  let newsMessage = "";

  switch (eventType) {
    case 1: // Unrest - population loss
      {
        const lossPercent = 0.05 + Math.random() * 0.05; // 5-10%
        const populationLoss = Math.floor(k.population * lossPercent);
        updates.population = Math.max(100, (updates.population ?? k.population) - populationLoss);
        newsMessage = `🔶 🌪️ UNREST: Population fleeing due to unhappiness! Lost ${populationLoss.toLocaleString()} people.`;
      }
      break;

    case 2: // Tax Revolt
      {
        const newTaxCap = Math.max(10, (updates.tax ?? k.tax) - 10);
        updates.tax = newTaxCap;
        newsMessage = `🔶 🌪️ TAX REVOLT: Population refuses higher taxes. Tax reduced to ${newTaxCap}%!`;
      }
      break;

    case 3: // Building Sabotage
      {
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
          updates[randomBuilding] = Math.max(0, (updates[randomBuilding] ?? buildingCount) - damageCount);
          newsMessage = `🔶 🌪️ SABOTAGE: Rioters destroyed ${damageCount} ${buildingNames[randomBuilding]}!`;
        } else {
          const lossPercent = 0.02 + Math.random() * 0.03; // 2-5%
          const populationLoss = Math.floor(k.population * lossPercent);
          updates.population = Math.max(100, (updates.population ?? k.population) - populationLoss);
          newsMessage = `🔶 🌪️ UNREST: Rioters clashed with guards! Lost ${populationLoss.toLocaleString()} people.`;
        }
      }
      break;

    case 4: // Food Riot
      {
        let foodRiotTriggered = false;
        if (k.food < k.population * 0.1) {
          const buildingTypes = ['bld_granaries', 'bld_farms'];
          const buildingNames = { bld_granaries: 'granaries', bld_farms: 'farms' };
          const availableBuildings = buildingTypes.filter(b => (k[b] || 0) > 0);

          if (availableBuildings.length > 0) {
            const randomBuilding = availableBuildings[Math.floor(Math.random() * availableBuildings.length)];
            const buildingCount = k[randomBuilding];
            const damageCount = Math.min(buildingCount, Math.floor(Math.random() * 3) + 1);
            updates[randomBuilding] = Math.max(0, (updates[randomBuilding] ?? buildingCount) - damageCount);
            newsMessage = `🔶 🌪️ FOOD RIOT: Desperate population destroyed food facilities! Lost ${damageCount} ${buildingNames[randomBuilding]}.`;
            foodRiotTriggered = true;
          }
        }

        if (!foodRiotTriggered) {
          const lossPercent = 0.05 + Math.random() * 0.05;
          const populationLoss = Math.floor(k.population * lossPercent);
          updates.population = Math.max(100, (updates.population ?? k.population) - populationLoss);
          newsMessage = `🔶 🌪️ UNREST: Population fleeing due to unhappiness! Lost ${populationLoss.toLocaleString()} people.`;
        }
      }
      break;

    case 5: // Military Mutiny
      {
        // Lose 5-10% of troops due to desertion
        const troopsToLose = ['fighters', 'rangers', 'clerics', 'mages', 'thieves', 'ninjas', 'engineers'];
        let totalLost = 0;
        for (const unit of troopsToLose) {
          const count = k[unit] || 0;
          const loss = Math.floor(count * (0.05 + Math.random() * 0.05));
          if (loss > 0) {
            updates[unit] = Math.max(0, (updates[unit] ?? count) - loss);
            totalLost += loss;
          }
        }
        newsMessage = `🔶 🌪️ MILITARY MUTINY: Troops are refusing orders due to low happiness! ${totalLost} units deserted.`;
      }
      break;
  }

  if (newsMessage) {
    events.push({
      type: 'rebellion',
      message: newsMessage,
      turn: k.turn
    });
  }
}

module.exports = {
  rebellionCheck,
  rebellionEvent,
};
