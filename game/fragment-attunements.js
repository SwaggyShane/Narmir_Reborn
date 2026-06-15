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
  'Volcanic Rock': { emoji: '🔥', element: 'Fire', description: 'Fire, Creation, Forge, Transformation through Heat' },
  'Ancient Elven Wood': { emoji: '🌲', element: 'Nature', description: 'Nature, Magic, Growth, Timelessness, Grace' },
  'Dragon Scale': { emoji: '🐉', element: 'Draconic', description: 'Power, Combat, Dominance, Draconic Might' },
  'Abyssal Crystal': { emoji: '🔮', element: 'Dark', description: 'Void, Chaos, Forbidden Power, High Risk/High Reward' },
  'Celestial Feather': { emoji: '🪶', element: 'Light', description: 'Light, Hope, Divine Blessing, Integrity' },
  'Dwarven Star-Metal': { emoji: '⭐', element: 'Metal', description: 'Craftsmanship, Eternal Quality, Fortress Defense' },
  'Cursed Bloodstone': { emoji: '🩸', element: 'Blood', description: 'Sacrifice, Dark Magic, Blood Rituals, Relentless War' },
  'Tears of the World Tree': { emoji: '💧', element: 'Water', description: 'Life, Healing, Renewal, Infinite Growth' },
  'Void Essence': { emoji: '🌌', element: 'Cosmic', description: 'Ultimate Power, Chaos, Reality Warping, Total Volatility' },
  'Titan Bone': { emoji: '🦴', element: 'Primordial', description: 'Spaciousness, Ancient Strength, Monumental Scale' },
};

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

module.exports = {
  FRAGMENT_BONUSES,
  FRAGMENT_METADATA,
  isValidFragment,
  getKingdomAttunements,
};
