/**
 * Structures API response updates into domain-organized format.
 * All endpoints MUST use this before returning responses with updates.
 *
 * Input: flat object like { gold: 100, population: 50, rangers: 20, ... }
 * Output: { economy: { gold: 100 }, population: { population: 50 }, military: { rangers: 20 }, ... }
 */

const profileFields = new Set([
  'turn', 'turns_stored', 'level', 'xp', 'xp_sources', 'scout_progress',
  'score', 'unread_news', 'last_turn_at', 'updated_at',
  'prestige_level', 'last_prestige_turn',
]);

const economyFields = new Set([
  'gold', 'food', 'mana', 'wood', 'stone', 'iron', 'steel', 'coal',
  'maps', 'scrolls', 'blueprints_stored', 'land', 'food_surplus_turns',
  'food_shortage_turns', '_spoilage', 'wall_upgrades', 'tower_def_upgrades',
  'outpost_upgrades', 'mausoleum_upgrades', 'school_upgrades'
]);

const researchFields = new Set([
  'research_focus', 'research_progress', 'library_progress'
]);

const populationFields = new Set([
  'population', 'happiness', 'goals'
]);

const militaryFields = new Set([
  'rangers', 'fighters', 'troop_levels', 'tower_progress', 'mages',
  'clerics', 'thieves', 'ninjas'
]);

/**
 * Structures flat updates object into domain-organized format.
 *
 * @param {Object} flatUpdates - Flat object like { gold: 100, population: 50, ... }
 * @returns {Object} Structured like { economy: { gold: 100 }, population: { population: 50 }, ... }
 */
function structureUpdates(flatUpdates) {
  if (!flatUpdates || typeof flatUpdates !== 'object') {
    return {};
  }

  const structured = {};

  Object.entries(flatUpdates).forEach(([key, value]) => {
    if (profileFields.has(key)) {
      if (!structured.profile) structured.profile = {};
      structured.profile[key] = value;
    } else if (economyFields.has(key)) {
      if (!structured.economy) structured.economy = {};
      structured.economy[key] = value;
    } else if (researchFields.has(key)) {
      if (!structured.research) structured.research = {};
      structured.research[key] = value;
    } else if (populationFields.has(key)) {
      if (!structured.population) structured.population = {};
      structured.population[key] = value;
    } else if (militaryFields.has(key)) {
      if (!structured.military) structured.military = {};
      structured.military[key] = value;
    }
    // Any unknown fields are silently dropped
  });

  return structured;
}

module.exports = { structureUpdates };
