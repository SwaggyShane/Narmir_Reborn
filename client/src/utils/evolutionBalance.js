/**
 * Client mirror of game/evolution/balance.js (EVOLUTION.md Roadmap B).
 * Server is source of truth; keep in sync manually (CJS/ESM split).
 */

export const EVOLUTION_PRESTIGE_GATE = 8;
export const RITUAL_TURNS = 50;
export const RITUAL_CHANNEL_DEFENSE_MULT = 0.85;
export const DRAGON_EGG_ITEM_ID = 'dragon_egg';

export const DRAGON_FORM = Object.freeze({
  id: 'dragon',
  defenseMult: 0.92,
  upkeepMult: 1.1,
  terrorVsLowerPrestige: 1.08,
  hoardEconMult: 1.03,
});
