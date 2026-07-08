// game/lib/healing.js
// Defensive JSON healing / repair logic extracted from processTurn (M1-3 audit item).
// Purpose: centralize and make testable the logic that recovers from double-stringified
// (or deeper nested) JSON columns that occasionally appear in kingdom rows due to
// prior bugs, direct DB writes, or migration artifacts.
//
// Common affected columns: troop_levels, xp_sources, build_queue, active_effects,
// research_*, school_upgrades, etc.
//
// Design:
// - Built on top of safeJsonParse (with its cache + error logging).
// - cleanNestedJson: repeatedly parses while the result is still a string.
// - Higher level helpers can be added here for "prepare kingdom input" or "normalize updates".
// - Pure, no DB I/O, safe to unit test.
// - Always prefer object form inside processTurn; stringify only at persistence time.

const { safeJsonParse } = require('../../utils/helpers');

/**
 * Heals a potentially nested-stringified JSON value.
 * Supports both objects and arrays (e.g. collected_lore, bank_deposits).
 * Repeatedly parses while the result is still a string (handles '"{...}"' or '"[1,2]"' etc.).
 *
 * @param {string|object} raw - The raw value from DB/row (may be double-stringified).
 * @param {object|array} [fallback={}] - Value to use on total failure.
 * @param {string} [context='unknown'] - For error logging.
 * @param {boolean} [returnString=false] - If true, return a JSON string (rare for internal turn logic).
 * @returns {object|array|string} Healed value in preferred form, or raw on unrecoverable.
 */
function cleanNestedJson(raw, fallback = {}, context = 'unknown', returnString = false) {
  let val = safeJsonParse(raw, fallback, context);
  while (typeof val === "string") {
    val = safeJsonParse(val, fallback, context + '_nested');
  }
  if (val != null && typeof val === "object") {
    // Supports plain objects and arrays
    return returnString ? JSON.stringify(val) : val;
  }
  // Preserve original raw on failure (defensive; callers expect to not lose data)
  return raw;
}

/**
 * Heals the most common JSON fields on a kingdom input at the start of turn processing.
 * Returns a shallow copy with healed fields (does not mutate input).
 * All healed values are returned as native objects/arrays (preferred inside processTurn).
 * Stringification happens only when writing updates back to DB.
 *
 * This centralizes defensive recovery from double-/nested-stringified columns
 * caused by historical bugs, migrations, or manual DB edits.
 */
function healKingdomForTurn(k = {}) {
  if (!k || typeof k !== 'object') return k;

  const healed = { ...k };

  const XP_SOURCES_DEFAULT = {
    turn: 0, gold_earned: 0, combat_win: 0, combat_loss: 0,
    research: 0, construction: 0, exploration: 0, spell_cast: 0, covert_op: 0
  };

  // Core fields with known nesting risk (healed to native objects/arrays)
  healed.troop_levels = cleanNestedJson(k.troop_levels, {}, 'heal:troop_levels', false);
  healed.xp_sources = cleanNestedJson(k.xp_sources, XP_SOURCES_DEFAULT, 'heal:xp_sources', false);
  healed.build_queue = cleanNestedJson(k.build_queue || '{}', {}, 'heal:build_queue', false);

  healed.active_effects = cleanNestedJson(k.active_effects, {}, 'heal:active_effects', false);
  healed.active_event = cleanNestedJson(k.active_event, {}, 'heal:active_event', false);
  healed.collected_lore = cleanNestedJson(k.collected_lore, [], 'heal:collected_lore', false);

  healed.school_upgrades = cleanNestedJson(k.school_upgrades, {}, 'heal:school_upgrades', false);
  healed.research_focus = cleanNestedJson(k.research_focus, [], 'heal:research_focus', false);
  healed.research_progress = cleanNestedJson(k.research_progress, {}, 'heal:research_progress', false);
  healed.milestone_bonuses = cleanNestedJson(k.milestone_bonuses, {}, 'heal:milestone_bonuses', false);

  healed.bank_deposits = cleanNestedJson(k.bank_deposits, [], 'heal:bank_deposits', false);
  healed.training_allocation = cleanNestedJson(k.training_allocation, {}, 'heal:training_allocation', false);
  healed.research_allocation = cleanNestedJson(k.research_allocation, {}, 'heal:research_allocation', false);
  healed.mage_research_progress = cleanNestedJson(k.mage_research_progress, {}, 'heal:mage_research_progress', false);

  healed.racial_bonuses_unlocked = cleanNestedJson(k.racial_bonuses_unlocked, {}, 'heal:racial_bonuses_unlocked', false);

  // Additional commonly parsed kingdom JSON columns (defensive)
  healed.discovered_kingdoms = cleanNestedJson(k.discovered_kingdoms, {}, 'heal:discovered_kingdoms', false);
  healed.location_maps_wip = cleanNestedJson(k.location_maps_wip, [], 'heal:location_maps_wip', false);

  // For fields that are always treated as objects inside logic, prefer object form here.
  // Callers inside processTurn (and ensureObject) will benefit from pre-healed values.

  return healed;
}

/**
 * Ensures a value that should be a plain object is one (after healing).
 * Useful after pulling from updates vs k or when mixing healed + raw data.
 */
function ensureObject(val, fallback = {}) {
  if (val && typeof val === 'object' && !Array.isArray(val)) return val;
  if (typeof val === 'string') {
    const parsed = safeJsonParse(val, fallback, 'ensureObject');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  }
  return fallback;
}

/**
 * Ensures a value that should be an array is one (after healing).
 * Complements ensureObject for fields like collected_lore, bank_deposits, etc.
 */
function ensureArray(val, fallback = []) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    const parsed = safeJsonParse(val, fallback, 'ensureArray');
    if (Array.isArray(parsed)) return parsed;
  }
  return fallback;
}

// Common defaults (exported so processTurn and other callers can reuse without duplication)
const XP_SOURCES_DEFAULT = {
  turn: 0, gold_earned: 0, combat_win: 0, combat_loss: 0,
  research: 0, construction: 0, exploration: 0, spell_cast: 0, covert_op: 0
};

/**
 * Specialized healer + normalizer for xp_sources (very frequently used in processTurn).
 */
function getXpSources(raw) {
  const val = cleanNestedJson(raw, XP_SOURCES_DEFAULT, 'xp_sources', false);
  if (!val || typeof val !== "object" || Array.isArray(val)) {
    return { ...XP_SOURCES_DEFAULT };
  }
  return val;
}

module.exports = {
  cleanNestedJson,
  healKingdomForTurn,
  ensureObject,
  ensureArray,
  XP_SOURCES_DEFAULT,
  getXpSources,
};
