'use strict';
// Canonical prestige API — EVOLUTION.md Roadmap A.
// Replaces special-events / world / game/prestige.js stubs.

const {
  PRESTIGE_COOLDOWN_TURNS,
  PRESTIGE_LEVEL_GATE,
  PRESTIGE_MODIFIERS,
  getPrestigeModifiers,
  getPrestigeTitle,
  landSeed,
  goldSeed,
} = require('./balance');
const { buildWipeUpdates, applyPrestigeSideEffects } = require('./wipe');
const { applyPrestigeCombatMultiplier } = require('./combat');

/**
 * @param {object} k
 * @returns {boolean}
 */
function canPrestige(k) {
  if (!k) return false;
  if ((Number(k.level) || 0) < PRESTIGE_LEVEL_GATE) return false;

  // Fresh / never prestiged: missing, null, or 0 => no cooldown
  const lastRaw = Number(k.last_prestige_turn);
  const lastTurn = Number.isFinite(lastRaw) ? lastRaw : 0;
  if (lastTurn > 0) {
    const turn = Number(k.turn) || 0;
    if (turn - lastTurn < PRESTIGE_COOLDOWN_TURNS) return false;
  }

  // Evolution ritual channeling (Roadmap B); missing => not channeling
  try {
    const raw = k.evolution_ritual;
    if (raw) {
      const ritual = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (ritual && ritual.state === 'CHANNELING') return false;
    }
  } catch {
    /* ignore corrupt ritual */
  }

  return true;
}

/**
 * Pure prestige transform. Caller must TX-lock, revalidate, apply updates + side effects.
 * @param {object} k
 * @returns {{ error: string } | { updates: object, newPrestigeLevel: number, seeds: object }}
 */
function processPrestige(k) {
  if (!canPrestige(k)) {
    return { error: `Require Kingdom Level ${PRESTIGE_LEVEL_GATE} to Rebirth (or cooldown / ritual active).` };
  }
  const { updates, newPrestigeLevel } = buildWipeUpdates(k);
  return {
    updates,
    newPrestigeLevel,
    seeds: {
      land: updates.land,
      gold: updates.gold,
      population: updates.population,
      food: updates.food,
      mana: updates.mana,
    },
  };
}

module.exports = {
  canPrestige,
  processPrestige,
  applyPrestigeSideEffects,
  applyPrestigeCombatMultiplier,
  PRESTIGE_COOLDOWN_TURNS,
  PRESTIGE_LEVEL_GATE,
  PRESTIGE_MODIFIERS,
  getPrestigeModifiers,
  getPrestigeTitle,
  landSeed,
  goldSeed,
};
