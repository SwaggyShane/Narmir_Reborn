/**
 * Client mirror of game/prestige/balance.js.
 * Server is source of truth; keep numbers in sync manually (CJS/ESM split).
 */

export const PRESTIGE_COOLDOWN_TURNS = 200;
export const PRESTIGE_LEVEL_GATE = 500;

export const PRESTIGE_MODIFIERS = Object.freeze({
  0: { bldCap: 1.0, econ: 1.0, combat: 1.0, pop: 1.0 },
  1: { bldCap: 1.1, econ: 1.03, combat: 1.0, pop: 1.0 },
  2: { bldCap: 1.2, econ: 1.06, combat: 1.0, pop: 1.0 },
  3: { bldCap: 1.3, econ: 1.09, combat: 1.02, pop: 1.0 },
  4: { bldCap: 1.4, econ: 1.12, combat: 1.03, pop: 1.05 },
  5: { bldCap: 1.5, econ: 1.15, combat: 1.05, pop: 1.1 },
});

export const STARTER_BUILDINGS = Object.freeze({
  bld_farms: 5,
  bld_barracks: 2,
  bld_schools: 1,
  bld_housing: 100,
});

export function landSeed(newPrestigeLevel) {
  return 500 + 50 * newPrestigeLevel;
}

export function goldSeed(newPrestigeLevel) {
  return 25000 + 10000 * newPrestigeLevel;
}

export function getPrestigeModifiers(prestigeLevel) {
  const p = Math.min(Math.max(Number(prestigeLevel) || 0, 0), 5);
  return PRESTIGE_MODIFIERS[p] || PRESTIGE_MODIFIERS[0];
}

export function getPrestigeTitle(prestigeLevel) {
  const p = Number(prestigeLevel) || 0;
  if (p <= 0) return 'Mortal';
  if (p <= 2) return 'Awakened';
  if (p <= 4) return 'Bloodmarked';
  if (p <= 6) return 'Ascendant';
  if (p <= 8) return 'Primordial';
  return 'Worldscarred';
}

export function formatMultDelta(mult) {
  if (!mult || mult === 1) return '—';
  const pct = Math.round((mult - 1) * 100);
  return pct > 0 ? `+${pct}%` : `${pct}%`;
}
