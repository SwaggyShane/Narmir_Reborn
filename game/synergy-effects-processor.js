/**
 * Synergy Effects Processor
 * Applies active ability effects and penalties to kingdom calculations
 */

/**
 * Safely parse a JSON field
 */
function parseJsonField(field, defaultValue = {}) {
  if (typeof field === 'object' && field !== null) {
    return field;
  }
  if (typeof field === 'string' && field.trim() !== '') {
    try {
      return JSON.parse(field);
    } catch {
      return defaultValue;
    }
  }
  return defaultValue;
}

/**
 * Get active effects that haven't expired
 */
function getActiveEffects(kingdom) {
  const activeEffects = parseJsonField(kingdom.active_effects, {});
  const currentTurn = kingdom.turn || 0;
  const active = {};

  // Synergy troop boost (temporary benefit)
  if (activeEffects.synergy_troop_boost && activeEffects.synergy_troop_boost.until_turn > currentTurn) {
    active.synergy_troop_boost = activeEffects.synergy_troop_boost;
  }

  // Synergy benefit (temporary stat bonuses)
  if (activeEffects.synergy_benefit && activeEffects.synergy_benefit.until_turn > currentTurn) {
    active.synergy_benefit = activeEffects.synergy_benefit;
  }

  // Synergy penalty (temporary stat reductions)
  if (activeEffects.synergy_penalty && activeEffects.synergy_penalty.until_turn > currentTurn) {
    active.synergy_penalty = activeEffects.synergy_penalty;
  }

  return active;
}

/**
 * Get expired effects that should be removed
 */
function getExpiredEffects(kingdom) {
  const activeEffects = parseJsonField(kingdom.active_effects, {});
  const currentTurn = kingdom.turn || 0;
  const expired = [];

  if (activeEffects.synergy_troop_boost && activeEffects.synergy_troop_boost.until_turn <= currentTurn) {
    expired.push('synergy_troop_boost');
  }

  if (activeEffects.synergy_benefit && activeEffects.synergy_benefit.until_turn <= currentTurn) {
    expired.push('synergy_benefit');
  }

  if (activeEffects.synergy_penalty && activeEffects.synergy_penalty.until_turn <= currentTurn) {
    expired.push('synergy_penalty');
  }

  return expired;
}

/**
 * Clean up expired effects from kingdom state
 */
function removeExpiredEffects(kingdom) {
  const expired = getExpiredEffects(kingdom);
  if (expired.length === 0) {
    return kingdom;
  }

  const activeEffects = parseJsonField(kingdom.active_effects, {});
  for (const key of expired) {
    delete activeEffects[key];
  }

  return {
    ...kingdom,
    active_effects: JSON.stringify(activeEffects),
  };
}

/**
 * Apply synergy troop boost effect (damage and health multiplier)
 */
function getTroopBoostMultiplier(kingdom, stat) {
  const active = getActiveEffects(kingdom);
  if (!active.synergy_troop_boost) {
    return 1.0;
  }

  const boost = active.synergy_troop_boost;
  if (stat === 'damage' && boost.troop_damage) {
    return 1.0 + boost.troop_damage;
  }
  if (stat === 'health' && boost.troop_health) {
    return 1.0 + boost.troop_health;
  }

  return 1.0;
}

/**
 * Apply synergy benefit effect (resources, production, happiness bonuses)
 */
function getBenefitMultiplier(kingdom, stat) {
  const active = getActiveEffects(kingdom);
  if (!active.synergy_benefit) {
    return 1.0;
  }

  const benefit = active.synergy_benefit;
  if (stat === 'resources' && benefit.resources) {
    return 1.0 + benefit.resources;
  }
  if (stat === 'production' && benefit.production) {
    return 1.0 + benefit.production;
  }

  return 1.0;
}

/**
 * Apply synergy benefit happiness bonus (absolute value)
 */
function getBenefitHappinessBonus(kingdom) {
  const active = getActiveEffects(kingdom);
  if (!active.synergy_benefit || !active.synergy_benefit.happiness) {
    return 0;
  }

  return active.synergy_benefit.happiness;
}

/**
 * Apply synergy penalty effect (stat reductions)
 */
function getPenaltyMultiplier(kingdom, stat) {
  const active = getActiveEffects(kingdom);
  if (!active.synergy_penalty) {
    return 1.0;
  }

  const penalty = active.synergy_penalty;
  if (stat === 'defense' && penalty.defense) {
    return Math.max(0, 1.0 + penalty.defense); // Prevent going negative
  }
  if (stat === 'food_production' && penalty.food_production) {
    return Math.max(0, 1.0 + penalty.food_production);
  }
  if (stat === 'all_stats' && penalty.all_stats) {
    return Math.max(0, 1.0 + penalty.all_stats);
  }

  return 1.0;
}

/**
 * Check if research is locked by penalty
 */
function isResearchLocked(kingdom) {
  const active = getActiveEffects(kingdom);
  if (!active.synergy_penalty) {
    return false;
  }

  return active.synergy_penalty.research_locked === true;
}

/**
 * Apply all synergy effects to a calculated value
 * Used for multiplicative bonuses (gold, mana, food, etc)
 */
function applyMultiplicativeEffects(kingdom, value, statType) {
  let result = value;

  // Apply benefit multiplier
  const benefitMult = getBenefitMultiplier(kingdom, statType);
  result *= benefitMult;

  // Apply penalty multiplier
  const penaltyMult = getPenaltyMultiplier(kingdom, statType);
  result *= penaltyMult;

  return Math.floor(result);
}

/**
 * Get combined effect multiplier for a stat
 * Useful for applying multiple effects at once
 */
function getCombinedMultiplier(kingdom, stat) {
  let mult = 1.0;

  // Benefit multiplier
  if (stat === 'resources' || stat === 'production') {
    mult *= getBenefitMultiplier(kingdom, stat);
  }

  // Penalty multiplier
  if (stat === 'defense' || stat === 'food_production' || stat === 'all_stats') {
    mult *= getPenaltyMultiplier(kingdom, stat);
  }

  // Troop stats
  if (stat === 'damage' || stat === 'health') {
    mult *= getTroopBoostMultiplier(kingdom, stat);
  }

  return Math.max(0, mult);
}

module.exports = {
  parseJsonField,
  getActiveEffects,
  getExpiredEffects,
  removeExpiredEffects,
  getTroopBoostMultiplier,
  getBenefitMultiplier,
  getBenefitHappinessBonus,
  getPenaltyMultiplier,
  isResearchLocked,
  applyMultiplicativeEffects,
  getCombinedMultiplier,
};
