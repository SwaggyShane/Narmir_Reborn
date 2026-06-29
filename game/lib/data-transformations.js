// game/lib/data-transformations.js
// Pure data transformation and utility functions extracted from engine.js
// No I/O, no state mutations — safe for testing and reuse

const { devLog } = require('../../utils/helpers');
const config = require('../config');

const { CAPS, PRESTIGE_MODIFIERS, LOCATE_RACE_MULT } = config;

const MOJIBAKE_SIGNATURE = /[\u00C3\u00C2\u00E2\u00EF\u00F0\u00C5\uFFFD]/;

// Repair UTF-8 mojibake by re-encoding through latin1 → utf8 codec
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

// Clean news event by repairing mojibake in message and text fields
function cleanNewsEvent(item) {
  if (!item || typeof item !== "object") return item;
  const cleaned = { ...item };
  if (typeof cleaned.message === "string") cleaned.message = repairMojibake(cleaned.message);
  if (typeof cleaned.text === "string") cleaned.text = repairMojibake(cleaned.text);
  return cleaned;
}

// Check if it's currently night time (EST 8PM to 8AM = UTC 1AM to 1PM)
function isNight() {
  const h = new Date().getUTCHours();
  return h >= 1 && h < 13;
}

// Assign kingdom to region based on race (simple mapping for now)
function assignRegion(race) {
  return race;
}

// Calculate discovery chance for location maps based on race
function calcDiscoveryChance(k) {
  const baseChance = 0.05; // 5% base
  const race = k.race || "human";
  const raceMult = LOCATE_RACE_MULT[race] || 1.0;
  return baseChance * raceMult;
}

// Calculate level-based cap: scales linearly from base (level 1) to max (capLevel, default 1000)
// Levels above capLevel return max (the cap is fully unlocked and stays there)
function levelCap(base, max, level, capLevel = 1000) {
  const lv = Math.max(1, Math.min(capLevel, level || 1));
  const range = capLevel - 1;
  if (range <= 0) return max;
  return Math.floor(base + ((max - base) * (lv - 1)) / range);
}

// Get the cap for a field (unit, building) based on level and prestige
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

module.exports = {
  devLog,
  repairMojibake,
  cleanNewsEvent,
  isNight,
  assignRegion,
  calcDiscoveryChance,
  levelCap,
  getCap,
};
