/**
 * Feature Flags - Safe Elevation System Rollout
 * Phase 3 phases (A, B, C) can be toggled independently
 */

const DEFAULT_FLAGS = {
  // Phase 3A: High-ground combat modifier (+7% defense)
  FEATURE_ELEVATION_COMBAT: false,

  // Phase 3B: Movement penalties and elevation fatigue
  FEATURE_ELEVATION_MOVEMENT: false,

  // Phase 3C: Spell LOS checks and siege bonuses
  FEATURE_ELEVATION_SPELLS: false,
};

let currentFlags = { ...DEFAULT_FLAGS };

/**
 * Load flags from environment or database
 */
function initializeFlags(envFlags = {}) {
  currentFlags = {
    ...DEFAULT_FLAGS,
    ...Object.keys(envFlags).reduce((acc, key) => {
      if (key in DEFAULT_FLAGS) {
        acc[key] = envFlags[key] === 'true' || envFlags[key] === true;
      }
      return acc;
    }, {})
  };
  console.log('[feature-flags] Initialized:', currentFlags);
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
    console.log(`[feature-flags] ${name} = ${value}`);
  }
}

module.exports = {
  initializeFlags,
  getFlags,
  getFlag,
  setFlag
};
