/**
 * Forge production — charcoal, smelt, temper, gear craft
 * FORGE_SYSTEM.md §3 / §15.2 A3
 */

'use strict';

const config = require('./config');
const { flagOn } = require('./forge-upgrades');

function raceMult(race, key) {
  const table = config.FORGE_RACE_MULT || {};
  const row = table[race] || table.human || { charcoal: 1, smelt: 1, lava: 1 };
  const v = Number(row[key]);
  return Number.isFinite(v) && v > 0 ? v : 1;
}

function requireForge(k) {
  if (!flagOn(k, 'forge')) return { error: 'Install the Forge upgrade first' };
  return null;
}

/** Set charcoal wood allocation (spent each turn in processCharcoalTick). */
function setCharcoalAllocation(k, wood) {
  const gate = requireForge(k);
  if (gate) return gate;
  const w = Math.floor(Number(wood));
  if (!Number.isFinite(w) || w < 0) return { error: 'wood must be a non-negative integer' };
  return {
    updates: {
      charcoal_wood_allocation: w,
      updated_at: Math.floor(Date.now() / 1000),
    },
  };
}

/**
 * Turn tick: convert allocated wood → coal.
 * coal_gained = floor(wood_spent × 0.25 × race_charcoal_mult)
 */
function processCharcoalTick(k) {
  if (!flagOn(k, 'forge')) return { updates: {} };
  const want = Math.max(0, Math.floor(Number(k.charcoal_wood_allocation) || 0));
  if (want <= 0) return { updates: {} };
  const have = Math.max(0, Math.floor(Number(k.wood) || 0));
  const woodSpent = Math.min(want, have);
  if (woodSpent <= 0) return { updates: {} };

  const ratio = Number(config.FORGE_CHARCOAL_WOOD_RATIO) || 0.25;
  const mult = raceMult(k.race, 'charcoal');
  let coalGain = Math.floor(woodSpent * ratio * mult);
  const cap = Number(config.FORGE_COAL_CAP) || 5000;
  const coalNow = Math.max(0, Math.floor(Number(k.coal) || 0));
  const room = Math.max(0, cap - coalNow);
  coalGain = Math.min(coalGain, room);

  return {
    updates: {
      wood: have - woodSpent,
      coal: coalNow + coalGain,
    },
    woodSpent,
    coalGain,
  };
}

/** Smelt: n batches of 20 iron + 10 coal → max(1, floor(n × smelt_mult)) steel */
function smeltSteel(k, batches) {
  const gate = requireForge(k);
  if (gate) return gate;
  const n = Math.floor(Number(batches));
  if (!Number.isFinite(n) || n < 1) return { error: 'batches must be a positive integer' };

  const rec = config.FORGE_SMELT || { iron: 20, coal: 10, steel: 1 };
  const ironNeed = rec.iron * n;
  const coalNeed = rec.coal * n;
  const iron = Math.floor(Number(k.iron) || 0);
  const coal = Math.floor(Number(k.coal) || 0);
  if (iron < ironNeed) return { error: `Need ${ironNeed.toLocaleString()} iron` };
  if (coal < coalNeed) return { error: `Need ${coalNeed.toLocaleString()} coal` };

  const mult = raceMult(k.race, 'smelt');
  const steelOut = Math.max(1, Math.floor(n * mult));
  const steelNow = Math.floor(Number(k.steel) || 0);

  return {
    updates: {
      iron: iron - ironNeed,
      coal: coal - coalNeed,
      steel: steelNow + steelOut,
      updated_at: Math.floor(Date.now() / 1000),
    },
    batches: n,
    steelOut,
  };
}

/** Temper: n × (1 steel + 2 lava) → n tempered_steel (eng ≥ 50) */
function temperSteel(k, batches, engineerLevel) {
  const gate = requireForge(k);
  if (gate) return gate;
  const engMin = (config.FORGE_LAVA && config.FORGE_LAVA.eng_level_min) || 50;
  const engLvl = Math.floor(Number(engineerLevel) || Number(k.engineer_level) || 1);
  if (engLvl < engMin) {
    return { error: `Engineer level ${engMin}+ required to temper` };
  }
  const n = Math.floor(Number(batches));
  if (!Number.isFinite(n) || n < 1) return { error: 'batches must be a positive integer' };

  const rec = config.FORGE_TEMPER || { steel: 1, lava: 2, tempered_steel: 1 };
  const steelNeed = rec.steel * n;
  const lavaNeed = rec.lava * n;
  const steel = Math.floor(Number(k.steel) || 0);
  const lava = Math.floor(Number(k.lava_stored) || 0);
  if (steel < steelNeed) return { error: `Need ${steelNeed.toLocaleString()} steel` };
  if (lava < lavaNeed) return { error: `Need ${lavaNeed.toLocaleString()} lava` };

  const out = n * (rec.tempered_steel || 1);
  const temperedNow = Math.floor(Number(k.tempered_steel) || 0);

  return {
    updates: {
      steel: steel - steelNeed,
      lava_stored: lava - lavaNeed,
      tempered_steel: temperedNow + out,
      updated_at: Math.floor(Date.now() / 1000),
    },
    batches: n,
    temperedOut: out,
    displayName: (config.TEMPERED_STEEL_NAMES || {})[k.race] || 'tempered steel',
  };
}

const GEAR_TYPES = new Set([
  'steel_weapons',
  'steel_armor',
  'tempered_weapons',
  'tempered_armor',
]);

function craftGear(k, type, qty, engineerLevel) {
  const gate = requireForge(k);
  if (gate) return gate;
  if (!GEAR_TYPES.has(type)) return { error: 'Unknown gear type' };
  const q = Math.floor(Number(qty));
  if (!Number.isFinite(q) || q < 1) return { error: 'qty must be a positive integer' };

  const costs = config.FORGE_GEAR_COSTS || {};
  const cost = costs[type];
  if (!cost) return { error: 'Unknown gear type' };

  const isTempered = type.startsWith('tempered_');
  if (isTempered) {
    const engMin = (config.FORGE_LAVA && config.FORGE_LAVA.eng_level_min) || 50;
    const engLvl = Math.floor(Number(engineerLevel) || Number(k.engineer_level) || 1);
    if (engLvl < engMin) {
      return { error: `Engineer level ${engMin}+ required for tempered gear` };
    }
  }

  const goldNeed = (cost.gold || 0) * q;
  const gold = Math.floor(Number(k.gold) || 0);
  if (gold < goldNeed) return { error: `Need ${goldNeed.toLocaleString()} gold` };

  const updates = {
    gold: gold - goldNeed,
    updated_at: Math.floor(Date.now() / 1000),
  };

  if (cost.steel) {
    const need = cost.steel * q;
    const have = Math.floor(Number(k.steel) || 0);
    if (have < need) return { error: `Need ${need.toLocaleString()} steel` };
    updates.steel = have - need;
  }
  if (cost.tempered_steel) {
    const need = cost.tempered_steel * q;
    const have = Math.floor(Number(k.tempered_steel) || 0);
    if (have < need) return { error: `Need ${need.toLocaleString()} tempered steel` };
    updates.tempered_steel = have - need;
  }

  const stockNow = Math.floor(Number(k[type]) || 0);
  updates[type] = stockNow + q;

  return { updates, type, qty: q };
}

module.exports = {
  raceMult,
  setCharcoalAllocation,
  processCharcoalTick,
  smeltSteel,
  temperSteel,
  craftGear,
  GEAR_TYPES,
};
