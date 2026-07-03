// game/scout-economy.js
// Scouting and exploration economy — formulas locked 2026-07-03, values are
// a starting point to be tuned via playtesting (target: ~500 turns for a
// casual player to fully explore the map, see FOG_OF_WAR_PLAN.md).

const SCOUT_ECONOMY = {
  // Vision baseline: home hex only, fog everywhere else. Locked.
  baselineVisibilityRadius: 0,

  // fog_of_war spell (enemy-cast debuff, game/config.js): reduces current
  // visibility to this radius for its 3-turn duration. No tick — the
  // debuff doesn't decay/reapply itself; it must be recast to reapply
  // once it expires. Locked: total blind.
  debuffRadius: 0,

  // Hard cap on rangers a single scout action can use, regardless of how
  // many the kingdom actually has.
  MAX_SCOUTING_RANGERS: 1000,

  // Ranger level improves both scouting radius AND food cost efficiency:
  // +5% effective power per level above 1 (level 20 rangers ≈ 1.95x a
  // level-1 ranger's effective scouting power).
  RANGER_LEVEL_BONUS_PER_LEVEL: 0.05,

  // Reveal radius = floor(sqrt(effective_power) / this). Divisor chosen so
  // a full 1000-ranger scout action (level 1) reveals ~2 hexes, scaling up
  // modestly with ranger level — tune this divisor first if exploration
  // feels too fast/slow relative to the ~500-turn target.
  REVEAL_RADIUS_DIVISOR: 12,

  // Food cost per hex scouted, reduced by ranger level (floor applied so
  // it never goes to zero).
  BASE_FOOD_COST_PER_HEX: 50,
  MIN_FOOD_COST_PER_HEX: 20,

  // Node delivery: turns = ceil(distance_hexes ^ this). >1 means turns per
  // hex INCREASE with distance (locked decision) — a node twice as far
  // costs more than twice the turns, not the same rate.
  NODE_DELIVERY_EXPONENT: 1.2,

  // Active expeditions reveal fog ahead of their movement (pre-move
  // scouting), not just their current tile or the full route retroactively.
  // Locked.
  expeditionRevealMode: 'ahead',
};

/**
 * Effective power multiplier from ranger level (level 1 = 1.0x baseline).
 */
function levelMultiplier(rangerLevel) {
  const level = Math.max(1, rangerLevel);
  return 1 + (level - 1) * SCOUT_ECONOMY.RANGER_LEVEL_BONUS_PER_LEVEL;
}

/**
 * Effective scouting power for a given number of rangers sent (capped at
 * MAX_SCOUTING_RANGERS) at a given level.
 */
function scoutEffectivePower(rangersSent, rangerLevel) {
  const rangersUsed = Math.min(Math.max(0, rangersSent), SCOUT_ECONOMY.MAX_SCOUTING_RANGERS);
  return rangersUsed * levelMultiplier(rangerLevel);
}

/**
 * Reveal radius (in hexes) for a scout action with the given rangers/level.
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
  return Math.ceil(Math.pow(Math.max(0, distanceHexes), SCOUT_ECONOMY.NODE_DELIVERY_EXPONENT));
}

module.exports = {
  SCOUT_ECONOMY,
  levelMultiplier,
  scoutEffectivePower,
  scoutRevealRadius,
  scoutFoodCostPerHex,
  nodeDeliveryTurns,
};
