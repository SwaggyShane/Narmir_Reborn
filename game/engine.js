// src/game/engine.js
// Pure game logic — no I/O, no socket calls.
// All functions take a kingdom row (or rows) and return mutations + events.

const config = require("./config");
const { progressGoal } = require('./goals');
const fragmentBonusManager = require("./fragment-bonus-manager");
const { safeJsonParse, roll, rand, clearParseCache } = require('../utils/helpers');

const {
  RACE_BONUSES,
  REGION_DATA,
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
  FARM_WORKERS_PER,
  FOOD_CONSUMPTION_MULT,
  MARKET_INCOME_MULT,
  TRADE_RATE_MULT,
  COMMODITY_VALUES,
  COMMODITY_RACE_DISCOUNT,
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
  XP_RACE_BONUS,
  XP_BASE,
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
  RESOURCE_STAGE1_COL,
  RESOURCE_STAGE2_COL,
  RESOURCE_STAGE3_COL,
  ELEMENTAL_FRAGMENTS,
  RARE_RESOURCE_ITEMS,
  RESOURCE_JUNK_MESSAGES,
  BUILDING_WOOD_COST,
  BUILDING_STONE_COST,
  BUILDING_IRON_COST,
  MILESTONES,
} = config;

const BLUEPRINT_REQUIRED = new Set(BP_REQ);
const SCAFFOLDING_REQUIRED = new Set(SCAFF_REQ);
const SCAFFOLDING_BONUS_BUILDINGS = new Set(SCAFF_BONUS);

const LEGENDARY_NAMES = {
  human: { fighters: "Lionheart Champions" },
  orc: { fighters: "Blood-God Berserkers" },
  high_elf: { rangers: "Starfall Guardians" },
  dark_elf: { ninjas: "Void Assassins" },
  dwarf: { engineers: "Runic Siege-Masters" },
  dire_wolf: { fighters: "Fenris Alphas" },
};

function getUnitName(race, unit, prestigeLevel = 0) {
  if (prestigeLevel > 0 && LEGENDARY_NAMES[race]?.[unit]) {
    return `🌟 ${LEGENDARY_NAMES[race][unit]}`;
  }
  const labels = {
    fighters: "Fighters",
    rangers: "Rangers",
    mages: "Mages",
    clerics: race === "vampire" ? "Thralls" : "Clerics",
    thieves: race === "vampire" ? "Infiltrators" : "Thieves",
    ninjas: "Ninjas",
    scribes: "Scribes",
    researchers: "Researchers",
    engineers: "Engineers",
  };
  return labels[unit] || unit;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isNight() {
  const h = new Date().getUTCHours();
  return h >= 1 && h < 13; // 8PM EST to 8AM EST (EST is UTC-5)
}


function raceBonus(kingdom, stat) {
  const bonuses = RACE_BONUSES[kingdom.race] || {};
  const base = bonuses[stat] || 1.0;

  // Home Region bonus - +5% to the region's designated stat if it's your race's home
  const homeRegion = REGION_DATA[kingdom.race];
  const isHome = homeRegion && homeRegion.name === kingdom.region;
  const regionMult =
    isHome && homeRegion.bonus === stat ? 1 + homeRegion.mult : 1.0;

  // Global Alliance Control bonus - +10% if your alliance owns this region
  let allianceMult = 1.0;
  if (
    kingdom._region_owned_by_my_alliance &&
    kingdom._region_bonus_type === stat
  ) {
    allianceMult = 1.1;
  }

  // Alliance Vault Project Buffs
  let vaultMult = 1.0;
  const aBuffs = safeJsonParse(
    kingdom.alliance_buffs,
    {},
    "raceBonus:alliance_buffs",
  );
  if (stat === "economy" && aBuffs.merchant_guild)
    vaultMult += aBuffs.merchant_guild * 0.05;
  if (stat === "stealth" && aBuffs.shadow_network)
    vaultMult += aBuffs.shadow_network * 0.02;
  if (stat === "military" && aBuffs.mercenary_subsidy)
    vaultMult += aBuffs.mercenary_subsidy * 0.02;

  // Hero Passive Buffs
  let heroMult = 1.0;
  if (kingdom.heroes && Array.isArray(kingdom.heroes)) {
    for (const h of kingdom.heroes) {
      if (h.status !== "idle") continue;
      const cls = HERO_CLASSES[h.class];
      if (cls && cls.statBonus && cls.statBonus[stat]) {
        const bonusValue = cls.statBonus[stat] - 1.0;
        // Abilities unlock mechanically at levels 1, 5, 10.
        // We'll scale the statBonus up mechanically.
        if (h.level >= 10) {
          heroMult += bonusValue;
        } else if (h.level >= 5) {
          heroMult += bonusValue * 0.66;
        } else {
          heroMult += bonusValue * 0.33;
        }
      }
    }
  }

  return base * regionMult * allianceMult * vaultMult * heroMult;
}

function housingCapPerBuilding(k) {
  const base = HOUSING_CAP_BY_RACE[k?.race] || 500;
  if (!k?.prestige_level) return base;
  const mod = PRESTIGE_MODIFIERS[Math.min(k.prestige_level, 5)]?.pop || 1.0;
  return Math.floor(base * mod);
}

function assignRegion(race) {
  return race; // simple mapping for now: race name = region id
}

function goldPerTurn(k) {
  const taxRate = k.tax || 42;
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

  // milestoneMult applies only to core land/castle income; mktIncome stays flat
  return Math.floor((baseRate + castleBonus) * econBonus * 2.25 * milestoneMult * happinessMult * tavernBonus) + mktIncome;
}

function manaPerTurn(k) {
  const raceManaBase =
    {
      high_elf: 8,
      dark_elf: 6,
      human: 3,
      dwarf: 2,
      orc: 2,
      dire_wolf: 1,
    }[k.race] || 3;
  const towerMana = k.bld_mage_towers * 5;
  const capacity = k.bld_mage_towers * 20;
  const effectiveMages = Math.min(getAvailableUnits(k, "mages"), capacity);
  const mageMana = Math.floor(effectiveMages / 5);

  // Tower upgrades
  const towerUpgrades = safeJsonParse(
    k.tower_upgrades,
    {},
    "manaPerTurn:tower_upgrades",
  );
  const arcaneMult = towerUpgrades.arcane_focus ? 1.25 : 1.0;

  let manaGen = Math.floor(
    (raceManaBase + towerMana + mageMana) * raceBonus(k, "magic") * arcaneMult,
  );

  // Apply world fragment bonuses for mage towers (mana, manaRegen, power)
  const manaMult = fragmentBonusManager.getBonusMultiplier(k, 'mage_towers', 'mana');
  const manaRegenMult = fragmentBonusManager.getBonusMultiplier(k, 'mage_towers', 'manaRegen');
  const manaPowerMult = fragmentBonusManager.getBonusMultiplier(k, 'mage_towers', 'power');
  manaGen = Math.floor(manaGen * manaMult * manaRegenMult * manaPowerMult);

  // Apply housing magic output bonus (e.g., Abyssal Crystal)
  const housingMagicMult = fragmentBonusManager.getBonusMultiplier(k, 'housing', 'magic_output');
  manaGen = Math.floor(manaGen * housingMagicMult);

  // Apply happiness multiplier
  const happiness = k.happiness !== undefined && k.happiness !== null ? k.happiness : 50;
  const happinessMult = Math.max(0, 0.5 + (happiness / 100));
  manaGen = Math.floor(manaGen * happinessMult);

  return manaGen;
}

function foodBalance(k) {
  return farmProduction(k) - foodConsumption(k);
}

function naturalMoraleCap(k) {
  let cap = k.res_entertainment || 100;
  // Apply dynamic housing passive bonuses on morale / happiness (e.g., Celestial Realm, Ancient Elven Wood)
  const housingMoraleMult = fragmentBonusManager.getBonusMultiplier(k, 'housing', 'morale');
  const housingHappinessMult = fragmentBonusManager.getBonusMultiplier(k, 'housing', 'happiness');
  cap = Math.floor(cap * housingMoraleMult * housingHappinessMult);

  // Apply housing stability modifier cap (e.g., Void Essence, Cursed Bloodstone reduce max morale)
  const housingStabilityMult = fragmentBonusManager.getBonusMultiplier(k, 'housing', 'stability');
  cap = Math.floor(cap * housingStabilityMult);

  return cap;
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

  // Apply tax penalty/bonus
  const taxRate = k.tax || 42;
  if (taxRate > 42) {
    const taxPenalty = Math.floor(((taxRate - 42) / 58) * 30);
    happiness -= taxPenalty;
  } else if (taxRate < 42) {
    const taxBonus = Math.floor(45 * ((42 - taxRate) / 42));
    happiness += taxBonus;
  }

  // Shrine fragment: morale and faith_morale passives add happiness (per shrine building)
  if (k.bld_shrines) {
    const shrineMoraleDelta = fragmentBonusManager.getBonusMultiplier(k, 'shrines', 'morale') - 1.0;
    const shrineFaithDelta  = fragmentBonusManager.getBonusMultiplier(k, 'shrines', 'faith_morale') - 1.0;
    happiness += Math.floor(k.bld_shrines * (shrineMoraleDelta * 4 + shrineFaithDelta * 6) + 1e-9);
  }

  // Apply happiness recovery based on research + taverns and clamp to -50 to 120
  const recoveryRate = getHappinessRecoveryRate(k);
  happiness = Math.floor(Math.max(-50, Math.min(120, happiness + recoveryRate)));

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

function effectiveMorale(k) {
  let base =
    k.morale !== undefined && k.morale !== null ? k.morale : 100;
  
  // Apply Bless bonus if active
  const effects = safeJsonParse(
    k.active_effects,
    {},
    "effectiveMorale:active_effects",
  );
  if (effects.bless && typeof effects.bless === "object") {
    base += (effects.bless.morale_bonus || 0);
  }

  const entertainment = naturalMoraleCap(k);
  let bonus = raceBonus(k, "morale");
  
  const shrineUpgrades = safeJsonParse(k.shrine_upgrades, {}, "effectiveMorale:shrine_upgrades");
  if (shrineUpgrades.divine_favor) {
    bonus += 0.20;
  }

  // Normalize: entertainment cap maps to 100
  const normalized = (base / entertainment) * 100;
  return Math.floor(normalized * bonus);
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

  const pop = k.population;

  let growthMult = happinessMult;

  // Apply Bless growth boost if active
  const effects = safeJsonParse(
    k.active_effects,
    {},
    "popGrowth:active_effects",
  );
  if (effects.bless) {
    growthMult *= 1.5; // 50% growth boost from bless
  }

  // Apply world fragment bonuses for housing growth (e.g., Tears of the World Tree)
  const housingGrowthMult = fragmentBonusManager.getBonusMultiplier(k, 'housing', 'growth');
  growthMult *= housingGrowthMult;

  if (housingCap > 0 && pop >= housingCap * 2) return 0;
  if (housingCap > 0 && pop > housingCap) growthMult = 0.1;

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
  let schoolBonus = 1 + Math.floor(k.bld_schools / 5) * 0.02;
  const schoolSpeedMult = fragmentBonusManager.getBonusMultiplier(k, 'schools', 'speed');
  const schoolOutputMult = fragmentBonusManager.getBonusMultiplier(k, 'schools', 'output');
  schoolBonus *= (schoolSpeedMult * schoolOutputMult);
  const raceMulti =
    discipline === "spellbook" || discipline === "school_spellbook"
      ? raceBonus(k, "magic")
      : raceBonus(k, "research");
  const resLevelMult = unitLevelMult(k, "researchers");
  const libraryResearchMult = fragmentBonusManager.getBonusMultiplier(k, 'libraries', 'research_speed');

  // Apply happiness multiplier
  const happiness = k.happiness !== undefined && k.happiness !== null ? k.happiness : 50;
  const happinessMult = Math.max(0, 0.5 + (happiness / 100));

  const effective = Math.floor(
    researchersAssigned * schoolBonus * raceMulti * resLevelMult * libraryResearchMult * happinessMult,
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

// ── Troop levelling ───────────────────────────────────────────────────────────

// XP needed to reach each troop level (1-100)
// Early levels fast, late levels very slow
function troopXpForLevel(level) {
  if (level <= 1) return 0;
  if (level <= 10) return level * 100;
  if (level <= 25) return level * 300;
  if (level <= 50) return level * 800;
  if (level <= 75) return level * 2000;
  return level * 5000;
}

function effectiveTroopLevel(k, unit) {
  const troopLevels = safeJsonParse(
    k.troop_levels,
    {},
    "effectiveTroopLevel:troop_levels",
  );
  const data = troopLevels[unit] || { level: 1 };
  const raceBonus = TROOP_RACE_BONUS[k.race]?.[unit] || 1.0;
  // Race bonus multiplies above level 100 — a Dark Elf ninja at level 100 acts as level 180
  return Math.max(
    1,
    Math.floor(
      data.level *
        (data.level >= 100
          ? raceBonus
          : 1 + ((raceBonus - 1) * data.level) / 100),
    ),
  );
}

// Award XP to a specific troop type — returns updated troop_levels JSON and any level-ups
function awardTroopXp(k, unit, xpAmount) {
  const troopLevels = safeJsonParse(
    k.troop_levels,
    {},
    "awardTroopXp:troop_levels",
  );
  const current = troopLevels[unit] || { level: 1, xp: 0, count: 0 };
  const cap = 100;
  if (current.level >= cap)
    return { troop_levels: JSON.stringify(troopLevels), levelUps: [] };

  const raceBonus = TROOP_RACE_BONUS[k.race]?.[unit] || 1.0;
  let earned = Math.floor(xpAmount * raceBonus);
  const newXp = current.xp + earned;
  const xpNeeded = troopXpForLevel(current.level + 1);
  const levelUps = [];

  if (newXp >= xpNeeded && current.level < cap) {
    troopLevels[unit] = {
      level: current.level + 1,
      xp: newXp - xpNeeded,
      count: current.count,
    };
    levelUps.push(`${unit} reached Level ${current.level + 1}`);
  } else {
    // Store XP within current level only (mod the threshold to prevent overflow)
    troopLevels[unit] = { ...current, xp: Math.min(newXp, xpNeeded - 1) };
  }
  return { troop_levels: JSON.stringify(troopLevels), levelUps };
}

// ── Unit level scaling ────────────────────────────────────────────────────────
// Returns effectiveness multiplier: +0.5% per level above 1, caps at +50% at level 100
function unitLevelMult(k, unit) {
  const level = effectiveTroopLevel(k, unit);
  const prestigeBonus = k.prestige_level * 0.05;
  const isLegendary =
    k.prestige_level > 0 && LEGENDARY_NAMES[k.race]?.[unit] ? 1.15 : 1.0;
  return (
    (1 + Math.min(0.5, (level - 1) * 0.005)) * (1 + prestigeBonus) * isLegendary
  );
}

// ── Racial unique bonuses (unlocked at unit level 5+) ─────────────────────────
function racialUnitBonus(k, unit) {
  const level = effectiveTroopLevel(k, unit);
  if (level < 25) return {};
  const race = k.race;
  // Dwarf: 1 engineer can solo-crew a war machine
  if (race === "dwarf" && unit === "engineers")
    return { warMachineSoloCrew: true };
  // High Elf: scroll crafting produces 2 scrolls instead of 1
  if (race === "high_elf" && unit === "mages") return { doubleScrolls: true };
  // Orc: every 10 fighters trains 1 free fighter per turn
  if (race === "orc" && unit === "fighters")
    return { freeTrainees: Math.floor(k.fighters / 10) };
  // Dark Elf: assassinations leave no trace — target gets no news
  if (race === "dark_elf" && unit === "ninjas")
    return { silentAssassination: true };
  // Dire Wolf: expeditions return 1 turn early
  if (race === "dire_wolf" && unit === "rangers") return { earlyReturn: true };
  // Human: clerics restore 1 morale across all unit types per turn
  if (race === "human" && unit === "clerics") return { auraHeal: true };
  // Vampire: Infiltrators (thieves) steal significantly more gold and have higher sabotage success at night
  if (race === "vampire" && unit === "thieves")
    return { infiltratorMastery: true };
  return {};
}

// ── Dilute troop XP when new units are hired ──────────────────────────────────
// new_avg_xp = (old_xp × old_count) / (old_count + hired)
function diluteTroopXp(k, unit, hired) {
  if (!hired || hired <= 0) return null;
  const troopLevels = safeJsonParse(
    k.troop_levels,
    {},
    "diluteTroopXp:troop_levels",
  );
  const current = troopLevels[unit] || { level: 1, xp: 0, count: k[unit] || 0 };
  const oldCount = Math.max(1, current.count || k[unit] || 1);
  const totalXp = current.xp + troopXpForLevel(current.level); // total absolute XP
  const newCount = oldCount + hired;
  const newAvgXp = Math.floor((totalXp * oldCount) / newCount);
  // Recompute level from new average XP
  let newLevel = 1;
  while (newLevel < 100 && newAvgXp >= troopXpForLevel(newLevel + 1))
    newLevel++;
  const xpIntoLevel = newAvgXp - troopXpForLevel(newLevel);
  troopLevels[unit] = {
    level: newLevel,
    xp: Math.max(0, xpIntoLevel),
    count: newCount,
  };
  return JSON.stringify(troopLevels);
}

// ── Award activity XP to a unit type ─────────────────────────────────────────
// Wraps awardTroopXp, applies race bonus, returns updated troop_levels object (not stringified)
function awardUnitXp(k, unit, xpAmount) {
  if (!xpAmount || xpAmount <= 0 || !(k[unit] > 0)) return null;
  const result = awardTroopXp(k, unit, xpAmount);
  // Return parsed object, not JSON string, so it stays as object throughout processTurn
  return typeof result.troop_levels === "string" ? JSON.parse(result.troop_levels) : result.troop_levels;
}

// ── Unit Availability ──────────────────────────────────────────────────────────
function getAvailableUnits(k, unit) {
  const total = k[unit] || 0;
  if (!k.training_allocation) return total;
  const trainingAlloc = safeJsonParse(
    k.training_allocation,
    {},
    "getAvailableUnits:training_allocation",
  );
  const training = Math.max(0, parseInt(trainingAlloc[unit]) || 0);
  return Math.max(0, total - training);
}

// ── Defense system ────────────────────────────────────────────────────────────

// Compute overall defense rating label
function defenseRating(k) {
  const defUpgrades = safeJsonParse(
    k.defense_upgrades,
    {},
    "defenseRating:defense_upgrades",
  );
  if (defUpgrades.citadel) return "👑 Citadel";
  if (defUpgrades.keep) return "🏰 Keep";
  if (defUpgrades.fortified) return "🛡️ Fortified";

  return "🔴 Undefended";
}

// Wall contribution to defense power
function wallDefensePower(k) {
  const walls = k.bld_walls;
  if (!walls) return 0;
  const race = k.race || "human";
  const mult = WALL_STRENGTH_MULT[race] || 1.0;
  const wallUpgrades = safeJsonParse(
    k.wall_upgrades,
    {},
    "wallDefensePower:wall_upgrades",
  );
  const reinMult = wallUpgrades.reinforced ? 1.25 : 1.0;

  const aBuffs = safeJsonParse(
    k.alliance_buffs,
    {},
    "wallDefensePower:alliance_buffs",
  );
  const vaultWallMult =
    1.0 + (aBuffs.fortress_walls ? aBuffs.fortress_walls * 0.05 : 0);

  // Fragment bonus multipliers for walls (health, defense, intangibility)
  const wallHealthMult = fragmentBonusManager.getBonusMultiplier(k, 'walls', 'health');
  const wallDefenseMult = fragmentBonusManager.getBonusMultiplier(k, 'walls', 'defense');
  const effectiveWallMult = wallHealthMult * wallDefenseMult;

  // Base: each wall = 100 defense power (scaled by race + upgrades)
  const wmOnWalls = Math.min(k.war_machines, walls);
  const wmBonus =
    wmOnWalls *
    500 *
    ((k.res_war_machines || 100) / 100) *
    (wallUpgrades.fortress_walls ? 1.75 : wallUpgrades.battlements ? 1.2 : 1.0);
  // Shrine fragment: defense_armor (Dwarven Star-Metal) fortifies defenders against siege
  const shrineArmorMult = fragmentBonusManager.getBonusMultiplier(k, 'shrines', 'defense_armor');
  return Math.floor((walls * 100 * mult * reinMult * vaultWallMult * effectiveWallMult + wmBonus) * shrineArmorMult);
}

// Guard tower contribution — thief detection
function towerDetectionPower(k) {
  const towers = k.bld_guard_towers;
  if (!towers) return 0;
  const race = k.race || "human";
  const mult = TOWER_DETECT_MULT[race] || 1.0;
  const twUpgrades = safeJsonParse(
    k.tower_def_upgrades,
    {},
    "towerDetectionPower:tower_def_upgrades",
  );
  const arrwMult = twUpgrades.arrow_slits ? 1.2 : 1.0;
  const btlMult = safeJsonParse(
    k.wall_upgrades,
    {},
    "towerDetectionPower:wall_upgrades",
  ).battlements
    ? 1.2
    : 1.0;
  const thievesOnWatch = Math.min(k.thieves, towers * 10);
  const thiefLvlMult = unitLevelMult(k, "thieves");
  const stealthMult = raceBonus(k, "stealth");

  // Fragment bonus multipliers for guard towers (detection, power, reach)
  const towerDetectMult = fragmentBonusManager.getBonusMultiplier(k, 'guard_towers', 'detection');
  const towerPowerMult = fragmentBonusManager.getBonusMultiplier(k, 'guard_towers', 'power');
  const towerReachMult = fragmentBonusManager.getBonusMultiplier(k, 'guard_towers', 'reach');
  const effectiveTowerMult = towerDetectMult * towerPowerMult * towerReachMult;

  return Math.floor(
    (towers * 50 + thievesOnWatch * 15 * thiefLvlMult * stealthMult) *
      mult *
      arrwMult *
      btlMult *
      effectiveTowerMult,
  );
}

// Outpost contribution — ranger patrol defense
function outpostRangerPower(k) {
  const outposts = k.bld_outposts;
  if (!outposts) return 0;
  const race = k.race || "human";
  const mult = OUTPOST_RANGER_MULT[race] || 1.0;
  const opUpgrades = safeJsonParse(
    k.outpost_upgrades,
    {},
    "outpostRangerPower:outpost_upgrades",
  );
  const stationMult = opUpgrades.ranger_station ? 1.25 : 1.0;
  const rangersOnPatrol = Math.min(k.rangers, outposts * 20);
  const rangerLvlMult = unitLevelMult(k, "rangers");
  const militaryMult = raceBonus(k, "military");

  // Fragment bonus multipliers for outposts (effectiveness, scouts, power)
  const outpostEffectMult = fragmentBonusManager.getBonusMultiplier(k, 'outposts', 'effectiveness');
  const outpostScoutsMult = fragmentBonusManager.getBonusMultiplier(k, 'outposts', 'scouts');
  const outpostPowerMult = fragmentBonusManager.getBonusMultiplier(k, 'outposts', 'power');
  const effectiveOutpostMult = outpostEffectMult * outpostScoutsMult * outpostPowerMult;

  return Math.floor(
    (outposts * 30 + rangersOnPatrol * 10 * rangerLvlMult * militaryMult) *
      mult *
      stationMult *
      effectiveOutpostMult,
  );
}

// Check and award defense tiers
function checkDefenseTiers(k, events) {
  const updates = {};
  const defUpgrades = safeJsonParse(
    k.defense_upgrades,
    {},
    "checkDefenseTiers:defense_upgrades",
  );
  const tiers = DEFENSE_TIERS;

  const w = k.bld_walls;
  const t = k.bld_guard_towers;
  const o = k.bld_outposts;
  const c = k.bld_castles;

  const meetsFortified =
    w >= tiers.fortified.walls &&
    t >= tiers.fortified.guard_towers &&
    o >= tiers.fortified.outposts &&
    c >= tiers.fortified.castles;
  const meetsKeep =
    w >= tiers.keep.walls &&
    t >= tiers.keep.guard_towers &&
    o >= tiers.keep.outposts &&
    c >= tiers.keep.castles;
  const meetsCitadel =
    w >= tiers.citadel.walls &&
    t >= tiers.citadel.guard_towers &&
    o >= tiers.citadel.outposts &&
    c >= tiers.citadel.castles;

  let changed = false;

  if (meetsFortified && !defUpgrades.fortified) {
    defUpgrades.fortified = true;
    changed = true;
    events.push({
      type: "system",
      message: `🛡️ Fortified! Your defenses are solidifying. +5% permanent defense power, -5% land loss on defeat.`,
    });
  } else if (!meetsFortified && defUpgrades.fortified) {
    defUpgrades.fortified = false;
    changed = true;
    events.push({
      type: "system",
      message: `⚠️ Lost Fortified status! Your defenses have degraded.`,
    });
  }

  if (meetsKeep && !defUpgrades.keep) {
    defUpgrades.keep = true;
    changed = true;
    events.push({
      type: "system",
      message: `🏰 Keep established! Your fortress is becoming formidable. +10% permanent defense power, -10% land loss on defeat.`,
    });
  } else if (!meetsKeep && defUpgrades.keep) {
    defUpgrades.keep = false;
    changed = true;
    events.push({
      type: "system",
      message: `⚠️ Lost Keep status! Your fortress has been compromised.`,
    });
  }

  if (meetsCitadel && !defUpgrades.citadel) {
    defUpgrades.citadel = true;
    changed = true;
    events.push({
      type: "system",
      message: `👑 Castle Citadel achieved! Your fortress stands among the greatest in Narmir. +15% permanent defense power, -15% land loss on defeat, warmachines on walls deal ×2 damage.`,
    });
  } else if (!meetsCitadel && defUpgrades.citadel) {
    defUpgrades.citadel = false;
    changed = true;
    events.push({
      type: "system",
      message: `🏚️ Castle Citadel lost! Your fortress no longer meets the requirements for the Citadel bonus.`,
    });
  }

  if (changed) {
    updates.defense_upgrades = JSON.stringify(defUpgrades);
  }
  return updates;
}

function getMasonSigilResist(k) {
  let upg = {};
  try {
    upg = safeJsonParse(k.library_upgrades, {}, "auto:library_upgrades");
  } catch {}
  if (!upg.mason_sigil) return 1.0;
  // Master Mason Sigil gives 0.75 resist by default, 0.5 if we have certified blueprints in stock
  return k.certified_blueprints_stored > 0 ? 0.5 : 0.75;
}

// Process building warmachine damage on successful attack (no walls = building damage)
function applyWarmachineDamage(attacker, defender, win) {
  const updates = {};
  if (!win) return updates;
  const walls = defender.bld_walls || 0;
  if (walls > 0) {
    // Walls take damage — % based on wall upgrades
    const wallUpgrades = safeJsonParse(
      defender.wall_upgrades,
      {},
      "applyWarmachineDamage:wall_upgrades",
    );
    const warmachineResist = wallUpgrades.fortress_walls
      ? 0.03
      : wallUpgrades.reinforced
        ? 0.06
        : 0.1;
    const wallLost = Math.max(1, Math.floor(walls * warmachineResist));
    updates.bld_walls = Math.max(0, walls - wallLost);
  } else {
    // No walls — random buildings take damage
    const DAMAGEABLE = [
      "bld_farms",
      "bld_markets",
      "bld_barracks",
      "bld_schools",
      "bld_mage_towers",
      "bld_shrines",
    ];
    const target = DAMAGEABLE[Math.floor(Math.random() * DAMAGEABLE.length)];
    const current = defender[target] || 0;
    if (current > 0) {
      const dmg = Math.max(
        1,
        Math.floor(current * 0.05 * getMasonSigilResist(defender)),
      );
      updates[target] = Math.max(0, current - dmg);
    }
  }
  return updates;
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

// ── Resource gathering system ─────────────────────────────────────────────────

/**
 * Add or update an item in a kingdom's items array.
 * items is an array of { id, name, qty } objects.
 */
function addItemToInventory(itemsArray, id, name, qty = 1) {
  const existing = itemsArray.find((i) => i.id === id);
  if (existing) {
    existing.qty = (existing.qty || 0) + qty;
  } else {
    itemsArray.push({ id, name, qty });
  }
}

/**
 * Initialize items array with four elemental fragments at qty 0.
 */
function initItemsArray(existing) {
  const arr = Array.isArray(existing) ? [...existing] : [];
  for (const frag of ELEMENTAL_FRAGMENTS) {
    if (!arr.find((i) => i.id === frag.id)) {
      arr.push({ id: frag.id, name: frag.name, qty: 0 });
    }
  }
  return arr;
}

/**
 * Process resource yield each turn for all resource buildings.
 * Returns updates object with wood/stone/iron changes and news events.
 */
function processResourceYield(k, events) {
  const updates = {};
  const turn = k.turn;

  // Parse items
  let items = safeJsonParse(k.items, [], 'processResourceYield:items');
  items = initItemsArray(items);
  let itemsChanged = false;

  // Calculate free population (population minus all hired units)
  const hiredUnits = totalHiredUnits(k);
  const freePopulation = Math.max(0, k.population - hiredUnits);

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

    // Apply world fragment bonuses for each resource building type
    const fragmentMult = fragmentBonusManager.getBonusMultiplier(k, bKey, 'production');
    baseYield *= fragmentMult;

    // Random events on wood production only
    if (cfg.type === 'wood') {
      const rareFindMult = raceBonus(k, 'rare_find');
      const roll = Math.random();

      if (roll < 0.0025 * rareFindMult) {
        // 0.25% rare wood item
        const rareItems = RARE_RESOURCE_ITEMS.wood;
        const chosen = rareItems[Math.floor(Math.random() * rareItems.length)];
        const existing = items.find((i) => i.id === chosen.id);
        if (!existing || (existing.qty || 0) < 3) {
          addItemToInventory(items, chosen.id, chosen.name, 1);
          itemsChanged = true;
          events.push({ type: 'system', message: `🌲 Your foresters discovered a rare item: ${chosen.name}!` });
        }
      } else if (roll < 0.01 * rareFindMult) {
        // 1% earth fragment
        const earthFrag = items.find((i) => i.id === 'earth_fragment');
        if (!earthFrag || (earthFrag.qty || 0) === 0) {
          addItemToInventory(items, 'earth_fragment', 'Earth Fragment', 1);
          itemsChanged = true;
          events.push({ type: 'system', message: `🌍 Your foresters unearthed an Earth Fragment while logging!` });
        }
      } else if (roll < 0.06) {
        // 5% double yield (but only if not already hitting a rarer event)
        baseYield *= 2;
        events.push({ type: 'system', message: `🌲 An unusually productive logging session doubled your wood yield!` });
      } else if (roll < 0.26) {
        // 20% worthless find (humorous)
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

function totalHiredUnits(k) {
  return (
    k.fighters +
    k.rangers +
    k.clerics +
    k.mages +
    k.thieves +
    k.ninjas +
    k.researchers +
    k.engineers +
    k.scribes +
    k.thralls
  );
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
  let workersNeeded = FARM_WORKERS_PER[race] || 10;

  if (upgrades.iron_plows) {
    workersNeeded = Math.max(1, workersNeeded - 2);
  }

  let workedFarms = 0;
  if (race === "vampire") {
    workedFarms = Math.min(farms, Math.floor(k.thralls / workersNeeded));
  } else {
    const freePop = Math.max(0, k.population - totalHiredUnits(k));
    workedFarms = Math.min(farms, Math.floor(freePop / workersNeeded));
  }

  let baseYield = workedFarms * 150 * (FARM_YIELD_MULT[race] || 1.0);

  // Apply farm upgrades to all races
  if (upgrades.irrigated) baseYield *= (FARM_UPGRADES.irrigated.yieldBonus + 1);
  if (upgrades.plantation) baseYield *= (FARM_UPGRADES.plantation.yieldBonus + 1);

  // Apply season and active event farm multiplier
  const activeEv = safeJsonParse(
    k.active_event,
    {},
    "farmProduction:active_event",
  );
  const seasonMult = k._season_farm_mult || 1.0;
  const evFarmMult = activeEv.farm_yield ? activeEv.farm_yield.mult : 1.0;

  baseYield *= seasonMult * evFarmMult;

  // Apply world fragment bonuses
  const productionMult = fragmentBonusManager.getBonusMultiplier(k, 'farms', 'production');
  baseYield *= productionMult;

  // Apply happiness multiplier
  const happiness = k.happiness !== undefined && k.happiness !== null ? k.happiness : 50;
  const happinessMult = Math.max(0, 0.5 + (happiness / 100));
  baseYield *= happinessMult;

  return Math.floor(baseYield);
}

function foodConsumption(k) {
  const race = k.race || "human";
  const mult = FOOD_CONSUMPTION_MULT[race] || 1.0;
  const troops = totalHiredUnits(k);
  const pop = Math.floor(k.population / 100);

  let consumption;
  if (race === "vampire") {
    // Only Thralls eat grain. Vampires eat Thralls/Pop (handled in processFoodEconomy)
    consumption = Math.floor(k.thralls * mult);
  } else {
    consumption = Math.floor((troops + pop) * mult);
  }

  // Apply world fragment bonuses (consumption multiplier increases food requirements)
  const consumptionMult = fragmentBonusManager.getBonusMultiplier(k, 'farms', 'consumption');
  consumption *= consumptionMult;

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

  const freePop = Math.max(0, k.population - totalHiredUnits(k));
  const workedMarkets = Math.min(markets, Math.floor(freePop / 5));
  const tradeRoutes = Math.min(k.maps, markets);
  let income = (workedMarkets * 50 + tradeRoutes * 30) * mult;
  if (upgrades.bazaar) income *= 1.5;
  if (upgrades.black_market) income *= 1.2;

  // Apply world fragment bonuses for markets
  const incomeMult = fragmentBonusManager.getBonusMultiplier(k, 'markets', 'income');
  income *= incomeMult;

  return Math.floor(income);
}

function tavernEntertainmentBonus(k) {
  if (!k.bld_taverns) return 0;
  const baseBonusPerTavern = 10;
  let bonus = k.bld_taverns * baseBonusPerTavern;

  // Apply fragment bonuses for taverns (morale, happiness)
  const tavernMoraleMult = fragmentBonusManager.getBonusMultiplier(k, 'taverns', 'morale');
  const tavernHappinessMult = fragmentBonusManager.getBonusMultiplier(k, 'taverns', 'happiness');
  bonus = Math.floor(bonus * tavernMoraleMult * tavernHappinessMult);

  return bonus;
}

function commodityPrice(item, race, supplyIndex) {
  const base = COMMODITY_VALUES[item] || 1;
  const raceDisc = COMMODITY_RACE_DISCOUNT[race] || {};
  const discount = raceDisc[item] || raceDisc._all || 1.0;
  const supply = (supplyIndex && supplyIndex[item]) || 1.0;
  return Math.max(1, Math.round(base * discount * supply));
}

function processFoodEconomy(k, events) {
  const updates = {};
  const race = k.race || "human";
  const prod = farmProduction(k);
  const cons = foodConsumption(k);
  const balance = prod - cons;
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

  const maxStore = Math.floor((Math.floor(BASE_FOOD_STORAGE * storageRaceMult) + k.bld_granaries * granaryPer) * granaryCapacityMult);

  // Apply degradation before checking balance
  let rotRate = upgrades.preservation ? 0.05 * 0.7 : 0.05; // 5% base degradation, lowered by 30% with salt curing

  // Apply fragment attunement decay reduction
  const granaryAttune = fragmentBonusManager.getFragmentForBuilding(k, 'granaries');

  // Check for fragments with complete decay elimination
  if (granaryAttune && (granaryAttune.fragment === 'Volcanic Rock' || granaryAttune.fragment === 'Abyssal Crystal')) {
    // Geothermal Dehydration & Glacial Cryostasis: eliminate 100% spoilage
    rotRate = 0;
  } else {
    // Other fragments: apply decay_reduction multiplier (including Ancient Elven Wood)
    const decayReduction = fragmentBonusManager.getBonusMultiplier(k, 'granaries', 'decay_reduction');
    if (decayReduction > 1.0) {
      rotRate = Math.max(0, rotRate * (2.0 - decayReduction));
    }
  }

  const spoilage = Math.floor(food * rotRate);
  if (spoilage > 0) {
    food -= spoilage;
    updates._spoilage = spoilage; // we can track it here
  }

  if (race === "vampire") {
    // ── Vampire Special: Thralls eat grain, Vampires eat Thralls/Pop ──────
    // 1. Thrall grain consumption handled by balance (thralls eat grain)
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

    // 2. Vampire hunger (Original food consumption amount, satisfied by eating population)
    // Mult is same as previous (but maybe we should use human mult as base for "hunger"?)
    // Prompt says "Their consumption is still as it was previously, just with a portion of the population."
    const troops = totalHiredUnits(k) - (updates.thralls ?? k.thralls ?? 0);
    const pop = Math.floor(k.population / 100);
    const vampireConsumption = 0.285; // Sustainable ~2.85% population consumption per turn
    const hunger = Math.floor((troops + pop) * vampireConsumption);

    let totalConsumed = 0;
    const currentThralls = updates.thralls ?? k.thralls ?? 0;

    // Priority: Consume Population FIRST, then Thralls
    let populationEaten = Math.min(k.population, hunger);
    let remainingHunger = hunger - populationEaten;

    let mausoleumUpgrades = {};
    try {
      mausoleumUpgrades = safeJsonParse(k.mausoleum_upgrades, {}, "auto:mausoleum_upgrades");
    } catch {}

    // Blood Sacrifice upgrade: Thralls are 20% more efficient (eat fewer for same hunger)
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

    // Reduced trigger chance to 2% and conversion amount to 1.5% of consumed population
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

        // Award 10 XP to that unit type
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
      const natCap = naturalMoraleCap(k);
      const cur =
        updates.morale !== undefined
          ? updates.morale
          : k.morale !== undefined && k.morale !== null
            ? k.morale
            : 100;
      const oldMorale = cur;
      updates.morale = Math.min(natCap, cur + 2);
      const mDelta = (updates.morale || 0) - oldMorale;
      
      events.push({
        type: "system",
        message: `🌾 Food surplus: +${balance.toLocaleString()} units. Troops are well fed.`,
      });
      
    } else {
      events.push({
        type: "system",
        message: `🌾 Food: +${balance.toLocaleString()} surplus. Stores: ${food.toLocaleString()}.`,
      });
    }
  } else {
    const shortage = Math.abs(balance);
    const shortTurns = k.food_shortage_turns + 1;
    updates.food_shortage_turns = shortTurns;
    updates.food_surplus_turns = 0;

    if (food >= shortage) {
      food -= shortage;
      updates.food = food;
      events.push({
        type: "system",
        message: `⚠️ Food deficit: drawing ${shortage.toLocaleString()} from stores. ${food.toLocaleString()} remaining.`,
      });
    } else {
      updates.food = 0;
      events.push({
        type: "system",
        message: `🚨 Food shortage! Turn ${shortTurns} — build more farms or reduce troops.`,
      });
      if (shortTurns >= 3) {
        const hit = shortTurns >= 8 ? 20 : shortTurns >= 5 ? 10 : 5;
        const cur =
          updates.morale !== undefined
            ? updates.morale
            : k.morale !== undefined && k.morale !== null
              ? k.morale
              : 100;
        const oldMorale = cur;
        updates.morale = Math.max(0, cur - hit);
        const mDelta = updates.morale - oldMorale;

        events.push({
          type: "system",
          message: `🚨 Food shortage! Turn ${shortTurns} — build more farms or reduce troops.`,
        });

      }
      if (shortTurns >= 5) {
        let fleeCount = 500;
        const activeHousingSpecial = fragmentBonusManager.getSpecialEffect(k, 'housing');

        // Apply housing special abilities to reduce population fleeing
        if (activeHousingSpecial?.name === "Holy Sanctuaries") {
          // Celestial Feather: Completely prevent unrest
          fleeCount = 0;
        } else if (activeHousingSpecial?.name === "Treehouse Canopy") {
          // Ancient Elven Wood: 80% reduction in fleeing
          fleeCount = Math.floor(fleeCount * 0.2);
        } else if (activeHousingSpecial?.name === "Lifespring Spores") {
          // Tears of World Tree: 50% reduction in fleeing
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

/**
 * Process granary attunement special abilities
 * Executes automated effects like food replication, vanishing, spoilage prevention
 */
function processGranaryAttunements(k, events) {
  const updates = {};
  const granaryAttune = fragmentBonusManager.getFragmentForBuilding(k, 'granaries');

  if (!granaryAttune) {
    return updates;
  }

  const fragmentName = granaryAttune.fragment;
  let foodChange = 0;

  switch (fragmentName) {
    case 'Tears of the World Tree':
      // +2% food self-replication per turn based on current food stored
      foodChange = Math.floor((k.food || 0) * 0.02);
      if (foodChange > 0) {
        events.push({
          type: 'system',
          message: `💧 Tears of the World Tree: +${foodChange.toLocaleString()} food replicated from stored reserves.`
        });
      }
      break;

    case 'Void Essence':
      // 5% chance per turn food vanishes based on current food stored
      if (Math.random() < 0.05 && (k.food || 0) > 0) {
        const voidLoss = Math.floor((k.food || 0) * (0.1 + Math.random() * 0.3));
        foodChange = -voidLoss;
        events.push({
          type: 'system',
          message: `🌌 Void Essence: ${voidLoss.toLocaleString()} food consumed by the void!`
        });
      }
      break;

    case 'Celestial Feather':
      // Portion of reserves distributed to boost happiness on unstable turns
      const happiness = k.happiness !== undefined && k.happiness !== null ? k.happiness : 50;
      if (happiness < 30 && (k.food || 0) > 0) {
        const happinessFoodCost = Math.max(1, Math.floor((k.food || 0) * 0.05));
        const happinessBoost = 10; // +10 happiness
        foodChange = -happinessFoodCost;
        events.push({
          type: 'system',
          message: `🪶 Manna Manifestation: ${happinessFoodCost.toLocaleString()} food distributed to raise happiness (+10).`
        });
        updates.happiness = Math.min(120, happiness + happinessBoost);
      }
      break;

    // Other fragments with passive-only abilities don't trigger special events
    // (Geothermal, Ancient Elven Wood, Dragon Scale, Abyssal Crystal, etc.)
  }

  if (foodChange !== 0) {
    const newFood = Math.max(0, (k.food || 0) + foodChange);
    updates.food = newFood;
  }

  return updates;
}

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

function calculateTradeIncome(k) {
  const routes = k._trade_routes;
  if (!routes || routes.length === 0) return 0;

  const base = config.TRADE_ROUTE_BASE_GOLD || 1500;
  let raceMult = config.TRADE_RATE_MULT[k.race] || 1.0;

  if (k.prestige_level > 0) {
    const tierMod = PRESTIGE_MODIFIERS[Math.min(k.prestige_level, 5)]?.econ || 1.0;
    raceMult *= tierMod;
  }

  const econRes = (k.res_economy || 100) / 100;
  const marketBonus = 1 + k.bld_markets * 0.002;

  // Merchant King achievement: +10% trade route income
  let achievements = safeJsonParse(k.achievements, [], "calculateTradeIncome:achievements");
  const merchantKingBonus = achievements.includes("ach_wealthy") ? 1.1 : 1.0;

  let total = 0;
  for (const r of routes) {
    // Income depends on partner's economy and current stability
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

function displayMorale(k) {
  const base = k.morale !== undefined && k.morale !== null ? k.morale : 100;
  const ent = k.res_entertainment || 100;
  const raceMap = {
    human: 1.05,
    high_elf: 0.95,
    dwarf: 1.0,
    dire_wolf: 1.1,
    dark_elf: 0.9,
    orc: 1.05,
    vampire: 0.95,
  };
  const bonus = raceMap[k.race] || 1.0;
  return Math.floor((base / ent) * 100 * bonus);
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



  // Calculate happiness at the start of the turn
  const happinessResult = calculateHappiness(k);
  updates.happiness = happinessResult.happiness;

  // Record happiness history for tracking and graphing
  if (db && k.id) {
    recordHappinessHistory(db, k.id, updates.turn, happinessResult).catch(err =>
      console.error(`[engine] Failed to record happiness history: ${err.message}`)
    );
  }

  // Check for rebellion events
  rebellionCheck(k, happinessResult.happiness, updates, events);

  // ── 1. Gold income ───────────────────────────────────────────────────────────
  const income = goldPerTurn(k);
  const tradeIncome = calculateTradeIncome(k);
  updates.gold = k.gold + income + tradeIncome;

  let incomeMsg = `💰 Turn ${updates.turn}: +${income.toLocaleString()} gold earned.`;
  if (tradeIncome > 0) {
    incomeMsg = `💰 Turn ${updates.turn}: +${income.toLocaleString()} gold earned (+${tradeIncome.toLocaleString()} from trade routes).`;
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
      message: `👥 Population declined by ${Math.abs(growth).toLocaleString()} to ${updates.population.toLocaleString()} due to low happiness.`,
    });
  }

  // ── 4. Food economy — farms, consumption, shortage consequences ──────────────
  const foodUpdates = processFoodEconomy({ ...k, ...updates }, events);
  Object.assign(updates, foodUpdates);

  // ── 4a. Granary attunement special abilities ──────────────────────────────────
  const granaryAbilityUpdates = processGranaryAttunements({ ...k, ...updates }, events);
  Object.assign(updates, granaryAbilityUpdates);

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

          if (loreCollected.length >= Object.values(LORE).flat().length) {
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
    let msg = `⚔️ Troop upkeep: -${upkeep.toLocaleString()} gold (${totalTroops.toLocaleString()} billable`;
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

  // ── 6. Morale ─────────────────────────────────────────────────────────────────
  {
    const capPerBuilding = housingCapPerBuilding(k);
    let housingCap = k.bld_housing * capPerBuilding;
    // Apply world fragment bonuses for housing capacity
    const housingMult = fragmentBonusManager.getBonusMultiplier(k, 'housing', 'capacity');
    housingCap *= housingMult;
    const overcrowded = housingCap > 0 && k.population > housingCap;

    // Race overcrowding penalty modifiers
    let overcrowdMult = { dire_wolf: 0.5, high_elf: 2.0 }[k.race] || 1.0;
    const activeHousingSpecial = fragmentBonusManager.getSpecialEffect(k, 'housing');
    if (activeHousingSpecial?.name === "Goliath Dwellings") {
      overcrowdMult *= 0.2; // 80% reduction in overcrowding penalty, since they are spacious
    }
    const overcrowdPenalty = overcrowded
      ? Math.max(
          0,
          Math.floor(
            ((k.population - housingCap) / 1000) * overcrowdMult,
          ),
        )
      : 0;

    let taxPenalty = 0;
    let taxBoost = 0;
    const currentTax = k.tax || 42;

    if (currentTax >= 50) {
      taxPenalty = 10 + Math.floor(((currentTax - 50) / 50) * 65);
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
            updates.morale !== undefined
              ? updates.morale
              : k.morale !== undefined && k.morale !== null
                ? k.morale
                : 100;
          const oldMorale = cur;
          updates.morale = Math.min(100, cur + 2);
          const mDelta = updates.morale - oldMorale;
          if (mDelta > 0) {
            bonusStr = `+${mDelta} Morale`;
          } else {
            bonusStr = `Morale at cap`;
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
        updates.morale !== undefined
          ? updates.morale
          : k.morale !== undefined && k.morale !== null
            ? k.morale
            : 100;
      const oldM = cur;
      updates.morale = Math.max(0, cur - taxPenalty);
      if (updates.morale !== oldM) {
      }

      if (overcrowdPenalty > 0) {
        const cur2 = updates.morale;
        const newMorale = Math.max(0, cur2 - overcrowdPenalty);
        if (newMorale !== cur2) {
        }
        updates.morale = newMorale;
      }
    } else {
      const recovery =
        1 + taxBoost + Math.floor(k.res_entertainment / 200);
      const natCap = naturalMoraleCap(k);
      const cur =
        updates.morale !== undefined
          ? updates.morale
          : k.morale !== undefined && k.morale !== null
            ? k.morale
            : 100;
      let newMorale = Math.min(natCap, cur + recovery);
      let recoveryReason = `Low taxes / Entertainment`;

      // If currently above natural cap (due to spells/events), natural decay?
      if (cur > natCap) {
        newMorale = Math.max(natCap, cur - 2); // Natural decay towards cap
        if (newMorale !== cur) {
        }
      } else if (newMorale > cur) {
      }

      if (overcrowdPenalty > 0) {
        const afterCrowdMorale = Math.max(0, newMorale - overcrowdPenalty);
        if (afterCrowdMorale !== newMorale) {
        }
        newMorale = afterCrowdMorale;
      }

      if (newMorale !== cur) {
        updates.morale = newMorale;
      }
    }
  }

  // ── 6b. Morale Threshold Events ───────────────────────────────────────────────
  const currentMoraleThreshold =
    updates.morale !== undefined
      ? updates.morale
      : k.morale !== undefined && k.morale !== null
        ? k.morale
        : 100;

  if (currentMoraleThreshold <= 0) {
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

    const oldM = updates.morale !== undefined ? updates.morale : k.morale;
    updates.morale = 5; // Reset morale
    events.push({
      type: "system",
      message: `🔥 RIOTS! Citizens revolt! ${popLost.toLocaleString()} citizens fled/died, ${goldLost.toLocaleString()} gold looted${destBldStr}. Morale has been reset to 5.`,
    });
  } else if (currentMoraleThreshold > 0 && currentMoraleThreshold < 25) {
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
          message: `🔪 Critical Unrest: Crime wave spreads! ${goldLost.toLocaleString()} gold lost.`,
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
          message: `🏃 Critical Unrest: Desertion! ${fLost.toLocaleString()} fighters and ${rLost.toLocaleString()} rangers fled the ranks.`,
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
            message: `🔥 Critical Unrest: Arson! 1 ${bToDest.replace("bld_", "")} was burned down.`,
          });
        } else {
          events.push({
            type: "system",
            message: `🔥 Critical Unrest: Rioting citizens caused chaos in the streets.`,
          });
        }
      }
    }
  } else if (currentMoraleThreshold >= 25 && currentMoraleThreshold < 50) {
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
          message: `💰 Troubled times: Widespread tax evasion. ${goldLost.toLocaleString()} gold lost.`,
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
        perSlot * schoolBonus * d.multi * curriculumMult * libraryResearchMult,
      );
      rProgress[d.col] = (rProgress[d.col] || 0) + effective;

      let factor = 1.0;
      if (current > 100) {
        factor = Math.pow(1.05, current - 100);
      }
      const COST_PER_PCT = Math.floor(200 * factor);

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
          message: `📚 ${researchers.toLocaleString()} researchers studying. Est: ${resEstimates.join(", ")}.`,
        });
      } else {
        events.push({
          type: "system",
          message: `📚 ${researchers.toLocaleString()} researchers studying ${focus.join(" & ")}.`,
        });
      }
    }
  } else {
    events.push({
      type: "system",
      message: `📚 No researchers — hire researchers and allocate them to advance your kingdom's knowledge.`,
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
              mageAdvances.push(`Spellbook → ${newSpellVal}%`);
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
              mageAdvances.push(`School Spellbook → ${newSchoolVal}%`);
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
      message: `🚢 Trade Routes generated ${legacyTradeIncome.toLocaleString()} gold.`,
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

  // ── 8d. Shrines — clerics boost morale and prepare to heal ───────────────────
  if (k.race === "vampire") {
    const mausoleumUpdates = processMausoleum({ ...k, ...updates }, events);
    Object.assign(updates, mausoleumUpdates);
  } else {
    const shrineUpdates = processShrine({ ...k, ...updates }, events);
    Object.assign(updates, shrineUpdates);
    // ── 8d-ii. Shrine attunements — fragment special effects ─────────────────
    const shrineAttunementUpdates = processShrineAttunements({ ...k, ...updates }, events);
    Object.assign(updates, shrineAttunementUpdates);
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
  // Human: level 5+ clerics restore 1 morale per turn
  const humanBonus = racialUnitBonus(
    { ...k, troop_levels: updates.troop_levels || k.troop_levels },
    "clerics",
  );
  if (humanBonus.auraHeal && getAvailableUnits(k, "clerics") > 0) {
    const natCap = naturalMoraleCap(k);
    const cur =
      updates.morale !== undefined
        ? updates.morale
        : k.morale !== undefined && k.morale !== null
          ? k.morale
          : 100;
    const oldMorale = cur;
    updates.morale = Math.min(natCap, cur + 1);
    const mDelta = updates.morale - oldMorale;
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
            "💚 Your clerics have reached mastery — Human healing aura now restores +1 morale per turn.",
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
    message: `🏦 End of Turn ${updates.turn} — Net Gold: ${netSign}${netGoldChange.toLocaleString()}. Final Treasury: ${finalGold.toLocaleString()} gold.`,
  });

  updates.last_turn_at = Math.floor(Date.now() / 1000);
  checkAchievements(k, updates, events);

  // ── Morale Audit Report ──────────────────────────────────────────────────────


  // Clean up temporary fields
  delete updates.xp_sources_updated;

  return { updates, events };
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
        "🏆 ACHIEVEMENT UNLOCKED: Grandmaster! Rewarded +10000 Land and +5000 Maps.",
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
      message: "🏆 ACHIEVEMENT UNLOCKED: Founder! You've built your first structure. Rewarded +5000 Gold.",
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
      message: "🏆 ACHIEVEMENT UNLOCKED: Warlord! Rewarded +10000 Land.",
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
      message: "🏆 ACHIEVEMENT UNLOCKED: Colossus! Your empire has swollen to 10 million souls. Rewarded +50000 Land, +100000 Mana, and +1000000 Gold.",
    });
    achUpdated = true;
  }

  const currentGold = updates.gold !== undefined ? updates.gold : k.gold;
  if (!ach.includes("ach_wealthy") && currentGold >= 10000000) {
    ach.push("ach_wealthy");
    events.push({
      type: "system",
      message:
        "🏆 ACHIEVEMENT UNLOCKED: Merchant King! All trade routes now generate +10% income permanently.",
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
        "🏆 ACHIEVEMENT UNLOCKED: Arcane Overlord! Rewarded +10,000 Spellbook and +10,000 Blank Scrolls.",
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
          "🏆 ACHIEVEMENT UNLOCKED: Field Collector (Found all 50 expedition events). All world locations have been revealed!",
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
          "🏆 ACHIEVEMENT UNLOCKED: Historian (Found all library lore). Rewarded +5000 Maps.",
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

const PRESTIGE_MODIFIERS = {
  1: { bldCap: 1.25, econ: 1.05, combat: 1.00, pop: 1.00 },
  2: { bldCap: 1.50, econ: 1.10, combat: 1.00, pop: 1.00 },
  3: { bldCap: 1.75, econ: 1.15, combat: 1.05, pop: 1.00 },
  4: { bldCap: 2.00, econ: 1.20, combat: 1.05, pop: 1.00 },
  5: { bldCap: 2.50, econ: 1.30, combat: 1.10, pop: 1.25 },
};

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
function xpForLevel(level, prestige = 0) {
  const targetLevel = Math.min(level, 500);
  if (targetLevel < 1) return 0;
  const base = config.XP_LEVELS[targetLevel] || 0;
  // Each prestige level requires 20% more XP per level
  const mult = 1.0 + (prestige * 0.2);
  return Math.floor(base * mult);
}

function xpToNextLevel(level, prestige = 0) {
  return xpForLevel(level + 1, prestige) - xpForLevel(level, prestige);
}

// Check all milestone levels passed between oldLevel and newLevel (inclusive).
// Grants one-time resources and accumulates permanent bonuses.
function checkMilestones(k, oldLevel, newLevel) {
  const events = [];
  let goldGrant = 0, landGrant = 0, fightersGrant = 0;
  let researchersGrant = 0, thievesGrant = 0, ninjasGrant = 0;
  let lastTitle = null;

  const claimed = safeJsonParse(k.milestones_claimed, {}, "checkMilestones:claimed");
  const bonuses = safeJsonParse(k.milestone_bonuses, {}, "checkMilestones:bonuses");

  // Step through each multiple of 25 that was passed this turn
  const firstMs = Math.ceil((oldLevel + 1) / 25) * 25;
  for (let lv = firstMs; lv <= newLevel; lv += 25) {
    if (claimed[lv]) continue;
    const ms = MILESTONES[lv];
    if (!ms) continue;

    const reward = ms.rewards[k.race] || ms.rewards.default || {};
    if (reward.bonus) {
      for (const [key, val] of Object.entries(reward.bonus)) {
        bonuses[key] = (bonuses[key] || 0) + val;
      }
    }

    goldGrant      += reward.gold       || 0;
    landGrant      += reward.land       || 0;
    fightersGrant  += reward.fighters   || 0;
    researchersGrant += reward.researchers || 0;
    thievesGrant   += reward.thieves    || 0;
    ninjasGrant    += reward.ninjas     || 0;
    claimed[lv] = true;
    lastTitle = ms.title;

    events.push({
      type: "milestone",
      message: `🏆 Level ${lv} milestone — ${ms.title}! Resources granted.`,
    });
  }

  if (events.length === 0) return { updates: {}, events: [] };

  return {
    updates: {
      goldGrant, landGrant, fightersGrant,
      researchersGrant, thievesGrant, ninjasGrant,
      milestone_bonuses: JSON.stringify(bonuses),
      milestones_claimed: JSON.stringify(claimed),
      ...(lastTitle && { milestone_title: lastTitle }),
    },
    events,
  };
}

// Safe: xpForLevel(1000) = 4,990,005 — well within JS safe integer range
function levelFromXp(totalXp, prestige = 0) {
  let lo = 1,
    hi = 500;  // Changed from 1000 to match max level
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (xpForLevel(mid, prestige) <= totalXp) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function xpRaceBonus(k, activity) {
  const bonuses = XP_RACE_BONUS[k.race] || {};
  const base = bonuses.all || 1.0;
  return Math.max(base, bonuses[activity] || base);
}

// Award XP and check for level up — returns { xp, level, levelled, events, xp_sources }
function awardXp(k, activity, amount) {
  const currentLevel = k.level || 1;

  // Stop XP gain at level 500
  if (currentLevel >= 500) {
    return { xp: k.xp || 0, level: 500, levelled: false, events: [], xp_sources: k.xp_sources || {} };
  }

  const mult = xpRaceBonus(k, activity);
  const earned = (XP_BASE[activity] || 10) * amount * mult;
  const newXp = (k.xp || 0) + earned;
  const prestige = k.prestige_level || 0;
  const newLevel = Math.min(levelFromXp(newXp, prestige), 500);
  const levelled = newLevel > currentLevel;
  const events = [];

  if (levelled && newLevel >= 500) {
    events.push({
      type: "system",
      message: config.STRINGS.LEVEL_500_ACHIEVED,
    });
  } else if (levelled) {
    events.push({
      type: "system",
      message: `🌟 Kingdom reached Level ${newLevel}! (${earned.toLocaleString()} XP earned)`,
    });
  }

  // Track XP by source
  let xpSources = {};
  xpSources = safeJsonParse(k.xp_sources, {}, 'awardXp:xp_sources');
  if (!xpSources[activity]) xpSources[activity] = 0;
  xpSources[activity] += earned;

  return { xp: newXp, level: newLevel, earned, levelled, events, xp_sources: xpSources };
}

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
    console.log(`[queueBuildings] Land calculation for ${k.name}: total=${k.land}, used=${usedLand}, free=${freeLand}, requesting=${totalLand}`);
    if (Object.keys(landBreakdown).length > 0) {
      console.log('[queueBuildings] Breakdown:', JSON.stringify(landBreakdown, null, 2));
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
      finalMsg += `Actively constructing: ${updates._build_estimates.join(" · ")}. `;
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
      finalMsg += `Actively constructing: ${updates._build_estimates.join(" · ")}. `;
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
  // Dwarf racial unique — solo crew at engineer level 5+
  if (race === "dwarf" && engineerLevel >= 5) base = 1;
  return base;
}

function moraleMult(morale) {
  if (morale < 50) return 0.8 + (morale / 50) * 0.1; // 0.80–0.90
  if (morale < 100) return 0.9 + ((morale - 50) / 50) * 0.1; // 0.90–1.00
  return Math.min(1.2, 1.0 + ((morale - 100) / 100) * 0.1); // 1.00–1.20 (capped at 1.20)
}

function happinessCombatMult(happiness) {
  const mult = 0.5 + (happiness / 120);
  return Math.max(0.5, Math.min(1.5, mult));
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
    bullyMsg = "⚠️ Morale suffers — this is slaughter, not war.";
  } else if (bullyRatio >= 2) {
    bullyPenalty = 0.8;
    bullyMsg = "⚠️ Your troops lack motivation fighting a weaker foe.";
  }

  // ── Morale multipliers ────────────────────────────────────────────────────
  const atkMoraleMult = happinessCombatMult(attacker.happiness !== undefined && attacker.happiness !== null ? attacker.happiness : 50);
  const defMoraleMult = happinessCombatMult(defender.happiness !== undefined && defender.happiness !== null ? defender.happiness : 50);

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
    atkMoraleMult *
    bullyPenalty *
    atkWarlordMult *
    atkBloodShamanMult;
  const atkPrestigeMult = (attacker.prestige_level > 0) 
    ? (PRESTIGE_MODIFIERS[Math.min(attacker.prestige_level, 5)]?.combat || 1.0)
    : 1.0;

  const atkMb = safeJsonParse(attacker.milestone_bonuses, {}, "combat:atkMb");
  let atkPower = atkPowerRaw * (1 + (atkMb.attack_pct || 0) / 100) * atkPrestigeMult;

  if (attacker.race === "vampire" && !night) {
    const atkMausUpg = safeJsonParse(attacker.mausoleum_upgrades, {}, "auto:mausoleum_upgrades");
    const atkPenaltyMult = atkMausUpg.night_watch ? 0.2 : 0.1;
    atkPower = Math.floor(atkPowerRaw * atkPenaltyMult);
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
  let defStarCallerMult = 1.0;
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
    if (h.class === "star_caller") defStarCallerMult *= 1.5; // Aegis of Light - magic def
  });

  const defPower =
    (defFighterPower +
      defRangerPower * defPackLeaderMult +
      defMagePower * defMageMult * defStarCallerMult +
      defWmPower * defWmMult +
      defEngBonus +
      (defWallPower + defOutpostPower + defTowerPower + defStructures) *
        defSiegebreakerStructureMult +
      defHeroPower) *
    defMoraleMult *
    defTierMult *
    defWarlordMult *
    defBloodShamanMult;

  const defMb = safeJsonParse(defender.milestone_bonuses, {}, "combat:defMb");
  const defMilestoneMult = 1 + (defMb.defense_pct || 0) / 100;
  
  const defPrestigeMult = (defender.prestige_level > 0)
    ? (PRESTIGE_MODIFIERS[Math.min(defender.prestige_level, 5)]?.combat || 1.0)
    : 1.0;

  const defPowerFinal = defPower * defMilestoneMult * defPrestigeMult;

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

  // ── Step 8: Morale changes & Discovery ───────────────────────────────────
  const victoryMargin = Math.min(2.0, Math.max(0.1, powerRatio));
  let atkMoraleChange, defMoraleChange;
  if (win) {
    atkMoraleChange = Math.floor(5 + Math.min(10, victoryMargin * 5));
    defMoraleChange = -Math.max(
      5,
      Math.floor(Math.min(20, victoryMargin * 10)),
    );
    // Bully shame — attacker loses morale too at high ratios
    if (bullyRatio >= 8) atkMoraleChange -= 15;
    if (bullyRatio >= 4) atkMoraleChange -= 5;
  } else {
    atkMoraleChange = -Math.floor(
      5 + Math.min(15, (1 / Math.max(0.1, powerRatio)) * 8),
    );
    defMoraleChange = Math.floor(
      5 + Math.min(10, (1 / Math.max(0.1, powerRatio)) * 5),
    );
  }
  const MORALE_FLOOR = 0;
  const newAtkMorale = Math.max(
    MORALE_FLOOR,
    Math.min(
      200,
      (attacker.morale !== undefined && attacker.morale !== null
        ? attacker.morale
        : 100) + atkMoraleChange,
    ),
  );
  const newDefMorale = Math.max(
    MORALE_FLOOR,
    Math.min(
      200,
      (defender.morale !== undefined && defender.morale !== null
        ? defender.morale
        : 100) + defMoraleChange,
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
    morale: newAtkMorale,
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
    morale: newDefMorale,
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
    atkMoraleChange,
    defMoraleChange,
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

// ── Magic ─────────────────────────────────────────────────────────────────────

// Scroll crafting requirements: { mages needed, turns to complete }
function castSpell(caster, target, spellId, obscure) {
  const def = SPELL_DEFS[spellId];
  if (!def) return { error: "Unknown spell" };

  // School-specific spells get 15% minSB reduction (incentive for specialization)
  const schoolMinSB = Math.ceil(def.minSB * 0.85);

  // Check if spell can be cast from school spellbook
  let canCastFromSchool = false;
  if (caster.school_of_magic && MAGIC_SCHOOLS[caster.school_of_magic]) {
    const schoolSpells = MAGIC_SCHOOLS[caster.school_of_magic];
    if (schoolSpells.includes(spellId) && (caster.school_spellbook || 0) >= schoolMinSB) {
      canCastFromSchool = true;
    }
  }

  // Check if spell can be cast from general spellbook
  const canCastFromGeneral = (caster.res_spellbook || 0) >= def.minSB;

  // Must be able to cast from at least one source
  if (!canCastFromSchool && !canCastFromGeneral) {
    return {
      error: `Spellbook too low — need ${def.minSB}, have general ${caster.res_spellbook}${caster.school_of_magic ? ` / school ${caster.school_spellbook} (${schoolMinSB} for school spells)` : ""}`,
    };
  }

  // Scroll check — must have a crafted scroll to cast
  let scrolls = {};
  try {
    scrolls = safeJsonParse(caster.scrolls, {}, "auto:scrolls");
  } catch {}
  if ((scrolls[spellId] || 0) < 1)
    return {
      error: `No ${spellId.replace(/_/g, " ")} scroll in your library — craft one first`,
    };

  // Mana cost: base cost scales with tier
  const TIER_MANA = { 1: 500, 2: 2000, 3: 8000, 4: 50000 };
  const baseMana = TIER_MANA[def.tier] || 500;
  const spellLibraryBonus = fragmentBonusManager.getFragmentForBuilding(caster, 'libraries');
  const spellEfficiency = spellLibraryBonus?.passive?.spell_efficiency || 0;
  const adjustedBaseMana = Math.floor(baseMana * (1 - spellEfficiency));
  const obscureCost = obscure ? Math.floor(adjustedBaseMana * 0.5) : 0;
  const totalMana = adjustedBaseMana + obscureCost;
  if ((caster.mana || 0) < totalMana)
    return {
      error: `Not enough mana — need ${totalMana.toLocaleString()}, have ${(caster.mana || 0).toLocaleString()}`,
    };

  // Consume scroll and mana
  scrolls[spellId] = (scrolls[spellId] || 0) - 1;
  if (scrolls[spellId] <= 0) delete scrolls[spellId];
  const casterUpdates = {
    mana: caster.mana - totalMana,
    scrolls: JSON.stringify(scrolls),
  };

  // Attack/defense magic modifiers
  const atkMagic =
    ((caster.res_attack_magic || 100) / 100) * raceBonus(caster, "magic");
  const defMagic =
    ((target.res_defense_magic || 100) / 100) * raceBonus(target, "magic");
  // Shrine fragment: spell_resistance (Abyssal Crystal) bolsters target's magical defense
  const shrineSpellResistMult = fragmentBonusManager.getBonusMultiplier(target, 'shrines', 'spell_resistance');
  const magicRatio = Math.max(0.2, atkMagic / Math.max(0.5, defMagic * shrineSpellResistMult));

  // Check shield active effect on target
  let targetEffects = {};
  try {
    targetEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
  } catch {}
  const shielded =
    (targetEffects.shield ? 0.5 : 1.0) * getMasonSigilResist(target);

  let fortResist = {};
  try {
    fortResist = safeJsonParse(target.fortified_buildings, {}, "auto:fortified_buildings");
  } catch {}

  function getBldDmg(key, baseDmg) {
    let dmg = baseDmg * magicRatio * shielded;
    if (fortResist[key]) dmg *= 0.2; // 80% reduction for fortified
    return Math.floor(dmg);
  }

  const targetUpdates = {};
  let damageDesc = "";
  let activeEffect = null; // { key, turns_left, ...data } to apply to target

  // ── Friendly spells (target = caster or ally) ──────────────────────────
  if (def.effect === "friendly") {
    if (spellId === "mend") {
      // Restore 10% of fighters (simulates healing recent casualties)
      const healed = Math.floor((target.fighters || 0) * 0.1 * magicRatio);
      targetUpdates.fighters = (target.fighters || 0) + healed;
      damageDesc = `${healed.toLocaleString()} fighters restored`;
    } else if (spellId === "dispel") {
      // Clear all active debuffs from target
      let tEffects = {};
      try {
        tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
      } catch {}
      const debuffs = ["fog_of_war", "blight", "silence", "plague"];
      let cleared = 0;
      debuffs.forEach((d) => {
        if (tEffects[d]) {
          delete tEffects[d];
          cleared++;
        }
      });
      targetUpdates.active_effects = JSON.stringify(tEffects);
      damageDesc =
        cleared > 0
          ? `${cleared} active curse${cleared > 1 ? "s" : ""} dispelled`
          : "no active curses to dispel";
    } else if (spellId === "bless") {
      const natCap = naturalMoraleCap(target);
      const moraleGain = Math.floor(natCap * 0.1 * magicRatio);
      targetUpdates.morale = Math.min(
        natCap * 2,
        (target.morale !== undefined && target.morale !== null
          ? target.morale
          : 100) + moraleGain,
      );
      // Apply bless buff for 5 turns
      let tEffects = {};
      try {
        tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
      } catch {}
      tEffects.bless = {
        turns_left: def.duration || 5,
        morale_bonus: moraleGain,
      };
      targetUpdates.active_effects = JSON.stringify(tEffects);
      damageDesc = `+${moraleGain} morale and pop growth boosted for ${def.duration || 5} turns`;
    } else if (spellId === "shield") {
      let tEffects = {};
      try {
        tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
      } catch {}
      tEffects.shield = { turns_left: def.duration || 5 };
      targetUpdates.active_effects = JSON.stringify(tEffects);
      damageDesc = `magic shield active for ${def.duration || 5} turns — incoming spell damage halved`;
    }

    const reportTarget = caster.id === target.id ? "your kingdom" : target.name;
    return {
      casterUpdates,
      targetUpdates,
      report: {
        spellId,
        friendly: true,
        damageDesc,
        manaCost: totalMana,
        obscure,
      },
      casterEvent: `✨ Cast ${spellId.replace(/_/g, " ")} on ${reportTarget} — ${damageDesc}.`,
      targetEvent:
        caster.id !== target.id
          ? `✨ ${caster.name} cast ${spellId.replace(/_/g, " ")} on your kingdom — ${damageDesc}.`
          : null,
    };
  }

  // ── Offensive / debuff spells ─────────────────────────────────────────────

  if (spellId === "spark") {
    // Burns a small number of farms
    const farmsLost = Math.max(1, getBldDmg("farms", 5));
    targetUpdates.bld_farms = Math.max(0, (target.bld_farms || 0) - farmsLost);
    damageDesc = `${farmsLost} farm${farmsLost > 1 ? "s" : ""} burned`;
  } else if (spellId === "rain") {
    // Floods more farms than Spark
    const farmsLost = Math.max(1, getBldDmg("farms", 20));
    targetUpdates.bld_farms = Math.max(0, (target.bld_farms || 0) - farmsLost);
    damageDesc = `${farmsLost} farm${farmsLost > 1 ? "s" : ""} flooded`;
  } else if (spellId === "fog_of_war") {
    // Debuff: blinds rangers for duration turns
    activeEffect = { turns_left: def.duration || 3, type: "fog_of_war" };
    damageDesc = `rangers blinded for ${def.duration || 3} turns`;
  } else if (spellId === "blight") {
    // Debuff: poison food supply for duration turns
    const foodDamage = Math.floor(500 * magicRatio * shielded);
    activeEffect = {
      turns_left: def.duration || 5,
      type: "blight",
      damage: foodDamage,
    };
    damageDesc = `food supply poisoned for ${def.duration || 5} turns (-${foodDamage.toLocaleString()} food/turn)`;
  } else if (spellId === "lightning") {
    // Kills enemy fighters
    const fightersLost = Math.max(
      1,
      Math.floor((target.fighters || 0) * 0.05 * magicRatio * shielded),
    );
    targetUpdates.fighters = Math.max(0, (target.fighters || 0) - fightersLost);
    damageDesc = `${fightersLost.toLocaleString()} fighters struck down`;
  } else if (spellId === "silence") {
    // Debuff: suppresses research for duration turns
    activeEffect = { turns_left: def.duration || 3, type: "silence" };
    damageDesc = `research suppressed for ${def.duration || 3} turns`;
  } else if (spellId === "amnesia") {
    let hasLockbox = false;
    let targetHBP = {};
    try {
      targetHBP = safeJsonParse(target.hybrid_blueprints, {}, "auto:target.hybrid_blueprints");
    } catch {}
    for (const key in targetHBP) {
      if (
        targetHBP[key].assigned &&
        targetHBP[key].building === "libraries" &&
        targetHBP[key].fragment === "Dwarven Star-Metal"
      ) {
        hasLockbox = true;
        break;
      }
    }
    
    if (hasLockbox) {
      damageDesc = `spell failed — target's Impenetrable Lockbox grants immunity to amnesia`;
    } else {
      // Permanently wipes economy research
      const resLost = Math.max(1, Math.floor(15 * magicRatio * shielded));
      targetUpdates.res_economy = Math.max(
        0,
        (target.res_economy || 0) - resLost,
      );
      damageDesc = `economy research reduced by ${resLost}%`;
    }
  } else if (spellId === "drain") {
    // Siphons mana from target to caster
    const manaDrained = Math.max(
      10,
      Math.floor((target.mana || 0) * 0.15 * magicRatio * shielded),
    );
    targetUpdates.mana = Math.max(0, (target.mana || 0) - manaDrained);
    casterUpdates.mana =
      (casterUpdates.mana || caster.mana - totalMana) + manaDrained;
    damageDesc = `${manaDrained.toLocaleString()} mana drained`;
  } else if (spellId === "plague") {
    // Debuff: kills population each turn for duration
    activeEffect = { turns_left: def.duration || 5, type: "plague" };
    damageDesc = `plague spreading — population will die each turn for ${def.duration || 5} turns`;
  } else if (spellId === "earthquake") {
    // Destroys buildings across all types
    const fDmg = Math.max(1, getBldDmg("farms", 12)); // 8 * 1.5
    const bDmg = Math.max(1, getBldDmg("barracks", 8));
    const gDmg = Math.max(1, getBldDmg("guard_towers", 8));
    const mDmg = Math.max(1, Math.floor(getBldDmg("markets", 8) * 0.5));
    const cDmg = Math.max(1, Math.floor(getBldDmg("castles", 8) * 0.1));
    targetUpdates.bld_farms = Math.max(0, (target.bld_farms || 0) - fDmg);
    targetUpdates.bld_barracks = Math.max(0, (target.bld_barracks || 0) - bDmg);
    targetUpdates.bld_guard_towers = Math.max(
      0,
      (target.bld_guard_towers || 0) - gDmg,
    );
    targetUpdates.bld_markets = Math.max(0, (target.bld_markets || 0) - mDmg);
    targetUpdates.bld_castles = Math.max(0, (target.bld_castles || 0) - cDmg);
    damageDesc = `buildings destroyed across the kingdom (farms, barracks, towers)`;
  } else if (spellId === "tempest") {
    // Kills all troop types
    const troopKill = Math.max(
      1,
      Math.floor((target.fighters || 0) * 0.08 * magicRatio * shielded),
    );
    const rangerKill = Math.max(
      0,
      Math.floor((target.rangers || 0) * 0.06 * magicRatio * shielded),
    );
    const clericKill = Math.max(
      0,
      Math.floor((target.clerics || 0) * 0.06 * magicRatio * shielded),
    );
    targetUpdates.fighters = Math.max(0, (target.fighters || 0) - troopKill);
    targetUpdates.rangers = Math.max(0, (target.rangers || 0) - rangerKill);
    targetUpdates.clerics = Math.max(0, (target.clerics || 0) - clericKill);
    damageDesc = `${troopKill.toLocaleString()} fighters, ${rangerKill.toLocaleString()} rangers, ${clericKill.toLocaleString()} clerics killed`;
  } else if (spellId === "armageddon") {
    // Catastrophic — land, buildings, population
    const landLost = Math.floor(
      (target.land || 0) * 0.2 * magicRatio * shielded,
    );
    const popLost = Math.floor(
      (target.population || 0) * 0.25 * magicRatio * shielded,
    );
    const farmLost =
      Math.floor((target.bld_farms || 0) * 0.3) > 0
        ? getBldDmg("farms", (target.bld_farms || 0) * 0.3)
        : 0;
    const fightLost = Math.floor(
      (target.fighters || 0) * 0.2 * magicRatio * shielded,
    );
    targetUpdates.land = Math.max(0, (target.land || 0) - landLost);
    targetUpdates.population = Math.max(0, (target.population || 0) - popLost);
    targetUpdates.bld_farms = Math.max(0, (target.bld_farms || 0) - farmLost);
    targetUpdates.fighters = Math.max(0, (target.fighters || 0) - fightLost);
    damageDesc = `ARMAGEDDON — ${landLost.toLocaleString()} acres scorched, ${popLost.toLocaleString()} killed, ${farmLost.toLocaleString()} farms razed, ${fightLost.toLocaleString()} fighters slain`;
  }

  // Apply active effect to target if this is a debuff spell
  if (activeEffect) {
    targetEffects[spellId] = activeEffect;
    targetUpdates.active_effects = JSON.stringify(targetEffects);
  }

  const targetEvent = obscure
    ? `⚡ A mysterious ${spellId.replace(/_/g, " ")} spell struck your kingdom — ${damageDesc}.`
    : `⚡ ${caster.name} cast ${spellId.replace(/_/g, " ")} on your kingdom — ${damageDesc}.`;

  const casterEvent = `✨ You cast ${spellId.replace(/_/g, " ")} on ${target.name}. Effect: ${damageDesc}.`;

  // Discovery logic: Target discovers caster if not obscured
  if (!obscure) {
    let targetDisc = {};
    try {
      targetDisc = safeJsonParse(target.discovered_kingdoms, {}, "auto:discovered_kingdoms");
    } catch {}
    if (!targetDisc[caster.id]) {
      targetDisc[caster.id] = { found: true };
      targetUpdates.discovered_kingdoms = JSON.stringify(targetDisc);
    }
  }

  return {
    casterUpdates,
    targetUpdates,
    report: {
      spellId,
      damageDesc,
      manaCost: totalMana,
      obscure,
      magicRatio: Math.round(magicRatio * 100),
    },
    casterEvent,
    targetEvent,
  };
}

// ── Covert ops ────────────────────────────────────────────────────────────────

function covertSpy(spy, target, unitsSent) {
  let thiefLvMult = unitLevelMult(spy, "thieves");
  if (spy.race === "vampire" && isNight()) thiefLvMult *= 1.5;
  const stealthMulti = raceBonus(spy, "stealth") * thiefLvMult;

  let targetThiefLvMult = unitLevelMult(target, "thieves");
  if (target.race === "vampire" && isNight()) targetThiefLvMult *= 1.5;
  const targetStealthMulti = raceBonus(target, "stealth") * targetThiefLvMult;

  const spyMb = safeJsonParse(spy.milestone_bonuses, {}, "covertSpy:mb");
  const spyMilestoneMult = 1 + (spyMb.covert_pct || 0) / 100;
  const atkPower = unitsSent * stealthMulti * spyMilestoneMult;
  const defPower =
    (target.thieves || 0) * targetStealthMulti +
    (target.bld_guard_towers || 0) * 5 +
    1;

  const ratio = atkPower / defPower;

  if (ratio <= 1.0) {
    const failSeverity = 1 - Math.max(0, ratio);
    const catchRate = Math.min(0.25, Math.max(0.01, failSeverity * 0.25));
    const caught = Math.floor(unitsSent * catchRate);

    const wittyResponses = [
      "Your thieves tripped over their own cloaks.",
      "The enemy thieves were expecting you. A complete trap.",
      "A complete disaster! Your thieves forgot to whisper.",
      "They walked right through the front gate... and straight into the dungeon.",
      "Turns out, dressing as a bush doesn't work inside a castle.",
    ];
    let witty =
      wittyResponses[Math.floor(Math.random() * wittyResponses.length)];

    return {
      success: false,
      spyUpdates: { thieves: Math.max(0, (spy.thieves || 0) - caught) },
      targetUpdates: {},
      spyEvent: `Spy mission on ${target.name} failed — ${caught} thieves caught. ${witty}`,
      targetEvent: `${spy.name} attempted to spy on you — caught ${caught} thieves!`,
    };
  }

  let tier = 1;
  let noiseLevel = 0.3;
  if (ratio > 2.5) {
    tier = 3;
    noiseLevel = 0.15;
  } else if (ratio > 1.5) {
    tier = 2;
    noiseLevel = 0.25;
  }

  function noise(n) {
    if (n === undefined || n === null) return 0;
    const adjust = 1 + (Math.random() * 2 - 1) * noiseLevel;
    return Math.max(0, Math.floor(n * adjust));
  }

  const report = {};
  report.tier = tier;
  report.name = target.name;
  report.race = target.race;

  if (tier >= 1) {
    report.fighters = noise(target.fighters);
    report.rangers = noise(target.rangers);
  }

  if (tier >= 2) {
    report.mages = noise(target.mages);
    report.clerics = noise(target.clerics);
    report.thieves = noise(target.thieves);
    report.ninjas = noise(target.ninjas);
    report.engineers = noise(target.engineers);
    report.scribes = noise(target.scribes);
    report.researchers = noise(target.researchers);
    report.gold = noise(target.gold);
    report.food = noise(target.food);
    report.land = noise(target.land);
  }

  if (tier >= 3) {
    report.war_machines = noise(target.war_machines);
    const bldCols = [
      "bld_farm",
      "bld_barracks",
      "bld_housing",
      "bld_tavern",
      "bld_market",
      "bld_smithy",
      "bld_library",
      "bld_school",
      "bld_mage_tower",
      "bld_shrine",
      "bld_vault",
      "bld_mausoleum",
      "bld_walls",
      "bld_outpost",
      "bld_guard_towers",
      "bld_castle",
    ];
    for (const c of bldCols) {
      report[c] = noise(target[c]);
    }
  }

  const tXp = awardTroopXp(spy, "thieves", tier * 8 + 4);

  let targetEvent = null;
  if (tier === 1 && Math.random() < 0.5) {
    targetEvent = `Rumors suggest spies from ${spy.name} were scouting your borders.`;
  }

  return {
    success: true,
    report,
    spyUpdates: { troop_levels: tXp.troop_levels },
    targetUpdates: {},
    spyEvent: `Spy report on ${target.name} retrieved! (Tier ${tier} Intel)`,
    targetEvent,
  };
}

function covertLoot(thief, target, requestedLootType, thievesSent) {
  if (thievesSent > thief.thieves) return { error: "Not enough thieves" };
  let thiefLvMult = unitLevelMult(thief, "thieves");
  if (thief.race === "vampire" && isNight()) thiefLvMult *= 1.5;
  const lootMb = safeJsonParse(thief.milestone_bonuses, {}, "covertLoot:mb");
  const lootMilestoneMult = 1 + (lootMb.covert_pct || 0) / 100;
  const stealthMulti = raceBonus(thief, "stealth") * thiefLvMult * lootMilestoneMult;
  const success =
    thief.thieves * stealthMulti >
    target.fighters * 0.015 +
      target.bld_guard_towers * 3 +
      target.bld_armories * 10 +
      target.bld_vaults * 10;
  if (!success) {
    return {
      success: false,
      thiefUpdates: { thieves: thief.thieves - Math.floor(thievesSent * 0.25) },
      targetUpdates: {},
      thiefEvent: `Loot attempt on ${target.name} failed. Thieves captured.`,
      targetEvent: `Thieves were caught attempting to loot your kingdom.`,
    };
  }

  const RESEARCH_TYPES = ["res_economy", "res_weapons", "res_armor", "res_military", "res_spellbook", "res_attack_magic", "res_defense_magic", "res_entertainment", "res_construction", "res_war_machines"];
  const RESOURCE_TYPES = ["wood", "stone", "iron"];

  // Normalize: if a specific sub-type was passed directly, map it to its parent category
  let lootType = requestedLootType;
  let actualLootType = lootType;
  if (RESEARCH_TYPES.includes(lootType)) {
    actualLootType = lootType;
    lootType = "research";
  } else if (RESOURCE_TYPES.includes(lootType)) {
    actualLootType = lootType;
    lootType = "resources";
  } else if (!lootType || lootType === "random") {
    const lootCategories = ["gold", "food", "war_machines", "maps", "blueprints", "hammers", "research", "resources", "trade_routes"];
    lootType = lootCategories[Math.floor(Math.random() * lootCategories.length)];
    actualLootType = lootType;
  }

  // For grouped categories, randomly select the specific sub-type
  if (lootType === "research" && actualLootType === "research") {
    actualLootType = RESEARCH_TYPES[Math.floor(Math.random() * RESEARCH_TYPES.length)];
  } else if (lootType === "resources" && actualLootType === "resources") {
    actualLootType = RESOURCE_TYPES[Math.floor(Math.random() * RESOURCE_TYPES.length)];
  }

  const targetUpdates = {};
  let stolen = 0,
    desc = "";

  // Shrine fragment: Draconic Sanctuary (Dragon Scale) — raid_protection reduces all loot by passive amount
  const shrineRaidProtection = fragmentBonusManager.getBonusMultiplier(target, 'shrines', 'raid_protection') - 1.0;

  const bankUpgrades = safeJsonParse(
    target.bank_upgrades,
    {},
    "covertLoot:bank_upgrades",
  );
  let goldFloor = 0;
  if (bankUpgrades.iron_treasury) {
    goldFloor = Math.floor(target.gold * 0.25);
  }

  // Level scales loot amount
  if (actualLootType === "gold") {
    stolen = Math.floor(thievesSent * (50 + Math.random() * 50) * thiefLvMult);
    stolen = Math.min(stolen, Math.floor(target.gold * 0.05));

    // Dwarven Star-Metal vaults prevent the treasury from being looted
    const vaultFragment = fragmentBonusManager.getFragmentForBuilding(target, 'vaults');
    if (vaultFragment && vaultFragment.fragment === 'Dwarven Star-Metal') {
      stolen = 0;
      desc = `0 gold — protected by Star-Metal gear locks`;
    } else {
      // Protect gold
      if (target.gold - stolen < goldFloor) {
        stolen = target.gold - goldFloor;
        if (stolen < 0) stolen = 0;
      }

      targetUpdates.gold = target.gold - stolen;
      desc = `${stolen.toLocaleString()} gold`;
    }
  } else if (actualLootType === "war_machines") {
    stolen = Math.floor(thievesSent * 0.01 * thiefLvMult);
    stolen = Math.min(stolen, target.war_machines || 0);
    targetUpdates.war_machines = Math.max(0, target.war_machines - stolen);
    desc = `${stolen} war machine(s)`;
  } else if (actualLootType === "food") {
    stolen = Math.floor(
      thievesSent * (100 + Math.random() * 100) * thiefLvMult,
    );
    stolen = Math.min(stolen, Math.floor(target.food * 0.1));

    // Dragon Scale granaries block 100% of food theft
    const granaryFragment = fragmentBonusManager.getFragmentForBuilding(target, 'granaries');
    if (granaryFragment && granaryFragment.fragment === 'Dragon Scale') {
      stolen = 0;
      desc = `0 food — protected by draconic scales`;
    } else {
      targetUpdates.food = Math.max(0, target.food - stolen);
      desc = `${stolen.toLocaleString()} food`;
    }
  } else if (actualLootType === "maps") {
    const targetFragment = fragmentBonusManager.getFragmentForBuilding(target, 'libraries');
    const hasProtection = targetFragment && (targetFragment.fragment === 'Dwarven Star-Metal' || targetFragment.fragment === 'Dragon Scale');

    if (hasProtection) {
      stolen = 0;
      desc = `0 map(s) — protected by ancient magic`;
    } else {
      stolen = Math.floor(thievesSent * 0.05 * thiefLvMult);
      stolen = Math.min(stolen, target.maps || 0);
      targetUpdates.maps = (target.maps || 0) - stolen;
      desc = `${stolen} map(s)`;
    }
  } else if (actualLootType === "blueprints") {
    stolen = Math.floor(thievesSent * 0.01 * thiefLvMult);
    stolen = Math.min(stolen, target.blueprints_stored || 0);

    // Dwarven Star-Metal mausoleums protect blueprints from theft
    const mausoleumFragment = fragmentBonusManager.getFragmentForBuilding(target, 'mausoleums');
    if (mausoleumFragment && mausoleumFragment.fragment === 'Dwarven Star-Metal') {
      stolen = 0;
      desc = `0 blueprint(s) — protected by Star-Metal safeguards`;
    } else {
      targetUpdates.blueprints_stored = (target.blueprints_stored || 0) - stolen;
      desc = `${stolen} blueprint(s)`;
    }
  } else if (actualLootType === "hammers") {
    stolen = Math.floor(thievesSent * 0.05 * thiefLvMult);
    stolen = Math.min(stolen, target.hammers_stored || 0);
    targetUpdates.hammers_stored = (target.hammers_stored || 0) - stolen;
    desc = `${stolen} hammer(s)`;
  } else if (lootType === "research") {
    stolen = Math.floor(thievesSent * 0.2 * thiefLvMult);
    stolen = Math.min(stolen, target[actualLootType] || 0);
    const resName = actualLootType.replace("res_", "").replace(/_/g, " ");
    targetUpdates[actualLootType] = Math.max(0, (target[actualLootType] || 0) - stolen);
    desc = `${stolen} ${resName} research points`;
  } else if (lootType === "resources") {
    stolen = Math.floor(thievesSent * (30 + Math.random() * 30) * thiefLvMult);
    stolen = Math.min(stolen, Math.floor((target[actualLootType] || 0) * 0.1));
    targetUpdates[actualLootType] = Math.max(0, (target[actualLootType] || 0) - stolen);
    desc = `${stolen.toLocaleString()} ${actualLootType}`;
  } else if (actualLootType === "trade_routes") {
    stolen = Math.floor(thievesSent * 0.02 * thiefLvMult);
    stolen = Math.min(stolen, target.trade_routes || 0);
    targetUpdates.trade_routes = Math.max(0, (target.trade_routes || 0) - stolen);
    desc = `${stolen} trade route(s)`;
  }

  // Shrine fragment: Draconic Sanctuary (Dragon Scale) raid_protection — reduce all stolen amounts
  if (shrineRaidProtection > 0.001 && stolen > 0) {
    const keepFraction = Math.max(0, 1.0 - shrineRaidProtection);
    const reducedStolen = Math.floor(stolen * keepFraction);
    // Walk targetUpdates and restore the difference to target's resource
    for (const key of Object.keys(targetUpdates)) {
      const originalVal = target[key] !== undefined ? target[key] : 0;
      const originalLoss = originalVal - (targetUpdates[key] || 0);
      if (originalLoss > 0) {
        const reducedLoss = Math.floor(originalLoss * keepFraction);
        targetUpdates[key] = Math.min(originalVal, originalVal - reducedLoss);
      }
    }
    stolen = reducedStolen;
    if (shrineRaidProtection > 0 && desc) {
      desc += ` (reduced by Draconic Sanctuary)`;
    }
  }

  const tXp = awardTroopXp(thief, "thieves", 20);
  return {
    success: true,
    stolen,
    lootType,
    actualLootType,
    thiefUpdates: { troop_levels: tXp.troop_levels },
    targetUpdates,
    thiefEvent: `Looted ${desc} from ${target.name}.`,
    targetEvent: `Thieves infiltrated your kingdom and stole ${desc}.`,
  };
}

const ASSASSINATE_TARGETS = new Set([
  "fighters", "rangers", "clerics", "mages", "thieves", "ninjas",
  "researchers", "engineers", "scribes", "thralls",
]);

function covertAssassinate(assassin, target, ninjasSent, unitType) {
  if (ninjasSent > assassin.ninjas) return { error: "Not enough ninjas" };
  if (!ASSASSINATE_TARGETS.has(unitType)) return { error: "Invalid unit type" };
  let ninjaLvMult = unitLevelMult(assassin, "ninjas");
  if (assassin.race === "vampire") ninjaLvMult *= 1.1;
  const assMb = safeJsonParse(assassin.milestone_bonuses, {}, "covertAssassinate:mb");
  const assMilestoneMult = 1 + (assMb.covert_pct || 0) / 100;
  const stealthMulti = raceBonus(assassin, "stealth") * ninjaLvMult * assMilestoneMult;
  const success =
    assassin.ninjas * stealthMulti * 1.2 >
    target[unitType] * 0.01 + target.bld_guard_towers * 2;

  if (!success) {
    return {
      success: false,
      assassinUpdates: {
        ninjas: assassin.ninjas - Math.floor(ninjasSent * 0.2),
      },
      targetUpdates: {},
      assassinEvent: `Assassination of ${unitType} in ${target.name} failed. Ninjas compromised.`,
      targetEvent: `Enemy ninjas were caught attempting to assassinate your ${unitType}!`,
    };
  }

  const killed = Math.floor(
    ninjasSent * (10 + Math.random() * 10) * ninjaLvMult,
  );
  const targetUpdates = { [unitType]: Math.max(0, target[unitType] - killed) };

  // Vampire racial bonus
  let vampireBonusStr = "";
  const assassinUpdates = {
    ninjas: assassin.ninjas,
  };
  if (assassin.race === "vampire") {
    // 50% chance to acquire troops as thralls instead of just assassinating them
    if (Math.random() < 0.5) {
      const thrallsGained = Math.floor(killed * 0.25);
      if (thrallsGained > 0) {
        const cap = (assassin.bld_mausoleums || 0) * 100;
        const current = assassin.thralls || 0;
        const added = Math.min(thrallsGained, Math.max(0, cap - current));
        if (added > 0) {
          assassinUpdates.thralls = current + added;
          vampireBonusStr = ` (Vampiric Bite converted ${added} into Thralls)`;
        }
      }
    }
  }

  // Dark Elf racial bonus: level 5+ ninjas leave no trace
  const darkElfBonus = racialUnitBonus(assassin, "ninjas");
  const silent = darkElfBonus.silentAssassination;

  const nXp = awardTroopXp(assassin, "ninjas", 30);
  Object.assign(assassinUpdates, { troop_levels: nXp.troop_levels });

  return {
    success: true,
    killed,
    silent,
    assassinUpdates,
    targetUpdates,
    assassinEvent: `Assassinated ${killed.toLocaleString()} ${unitType} in ${target.name}.${silent ? " No trace left." : ""}${vampireBonusStr}`,
    targetEvent: silent
      ? null
      : `${assassin.name}'s ninjas assassinated ${killed.toLocaleString()} of your ${unitType}.`,
  };
}

function covertSabotage(assassin, target, ninjasSent, bldType) {
  if (ninjasSent > assassin.ninjas) return { error: "Not enough ninjas" };

  const BLD_MAP = {
    farms: "bld_farms",
    granaries: "bld_granaries",
    smithies: "bld_smithies",
    mage_towers: "bld_mage_towers",
    barracks: "bld_barracks",
    libraries: "bld_libraries",
    schools: "bld_schools",
    armories: "bld_armories",
    housing: "bld_housing",
    markets: "bld_markets",
    shrines: "bld_shrines",
    outposts: "bld_outposts",
    training: "bld_training",
    guard_towers: "bld_guard_towers",
    vaults: "bld_vaults",
    castles: "bld_castles",
    taverns: "bld_taverns",
    mausoleums: "bld_mausoleums",
    walls: "bld_walls",
    war_machines: "war_machines",
  };
  const col = BLD_MAP[bldType];
  if (!col) return { error: "Invalid building type" };

  let ninjaLvMult = unitLevelMult(assassin, "ninjas");
  if (assassin.race === "vampire") ninjaLvMult *= 1.1;
  const stealthMulti = raceBonus(assassin, "stealth") * ninjaLvMult;

  const success =
    assassin.ninjas * stealthMulti * 1.2 >
    (target.thieves || 0) * 0.015 + (target.bld_guard_towers || 0) * (2 + (target.thieves || 0) * 0.001);

  if (!success) {
    const ninjasLost = Math.floor(ninjasSent * 0.2);
    return {
      success: false,
      ninjasLost,
      assassinUpdates: { ninjas: assassin.ninjas - ninjasLost },
      targetUpdates: {},
      assassinEvent: `Sabotage of ${bldType} in ${target.name} failed. Ninjas compromised.`,
      targetEvent: `Enemy ninjas were caught attempting to sabotage your buildings!`,
    };
  }

  const destroyed = Math.floor(
    ninjasSent * (3 + Math.random() * 4) * ninjaLvMult,
  );
  const actualDestroyed = Math.min(target[col] || 0, destroyed);
  const targetUpdates = { [col]: (target[col] || 0) - actualDestroyed };

  const nXp = awardTroopXp(assassin, "ninjas", 40);
  const assassinUpdates = {
    ninjas: assassin.ninjas,
    troop_levels: nXp.troop_levels,
  };

  // Dark Elf racial bonus: silent sabotage
  const darkElfBonus = racialUnitBonus(assassin, "ninjas");
  const silent = darkElfBonus.silentAssassination;

  return {
    success: true,
    destroyed: actualDestroyed,
    silent,
    assassinUpdates,
    targetUpdates,
    assassinEvent: `Sabotaged ${actualDestroyed.toLocaleString()} ${bldType.replace(/_/g, " ")} in ${target.name}.${silent ? " No trace left." : ""}`,
    targetEvent: silent
      ? null
      : `${assassin.name}'s ninjas sabotaged ${actualDestroyed.toLocaleString()} of your ${bldType.replace(/_/g, " ")}.`,
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
      rewards.push({ text: `🪵 +${deepWood} wood and 🪨 +${deepStone} stone unearthed` });
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
        text: `A research scroll found — ${discLabel} +${boost}%`,
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
        text: `Ruins of an abandoned kingdom found — you claim ${bonus} acres of its former territory`,
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
          rewards.push({ text: `✨✨✨ ULTRA RARE: ${prize.text}` });

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
    rewards.push({ text: `✨✨✨ ULTRA RARE: ${prize.text}` });

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

  return { rewards, updates, events };
}

async function resolveExpeditions(db, k, engine) {
  // Pick up active ones AND unclaimed ones (turns_left=0 but rewards_claimed=0)
  const exps = await db.all(
    "SELECT * FROM expeditions WHERE kingdom_id = ? AND (turns_left > 0 OR (turns_left = 0 AND rewards_claimed = 0))",
    [k.id],
  );
  console.log(
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
      console.log(
        `[expedition] kingdom=${k.id} id=${exp.id} type=${exp.type} turns_left=${exp.turns_left} → ${newTurns}`,
      );

      if (newTurns > 0) {
        tickDowns.push({ id: exp.id, newTurns });
        expsByState[exp.id] = { ...exp, turns_left: newTurns, mustProcess: false };
      } else {
        completions.push(exp.id);
        expsByState[exp.id] = { ...exp, turns_left: 0, mustProcess: true };
        console.log(`[expedition] COMPLETING kingdom=${k.id} id=${exp.id} type=${exp.type}`);
      }
    } else {
      retries.push(exp.id);
      expsByState[exp.id] = { ...exp, mustProcess: true };
      console.log(`[expedition] RETRYING completion for kingdom=${k.id} id=${exp.id} type=${exp.type}`);
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
    console.log(`[expedition] Batched ${result.changes} turn decrements in single UPDATE`);
  }

  // Batch update: all completions in one statement
  if (completions.length > 0) {
    const placeholders = completions.map(() => "?").join(",");
    const markResult = await db.run(
      `UPDATE expeditions SET turns_left = 0, rewards_claimed = 1 WHERE id IN (${placeholders}) AND rewards_claimed = 0`,
      completions,
    );
    console.log(`[expedition] Batched completion claim: ${markResult.changes} expeditions marked complete`);
  }

  // Batch update: all retry claims in one statement
  if (retries.length > 0) {
    const placeholders = retries.map(() => "?").join(",");
    const claimResult = await db.run(
      `UPDATE expeditions SET rewards_claimed = 1 WHERE id IN (${placeholders}) AND rewards_claimed = 0`,
      retries,
    );
    console.log(`[expedition] Batched retry claim: ${claimResult.changes} expeditions claimed`);
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
            message: `👑 ${freshK.name} has found the Throne of Nazdreg Grishnak. May his memory endure forever.`,
          });
          updates._server_announce = `👑 The Throne of Nazdreg Grishnak has been found by ${freshK.name}. His name is remembered.`;
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
              text: `🔭 Your rangers discovered the kingdom of ${other.name}!`,
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
          text: `🔮 Your rangers recovered a World Fragment: ${frag}`,
        });
        events.push({
          type: "system",
          message: `🔮 A World Fragment (${frag}) was discovered during the expedition.`,
        });
      }

      if (updates._suspicious_rocks_achievement) {
        delete updates._suspicious_rocks_achievement;
        rewards.unshift({
          text: `🏆 ACHIEVEMENT UNLOCKED: Found 100 mysterious rocks! +1000 stone awarded.`,
        });
        events.push({
          type: "system",
          message: `🏆 ACHIEVEMENT: ${freshK.name} collected 100 mysterious rocks and was rewarded with 1000 stone!`,
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
        "morale",
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
          text: "🏆 ACHIEVEMENT UNLOCKED: " + updates._achievement_unlocked,
        });
        events.push({
          type: "system",
          message: "🏆 ACHIEVEMENT UNLOCKED: " + updates._achievement_unlocked,
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
      const completionMsg = `${label} expedition returned — check the Explore tab for rewards.`;
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
      const errMsg = `${exp.type} expedition returned — an error occurred calculating rewards (troops returned safely).`;
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
function processMageTower(k, events) {
  const updates = {};
  const towers = k.bld_mage_towers;
  if (towers === 0) return updates;

  let alloc = {};
  try {
    alloc = safeJsonParse(k.mage_tower_allocation, {}, "auto:mage_tower_allocation");
  } catch {
    alloc = {};
  }
  let progress = {};
  try {
    progress = safeJsonParse(k.tower_progress, {}, "auto:tower_progress");
  } catch {
    progress = {};
  }
  let scrolls = {};
  try {
    scrolls = safeJsonParse(k.scrolls, {}, "auto:scrolls");
  } catch {
    scrolls = {};
  }

  // Fallback for old schema
  if (alloc.scroll_craft) {
    alloc[alloc.scroll_craft] = alloc.scroll_target || 999;
    delete alloc.scroll_craft;
    delete alloc.scroll_target;
  }

  const capacity = towers * 20;
  const effectiveMages = Math.min(getAvailableUnits(k, "mages"), capacity);
  const mageLvlMult = unitLevelMult(k, "mages");
  const raceMagic = raceBonus(k, "magic");

  let towerUpgrades = {};
  try {
    towerUpgrades = safeJsonParse(k.tower_upgrades, {}, "auto:tower_upgrades");
  } catch {}
  const towerSpeedMult = towerUpgrades.ley_line_tap ? 1.25 : 1.0;

  let activeTasks = Object.keys(alloc).filter(
    (t) => alloc[t] > 0 && SCROLL_REQUIREMENTS[t],
  );

  if (effectiveMages > 0 && activeTasks.length > 0) {
    let magesPerTask = effectiveMages / activeTasks.length;
    let completedAny = false;

    activeTasks.forEach((task) => {
      const req = SCROLL_REQUIREMENTS[task];
      const effective = magesPerTask;
      const progKey = "scroll_" + task;
      const workDone =
        (effective / req.mages) * mageLvlMult * towerSpeedMult * raceMagic;
      let newProg = (progress[progKey] || 0) + workDone;

      while (newProg >= req.turns && alloc[task] > 0) {
        if (task !== "blank_scroll") {
          if ((scrolls.blank_scroll || 0) < 1) {
            newProg = req.turns - 0.01;
            break; // stall
          }
          scrolls.blank_scroll -= 1;
        }

        alloc[task] -= 1;
        newProg -= req.turns;

        const helfBonus = racialUnitBonus(k, "mages");
        const scrollsProduced = helfBonus.doubleScrolls ? 2 : 1;
        scrolls[task] = (scrolls[task] || 0) + scrollsProduced;
        updates.scrolls = JSON.stringify(scrolls);

        updates._craftedScrolls = updates._craftedScrolls || {};
        updates._craftedScrolls[task] =
          (updates._craftedScrolls[task] || 0) + scrollsProduced;
        if (helfBonus.doubleScrolls) updates._helfBonusApplied = true;

        completedAny = true;

        const mXp = awardTroopXp(
          { ...k, troop_levels: updates.troop_levels || k.troop_levels },
          "mages",
          20,
        );
        updates.troop_levels = mXp.troop_levels;
      }

      if (alloc[task] <= 0) delete alloc[task];
      progress[progKey] = alloc[task] > 0 ? newProg : 0;

      if (workDone > 0 && alloc[task] > 0) {
        if (!updates._mage_estimates) updates._mage_estimates = [];
        const pct = Math.floor(((progress[progKey] || 0) / req.turns) * 100);
        const turnsLeft = Math.ceil(
          (req.turns - (progress[progKey] || 0)) / workDone,
        );
        const displayTask =
          task === "blank_scroll"
            ? "Blank scroll"
            : task.replace(/_/g, " ") + " scroll";
        updates._mage_estimates.push(
          `${displayTask} (${pct}%, ${turnsLeft} turns left)`,
        );
      }
    });

    if (updates._craftedScrolls) {
      let msgParts = [];
      for (const [task, count] of Object.entries(updates._craftedScrolls)) {
        const displayTask =
          task === "blank_scroll" ? "Blank" : task.replace(/_/g, " ");
        msgParts.push(`${count}x ${displayTask}`);
      }
      const str = msgParts.join(", ");
      const bonusMsg = updates._helfBonusApplied
        ? " (High Elf mastery — double scrolls produced!)"
        : "";
      const totalScrolls = Object.values(updates._craftedScrolls).reduce(
        (a, b) => a + b,
        0,
      );
      events.push({
        type: "system",
        message: `✨ The Mage Tower has completed: ${str} scroll${totalScrolls > 1 ? "s" : ""}.${bonusMsg}`,
      });
      delete updates._craftedScrolls;
      delete updates._helfBonusApplied;
    }

    if (updates._mage_estimates && updates._mage_estimates.length > 0) {
      events.push({
        type: "system",
        message: `📜 Mage Tower Est: ${updates._mage_estimates.join(" · ")}.`,
      });
      delete updates._mage_estimates;
    }

    if (completedAny) {
      updates.mage_tower_allocation = JSON.stringify(alloc);
    }
  }

  updates.tower_progress = JSON.stringify(progress);
  return updates;
}

// ── Shrine — clerics boost morale and prepare healing ────────────────────────
function processShrine(k, _events) {
  const updates = {};
  const shrines = k.bld_shrines;
  if (shrines === 0) return updates;

  const shrinePowerMult = fragmentBonusManager.getBonusMultiplier(k, 'shrines', 'power');
  const shrineHealingMult = fragmentBonusManager.getBonusMultiplier(k, 'shrines', 'healing');
  const shrineCapacityMult = fragmentBonusManager.getBonusMultiplier(k, 'shrines', 'capacity');
  const capacity = Math.floor(shrines * 15 * shrinePowerMult * shrineHealingMult * shrineCapacityMult);
  const effectiveClerics = Math.min(getAvailableUnits(k, "clerics"), capacity);

  // Cleric XP for praying
  if (effectiveClerics > 0) {
    const clericEfficacyMult = fragmentBonusManager.getBonusMultiplier(k, 'shrines', 'cleric_efficacy');
    const mindStabilityMod = fragmentBonusManager.getBonusMultiplier(k, 'shrines', 'mind_stability');
    const clericXp = Math.max(1, Math.floor(effectiveClerics / 5 * clericEfficacyMult * mindStabilityMod));
    const resClerics = awardUnitXp({ ...k, ...updates }, "clerics", clericXp);
    if (resClerics) {
      updates.troop_levels = resClerics;
    }
  }

  return updates;
}

// ── Shrine attunements — per-turn fragment special effects ───────────────────
function processShrineAttunements(k, events) {
  const updates = {};
  if (!(k.bld_shrines > 0)) return updates;

  const shrineAttune = fragmentBonusManager.getFragmentForBuilding(k, 'shrines');
  if (!shrineAttune) return updates;

  const fragmentName = shrineAttune.fragment;
  const happiness = k.happiness !== undefined && k.happiness !== null ? k.happiness : 50;
  const shrines = k.bld_shrines;

  switch (fragmentName) {
    case 'Volcanic Rock':
      // Geothermal Hearth: thermal springs warm the shrine each turn
      updates.happiness = Math.min(120, happiness + 1);
      events.push({ type: 'system', message: `🌋 Geothermal Hearth: thermal springs warm the shrine (+1 happiness).` });
      break;

    case 'Celestial Feather':
      // Blessed Resurrections: heavenly light restores morale fatigue
      updates.happiness = Math.min(120, happiness + 2);
      events.push({ type: 'system', message: `🪶 Blessed Resurrections: heavenly light restores morale (+2 happiness).` });
      break;

    case 'Cursed Bloodstone': {
      // Sanguine Transfusion: auto-heal fighters via life-force binding at -1 happiness cost
      const healed = Math.floor(shrines * 5);
      if (healed > 0) {
        const BARRACKS_TROOPS = ["fighters", "rangers", "clerics", "thieves", "ninjas"];
        const barracksCapacityMult = fragmentBonusManager.getBonusMultiplier(k, 'barracks', 'capacity');
        const barracksCap = Math.floor(k.bld_barracks * 500 * barracksCapacityMult);
        const currentBarracksTroops = BARRACKS_TROOPS.reduce((s, u) => s + (k[u] || 0), 0);
        const barracksSpace = Math.max(0, barracksCap - currentBarracksTroops);
        const levelCapVal = getCap("fighters", k.level || 1);
        const currentFighters = k.fighters || 0;
        const levelSpace = Math.max(0, levelCapVal - currentFighters);
        const added = Math.min(healed, barracksSpace, levelSpace);
        if (added > 0) {
          updates.fighters = currentFighters + added;
          updates.happiness = Math.max(-50, happiness - 1);
          events.push({ type: 'system', message: `💉 Sanguine Transfusion: ${added.toLocaleString()} fighters healed through life-force binding (-1 happiness).` });
        }
      }
      break;
    }

    case 'Tears of World Tree': {
      // Nectar of Life: sacred dew restores clerics for free each turn
      const restored = Math.floor(shrines * 2);
      if (restored > 0) {
        const BARRACKS_TROOPS = ["fighters", "rangers", "clerics", "thieves", "ninjas"];
        const barracksCapacityMult = fragmentBonusManager.getBonusMultiplier(k, 'barracks', 'capacity');
        const barracksCap = Math.floor(k.bld_barracks * 500 * barracksCapacityMult);
        const currentBarracksTroops = BARRACKS_TROOPS.reduce((s, u) => s + (k[u] || 0), 0);
        const barracksSpace = Math.max(0, barracksCap - currentBarracksTroops);
        const levelCapVal = getCap("clerics", k.level || 1);
        const currentClerics = k.clerics || 0;
        const levelSpace = Math.max(0, levelCapVal - currentClerics);
        const added = Math.min(restored, barracksSpace, levelSpace);
        if (added > 0) {
          updates.clerics = currentClerics + added;
          events.push({ type: 'system', message: `💧 Nectar of Life: ${added.toLocaleString()} clerics refreshed by sacred dew.` });
        }
      }
      break;
    }

    case 'Void Essence':
      // Telescopic Epiphany: 15% chance of cosmic vision driving eccentricity
      if (Math.random() < 0.15) {
        updates.happiness = Math.max(-50, happiness - 3);
        events.push({ type: 'system', message: `🌌 Telescopic Epiphany: cosmic rift glimpsed through shrine ceiling (-3 happiness).` });
      }
      break;
  }

  return updates;
}

// ── Mausoleum — Thralls populate and provide base defense ────────────────────
function processMausoleum(k, events) {
  const updates = {};
  const mausoleums = k.bld_mausoleums;
  if (mausoleums === 0) return updates;

  let mausoleumUpgrades = {};
  try {
    mausoleumUpgrades = safeJsonParse(k.mausoleum_upgrades, {}, "auto:mausoleum_upgrades");
  } catch {}

  const perMausoleum = 100 + (mausoleumUpgrades.soul_vault ? 50 : 0);
  const mausoleumCapacityMult = fragmentBonusManager.getBonusMultiplier(k, 'mausoleums', 'capacity');
  const mausoleumPowerMult = fragmentBonusManager.getBonusMultiplier(k, 'mausoleums', 'power');
  const capacity = Math.floor(mausoleums * perMausoleum * mausoleumCapacityMult * mausoleumPowerMult);
  const currentThralls = k.thralls;

  // Auto-population: 2% of capacity each turn
  if (currentThralls < capacity) {
    const regained = Math.max(1, Math.floor(capacity * 0.02));
    updates.thralls = Math.min(capacity, currentThralls + regained);
    events.push({
      type: "system",
      message: `🪦 Mausoleum: ${regained.toLocaleString()} new Thrall${regained === 1 ? '' : 's'} ${regained === 1 ? 'was' : 'were'} attracted to the crypts. (${updates.thralls}/${capacity})`,
    });
  }

  // Thralls don't earn XP passively here, they gain it through combat
  return updates;
}

// ── Library processing — runs each turn ──────────────────────────────────────
function processLibrary(k, events) {
  const updates = {};
  const libs = k.bld_libraries;
  if (libs === 0) return updates;

  let alloc = {};
  try {
    alloc = safeJsonParse(k.library_allocation, {}, "auto:library_allocation");
  } catch {
    alloc = {};
  }
  let progress = {};
  try {
    progress = safeJsonParse(k.library_progress, {}, "auto:library_progress");
  } catch {
    progress = {};
  }

  // Fallback for old schema
  if (alloc.scribe_craft) {
    alloc[alloc.scribe_craft] = alloc.scribe_target || 999;
    delete alloc.scribe_craft;
    delete alloc.scribe_target;
  }

  // Library upgrades
  let libUpgrades = {};
  try {
    libUpgrades = safeJsonParse(k.library_upgrades, {}, "auto:library_upgrades");
  } catch {}
  const capacityPerLib = 20;
  const scribeSpeedMult = raceBonus(k, "scribe"); // Or similar? I will look up how other racial modifiers are done. Let's look at raceBonus.
  const libraryWorkSpeedMult = fragmentBonusManager.getBonusMultiplier(k, 'libraries', 'decoding_speed');

  const capacity = libs * capacityPerLib;
  const effectiveScribes = Math.min(k.scribes, capacity);

  // Level multipliers
  const scribeLvlMult = unitLevelMult(k, "scribes");

  let activeTasks = Object.keys(alloc).filter(
    (t) => (alloc[t] || 0) > 0 && SCRIBE_ITEMS[t],
  );

  if (effectiveScribes > 0 && activeTasks.length > 0) {
    let totalAllocated = activeTasks.reduce(
      (sum, t) => sum + (Number(alloc[t]) || 0),
      0,
    );

    // Scale down if allocating more scribes than available
    let scale = 1.0;
    if (totalAllocated > effectiveScribes) {
      scale = effectiveScribes / totalAllocated;
    }

    activeTasks.forEach((task) => {
      const effective = (Number(alloc[task]) || 0) * scale;
      if (effective <= 0) return;

      const req = SCRIBE_ITEMS[task];
      const progressKey = "scribe_" + task;
      let disc = {};
      try {
        disc = JSON.parse(
          updates.discovered_kingdoms || k.discovered_kingdoms || "{}",
        );
      } catch {}

      if (task === "location_map") {
        const unmapped = Object.keys(disc).filter(
          (id) => disc[id].found && !disc[id].mapped,
        );
        if (unmapped.length === 0) {
          events.push({
            type: "system",
            message: `⚠️ Scribes paused location mapping — you have mapped all currently known locations!`,
          });
          return;
        }
        if ((updates.maps !== undefined ? updates.maps : k.maps) < 2) {
          events.push({
            type: "system",
            message: `⚠️ Scribes paused location mapping — you need at least 2 maps (one to keep) to continue automation.`,
          });
          return;
        }
      } else if (task === "hybrid_blueprint") {
        let frags = [];
        try {
          frags = JSON.parse(
            updates.world_fragments || k.world_fragments || "[]",
          );
        } catch {}
        if (frags.length === 0 || !frags.some((f) => f.studied)) {
          events.push({
            type: "system",
            message: `⚠️ Scribes paused Hybrid Blueprint research — no studied World Fragments available!`,
          });
          return;
        }
      } else if (task === "study_fragment") {
        let frags = [];
        try {
          frags = JSON.parse(
            updates.world_fragments || k.world_fragments || "[]",
          );
        } catch {}
        if (frags.length === 0 || !frags.some((f) => !f.studied)) {
          events.push({
            type: "system",
            message: `⚠️ Scribes paused Fragment studying — no unstudied World Fragments available!`,
          });
          return;
        }
      }

      const workDone =
        (effective / req.scribes) * scribeLvlMult * scribeSpeedMult * libraryWorkSpeedMult;
      let newProg = (progress[progressKey] || 0) + workDone;

      let itemsCompleted = 0;
      while (newProg >= req.turns) {
        if (task === "map") {
          updates.maps =
            (updates.maps !== undefined ? updates.maps : k.maps) + 1;
          itemsCompleted++;
        } else if (task === "location_map") {
          const unmapped = Object.keys(disc).filter(
            (id) => disc[id].found && !disc[id].mapped,
          );
          if (unmapped.length === 0) break;
          if ((updates.maps !== undefined ? updates.maps : k.maps) < 1)
            break;
          const targetId =
            unmapped[Math.floor(Math.random() * unmapped.length)];
          disc[targetId].mapped = true;
          updates.discovered_kingdoms = JSON.stringify(disc);
          updates.maps =
            (updates.maps !== undefined ? updates.maps : k.maps) - 1;
          const targetName = disc[targetId].name || "an unknown kingdom";
          events.push({
            type: "system",
            message: `📍 Your scribes mapped a new location! You may now interact with ${targetName}.`,
          });
          itemsCompleted++;
        } else if (task === "hybrid_blueprint") {
          let frags = [];
          try {
            frags = JSON.parse(
              updates.world_fragments || k.world_fragments || "[]",
            );
          } catch {}
          const studiedIndexes = frags
            .map((f, i) => (f.studied ? i : -1))
            .filter((i) => i !== -1);
          if (studiedIndexes.length === 0) break;

          let hbp = {};
          try {
            hbp = JSON.parse(
              updates.hybrid_blueprints || k.hybrid_blueprints || "{}",
            );
          } catch {}
          const fragIndex =
            studiedIndexes[Math.floor(Math.random() * studiedIndexes.length)];
          const frag = frags.splice(fragIndex, 1)[0].type;
          updates.world_fragments = JSON.stringify(frags);

          const buildings = [
            "farms",
            "barracks",
            "markets",
            "schools",
            "mage_towers",
            "shrines",
            "guard_towers",
            "castles",
            "smithies",
            "libraries",
          ];
          const targetBld =
            buildings[Math.floor(Math.random() * buildings.length)];

          hbp[frag + "_" + Date.now()] = {
            fragment: frag,
            building: targetBld,
            assigned: false,
          };
          updates.hybrid_blueprints = JSON.stringify(hbp);
          events.push({
            type: "system",
            message: `✨ Your scribes fully conceptualized a ${frag} and devised a Hybrid Blueprint for ${targetBld.replace(/_/g, " ")}!`,
          });
          itemsCompleted++;
        } else if (task === "study_fragment") {
          let frags = [];
          try {
            frags = JSON.parse(
              updates.world_fragments || k.world_fragments || "[]",
            );
          } catch {}
          const unstudiedIndexes = frags
            .map((f, i) => (!f.studied ? i : -1))
            .filter((i) => i !== -1);
          if (unstudiedIndexes.length === 0) break;

          const fragIndex =
            unstudiedIndexes[
              Math.floor(Math.random() * unstudiedIndexes.length)
            ];
          const oldFrag = frags[fragIndex];
          const type =
            typeof oldFrag === "string"
              ? oldFrag
              : oldFrag.type || "Unknown Fragment";
          frags[fragIndex] = { type: type, studied: true };
          updates.world_fragments = JSON.stringify(frags);
          events.push({
            type: "system",
            message: `🧪 Your scribes successfully studied a World Fragment, revealing it to be a ${type}!`,
          });
          itemsCompleted++;
        } else if (task === "certified_blueprint") {
          updates.certified_blueprints_stored =
            (updates.certified_blueprints_stored !== undefined
              ? updates.certified_blueprints_stored
              : k.certified_blueprints_stored) + 1;
          itemsCompleted++;
        } else if (task === "fortified_blueprint") {
          let fortifiedCount =
            updates.fortified_blueprints !== undefined
              ? updates.fortified_blueprints
              : k.fortified_blueprints;
          updates.fortified_blueprints = fortifiedCount + 1;
          itemsCompleted++;
        } else {
          updates.blueprints_stored =
            (updates.blueprints_stored !== undefined
              ? updates.blueprints_stored
              : k.blueprints_stored) + 1;
          itemsCompleted++;
        }

        newProg -= req.turns;
      }

      if (itemsCompleted > 0) {
        updates._libraryCraftedItems = updates._libraryCraftedItems || {};
        updates._libraryCraftedItems[task] =
          (updates._libraryCraftedItems[task] || 0) + itemsCompleted;
        const sXp = awardTroopXp(
          { ...k, troop_levels: updates.troop_levels || k.troop_levels },
          "scribes",
          15 * itemsCompleted,
        );
        updates.troop_levels = sXp.troop_levels;
      }

      progress[progressKey] = newProg;

      if (workDone > 0) {
        if (!updates._scribe_estimates) updates._scribe_estimates = [];
        const pct = Math.floor((progress[progressKey] / req.turns) * 100);
        const turnsLeft = Math.ceil(
          (req.turns - progress[progressKey]) / workDone,
        );
        const displayTask = task.replace(/_/g, " ");
        updates._scribe_estimates.push(
          `${displayTask} (${pct}%, ${turnsLeft} turns left)`,
        );
      }
    });

    if (updates._libraryCraftedItems) {
      let msgParts = [];
      for (const [task, count] of Object.entries(
        updates._libraryCraftedItems,
      )) {
        if (task === "map") {
          msgParts.push(`${count} map(s)`);
        } else if (task === "certified_blueprint") {
          msgParts.push(`${count} Certified Blueprint(s)`);
        } else if (task === "fortified_blueprint") {
          msgParts.push(`${count} Fortified Blueprint(s)`);
        } else if (task === "blueprint") {
          msgParts.push(`${count} blueprint(s)`);
        } else {
          msgParts.push(`${count} ${task.replace(/_/g, " ")}`);
        }
      }
      events.push({
        type: "system",
        message: `📚 Your scribes drafted in the Library: ${msgParts.join(", ")}.`,
      });
      delete updates._libraryCraftedItems;
    }

    if (updates._scribe_estimates && updates._scribe_estimates.length > 0) {
      events.push({
        type: "system",
        message: `📚 Library Est: ${updates._scribe_estimates.join(" · ")}.`,
      });
      delete updates._scribe_estimates;
    }
  }

  updates.library_progress = JSON.stringify(progress);

  if (libUpgrades.surveyors_eyrie && Math.random() < 0.2) {
    updates._find_kingdom_surveyor = true;
  }

  return updates;
}

// ── Hero Units ────────────────────────────────────────────────────────────────

function heroXpForLevel(level) {
  if (level <= 1) return 0;
  return Math.floor(500000 * Math.pow((level - 1) / 24, 2.5));
}

function awardHeroXp(hero, xpAmount) {
  const newXp = hero.xp + xpAmount;
  let newLevel = hero.level;
  while (newXp >= heroXpForLevel(newLevel + 1) && newLevel < 25) {
    newLevel++;
  }
  return { level: newLevel, xp: newXp };
}

function getHeroPower(hero) {
  let basePower = hero.level * 1000; // Base power for combat/expeditions
  if (hero.class === "warlord") basePower *= 1.5;
  if (hero.class === "siegebreaker") basePower *= 1.3;
  if (hero.class === "paladin") basePower *= 1.2;
  if (hero.class === "alpha") basePower *= 1.4;
  if (hero.class === "sovereign") basePower *= 0.5; // less combat focused
  if (hero.class === "forge_lord") basePower *= 0.7;
  return basePower;
}

// ── Hero Abilities ────────────────────────────────────────────────────────────
// Passives applied during turn or combat

function applyHeroTurnBonuses(hero, k, updates, events) {
  const cls = HERO_CLASSES[hero.class];
  if (!cls || !cls.statBonus) return;

  if (hero.class === "sovereign") {
    // Prosperity: Extra tax income
    const bonus = Math.floor(hero.level * 250);
    updates.gold =
      (updates.gold !== undefined ? updates.gold : k.gold) + bonus;
    if (events)
      events.push({
        type: "system",
        message: `👑 Sovereign Prosperity: +${bonus.toLocaleString()} gold.`,
      });
  } else if (hero.class === "archmage") {
    // Mana infusion: Extra mana
    const bonus = Math.floor(hero.level * 100);
    updates.mana =
      (updates.mana !== undefined ? updates.mana : k.mana) + bonus;
    if (events)
      events.push({
        type: "system",
        message: `🧙 Archmage Mana Infusion: +${bonus.toLocaleString()} mana.`,
      });
  } else if (hero.class === "paladin") {
    // Protective Aura: Health regeneration or morale boost
    const currentMorale =
      updates.morale !== undefined
        ? updates.morale
        : k.morale !== undefined && k.morale !== null
          ? k.morale
          : 100;
    const oldMorale = currentMorale;
    updates.morale = Math.min(100, currentMorale + 1);
    const mDelta = updates.morale - oldMorale;
  } else if (hero.class === "warlord") {
    // Warlord: Morale boost
    const currentMorale =
      updates.morale !== undefined
        ? updates.morale
        : k.morale !== undefined && k.morale !== null
          ? k.morale
          : 100;
    const oldMorale = currentMorale;
    updates.morale = Math.min(100, currentMorale + 2);
    const mDelta = updates.morale - oldMorale;
  } else if (hero.class === "forge_lord") {
    // Forge Lord: Gold income
    const bonus = Math.floor(hero.level * 300);
    updates.gold =
      (updates.gold !== undefined ? updates.gold : k.gold) + bonus;
    if (events)
      events.push({
        type: "system",
        message: `🛠️ Forge Lord Industrialism: +${bonus.toLocaleString()} gold.`,
      });
  } else if (hero.class === "alpha") {
    // Alpha: Food and morale
    const foodBonus = Math.floor(hero.level * 500);
    updates.food =
      (updates.food !== undefined ? updates.food : k.food) + foodBonus;
    const currentMorale =
      updates.morale !== undefined
        ? updates.morale
        : k.morale !== undefined && k.morale !== null
          ? k.morale
          : 100;
    const oldMorale = currentMorale;
    updates.morale = Math.min(100, currentMorale + 1);
    const mDelta = updates.morale - oldMorale;
    if (events) {
      events.push({
        type: "system",
        message: `🐺 Alpha Hunting: +${foodBonus.toLocaleString()} food.`,
      });
    }
  } else if (hero.class === "blood_shaman") {
    // Blood Shaman: Converts population to mana
    const currentPop =
      updates.population !== undefined ? updates.population : k.population;
    if (currentPop > 1000) {
      const sacrificed = Math.floor(hero.level * 5);
      updates.population = currentPop - sacrificed;
      const manaBonus = sacrificed * 50;
      updates.mana =
        (updates.mana !== undefined ? updates.mana : k.mana) + manaBonus;
      if (events)
        events.push({
          type: "system",
          message: `🩸 Blood Shaman Sacrifice: ${sacrificed.toLocaleString()} population consumed for +${manaBonus.toLocaleString()} mana.`,
        });
    }
  } else if (hero.class === "necromancer") {
    const bonus = Math.floor(hero.level * 150);
    updates.mana =
      (updates.mana !== undefined ? updates.mana : k.mana) + bonus;
    if (events)
      events.push({
        type: "system",
        message: `💀 Necromancer Siphoning: +${bonus.toLocaleString()} mana.`,
      });
  } else if (hero.class === "star_caller") {
    const bonus = Math.floor(hero.level * 120);
    updates.mana =
      (updates.mana !== undefined ? updates.mana : k.mana) + bonus;
    if (events)
      events.push({
        type: "system",
        message: `🌌 Star Caller Ritual: +${bonus.toLocaleString()} mana.`,
      });
  }
}

function recruitHero(k, heroName, heroClass) {
  const cls = HERO_CLASSES[heroClass];
  if (!cls) return { error: "Invalid hero class" };

  if (cls.races && !cls.races.includes(k.race)) {
    return { error: `The ${cls.name} class cannot be recruited by ${k.race}s` };
  }

  if (k.gold < cls.recruitCost)
    return { error: `Need ${cls.recruitCost.toLocaleString()} gold` };
  if (k.mana < cls.recruitMana)
    return { error: `Need ${cls.recruitMana.toLocaleString()} mana` };
  if (k.bld_castles < 1)
    return { error: "Requires a Castle to house a Hero" };

  return {
    hero: {
      name: heroName,
      class: heroClass,
      level: 1,
      xp: 0,
      abilities: JSON.stringify(cls.abilities),
      hp: 200,
      max_hp: 200,
      status: "idle",
    },
    cost: { gold: cls.recruitCost, mana: cls.recruitMana },
  };
}

// ── Active effects processing — runs each turn ────────────────────────────────
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

function engineerXpForLevel(level) {
  if (level <= 1) return 0;
  if (level <= 10) return level * 100;
  if (level <= 25) return level * 300;
  if (level <= 50) return level * 800;
  if (level <= 75) return level * 2000;
  return level * 5000;
}

function engineerConstructionMult(level) {
  return Math.max(1.0, 1.0 + ((Math.min(level, 100) - 1) / 99) * 0.25);
}

function calculateBuildTime(kingdom, tier) {
  const baseTime = config.BUILDING_TIER_TIMES[tier] || 0;
  const engineerLevel = kingdom.engineer_level || 1;
  const engineerMult = engineerConstructionMult(engineerLevel);
  const raceMult = config.RACE_BONUSES[kingdom.race]?.construction || 1.0;

  const adjustedTime = baseTime / engineerMult / raceMult;
  return Math.ceil(adjustedTime);
}

function calculateBuildCost(kingdom, tier) {
  const baseCost = config.BUILDING_TIER_COSTS[tier] || {};
  const raceMult = config.RACE_BONUSES[kingdom.race]?.construction || 1.0;

  return {
    land: Math.ceil((baseCost.land || 0) / raceMult),
    wood: Math.ceil((baseCost.wood || 0) / raceMult),
    stone: Math.ceil((baseCost.stone || 0) / raceMult),
    iron: Math.ceil((baseCost.iron || 0) / raceMult),
  };
}

function awardEngineerXp(kingdom, xpAmount) {
  kingdom.engineer_xp = (kingdom.engineer_xp || 0) + xpAmount;

  while (kingdom.engineer_level < 100) {
    const nextLevelXp = engineerXpForLevel(kingdom.engineer_level + 1);
    if (kingdom.engineer_xp >= nextLevelXp) {
      kingdom.engineer_xp -= nextLevelXp;
      kingdom.engineer_level++;
    } else {
      break;
    }
  }

  return kingdom;
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
  processShrineAttunements,
  processMausoleum,
  processActiveEffects,
  forgeTools,
  resolveMilitaryAttack,
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
  moraleMult,
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
};
