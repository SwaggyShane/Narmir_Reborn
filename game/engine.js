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

function repairMojibake(value) {
  if (value === null || value === undefined) return value;
  let text = String(value);
  for (let i = 0; i < 20; i++) {
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