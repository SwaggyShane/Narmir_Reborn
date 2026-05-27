/**
 * World Fragment Attunement System
 * Manages the 10 unique world fragments and their building attunement effects
 */

const WORLD_FRAGMENTS = {
  'Volcanic Rock': {
    name: 'Volcanic Rock',
    emoji: '🔥',
    element: 'Fire',
    lore: 'Geothermal heat accelerates crop maturity cycles but increases hunger.',
    fragmentType: 'Geothermal Growth',
  },
  'Ancient Elven Wood': {
    name: 'Ancient Elven Wood',
    emoji: '🌲',
    element: 'Nature',
    lore: 'Primordial stability shields crops from blight, infection, and disaster.',
    fragmentType: 'Primordial Stability',
  },
  'Dragon Scale': {
    name: 'Dragon Scale',
    emoji: '🐉',
    element: 'Draconic',
    lore: 'Draconic power boosts crops but frightens workers.',
    fragmentType: 'High-Yield Fear',
  },
  'Abyssal Crystal': {
    name: 'Abyssal Crystal',
    emoji: '🔮',
    element: 'Dark',
    lore: 'Underworld crystallization yields highly nutritious dark crops.',
    fragmentType: 'Dark Soil Synthesis',
  },
  'Celestial Feather': {
    name: 'Celestial Feather',
    emoji: '🪶',
    element: 'Light',
    lore: 'Heavenly light guarantees bumper crops and reliable yields.',
    fragmentType: 'Divine Providence',
  },
  'Dwarven Star-Metal': {
    name: 'Dwarven Star-Metal',
    emoji: '⭐',
    element: 'Metal',
    lore: 'Mechanical precision optimizes soil turnover and harvesters.',
    fragmentType: 'Mechanical Precision',
  },
  'Cursed Bloodstone': {
    name: 'Cursed Bloodstone',
    emoji: '🩸',
    element: 'Blood',
    lore: 'Raw lifeforce multiplies crops aggressively but taints stability.',
    fragmentType: 'Sanguine Reaping',
  },
  'Tears of the World Tree': {
    name: 'Tears of the World Tree',
    emoji: '💧',
    element: 'Water',
    lore: 'Nourishes natural life loops; harvests multiply exponentially.',
    fragmentType: 'Eternal Abundance',
  },
  'Void Essence': {
    name: 'Void Essence',
    emoji: '🌌',
    element: 'Cosmic',
    lore: 'Colossal food yields but crops fluctuate plane-by-plane unpredictably.',
    fragmentType: 'Cosmic Flux',
  },
  'Titan Bone': {
    name: 'Titan Bone',
    emoji: '🦴',
    element: 'Primordial',
    lore: 'Deep ancient soils using titanic instruments enrich agricultural density.',
    fragmentType: 'Herculean Scale',
  },
};

/**
 * Farm attunement modifiers for each fragment
 * Format: fragment_name -> { passive modifiers, special ability }
 */
const FARM_ATTUNEMENTS = {
  'Volcanic Rock': {
    production: 0.15,      // +15% production
    consumption: 0.05,     // +5% consumption
    ability: 'Geothermal Fertility',
    abilityDesc: 'Thermal soil currents accelerate crop maturity but increase hunger.',
  },
  'Ancient Elven Wood': {
    production: 0.20,      // +20% production
    stability: 0.25,       // +25% stability
    ability: 'Primordial Fertility',
    abilityDesc: 'Crops immune to blight, parasitic infections, disasters.',
  },
  'Dragon Scale': {
    production: 0.05,      // +5% production
    population: -0.05,     // -5% population
    ability: "Dragon's Shadow",
    abilityDesc: 'Crops thrive under draconic power, workers fear the soil.',
  },
  'Abyssal Crystal': {
    production: 0.30,      // +30% production
    magicOutput: 0.10,     // +10% magic output
    ability: 'Abyssal Cultivation',
    abilityDesc: 'Underworld crystallization yields highly nutritious dark crops.',
  },
  'Celestial Feather': {
    production: 0.25,      // +25% production
    stability: 0.30,       // +30% stability
    ability: 'Blessed Fields',
    abilityDesc: 'Heavenly light guarantees bumper crops and reliable yields.',
  },
  'Dwarven Star-Metal': {
    production: 0.15,      // +15% production
    buildingDefense: 0.10, // +10% building defense
    ability: 'Star-Metal Harvesters',
    abilityDesc: 'Automated mechanical plows optimize soil turnover.',
  },
  'Cursed Bloodstone': {
    production: 0.40,      // +40% production
    chaos: 0.15,           // +15% chaos
    ability: 'Sanguine Siphon',
    abilityDesc: 'Irrigated with raw lifeforce, crops multiply aggressively.',
  },
  'Tears of the World Tree': {
    production: 0.35,      // +35% production
    stability: 0.40,       // +40% stability
    ability: 'Eternal Harvest',
    abilityDesc: 'Nourishes natural life loops; harvests multiply exponentially.',
  },
  'Void Essence': {
    production: 1.0,       // +100% production
    chaos: 0.30,           // +30% chaos
    ability: 'Void Crops',
    abilityDesc: 'Colossal food yields but harvests fluctuate unpredictably.',
  },
  'Titan Bone': {
    production: 0.30,      // +30% production
    housingSpace: 0.15,    // +15% housing space
    ability: 'Colossal Plows',
    abilityDesc: 'Deep ancient soils enrich agricultural land-density.',
  },
};

/**
 * Get all available fragments
 */
function getAvailableFragments() {
  return Object.keys(WORLD_FRAGMENTS);
}

/**
 * Get farm attunement modifiers for a fragment
 */
function getFarmAttunementModifiers(fragmentName) {
  return FARM_ATTUNEMENTS[fragmentName] || null;
}

/**
 * Get fragment metadata
 */
function getFragmentMetadata(fragmentName) {
  return WORLD_FRAGMENTS[fragmentName] || null;
}

/**
 * Validate fragment name
 */
function isValidFragment(fragmentName) {
  return WORLD_FRAGMENTS.hasOwnProperty(fragmentName);
}

/**
 * Apply farm attunement modifiers to production calculation
 * Returns the production multiplier based on attunement
 */
function calculateFarmProductionWithAttunement(baseProduction, fragmentAttunement) {
  if (!fragmentAttunement) return baseProduction;

  const modifiers = getFarmAttunementModifiers(fragmentAttunement);
  if (!modifiers) return baseProduction;

  let multiplier = 1.0;
  if (modifiers.production) {
    multiplier += modifiers.production;
  }

  return baseProduction * multiplier;
}

/**
 * Get all attunement effects for a kingdom
 * Returns object with building type -> fragment mapping
 */
function getKingdomAttunements(attunementJson) {
  try {
    return typeof attunementJson === 'string' ? JSON.parse(attunementJson) : attunementJson || {};
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
  WORLD_FRAGMENTS,
  FARM_ATTUNEMENTS,
  getAvailableFragments,
  getFarmAttunementModifiers,
  getFragmentMetadata,
  isValidFragment,
  calculateFarmProductionWithAttunement,
  getKingdomAttunements,
  isFragmentAttuned,
  getFragmentAttunedBuilding,
};
