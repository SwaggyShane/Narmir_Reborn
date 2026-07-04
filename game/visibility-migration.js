// game/visibility-migration.js
// Fog of War visibility schema versioning and migration logic

// STORAGE FORMAT (Locked): BigInt bitmap
// Each cell in the hex grid (~195 total) is represented by one bit in a BigInt.
// Bit position = cell index; 1 = seen/visible, 0 = unseen/fogged.
// Encode/decode functions convert between BigInt and array of cell indices.
// Example: seen_cells = BigInt(0b101000010001) means cells [0, 4, 12] are seen.

const VISIBILITY_SCHEMA_VERSION = 1;

// Default visibility structure for new saves. "0" (not null) so every
// consumer can go straight to BigInt("0") without a null check — an empty
// bitmap and "nothing seen yet" are the same thing.
const DEFAULT_VISIBILITY = {
  seen_cells: '0', // BigInt bitmap (decimal string): cells discovered (permanent memory)
  current_cells: '0', // BigInt bitmap (decimal string): cells visible now (derived from active sources)
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
    seen_cells: oldVisibility.seen_cells || '0',
    current_cells: oldVisibility.current_cells || '0',
    version: VISIBILITY_SCHEMA_VERSION,
  };
}

module.exports = {
  VISIBILITY_SCHEMA_VERSION,
  DEFAULT_VISIBILITY,
  migrateVisibility,
};
