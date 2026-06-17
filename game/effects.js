/**
 * Active Effects System
 * Handles temporary effects decay, expiry, and application each turn
 */

const { safeJsonParse } = require("../utils/helpers");
const fragmentBonusManager = require("./fragment-bonus-manager");

function processActiveEffects(k, events) {
  let effects = {};
  try {
    effects = safeJsonParse(k.active_effects, {}, "auto:active_effects");
  } catch {
    effects = {};
  }
  if (Object.keys(effects).length === 0) return {};

  const updates = {};
  const expired = [];

  for (const [effect, data] of Object.entries(effects)) {
    const remaining = (data.turns_left || 1) - 1;
    if (remaining <= 0) {
      expired.push(effect);
      events.push({
        type: "system",
        message: `The ${effect.replace("_", " ")} effect on your kingdom has expired.`,
      });
    } else {
      // Apply ongoing effect
      if (effect === "blight") {
        const upgrades = safeJsonParse(
          k.granary_upgrades,
          {},
          "processTurn:granary_upgrades",
        );
        const damage = (updates._blightDamaged = Math.floor(
          (data.damage ?? 500) * (upgrades.segregation ? 0.5 : 1.0),
        ));
        updates.food = Math.max(
          0,
          (updates.food !== undefined ? updates.food : k.food) - damage,
        );
      } else if (effect === "plague") {
        let lost = Math.floor(k.population * 0.02);
        // Special housing effects (Celestial Feather: Holy Sanctuaries, Ancient Elven Wood: Treehouse Canopy)
        const activeHousingSpecial = fragmentBonusManager.getSpecialEffect(k, 'housing');
        if (activeHousingSpecial?.name === "Holy Sanctuaries") {
          lost = Math.floor(lost * 0.2); // 80% reduction in plague loss
        } else if (activeHousingSpecial?.name === "Treehouse Canopy") {
          lost = Math.floor(lost * 0.5); // 50% reduction in plague loss
        }
        const currentPop = updates.population !== undefined ? updates.population : k.population;
        updates.population = Math.max(0, currentPop - lost);
        events.push({
          type: "attack",
          message: `🧟 🌪️ Plague ravages your kingdom — ${lost.toLocaleString()} citizens have perished.`,
        });
      } else if (effect === "silence") {
        // Research suppressed — handled in processTurn by checking for silence
      } else if (effect === "summon_rats") {
        const foodDmg = data.food_damage_per_turn ?? 0;
        if (foodDmg > 0) {
          updates.food = Math.max(0, (updates.food !== undefined ? updates.food : k.food) - foodDmg);
          events.push({ type: "attack", message: `🏹 ✗ Summoned rats devour ${foodDmg.toLocaleString()} food from your stores.` });
        }
      } else if (effect === "life_drain_aura") {
        const drainPct = data.population_drain ?? 0.1;
        const lost = Math.floor(k.population * drainPct);
        if (lost > 0) {
          updates.population = Math.max(0, (updates.population !== undefined ? updates.population : k.population) - lost);
          events.push({ type: "attack", message: `🏹 ™ Life drain aura saps ${lost.toLocaleString()} population from your kingdom.` });
        }
      } else if (effect === "mutate_crops") {
        const penalty = data.food_penalty ?? 0.3;
        const foodLost = Math.floor(k.food * penalty);
        if (foodLost > 0) {
          updates.food = Math.max(0, (updates.food !== undefined ? updates.food : k.food) - foodLost);
          events.push({ type: "attack", message: `🏹 ??? Mutated crops rot — ${foodLost.toLocaleString()} food spoiled.` });
        }
      } else if (effect === "command_legion") {
        const friendlyFire = data.damage_per_turn ?? 0;
        if (friendlyFire > 0) {
          updates.fighters = Math.max(0, (updates.fighters !== undefined ? updates.fighters : k.fighters) - friendlyFire);
          events.push({ type: "attack", message: `🔶 ⚔️ Command legion confusion — ${friendlyFire.toLocaleString()} fighters lost to friendly fire.` });
        }
      } else if (effect === "conjure_abundance") {
        // Unlimited food: generate food equal to 20% of population each turn
        const foodGenerated = Math.floor(k.population * 0.2);
        updates.food = (updates.food !== undefined ? updates.food : k.food) + foodGenerated;
        events.push({ type: "system", message: `🏹 ™ ¾ Conjured abundance generates ${foodGenerated.toLocaleString()} food.` });
      } else if (effect === "death_dominion") {
        // Enemy deaths reanimate under control — bonus fighters each turn based on flag
        const bonusFighters = Math.floor(k.fighters * 0.01);
        if (bonusFighters > 0) {
          updates.fighters = (updates.fighters !== undefined ? updates.fighters : k.fighters) + bonusFighters;
        }
      }
      effects[effect] = { ...data, turns_left: remaining };
    }
  }

  expired.forEach((e) => delete effects[e]);
  updates.active_effects = JSON.stringify(effects);
  return updates;
}

module.exports = {
  processActiveEffects,
};
