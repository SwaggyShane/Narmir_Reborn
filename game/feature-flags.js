/**
 * Feature Flags - Safe Elevation System Rollout
 * Phase 3 phases (A, B, C) can be toggled independently
 */

const DEFAULT_FLAGS = {
  // Phase 3A: High-ground combat modifier (+7% defense)
  FEATURE_ELEVATION_COMBAT: true,

  // Phase 3B: Movement penalties and elevation fatigue
  FEATURE_ELEVATION_MOVEMENT: true,

  // Phase 3C: Spell LOS checks. Wired into game/magic.js's validateSpellTarget
  // 2026-07-16 — there IS a real player-directed spell-targeting system
  // (castSpell(caster, target, spellId, obscure), routes/kingdom-warfare.js's
  // POST /spell), contrary to this comment's earlier (wrong) claim otherwise.
  FEATURE_ELEVATION_SPELLS: true,
};

let currentFlags = { ...DEFAULT_FLAGS };

/**
 * Load flags from environment or database. An env var of exactly 'true' or
 * 'false' overrides the default; leaving it unset falls through to
 * DEFAULT_FLAGS. Previously this always overwrote every flag regardless of
 * whether the env var was actually set — index.js passes
 * `process.env.FEATURE_ELEVATION_COMBAT` etc. unconditionally, so an unset
 * var (undefined) was compared as `undefined === 'true'` (always false),
 * silently forcing every flag to false no matter what DEFAULT_FLAGS said.
 */
function initializeFlags(envFlags = {}) {
  currentFlags = {
    ...DEFAULT_FLAGS,
    ...Object.keys(envFlags).reduce((acc, key) => {
      if (key in DEFAULT_FLAGS && envFlags[key] !== undefined) {
        acc[key] = envFlags[key] === 'true' || envFlags[key] === true;
      }
      return acc;
    }, {})
  };
}

/**
 * Get all flags
 */
function getFlags() {
  return { ...currentFlags };
}

/**
 * Get single flag
 */
function getFlag(name) {
  return currentFlags[name] || false;
}

/**
 * Set flag (for admin/testing)
 */
function setFlag(name, value) {
  if (name in DEFAULT_FLAGS) {
    currentFlags[name] = value;
  }
}

module.exports = {
  initializeFlags,
  getFlags,
  getFlag,
  setFlag
};
