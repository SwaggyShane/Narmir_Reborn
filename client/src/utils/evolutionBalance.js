/**
 * Client mirror of game/evolution/balance.js.
 * ENDGAME optional form. Server is source of truth; keep in sync manually.
 */

export const EVOLUTION_PRESTIGE_GATE = 8;
export const RITUAL_TURNS = 50;
export const RITUAL_CHANNEL_DEFENSE_MULT = 0.85;
export const DRAGON_EGG_ITEM_ID = 'dragon_egg';
/** Fraction of trek artifact rolls that are the dragon egg (endgame-rare). */
export const EGG_ARTIFACT_ROLL_CHANCE = 0.05;

export const DRAGON_FORM = Object.freeze({
  id: 'dragon',
  defenseMult: 0.92,
  upkeepMult: 1.1,
  terrorVsLowerPrestige: 1.08,
  hoardEconMult: 1.03,
});
