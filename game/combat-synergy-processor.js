/**
 * Combat Synergy Processor
 * Applies active synergy effects to combat calculations (damage, defense, health)
 */

const attunementManager = require('./attunement-manager');
const { safeJsonParse } = require('../utils/helpers');

function getCombatDamageMultiplier(kingdom) {
  if (!kingdom) return 1.0;

  const synergy = attunementManager.getActiveSynergy(kingdom);
  if (!synergy || !synergy.passive?.effects) return 1.0;

  const effects = synergy.passive.effects;
  let damageMultiplier = 1.0;

  // Apply unit_damage bonus
  if (effects.unit_damage) {
    damageMultiplier *= (1.0 + effects.unit_damage);
  }

  // Apply weapon_potency bonus
  if (effects.weapon_potency) {
    damageMultiplier *= (1.0 + effects.weapon_potency);
  }

  // Apply combat_power bonus
  if (effects.combat_power) {
    damageMultiplier *= (1.0 + effects.combat_power);
  }

  // Apply all_stats bonus (affects everything including combat)
  if (effects.all_stats) {
    damageMultiplier *= (1.0 + effects.all_stats);
  }

  return damageMultiplier;
}

function getDefenseMultiplier(kingdom) {
  if (!kingdom) return 1.0;

  const synergy = attunementManager.getActiveSynergy(kingdom);
  if (!synergy || !synergy.passive?.effects) return 1.0;

  const effects = synergy.passive.effects;
  let defenseMultiplier = 1.0;

  // Apply defense bonus
  if (effects.defense) {
    defenseMultiplier *= (1.0 + effects.defense);
  }

  // Apply armor_potency bonus
  if (effects.armor_potency) {
    defenseMultiplier *= (1.0 + effects.armor_potency);
  }

  // Apply all_stats bonus
  if (effects.all_stats) {
    defenseMultiplier *= (1.0 + effects.all_stats);
  }

  return defenseMultiplier;
}

function getTroopCapacityMultiplier(kingdom) {
  if (!kingdom) return 1.0;

  const synergy = attunementManager.getActiveSynergy(kingdom);
  if (!synergy || !synergy.passive?.effects) return 1.0;

  const effects = synergy.passive.effects;
  let capacityMultiplier = 1.0;

  // Apply troop_capacity bonus
  if (effects.troop_capacity) {
    capacityMultiplier *= (1.0 + effects.troop_capacity);
  }

  // Apply all_stats bonus
  if (effects.all_stats) {
    capacityMultiplier *= (1.0 + effects.all_stats);
  }

  return capacityMultiplier;
}

function getActiveCombatBonus(kingdom) {
  if (!kingdom || !kingdom.active_effects) return { damage: 1.0, health: 1.0 };

  const activeEffects = safeJsonParse(kingdom.active_effects, {}, 'getActiveCombatBonus:active_effects');
  let damageBonus = 1.0;
  let healthBonus = 1.0;

  // Check synergy_benefit for combat bonuses
  if (activeEffects.synergy_benefit) {
    const benefits = activeEffects.synergy_benefit;

    if (benefits.troop_damage) {
      damageBonus *= (1.0 + benefits.troop_damage);
    }

    if (benefits.troop_health) {
      healthBonus *= (1.0 + benefits.troop_health);
    }

    if (benefits.combat_power) {
      damageBonus *= (1.0 + benefits.combat_power);
    }
  }

  // Apply penalties as divisors (negative effects reduce bonus)
  if (activeEffects.synergy_penalty) {
    const penalties = activeEffects.synergy_penalty;

    if (penalties.troop_damage) {
      damageBonus *= Math.max(0.1, 1.0 + penalties.troop_damage);
    }

    if (penalties.troop_health) {
      healthBonus *= Math.max(0.1, 1.0 + penalties.troop_health);
    }

    if (penalties.combat_power) {
      damageBonus *= Math.max(0.1, 1.0 + penalties.combat_power);
    }
  }

  return { damage: damageBonus, health: healthBonus };
}

module.exports = {
  getCombatDamageMultiplier,
  getDefenseMultiplier,
  getTroopCapacityMultiplier,
  getActiveCombatBonus,
};
