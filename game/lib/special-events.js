// game/lib/special-events.js
// Special event handlers: rebellion, prestige, alliance defense, trade route raids.
// Pure functions for kingdom state mutations during exceptional events.

const { unitLevelMult } = require('./troops');

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
  const eventType = Math.floor(Math.random() * 6) + 1; // 1-6

  updates.rebellion_cooldown = k.turn + 20;

  let newsMessage = "";

  switch (eventType) {
    case 1: // Unrest - population loss
      {
        const lossPercent = 0.05 + Math.random() * 0.05; // 5-10%
        const populationLoss = Math.floor(k.population * lossPercent);
        updates.population = Math.max(100, (updates.population || k.population) - populationLoss);
        newsMessage = `⚠️ UNREST: Population fleeing due to unhappiness! Lost ${populationLoss.toLocaleString()} people.`;
      }
      break;

    case 2: // Tax Revolt
      {
        const newTaxCap = Math.max(10, (updates.tax || k.tax) - 10);
        updates.tax = newTaxCap;
        newsMessage = `⚠️ TAX REVOLT: Population refuses higher taxes. Tax reduced to ${newTaxCap}%!`;
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
          updates[randomBuilding] = Math.max(0, (updates[randomBuilding] || buildingCount) - damageCount);
          newsMessage = `⚠️ SABOTAGE: Rioters destroyed ${damageCount} ${buildingNames[randomBuilding]}!`;
        } else {
          const lossPercent = 0.02 + Math.random() * 0.03; // 2-5%
          const populationLoss = Math.floor(k.population * lossPercent);
          updates.population = Math.max(100, (updates.population || k.population) - populationLoss);
          newsMessage = `⚠️ UNREST: Rioters clashed with guards! Lost ${populationLoss.toLocaleString()} people.`;
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
            updates[randomBuilding] = Math.max(0, (updates[randomBuilding] || buildingCount) - damageCount);
            newsMessage = `⚠️ FOOD RIOT: Desperate population destroyed food facilities! Lost ${damageCount} ${buildingNames[randomBuilding]}.`;
            foodRiotTriggered = true;
          }
        }

        if (!foodRiotTriggered) {
          const lossPercent = 0.05 + Math.random() * 0.05;
          const populationLoss = Math.floor(k.population * lossPercent);
          updates.population = Math.max(100, (updates.population || k.population) - populationLoss);
          newsMessage = `⚠️ UNREST: Population fleeing due to unhappiness! Lost ${populationLoss.toLocaleString()} people.`;
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
            updates[unit] = Math.max(0, (updates[unit] || count) - loss);
            totalLost += loss;
          }
        }
        newsMessage = `⚠️ MILITARY MUTINY: Troops are refusing orders due to low happiness! ${totalLost} units deserted.`;
      }
      break;

    case 6: // Treasury Looting
      {
        const lossPercent = 0.05 + Math.random() * 0.1; // 5-15%
        const currentGold = updates.gold ?? k.gold ?? 0;
        const goldLoss = Math.floor(currentGold * lossPercent);
        updates.gold = Math.max(0, currentGold - goldLoss);
        newsMessage = `⚠️ TREASURY LOOTED: Rioters raided the treasury! Lost ${goldLoss.toLocaleString()} gold.`;
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

// Prestige: canonical implementation is game/prestige/. Do not re-add stubs here.

function raidTradeRoute(attacker, defender, unitCount) {
  if (attacker.race !== "orc")
    return { error: "Only Orcs can raid trade routes" };
  const currentAttackerThieves = attacker.thieves || 0;
  if (currentAttackerThieves < 500)
    return { error: "Need at least 500 thieves to raid trade routes" };
  const defenderTradeRoutes = defender.trade_routes || 0;
  if (defenderTradeRoutes < 1)
    return { error: "Target has no trade routes to raid" };

  const atkLvl = unitLevelMult(attacker, "thieves");
  const defLvl = unitLevelMult(defender, "thieves");
  const successChance = 0.4 + (atkLvl - defLvl) * 0.2;
  const roll = Math.random();

  if (roll < successChance) {
    const raided = Math.min(defenderTradeRoutes, Math.floor(unitCount / 500));
    const loot = raided * 5000;
    const losses = Math.floor(unitCount * 0.05);

    return {
      success: true,
      looted: loot,
      raidedRoutes: raided,
      attackerUpdates: {
        gold: (attacker.gold || 0) + loot,
        thieves: Math.max(0, (attacker.thieves || 0) - losses),
      },
      defenderUpdates: {
        trade_routes: Math.max(0, (defender.trade_routes || 0) - raided),
      },
      atkEvent: `🏴‍☠️ SUCCESS: You raided ${raided} trade routes of ${defender.name} and looted ${loot.toLocaleString()} gold! (Losses: ${losses} thieves)`,
      defEvent: `🛶 RAIDED: ${attacker.name}'s Orcs raided your trade routes! You lost ${raided} routes and ${loot.toLocaleString()} gold was stolen!`,
    };
  } else {
    const losses = Math.floor(unitCount * 0.15);
    return {
      success: false,
      attackerUpdates: {
        thieves: Math.max(0, (attacker.thieves || 0) - losses),
      },
      atkEvent: `💀 FAILURE: Your raid on ${defender.name}'s trade routes failed. You lost ${losses} thieves in the ambush.`,
      defEvent: `🛡️ Your guards repelled an Orc raid from ${attacker.name} on your trade routes!`,
    };
  }
}

function resolveAllianceDefense(attackResult, allies) {
  // When a kingdom is attacked, allied kingdoms send pledge % of their fighters
  if (!attackResult.win) return [];
  return allies.map((ally) => {
    const sent = Math.floor(ally.fighters * (ally.pledge / 100));
    return { allyId: ally.id, sent };
  });
}

module.exports = {
  rebellionCheck,
  rebellionEvent,
  raidTradeRoute,
  resolveAllianceDefense,
};
