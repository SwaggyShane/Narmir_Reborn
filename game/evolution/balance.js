'use strict';
// Dragon evolution balance — sole source (EVOLUTION.md Roadmap B).
// Tradeoff form: not prestige-plus-combat.

/** Minimum prestige_level to start dragon ritual. */
const EVOLUTION_PRESTIGE_GATE = 8;

/** Turns of channeling before form completes. Flat. */
const RITUAL_TURNS = 50;

/** Defense mult while CHANNELING (vulnerable). */
const RITUAL_CHANNEL_DEFENSE_MULT = 0.85;

/** Inventory item id (trek primary). Distinct from config ancient_dragon_egg flavor loot. */
const DRAGON_EGG_ITEM_ID = 'dragon_egg';
const DRAGON_EGG_ITEM_NAME = 'Dragon Egg';

/**
 * Epic trek: when artifact loot fires, chance this artifact is the dragon egg
 * (else normal TREK_ARTIFACTS catalog). Logged on drop for tuning.
 * Weight among artifact rolls, not among all loot.
 */
const EGG_TREK_ARTIFACT_WEIGHT = 1; // vs sum of other artifact weights (~5 entries at 1 each → ~1/6 of artifacts)

/** Permanent dragon form modifiers (no global combat %). */
const DRAGON_FORM = Object.freeze({
  id: 'dragon',
  /** Defender power mult when form is dragon */
  defenseMult: 0.92,
  /** Food / hire upkeep pressure */
  upkeepMult: 1.1,
  /**
   * Terror: attacker power mult vs defender with lower prestige_level.
   * Applied only when attacker is dragon and target prestige < attacker prestige.
   */
  terrorVsLowerPrestige: 1.08,
  /** Optional market/gold econ mult (small hoard). */
  hoardEconMult: 1.03,
});

/**
 * Fixed-army budget test targets (document intended power curve).
 * P8 dragon ≈ competitive with optimized P5–P7 peer — not free win.
 * Ratios are for test harness equal-army comparisons (unit tests).
 */
const FIXED_ARMY_BUDGET = Object.freeze({
  baseArmyPower: 10000,
  /** P5 prestige combat only */
  p5CombatMult: 1.05,
  /** P8 prestige combat (capped same as P5) */
  p8CombatMult: 1.05,
  /** Dragon does NOT multiply global combat */
  dragonCombatMult: 1.0,
  /** When P8 dragon attacks lower-P peer, terror applies once */
  p8DragonTerror: DRAGON_FORM.terrorVsLowerPrestige,
});

module.exports = {
  EVOLUTION_PRESTIGE_GATE,
  RITUAL_TURNS,
  RITUAL_CHANNEL_DEFENSE_MULT,
  DRAGON_EGG_ITEM_ID,
  DRAGON_EGG_ITEM_NAME,
  EGG_TREK_ARTIFACT_WEIGHT,
  DRAGON_FORM,
  FIXED_ARMY_BUDGET,
};
