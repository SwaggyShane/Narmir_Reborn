// game/visibility-migration.js
// Fog of War visibility schema versioning and migration logic

const VISIBILITY_SCHEMA_VERSION = 1;

// Default visibility structure for new saves
const DEFAULT_VISIBILITY = {
  seen_cells: null, // BigInt bitmap: cells discovered (permanent memory)
  current_cells: null, // BigInt bitmap: cells visible now (derived from active sources)
  version: VISIBILITY_SCHEMA_VERSION,
};

/**
 * Migrate a visibility object to the current schema version.
 * Called when loading a save — checks version and applies migration steps if needed.
 *
 * @param {object} oldVisibility - Visibility data from the save (may be old schema)
 * @returns {object} - Migrated visibility object with current schema
 */
function migrateVisibility(oldVisibility) {
  if (!oldVisibility) {
    return { ...DEFAULT_VISIBILITY };
  }

  const currentVersion = oldVisibility.version || 0;

  // No migrations yet (v0 → v1 is implicit: just add default fields)
  if (currentVersion === VISIBILITY_SCHEMA_VERSION) {
    return oldVisibility;
  }

  // Placeholder for future migrations as schema evolves
  // Example pattern:
  // if (currentVersion < 2) {
  //   visibility = migrateV1toV2(visibility);
  // }
  // if (currentVersion < 3) {
  //   visibility = migrateV2toV3(visibility);
  // }

  // Ensure all required fields exist
  return {
    seen_cells: oldVisibility.seen_cells || null,
    current_cells: oldVisibility.current_cells || null,
    version: VISIBILITY_SCHEMA_VERSION,
  };
}

module.exports = {
  VISIBILITY_SCHEMA_VERSION,
  DEFAULT_VISIBILITY,
  migrateVisibility,
};
