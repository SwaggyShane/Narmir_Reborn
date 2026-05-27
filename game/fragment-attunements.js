/**
 * World Fragment Attunement System
 * Thin wrapper around existing FRAGMENT_BONUSES for attunement management.
 * Reuses constants from world-fragment-bonuses.js to avoid duplication.
 */

const FRAGMENT_BONUSES = require('./world-fragment-bonuses');

/**
 * Fragment metadata for UI display
 * Consolidated with constants from world-fragment-bonuses.js
 */
const FRAGMENT_METADATA = {
  'Volcanic Rock': { emoji: '🔥', element: 'Fire' },
  'Ancient Elven Wood': { emoji: '🌲', element: 'Nature' },
  'Dragon Scale': { emoji: '🐉', element: 'Draconic' },
  'Abyssal Crystal': { emoji: '🔮', element: 'Dark' },
  'Celestial Feather': { emoji: '🪶', element: 'Light' },
  'Dwarven Star-Metal': { emoji: '⭐', element: 'Metal' },
  'Cursed Bloodstone': { emoji: '🩸', element: 'Blood' },
  'Tears of the World Tree': { emoji: '💧', element: 'Water' },
  'Void Essence': { emoji: '🌌', element: 'Cosmic' },
  'Titan Bone': { emoji: '🦴', element: 'Primordial' },
};

/**
 * Get all available fragments from the shared FRAGMENT_BONUSES system
 */
function getAvailableFragments() {
  return Object.keys(FRAGMENT_BONUSES);
}

/**
 * Get building attunement for a fragment
 * Reuses existing FRAGMENT_BONUSES structure
 */
function getFragmentBuildingBonus(fragmentName, buildingType) {
  if (!FRAGMENT_BONUSES[fragmentName]) return null;
  return FRAGMENT_BONUSES[fragmentName][buildingType] || null;
}

/**
 * Get fragment metadata for UI display
 */
function getFragmentMetadata(fragmentName) {
  return FRAGMENT_METADATA[fragmentName] || null;
}

/**
 * Validate fragment name exists
 */
function isValidFragment(fragmentName) {
  return FRAGMENT_BONUSES.hasOwnProperty(fragmentName);
}

/**
 * Get all attunement effects for a kingdom
 * Returns object with building type -> fragment mapping
 * FIXED: Properly handles null values from JSON.parse
 */
function getKingdomAttunements(attunementJson) {
  try {
    if (!attunementJson) return {};
    const parsed = typeof attunementJson === 'string' ? JSON.parse(attunementJson) : attunementJson;
    // Ensure parsed value is a non-null object
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Check if a fragment is already attuned in the kingdom
 */
function isFragmentAttuned(kingdomAttunements, fragmentName) {
  const attunements = getKingdomAttunements(kingdomAttunements);
  return Object.values(attunements).includes(fragmentName);
}

/**
 * Get the building that has a specific fragment attuned
 */
function getFragmentAttunedBuilding(kingdomAttunements, fragmentName) {
  const attunements = getKingdomAttunements(kingdomAttunements);
  return Object.entries(attunements).find(([_, frag]) => frag === fragmentName)?.[0] || null;
}

module.exports = {
  FRAGMENT_BONUSES,
  FRAGMENT_METADATA,
  getAvailableFragments,
  getFragmentBuildingBonus,
  getFragmentMetadata,
  isValidFragment,
  getKingdomAttunements,
  isFragmentAttuned,
  getFragmentAttunedBuilding,
};
