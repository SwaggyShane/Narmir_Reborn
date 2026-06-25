// src/game/engine.js
// Pure game logic — no I/O, no socket calls.
// All functions take a kingdom row (or rows) and return mutations + events.

const config = require("./config");
const { progressGoal } = require('./goals');

// Dev-only log: kept out of production stdout to stop per-turn noise from
// drowning real errors. Use console.error/warn directly for problems you
// always want to see; use this for traces useful only during debugging.
const _IS_PROD = process.env.NODE_ENV === 'production';
function devLog(...args) {
  if (!_IS_PROD) console.log(...args);
}

const fragmentBonusManager = require("./fragment-bonus-manager");
const effectsProcessor = require("./synergy-effects-processor");
const combatResolverV2 = require("./combat-resolver");
const { safeJsonParse, roll, rand, clearParseCache } = require('../utils/helpers');

const MOJIBAKE_SIGNATURE = /[\u00C3\u00C2\u00E2\u00EF\u00F0\u00C5\uFFFD]/;

function repairMojibake(value) {
  if (value === null || value === undefined) return value;
  let text = String(value);
  if (!MOJIBAKE_SIGNATURE.test(text)) return text;
  for (let i = 0; i < 20; i++) {
    if (!MOJIBAKE_SIGNATURE.test(text)) break;
    let next;
    try {
      next = Buffer.from(text, "latin1").toString("utf8");
    } catch {
      break;
    }
    if (next === text) break;
    text = next;
  }
  return text;
}

function cleanNewsEvent(item) {
  if (!item || typeof item !== "object") return item;
  const cleaned = { ...item };
  if (typeof cleaned.message === "string") cleaned.message = repairMojibake(cleaned.message);
  if (typeof cleaned.text === "string") cleaned.text = repairMojibake(cleaned.text);
  return cleaned;
}

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

// Population domain — housing capacity, population growth, and research
// increment. Defined in game/population.js; re-exported below.
const populationMod = require('./population');
const {
  housingCapPerBuilding,
  popGrowth,
  researchIncrement,
} = populationMod;

const {
  RACE_BONUSES,
  REGION_DATA,
  PRESTIGE_MODIFIERS,
  UNIT_COST,
  MAX_RESEARCH,
  RESEARCH_DISCIPLINE_CAPS,
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
  MAGIC_SCHOOLS,
  SCROLL_REQUIREMENTS,
  SCRIBE_ITEMS,
  SUPPORT_CAP_RACE,
  WM_CREW_REQUIRED,
  RESEARCH_MAP,
  BUILDING_ALIASES,
  RACIAL_UNITS,
  WORLD_FRAGMENTS,
  JUNK_PRIZES,
  INVENTORY_ITEMS,
  ULTRA_RARE_PRIZES,
  THRONE_OF_NAZDREG,
  EXPEDITION_TURNS,
  CAPS,
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

const USE_COMBAT_V2 = process.env.USE_COMBAT_V2 === "1";

// ── Helpers ──────────────────────────────────────────────────────────────────

function isNight() {
  const h = new Date().getUTCHours();
  return h >= 1 && h < 13; // 8PM EST to 8AM EST (EST is UTC-5)
}

function assignRegion(race) {
  return race; // simple mapping for now: race name = region id
}


function getHappinessRecoveryRate(k) {
  const baseRecovery = (k.res_entertainment || 100) / 1200 + ((k.bld_taverns || 0) * 0.2);
  const taxRate = Number(k.tax ?? 42);
  const taxDrag = taxRate > 42 ? Math.min(5, Math.floor((taxRate - 42) / 14)) : 0;
  return Math.max(0.2, Math.min(2.8, baseRecovery - taxDrag));
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
  const effects = safeJsonParse(k.active_effects, {}, "calculateHappiness:active_effects");
  let effectComponent = 0;
  if (effects.bless && typeof effects.bless === "object" && typeof effects.bless.happiness_bonus === "number") {
    effectComponent += effects.bless.happiness_bonus;
  }
  if (effects.divine_favor && typeof effects.divine_favor === "object" && typeof effects.divine_favor.happiness_bonus === "number") {
    effectComponent += effects.divine_favor.happiness_bonus;
  }
  happiness += effectComponent;

  // Apply synergy passive happiness bonus (absolute value, can be positive or negative)
  const synergyHappinessBonus = getSynergyPassiveBonusAbsolute(k, 'happiness');
  happiness += synergyHappinessBonus;

  // Race + hero happiness multipliers (RACE_BONUSES.happiness, Paladin's
  // Unyielding Faith, Blood Matriarch's Sanguine Bond) scaled to ±20 points
  happiness += Math.round((raceBonus(k, "happiness") - 1) * 20);

  // Apply tax penalty/bonus
  let taxComponent = 0;
  const taxRate = k.tax ?? 42;
  if (taxRate > 42) {
    taxComponent = -Math.floor(((taxRate - 42) / 58) * 85);
    happiness += taxComponent;
  } else if (taxRate < 42) {
    taxComponent = Math.floor(12 * ((42 - taxRate) / 42));
    happiness += taxComponent;
  }

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
    if (activeHousingSpecial?.name === "Goliath Dwellings") {
      overcrowdMult *= 0.2;
    }
    overcrowdingComponent = -Math.max(
      0,
      Math.floor(Math.max(0, ((k.population || 0) - overcrowdingThreshold) * 0.018 * overcrowdMult))
    );
    happiness += overcrowdingComponent;
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
      size: sizeComponent,
      effects: effectComponent,
      synergy: synergyHappinessBonus,
      tax: taxComponent,
      overcrowding: overcrowdingComponent,
      fragments: fragmentPenalty < 0 ? fragmentPenalty : 0
    },
    recovery: recoveryRate
  };
}

async function recordHappinessHistory(db, kingdomId, turn, happinessData) {
  try {
    await db.run(
      `INSERT INTO happiness_history
       (kingdom_id, turn, happiness_value, food_component, entertainment_component, safety_component, prosperity_component, race_modifier, tax_component, overcrowding_component, recovery_rate, effects_component, synergy_component, fragment_component)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(kingdom_id, turn) DO UPDATE SET
       happiness_value = EXCLUDED.happiness_value,
       food_component = EXCLUDED.food_component,
       entertainment_component = EXCLUDED.entertainment_component,
       safety_component = EXCLUDED.safety_component,
       prosperity_component = EXCLUDED.prosperity_component,
       race_modifier = EXCLUDED.race_modifier,
       tax_component = EXCLUDED.tax_component,
       overcrowding_component = EXCLUDED.overcrowding_component,
       recovery_rate = EXCLUDED.recovery_rate,
       effects_component = EXCLUDED.effects_component,
       synergy_component = EXCLUDED.synergy_component,
       fragment_component = EXCLUDED.fragment_component`,
      [
        kingdomId,
        turn,
        happinessData.happiness,
        happinessData.components.food || 0,
        happinessData.components.entertainment || 0,
        happinessData.components.safety || 0,
        happinessData.components.prosperity || 0,
        happinessData.components.race || 0,
        happinessData.components.tax || 0,
        happinessData.components.overcrowding || 0,
        happinessData.recovery || 0,
        happinessData.components.effects || 0,
        happinessData.components.synergy || 0,
        happinessData.components.fragments || 0
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

// addItemToInventory + initItemsArray live in game/lib/items.js.
// processResourceYield lives in game/economy.js. All three are re-exported
// from engine.js via module.exports for backward compat.

/**
 * Process resource expeditions — called from processTurn.
 * Accepts current time (unixepoch seconds) to allow testability.
 * Returns { updates, expeditionEvents } — the caller merges updates.
 * This function does NOT do DB ops; it just returns what should change.
 * The actual DB writes happen in routes/kingdom.js via processResourceExpeditionsDb.
 */
function computeExpeditionTransitions(expeditions, now) {
  const transitions = [];
  for (const exp of expeditions) {
    if (exp.status === 'outbound' && now >= exp.arrive_at) {
      const harvestDuration = exp._harvestDuration || 3600; // fallback
      transitions.push({ id: exp.id, newStatus: 'harvesting', harvest_ends_at: now + harvestDuration, ...exp });
    } else if (exp.status === 'harvesting' && exp.harvest_ends_at && now >= exp.harvest_ends_at) {
      transitions.push({ id: exp.id, newStatus: 'returning', ...exp });
    } else if (exp.status === 'returning' && exp.return_at && now >= exp.return_at) {
      transitions.push({ id: exp.id, newStatus: 'completed', ...exp });
    }
  }
  return transitions;
}

// totalHiredUnits + the food/market/trade economy functions live in
// game/economy.js. They're re-exported from engine.js via module.exports
// for backward compat with routes/sockets that still call engine.foo(...).
function processMercenaries(k, events) {
  const updates = {};
  const mercs = safeJsonParse(
    k.mercenaries,
    [],
    "processMercenaries:mercenaries",
  );
  if (!mercs.length) return updates;

  const currentTurn = k.turn;
  let gold = k.gold;
  const active = [];
  let totalUpkeepPaid = 0;

  for (const m of mercs) {
    const served = currentTurn - (m.hired_at_turn || 0);
    const upkeep = m.upkeep_per_turn || 0;
    if (served >= m.duration_turns) {
      updates[m.unit_type] = Math.max(
        0,
        (updates[m.unit_type] ?? (k[m.unit_type] || 0)) - m.count,
      );
      events.push({
        type: "system",
        message: `⚔️ ${m.count} ${m.tier} ${m.unit_type} completed their contract and departed.`,
      });
    } else if (gold >= upkeep) {
      gold -= upkeep;
      totalUpkeepPaid += upkeep;
      active.push(m);
    } else {
      updates[m.unit_type] = Math.max(
        0,
        (updates[m.unit_type] ?? (k[m.unit_type] || 0)) - m.count,
      );
      events.push({
        type: "system",
        message: `⚔️ ${m.count} ${m.tier} ${m.unit_type} left — upkeep unpaid.`,
      });
    }
  }

  if (totalUpkeepPaid > 0) {
    events.push({
      type: "system",
      message: `⚔️ Mercenary upkeep: -${totalUpkeepPaid.toLocaleString()} gold.`,
    });
  }

  updates.mercenaries = JSON.stringify(active);
  updates.gold = gold;
  return updates;
}

function hireMercenaries(k, unitType, tier, count) {
  const tierDef = MERC_TIERS[tier];
  if (!tierDef) return { error: "Invalid tier" };
  const tavUpgrades = safeJsonParse(
    k.tavern_upgrades,
    {},
    "hireMercenaries:tavern_upgrades",
  );
  if (tierDef.requires && !tavUpgrades[tierDef.requires])
    return { error: `Requires ${tierDef.requires.replace("_", " ")} upgrade` };
  if (!(k.bld_taverns > 0)) return { error: "Need at least 1 tavern" };

  const level =
    tierDef.levelMin +
    Math.floor(Math.random() * (tierDef.levelMax - tierDef.levelMin + 1));
  const cost = tierDef.costPer * count;
  const upkeep = Math.ceil((cost * tierDef.upkeepPct) / tierDef.duration);
  if (k.gold < cost)
    return { error: `Need ${cost.toLocaleString()} gold` };

  const mercs = safeJsonParse(k.mercenaries, [], "hireMercenaries:mercenaries");
  mercs.push({
    unit_type: unitType,
    tier,
    level,
    count,
    hired_at_turn: k.turn,
    duration_turns: tierDef.duration,
    upkeep_per_turn: upkeep,
  });

  return {
    updates: {
      gold: k.gold - cost,
      [unitType]: (k[unitType] || 0) + count,
      mercenaries: JSON.stringify(mercs),
    },
    hired: {
      tier,
      level,
      count,
      unitType,
      duration: tierDef.duration,
      upkeep,
      cost,
    },
  };
}

function purchaseUpgrade(k, category, upgradeKey) {
  category = (category || "").toLowerCase();
  const defs = {
    farm: FARM_UPGRADES,
    granary: GRANARY_UPGRADES,
    market: MARKET_UPGRADES,
    tavern: TAVERN_UPGRADES,
    tower: TOWER_UPGRADES,
    school: SCHOOL_UPGRADES,
    shrine: SHRINE_UPGRADES,
    mausoleum: MAUSOLEUM_UPGRADES,
    library: LIBRARY_UPGRADES,
    wall: WALL_UPGRADES,
    tower_def: TOWER_DEF_UPGRADES,
    outpost: OUTPOST_UPGRADES,
    bank: BANK_UPGRADES,
  }[category];
  if (!defs) return { error: "Invalid category" };
  const def = defs[upgradeKey];
  if (!def) return { error: "Invalid upgrade" };
  const colName = `${category}_upgrades`;
  const upgrades = safeJsonParse(k[colName], {}, `purchaseUpgrade:${colName}`);
  if (upgrades[upgradeKey]) return { error: "Already purchased" };
  if (def.requires && !upgrades[def.requires])
    return { error: `Requires ${def.requires.replace(/_/g, " ")} first` };
  if (def.raceOnly && k.race !== def.raceOnly)
    return { error: `Only available to ${def.raceOnly.replace(/_/g, " ")}` };
  if (k.gold < def.cost)
    return { error: `Need ${def.cost.toLocaleString()} gold` };

  // Check resource costs
  const costWood = def.costWood || 0;
  const costStone = def.costStone || 0;
  const costIron = def.costIron || 0;

  const currentWood = k.wood || 0;
  const currentStone = k.stone || 0;
  const currentIron = k.iron || 0;

  const shortWood = Math.max(0, costWood - currentWood);
  const shortStone = Math.max(0, costStone - currentStone);
  const shortIron = Math.max(0, costIron - currentIron);

  const shortages = [];
  if (shortWood > 0) shortages.push(`${shortWood.toLocaleString()} more wood`);
  if (shortStone > 0) shortages.push(`${shortStone.toLocaleString()} more stone`);
  if (shortIron > 0) shortages.push(`${shortIron.toLocaleString()} more iron`);

  if (shortages.length > 0) {
    return { error: `Need ${shortages.join(", ")}` };
  }

  const bldCheck = {
    farm: "bld_farms",
    market: "bld_markets",
    tavern: "bld_taverns",
    tower: "bld_mage_towers",
    school: "bld_schools",
    shrine: "bld_shrines",
    mausoleum: "bld_mausoleums",
    library: "bld_libraries",
    bank: "bld_vaults",
    wall: "bld_walls",
    tower_def: "bld_guard_towers",
    outpost: "bld_outposts",
  };
  if (bldCheck[category] && !((k[bldCheck[category]] || 0) > 0))
    return { error: `Need at least 1 ${category}` };
  if (def.reqVaults && k.bld_vaults < def.reqVaults)
    return {
      error: `Need at least ${def.reqVaults} Vaults for this bank upgrade.`,
    };

  upgrades[upgradeKey] = true;
  return {
    updates: {
      gold: k.gold - def.cost,
      ...(costWood > 0 ? { wood: currentWood - costWood } : {}),
      ...(costStone > 0 ? { stone: currentStone - costStone } : {}),
      ...(costIron > 0 ? { iron: currentIron - costIron } : {}),
      [colName]: JSON.stringify(upgrades),
    },
  };
}

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
  }

  if (newsMessage) {
    events.push({
      type: 'rebellion',
      message: newsMessage,
      turn: k.turn
    });
  }
}

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

function checkAchievements(k, updates, events) {
  const ach = safeJsonParse(
    updates.achievements || k.achievements,
    [],
    "checkAchievements",
  );
  let achUpdated = false;

  const currentTowers =
    updates.bld_mage_towers !== undefined
      ? updates.bld_mage_towers
      : k.bld_mage_towers;
  const currentLibraries =
    updates.bld_libraries !== undefined
      ? updates.bld_libraries
      : k.bld_libraries;
  const currentSchools =
    updates.bld_schools !== undefined
      ? updates.bld_schools
      : k.bld_schools;
  if (
    !ach.includes("ach_grandmaster") &&
    currentTowers >= 25 &&
    currentLibraries >= 25 &&
    currentSchools >= 25
  ) {
    ach.push("ach_grandmaster");
    updates.land =
      (updates.land !== undefined ? updates.land : k.land) + 10000;
    updates.maps =
      (updates.maps !== undefined ? updates.maps : k.maps) + 5000;
    events.push({
      type: "system",
      message:
        "ACHIEVEMENT UNLOCKED: Grandmaster! Rewarded +10000 Land and +5000 Maps.",
    });
    achUpdated = true;
  }

  // Calculate total buildings from all building types
  const totalBuildings = Object.values(BUILDING_COL)
    .filter(col => col.startsWith('bld_'))
    .reduce((sum, col) => sum + (updates[col] !== undefined ? updates[col] : k[col] || 0), 0);

  if (!ach.includes("ach_constructor") && totalBuildings >= 1500) {
    ach.push("ach_constructor");
    const currentSmithies = updates.bld_smithies !== undefined ? updates.bld_smithies : k.bld_smithies || 0;
    const smithiesToAdd = Math.max(0, 100 - currentSmithies);
    updates.bld_smithies = currentSmithies + smithiesToAdd;
    events.push({
      type: "system",
      message:
        `🏆 ACHIEVEMENT UNLOCKED: Constructor! Your expertise grants ${smithiesToAdd} Smithies, bringing your total to ${currentSmithies + smithiesToAdd}.`,
    });
    achUpdated = true;
  }

  // Founder achievement: Build first building
  if (!ach.includes("ach_founder") && totalBuildings >= 1) {
    ach.push("ach_founder");
    updates.gold =
      (updates.gold !== undefined ? updates.gold : k.gold) + 5000;
    events.push({
      type: "system",
      message: "ACHIEVEMENT UNLOCKED: Founder! You've built your first structure. Rewarded +5000 Gold.",
    });
    achUpdated = true;
  }

  const currentPop =
    updates.population !== undefined ? updates.population : k.population;
  if (!ach.includes("ach_warlord") && currentPop >= 50000) {
    ach.push("ach_warlord");
    updates.land =
      (updates.land !== undefined ? updates.land : k.land) + 10000;
    events.push({
      type: "system",
      message: "ACHIEVEMENT UNLOCKED: Warlord! Rewarded +10000 Land.",
    });
    achUpdated = true;
  }

  // Colossus achievement: 10 million+ population
  if (!ach.includes("ach_colossus") && currentPop >= 10000000) {
    ach.push("ach_colossus");
    updates.land =
      (updates.land !== undefined ? updates.land : k.land) + 50000;
    updates.mana =
      (updates.mana !== undefined ? updates.mana : k.mana) + 100000;
    updates.gold =
      (updates.gold !== undefined ? updates.gold : k.gold) + 1000000;
    events.push({
      type: "system",
      message: "ACHIEVEMENT UNLOCKED: Colossus! Your empire has swollen to 10 million souls. Rewarded +50000 Land, +100000 Mana, and +1000000 Gold.",
    });
    achUpdated = true;
  }

  const currentGold = updates.gold !== undefined ? updates.gold : k.gold;
  if (!ach.includes("ach_wealthy") && currentGold >= 10000000) {
    ach.push("ach_wealthy");
    events.push({
      type: "system",
      message:
        "ACHIEVEMENT UNLOCKED: Merchant King! All trade routes now generate +10% income permanently.",
    });
    achUpdated = true;
  }

  const currentMana = updates.mana !== undefined ? updates.mana : k.mana;
  if (!ach.includes("ach_arcane") && currentMana >= 1000000) {
    ach.push("ach_arcane");
    const scrolls = safeJsonParse(
      updates.scrolls !== undefined ? updates.scrolls : k.scrolls,
      {},
      "ach_arcane:scrolls",
    );
    scrolls.blank_scroll = (scrolls.blank_scroll || 0) + 10000;
    updates.scrolls = JSON.stringify(scrolls);
    updates.res_spellbook =
      (updates.res_spellbook !== undefined ? updates.res_spellbook : k.res_spellbook || 0) + 10000;
    events.push({
      type: "system",
      message:
        "ACHIEVEMENT UNLOCKED: Arcane Overlord! Rewarded +10,000 Spellbook and +10,000 Blank Scrolls.",
    });
    achUpdated = true;
  }

  const collectorAchieved = updates._collector_unlocked;
  if (collectorAchieved) {
    if (!ach.includes("collector")) {
      ach.push("collector");
      achUpdated = true;
      // Reveal all kingdom locations
      let _disc = safeJsonParse(updates.discovered_kingdoms || k.discovered_kingdoms, {}, "collector:discovered_kingdoms");
      // This would need database access to get all kingdoms - for now, we'll mark this achievement
      // and handle the revelation in the achievement processor with db context
      updates._reveal_all_locations = true;
      events.push({
        type: "system",
        message:
          "ACHIEVEMENT UNLOCKED: Field Collector (Found all 50 expedition events). All world locations have been revealed!",
      });
    }
    delete updates._collector_unlocked;
  }

  const historianAchieved = updates._historian_unlocked;
  if (historianAchieved) {
    if (!ach.includes("historian")) {
      ach.push("historian");
      achUpdated = true;
      updates.maps =
        (updates.maps !== undefined ? updates.maps : k.maps) + 5000;
      events.push({
        type: "system",
        message:
          "ACHIEVEMENT UNLOCKED: Historian (Found all library lore). Rewarded +5000 Maps.",
      });
    }
    delete updates._historian_unlocked;
  }

  if (achUpdated) {
    updates.achievements = JSON.stringify(ach);
  }
}

// ── Level-based caps ──────────────────────────────────────────────────────────
// Caps scale linearly from base (level 1) to max (capLevel, default 1000).
// Levels above capLevel return max (the cap is fully unlocked and stays there).

function levelCap(base, max, level, capLevel = 1000) {
  const lv = Math.max(1, Math.min(capLevel, level || 1));
  const range = capLevel - 1;
  if (range <= 0) return max;
  return Math.floor(base + ((max - base) * (lv - 1)) / range);
}

function getCap(field, level, prestigeLevel = 0) {
  const c = CAPS[field];
  if (!c) return Infinity;
  let baseCap = levelCap(c.base, c.max, level, c.capLevel || 1000);
  if (prestigeLevel > 0 && field.startsWith("bld_")) {
    const tier = PRESTIGE_MODIFIERS[Math.min(prestigeLevel, 5)];
    if (tier) {
      baseCap = Math.floor(baseCap * tier.bldCap);
    }
  }
  return baseCap;
}

// ── Hire units ────────────────────────────────────────────────────────────────

function hireUnits(k, unit, amount) {
  const validUnits = [
    "fighters",
    "rangers",
    "clerics",
    "mages",
    "thieves",
    "ninjas",
    "researchers",
    "engineers",
    "scribes",
  ];
  if (!validUnits.includes(unit)) return { error: "Invalid unit type" };
  if (amount <= 0) return { error: "Amount must be positive" };

  // School cap — researchers need schools (100 per school)
  if (unit === "researchers") {
    const schoolCap = k.bld_schools * 100;
    const currentResearchers = k.researchers;
    if (schoolCap === 0)
      return { error: "You need at least 1 school to hire researchers" };
    if (currentResearchers >= schoolCap)
      return {
        error: `School capacity full — ${schoolCap.toLocaleString()} researchers max with ${k.bld_schools} school${k.bld_schools > 1 ? "s" : ""} (100 per school)`,
      };
    if (currentResearchers + amount > schoolCap)
      return {
        error: `Only room for ${(schoolCap - currentResearchers).toLocaleString()} more researchers — build more schools (100 per school)`,
      };
  }

  // Barracks cap — military troops need barracks (500 per barracks)
  const BARRACKS_TROOPS = [
    "fighters",
    "rangers",
    "clerics",
    "thieves",
    "ninjas",
  ];
  if (BARRACKS_TROOPS.includes(unit)) {
    const barracksCapacityMult = fragmentBonusManager.getBonusMultiplier(k, 'barracks', 'capacity');
    const barracksCap = Math.floor(k.bld_barracks * 500 * barracksCapacityMult);
    const currentTroops = BARRACKS_TROOPS.reduce((s, u) => s + (k[u] || 0), 0);
    if (barracksCap === 0)
      return { error: "You need at least 1 barracks to hire troops" };
    if (currentTroops >= barracksCap)
      return {
        error: `Barracks full — ${barracksCap.toLocaleString()} troops max with ${k.bld_barracks} barracks (500 per barracks)`,
      };
    if (currentTroops + amount > barracksCap)
      return {
        error: `Only room for ${(barracksCap - currentTroops).toLocaleString()} more troops — build more barracks (500 per barracks)`,
      };
  }

  // Level cap check (researchers, engineers, scribes have no level cap)
  if (!["researchers", "engineers", "scribes"].includes(unit)) {
    let cap = getCap(unit, k.level || 1);
    // Orc: Unit capacity -50% rangers
    if (k.race === "orc" && unit === "rangers") {
      cap = Math.floor(cap * 0.5);
    }
    const current = k[unit] || 0;
    if (current >= cap)
      return {
        error: `Level ${k.level || 1} cap reached for ${unit} (max ${cap.toLocaleString()}) — gain levels to increase`,
      };
    if (current + amount > cap)
      return {
        error: `Level ${k.level || 1} cap: can only hire ${(cap - current).toLocaleString()} more ${unit} (max ${cap.toLocaleString()})`,
      };
  }

  const cost = amount * UNIT_COST;
  if (k.gold < cost)
    return { error: `Not enough gold — need ${cost.toLocaleString()} gold` };
  if (amount > k.population)
    return { error: "Not enough population available" };

  // Dilute unit XP pool when new recruits join — new troops lower the average
  const dilutedLevels = diluteTroopXp(k, unit, amount);

  return {
    updates: {
      gold: k.gold - cost,
      population: k.population - amount,
      [unit]: (k[unit] || 0) + amount,
      ...(dilutedLevels ? { troop_levels: dilutedLevels } : {}),
      updated_at: Math.floor(Date.now() / 1000),
    },
  };
}

// ── Research ──────────────────────────────────────────────────────────────────

function studyDiscipline(k, discipline, researchersAssigned) {
  const col = RESEARCH_MAP[discipline];
  if (!col) return { error: "Unknown discipline" };
  if (researchersAssigned > k.researchers)
    return { error: "Not enough researchers" };

  const currentLevel = k[col] || 100;
  const increment = researchIncrement(
    k,
    discipline,
    researchersAssigned,
    currentLevel,
  );
  if (increment === 0)
    return { error: "Need more researchers for any progress" };

  let cap = MAX_RESEARCH;
  if (discipline === "spellbook" || discipline === "school_spellbook") {
    cap = Infinity;
  } else {
    // Apply race-specific hard cap for this discipline (if any)
    const raceCaps = RESEARCH_DISCIPLINE_CAPS[k.race] || {};
    cap = raceCaps[discipline] || MAX_RESEARCH;
  }
  const newVal = Math.min(cap, k[col] + increment);

  return {
    updates: { [col]: newVal, updated_at: Math.floor(Date.now() / 1000) },
    increment,
  };
}

// ── Magic Schools ─────────────────────────────────────────────────────────────

// Select a school of magic (one-time choice when res_spellbook >= 100)
function _selectSchool(k, schoolName) {
  // Validate school name
  if (!MAGIC_SCHOOLS[schoolName]) {
    return { error: `Unknown school: ${schoolName}` };
  }

  // Can only choose if: school_of_magic is null AND res_spellbook >= 100
  if (k.school_of_magic) {
    return { error: `You have already chosen the school of ${k.school_of_magic}` };
  }

  if (k.res_spellbook < 100) {
    return { error: `You must reach spellbook research level 100 to choose a school` };
  }

  // Set school choice
  const schoolLabel = schoolName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return {
    updates: { school_of_magic: schoolName, school_spellbook: 0 },
    events: [{ type: 'system', message: `🔮 You have chosen the school of ${schoolLabel}. You can now research school-specific spells!` }]
  };
}

// ── Experience & Levelling ────────────────────────────────────────────────────

// XP required to reach each level (cumulative from level 1).
// Single smooth quadratic: 10*(level-1)^2
// Level 500 = 2,490,010 XP — a dedicated player taking all turns (~403/day) hits
// this in ~124 days at 50 XP/turn base.

// ── Construction ──────────────────────────────────────────────────────────────

// Add buildings to the queue — charges gold, no turn cost
function queueBuildings(k, orders) {
  const queue = safeJsonParse(k.build_queue, {}, "queueBuildings:build_queue");

  let totalCost = 0;
  let totalLand = 0;
  const processedOrders = {};

  for (const [building, qty] of Object.entries(orders)) {
    // Normalize building name (e.g., 'library' -> 'libraries')
    const key = BUILDING_ALIASES[building] || building;
    if (!BUILDING_COST[key]) {
      console.warn(
        `[queueBuildings] Unknown building type: ${building} (normalized to ${key})`,
      );
      continue;
    }
    const n = Math.max(0, Number(qty));
    if (n <= 0) continue;

    // Check Cap
    const col = BUILDING_COL[key];
    const currentBuilt = k[col] || 0;
    const currentQueued = queue[key] || 0;
    const cap = getCap(col, k.level || 1);

    if (currentBuilt + currentQueued + n > cap) {
      if (currentBuilt + currentQueued >= cap) {
        return {
          error: `${key.replace(/_/g, " ")} cap reached (max ${cap.toLocaleString()}).`,
        };
      }
      return {
        error: `Cannot queue ${n} more ${key.replace(/_/g, " ")}. Only room for ${cap - currentBuilt - currentQueued}.`,
      };
    }

    const goldPerUnit = BUILDING_GOLD_COST[key] ?? 100;
    const landPerUnit = BUILDING_LAND_COST[key] || 0;
    totalCost += goldPerUnit * n;
    totalLand += landPerUnit * n;
    processedOrders[key] = n;
  }

  let usedLand = 0;
  const landBreakdown = {};
  for (const [key, cost] of Object.entries(BUILDING_LAND_COST)) {
    const col = BUILDING_COL[key];
    const builtCost = (col && k[col]) ? (k[col] || 0) * cost : 0;
    const queuedCost = (queue[key] || 0) * cost;
    const buildingLandCost = builtCost + queuedCost;
    if (buildingLandCost > 0) {
      landBreakdown[key] = { built: k[col] || 0, queued: queue[key] || 0, cost, total: buildingLandCost };
    }
    if (col) usedLand += builtCost;
    usedLand += queuedCost;
  }
  const freeLand = Math.max(0, k.land - usedLand);

  if (totalLand > 0) {
    devLog(`[queueBuildings] Land calculation for ${k.name}: total=${k.land}, used=${usedLand}, free=${freeLand}, requesting=${totalLand}`);
    if (Object.keys(landBreakdown).length > 0) {
      devLog('[queueBuildings] Breakdown:', JSON.stringify(landBreakdown, null, 2));
    }
  }

  if (totalCost > k.gold) {
    return {
      error: `Need ${totalCost.toLocaleString()} gold but only have ${k.gold.toLocaleString()} gold`,
    };
  }

  if (totalLand > freeLand) {
    return {
      error: `Need ${totalLand.toLocaleString()} land but only have ${freeLand.toLocaleString()} free land`,
    };
  }

  // ── Resource building bracket-lock validation + resource cost ────────────────
  const level = k.level || 1;
  const resSeqRaw = safeJsonParse(k.resource_sequence, {}, 'queueBuildings:resource_sequence');
  let totalWoodCost = 0;
  let totalStoneCost = 0;
  let totalIronCost = 0;

  for (const [key, n] of Object.entries(processedOrders)) {
    const rbCfg = RESOURCE_BUILDING_CONFIG[key];
    if (!rbCfg) continue; // Not a resource building

    // Enforce one-slot-per-resource-type: reject if any building of this type is already queued
    for (const [qKey, qCount] of Object.entries(queue)) {
      if (qCount <= 0) continue;
      const qRbCfg = RESOURCE_BUILDING_CONFIG[qKey];
      if (qRbCfg && qRbCfg.type === rbCfg.type) {
        return { error: `A ${rbCfg.type} building (${qKey.replace(/_/g, ' ')}) is already in progress. Only one ${rbCfg.type} build slot is allowed at a time.` };
      }
    }

    const seq = resSeqRaw[rbCfg.type] || { s2_paid_at_bracket: -1, s3_paid_at_bracket: -1, last_s3_bracket: -1 };
    const s3Col = config.RESOURCE_STAGE3_COL[rbCfg.type];
    const s3Cap = Math.floor((level - 1) / 10) + 1;
    const s3Current = k[s3Col] || 0;

    const s1Col = config.RESOURCE_STAGE1_COL[rbCfg.type];
    const s2Col = config.RESOURCE_STAGE2_COL[rbCfg.type];

    if (rbCfg.stage === 1) {
      if (s3Current >= s3Cap) {
        return { error: `${key.replace(/_/g, ' ')} is locked — you have reached the maximum number of stage-3 ${rbCfg.type} buildings (${s3Cap}) for your level.` };
      }
      // Stage 1 hard cap of 3
      const s1Current = k[s1Col] || 0;
      if (s1Current + n > 3) {
        return { error: `${key.replace(/_/g, ' ')} cap reached (max 3).` };
      }
      const s2Current = (k[s2Col] || 0) + (queue[config.RESOURCE_STAGE2_BUILDINGS[rbCfg.type]] || 0);
      if (s2Current > 0) {
        return { error: `${key.replace(/_/g, ' ')} is locked — you already have Stage 2 ${rbCfg.type} buildings in progress or built.` };
      }
    } else if (rbCfg.stage === 2) {
      if (s3Current >= s3Cap) {
        return { error: `${key.replace(/_/g, ' ')} is locked — you have reached the maximum number of stage-3 ${rbCfg.type} buildings (${s3Cap}) for your level.` };
      }
      if (seq.s2_paid_at_bracket <= -1) {
        return { error: `You must purchase the Stage 2 ${rbCfg.type} upgrade before building ${key.replace(/_/g, ' ')}.` };
      }
      const s2Built = k[s2Col] || 0;
      const s2Queued = queue[config.RESOURCE_STAGE2_BUILDINGS[rbCfg.type]] || 0;
      const s1Current = k[s1Col] || 0;
      // If none built or queued, need 3 stage 1s to start
      if (s2Built + s2Queued === 0 && s1Current < 3) {
         return { error: `You need 3 ${s1Col.replace('bld_', '').replace(/_/g, ' ')} built to start building ${key.replace(/_/g, ' ')}.` };
      }
      // Stage 2 hard cap of 5
      if (s2Built + s2Queued + n > 5) {
        return { error: `${key.replace(/_/g, ' ')} cap reached (max 5).` };
      }
    } else if (rbCfg.stage === 3) {
      if (seq.s3_paid_at_bracket <= -1) {
        return { error: `You must purchase the Stage 3 ${rbCfg.type} upgrade before building ${key.replace(/_/g, ' ')}.` };
      }
      const s3Built = k[s3Col] || 0;
      const s3Queued = queue[config.RESOURCE_STAGE3_BUILDINGS[rbCfg.type]] || 0;
      const s2Current = k[s2Col] || 0;
      // If none built or queued, need 5 stage 2s to start
      if (s3Built + s3Queued === 0 && s2Current < 5) {
         return { error: `You need 5 ${s2Col.replace('bld_', '').replace(/_/g, ' ')} built to start building ${key.replace(/_/g, ' ')}.` };
      }
      // Check s3 cap (bracket + 1 total allowed)
      if (s3Current + n > s3Cap) {
        return { error: `${key.replace(/_/g, ' ')} cap reached for your level (max ${s3Cap}).` };
      }
    }

    // Tally resource costs
    totalWoodCost += (BUILDING_WOOD_COST[key] || 0) * n;
    totalStoneCost += (BUILDING_STONE_COST[key] || 0) * n;
    totalIronCost += (BUILDING_IRON_COST[key] || 0) * n;
  }

  // Check resource stockpile sufficiency
  if (totalWoodCost > 0 && k.wood < totalWoodCost) {
    return { error: `Need ${totalWoodCost.toLocaleString()} wood but only have ${k.wood.toLocaleString()}.` };
  }
  if (totalStoneCost > 0 && k.stone < totalStoneCost) {
    return { error: `Need ${totalStoneCost.toLocaleString()} stone but only have ${k.stone.toLocaleString()}.` };
  }
  if (totalIronCost > 0 && k.iron < totalIronCost) {
    return { error: `Need ${totalIronCost.toLocaleString()} iron but only have ${k.iron.toLocaleString()}.` };
  }

  for (const [key, n] of Object.entries(processedOrders)) {
    queue[key] = (queue[key] || 0) + n;
  }

  const queueUpdates = {
    build_queue: JSON.stringify(queue),
    gold: k.gold - totalCost,
  };
  if (totalWoodCost > 0)  queueUpdates.wood  = Math.max(0, k.wood - totalWoodCost);
  if (totalStoneCost > 0) queueUpdates.stone = Math.max(0, k.stone - totalStoneCost);
  if (totalIronCost > 0)  queueUpdates.iron  = Math.max(0, k.iron - totalIronCost);

  return {
    updates: queueUpdates,
    totalCost,
    totalLand,
  };
}

// Process build queue each turn — engineers work on allocated buildings continuously
function processBuildQueue(k, events, xpSourcesAccum) {
  const updates = {};

  const constructionNotes = [];

  // Tool bonuses
  const hl = TOOL_COL.hammers;
  const sl = TOOL_COL.scaffolding;
  const hammerBonus = 1 + (k[hl] || 0) * 0.05;
  const smithyBonus = 1 + Math.floor(k.bld_smithies / 15) * 0.02;
  const raceConstr = raceBonus(k, "construction");
  const engLevelMult = unitLevelMult(k, "engineers");
  const resConstr = (k.res_construction || 100) / 100;
  const smithySpeedMult = fragmentBonusManager.getBonusMultiplier(k, 'smithies', 'speed');
  const smithyProdMult = fragmentBonusManager.getBonusMultiplier(k, 'smithies', 'production');
  const smithyQualityMult = fragmentBonusManager.getBonusMultiplier(k, 'smithies', 'quality');
  const effectiveSmithyMult = smithySpeedMult * smithyProdMult * smithyQualityMult;
  const baseToolMult =
    hammerBonus * smithyBonus * raceConstr * engLevelMult * resConstr * effectiveSmithyMult;

  // Consumable tool pools — tracked across the building loop this turn
  let blueprintsLeft = k.blueprints_stored;
  let scaffoldingLeft = k[sl] || 0;
  let blueprintsUsed = 0;
  let scaffoldingUsed = 0;

  // Get engineer allocation (both regular builds and resource builds)
  const allocationRaw = safeJsonParse(
    k.build_allocation,
    {},
    "processBuildQueue:build_allocation",
  );
  const resourceAllocationRaw = safeJsonParse(
    k.resource_build_allocation,
    {},
    "processBuildQueue:resource_build_allocation",
  );
  let allocation = {};
  for (const b of Object.keys(allocationRaw)) {
    const key = BUILDING_ALIASES[b] || b;
    allocation[key] = (allocation[key] || 0) + (Number(allocationRaw[b]) || 0);
  }
  for (const b of Object.keys(resourceAllocationRaw)) {
    const key = BUILDING_ALIASES[b] || b;
    allocation[key] = (allocation[key] || 0) + (Number(resourceAllocationRaw[b]) || 0);
  }

  // Also check legacy build_queue for any manually queued items
  const queueRaw = safeJsonParse(
    k.build_queue,
    {},
    "processBuildQueue:build_queue",
  );
  let queue = {};
  for (const b of Object.keys(queueRaw)) {
    const key = BUILDING_ALIASES[b] || b;
    queue[key] = (queue[key] || 0) + (Number(queueRaw[b]) || 0);
  }

  // Normalize progress
  const progressRaw = safeJsonParse(
    k.build_progress,
    {},
    "processBuildQueue:build_progress",
  );
  let progress = {};
  for (const b of Object.keys(progressRaw)) {
    const key = BUILDING_ALIASES[b] || b;
    progress[key] = (progress[key] || 0) + (Number(progressRaw[b]) || 0);
  }

  // Regular buildings complete from allocation alone; resource buildings require
  // a queue entry. Include both so allocation-driven regular builds are processed.
  const activeBuildings = new Set([
    ...Object.keys(allocation).filter((b) => allocation[b] > 0),
    ...Object.keys(queue).filter((b) => queue[b] > 0),
  ]);
  if (activeBuildings.size === 0) return updates;

  const completedItems = [];
  let totalEngineersWorked = 0;

  for (const building of activeBuildings) {
    const engAssigned = allocation[building] || 0;
    if (engAssigned <= 0 && !(queue[building] > 0)) continue;

    const cost = BUILDING_COST[building];
    if (!cost) continue;

    // ── Blueprint gate — required for buildings with base cost >= 100 turns ──
    if (BLUEPRINT_REQUIRED.has(building) && blueprintsLeft <= 0) {
      updates._blueprint_needed = updates._blueprint_needed || [];
      if (!updates._blueprint_needed.includes(building))
        updates._blueprint_needed.push(building);
      continue; // skip this building entirely this turn
    }

    // ── Scaffolding gate — required for buildings > 100 turns base ──────────
    if (SCAFFOLDING_REQUIRED.has(building) && scaffoldingLeft <= 0) {
      updates._scaffolding_needed = updates._scaffolding_needed || [];
      if (!updates._scaffolding_needed.includes(building))
        updates._scaffolding_needed.push(building);
      continue;
    }

    // ── Per-building tool multiplier ─────────────────────────────────────────
    let toolMult = baseToolMult;

    // ── Resource building race bonus (additional multiplier) ─────────────────
    if (RESOURCE_BUILDING_CONFIG[building]) {
      toolMult *= raceBonus(k, 'resource_build');
    }

    const buildMb = safeJsonParse(k.milestone_bonuses, {}, "build:mb");
    const buildMilestoneMult = 1 + (buildMb.construction_speed_pct || 0) / 100;
    let workDone = Math.floor(engAssigned * toolMult * buildMilestoneMult);
    if (engAssigned > 0 && workDone <= 0) workDone = 1; // Prevent complete stalling for low bonuses
    if (workDone <= 0) continue;

    // Resource buildings require a queue entry — engineers alone cannot build them
    if (RESOURCE_BUILDING_CONFIG[building] && !(queue[building] > 0)) continue;

    totalEngineersWorked += engAssigned;

    // ── Completion ──────────────────────────────────────────────────────────
    const prevProgress = progress[building] || 0;
    const totalProgress = prevProgress + workDone;
    const rawCompleted = Math.floor(totalProgress / cost);
    // Resource buildings require a queue entry — completion capped to queue count.
    // Regular buildings (farms, barracks, etc.) complete freely from allocation;
    // they have no per-unit gold/land deduction via queue.
    // Resource buildings: capped by queue count (queue entry required, already
    // enforced by the continue above). Regular buildings: complete from rawCompleted.
    const completed = RESOURCE_BUILDING_CONFIG[building]
      ? Math.min(rawCompleted, queue[building])
      : rawCompleted;

    if (completed > 0) {
      const col =
        k.race === "vampire" &&
        (building === "shrines" || building === "shrine")
          ? "bld_mausoleums"
          : BUILDING_COL[building];
      if (col) {
        const current = updates[col] !== undefined ? updates[col] : k[col] || 0;
        const cap = getCap(col, k.level || 1);
        let canAdd = Math.max(0, Math.min(completed, cap - current));

        // Regular buildings: units from the queue were already paid in queueBuildings;
        // only deduct gold/land/resources for units built beyond the queue via engineer allocation.
        if (!RESOURCE_BUILDING_CONFIG[building] && canAdd > 0) {
          const goldPerUnit = BUILDING_GOLD_COST[building] ?? 100;
          const landPerUnit = BUILDING_LAND_COST[building] || 0;
          const woodPerUnit = BUILDING_WOOD_COST[building] || 0;
          const stonePerUnit = BUILDING_STONE_COST[building] || 0;
          const ironPerUnit = BUILDING_IRON_COST[building] || 0;

          const fromQueue = Math.min(canAdd, queue[building] || 0);
          let extraUnits = canAdd - fromQueue;

          if (extraUnits > 0) {
            if (goldPerUnit > 0) {
              const curGold = updates.gold !== undefined ? updates.gold : k.gold;
              extraUnits = Math.max(0, Math.min(extraUnits, Math.floor(curGold / goldPerUnit)));
            }
            if (landPerUnit > 0 && extraUnits > 0) {
              let totalUsedLand = 0;
              for (const [bKey, bCost] of Object.entries(BUILDING_LAND_COST)) {
                const bCol = BUILDING_COL[bKey];
                if (bCol) totalUsedLand += (updates[bCol] !== undefined ? updates[bCol] : (k[bCol] || 0)) * bCost;
                totalUsedLand += (queue[bKey] || 0) * bCost;
              }
              const availLand = (updates.land !== undefined ? updates.land : k.land) - totalUsedLand;
              extraUnits = Math.max(0, Math.min(extraUnits, Math.floor(availLand / landPerUnit)));
            }
            if (woodPerUnit > 0 && extraUnits > 0) {
              const curWood = updates.wood !== undefined ? updates.wood : k.wood;
              extraUnits = Math.max(0, Math.min(extraUnits, Math.floor(curWood / woodPerUnit)));
            }
            if (stonePerUnit > 0 && extraUnits > 0) {
              const curStone = updates.stone !== undefined ? updates.stone : k.stone;
              extraUnits = Math.max(0, Math.min(extraUnits, Math.floor(curStone / stonePerUnit)));
            }
            if (ironPerUnit > 0 && extraUnits > 0) {
              const curIron = updates.iron !== undefined ? updates.iron : k.iron;
              extraUnits = Math.max(0, Math.min(extraUnits, Math.floor(curIron / ironPerUnit)));
            }
            if (extraUnits > 0 && goldPerUnit > 0) {
              const curGold = updates.gold !== undefined ? updates.gold : k.gold;
              updates.gold = curGold - goldPerUnit * extraUnits;
            }
            if (extraUnits > 0 && woodPerUnit > 0) {
              const curWood = updates.wood !== undefined ? updates.wood : k.wood;
              updates.wood = curWood - woodPerUnit * extraUnits;
            }
            if (extraUnits > 0 && stonePerUnit > 0) {
              const curStone = updates.stone !== undefined ? updates.stone : k.stone;
              updates.stone = curStone - stonePerUnit * extraUnits;
            }
            if (extraUnits > 0 && ironPerUnit > 0) {
              const curIron = updates.iron !== undefined ? updates.iron : k.iron;
              updates.iron = curIron - ironPerUnit * extraUnits;
            }
          }

          const finalCanAdd = fromQueue + extraUnits;
          if (finalCanAdd < canAdd && finalCanAdd === 0) {
            const curGold = updates.gold !== undefined ? updates.gold : k.gold;
            const curWood = updates.wood !== undefined ? updates.wood : k.wood;
            const curStone = updates.stone !== undefined ? updates.stone : k.stone;
            const curIron = updates.iron !== undefined ? updates.iron : k.iron;
            let reason = 'gold';
            if (goldPerUnit > 0 && curGold < goldPerUnit) reason = 'gold';
            else if (woodPerUnit > 0 && curWood < woodPerUnit) reason = 'wood';
            else if (stonePerUnit > 0 && curStone < stonePerUnit) reason = 'stone';
            else if (ironPerUnit > 0 && curIron < ironPerUnit) reason = 'iron';
            constructionNotes.push(`⚠️ ${building.replace(/_/g, ' ')} paused — not enough ${reason}.`);
          }
          canAdd = finalCanAdd;
        }

        updates[col] = current + canAdd;
        if (canAdd < completed && canAdd === 0) {
          constructionNotes.push(
            `⚠️ ${building.replace(/_/g, " ")} cap reached at level ${k.level || 1} (max ${cap.toLocaleString()}) — level up to build more.`,
          );
        }
        if (canAdd > 0) {
          completedItems.push(
            `${canAdd.toLocaleString()} ${building.replace(/_/g, " ")}`,
          );

          // ── Consume blueprint on completion ─────────────────────────────
          if (BLUEPRINT_REQUIRED.has(building)) {
            const consume = Math.min(canAdd, blueprintsLeft);
            blueprintsLeft -= consume;
            blueprintsUsed += consume;
          }

          // ── Consume scaffolding on completion ───────────────────────────
          if (SCAFFOLDING_REQUIRED.has(building)) {
            const consume = Math.min(canAdd, scaffoldingLeft);
            scaffoldingLeft -= consume;
            scaffoldingUsed += consume;
          }

          // ── Resource building auto-consumption on first completion ────────
          // Stage 2 (lumber_camp/blockfield/strip_mine): on first one, consume 3 stage-1
          // Stage 3 (sawmill/stone_quarry/deep_mine): on first one per bracket, consume 5 stage-2
          const rbCfg = RESOURCE_BUILDING_CONFIG[building];
          if (rbCfg) {
            const level = k.level || 1;
            const currentBracket = Math.floor((level - 1) / 10);
            const resSeq = safeJsonParse(k.resource_sequence, {}, 'processBuildQueue:resource_sequence');
            const typeSeq = resSeq[rbCfg.type] || { s2_paid_at_bracket: -1, s3_paid_at_bracket: -1, last_s3_bracket: -1 };

            if (rbCfg.stage === 2) {
              // First stage-2 built: consume 3 stage-1 and return 3 land
              const prevCount = (k[col] !== undefined ? k[col] : 0);
              if (prevCount === 0 && canAdd >= 1) {
                const s1Col = config.RESOURCE_STAGE1_COL[rbCfg.type];
                if (s1Col) {
                  const s1Current = updates[s1Col] !== undefined ? updates[s1Col] : (k[s1Col] || 0);
                  const toConsume = Math.min(s1Current, 3);
                  updates[s1Col] = s1Current - toConsume;
                  updates.land = (updates.land !== undefined ? updates.land : k.land) + toConsume;
                  constructionNotes.push(`🔄 3 ${s1Col.replace('bld_', '')} converted into ${building.replace(/_/g, ' ')}.`);
                }
              }
            } else if (rbCfg.stage === 3) {
              // First stage-3 in this bracket: consume 5 stage-2, return 10 land, lock bracket
              const newS3Count = current + canAdd;
              // "first one in this bracket" means the new total is now > 0 and bracket wasn't locked
              if (newS3Count > 0 && typeSeq.last_s3_bracket !== currentBracket) {
                const s2Col = config.RESOURCE_STAGE2_COL[rbCfg.type];
                if (s2Col) {
                  const s2Current = updates[s2Col] !== undefined ? updates[s2Col] : (k[s2Col] || 0);
                  const toConsume = Math.min(s2Current, 5);
                  updates[s2Col] = s2Current - toConsume;
                  updates.land = (updates.land !== undefined ? updates.land : k.land) + (toConsume * 3);
                  // Lock the bracket
                  const updatedSeq = safeJsonParse(updates.resource_sequence || k.resource_sequence, {}, 'processBuildQueue:resource_sequence_update');
                  if (!updatedSeq[rbCfg.type]) updatedSeq[rbCfg.type] = { s2_paid_at_bracket: -1, s3_paid_at_bracket: -1, last_s3_bracket: -1 };
                  updatedSeq[rbCfg.type].last_s3_bracket = currentBracket;
                  updates.resource_sequence = JSON.stringify(updatedSeq);
                  constructionNotes.push(`🔄 5 ${s2Col.replace('bld_', '')} consumed. ${building.replace(/_/g, ' ')} bracket locked.`);
                }
              }
            }
          }
        }
      }
      progress[building] = totalProgress - completed * cost;
      if (queue[building] > 0) {
        queue[building] = Math.max(0, queue[building] - completed);
        if (queue[building] <= 0) {
          delete queue[building];
          if (RESOURCE_BUILDING_CONFIG[building]) {
            // Production buildings auto-release engineers on completion
            delete allocation[building];
          }
          // Reset progress to 0 — nothing queued to build toward
          delete progress[building];
        }
      }
    } else {
      progress[building] = totalProgress;
    }

    // Calculate active construction details for news
    if (!updates._build_estimates) updates._build_estimates = [];
    if (workDone > 0) {
      const pending = queue[building] || 0;
      const label = building.replace(/_/g, " ");

      const goldPerUnit = BUILDING_GOLD_COST[building] || 0;
      const landPerUnit = BUILDING_LAND_COST[building] || 0;

      const buildResStr = (count) => {
        const resParts = [];
        if (goldPerUnit > 0) resParts.push(`${(goldPerUnit * count).toLocaleString()} gc`);
        if (landPerUnit > 0) resParts.push(`${(landPerUnit * count).toLocaleString()} land`);
        return resParts.length > 0 ? ` (Using ${resParts.join(" & ")})` : "";
      };

      if (workDone >= cost) {
        const nextTurn = Math.floor((progress[building] + workDone) / cost);
        const totalCount = pending + (nextTurn > 0 ? nextTurn : 0);
        updates._build_estimates.push(
          `${totalCount} ${label} concluding [~${nextTurn} next turn]${buildResStr(totalCount)}`,
        );
      } else {
        const turnsLeft = Math.ceil(
          (cost - Math.max(0, progress[building])) / workDone,
        );
        const pct = Math.floor((Math.max(0, progress[building]) / cost) * 100);
        const count = pending || 1;
        updates._build_estimates.push(
          `${count} ${label} [${pct}% done, ~${turnsLeft} turns left]${buildResStr(count)}`,
        );
      }
    }
  }

  // ── Hammer degradation ──
  const hammerCount = k[hl] || 0;
  if (hammerCount > 0 && activeBuildings.size > 0 && totalEngineersWorked > 0) {
    const hammersUsedThisTurn = Math.min(hammerCount, totalEngineersWorked);
    const used = k.hammer_turns_used + hammersUsedThisTurn;
    const breaks = Math.floor(used / 40); // 1 hammer breaks every 40 turns of use
    if (breaks > 0) {
      const newCount = Math.max(0, hammerCount - breaks);
      updates[hl] = newCount;
      updates.hammer_turns_used = used - breaks * 40;
      updates._hammerBreakMsg = `${breaks} hammer${breaks > 1 ? "s" : ""} wore out and broke.`;
    } else {
      updates.hammer_turns_used = used;
    }
  }

  if (updates._hammerBreakMsg) {
    constructionNotes.push(updates._hammerBreakMsg);
  }

  if (blueprintsUsed > 0)
    updates.blueprints_stored = Math.max(
      0,
      k.blueprints_stored - blueprintsUsed,
    );
  if (scaffoldingUsed > 0) updates[sl] = Math.max(0, scaffoldingLeft);

  // News notices for missing tools
  if (updates._blueprint_needed) delete updates._blueprint_needed;
  if (updates._scaffolding_needed) delete updates._scaffolding_needed;
  delete updates._low_gold;

  // Release engineers from resource buildings with no queue entry (stragglers
  // not caught in the loop's completion block).
  for (const b of Object.keys(allocation)) {
    if (RESOURCE_BUILDING_CONFIG[b] && !(queue[b] > 0)) {
      delete allocation[b];
      delete progress[b];
    }
  }

  // Clean up zero-progress entries for fully inactive buildings
  for (const b of Object.keys(progress)) {
    if (!allocation[b] && !queue[b]) delete progress[b];
  }

  updates.build_queue = JSON.stringify(queue);
  updates.build_progress = JSON.stringify(progress);

  // Split allocation back into regular and resource allocations
  const finalBuildAlloc = {};
  const finalResourceAlloc = {};
  for (const [building, eng] of Object.entries(allocation)) {
    if (RESOURCE_BUILDING_CONFIG[building]) {
      finalResourceAlloc[building] = eng;
    } else {
      finalBuildAlloc[building] = eng;
    }
  }
  updates.build_allocation = JSON.stringify(finalBuildAlloc);
  updates.resource_build_allocation = JSON.stringify(finalResourceAlloc);

  if (completedItems.length > 0) {
    const totalCompleted = completedItems.reduce(function (s, item) {
      const match = item.match(/^(\d[\d,]*)/);
      return s + (match ? parseInt(match[1].replace(/,/g, "")) : 1);
    }, 0);
    
    progressGoal(k, updates, 'building_built', totalCompleted);

    const conXp = awardXp({ ...k, xp_sources: xpSourcesAccum }, "construction", totalCompleted);
    updates.xp = conXp.xp;
    updates.level = conXp.level;
    if (conXp.levelled) events.push(...conXp.events);
    updates.xp_sources_updated = conXp.xp_sources;

    // Award engineer unit XP per building completed
    const engXpRes = awardTroopXp(
      { ...k, troop_levels: updates.troop_levels || k.troop_levels },
      "engineers",
      totalCompleted * 10,
    );
    updates.troop_levels = typeof engXpRes.troop_levels === "string" ? JSON.parse(engXpRes.troop_levels) : engXpRes.troop_levels;

    let finalMsg = "";
    if (completedItems.length > 0) {
      finalMsg += `Completed: ${completedItems.join(", ")}. `;
    }
    if (updates._build_estimates && updates._build_estimates.length > 0) {
        finalMsg += `Actively constructing: ${updates._build_estimates.join(" \u00B7 ")}. `;
    }
    if (constructionNotes.length > 0) {
      finalMsg += constructionNotes.join(" ") + " ";
    }
    if (engXpRes.levelUps.length) {
      const engLvl = safeJsonParse(engXpRes.troop_levels, {}, "auto:troop_levels").engineers?.level || "";
      finalMsg += `⚒️ Engineers grew more skilled (Level ${engLvl})!`;
    }

    if (finalMsg) {
      events.push({ type: "system", message: `🏗️ ${finalMsg.trim()}` });
    }
  } else if (activeBuildings.size > 0) {
    let finalMsg = "";
    if (updates._build_estimates && updates._build_estimates.length > 0) {
        finalMsg += `Actively constructing: ${updates._build_estimates.join(" \u00B7 ")}. `;
    } else {
      if (totalEngineersWorked > 0) {
        finalMsg += `Engineers making progress on ${activeBuildings.size} building type${activeBuildings.size > 1 ? "s" : ""}. `;
      } else {
        finalMsg += `No engineers assigned to construct ${activeBuildings.size} building type${activeBuildings.size > 1 ? "s" : ""} in queue. `;
      }
    }
    if (constructionNotes.length > 0) {
      finalMsg += constructionNotes.join(" ");
    }
    events.push({ type: "system", message: `🏗️ ${finalMsg.trim()}` });
  }

  delete updates._build_estimates;
  delete updates._hammerBreakMsg;

  return updates;
}

// Forge construction tools — costs gold, no engineer requirement
function forgeTools(k, toolType, quantity) {
  const cost = TOOL_GOLD_COST[toolType];
  const col = TOOL_COL[toolType];
  if (!cost || !col) return { error: "Unknown tool type" };
  const totalCost = cost * quantity;
  if (totalCost > k.gold)
    return {
      error: `Need ${totalCost.toLocaleString()} gold but only have ${k.gold.toLocaleString()} gold`,
    };
  return {
    updates: {
      [col]: (k[col] || 0) + quantity,
      gold: k.gold - totalCost,
      updated_at: Math.floor(Date.now() / 1000),
    },
    totalCost,
  };
}

// ── Military combat ───────────────────────────────────────────────────────────

function wmCrewRequired(race, engineerLevel) {
  let base = WM_CREW_REQUIRED[race] || 3;
  // Dwarf racial unique — solo crew at engineer level 25+
  if (race === "dwarf" && engineerLevel >= 25) base = 1;
  return base;
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

function sumRecordValues(record = {}) {
  return Object.values(record).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

const COMBAT_NEWS_UNIT_LABELS = {
  thralls: "Thralls",
  fighters: "Fighters",
  rangers: "Rangers",
  mages: "Mages",
  clerics: "Clerics",
  ninjas: "Ninjas",
  thieves: "Thieves",
  engineers: "Engineers",
  war_machines: "War Machines",
};

const COMBAT_NEWS_UNIT_ORDER = [
  "thralls",
  "fighters",
  "rangers",
  "mages",
  "clerics",
  "ninjas",
  "thieves",
  "engineers",
  "war_machines",
];

function normalizeCombatUnits(units = {}) {
  return {
    thralls: units.thralls || 0,
    fighters: units.fighters || 0,
    rangers: units.rangers || 0,
    mages: units.mages || 0,
    clerics: units.clerics || 0,
    ninjas: units.ninjas || 0,
    thieves: units.thieves || 0,
    engineers: units.engineers || 0,
    war_machines: units.war_machines || units.warMachines || 0,
  };
}

function formatCombatUnitCounts(units = {}, labels = COMBAT_NEWS_UNIT_LABELS) {
  const normalized = normalizeCombatUnits(units);
  const parts = COMBAT_NEWS_UNIT_ORDER
    .filter((unit) => normalized[unit] > 0)
    .map((unit) => `${(normalized[unit] || 0).toLocaleString()} ${labels[unit] || COMBAT_NEWS_UNIT_LABELS[unit]}`);
  return parts.length ? parts.join(", ") : "None";
}

function formatCombatBuildingsLost(report = {}) {
  const parts = [];
  if (report.wallsDestroyed > 0) parts.push(`${report.wallsDestroyed.toLocaleString()} Walls`);
  if (report.defBldLost > 0) parts.push(`${report.defBldLost.toLocaleString()} Buildings`);
  if (report.buildingDamaged) parts.push(String(report.buildingDamaged).replace(/_/g, " "));
  return parts.length ? parts.join(", ") : "None";
}

function formatCombatV2NewsBlurb(attacker, defender, report, perspective = "attacker") {
  const fmt = (value) => (Number(value) || 0).toLocaleString();
  const attackerName = attacker?.name || "The attacking host";
  const defenderName = defender?.name || "the defending kingdom";
  const land = report.landTransferred || 0;
  const attackerLost = report.injuredTroops?.attacker?.deadByType || {
    thralls: report.atkThrallsLost,
    fighters: report.atkFightersLost,
    rangers: report.atkRangersLost,
    mages: report.atkMagesLost,
    clerics: report.atkClericsLost,
    ninjas: report.atkNinjasLost,
    thieves: report.atkThievesLost,
    engineers: report.atkEngineersLost,
    war_machines: report.atkWmLost,
  };
  const defenderLost = report.injuredTroops?.defender?.deadByType || {
    thralls: report.defThrallsLost,
    fighters: report.defFightersLost,
    rangers: report.defRangersLost,
    mages: report.defMagesLost,
    clerics: report.defClericsLost,
    ninjas: report.defNinjasLost,
    thieves: report.defThievesLost,
    engineers: report.defEngineersLost,
    war_machines: report.defWmLost,
  };
  const attackerInjured = report.atkInjuredByType || report.injuredTroops?.attacker?.injuredByType || {};
  const defenderInjured = report.defInjuredByType || report.injuredTroops?.defender?.injuredByType || {};
  const attackerDeaths = report.attackerKilled || sumRecordValues(attackerLost);
  const defenderDeaths = report.defenderKilled || sumRecordValues(defenderLost);
  const criticalKills = report.criticalKills ||
    (report.injuredTroops?.attacker?.criticalKills || 0) +
    (report.injuredTroops?.defender?.criticalKills || 0);
  const criticalHits = report.criticalHits ||
    (report.injuredTroops?.attacker?.criticalHits || 0) +
    (report.injuredTroops?.defender?.criticalHits || 0);
  const sabotage = report.thiefSabotage || report.disabledWarMachines || 0;
  const wallDamage = report.wallDamage || 0;
  const defenderUnitLabels = {
    ...COMBAT_NEWS_UNIT_LABELS,
    war_machines: "Ballistae",
  };

  const title = perspective === "defender" ? "Defense report" : "Attack report";
  const outcome = report.win ? "Attacker victory" : "Defender held";
  const landLine = perspective === "defender"
    ? `Land loss: ${report.win ? `${fmt(land)} acres lost` : "None"}`
    : `Land gained: ${report.win ? `${fmt(land)} acres captured` : "None"}`;
  const detailParts = [];
  if (sabotage > 0) detailParts.push(`${fmt(sabotage)} ballistae disabled`);
  if (wallDamage > 0) detailParts.push(`${fmt(wallDamage)} wall HP damaged`);
  const siegeLine = detailParts.length ? `Siege notes: ${detailParts.join("; ")}` : "Siege notes: None";

  return [
    `${title}: ${attackerName} vs ${defenderName}`,
    `Outcome: ${outcome}`,
    landLine,
    `Troops engaged - Attacker: ${formatCombatUnitCounts(report.sent)}`,
    `Troops engaged - Defender: ${formatCombatUnitCounts(report.defenderEngaged, defenderUnitLabels)}`,
    `Troops lost - Attacker: ${formatCombatUnitCounts(attackerLost)} (${fmt(attackerDeaths)} total)`,
    `Troops lost - Defender: ${formatCombatUnitCounts(defenderLost, defenderUnitLabels)} (${fmt(defenderDeaths)} total)`,
    `Troops injured - Attacker: ${formatCombatUnitCounts(attackerInjured)}`,
    `Troops injured - Defender: ${formatCombatUnitCounts(defenderInjured, defenderUnitLabels)}`,
    `Critical hits: ${fmt(criticalHits)} hits, ${fmt(criticalKills)} killing blows`,
    `Buildings lost: ${formatCombatBuildingsLost(report)}`,
    siegeLine,
  ].join("\n");
}

function resolveMilitaryAttackV2Adapter(
  attacker,
  defender,
  sentUnits,
  attackerHeroes = [],
  defenderHeroes = [],
) {
  attacker.heroes = attackerHeroes;
  defender.heroes = defenderHeroes;
  const combatIsNight =
    typeof attacker.__combatIsNight === "boolean"
      ? attacker.__combatIsNight
      : typeof defender.__combatIsNight === "boolean"
        ? defender.__combatIsNight
        : isNight();
  const attackerIsVampire = attacker.race === "vampire";
  const defenderIsVampire = defender.race === "vampire";
  const defenderUsesDayThralls = defenderIsVampire && !combatIsNight;
  const attackingThralls = attackerIsVampire ? Math.max(0, attacker.thralls || 0) : 0;
  const defendingThralls = defenderIsVampire ? Math.max(0, defender.thralls || 0) : 0;

  const sent = {
    thralls: attackingThralls,
    fighters: Math.min(sentUnits.fighters || 0, attacker.fighters || 0),
    rangers: Math.min(sentUnits.rangers || 0, attacker.rangers || 0),
    mages: Math.min(sentUnits.mages || 0, attacker.mages || 0),
    warMachines: Math.min(sentUnits.warMachines || 0, attacker.war_machines || 0),
    ninjas: Math.min(sentUnits.ninjas || 0, attacker.ninjas || 0),
    thieves: Math.min(sentUnits.thieves || 0, attacker.thieves || 0),
    clerics: Math.min(sentUnits.clerics || 0, attacker.clerics || 0),
    engineers: Math.min(sentUnits.engineers || 0, attacker.engineers || 0),
    ladders: Math.min(sentUnits.ladders || 0, attacker.ladders || 0),
  };

  if (
    sent.fighters <= 0 &&
    sent.rangers <= 0 &&
    sent.mages <= 0 &&
    sent.ninjas <= 0
  ) {
    return { error: "Send at least some combat troops" };
  }

  const v2Attacker = {
    ...attacker,
    thralls: sent.thralls,
    fighters: sent.fighters,
    rangers: sent.rangers,
    mages: sent.mages,
    war_machines: sent.warMachines,
    ninjas: sent.ninjas,
    thieves: sent.thieves,
    clerics: sent.clerics,
    engineers: sent.engineers,
    ladders: sent.ladders,
  };
  const v2Defender = {
    ...defender,
    __vampireDayDefense: defenderUsesDayThralls,
    thralls: defendingThralls,
    fighters: defenderUsesDayThralls ? 0 : getAvailableUnits(defender, "fighters"),
    rangers: defenderUsesDayThralls ? 0 : getAvailableUnits(defender, "rangers"),
    mages: defenderUsesDayThralls ? 0 : getAvailableUnits(defender, "mages"),
    ninjas: defenderUsesDayThralls ? 0 : getAvailableUnits(defender, "ninjas"),
    thieves: defenderUsesDayThralls ? 0 : getAvailableUnits(defender, "thieves"),
    clerics: defenderUsesDayThralls ? 0 : getAvailableUnits(defender, "clerics"),
    engineers: defenderUsesDayThralls ? 0 : getAvailableUnits(defender, "engineers"),
    war_machines: defenderUsesDayThralls ? 0 : (defender.war_machines || 0),
  };
  const defenderAvailable = {
    thralls: v2Defender.thralls,
    fighters: v2Defender.fighters,
    rangers: v2Defender.rangers,
    mages: v2Defender.mages,
    ninjas: v2Defender.ninjas,
    thieves: v2Defender.thieves,
    clerics: v2Defender.clerics,
    engineers: v2Defender.engineers,
    war_machines: v2Defender.war_machines || 0,
  };

  const v2Result = combatResolverV2.executeCombat(
    null,
    v2Attacker,
    v2Defender,
    "military",
    "fighters",
  );

  const attackerUpdates = {
    ...v2Result.attackerUpdates,
    thralls: Math.max(0, (attacker.thralls || 0) - (sent.thralls - v2Attacker.thralls)),
    fighters: Math.max(0, (attacker.fighters || 0) - (sent.fighters - v2Attacker.fighters)),
    rangers: Math.max(0, (attacker.rangers || 0) - (sent.rangers - v2Attacker.rangers)),
    mages: Math.max(0, (attacker.mages || 0) - (sent.mages - v2Attacker.mages)),
    ninjas: Math.max(0, (attacker.ninjas || 0) - (sent.ninjas - v2Attacker.ninjas)),
    thieves: Math.max(0, (attacker.thieves || 0) - (sent.thieves - v2Attacker.thieves)),
    clerics: Math.max(0, (attacker.clerics || 0) - (sent.clerics - v2Attacker.clerics)),
    engineers: Math.max(0, (attacker.engineers || 0) - (sent.engineers - v2Attacker.engineers)),
    war_machines: Math.max(0, (attacker.war_machines || 0) - (sent.warMachines - v2Attacker.war_machines)),
  };

  const defenderUpdates = {
    ...v2Result.defenderUpdates,
    last_attack_turn: defender.turn || 0,
    thralls: Math.max(0, (defender.thralls || 0) - (defenderAvailable.thralls - v2Defender.thralls)),
    fighters: Math.max(0, (defender.fighters || 0) - (defenderAvailable.fighters - v2Defender.fighters)),
    rangers: Math.max(0, (defender.rangers || 0) - (defenderAvailable.rangers - v2Defender.rangers)),
    mages: Math.max(0, (defender.mages || 0) - (defenderAvailable.mages - v2Defender.mages)),
    ninjas: Math.max(0, (defender.ninjas || 0) - (defenderAvailable.ninjas - v2Defender.ninjas)),
    thieves: Math.max(0, (defender.thieves || 0) - (defenderAvailable.thieves - v2Defender.thieves)),
    clerics: Math.max(0, (defender.clerics || 0) - (defenderAvailable.clerics - v2Defender.clerics)),
    engineers: Math.max(0, (defender.engineers || 0) - (defenderAvailable.engineers - v2Defender.engineers)),
    war_machines: Math.max(0, v2Defender.war_machines || 0),
  };

  const landTransferred = v2Result.win ? Math.floor((defender.land || 0) * 0.1) : 0;
  if (landTransferred > 0) {
    attackerUpdates.land = (attacker.land || 0) + landTransferred;
    defenderUpdates.land = Math.max(0, (defender.land || 0) - landTransferred);
  }

  const atkXp = awardXp(attacker, v2Result.win ? "combat_win" : "combat_loss", 1);
  const defXp = awardXp(defender, v2Result.win ? "combat_loss" : "combat_win", 1);
  attackerUpdates.xp = atkXp.xp;
  attackerUpdates.level = atkXp.level;
  defenderUpdates.xp = defXp.xp;
  defenderUpdates.level = defXp.level;

  const attackerDead = v2Result.report.injuredTroops?.attacker?.deadByType || {};
  const defenderDead = v2Result.report.injuredTroops?.defender?.deadByType || {};
  const attackerInjured = v2Result.report.injuredTroops?.attacker?.injuredByType || {};
  const defenderInjured = v2Result.report.injuredTroops?.defender?.injuredByType || {};
  const defenderEngaged = {
    ...defenderAvailable,
    war_machines: v2Result.report.diagnostics?.defender?.structureDefense?.ballistae || 0,
  };
  const wallHpBefore = defender.wall_hp || 0;
  const wallHpAfter = defenderUpdates.wall_hp ?? wallHpBefore;

  const report = {
    ...v2Result.report,
    win: v2Result.win,
    sent,
    defenderEngaged,
    landTransferred,
    combatSystem: "v2",
    atkPower: Math.round(v2Result.report.diagnostics?.attacker?.totalDmg || 0),
    defPower: Math.round(v2Result.report.diagnostics?.defender?.totalDmg || 0),
    powerRatio: Math.round(
      ((v2Result.report.diagnostics?.attacker?.totalDmg || 0) /
        Math.max(1, v2Result.report.diagnostics?.defender?.totalDmg || 0)) *
        100,
    ) / 100,
    atkFightersLost: attackerDead.fighters || 0,
    atkThrallsLost: attackerDead.thralls || 0,
    atkRangersLost: attackerDead.rangers || 0,
    atkMagesLost: attackerDead.mages || 0,
    atkNinjasLost: attackerDead.ninjas || 0,
    atkClericsLost: attackerDead.clerics || 0,
    atkThievesLost: attackerDead.thieves || 0,
    atkEngineersLost: attackerDead.engineers || 0,
    atkWmLost: attackerDead.war_machines || 0,
    defFightersLost: defenderDead.fighters || 0,
    defThrallsLost: defenderDead.thralls || 0,
    defRangersLost: defenderDead.rangers || 0,
    defMagesLost: defenderDead.mages || 0,
    defNinjasLost: defenderDead.ninjas || 0,
    defClericsLost: defenderDead.clerics || 0,
    defThievesLost: defenderDead.thieves || 0,
    defEngineersLost: defenderDead.engineers || 0,
    defWmLost: defenderDead.war_machines || 0,
    atkInjuredByType: attackerInjured,
    defInjuredByType: defenderInjured,
    ninjaKills: v2Result.report.ninjaAssassinations?.filter((a) => a.success).length || 0,
    rangerKills: 0,
    flankKills: 0,
    thiefSabotage: v2Result.report.disabledWarMachines || 0,
    criticalHits:
      (v2Result.report.injuredTroops?.attacker?.criticalHits || 0) +
      (v2Result.report.injuredTroops?.defender?.criticalHits || 0),
    criticalKills:
      (v2Result.report.injuredTroops?.attacker?.criticalKills || 0) +
      (v2Result.report.injuredTroops?.defender?.criticalKills || 0),
    wallsDestroyed: 0,
    wallHpBefore,
    wallHpAfter,
    wallDamage: v2Result.report.wallDamage || 0,
    steps: [
      {
        phase: "Diagnostics",
        title: "Combat V2",
        msg: "Experimental HP/DMG combat resolved behind USE_COMBAT_V2.",
        icon: "V2",
      },
      {
        phase: "Power",
        title: "HP/DMG Budget",
        msg: `Attacker DMG ${Math.round(v2Result.report.diagnostics?.attacker?.totalDmg || 0)} vs Defender DMG ${Math.round(v2Result.report.diagnostics?.defender?.totalDmg || 0)}.`,
        icon: "V2",
      },
      {
        phase: "Summary",
        title: "Casualty Report",
        msg: `Attacker deaths: ${v2Result.report.attackerKilled || 0}. Defender deaths: ${v2Result.report.defenderKilled || 0}. Critical kills: ${
          (v2Result.report.injuredTroops?.attacker?.criticalKills || 0) +
          (v2Result.report.injuredTroops?.defender?.criticalKills || 0)
        }.`,
        icon: "V2",
      },
    ],
  };

  const atkEvent = formatCombatV2NewsBlurb(attacker, defender, report, "attacker");
  const defEvent = formatCombatV2NewsBlurb(attacker, defender, report, "defender");

  return {
    win: v2Result.win,
    report,
    attackerUpdates,
    defenderUpdates,
    atkEvent,
    defEvent,
  };
}

function resolveMilitaryAttack(
  attacker,
  defender,
  sentUnits,
  attackerHeroes = [],
  defenderHeroes = [],
) {
  attacker.heroes = attackerHeroes;
  defender.heroes = defenderHeroes;
  if (USE_COMBAT_V2) {
    return resolveMilitaryAttackV2Adapter(
      attacker,
      defender,
      sentUnits,
      attackerHeroes,
      defenderHeroes,
    );
  }
  const fmt = (n) => (n || 0).toLocaleString();
  const steps = [];
  const attackerUpdates = {};
  const defenderUpdates = {
    last_attack_turn: defender.turn || 0 // Record when this kingdom was attacked
  };
  // sentUnits: { fighters, rangers, mages, warMachines, ninjas, thieves, clerics, engineers, ladders }
  const sent = {
    fighters: Math.min(sentUnits.fighters || 0, attacker.fighters || 0),
    rangers: Math.min(sentUnits.rangers || 0, attacker.rangers || 0),
    mages: Math.min(sentUnits.mages || 0, attacker.mages || 0),
    warMachines: Math.min(
      sentUnits.warMachines || 0,
      attacker.war_machines || 0,
    ),
    ninjas: Math.min(sentUnits.ninjas || 0, attacker.ninjas || 0),
    thieves: Math.min(sentUnits.thieves || 0, attacker.thieves || 0),
    clerics: Math.min(sentUnits.clerics || 0, attacker.clerics || 0),
    engineers: Math.min(sentUnits.engineers || 0, attacker.engineers || 0),
    ladders: Math.min(sentUnits.ladders || 0, attacker.ladders || 0),
  };
  const laddersActive = sent.ladders;
  if (
    sent.fighters <= 0 &&
    sent.rangers <= 0 &&
    sent.mages <= 0 &&
    sent.ninjas <= 0
  )
    return { error: "Send at least some combat troops" };

  // ── Anti-bully penalty ────────────────────────────────────────────────────
  const landRatio = (attacker.land || 1) / Math.max(1, defender.land || 1);
  const fighterRatio =
    (attacker.fighters || 1) / Math.max(1, defender.fighters || 1);
  let bullyRatio = Math.max(landRatio, fighterRatio * 0.5);
  let bullyPenalty = 1.0;
  let bullyMsg = null;
  let shameEvent = null;
  if (bullyRatio >= 8) {
    bullyPenalty = 0.4;
    bullyMsg = "⚠️ Your kingdom is disgraced attacking such a weak foe.";
    shameEvent = `👑 ${attacker.name} has attacked the much weaker ${defender.name}. The world watches in disgust.`;
  } else if (bullyRatio >= 4) {
    bullyPenalty = 0.6;
    bullyMsg = "⚠️ Happiness suffers — this is slaughter, not war.";
  } else if (bullyRatio >= 2) {
    bullyPenalty = 0.8;
    bullyMsg = "⚠️ Your troops lack motivation fighting a weaker foe.";
  }

  // ── Happiness multipliers ────────────────────────────────────────────────────
  const atkHappinessMult = happinessCombatMult(attacker.happiness !== undefined && attacker.happiness !== null ? attacker.happiness : 50);
  const defHappinessMult = happinessCombatMult(defender.happiness !== undefined && defender.happiness !== null ? defender.happiness : 50);

  // ── Research, race and level helpers ──────────────────────────────────────
  const atkFighterLvl = effectiveTroopLevel(attacker, "fighters") / 50;
  const atkRangerLvl = effectiveTroopLevel(attacker, "rangers") / 50;
  const atkMageLvl = effectiveTroopLevel(attacker, "mages") / 50;
  const atkNinjaLvl = effectiveTroopLevel(attacker, "ninjas") / 50;
  let atkThiefLvl = effectiveTroopLevel(attacker, "thieves") / 50;
  const defFighterLvl = effectiveTroopLevel(defender, "fighters") / 50;
  const defRangerLvl = effectiveTroopLevel(defender, "rangers") / 50;
  const defMageLvl = effectiveTroopLevel(defender, "mages") / 50;
  const defNinjaLvl = effectiveTroopLevel(defender, "ninjas") / 50;

  const night = isNight();
  if (attacker.race === "vampire" && night) atkThiefLvl *= 1.5;

  // ── Step 1: Defending troops (exclude training fields) ────────────────────
  const defAvail = {
    fighters: getAvailableUnits(defender, "fighters"),
    rangers: getAvailableUnits(defender, "rangers"),
    mages: getAvailableUnits(defender, "mages"),
    ninjas: getAvailableUnits(defender, "ninjas"),
    thieves: getAvailableUnits(defender, "thieves"),
    clerics: getAvailableUnits(defender, "clerics"),
    engineers: getAvailableUnits(defender, "engineers"),
  };

  let daylightPenaltyMsg = null;
  if (defender.race === "vampire" && !night) {
    defAvail.fighters = 0;
    defAvail.rangers = 0;
    defAvail.mages = 0;
    defAvail.ninjas = 0;
    defAvail.thieves = 0;
    
    let thrallMult = 5.0;
    const defMausUpg = safeJsonParse(defender.mausoleum_upgrades, {}, "auto:mausoleum_upgrades");
    if (defMausUpg.night_watch) {
      thrallMult += 0.5; // +10% to the 5.0 multiplier
    }
    defAvail.clerics = Math.floor(defAvail.clerics * thrallMult);

    daylightPenaltyMsg =
      "☀️ Daylight penalty: Only Thralls defend the Vampire stronghold during the day, but with massive fervor!";
  }

  // ── Step 1b: Thief sabotage — disable some defender war machines ───────────
  let defWmActive = defender.war_machines || 0;
  let thiefSabotage = 0;
  if (sent.thieves > 0) {
    const sabotageChance = Math.min(
      0.4,
      sent.thieves * 0.001 * atkThiefLvl * raceBonus(attacker, "stealth"),
    );
    const disabledWm = Math.floor(defWmActive * sabotageChance);
    defWmActive = Math.max(0, defWmActive - disabledWm);
    thiefSabotage = disabledWm;
    steps.push({
      phase: "Sabotage",
      title: "Thief Sabotage",
      msg: `Thieves disabled ${disabledWm} defending war machines.`,
      icon: "🥷",
    });
  }

  // ── Step 2: Ninja pre-battle strike ───────────────────────────────────────
  let ninjaKills = 0;
  let ninjaIntercepted = 0;
  if (sent.ninjas > 0) {
    const strikeRate =
      0.01 +
      Math.min(
        0.03,
        sent.ninjas * 0.0001 * atkNinjaLvl * raceBonus(attacker, "stealth"),
      );
    const rawKills = Math.floor(defAvail.fighters * strikeRate);
    // Defender ninjas intercept at 50% effectiveness
    const interceptRate = Math.min(0.5, defAvail.ninjas * 0.001 * defNinjaLvl);
    ninjaIntercepted = Math.floor(rawKills * interceptRate);
    ninjaKills = Math.max(0, rawKills - ninjaIntercepted);
    steps.push({
      phase: "Stealth",
      title: "Ninja Strike",
      msg: `Ninjas struck the defense line causing ${ninjaKills} casualties (${ninjaIntercepted} intercepted).`,
      icon: "🗡️",
    });
  }
  const defFightersAfterNinja = Math.max(0, defAvail.fighters - ninjaKills);

  // ── Step 2b: Flank Maneuver ───────────────────────────────────────────────
  let flankKills = 0;
  const flankPower = (sent.ninjas * 2 + sent.rangers * 0.5) * atkNinjaLvl;
  if (flankPower > 50) {
    const flankChance = 0.15 + sent.ninjas * 0.001;
    if (Math.random() < flankChance) {
      flankKills = Math.floor(flankPower * (0.5 + Math.random() * 0.5));
      steps.push({
        phase: "Tactical",
        title: "Flank Maneuver",
        msg: `Your swift units flanked the enemy, causing ${flankKills} casualties behind the main line!`,
        icon: "↪️",
      });
    }
  }

  // ── Step 3: Ranger opening volley ─────────────────────────────────────────
  const rangerVolleyRate =
    (0.02 + Math.min(0.05, sent.rangers * 0.00005)) *
    atkRangerLvl *
    raceBonus(attacker, "military");
  const rangerKills = Math.floor(defFightersAfterNinja * rangerVolleyRate);
  if (rangerKills > 0)
    steps.push({
      phase: "Ranged",
      title: "Opening Volley",
      msg: `Rangers fired a volley causing ${rangerKills} casualties.`,
      icon: "🏹",
    });
  const defFightersAfterVolley = Math.max(
    0,
    defFightersAfterNinja - rangerKills - flankKills,
  );

  // ── Step 4: Attack power ──────────────────────────────────────────────────
  const weaponsEquipped = Math.min(
    sent.fighters,
    attacker.weapons_stockpile || 0,
  );
  const weaponBonus = 1 + (weaponsEquipped / Math.max(sent.fighters, 1)) * 0.25;
  const weaponsResearchMult = fragmentBonusManager.getBonusMultiplier(attacker, 'weapons', 'damage');
  const atkWeapon = ((attacker.res_weapons || 100) / 100) * weaponBonus * weaponsResearchMult;
  const atkTactics = (attacker.res_military || 100) / 100;
  const atkRaceMil = raceBonus(attacker, "military");
  const atkRaceMag = raceBonus(attacker, "magic");
  const atkRangerRace = raceBonus(attacker, "military"); // rangers share military bonus

  // Fighter power — front line
  const atkFighterPower =
    sent.fighters * atkWeapon * atkTactics * atkRaceMil * atkFighterLvl;
  // Ranger power — always ranged, lower per-unit than fighters
  const atkRangerPower =
    sent.rangers * 0.7 * atkTactics * atkRangerRace * atkRangerLvl;
  // Mage power — back line, high per-unit
  const atkMagePower =
    sent.mages *
    2.5 *
    ((attacker.res_attack_magic || 100) / 100) *
    atkRaceMag *
    atkMageLvl;
  // War machines — scaled by crew sufficiency
  const engLvl = effectiveTroopLevel(attacker, "engineers");
  const atkEngMult = unitLevelMult(attacker, "engineers");
  const crewNeeded = wmCrewRequired(attacker.race, engLvl);
  const engAvail = Math.max(0, attacker.engineers || 0);
  const wmCrewable = Math.min(
    sent.warMachines,
    Math.floor(engAvail / crewNeeded),
  );
  const warMachinesDamageMult = fragmentBonusManager.getBonusMultiplier(attacker, 'war_machines', 'damage');
  const warMachinesPowerMult = fragmentBonusManager.getBonusMultiplier(attacker, 'war_machines', 'power');
  const wmPower =
    wmCrewable *
    500 *
    ((attacker.res_war_machines || 100) / 100) *
    raceBonus(attacker, "war_machines") *
    atkEngMult *
    warMachinesDamageMult *
    warMachinesPowerMult;

  // Hero power — attacker
  let atkHeroPower = 0;
  let atkWmMult = 1.0;
  let atkMageMult = 1.0;
  let atkWarlordMult = 1.0;
  let atkBloodShamanMult = 1.0;
  let atkPackLeaderMult = 1.0;

  attackerHeroes.forEach((h) => {
    atkHeroPower += getHeroPower(h);
    if (h.class === "siegebreaker") atkWmMult *= 1.35;
    if (h.class === "archmage") atkMageMult *= 1.25;
    if (h.class === "warlord") atkWarlordMult *= 1.25;
    if (h.class === "blood_shaman") atkBloodShamanMult *= 1.1; // +10% total military
    if (h.class === "alpha") atkPackLeaderMult *= 1.5; // rangers
  });

  const atkPowerRaw =
    (atkFighterPower +
      atkRangerPower * atkPackLeaderMult +
      atkMagePower * atkMageMult +
      wmPower * atkWmMult +
      atkHeroPower) *
    atkHappinessMult *
    bullyPenalty *
    atkWarlordMult *
    atkBloodShamanMult;
  const atkPrestigeMult = (attacker.prestige_level > 0) 
    ? (PRESTIGE_MODIFIERS[Math.min(attacker.prestige_level, 5)]?.combat || 1.0)
    : 1.0;

  const atkMb = safeJsonParse(attacker.milestone_bonuses, {}, "combat:atkMb");
  let atkPower = atkPowerRaw * (1 + (atkMb.attack_pct || 0) / 100) * atkPrestigeMult * 1.0 * 1.0;

  if (attacker.race === "vampire" && !night) {
    const atkMausUpg = safeJsonParse(attacker.mausoleum_upgrades, {}, "auto:mausoleum_upgrades");
    const atkPenaltyMult = atkMausUpg.night_watch ? 0.2 : 0.1;
    atkPower = Math.floor(atkPowerRaw * atkPenaltyMult * 1.0 * 1.0);
    if (!daylightPenaltyMsg) daylightPenaltyMsg = "";
    daylightPenaltyMsg +=
      " ☀️ Daylight penalty: Your troops are lethargic and ineffective during the day!";
  }

  // ── Step 5: Defense power ─────────────────────────────────────────────────
  const armorEquipped = Math.min(
    defFightersAfterVolley,
    defender.armor_stockpile || 0,
  );
  const armorBonus =
    1 + (armorEquipped / Math.max(defFightersAfterVolley, 1)) * 0.25;
  const armorResearchMult = fragmentBonusManager.getBonusMultiplier(defender, 'armor', 'defense');
  const defArmor = ((defender.res_armor || 100) / 100) * armorBonus * armorResearchMult;
  const defTactics = (defender.res_military || 100) / 100;
  const defRaceMil = raceBonus(defender, "military");
  const defRaceMag = raceBonus(defender, "magic");

  // Fighter wall
  const defFighterPower =
    defFightersAfterVolley * defArmor * defTactics * defRaceMil * defFighterLvl;
  // Ranger fire from outposts/towers — rangers defend from walls, scaled by structures
  const outpostBonus =
    (defender.bld_outposts || 0) * 0.1 +
    (defender.bld_guard_towers || 0) * 0.05;
  const defRangerPower =
    defAvail.rangers *
    0.8 *
    defTactics *
    raceBonus(defender, "military") *
    defRangerLvl *
    Math.max(1, outpostBonus);
  // Mage barrier
  const defMagePower =
    defAvail.mages *
    1.5 *
    ((defender.res_defense_magic || 100) / 100) *
    defRaceMag *
    defMageLvl;
  // War machine garrison — crewed by engineers at home
  const defEngLvl = effectiveTroopLevel(defender, "engineers");
  const defEngMult = unitLevelMult(defender, "engineers");
  const defCrewNeeded = wmCrewRequired(defender.race, defEngLvl);
  const defWmCrewable = Math.min(
    defWmActive,
    Math.floor(defAvail.engineers / defCrewNeeded),
  );
  const defWarMachinesDamageMult = fragmentBonusManager.getBonusMultiplier(defender, 'war_machines', 'damage');
  const defWarMachinesPowerMult = fragmentBonusManager.getBonusMultiplier(defender, 'war_machines', 'power');
  const defWmPower =
    defWmCrewable *
    500 *
    ((defender.res_war_machines || 100) / 100) *
    raceBonus(defender, "war_machines") *
    defEngMult *
    defWarMachinesDamageMult *
    defWarMachinesPowerMult;
  // Engineer garrison repair bonus
  const defEngBonus =
    Math.floor(defAvail.engineers / 10) *
    50 *
    defEngMult *
    raceBonus(defender, "construction");
  // Wall defense power (includes warmachines mounted on walls)
  const defWallPowerRaw = wallDefensePower(defender);
  // Ladders scale against the number of walls: each active ladder bypasses one wall's share
  // of defense, capped at 20% total reduction (defenders still man the battlements)
  const defWalls = defender.bld_walls || 0;
  const ladderBypass =
    defWalls > 0 ? Math.min(0.2, laddersActive / defWalls) : 0;
  const defWallPower = Math.floor(defWallPowerRaw * (1 - ladderBypass));
  // ── Step 1b: Ladder assault ────────────────────────────────────────────────
  if (laddersActive > 0 && defWalls > 0) {
    const bypassPct = Math.round(ladderBypass * 100);
    steps.push({
      phase: "Siege",
      title: "🪜 Ladder Assault",
      msg: `${laddersActive} 🪜 ladders scaled the walls (crewed by engineers), bypassing ${bypassPct}% of wall defenses!`,
      icon: "🪜",
    });
  } else if (laddersActive > 0) {
    steps.push({
      phase: "Siege",
      title: "🪜 Ladder Party",
      msg: `🪜 Ladders were raised but the enemy has no walls to scale.`,
      icon: "🪜",
    });
  }

  // Outpost ranger patrol power
  const defOutpostPower = outpostRangerPower(defender);
  // Guard tower detection power (adds to structural defense)
  const defTowerPower = towerDetectionPower(defender);
  // Structure defense (castles) — 500 defense per castle (max 10 = 5000)
  const castleDefenseMult = fragmentBonusManager.getBonusMultiplier(defender, 'castles', 'defense');
  const defStructures = Math.floor((defender.bld_castles || 0) * 500 * castleDefenseMult);
  // Defense tier bonuses
  const defUpgrades = safeJsonParse(
    defender.defense_upgrades,
    {},
    "resolveMilitaryAttack:defense_upgrades",
  );
  let defTierMult = 1.0;
  if (defUpgrades.fortified) defTierMult += 0.05;
  if (defUpgrades.keep) defTierMult += 0.1;
  if (defUpgrades.citadel) defTierMult += 0.15;

  // Hero power — defender
  let defHeroPower = 0;
  let defWmMult = 1.0;
  let defMageMult = 1.0;
  let defWarlordMult = 1.0;
  let defBloodShamanMult = 1.0;
  let defPackLeaderMult = 1.0;
  let defLunarSentinelMult = 1.0;
  let defSiegebreakerStructureMult = 1.0;

  defenderHeroes.forEach((h) => {
    defHeroPower += getHeroPower(h);
    if (h.class === "siegebreaker") {
      defWmMult *= 1.35;
      defSiegebreakerStructureMult *= 2.0; // Impenetrable Bastion buff
    }
    if (h.class === "archmage") defMageMult *= 1.25;
    if (h.class === "warlord") defWarlordMult *= 1.25;
    if (h.class === "blood_shaman") defBloodShamanMult *= 1.1; // +10% total military
    if (h.class === "alpha") defPackLeaderMult *= 1.5; // rangers
    if (h.class === "lunar_sentinel") defLunarSentinelMult *= 1.5; // Moonbeam Shield - magic def
  });

  const defPower =
    (defFighterPower +
      defRangerPower * defPackLeaderMult +
      defMagePower * defMageMult * defLunarSentinelMult +
      defWmPower * defWmMult +
      defEngBonus +
      (defWallPower + defOutpostPower + defTowerPower + defStructures) *
        defSiegebreakerStructureMult +
      defHeroPower) *
    defHappinessMult *
    defTierMult *
    defWarlordMult *
    defBloodShamanMult *
    raceBonus(defender, "defense");

  const defMb = safeJsonParse(defender.milestone_bonuses, {}, "combat:defMb");
  const defMilestoneMult = 1 + (defMb.defense_pct || 0) / 100;

  const defPrestigeMult = (defender.prestige_level > 0)
    ? (PRESTIGE_MODIFIERS[Math.min(defender.prestige_level, 5)]?.combat || 1.0)
    : 1.0;

  const defPowerFinal = defPower * defMilestoneMult * defPrestigeMult * 1.0 * 1.0;

  // ── Step 6: Battle resolution ─────────────────────────────────────────────
  const variance = 0.8 + Math.random() * 0.4;
  const win = atkPower * variance > defPowerFinal;
  const powerRatio = atkPower / Math.max(1, defPowerFinal);
  steps.push({
    phase: "Clash",
    title: "Main Assault",
    msg: `Attacker Power (${Math.round(atkPower)}) vs Defender Power (${Math.round(defPowerFinal)}).`,
    icon: "⚔️",
  });

  // ── Step 7: Casualties ────────────────────────────────────────────────────
  // Clerics reduce own-side losses
  let atkClericHeal = Math.min(
    0.35,
    ((attacker.clerics || 0) / Math.max(sent.fighters + sent.rangers, 1)) *
      0.08 *
      raceBonus(attacker, "magic"),
  );

  const atkShrineUpgrades = safeJsonParse(attacker.shrine_upgrades, {}, "auto:shrine_upgrades");
  if (atkShrineUpgrades.healing_aura) atkClericHeal = Math.min(0.7, atkClericHeal + 0.1);
  if (atkShrineUpgrades.sanctuary) atkClericHeal = Math.min(0.7, atkClericHeal + 0.15);
  let defClericHeal = Math.min(
    0.35,
    (defAvail.clerics / Math.max(defAvail.fighters || 1, 1)) *
      0.08 *
      raceBonus(defender, "magic"),
  );

  const defShrineUpgrades = safeJsonParse(defender.shrine_upgrades, {}, "auto:shrine_upgrades");
  if (defShrineUpgrades.healing_aura) defClericHeal = Math.min(0.7, defClericHeal + 0.1);
  if (defShrineUpgrades.sanctuary) defClericHeal = Math.min(0.7, defClericHeal + 0.15);

  // Hero heal / loss reduction
  attackerHeroes.forEach((h) => {
    if (h.class === "paladin")
      atkClericHeal = Math.min(0.7, atkClericHeal + 0.1); // Holy Heal
    if (h.class === "warlord")
      atkClericHeal = Math.min(0.7, atkClericHeal + 0.15); // Tactical Mastery reduces losses
  });

  defenderHeroes.forEach((h) => {
    if (h.class === "paladin")
      defClericHeal = Math.min(0.7, defClericHeal + 0.1);
    if (h.class === "warlord")
      defClericHeal = Math.min(0.7, defClericHeal + 0.15);
  });

  if (atkClericHeal > 0 || defClericHeal > 0) {
    let healMsg = "";
    if (atkClericHeal > 0)
      healMsg += `Attacker clerics reduced casualties by ${Math.round(atkClericHeal * 100)}%. `;
    if (defClericHeal > 0)
      healMsg += `Defender clerics reduced casualties by ${Math.round(defClericHeal * 100)}%.`;
    steps.push({
      phase: "Healing",
      title: "Divine Intervention",
      msg: healMsg.trim(),
      icon: "✨",
    });
  }

  // Dark Elf stealth reduces attacker losses
  const atkStealthBonus = raceBonus(attacker, "stealth") > 1 ? 0.85 : 1.0;

  const atkFighterLossPct = win
    ? 0.04 + Math.random() * 0.08
    : 0.2 + Math.random() * 0.25;
  const atkRangerLossPct = win
    ? 0.02 + Math.random() * 0.04
    : 0.1 + Math.random() * 0.12; // ranged = safer
  const atkMageLossPct = win
    ? 0.01 + Math.random() * 0.03
    : 0.05 + Math.random() * 0.08; // back line = safest

  const defFighterLossPct = win
    ? 0.15 + Math.random() * 0.2
    : 0.05 + Math.random() * 0.08;
  const defRangerLossPct = win
    ? 0.08 + Math.random() * 0.12
    : 0.02 + Math.random() * 0.04;
  const defMageLossPct = win
    ? 0.06 + Math.random() * 0.1
    : 0.01 + Math.random() * 0.03;

  const atkFigLost = Math.floor(
    sent.fighters * atkFighterLossPct * atkStealthBonus * (1 - atkClericHeal),
  );
  const atkRanLost = Math.floor(
    sent.rangers * atkRangerLossPct * atkStealthBonus * (1 - atkClericHeal),
  );
  const atkMagLost = Math.floor(sent.mages * atkMageLossPct * atkStealthBonus);
  const atkCleLost = Math.floor(sent.clerics * (win ? 0.01 : 0.08));
  const atkNinLost = Math.floor(sent.ninjas * (win ? 0.05 : 0.15));
  const atkThiLost = Math.floor(sent.thieves * (win ? 0.02 : 0.1));
  const atkEngLost = Math.floor(sent.engineers * (win ? 0.01 : 0.05));
  const atkWmLost = win
    ? 0
    : Math.floor(sent.warMachines * (0.02 + Math.random() * 0.06));

  const defFigLost = Math.floor(
    defAvail.fighters * defFighterLossPct * (1 - defClericHeal),
  );
  const defRanLost = Math.floor(
    defAvail.rangers * defRangerLossPct * (1 - defClericHeal),
  );
  const defMagLost = Math.floor(defAvail.mages * defMageLossPct);
  const defCleLost = Math.floor(defAvail.clerics * (win ? 0.1 : 0.02));
  const defNinLost = Math.floor(defAvail.ninjas * (win ? 0.15 : 0.05));
  const defThiLost = Math.floor(defAvail.thieves * (win ? 0.08 : 0.03));
  const defEngLost = Math.floor(defAvail.engineers * (win ? 0.08 : 0.02));
  const defWmLost = win
    ? Math.floor(defWmActive * (0.03 + Math.random() * 0.07))
    : 0;

  // Track specific ninja/ranger opening kills separately for the report if desired,
  // but they are already included in the losses above (mostly).
  // Actually, defFightersLost in original code was defFightersAfterVolley * pct.
  // I'll keep the ninjaKills and rangerKills as a separate "bonus" to the losses for clarity.
  const defFightersLost = defFigLost + ninjaKills + rangerKills;
  const defRangersLost = defRanLost;
  const defMagesLost = defMagLost;
  const defClericsLost = defCleLost;
  const defNinjasLost = defNinLost;
  const defThievesLost = defThiLost;
  const defEngineersLost = defEngLost;

  const atkFightersLost = atkFigLost;
  const atkRangersLost = atkRanLost;
  const atkMagesLost = atkMagLost;
  const atkClericsLost = atkCleLost;
  const atkNinjasLost = atkNinLost;
  const atkThievesLost = atkThiLost;
  const atkEngineersLost = atkEngLost;

  // Land transfer
  // Actually, requested straight "-10% land loss on defeat" means multiplier, or flat %?
  // 10% land loss * (1 - 0.05) for fortified? Let's do:
  let defLandLossMult = 1.0;
  if (defUpgrades.fortified) defLandLossMult -= 0.05;
  if (defUpgrades.keep) defLandLossMult -= 0.1;
  if (defUpgrades.citadel) defLandLossMult -= 0.15;

  // Also Reinforced Walls do -10%
  const wallUpgrades = safeJsonParse(
    defender.wall_upgrades,
    {},
    "resolveMilitaryAttack:wall_upgrades",
  );
  if (wallUpgrades.reinforced) defLandLossMult -= 0.1;

  const landTransferred = win
    ? Math.floor(defender.land * 0.1 * Math.max(0.1, defLandLossMult))
    : 0;

  // Warmachine damage — walls take damage on win, no walls = building damage
  const warmachineUpdates = applyWarmachineDamage(attacker, defender, win);
  Object.assign(defenderUpdates, warmachineUpdates);
  if (win) {
    if (warmachineUpdates.bld_walls !== undefined) {
      const wallsLost = (defender.bld_walls || 0) - warmachineUpdates.bld_walls;
      if (wallsLost > 0) {
        steps.push({
          phase: "Siege",
          title: "Wall Breach",
          msg: `Your war machines battered the fortifications, destroying ${wallsLost} walls!`,
          icon: "🧱",
        });
      }
    } else {
      const dmgCol = Object.keys(warmachineUpdates).find(
        (k) =>
          k.startsWith("bld_") && warmachineUpdates[k] < (defender[k] || 0),
      );
      if (dmgCol) {
        const buildingName = dmgCol.replace("bld_", "").replace(/_/g, " ");
        const amt = (defender[dmgCol] || 0) - warmachineUpdates[dmgCol];
        steps.push({
          phase: "Siege",
          title: "Building Damage",
          msg: `With the walls down, your troops razed ${amt} ${buildingName}!`,
          icon: "🔥",
        });
      }
    }
  }

  const atkTotalKills =
    ninjaKills + rangerKills + defFightersLost + defClericsLost;
  const defTotalKills =
    atkFightersLost +
    atkRangersLost +
    atkMagesLost +
    atkNinjasLost +
    atkClericsLost;

  const atkClericKills = defClericsLost;
  const defClericKills = atkClericsLost;

  const atkSoldierKills = atkTotalKills - atkClericKills;
  const defSoldierKills = defTotalKills - defClericKills;

  // Reanimation / conversion of casualties
  let atkConversionAdded = 0;
  let defConversionAdded = 0;
  let necroMsg = "";
  if (win) {
    const convRate = attacker.race === "vampire" ? 0.3 : 0.05;
    const isVampire = attacker.race === "vampire";

    if (isVampire) {
      // Fallen soldiers -> Vampire troops (fighters)
      atkConversionAdded = Math.floor(atkSoldierKills * convRate);
      if (atkConversionAdded > 0) {
        attackerUpdates.fighters =
          (attacker.fighters || 0) + atkConversionAdded;
      }

      // Fallen clerics (enemy and own) -> Thralls
      const thrallsFromClerics = Math.floor(
        (atkClericKills + atkClericsLost) * convRate,
      );
      if (thrallsFromClerics > 0) {
        const current = attacker.thralls || 0;
        let mauUpg = {};
        try {
          mauUpg = safeJsonParse(attacker.mausoleum_upgrades, {}, "auto:mausoleum_upgrades");
        } catch {}
        const perMau = 100 + (mauUpg.soul_vault ? 50 : 0);
        const cap = (attacker.bld_mausoleums || 0) * perMau;

        const added = Math.min(thrallsFromClerics, Math.max(0, cap - current));
        if (added > 0) {
          attackerUpdates.thralls = current + added;
        }
      }

      if (
        atkConversionAdded > 0 ||
        Math.floor((atkClericKills + atkClericsLost) * convRate) > 0
      ) {
        necroMsg = `🧛 Blood Magic raised ${atkConversionAdded} soldiers as new troops and some Thralls from the fallen.`;
      }
    } else {
      atkConversionAdded = Math.floor(atkTotalKills * convRate);
      if (atkConversionAdded > 0) {
        attackerUpdates.fighters =
          (attackerUpdates.fighters || attacker.fighters || 0) +
          atkConversionAdded;
        necroMsg = `🏳️ ${atkConversionAdded} enemy troops surrendered and joined your ranks.`;
      }
    }
  } else {
    const convRate = defender.race === "vampire" ? 0.3 : 0.05;
    const isVampire = defender.race === "vampire";

    if (isVampire) {
      // Fallen soldiers -> Vampire troops (fighters)
      defConversionAdded = Math.floor(defSoldierKills * convRate);
      if (defConversionAdded > 0) {
        defenderUpdates.fighters =
          (defender.fighters || 0) + defConversionAdded;
      }

      // Fallen clerics (enemy and own) -> Thralls
      const thrallsFromClerics = Math.floor(
        (defClericKills + defClericsLost) * convRate,
      );
      if (thrallsFromClerics > 0) {
        const current = defender.thralls || 0;
        let mauUpg = {};
        try {
          mauUpg = safeJsonParse(defender.mausoleum_upgrades, {}, "auto:mausoleum_upgrades");
        } catch {}
        const perMau = 100 + (mauUpg.soul_vault ? 50 : 0);
        const cap = (defender.bld_mausoleums || 0) * perMau;

        const added = Math.min(thrallsFromClerics, Math.max(0, cap - current));
        if (added > 0) {
          defenderUpdates.thralls = current + added;
        }
      }

      if (
        defConversionAdded > 0 ||
        Math.floor((defClericKills + defClericsLost) * convRate) > 0
      ) {
        necroMsg = `🧛 Blood Magic raised ${defConversionAdded} soldiers as new troops and some Thralls from the fallen.`;
      }
    } else {
      defConversionAdded = Math.floor(defTotalKills * convRate);
      if (defConversionAdded > 0) {
        defenderUpdates.fighters =
          (defenderUpdates.fighters || defender.fighters || 0) +
          defConversionAdded;
        necroMsg = `🏳️ ${defConversionAdded} enemy troops surrendered and joined your ranks.`;
      }
    }
  }

  // ── Step 8: Happiness changes & Discovery ───────────────────────────────────
  const victoryMargin = Math.min(2.0, Math.max(0.1, powerRatio));
  let atkHappinessChange, defHappinessChange;
  if (win) {
    atkHappinessChange = Math.floor(5 + Math.min(10, victoryMargin * 5));
    defHappinessChange = -Math.max(
      5,
      Math.floor(Math.min(20, victoryMargin * 10)),
    );
    // Bully shame — attacker loses happiness too at high ratios
    if (bullyRatio >= 8) atkHappinessChange -= 15;
    if (bullyRatio >= 4) atkHappinessChange -= 5;
  } else {
    atkHappinessChange = -Math.floor(
      5 + Math.min(15, (1 / Math.max(0.1, powerRatio)) * 8),
    );
    defHappinessChange = Math.floor(
      5 + Math.min(10, (1 / Math.max(0.1, powerRatio)) * 5),
    );
  }
  const HAPPINESS_FLOOR = 0;
  const newAtkHappiness = Math.max(
    HAPPINESS_FLOOR,
    Math.min(
      200,
      (attacker.happiness !== undefined && attacker.happiness !== null
        ? attacker.happiness
        : 100) + atkHappinessChange,
    ),
  );
  const newDefHappiness = Math.max(
    HAPPINESS_FLOOR,
    Math.min(
      200,
      (defender.happiness !== undefined && defender.happiness !== null
        ? defender.happiness
        : 100) + defHappinessChange,
    ),
  );

  // The attacker is always discovered by the defender (map drop)
  const defDisc = safeJsonParse(
    defender.discovered_kingdoms,
    {},
    "resolveMilitaryAttack:defender_discovered_kingdoms",
  );
  defDisc[attacker.id] = { found: true, mapped: true }; // Attackers leave maps
  defenderUpdates.discovered_kingdoms = JSON.stringify(defDisc);

  const atkLines = [];
  const defLines = [];

  // Chance to find a location map on a corpse from the loser's kingdom
  const baseChance = 0.08;
  const winner = win ? attacker : defender;
  const loser = win ? defender : attacker;
  const winnerUpdates = win ? attackerUpdates : defenderUpdates;
  const loserUpdates = win ? defenderUpdates : attackerUpdates;

  // Check if loser has Dwarven Star-Metal or Dragon Scale protecting maps
  const loserFragment = fragmentBonusManager.getFragmentForBuilding(loser, 'libraries');
  const canStealMaps = !loserFragment || (loserFragment.fragment !== 'Dwarven Star-Metal' && loserFragment.fragment !== 'Dragon Scale');

  const lootRaceBonus =
    winner.race === "orc" || winner.race === "dire_wolf" ? 1.5 : 1.0;
  if (canStealMaps && Math.random() < baseChance * lootRaceBonus) {
    const winnerDisc = safeJsonParse(
      winnerUpdates.discovered_kingdoms || winner.discovered_kingdoms,
      {},
      "resolveMilitaryAttack:winner_disc",
    );
    const loserDisc = safeJsonParse(
      loserUpdates.discovered_kingdoms || loser.discovered_kingdoms,
      {},
      "resolveMilitaryAttack:loser_disc",
    );

    // Find maps the loser has that the winner does NOT have
    const mappedIds = Object.keys(loserDisc).filter(
      (id) =>
        loserDisc[id]?.mapped && !winnerDisc[id]?.mapped && id != winner.id,
    );

    if (mappedIds.length > 0) {
      const stolenId = mappedIds[Math.floor(Math.random() * mappedIds.length)];
      // Add to winner
      winnerDisc[stolenId] = { found: true, mapped: true };
      winnerUpdates.discovered_kingdoms = JSON.stringify(winnerDisc);
      // Remove from loser
      delete loserDisc[stolenId];
      loserUpdates.discovered_kingdoms = JSON.stringify(loserDisc);

      if (win) {
        atkLines.push(
          `🗺️ You looted a location map of a mysterious kingdom from a fallen soldier's corpse.`,
        );
      } else {
        defLines.push(
          `🗺️ Your guards recovered a location map from a fallen enemy soldier.`,
        );
      }
    }
  }

  // Increment defender maps if they don't have one to the attacker or just as a bonus?
  // User says: "Anytime you are attacked, the attacker leaves behind a map with their location on it."
  // This implies the 'maps' resource should increment.
  defenderUpdates.maps = (defender.maps || 0) + 1;

  // ── Build updates ─────────────────────────────────────────────────────────
  Object.assign(attackerUpdates, {
    fighters: Math.max(0, attacker.fighters - atkFightersLost),
    rangers: Math.max(0, attacker.rangers - atkRangersLost),
    mages: Math.max(0, attacker.mages - atkMagesLost),
    ninjas: Math.max(0, attacker.ninjas - atkNinjasLost),
    thieves: Math.max(0, attacker.thieves - atkThievesLost),
    clerics: Math.max(0, (attacker.clerics || 0) - atkClericsLost),
    engineers: Math.max(0, (attacker.engineers || 0) - atkEngineersLost),
    war_machines: Math.max(0, (attacker.war_machines || 0) - atkWmLost),
    land: attacker.land + landTransferred,
    happiness: newAtkHappiness,
    weapons_stockpile: Math.max(
      0,
      (attacker.weapons_stockpile || 0) -
        Math.floor(weaponsEquipped * atkFighterLossPct),
    ),
  });
  Object.assign(defenderUpdates, {
    fighters: Math.max(0, defender.fighters - defFightersLost),
    rangers: Math.max(0, defender.rangers - defRangersLost),
    mages: Math.max(0, defender.mages - defMagesLost),
    ninjas: Math.max(0, defender.ninjas - defNinjasLost),
    thieves: Math.max(0, defender.thieves - defThievesLost),
    clerics: Math.max(0, (defender.clerics || 0) - defClericsLost),
    engineers: Math.max(0, (defender.engineers || 0) - defEngineersLost),
    war_machines: Math.max(0, (defender.war_machines || 0) - defWmLost),
    land: Math.max(0, defender.land - landTransferred),
    happiness: newDefHappiness,
  });

  // XP
  const atkTroopXpF = awardTroopXp(attacker, "fighters", win ? 30 : 10);
  const atkTroopXpR = awardTroopXp(
    { ...attacker, troop_levels: atkTroopXpF.troop_levels },
    "rangers",
    win ? 20 : 8,
  );
  const defTroopXp = awardTroopXp(defender, "fighters", win ? 10 : 20);
  attackerUpdates.troop_levels = atkTroopXpR.troop_levels;
  defenderUpdates.troop_levels = defTroopXp.troop_levels;

  const atkXp = awardXp(attacker, win ? "combat_win" : "combat_loss", 1);
  const defXp = awardXp(defender, win ? "combat_loss" : "combat_win", 1);
  attackerUpdates.xp = atkXp.xp;
  attackerUpdates.level = atkXp.level;
  defenderUpdates.xp = defXp.xp;
  defenderUpdates.level = defXp.level;

  // ── Battle report ─────────────────────────────────────────────────────────
  const report = {
    win,
    landTransferred,
    powerRatio: Math.round(powerRatio * 100) / 100,
    atkPower: Math.round(atkPower),
    defPower: Math.round(defPower),
    sent,
    atkFightersLost,
    atkRangersLost,
    atkMagesLost,
    atkNinjasLost,
    atkClericsLost,
    atkThievesLost,
    atkEngineersLost,
    atkWmLost,
    defFightersLost,
    defRangersLost,
    defMagesLost,
    defNinjasLost,
    defClericsLost,
    defThievesLost,
    defEngineersLost,
    defWmLost,
    ninjaKills,
    rangerKills,
    flankKills,
    thiefSabotage,
    atkHappinessChange,
    defHappinessChange,
    bullyMsg,
    shameEvent,
    steps,
  };

  // Capture building damage details
  if (win && warmachineUpdates.bld_walls !== undefined) {
    const wallsLost = (defender.bld_walls || 0) - warmachineUpdates.bld_walls;
    if (wallsLost > 0) report.wallsDestroyed = wallsLost;
  }
  if (win && !defender.bld_walls) {
    const dmgCols = Object.keys(warmachineUpdates).filter(
      (k) => k.startsWith("bld_") && warmachineUpdates[k] < (defender[k] || 0),
    );
    if (dmgCols.length > 0) {
      report.buildingsDamaged = dmgCols.map((c) => ({
        type: c.replace("bld_", "").replace(/_/g, " "),
        lost: (defender[c] || 0) - warmachineUpdates[c],
      }));
    }
  }

  // ── Event messages ────────────────────────────────────────────────────────
  if (ninjaKills > 0)
    atkLines.push(
      `Ninjas eliminated ${ninjaKills} defenders before the battle.`,
    );
  if (rangerKills > 0)
    atkLines.push(`Rangers volley killed ${rangerKills} defenders.`);
  if (thiefSabotage > 0)
    atkLines.push(`Thieves disabled ${thiefSabotage} enemy war machines.`);
  if (daylightPenaltyMsg) atkLines.push(daylightPenaltyMsg);
  if (necroMsg) atkLines.push(necroMsg);
  if (bullyMsg) atkLines.push(bullyMsg);

  // Add summary step to replay
  const atkSummaryParts = [];
  if (atkFightersLost > 0)
    atkSummaryParts.push(`${fmt(atkFightersLost)} fighters`);
  if (atkRangersLost > 0)
    atkSummaryParts.push(`${fmt(atkRangersLost)} rangers`);
  if (atkMagesLost > 0) atkSummaryParts.push(`${fmt(atkMagesLost)} mages`);
  if (atkClericsLost > 0)
    atkSummaryParts.push(`${fmt(atkClericsLost)} clerics`);
  if (atkNinjasLost > 0) atkSummaryParts.push(`${fmt(atkNinjasLost)} ninjas`);
  if (atkThievesLost > 0)
    atkSummaryParts.push(`${fmt(atkThievesLost)} thieves`);
  if (atkEngineersLost > 0)
    atkSummaryParts.push(`${fmt(atkEngineersLost)} engineers`);
  if (atkWmLost > 0) atkSummaryParts.push(`${fmt(atkWmLost)} war machines`);

  const defSummaryParts = [];
  if (defFightersLost > 0)
    defSummaryParts.push(`${fmt(defFightersLost)} fighters`);
  if (defRangersLost > 0)
    defSummaryParts.push(`${fmt(defRangersLost)} rangers`);
  if (defMagesLost > 0) defSummaryParts.push(`${fmt(defMagesLost)} mages`);
  if (defClericsLost > 0)
    defSummaryParts.push(`${fmt(defClericsLost)} clerics`);
  if (defNinjasLost > 0) defSummaryParts.push(`${fmt(defNinjasLost)} ninjas`);
  if (defThievesLost > 0)
    defSummaryParts.push(`${fmt(defThievesLost)} thieves`);
  if (defEngineersLost > 0)
    defSummaryParts.push(`${fmt(defEngineersLost)} engineers`);
  if (defWmLost > 0) defSummaryParts.push(`${fmt(defWmLost)} war machines`);

  let summaryMsg =
    `Battle Concluded. ${win ? "Attacker" : "Defender"} victory.\n\n` +
    `Attacker Losses: ${atkSummaryParts.join(", ") || "None"}\n` +
    `Defender Losses: ${defSummaryParts.join(", ") || "None"}`;

  if (landTransferred > 0)
    summaryMsg += `\nLand Seized: ${fmt(landTransferred)} acres.`;
  if (report.buildingsDamaged) {
    summaryMsg += `\nBuildings Destroyed: ${report.buildingsDamaged.map((b) => `${fmt(b.lost)} ${b.type}`).join(", ")}`;
  } else if (report.wallsDestroyed) {
    summaryMsg += `\nWalls Destroyed: ${fmt(report.wallsDestroyed)}`;
  }

  steps.push({
    phase: "Summary",
    title: "Casualty Report",
    msg: summaryMsg,
    icon: "📜",
  });

  const atkLossesTitle =
    atkSummaryParts.slice(0, 2).join(", ") +
    (atkSummaryParts.length > 2 ? "..." : "");
  const defLossesTitle =
    defSummaryParts.slice(0, 2).join(", ") +
    (defSummaryParts.length > 2 ? "..." : "");

  const atkEvent = win
    ? `⚔️ You attacked ${defender.name} and won! Captured ${fmt(landTransferred)} acres. Losses: ${atkLossesTitle || "None"}.`
    : `⚔️ Attack on ${defender.name} was repelled. Losses: ${atkLossesTitle || "None"}.`;

  const defEvent = win
    ? `⚔️ ${attacker.name} attacked and broke through! You lost ${fmt(landTransferred)} acres. Losses: ${defLossesTitle || "None"}.`
    : `⚔️ ${attacker.name} attacked but was repelled. Losses: ${defLossesTitle || "None"}.`;

  const finalAtkEvent = [atkEvent, ...atkLines].filter(Boolean).join(" ");
  const finalDefEvent = [defEvent, ...defLines].filter(Boolean).join(" ");

  return {
    win,
    report,
    attackerUpdates,
    defenderUpdates,
    atkEvent: finalAtkEvent,
    defEvent: finalDefEvent,
    shameEvent,
  };
}

// ── Orc Trade Route Raiding ──────────────────────────────────────────────
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

// ── Prestige System ──────────────────────────────────────────────────────
function canPrestige(k) {
  return k.level >= 50; // Prestige at Level 50
}

function processPrestige(k) {
  if (!canPrestige(k))
    return { error: "Kingdom level 50 required for Prestige" };

  const currentLevel = k.prestige_level || 0;
  const nextLevel = currentLevel + 1;

  // New Kingdom defaults
  return {
    updates: {
      prestige_level: nextLevel,
      level: 1,
      xp: 0,
      gold: 50000 * nextLevel, // Bonus starting gold
      land: k.land, // Keeping land as requested
      population: 5000,
      food: 25000,
      mana: 1000,
      fighters: 0,
      rangers: 0,
      clerics: 0,
      mages: 0,
      thieves: 0,
      war_machines: 0,
      bld_farms: 5,
      bld_barracks: 2,
      bld_schools: 1,
      bld_housing: 100,
      build_queue: "{}",
      build_progress: "{}",
      research_progress: "{}",
      training_allocation: "{}",
      smithy_allocation: "{}",
      mage_tower_allocation: "{}",
      shrine_allocation: "{}",
      turn: k.turn,
    }
  };
}


// ── Alliance pledge defense ───────────────────────────────────────────────────

function resolveAllianceDefense(attackResult, allies) {
  // When a kingdom is attacked, allied kingdoms send pledge % of their fighters
  if (!attackResult.win) return [];
  return allies.map((ally) => {
    const sent = Math.floor(ally.fighters * (ally.pledge / 100));
    return { allyId: ally.id, sent };
  });
}

// ── Expedition rewards ──────────────────────────────────────────────────────

function junkPrize(k, updates) {
  if (!JUNK_PRIZES || JUNK_PRIZES.length === 0)
    return "a particularly shiny pebble";
  const eventsCollected = safeJsonParse(
    updates.collected_events || k.collected_events,
    [],
    "junkPrize",
  );
  const lastId = updates.last_event_id || k.last_event_id;

  let available = JUNK_PRIZES.filter((p) => p.id !== lastId);
  if (available.length === 0) available = JUNK_PRIZES;
  const ev = available[Math.floor(Math.random() * available.length)];

  if (ev) {
    if (!eventsCollected.includes(ev.id)) {
      eventsCollected.push(ev.id);
      updates.collected_events = JSON.stringify(eventsCollected);

      if (eventsCollected.length >= 50) {
        updates._collector_unlocked = true;
      }
    }
    updates.last_event_id = ev.id;

    // Add item to inventory
    let inventory = safeJsonParse(updates.items || k.items, [], "junkPrize:items");
    if (!Array.isArray(inventory)) inventory = [];

    const existingItem = inventory.find((i) => i.id === ev.id);
    if (existingItem) {
      existingItem.qty = (existingItem.qty || 0) + 1;
    } else {
      // Get item name from INVENTORY_ITEMS if available
      const itemDef = INVENTORY_ITEMS?.[ev.id];
      inventory.push({ id: ev.id, name: itemDef?.name || ev.id, qty: 1 });
    }
    updates.items = JSON.stringify(inventory);

    // Check for 100 suspicious rocks achievement (only trigger once)
    if (ev.id === "suspicious_rock") {
      const rockCount = (existingItem?.qty || 0) + 1;
      if (rockCount >= 100) {
        let achievements = safeJsonParse(updates.achievements || k.achievements, [], "junkPrize:achievements");
        if (!achievements.includes("suspicious_rocks_100")) {
          achievements.push("suspicious_rocks_100");
          updates.achievements = JSON.stringify(achievements);
          updates.stone = (updates.stone ?? k.stone ?? 0) + 1000;
          updates._suspicious_rocks_achievement = true;
        }
      }
    }

    return ev.msg || ev.content || "a mysterious rock";
  }
  return "a strange pebble";
}

function expeditionRewards(type, rangers, fighters, k) {
  const tacBonus = 1 + k.res_military / 2000;

  // Race exploration bonus — affects all reward quantities
  const exploreBonus =
    {
      dire_wolf: 1.4,
      dark_elf: 1.25,
      human: 1.1,
      orc: 1.05,
      dwarf: 0.9,
      high_elf: 0.95,
    }[k.race] || 1.0;

  // Ranger level bonus — higher level rangers are better scouts
  const rangerLvBonus = unitLevelMult(k, "rangers");

  // Attrition reduced for skilled explorer races
  const attritionMult = { dire_wolf: 0.5, dark_elf: 0.6 }[k.race] || 1.0;
  const rewards = [];
  const events = [];
  const updates = {};

  // Attrition — skilled explorer races lose fewer rangers
  const attritionPct = type === "dungeon" ? rand(0, 3) : rand(0, 2);
  const lost = Math.floor(((rangers * attritionPct) / 100) * attritionMult);
  const returned = rangers - lost;
  if (lost > 0)
    rewards.push({
      text: `${lost} ranger${lost > 1 ? "s" : ""} did not return from the expedition`,
    });
  // Rangers returned stored separately so resolveExpeditions can use SQL increment
  updates._rangers_returned = returned;

  const expTurns = EXPEDITION_TURNS[type] || 10;

  // Gold base = forage rate (rangers × 12 × tacBonus) × turns × race bonus × random 5–30% bonus
  const foragePerTurn = rangers * 2 * tacBonus * exploreBonus * rangerLvBonus;
  const randomBonus = 1 + rand(5, 30) / 100;
  const goldBase = Math.floor(foragePerTurn * expTurns * randomBonus);

  if (type === "scout") {
    rewards.push({ text: `+${goldBase.toLocaleString()} gold from foraging` });
    updates.gold = k.gold + goldBase;

    // Resource Yield: Wood
    const rollWood = Math.random() * 100;
    let woodGained = 0;
    if (rollWood < 0.5) {
      woodGained = 25;
    } else if (rollWood < 5.5) {
      woodGained = 5;
    } else if (rollWood < 30.5) {
      woodGained = 2;
    } else if (rollWood < 80.5) {
      woodGained = 1;
    }

    if (woodGained > 0) {
      updates.wood = (updates.wood !== undefined ? updates.wood : k.wood || 0) + woodGained;
      rewards.push({ text: `🪵 +${woodGained} wood discovered` });
    }

    const land = Math.max(
      1,
      Math.floor(rand(rangers * 0.01, rangers * 0.03) * exploreBonus),
    );
    rewards.push({
      text: `+${land} acre${land > 1 ? "s" : ""} of unclaimed land`,
    });
    updates.land = k.land + land;

    if (roll(0.3)) {
      const mana = rand(
        Math.floor(rangers * 0.2 * exploreBonus),
        Math.floor(rangers * 0.8 * exploreBonus),
      );
      rewards.push({ text: `+${mana} mana from a hidden shrine` });
      updates.mana = k.mana + mana;
    }
    if (roll(0.1)) {
      const troops = rand(
        2,
        Math.max(3, Math.floor(rangers * 0.02 * exploreBonus)),
      );
      if (k.race === "vampire") {
        rewards.push({
          text: `Your troops captured ${troops} wandering souls and bound them as Thralls`,
        });
        updates.clerics = k.clerics + troops;
      } else {
        rewards.push({
          text: `${troops} wandering fighter${troops > 1 ? "s" : ""} pledge allegiance to your kingdom`,
        });
        updates.fighters = k.fighters + troops;
      }
    }
    if (roll(0.03)) {
      const bonus = rand(
        Math.floor(rangers * 0.03 * exploreBonus),
        Math.floor(rangers * 0.08 * exploreBonus),
      );
      rewards.push({
        text: `An ancient map reveals ${bonus} additional acres — scouts claim them!`,
      });
      updates.land = (updates.land || k.land) + bonus;
    }
    if (roll(0.45))
      rewards.push({
        text: `Your rangers also found ${junkPrize(k, updates)}`,
      });

    // Map drop — 5% chance on scout
    if (roll(0.05)) {
      updates.maps = k.maps + 1;
      rewards.push({
        text: `🗺️ A map was found — you can now interact with other kingdoms`,
      });
    }

    // DISCOVERY: Chance to find another kingdom
    if (roll(calcDiscoveryChance(k))) {
      updates._find_kingdom = true;
    }
  } else if (type === "deep") {
    rewards.push({
      text: `+${goldBase.toLocaleString()} gold from deep wilderness caches`,
    });
    updates.gold = k.gold + goldBase;

    // Resource Yield: Wood and Stone
    const rollDeep = Math.random() * 100;
    let deepWood = 0;
    let deepStone = 0;
    if (rollDeep < 0.5) {
      deepWood = 25;
      deepStone = 25;
    } else if (rollDeep < 5.5) {
      deepWood = 5;
      deepStone = 5;
    } else if (rollDeep < 30.5) {
      deepWood = 2;
      deepStone = 2;
    } else if (rollDeep < 80.5) {
      deepWood = 1;
      deepStone = 1;
    }

    if (deepWood > 0) {
      updates.wood = (updates.wood !== undefined ? updates.wood : k.wood || 0) + deepWood;
      updates.stone = (updates.stone !== undefined ? updates.stone : k.stone || 0) + deepStone;
      rewards.push({ text: `+${deepWood} wood and ?? +${deepStone} stone unearthed` });
    }

    const land = Math.max(
      2,
      Math.floor(rand(rangers * 0.04, rangers * 0.1) * exploreBonus),
    );
    rewards.push({ text: `+${land} acres of fertile territory` });
    updates.land = k.land + land;

    if (roll(0.55)) {
      const mana = rand(
        Math.floor(rangers * 0.5 * exploreBonus),
        Math.floor(rangers * 2 * exploreBonus),
      );
      rewards.push({
        text: `+${mana} mana from ley lines discovered deep in the wilderness`,
      });
      updates.mana = k.mana + mana;
    }
    if (roll(0.25)) {
      const disc = [
        "res_economy",
        "res_weapons",
        "res_armor",
        "res_military",
        "res_entertainment",
      ][rand(0, 4)];
      const boost = rand(1, Math.max(2, Math.floor(5 * exploreBonus)));
      const discLabel = disc.replace("res_", "").replace("_", " ");
      rewards.push({
        text: `A research scroll found ? ${discLabel} +${boost}%`,
      });
      updates[disc] = (k[disc] || 0) + boost;
    }
    if (roll(0.2)) {
      const troops = rand(
        Math.floor(rangers * 0.03 * exploreBonus),
        Math.floor(rangers * 0.08 * exploreBonus),
      );
      const ttype = roll(0.5) ? "fighters" : "rangers";
      if (troops > 0) {
        if (k.race === "vampire") {
          rewards.push({
            text: `${troops} mercenaries were subdued and turned into Thralls`,
          });
          updates.clerics = k.clerics + troops;
        } else {
          rewards.push({
            text: `${troops} mercenary ${ttype} join your cause`,
          });
          updates[ttype] = (k[ttype] || 0) + troops;
        }
      }
    }
    if (roll(0.08)) {
      const bonus = rand(
        Math.floor(rangers * 0.05 * exploreBonus),
        Math.floor(rangers * 0.15 * exploreBonus),
      );
      rewards.push({
        text: `Ruins of an abandoned kingdom found ? you claim ${bonus} acres of its former territory`,
      });
      updates.land = (updates.land || k.land) + bonus;
    }
    if (roll(0.02)) {
      const disc = [
        "res_spellbook",
        "res_attack_magic",
        "res_defense_magic",
        "res_war_machines",
        "res_construction",
      ][rand(0, 4)];
      const boost = rand(
        Math.floor(5 * exploreBonus),
        Math.floor(15 * exploreBonus),
      );
      const discLabel = disc.replace("res_", "").replace("_", " ");
      rewards.push({
        text: `⚡ An ancient artifact of ${discLabel} — permanent +${boost}%`,
      });
      updates[disc] = (k[disc] || 0) + boost;
    }

    if (roll(calcDiscoveryChance(k))) {
      updates._find_kingdom = true;
    }
    if (roll(0.6))
      rewards.push({
        text: `Hidden deep in the wilderness, your rangers also discovered ${junkPrize(k, updates)}`,
      });

    // Map drop — 15% chance on deep
    if (roll(0.15)) {
      updates.maps = (updates.maps || k.maps) + 1;
      rewards.push({ text: `🗺️ A map was discovered in the deep wilderness` });
    }

    if (roll(0.05)) {
      updates._find_world_fragment = true;
    }
  } else if (type === "dungeon") {
    const power = (rangers + fighters * 2) * tacBonus * exploreBonus;
    const successChance = Math.min(0.9, 0.25 + power / 24000);
    const success = roll(successChance);

    if (!success) {
      const fLost = Math.min(
        fighters,
        rand(Math.floor(fighters * 0.05), Math.floor(fighters * 0.15)),
      );
      const fReturned = fighters - fLost;
      if (fReturned > 0) updates._fighters_returned = fReturned;
      rewards.push({
        text: `The dungeon proved too dangerous — ${fLost} fighters lost in retreat`,
      });
      events.push({
        type: "attack",
        message: `💀 Dungeon raid FAILED — your forces were overwhelmed. ${fLost.toLocaleString()} fighters lost.`,
      });
    } else {
      updates._fighters_returned = fighters;

      const dungeonMult =
        { orc: 2.0, dire_wolf: 1.5, high_elf: 0.5 }[k.race] || 1.0;

      const dungeonGold = Math.floor(
        fighters *
          rand(8, 12) *
          tacBonus *
          exploreBonus *
          randomBonus *
          dungeonMult,
      );
      rewards.push({
        text: `+${dungeonGold.toLocaleString()} gold plundered from the dungeon`,
      });
      updates.gold = k.gold + dungeonGold;

      // Resource Yield: Iron only (on success)
      const rollDungeon = Math.random() * 100;
      let ironGained = 0;
      if (rollDungeon < 0.5) {
        ironGained = 150;
      } else if (rollDungeon < 5.5) {
        ironGained = 50;
      } else if (rollDungeon < 30.5) {
        ironGained = 10;
      } else if (rollDungeon < 80.5) {
        ironGained = 2;
      }

      if (ironGained > 0) {
        updates.iron = (updates.iron !== undefined ? updates.iron : k.iron || 0) + ironGained;
        rewards.push({ text: `🔗 +${ironGained} iron plundered` });
      }

      const mana = Math.floor(
        rand(
          Math.floor(rangers * 1 * exploreBonus),
          Math.floor(rangers * 4 * exploreBonus),
        ) * dungeonMult,
      );
      rewards.push({ text: `+${mana} mana from dungeon ley stones` });
      updates.mana = k.mana + mana;

      const disc = [
        "res_weapons",
        "res_armor",
        "res_military",
        "res_attack_magic",
        "res_spellbook",
      ][rand(0, 4)];
      const boost = Math.floor(
        rand(3, Math.floor(12 * exploreBonus)) * dungeonMult,
      );
      const discLabel = disc.replace("res_", "").replace("_", " ");
      rewards.push({
        text: `Dungeon tome found — ${discLabel} permanently +${boost}%`,
      });
      updates[disc] = (k[disc] || 0) + boost;

      if (roll(0.12)) {
        const wm = Math.max(
          1,
          Math.floor(
            rand(1, Math.max(2, Math.floor((fighters / 500) * exploreBonus))) *
              dungeonMult,
          ),
        );
        rewards.push({
          text: `⚡ Ancient war machine${wm > 1 ? "s" : ""} recovered from the dungeon depths — +${wm}`,
        });
        updates.war_machines = k.war_machines + wm;
      }
      if (roll(0.06)) {
        const boost2 = Math.floor(
          rand(10, Math.floor(40 * exploreBonus)) * dungeonMult,
        );
        rewards.push({
          text: `⚡ The dungeon's heart pulsed with ancient magic — spellbook permanently +${boost2}`,
        });
        updates.res_spellbook =
          (updates.res_spellbook || k.res_spellbook) + boost2;
      }
      if (roll(0.5))
        rewards.push({
          text: `Amid the carnage, someone pocketed ${junkPrize(k, updates)}`,
        });

      // Map drop — 25% chance on dungeon
      if (roll(0.25)) {
        updates.maps = (updates.maps || k.maps) + 1;
        rewards.push({ text: `🗺️ A map was found among the dungeon spoils` });
      }
      // Blueprint drop — 20% chance on dungeon
      if (roll(0.2)) {
        const smithyCap = k.bld_smithies * 25;
        const curBP =
          updates.blueprints_stored !== undefined
            ? updates.blueprints_stored
            : k.blueprints_stored;
        if (smithyCap === 0 || curBP < smithyCap) {
          updates.blueprints_stored = curBP + 1;
          rewards.push({
            text: `⚙️ A blueprint was recovered from the dungeon depths`,
          });
        }
      }

      if (roll(0.1)) {
        updates._find_world_fragment = true;
      }
    }
  } else if (type === "mountain") {
    // Mountain Expedition: Rangers only, balanced high-risk/high-reward attrition
    const mountainMult = { dire_wolf: 0.8, human: 1.0, dwarf: 1.1 }[k.race] || 1.0;
    const rangerLevel = effectiveTroopLevel(k, "rangers");

    // Avalanche attrition per turn: random between 0 and level-based max (targeting ~75% total attrition)
    const expTurns = EXPEDITION_TURNS["mountain"] || 100;
    let totalArriving = rangers;
    const attritionLog = [];

    for (let turn = 1; turn <= expTurns; turn++) {
      // Determine max loss % based on ranger level (BALANCED: 0-8/6/5/4% per turn)
      let maxLoss = 8;
      if (rangerLevel >= 21 && rangerLevel <= 30) maxLoss = 6;
      else if (rangerLevel >= 31 && rangerLevel <= 40) maxLoss = 5;
      else if (rangerLevel >= 41) maxLoss = 4;

      // Roll between 0 and maxLoss (always allows zero-loss outcome)
      const lossPercent = rand(0, maxLoss);
      const lostThisTurn = Math.ceil((totalArriving * lossPercent) / 100);
      totalArriving -= lostThisTurn;

      if (lostThisTurn > 0) {
        attritionLog.push(lostThisTurn);
      }
    }

    const survived = totalArriving;
    const totalLost = rangers - survived;
    const casualtyRate = (totalLost / rangers * 100).toFixed(1);

    if (totalLost > 0) {
      rewards.push({
        text: `Avalanches claimed ${totalLost.toLocaleString()} rangers (${casualtyRate}%) — ${survived.toLocaleString()} returned`,
      });
    } else {
      rewards.push({
        text: `Against the odds, all ${rangers.toLocaleString()} rangers navigated the mountain unscathed`,
      });
    }

    updates._rangers_returned = survived;

    // Apply casualty losses to kingdom ranger count
    updates.rangers = Math.max(0, (k.rangers || 0) - totalLost);

    // Mountain rewards only granted if rangers survived the expedition
    if (survived > 0) {
      // Gold scaled to troop count and level (200-500 per ranger)
      const goldPerRanger = rand(200, 500);
      const mountainGold = Math.floor(
        rangers * goldPerRanger * tacBonus * exploreBonus * mountainMult * (1 + rand(5, 30) / 100)
      );
      rewards.push({
        text: `+${mountainGold.toLocaleString()} gold from mountain artifacts`,
      });
      updates.gold = k.gold + mountainGold;

      // Mana from ley lines (scaled)
      const mountainMana = Math.floor(
        rand(rangers * 10, rangers * 50) * mountainMult * exploreBonus
      );
      rewards.push({
        text: `+${mountainMana} mana from ancient ley lines`,
      });
      updates.mana = k.mana + mountainMana;

      // Research boost from ancient knowledge (scaled)
      const res = ["res_weapons", "res_armor", "res_construction"][rand(0, 2)];
      const resBoost = Math.floor(rand(50, 150) * mountainMult);
      rewards.push({
        text: `Ancient runes revealed — ${res.replace("res_", "").replace("_", " ")} +${resBoost}`,
      });
      updates[res] = (k[res] || 0) + resBoost;

      // Junk prizes more frequent on mountain (60% chance per turn) — consolidated summary
      let junkCount = 0;
      for (let t = 0; t < expTurns; t++) {
        if (roll(0.6)) {
          junkPrize(k, updates);
          junkCount++;
        }
      }
      if (junkCount > 0) {
        rewards.push({
          text: `Rangers discovered ${junkCount} artifacts in the mountain passes`,
        });
      }
    }

    // No land rewards from mountain — focus purely on artifacts/magic
    // (explicitly 0 land)
  }

  // ── Ultra-rare prizes ──────────────────────────────────────────────────
  // deep: 0.5%, dungeon success: 1%, mountain: 2.5% per turn (MAX 1 per expedition for mountain)
  const ultraChance = type === "dungeon" ? 0.01 : type === "deep" ? 0.005 : type === "mountain" ? 0.025 : 0;

  // For mountain expeditions, track if we already got an ultra-rare during the 100 turns
  if (type === "mountain" && updates._rangers_returned > 0) {
    let ultraRareObtained = false;
    const mountainUltraRares = ULTRA_RARE_PRIZES.filter(p =>
      ["iceflow_crown", "snowpeak_chalice", "frostbind_amulet", "avalanche_heart", "stormcaller_gem"].includes(p.id)
    );
    for (let turn = 1; turn <= (EXPEDITION_TURNS["mountain"] || 100); turn++) {
      if (!ultraRareObtained && roll(ultraChance)) {
        if (mountainUltraRares.length > 0) {
          const prize = mountainUltraRares[Math.floor(Math.random() * mountainUltraRares.length)];
          prize.effect(k, updates);
          rewards.push({ text: `ULTRA RARE: ${prize.text}` });

          // Add ultra-rare item to inventory
          let inventory = safeJsonParse(updates.items || k.items, [], "expeditionRewards:ultra_rare_items");
          if (!Array.isArray(inventory)) inventory = [];
          const itemDef = INVENTORY_ITEMS?.[prize.id];
          addItemToInventory(inventory, prize.id, itemDef?.name || prize.id, 1);
          updates.items = JSON.stringify(inventory);

          ultraRareObtained = true; // Prevent more ultra-rares this expedition
        }
      }
    }
  } else if (ultraChance > 0 && roll(ultraChance)) {
    // Non-mountain expeditions: regular ultra-rare drop (can be multiple)
    const prize =
      ULTRA_RARE_PRIZES[Math.floor(Math.random() * ULTRA_RARE_PRIZES.length)];
    prize.effect(k, updates);
    rewards.push({ text: `ULTRA RARE: ${prize.text}` });

    // Add ultra-rare item to inventory
    let inventory = safeJsonParse(updates.items || k.items, [], "expeditionRewards:ultra_rare_items");
    if (!Array.isArray(inventory)) inventory = [];
    const itemDef = INVENTORY_ITEMS?.[prize.id];
    addItemToInventory(inventory, prize.id, itemDef?.name || prize.id, 1);
    updates.items = JSON.stringify(inventory);
  }

  // ── Throne of Nazdreg (0.1% on deep/dungeon, unique forever) ────────────────
  const throneChance = type === "deep" || type === "dungeon" ? 0.001 : 0;
  if (throneChance > 0 && roll(throneChance)) {
    updates._check_throne = true; // resolveExpeditions will check server_state and apply if unclaimed
  }

  // ── Air Fragment (rare mountain drop, ~1-2% chance, only if rangers survive) ────────────────
  if (type === "mountain" && updates._rangers_returned > 0 && roll(0.015)) {
    // Add air fragment to inventory
    let inventory = safeJsonParse(updates.items || k.items, [], "expeditionRewards:air_fragment");
    if (!Array.isArray(inventory)) inventory = [];
    const itemDef = INVENTORY_ITEMS?.["air_fragment"];
    addItemToInventory(inventory, "air_fragment", itemDef?.name || "Air Fragment", 1);
    updates.items = JSON.stringify(inventory);
    rewards.push({
      text: `🌬️ An Air Fragment pulses with the fury of ancient storms — a collectible of immense power`,
    });
  }

  const preAchLength = events.length;
  checkAchievements(k, updates, events);
  for (let i = preAchLength; i < events.length; i++) {
    rewards.push({ text: events[i].message });
  }

  return {
    rewards: rewards.map((reward) =>
      reward && typeof reward === "object" && typeof reward.text === "string"
        ? { ...reward, text: repairMojibake(reward.text) }
        : reward,
    ),
    updates,
    events: events.map(cleanNewsEvent),
  };
}

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
        const other = await db.get(
          "SELECT id, name FROM kingdoms WHERE id != ? ORDER BY RANDOM() LIMIT 1",
          [freshK.id],
        );
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

      // Throne broadcast only
      if (serverAnnounce) {
        const allKingdoms = await db.all("SELECT id FROM kingdoms");
        if (allKingdoms.length > 0) {
          const placeholders = allKingdoms.map((_, i) => `($${i + 1},'system',$${allKingdoms.length + 1},$${allKingdoms.length + 2})`).join(',');
          const values = [...allKingdoms.map(ak => ak.id), serverAnnounce, k.turn];
          await db.run(
            `INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ${placeholders}`,
            values,
          );
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

function processActiveEffects(k, events) {
  let effects = {};
  try {
    effects = safeJsonParse(k.active_effects, {}, "auto:active_effects");
  } catch {
    effects = {};
  }
  if (Object.keys(effects).length === 0) return {};

  const updates = {};
  const expired = [];

  for (const [effect, data] of Object.entries(effects)) {
    const remaining = (data.turns_left || 1) - 1;
    if (remaining <= 0) {
      expired.push(effect);
      events.push({
        type: "system",
        message: `The ${effect.replace("_", " ")} effect on your kingdom has expired.`,
      });
    } else {
      // Apply ongoing effect
      if (effect === "blight") {
        const upgrades = safeJsonParse(
          k.granary_upgrades,
          {},
          "processTurn:granary_upgrades",
        );
        const damage = (updates._blightDamaged = Math.floor(
          (data.damage || 500) * (upgrades.segregation ? 0.5 : 1.0),
        ));
        updates.food = Math.max(
          0,
          (updates.food !== undefined ? updates.food : k.food) - damage,
        );
      } else if (effect === "plague") {
        let lost = Math.floor(k.population * 0.02);
        // Special housing effects (Celestial Feather: Holy Sanctuaries, Ancient Elven Wood: Treehouse Canopy)
        const activeHousingSpecial = fragmentBonusManager.getSpecialEffect(k, 'housing');
        if (activeHousingSpecial?.name === "Holy Sanctuaries") {
          lost = Math.floor(lost * 0.2); // 80% reduction in plague loss
        } else if (activeHousingSpecial?.name === "Treehouse Canopy") {
          lost = Math.floor(lost * 0.5); // 50% reduction in plague loss
        }
        updates.population = Math.max(0, k.population - lost);
        events.push({
          type: "attack",
          message: `☠️ Plague ravages your kingdom — ${lost.toLocaleString()} citizens have perished.`,
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
        events.push({ type: "system", message: `🌽 Conjured abundance generates ${foodGenerated.toLocaleString()} food.` });
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

function demolishBuilding(k, buildingKey, amount) {
  const col = BUILDING_COL[buildingKey];
  if (!col) return { error: "Unknown building" };
  const current = k[col] || 0;
  const toDemolish = Math.min(amount, current);
  if (toDemolish <= 0) return { error: "Nothing to demolish" };

  const goldRefund = Math.floor(
    (BUILDING_GOLD_COST[buildingKey] || 0) * 0.25 * toDemolish,
  );
  const landRefund = (BUILDING_LAND_COST[buildingKey] || 0) * toDemolish;

  return {
    updates: {
      [col]: current - toDemolish,
      gold: k.gold + goldRefund,
      land: k.land + landRefund,
    },
    refund: { gold: goldRefund, land: landRefund, count: toDemolish },
  };
}

function calculateScore(k) {
  let score = 0;

  // Base stats
  score += k.land * 1;
  score += k.population * 0.5;
  score += (k.level || 1) * 100;

  // Resources
  score += k.gold * 0.001;
  score += k.food * 0.0005;
  score += k.mana * 0.002;
  score += k.hammers_stored * 0.1;
  score += k.scaffolding_stored * 0.1;
  score += k.blueprints_stored * 5;
  score += k.weapons_stockpile * 0.005;
  score += k.armor_stockpile * 0.01;

  // Troop levels (multiplier)
  let troopLevels = {};
  if (k.troop_levels) {
    try {
      troopLevels =
        typeof k.troop_levels === "string"
          ? safeJsonParse(k.troop_levels, {}, "auto:troop_levels")
          : k.troop_levels;
    } catch {}
  }

  function getLvlMultiplier(unitType) {
    const unitInfo = troopLevels[unitType];
    const lvl =
      (unitInfo && typeof unitInfo === "object"
        ? Number(unitInfo.level)
        : Number(unitInfo)) || 1;
    // user said: "start at an addition .15 at level 1 increases incrementally"
    return 1 + lvl * 0.15;
  }

  // Units
  score += k.war_machines * 1.25 * getLvlMultiplier("war_machines");
  score += (k.ballistae || 0) * 1.25 * getLvlMultiplier("war_machines");
  score += k.fighters * 0.75 * getLvlMultiplier("fighters");
  score += k.rangers * 1.75 * getLvlMultiplier("rangers");
  score += k.clerics * 0.75 * getLvlMultiplier("clerics");
  score += k.mages * 1.5 * getLvlMultiplier("mages");
  score += k.thieves * 0.95 * getLvlMultiplier("thieves");
  score += k.ninjas * 1.15 * getLvlMultiplier("ninjas");
  score += k.scribes * 0.25 * getLvlMultiplier("scribes");
  score += k.engineers * 1.25 * getLvlMultiplier("engineers");
  score += k.researchers * 0.5 * getLvlMultiplier("researchers"); // Assumed baseline

  // Buildings (everything else -> balanced scoring)
  const bldAttrs = [
    "bld_farms",
    "bld_barracks",
    "bld_outposts",
    "bld_guard_towers",
    "bld_schools",
    "bld_armories",
    "bld_vaults",
    "bld_smithies",
    "bld_markets",
    "bld_mage_towers",
    "bld_shrines",
    "bld_training",
    "bld_castles",
    "bld_housing",
    "bld_libraries",
    "bld_taverns",
    "bld_walls",
  ];
  for (const b of bldAttrs) {
    score += (k[b] || 0) * 2; // Flat 2 points per building to reward infrastructure
  }

  return Math.floor(score);
}

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
