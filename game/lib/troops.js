// Troop XP, leveling, unit multiplier, and availability helpers.
// Extracted from engine.js. Pure functions over a kingdom row + unit key —
// no I/O, no engine imports. Combat, covert, and economy modules consume
// these directly.

const { TROOP_RACE_BONUS } = require("../config");
const { safeJsonParse } = require("../../utils/helpers");

// Race-specific "legendary" troop names unlocked at prestige > 0. unitLevelMult
// also keys off this map to grant the +15% legendary multiplier.
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

function troopXpForLevel(level) {
  if (level <= 1) return 0;
  if (level <= 10) return level * 100;
  if (level <= 25) return level * 300;
  if (level <= 50) return level * 800;
  if (level <= 75) return level * 2000;
  return level * 5000;
}

// Raw troop level for a unit type straight out of the troop_levels JSON blob
// (no race-bonus adjustment — see effectiveTroopLevel below for that).
function parseTroopLevel(troopLevels, troopType) {
  if (troopType === "thralls") return 1;
  const levels = safeJsonParse(troopLevels, {}, "parseTroopLevel:troop_levels");
  const entry = levels[troopType];
  if (!entry) return 1;
  if (typeof entry === "number") return entry;
  if (typeof entry.level === "number") return entry.level;
  return 1;
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
  const earned = Math.floor(xpAmount * raceBonus);
  // current.xp is stored as the remainder *within* the current level, not
  // cumulative since level 1 — convert to an absolute total before comparing
  // against troopXpForLevel's absolute (cumulative) thresholds, same as
  // diluteTroopXp does. Loop so one large grant can cross several levels.
  const totalXp = current.xp + troopXpForLevel(current.level) + earned;
  const levelUps = [];
  let newLevel = current.level;

  while (newLevel < cap && totalXp >= troopXpForLevel(newLevel + 1)) {
    newLevel++;
    levelUps.push(`${unit} reached Level ${newLevel}`);
  }

  troopLevels[unit] = {
    level: newLevel,
    xp: Math.max(0, totalXp - troopXpForLevel(newLevel)),
    count: current.count,
  };
  return { troop_levels: JSON.stringify(troopLevels), levelUps };
}

// Effectiveness multiplier: +0.5% per unit level above 1, caps at +50% at level 100.
// Prestige global combat is applyPrestigeCombatMultiplier only (max 1.05) — do not
// stack +5%/prestige rank here (EVOLUTION.md Roadmap A single combat path).
// Legendary race unit names: flat +15% when prestige_level > 0 (identity, not mult table).
// prestige_level || 0 guards against NaN if the field is missing — the DB
// column is NOT NULL but unit tests sometimes pass partial kingdom shapes.
function unitLevelMult(k, unit) {
  const level = effectiveTroopLevel(k, unit);
  const prestigeLevel = k?.prestige_level || 0;
  const isLegendary =
    prestigeLevel > 0 && LEGENDARY_NAMES[k?.race]?.[unit] ? 1.15 : 1.0;
  return (1 + Math.min(0.5, (level - 1) * 0.005)) * isLegendary;
}

// Racial unique bonuses unlock at unit level 25+
function racialUnitBonus(k, unit) {
  const level = effectiveTroopLevel(k, unit);
  if (level < 25) return {};
  const race = k.race;
  if (race === "dwarf" && unit === "engineers")
    return { warMachineSoloCrew: true };
  if (race === "high_elf" && unit === "mages") return { doubleScrolls: true };
  if (race === "orc" && unit === "fighters")
    return { freeTrainees: Math.floor(k.fighters / 10) };
  if (race === "dark_elf" && unit === "ninjas")
    return { silentAssassination: true };
  if (race === "dire_wolf" && unit === "rangers") return { earlyReturn: true };
  if (race === "human" && unit === "clerics") return { auraHeal: true };
  if (race === "vampire" && unit === "thieves")
    return { infiltratorMastery: true };
  return {};
}

// Dilute average XP across the existing roster when new units are hired.
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
  const totalXp = current.xp + troopXpForLevel(current.level);
  const newCount = oldCount + hired;
  const newAvgXp = Math.floor((totalXp * oldCount) / newCount);
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

function awardUnitXp(k, unit, xpAmount) {
  if (!xpAmount || xpAmount <= 0 || !(k[unit] > 0)) return null;
  const result = awardTroopXp(k, unit, xpAmount);
  return typeof result.troop_levels === "string" ? JSON.parse(result.troop_levels) : result.troop_levels;
}

function getAvailableUnits(k, unit) {
  const total = k[unit] || 0;
  let allocated = 0;

  // All units can have training allocation
  if (k.training_allocation) {
    const trainingAlloc = safeJsonParse(
      k.training_allocation,
      {},
      "getAvailableUnits:training_allocation",
    );
    allocated += Math.max(0, parseInt(trainingAlloc[unit], 10) || 0);
  }

  // Engineers also have build and resource-build allocations
  if (unit === 'engineers') {
    if (k.build_allocation) {
      const buildAlloc = safeJsonParse(
        k.build_allocation,
        {},
        "getAvailableUnits:build_allocation",
      );
      allocated += Object.values(buildAlloc || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
    }
    if (k.resource_build_allocation) {
      const resourceAlloc = safeJsonParse(
        k.resource_build_allocation,
        {},
        "getAvailableUnits:resource_build_allocation",
      );
      allocated += Object.values(resourceAlloc || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
    }
  }

  // Rangers also have scout allocation
  if (unit === 'rangers') {
    if (k.scout_allocation) {
      allocated += Math.max(0, parseInt(k.scout_allocation, 10) || 0);
    }
  }

  // Mages also have research allocation for spellbooks
  if (unit === 'mages') {
    if (k.research_allocation) {
      const researchAlloc = safeJsonParse(
        k.research_allocation,
        {},
        "getAvailableUnits:research_allocation",
      );
      allocated += Math.max(0, parseInt(researchAlloc.spellbook_mages || 0, 10) || 0);
      allocated += Math.max(0, parseInt(researchAlloc.school_spellbook_mages || 0, 10) || 0);
    }
  }

  return Math.max(0, total - allocated);
}

module.exports = {
  LEGENDARY_NAMES,
  getUnitName,
  troopXpForLevel,
  parseTroopLevel,
  effectiveTroopLevel,
  awardTroopXp,
  unitLevelMult,
  racialUnitBonus,
  diluteTroopXp,
  awardUnitXp,
  getAvailableUnits,
};
