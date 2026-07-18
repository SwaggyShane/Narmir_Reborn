'use strict';
// Prestige balance — sole source for gates, seeds, modifiers.

/** 200 turns × 25 min ≈ 83.3 h ≈ 3.5 days wall clock. Flat at all ranks. */
const PRESTIGE_COOLDOWN_TURNS = 200;
/** Max kingdom level (XP table cap) — intentional long grind before first rebirth. */
const PRESTIGE_LEVEL_GATE = 500;

/**
 * Permanent mults. Lookup min(prestige_level, 5).
 * P5 combat 1.05 is meaningful but not dominant vs gear/investment.
 */
const PRESTIGE_MODIFIERS = Object.freeze({
  0: { bldCap: 1.0, econ: 1.0, combat: 1.0, pop: 1.0 },
  1: { bldCap: 1.1, econ: 1.03, combat: 1.0, pop: 1.0 },
  2: { bldCap: 1.2, econ: 1.06, combat: 1.0, pop: 1.0 },
  3: { bldCap: 1.3, econ: 1.09, combat: 1.02, pop: 1.0 },
  4: { bldCap: 1.4, econ: 1.12, combat: 1.03, pop: 1.05 },
  5: { bldCap: 1.5, econ: 1.15, combat: 1.05, pop: 1.1 },
});

// Starter kit: self-sufficiency path without old empire shell.
const STARTER_BUILDINGS = Object.freeze({
  bld_farms: 5, // food baseline
  bld_barracks: 2, // min military
  bld_schools: 1, // restart research
  bld_housing: 100, // new-kingdom housing scale
});

// land = 500+50*P — no land snowball; not punitive vs new kingdoms
// gold = 25000+10000*P — seed scales with commitment, not 50k*P windfall
function landSeed(newPrestigeLevel) {
  return 500 + 50 * newPrestigeLevel;
}

function goldSeed(newPrestigeLevel) {
  return 25000 + 10000 * newPrestigeLevel;
}

const RESOURCE_SEEDS = Object.freeze({
  population: 5000,
  food: 25000,
  mana: 1000,
});

const HEROES_KEEP = 3;

function getPrestigeModifiers(prestigeLevel) {
  const p = Math.min(Math.max(Number(prestigeLevel) || 0, 0), 5);
  return PRESTIGE_MODIFIERS[p] || PRESTIGE_MODIFIERS[0];
}

function getPrestigeTitle(prestigeLevel) {
  const p = Number(prestigeLevel) || 0;
  if (p <= 0) return 'Mortal';
  if (p <= 2) return 'Awakened';
  if (p <= 4) return 'Bloodmarked';
  if (p <= 6) return 'Ascendant';
  if (p <= 8) return 'Primordial';
  return 'Worldscarred';
}

/** UI/admin: percent strings for mult tables */
function formatMultDelta(mult) {
  if (!mult || mult === 1) return '—';
  const pct = Math.round((mult - 1) * 100);
  return pct > 0 ? `+${pct}%` : `${pct}%`;
}

module.exports = {
  PRESTIGE_COOLDOWN_TURNS,
  PRESTIGE_LEVEL_GATE,
  PRESTIGE_MODIFIERS,
  STARTER_BUILDINGS,
  RESOURCE_SEEDS,
  HEROES_KEEP,
  landSeed,
  goldSeed,
  getPrestigeModifiers,
  getPrestigeTitle,
  formatMultDelta,
};
