// game/json-cache.js
// Slice 6: JSON field caching to reduce per-turn parsing overhead (Phase 2, Tier 3).
// Parses JSON fields once, reuses throughout turn processing.

const { safeJsonParse } = require('../utils/helpers');

/**
 * Cache parsed JSON fields from kingdom row.
 * Avoids repeated safeJsonParse() calls during turn processing.
 *
 * @param {object} kingdom - Kingdom row with JSON fields
 * @returns {object} Cached parsed values
 */
function createJsonCache(kingdom) {
  const cache = {};

  // Define JSON fields that need caching
  const jsonFields = [
    'troop_levels',
    'xp_sources',
    'build_queue',
    'active_effects',
    'active_event',
    'collected_lore',
    'school_upgrades',
    'research_focus',
    'research_progress',
    'milestone_bonuses',
    'bank_deposits',
    'training_allocation',
    'research_allocation',
    'mage_research_progress',
    'racial_bonuses_unlocked',
    'discovered_kingdoms',
    'location_maps_wip'
  ];

  // Parse each field once
  jsonFields.forEach(field => {
    const rawValue = kingdom[field];
    if (rawValue === null || rawValue === undefined) {
      cache[field] = {};
    } else if (typeof rawValue === 'object') {
      cache[field] = rawValue;
    } else {
      cache[field] = safeJsonParse(rawValue, {}, `json-cache:${field}`);
    }
  });

  return cache;
}

/**
 * Update kingdom object with cached values.
 * After parsing, merge cached values back into kingdom for system access.
 *
 * @param {object} kingdom - Kingdom object to update
 * @param {object} cache - Cached parsed values
 */
function applyCachedValues(kingdom, cache) {
  Object.assign(kingdom, cache);
}

/**
 * Get a cached JSON field value.
 * @param {object} cache - Cache object from createJsonCache()
 * @param {string} field - Field name
 * @param {*} fallback - Default if not in cache
 * @returns {*} Cached value or fallback
 */
function getCachedValue(cache, field, fallback = {}) {
  return cache[field] !== undefined ? cache[field] : fallback;
}

/**
 * Merge updates into cache (for systems that modify fields during turn).
 * @param {object} cache - Cache object
 * @param {object} updates - New values to merge
 */
function mergeIntoCache(cache, updates) {
  Object.assign(cache, updates);
}

module.exports = {
  createJsonCache,
  applyCachedValues,
  getCachedValue,
  mergeIntoCache,
};
