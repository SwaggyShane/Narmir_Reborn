// game/scout-economy.js
// Scouting and exploration economy — formulas locked 2026-07-04.
// Concentric ring model: progressive reveal outward from home kingdom.
// Target: full map (195 hexes) in ~328 turns at level 100, ~500 turns casual play.

const SCOUT_ECONOMY = {
  // Vision baseline: home hex only, fog everywhere else. Locked.
  baselineVisibilityRadius: 0,

  // fog_of_war spell (enemy-cast debuff, game/config.js): reduces current
  // visibility to this radius for its 3-turn duration. No tick — the
  // debuff doesn't decay/reapply itself; it must be recast to reapply
  // once it expires. Locked: total blind.
  debuffRadius: 0,

  // Hard cap on rangers a single scout action can use.
  // Locked 2026-07-04: 10,000 rangers (up from 1,000).
  MAX_SCOUTING_RANGERS: 10000,

  // Ranger level improves scouting power:
  // +5% effective power per level above 1 (level 100 = 5.95x base).
  RANGER_LEVEL_BONUS_PER_LEVEL: 0.05,

  // Base exploration unit: 1 ranger level 1 = 0.00001 hexes per action.
  // Locked 2026-07-04 (replaces old REVEAL_RADIUS_DIVISOR model).
  // 10,000 rangers level 1 = 0.1 hexes per action.
  // 10,000 rangers level 100 = 0.595 hexes per action.
  BASE_HEX_EXPLORATION_PER_RANGER: 0.00001,

  // Food cost per hex scouted, reduced by ranger level (floor applied so
  // it never goes to zero).
  BASE_FOOD_COST_PER_HEX: 50,
  MIN_FOOD_COST_PER_HEX: 20,

  // Node delivery: turns = ceil(distance_hexes ^ this). >1 means turns per
  // hex INCREASE with distance (locked decision) — a node twice as far
  // costs more than twice the turns, not the same rate.
  NODE_DELIVERY_EXPONENT: 1.2,

  // DEPRECATED: Old frontier-based reveal radius divisor (replaced by
  // BASE_HEX_EXPLORATION_PER_RANGER for concentric ring model).
  // Kept for backward compatibility with scoutRevealRadius().
  REVEAL_RADIUS_DIVISOR: 12,

  // Active expeditions reveal fog ahead of their movement (pre-move
  // scouting), not just their current tile or the full route retroactively.
  // Locked.
  expeditionRevealMode: 'ahead',
};

/**
 * Effective power multiplier from ranger level (level 1 = 1.0x baseline).
 */
function levelMultiplier(rangerLevel) {
  // Number(undefined) is NaN, but Number(NaN) || 1 is 1 — the || fallback
  // catches NaN/0/undefined/null uniformly so a bad input can never
  // propagate NaN into the formulas below and fail a downstream DB write
  // (applyKingdomUpdates rejects NaN outright).
  const level = Math.max(1, Math.floor(Number(rangerLevel) || 1));
  return 1 + (level - 1) * SCOUT_ECONOMY.RANGER_LEVEL_BONUS_PER_LEVEL;
}

/**
 * Effective scouting power for a given number of rangers sent (capped at
 * MAX_SCOUTING_RANGERS) at a given level.
 */
function scoutEffectivePower(rangersSent, rangerLevel) {
  const rangersUsed = Math.min(Math.max(0, Math.floor(Number(rangersSent) || 0)), SCOUT_ECONOMY.MAX_SCOUTING_RANGERS);
  return rangersUsed * levelMultiplier(rangerLevel);
}

/**
 * Hexes explored per scout action with the given rangers/level.
 * Locked formula 2026-07-04: rangersSent × level multiplier × BASE_HEX_EXPLORATION_PER_RANGER
 * (Replaces old scoutRevealRadius model for concentric ring design.)
 */
function hexesExploredPerAction(rangersSent, rangerLevel) {
  const power = scoutEffectivePower(rangersSent, rangerLevel);
  return power * SCOUT_ECONOMY.BASE_HEX_EXPLORATION_PER_RANGER;
}

/**
 * DEPRECATED: Old frontier-based reveal radius formula.
 * Kept for backward compatibility; use hexesExploredPerAction() for new code.
 */
function scoutRevealRadius(rangersSent, rangerLevel) {
  const power = scoutEffectivePower(rangersSent, rangerLevel);
  return Math.floor(Math.sqrt(power) / SCOUT_ECONOMY.REVEAL_RADIUS_DIVISOR);
}

/**
 * Food cost per hex scouted, discounted by ranger level, floored at
 * MIN_FOOD_COST_PER_HEX.
 */
function scoutFoodCostPerHex(rangerLevel) {
  const cost = SCOUT_ECONOMY.BASE_FOOD_COST_PER_HEX / levelMultiplier(rangerLevel);
  return Math.max(SCOUT_ECONOMY.MIN_FOOD_COST_PER_HEX, Math.floor(cost));
}

/**
 * Turns required to deliver population to a resource node at the given
 * hex-unit distance. Turns-per-hex increases with distance (not a flat
 * per-hex rate) — a node twice as far costs more than double the turns.
 */
function nodeDeliveryTurns(distanceHexes) {
  const distance = Math.max(0, Number(distanceHexes) || 0);
  return Math.ceil(Math.pow(distance, SCOUT_ECONOMY.NODE_DELIVERY_EXPONENT));
}

module.exports = {
  SCOUT_ECONOMY,
  levelMultiplier,
  scoutEffectivePower,
  hexesExploredPerAction,
  scoutRevealRadius, // deprecated; use hexesExploredPerAction
  scoutFoodCostPerHex,
  nodeDeliveryTurns,
};
