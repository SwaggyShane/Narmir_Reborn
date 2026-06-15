// Constants loader — merges database overrides with config.js defaults
// Keeps game logic using a single source of truth for constants

const config = require('./config');
const { EDITABLE_CONSTANTS } = require('./constants-schema');

// In-memory merged constants (updated when admin makes changes)
let mergedConstants = null;

// Rebuild merged constants from config + database overrides
async function rebuildMergedConstants(db) {
  // Start with deep copy of config (JSON round-trip intentionally used here:
  // config contains function values in some sections; structuredClone throws
  // on functions, whereas JSON.parse/stringify silently drops them — which is
  // the correct behaviour since those sections are never overridden via DB)
  mergedConstants = JSON.parse(JSON.stringify(config));

  if (!db) return mergedConstants;

  try {
    // Fetch all active overrides from database
    const overrides = await db.all(`
      SELECT section, constant_key, override_value, data_type
      FROM admin_game_constants
      ORDER BY section, constant_key
    `);

    // Apply each override
    for (const override of overrides) {
      const value = parseFloat(override.override_value);

      // Handle nested keys (e.g., 'COMBAT_CONSTANTS.baseAttackCost')
      const keys = override.constant_key.split('.');
      let target = mergedConstants;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!target[keys[i]]) {
          target[keys[i]] = {};
        }
        target = target[keys[i]];
      }

      target[keys[keys.length - 1]] = value;
    }

    return mergedConstants;
  } catch (err) {
    console.error('[constants-loader] Error rebuilding merged constants:', err);
    return mergedConstants || config;
  }
}

// Initialize on server startup
async function initializeConstants(db) {
  return rebuildMergedConstants(db);
}

// Get current merged constants
function getConstants() {
  return mergedConstants || config;
}

// Get a specific constant value by path (e.g., 'UNIT_COST' or 'COMBAT_CONSTANTS.baseAttackCost')
function getConstant(path) {
  const constants = getConstants();
  const keys = path.split('.');
  let value = constants;

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return undefined;
    }
  }

  return value;
}

// Refresh constants from database (called after admin updates)
async function refreshConstants(db) {
  return rebuildMergedConstants(db);
}

// Get all constants for a section with override status
function getConstantsForSection(section, overrides = []) {
  const sectionDefs = EDITABLE_CONSTANTS[section] || {};

  const result = {};

  for (const [_key, def] of Object.entries(sectionDefs)) {
    const keys = def.key.split('.');
    let value = getConstant(def.key);

    const override = overrides.find(
      o => o.section === section && o.constant_key === def.key
    );

    result[def.key] = {
      label: def.label,
      value: value,
      defaultValue: JSON.parse(JSON.stringify(config))[keys[0]]?.[keys[1]] || value,
      isOverridden: !!override,
      min: def.min,
      max: def.max,
      step: def.step,
      description: def.description,
      type: def.type,
      editable: def.editable,
    };
  }

  return result;
}

module.exports = {
  initializeConstants,
  getConstants,
  getConstant,
  refreshConstants,
  rebuildMergedConstants,
  getConstantsForSection,
};
