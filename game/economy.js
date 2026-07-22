// Economy domain: per-turn gold/food/trade income, food consumption + storage,
// market and trade route income, resource node yield, commodity pricing.
//
// Extracted from engine.js. Pure functions over kingdom rows + events arrays.
// No DB I/O; processTurn merges the returned updates and emits the events.

const config = require("./config");
const fragmentBonusManager = require("./fragment-bonus-manager");
const effectsProcessor = require("./synergy-effects-processor");
const { safeJsonParse } = require("../utils/helpers");
const { raceBonus } = require("./lib/race-bonus");
const { awardUnitXp } = require("./lib/troops");
const { getSynergyPassiveBonusMultiplier } = require("./lib/synergy-cache");
const { addItemToInventory, initItemsArray } = require("./lib/items");
const { naturalHappinessCap } = require("./lib/happiness-cap");
const {
  getDragonUpkeepMult,
  getDragonHoardEconMult,
} = require("./evolution");

const {
  FARM_WORKERS_PER,
  FARM_YIELD_MULT,
  FARM_UPGRADES,
  FOOD_CONSUMPTION_MULT,
  MARKET_INCOME_MULT,
  COMMODITY_VALUES,
  COMMODITY_RACE_DISCOUNT,
  PRESTIGE_MODIFIERS,
  RESOURCE_BUILDING_CONFIG,
  RARE_RESOURCE_ITEMS,
  RESOURCE_JUNK_MESSAGES,
} = config;

function totalHiredUnits(k) {
  // Each field is NOT NULL in the DB schema, but `|| 0` guards against
  // partial kingdom shapes (test fixtures, sockets that build kingdom
  // snapshots from spread merges, etc.) producing NaN downstream.
  return (
    (k.fighters || 0) +
    (k.rangers || 0) +
    (k.clerics || 0) +
    (k.mages || 0) +
    (k.thieves || 0) +
    (k.ninjas || 0) +
    (k.researchers || 0) +
    (k.engineers || 0) +
    (k.scribes || 0) +
    (k.thralls || 0)
  );
}

function goldPerTurn(k) {
  const taxRate = k.tax !== undefined && k.tax !== null ? k.tax : 42;
  let baseRate = Math.floor(
    k.land * (taxRate / 100) * ((k.res_economy || 100) / 100),
  );
  if (taxRate === 42) {
    baseRate = Math.floor(baseRate * 1.05); // 5% bonus to income
  }
  const castleIncomeMult = fragmentBonusManager.getBonusMultiplier(k, 'castles', 'income');
  const castlePrestigeMult = fragmentBonusManager.getBonusMultiplier(k, 'castles', 'prestige');
  const castleBonus = Math.floor((k.bld_castles || 0) * 100 * castleIncomeMult * castlePrestigeMult);  // 100 gold per castle
  const econBonus = raceBonus(k, "economy");
  const mktIncome = marketIncomeFull(k);
  const mb = safeJsonParse(k.milestone_bonuses, {}, "goldPerTurn:mb");
  const milestoneMult = 1 + (mb.gold_income_pct || 0) / 100;

  // Apply happiness multiplier (0.5 to 1.0+ based on happiness 0-100)
  const happiness = k.happiness !== undefined && k.happiness !== null ? k.happiness : 50;
  const happinessMult = Math.max(0, 0.5 + (happiness / 100));

  // Apply tavern bonus for gold generation (+5% per tavern)
  const tavernBonus = 1 + (((k.bld_taverns || 0) * 0.05));

  // Vault fragment economy_output passive boosts base income
  const vaultFrag = fragmentBonusManager.getFragmentForBuilding(k, 'vaults');
  const vaultEconomyMult = 1.0 + (vaultFrag?.passive?.economy_output || 0);

  // Synergy passive bonus for gold income
  const synergyGoldMult = getSynergyPassiveBonusMultiplier(k, 'gold_income');

  // milestoneMult applies only to core land/castle income; mktIncome stays flat
  let totalGold = Math.floor((baseRate + castleBonus) * econBonus * 2.25 * milestoneMult * happinessMult * tavernBonus * vaultEconomyMult * synergyGoldMult) + mktIncome;

  // Apply active ability effects (synergy_benefit.resources bonus or synergy_penalty)
  totalGold = effectsProcessor.applyMultiplicativeEffects(k, totalGold, 'resources');

  return totalGold;
}

function foodBalance(k) {
  return farmProduction(k) - foodConsumption(k);
}

/**
 * Population (or thralls, for vampires) needed per worked farm, after the
 * iron_plows upgrade discount. Shared by farmProduction (live per-turn
 * yield) and minPopulationToStaffFarms (the structural staffing floor used
 * to gate population-spending actions like land expansion).
 */
function farmWorkersNeeded(k) {
  const race = k.race || "human";
  const upgrades = safeJsonParse(
    k.farm_upgrades,
    {},
    "farmWorkersNeeded:farm_upgrades",
  );
  let workersNeeded = FARM_WORKERS_PER[race] || 10;
  if (upgrades.iron_plows) {
    workersNeeded = Math.max(1, workersNeeded - 2);
  }
  return workersNeeded;
}

/**
 * Population reserve needed so farms actually get staffed.
 *
 * hireUnits() already deducts population at hire time (a citizen becomes
 * a soldier and permanently leaves the population count) — so `population`
 * on its own is already the civilian labor pool, net of every hired unit.
 * It must NOT have totalHiredUnits(k) subtracted again here. An earlier
 * version of this function, and of farmProduction below, did exactly
 * that — double-counting the same troops twice: once when they were
 * hired, once again when computing free labor. Found live in production
 * (2026-07-22): population sat correctly above the farms-only floor, but
 * every farm still showed 0 manned, because farmProduction's own freePop
 * calc separately subtracted ~43,100 hired units from population a
 * second time.
 *
 * Vampires staff farms with thralls, not population, so this is 0 for them
 * regardless of farm count.
 */
function minPopulationToStaffFarms(k) {
  const farms = k.bld_farms || 0;
  if (!farms || k.race === "vampire") return 0;
  return farms * farmWorkersNeeded(k);
}

function farmProduction(k) {
  const farms = k.bld_farms;
  if (!farms) return 0;
  const race = k.race || "human";
  const upgrades = safeJsonParse(
    k.farm_upgrades,
    {},
    "farmProduction:farm_upgrades",
  );
  const workersNeeded = farmWorkersNeeded(k);

  // Population is already net of hired units (hireUnits deducts it at hire
  // time) -- do not subtract totalHiredUnits(k) again here. See
  // minPopulationToStaffFarms's doc comment for the full story.
  let workedFarms = 0;
  if (race === "vampire") {
    workedFarms = Math.min(farms, Math.floor((k.thralls || 0) / workersNeeded));
  } else {
    workedFarms = Math.min(farms, Math.floor((k.population || 0) / workersNeeded));
  }

  let baseYield = workedFarms * 150 * (FARM_YIELD_MULT[race] || 1.0);

  if (upgrades.irrigated) baseYield *= (FARM_UPGRADES.irrigated.yieldBonus + 1);
  if (upgrades.plantation) baseYield *= (FARM_UPGRADES.plantation.yieldBonus + 1);

  const activeEv = safeJsonParse(
    k.active_event,
    {},
    "farmProduction:active_event",
  );
  const seasonMult = k._season_farm_mult || 1.0;
  const evFarmMult = activeEv.farm_yield ? activeEv.farm_yield.mult : 1.0;

  baseYield *= seasonMult * evFarmMult;

  const productionMult = fragmentBonusManager.getBonusMultiplier(k, 'farms', 'production');
  baseYield *= productionMult;

  const happiness = k.happiness !== undefined && k.happiness !== null ? k.happiness : 50;
  const happinessMult = Math.max(0, 0.5 + (happiness / 100));
  baseYield *= happinessMult;

  const synergyFoodMult = getSynergyPassiveBonusMultiplier(k, 'food_production');
  baseYield *= synergyFoodMult;

  baseYield = effectsProcessor.applyMultiplicativeEffects(k, Math.floor(baseYield), 'food_production');

  return baseYield;
}

function foodConsumption(k) {
  const race = k.race || "human";
  const mult = FOOD_CONSUMPTION_MULT[race] || 1.0;
  const troops = totalHiredUnits(k);
  const pop = Math.floor((k.population || 0) / 100);

  let consumption;
  if (race === "vampire") {
    // Only Thralls eat grain. Vampires eat Thralls/Pop (handled in processFoodEconomy)
    consumption = Math.floor((k.thralls || 0) * mult);
  } else {
    consumption = Math.floor((troops + pop) * mult);
  }

  const consumptionMult = fragmentBonusManager.getBonusMultiplier(k, 'farms', 'consumption');
  consumption *= consumptionMult;
  // Dragon form upkeep — tradeoff, not free power
  consumption = Math.floor(consumption * getDragonUpkeepMult(k));

  return consumption;
}

function marketIncomeFull(k) {
  const markets = k.bld_markets;
  if (!markets) return 0;
  const upgrades = safeJsonParse(
    k.market_upgrades,
    {},
    "marketIncomeFull:market_upgrades",
  );
  const race = k.race || "human";
  let mult = MARKET_INCOME_MULT[race] || 1.0;

  if (k.prestige_level > 0) {
    const tierMod = PRESTIGE_MODIFIERS[Math.min(k.prestige_level, 5)]?.econ || 1.0;
    mult *= tierMod;
  }
  mult *= getDragonHoardEconMult(k);

  // Population is already net of hired units (see
  // minPopulationToStaffFarms's doc comment) -- do not subtract
  // totalHiredUnits(k) again here.
  const workedMarkets = Math.min(markets, Math.floor((k.population || 0) / 5));
  const tradeRoutes = Math.min(k.maps, markets);
  // High Consul's Silver Tongue: diplomacy bonus boosts trade route income
  let income =
    (workedMarkets * 50 + tradeRoutes * 30 * raceBonus(k, "diplomacy")) * mult;
  if (upgrades.bazaar) income *= 1.5;
  if (upgrades.black_market) income *= 1.2;

  const incomeMult = fragmentBonusManager.getBonusMultiplier(k, 'markets', 'income');
  income *= incomeMult;

  return Math.floor(income);
}

function tavernEntertainmentBonus(k) {
  if (!k.bld_taverns) return 0;
  const baseBonusPerTavern = 10;
  let bonus = k.bld_taverns * baseBonusPerTavern;

  const tavernHappinessMult = fragmentBonusManager.getBonusMultiplier(k, 'taverns', 'happiness');
  bonus = Math.floor(bonus * tavernHappinessMult);

  return bonus;
}

function commodityPrice(item, race, supplyIndex) {
  const base = COMMODITY_VALUES[item] || 1;
  const raceDisc = COMMODITY_RACE_DISCOUNT[race] || {};
  const discount = raceDisc[item] || raceDisc._all || 1.0;
  const supply = (supplyIndex && supplyIndex[item]) || 1.0;
  return Math.max(1, Math.round(base * discount * supply));
}

// Resource yield per turn for wood/stone/iron buildings. Each building only
// yields every cfg.yieldEvery turns and only if the kingdom has free
// population to staff it. Wood production also rolls for rare items,
// earth fragments, doubled yield, or junk flavor text.
function processResourceYield(k, events) {
  const updates = {};
  const turn = k.turn;

  let items = safeJsonParse(k.items, [], 'processResourceYield:items');
  items = initItemsArray(items);
  let itemsChanged = false;

  // Population is already net of hired units (see
  // minPopulationToStaffFarms's doc comment in this file) -- do not
  // subtract totalHiredUnits(k) again here.
  const freePopulation = k.population || 0;

  let woodGained = 0;
  let stoneGained = 0;
  let ironGained = 0;

  for (const [bKey, cfg] of Object.entries(RESOURCE_BUILDING_CONFIG)) {
    const col = `bld_${bKey}`;
    const count = k[col] || 0;
    if (count <= 0) continue;
    if (turn % cfg.yieldEvery !== 0) continue;

    const workersNeeded = count * cfg.workersPerBuilding;
    const isOperating = freePopulation >= workersNeeded;
    if (!isOperating) continue;

    const yieldMult = raceBonus(k, `${cfg.type}_yield`);
    let baseYield = count * cfg.yield * yieldMult;

    const fragmentMult = fragmentBonusManager.getBonusMultiplier(k, bKey, 'production');
    baseYield *= fragmentMult;

    const synergyProdMult = getSynergyPassiveBonusMultiplier(k, 'production_speed');
    baseYield *= synergyProdMult;

    // Random events on wood production only
    if (cfg.type === 'wood') {
      const rareFindMult = raceBonus(k, 'rare_find');
      const roll = Math.random();

      if (roll < 0.0025 * rareFindMult) {
        const rareItems = RARE_RESOURCE_ITEMS.wood;
        const chosen = rareItems[Math.floor(Math.random() * rareItems.length)];
        const existing = items.find((i) => i.id === chosen.id);
        if (!existing || (existing.qty || 0) < 3) {
          addItemToInventory(items, chosen.id, chosen.name, 1);
          itemsChanged = true;
          events.push({ type: 'system', message: `🌲 Your foresters discovered a rare item: ${chosen.name}!` });
        }
      } else if (roll < 0.01 * rareFindMult) {
        const earthFrag = items.find((i) => i.id === 'earth_fragment');
        if (!earthFrag || (earthFrag.qty || 0) === 0) {
          addItemToInventory(items, 'earth_fragment', 'Earth Fragment', 1);
          itemsChanged = true;
          events.push({ type: 'system', message: `🌍 Your foresters unearthed an Earth Fragment while logging!` });
        }
      } else if (roll < 0.06) {
        baseYield *= 2;
        events.push({ type: 'system', message: `🌲 An unusually productive logging session doubled your wood yield!` });
      } else if (roll < 0.26) {
        const msg = RESOURCE_JUNK_MESSAGES[Math.floor(Math.random() * RESOURCE_JUNK_MESSAGES.length)];
        events.push({ type: 'system', message: `🌲 Foresters report: ${msg}` });
      }
    }

    const gained = Math.floor(baseYield);
    if (cfg.type === 'wood') woodGained += gained;
    else if (cfg.type === 'stone') stoneGained += gained;
    else if (cfg.type === 'iron') ironGained += gained;
  }

  if (woodGained > 0) {
    updates.wood = k.wood + woodGained;
    events.push({ type: 'system', message: `🪵 Resource production: +${woodGained.toLocaleString()} wood.` });
  }
  if (stoneGained > 0) {
    updates.stone = k.stone + stoneGained;
    events.push({ type: 'system', message: `🪨 Resource production: +${stoneGained.toLocaleString()} stone.` });
  }
  if (ironGained > 0) {
    updates.iron = k.iron + ironGained;
    events.push({ type: 'system', message: `🔗 Resource production: +${ironGained.toLocaleString()} iron.` });
  }

  if (itemsChanged) {
    updates.items = JSON.stringify(items);
  }

  return updates;
}

// Per-turn food settlement: production vs consumption, spoilage on stored
// grain, storage cap from granaries, race-specific vampire hunger branch
// (vampires eat population + thralls), and the standard surplus/shortage
// pathways with happiness, fleeing population, and desertion at long shortages.
function processFoodEconomy(k, events) {
  const updates = {};
  const race = k.race || "human";
  const prod = farmProduction(k);
  const cons = foodConsumption(k);
  const balance = prod - cons;
  // Net production - consumption for the client's per-turn resource strip
  // (see routes/response-structurer.js's economyFields whitelist and
  // client/src/stores/economyStore.js's receiveServerSnapshot).
  updates.food_balance = balance;
  let food = k.food;

  const upgrades = safeJsonParse(
    k.granary_upgrades,
    {},
    "processFoodEconomy:granary_upgrades",
  );
  const BASE_FOOD_STORAGE = 10000;
  const granaryPer = upgrades.silos ? 150000 : 100000;
  const storageRaceMult = raceBonus(k, 'food_storage');
  const granaryCapacityMult = fragmentBonusManager.getBonusMultiplier(k, 'granaries', 'capacity');

  const maxStore = Math.floor((Math.floor(BASE_FOOD_STORAGE * storageRaceMult) + (k.bld_granaries || 0) * granaryPer) * granaryCapacityMult);

  let rotRate = upgrades.preservation ? 0.05 * 0.7 : 0.05; // 5% base degradation, lowered by 30% with salt curing

  const granaryAttune = fragmentBonusManager.getFragmentForBuilding(k, 'granaries');

  if (granaryAttune && (granaryAttune.fragment === 'Volcanic Rock' || granaryAttune.fragment === 'Abyssal Crystal')) {
    rotRate = 0;
  } else {
    const decayReduction = fragmentBonusManager.getBonusMultiplier(k, 'granaries', 'decay_reduction');
    if (decayReduction > 1.0) {
      rotRate = Math.max(0, rotRate * (2.0 - decayReduction));
    }
  }

  const spoilage = Math.floor(food * rotRate);
  if (spoilage > 0) {
    food -= spoilage;
    updates._spoilage = spoilage;
  }

  if (race === "vampire") {
    // ── Vampire Special: Thralls eat grain, Vampires eat Thralls/Pop ──────
    if (balance >= 0) {
      food = Math.min(food + balance, Math.max(1000, maxStore));
    } else {
      const shortage = Math.abs(balance);
      if (food >= shortage) {
        food -= shortage;
      } else {
        const unfed = shortage - food;
        food = 0;
        const thrallsLost = Math.min(
          k.thralls,
          Math.ceil(unfed / (FOOD_CONSUMPTION_MULT[race] || 1.0)),
        );
        if (thrallsLost > 0) {
          updates.thralls = k.thralls - thrallsLost;
          events.push({
            type: "system",
            message: `🚨 Thrall starvation! ${thrallsLost.toLocaleString()} thralls died due to lack of grain.`,
          });
        }
      }
    }
    updates.food = food;

    const troops = totalHiredUnits(k) - (updates.thralls ?? k.thralls ?? 0);
    const pop = Math.floor(k.population / 100);
    const vampireConsumption = 0.285;
    const hunger = Math.floor((troops + pop) * vampireConsumption);

    let totalConsumed = 0;
    const currentThralls = updates.thralls ?? k.thralls ?? 0;

    let populationEaten = Math.min(k.population, hunger);
    let remainingHunger = hunger - populationEaten;

    // safeJsonParse never throws — it returns the fallback on parse error.
    const mausoleumUpgrades = safeJsonParse(k.mausoleum_upgrades, {}, "auto:mausoleum_upgrades");

    const thrallEfficiency =
      mausoleumUpgrades.blood_sacrifice && race === "vampire" ? 1.2 : 1.0;
    let thrallsEaten = Math.min(
      currentThralls,
      Math.ceil(remainingHunger / thrallEfficiency),
    );

    if (populationEaten > 0) {
      updates.population = k.population - populationEaten;
      totalConsumed += populationEaten;
    }
    if (thrallsEaten > 0) {
      updates.thralls = currentThralls - thrallsEaten;
      totalConsumed += thrallsEaten;
    }

    if (totalConsumed > 0 && Math.random() < 0.02) {
      events.push({
        type: "system",
        message: `🍷 Vampire hunger: ${totalConsumed.toLocaleString()} population consumed.`,
      });

      const toAdd = Math.floor(populationEaten * 0.015);
      if (toAdd > 0) {
        const unitTypes = [
          "fighters",
          "rangers",
          "clerics",
          "mages",
          "thieves",
          "ninjas",
        ];
        const targetUnit =
          unitTypes[Math.floor(Math.random() * unitTypes.length)];
        updates[targetUnit] = (k[targetUnit] || 0) + toAdd;

        const xpUpdate = awardUnitXp({ ...k, ...updates }, targetUnit, 10);
        if (xpUpdate) updates.troop_levels = xpUpdate;

        events.push({
          type: "system",
          message: `🩸 Blood Sacrifice: ${toAdd.toLocaleString()} new ${targetUnit} risen from the consumed population.`,
        });
      }
    } else if (totalConsumed > 0) {
      events.push({
        type: "system",
        message: `🍷 Vampire hunger: ${totalConsumed.toLocaleString()} population consumed.`,
      });
    }
    return updates;
  }

  // ── Standard Food Logic ──────────────────────────────────────────────────
  if (balance >= 0) {
    food = Math.min(food + balance, maxStore);
    const surpTurns = k.food_surplus_turns + 1;
    updates.food = food;
    updates.food_surplus_turns = surpTurns;
    updates.food_shortage_turns = 0;
    if (surpTurns >= 5) {
      const natCap = naturalHappinessCap(k);
      const cur =
        updates.happiness !== undefined
          ? updates.happiness
          : k.happiness !== undefined && k.happiness !== null
            ? k.happiness
            : 100;
      updates.happiness = Math.min(natCap, cur + 2);

      events.push({
        type: "system",
        message: `🌽 Food surplus: +${balance.toLocaleString()} units. Troops are well fed.`,
      });

    } else {
      events.push({
        type: "system",
        message: `🌽 Food: +${balance.toLocaleString()} surplus. Stores: ${food.toLocaleString()}.`,
      });
    }
  } else {
    const shortage = Math.abs(balance);
    const shortTurns = k.food_shortage_turns + 1;
    updates.food_shortage_turns = shortTurns;
    updates.food_surplus_turns = 0;

    // Only warn if actually in deficit/shortage, not during surplus
    if (food >= shortage) {
      food -= shortage;
      updates.food = food;
      // Don't show warning if in surplus (balance >= 0)
      if (food < 0) {
        events.push({
          type: "system",
          message: `⚠️ Food deficit: drawing ${shortage.toLocaleString()} from stores. ${Math.max(0, food).toLocaleString()} remaining.`,
        });
      }
    } else {
      updates.food = 0;
      // Only warn if actually going into shortage
      if (shortTurns > 0) {
        events.push({
          type: "system",
          message: `🚨 Food shortage! Turn ${shortTurns} — build more farms or reduce troops.`,
        });
      }
      if (shortTurns >= 3) {
        const hit = shortTurns >= 8 ? 20 : shortTurns >= 5 ? 10 : 5;
        const cur =
          updates.happiness !== undefined
            ? updates.happiness
            : k.happiness !== undefined && k.happiness !== null
              ? k.happiness
              : 100;
        updates.happiness = Math.max(0, cur - hit);

        events.push({
          type: "system",
          message: `🚨 Food shortage! Turn ${shortTurns} — build more farms or reduce troops.`,
        });

      }
      if (shortTurns >= 5) {
        let fleeCount = 500;
        const activeHousingSpecial = fragmentBonusManager.getSpecialEffect(k, 'housing');

        if (activeHousingSpecial?.name === "Holy Sanctuaries") {
          fleeCount = 0;
        } else if (activeHousingSpecial?.name === "Treehouse Canopy") {
          fleeCount = Math.floor(fleeCount * 0.2);
        } else if (activeHousingSpecial?.name === "Lifespring Spores") {
          fleeCount = Math.floor(fleeCount * 0.5);
        }

        if (fleeCount > 0) {
          updates.population = Math.max(1000, k.population - fleeCount);
          events.push({
            type: "system",
            message: `👥 Population fleeing starvation: -${fleeCount} people.`,
          });
        } else if (activeHousingSpecial?.name === "Holy Sanctuaries") {
          events.push({
            type: "system",
            message: `👥 Holy Sanctuaries: Population refuses to abandon their sacred homes despite starvation!`,
          });
        }
      }
      if (shortTurns >= 8) {
        const desert = Math.floor(k.fighters * 0.02);
        if (desert > 0) {
          updates.fighters = Math.max(0, k.fighters - desert);
          events.push({
            type: "system",
            message: `⚔️ ${desert.toLocaleString()} fighters deserted — starvation.`,
          });
        }
      }
    }
  }
  return updates;
}

function calculateTradeIncome(k) {
  const routes = k._trade_routes;
  if (!routes || routes.length === 0) return 0;

  const base = config.TRADE_ROUTE_BASE_GOLD || 1500;
  let raceMult = config.TRADE_RATE_MULT[k.race] || 1.0;

  if (k.prestige_level > 0) {
    const tierMod = PRESTIGE_MODIFIERS[Math.min(k.prestige_level, 5)]?.econ || 1.0;
    raceMult *= tierMod;
  }
  raceMult *= getDragonHoardEconMult(k);

  const econRes = (k.res_economy || 100) / 100;
  const marketBonus = 1 + (k.bld_markets || 0) * 0.002;

  // Merchant King achievement: +10% trade route income
  let achievements = safeJsonParse(k.achievements, [], "calculateTradeIncome:achievements");
  const merchantKingBonus = achievements.includes("ach_wealthy") ? 1.1 : 1.0;

  let total = 0;
  for (const r of routes) {
    const stabilityMult = (r.stability || 100) / 100;
    const distancePenalty =
      (r.distance || 0) * (config.TRADE_ROUTE_DISTANCE_PENALTY || 10);
    const routeIncome = Math.max(
      0,
      base * efficiencyMult(r) * stabilityMult - distancePenalty,
    );
    total += routeIncome;
  }

  return Math.floor(total * raceMult * econRes * marketBonus * merchantKingBonus);
}

function efficiencyMult(route) {
  return route.efficiency || 1.0;
}

module.exports = {
  totalHiredUnits,
  goldPerTurn,
  foodBalance,
  farmProduction,
  farmWorkersNeeded,
  minPopulationToStaffFarms,
  foodConsumption,
  marketIncomeFull,
  tavernEntertainmentBonus,
  commodityPrice,
  processResourceYield,
  processFoodEconomy,
  calculateTradeIncome,
  efficiencyMult,
};
