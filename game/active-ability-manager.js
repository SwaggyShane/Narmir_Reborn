/**
 * Active Ability Manager
 * Handles triggering, cooldown tracking, and effect application for synergy active abilities
 */

const { SYNERGIES } = require('./fragment-synergies');
const attunementManager = require('./attunement-manager');

/**
 * Check if an ability can be triggered (cooldown check)
 */
function canTriggerAbility(kingdom, synergyId) {
  const synergy = SYNERGIES[synergyId];
  if (!synergy) {
    return { ok: false, error: `Synergy '${synergyId}' not found` };
  }

  // Verify synergy is active
  const activeSynergy = attunementManager.getActiveSynergy(kingdom);
  if (!activeSynergy || activeSynergy.id !== synergyId) {
    return { ok: false, error: `Synergy '${synergyId}' is not currently active` };
  }

  // Check cooldown
  const cooldownsJson = kingdom.synergy_cooldowns || '{}';
  let cooldowns = {};
  try {
    cooldowns = JSON.parse(cooldownsJson);
  } catch {
    cooldowns = {};
  }

  const cooldownData = cooldowns[synergyId];
  if (cooldownData && cooldownData.cooldown_until) {
    const now = Date.now();
    if (now < cooldownData.cooldown_until) {
      const daysRemaining = Math.ceil((cooldownData.cooldown_until - now) / (1000 * 60 * 60 * 24));
      return {
        ok: false,
        error: `Ability is on cooldown for ${daysRemaining} more day(s)`,
        cooldownUntil: cooldownData.cooldown_until,
      };
    }
  }

  return { ok: true };
}

/**
 * Validate that kingdom has sufficient resources to pay the cost
 */
function validateAbilityCost(kingdom, synergyId) {
  const synergy = SYNERGIES[synergyId];
  if (!synergy || !synergy.active.cost) {
    return { ok: true };
  }

  const cost = synergy.active.cost;
  const errors = [];

  // Population cost
  if (cost.population) {
    if (kingdom.population < cost.population) {
      errors.push(`Need ${cost.population} population, have ${kingdom.population}`);
    }
  }

  if (cost.population_percent) {
    const required = Math.ceil(kingdom.population * cost.population_percent);
    if (kingdom.population < required) {
      errors.push(`Need ${required} population (${Math.round(cost.population_percent * 100)}%), have ${kingdom.population}`);
    }
  }

  // Mana cost
  if (cost.mana_all) {
    if (kingdom.mana <= 0) {
      errors.push('Need mana to cast, have 0');
    }
  }

  // Troops cost
  if (cost.troops_percent) {
    const totalTroops = getTotalTroops(kingdom);
    const required = Math.ceil(totalTroops * cost.troops_percent);
    if (totalTroops < required) {
      errors.push(`Need ${required} troops (${Math.round(cost.troops_percent * 100)}%), have ${totalTroops}`);
    }
  }

  // Gold cost (if applicable)
  if (cost.gold && kingdom.gold < cost.gold) {
    errors.push(`Need ${cost.gold} gold, have ${kingdom.gold}`);
  }

  if (errors.length > 0) {
    return { ok: false, error: errors.join('; ') };
  }

  return { ok: true };
}

/**
 * Apply ability costs to kingdom
 */
function applyCost(kingdom, synergyId) {
  const synergy = SYNERGIES[synergyId];
  if (!synergy || !synergy.active.cost) {
    return kingdom;
  }

  const cost = synergy.active.cost;
  const updates = {};

  // Population cost
  if (cost.population) {
    updates.population = Math.max(0, kingdom.population - cost.population);
  }

  if (cost.population_percent) {
    const required = Math.ceil(kingdom.population * cost.population_percent);
    updates.population = Math.max(0, kingdom.population - required);
  }

  // Mana cost (consume all or percentage)
  if (cost.mana_all) {
    updates.mana = 0;
  }

  if (cost.mana_percent) {
    updates.mana = Math.ceil(kingdom.mana * (1 - cost.mana_percent));
  }

  // Troops cost
  if (cost.troops_percent) {
    const totalTroops = getTotalTroops(kingdom);
    const toRemove = Math.ceil(totalTroops * cost.troops_percent);
    updates.troop_levels = JSON.stringify(removeTroops(kingdom, toRemove));
  }

  // Stability cost (penalty, not removal)
  if (cost.stability) {
    updates.stability = Math.max(0, (kingdom.stability || 50) + cost.stability);
  }

  // Gold cost
  if (cost.gold) {
    updates.gold = Math.max(0, kingdom.gold - cost.gold);
  }

  // Resource consumption multiplier
  if (cost.resource_consumption_multiplier) {
    // This affects the next turn's consumption (handled in engine)
    updates.active_resource_multiplier = cost.resource_consumption_multiplier;
    updates.active_resource_multiplier_turn = (kingdom.turn || 0) + 1;
  }

  return { ...kingdom, ...updates };
}

/**
 * Apply ability benefits (temporary stat bonuses)
 */
function applyBenefit(kingdom, synergyId) {
  const synergy = SYNERGIES[synergyId];
  if (!synergy || !synergy.active.benefit) {
    return kingdom;
  }

  const benefit = synergy.active.benefit;
  const benefitDuration = synergy.active.benefit_duration_days || 0;
  const updates = {};
  const activeEffects = JSON.parse(kingdom.active_effects || '{}');
  let hasBenefit = false;

  // Food storage fill
  if (benefit.food_storage_fill) {
    updates.food = kingdom.bld_granaries ? kingdom.bld_granaries * 1000 : kingdom.food;
    hasBenefit = true;
  }

  // Population gain
  if (benefit.population_gain) {
    updates.population = kingdom.population + benefit.population_gain;
    hasBenefit = true;
  }

  // Troop bonuses
  if (benefit.troop_damage || benefit.troop_health) {
    activeEffects.synergy_troop_boost = {
      troop_damage: benefit.troop_damage || 0,
      troop_health: benefit.troop_health || 0,
      until_turn: kingdom.turn + benefitDuration,
    };
    hasBenefit = true;
  }

  // Research/Production completion
  if (benefit.complete_all_research) {
    const research = JSON.parse(kingdom.research_progress || '{}');
    const focus = JSON.parse(kingdom.research_focus || '[]');
    focus.forEach(tech => {
      research[tech] = 100;
    });
    updates.research_progress = JSON.stringify(research);
    hasBenefit = true;
  }

  if (benefit.complete_all_production) {
    updates.production_completed = true;
    hasBenefit = true;
  }

  // Universal resource/production/happiness bonuses
  if (benefit.resources || benefit.production || benefit.happiness) {
    activeEffects.synergy_benefit = {
      resources: benefit.resources || 0,
      production: benefit.production || 0,
      happiness: benefit.happiness || 0,
      until_turn: kingdom.turn + benefitDuration,
    };
    hasBenefit = true;
  }

  if (hasBenefit) {
    updates.active_effects = JSON.stringify(activeEffects);
  }

  return { ...kingdom, ...updates };
}

/**
 * Apply ability penalties (temporary stat reductions)
 */
function applyPenalty(kingdom, synergyId) {
  const synergy = SYNERGIES[synergyId];
  if (!synergy || !synergy.active.penalty) {
    return kingdom;
  }

  const penalty = synergy.active.penalty;
  const penaltyDuration = synergy.active.penalty_duration_days || 0;
  const activeEffects = JSON.parse(kingdom.active_effects || '{}');

  // Store penalty info in active_effects
  activeEffects.synergy_penalty = {
    defense: penalty.defense || 0,
    food_production: penalty.food_production || 0,
    all_stats: penalty.all_stats || 0,
    stability: penalty.stability || 0,
    research_locked: penalty.research_locked || false,
    until_turn: kingdom.turn + penaltyDuration,
  };

  return { ...kingdom, active_effects: JSON.stringify(activeEffects) };
}

/**
 * Trigger an active ability
 */
function triggerAbility(kingdom, synergyId) {
  // Validate ability can be triggered
  const cooldownCheck = canTriggerAbility(kingdom, synergyId);
  if (!cooldownCheck.ok) {
    return cooldownCheck;
  }

  // Validate kingdom has resources
  const costCheck = validateAbilityCost(kingdom, synergyId);
  if (!costCheck.ok) {
    return costCheck;
  }

  const synergy = SYNERGIES[synergyId];

  // Apply costs
  let updated = applyCost(kingdom, synergyId);

  // Apply benefits
  updated = applyBenefit(updated, synergyId);

  // Apply penalties
  updated = applyPenalty(updated, synergyId);

  // Set cooldown
  const cooldowns = JSON.parse(updated.synergy_cooldowns || '{}');
  const cooldownDays = synergy.active.cooldown_days || 1;
  const cooldownUntil = Date.now() + (cooldownDays * 24 * 60 * 60 * 1000);

  cooldowns[synergyId] = {
    cooldown_until: cooldownUntil,
    triggered_at: Date.now(),
    triggered_turn: updated.turn,
  };

  updated.synergy_cooldowns = JSON.stringify(cooldowns);

  return {
    ok: true,
    kingdom: updated,
    ability: synergy.active,
    cooldownExpires: new Date(cooldownUntil).toISOString(),
  };
}

/**
 * Get ability cooldown status
 */
function getAbilityCooldown(kingdom, synergyId) {
  const cooldowns = JSON.parse(kingdom.synergy_cooldowns || '{}');
  const cooldownData = cooldowns[synergyId];

  if (!cooldownData || !cooldownData.cooldown_until) {
    return { onCooldown: false };
  }

  const now = Date.now();
  const remaining = cooldownData.cooldown_until - now;

  if (remaining <= 0) {
    return { onCooldown: false, cooldownExpired: true };
  }

  const daysRemaining = Math.ceil(remaining / (1000 * 60 * 60 * 24));
  const hoursRemaining = Math.ceil(remaining / (1000 * 60 * 60));

  return {
    onCooldown: true,
    daysRemaining,
    hoursRemaining,
    cooldownUntil: cooldownData.cooldown_until,
    expiresAt: new Date(cooldownData.cooldown_until).toISOString(),
  };
}

/**
 * Get total troops in kingdom
 */
function getTotalTroops(kingdom) {
  const troops = JSON.parse(kingdom.troop_levels || '{}');
  return Object.values(troops).reduce((sum, count) => sum + (count || 0), 0);
}

/**
 * Remove troops from kingdom
 */
function removeTroops(kingdom, count) {
  const troops = JSON.parse(kingdom.troop_levels || '{}');
  let remaining = count;

  for (const type of Object.keys(troops).reverse()) {
    if (remaining <= 0) break;
    const toRemove = Math.min(remaining, troops[type]);
    troops[type] -= toRemove;
    remaining -= toRemove;
  }

  return troops;
}

module.exports = {
  canTriggerAbility,
  validateAbilityCost,
  applyCost,
  applyBenefit,
  applyPenalty,
  triggerAbility,
  getAbilityCooldown,
};
