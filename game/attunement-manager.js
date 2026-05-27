/**
 * Attunement Manager
 * Handles the logic for applying, validating, and managing world fragment attunements
 */

const {
  FRAGMENT_BONUSES,
  getKingdomAttunements,
  isFragmentAttuned,
  getFragmentAttunedBuilding,
} = require('./fragment-attunements');

const { fragmentBonusManager } = require('./fragment-bonus-manager');

/**
 * Validate that a fragment can be attuned to a building
 */
function validateAttunement(kingdom, fragmentName, buildingType) {
  // Check fragment exists
  if (!FRAGMENT_BONUSES[fragmentName]) {
    return { error: `Fragment '${fragmentName}' does not exist` };
  }

  // Check building type is valid
  if (!FRAGMENT_BONUSES[fragmentName][buildingType]) {
    return { error: `Fragment '${fragmentName}' cannot be attuned to '${buildingType}'` };
  }

  // Check if kingdom has buildings of this type
  const buildingKey = `bld_${buildingType}`;
  const buildingCount = kingdom[buildingKey] || 0;
  if (buildingCount === 0) {
    return { error: `Kingdom has no ${buildingType} to attune to` };
  }

  // Check if building already has a fragment
  const currentAttunements = getKingdomAttunements(kingdom.fragment_bonuses || '{}');
  if (currentAttunements[buildingType]) {
    return { error: `${buildingType} already has fragment '${currentAttunements[buildingType]}' attuned` };
  }

  // Check if fragment is already attuned elsewhere
  if (isFragmentAttuned(currentAttunements, fragmentName)) {
    const attachedTo = getFragmentAttunedBuilding(currentAttunements, fragmentName);
    return { error: `Fragment '${fragmentName}' is already attuned to ${attachedTo} (single fragment constraint)` };
  }

  return { ok: true };
}

/**
 * Apply a fragment attunement to a building
 * Returns updated fragment_bonuses JSON string
 */
function applyAttunement(kingdom, fragmentName, buildingType) {
  // Validate first
  const validation = validateAttunement(kingdom, fragmentName, buildingType);
  if (validation.error) {
    return validation;
  }

  // Get current attunements
  const attunements = getKingdomAttunements(kingdom.fragment_bonuses || '{}');

  // Apply the new attunement
  const bonusConfig = FRAGMENT_BONUSES[fragmentName][buildingType];
  attunements[buildingType] = {
    fragment: fragmentName,
    applied_turn: kingdom.turn || 0,
    passive: bonusConfig.passive || {},
    special: {
      name: bonusConfig.special?.name || '',
      desc: bonusConfig.special?.desc || '',
    },
  };

  return {
    ok: true,
    fragment_bonuses: JSON.stringify(attunements),
    attunement: {
      buildingType,
      fragmentName,
      applied_turn: kingdom.turn || 0,
      passive: bonusConfig.passive,
      special: bonusConfig.special,
    },
  };
}

/**
 * Get all available attunement options for a kingdom
 * Returns list of fragments that can be attuned
 */
function getAvailableAttunements(kingdom) {
  const currentAttunements = getKingdomAttunements(kingdom.fragment_bonuses || '{}');
  const available = [];

  // For each fragment, check if it can be attuned
  for (const [fragmentName, buildingBonuses] of Object.entries(FRAGMENT_BONUSES)) {
    // Skip if fragment is already attuned
    if (isFragmentAttuned(currentAttunements, fragmentName)) {
      continue;
    }

    // Check which buildings can accept this fragment
    const buildings = [];
    for (const [buildingType, bonusConfig] of Object.entries(buildingBonuses)) {
      // Skip if empty/unpopulated bonus
      if (!bonusConfig.passive || Object.keys(bonusConfig.passive).length === 0) {
        continue;
      }

      // Skip if building already has a fragment
      if (currentAttunements[buildingType]) {
        continue;
      }

      // Check if kingdom has this building
      const buildingKey = `bld_${buildingType}`;
      const buildingCount = kingdom[buildingKey] || 0;
      if (buildingCount > 0) {
        buildings.push({
          buildingType,
          count: buildingCount,
          bonuses: bonusConfig.passive,
          special: bonusConfig.special,
        });
      }
    }

    if (buildings.length > 0) {
      available.push({
        fragmentName,
        buildings,
      });
    }
  }

  return available;
}

/**
 * Get details of all current attunements for a kingdom
 */
function getAttunementStatus(kingdom) {
  const attunements = getKingdomAttunements(kingdom.fragment_bonuses || '{}');
  const status = [];

  for (const [buildingType, attunement] of Object.entries(attunements)) {
    // Only include populated attunements
    if (attunement.fragment) {
      status.push({
        buildingType,
        fragmentName: attunement.fragment,
        appliedTurn: attunement.applied_turn,
        passive: attunement.passive,
        special: attunement.special,
      });
    }
  }

  return status;
}

/**
 * Calculate the production multiplier for farms with attunement
 * Integrates with existing farm production system
 */
function getFarmProductionMultiplier(kingdom) {
  // Use existing fragment bonus manager if available
  if (fragmentBonusManager && fragmentBonusManager.getBonusMultiplier) {
    return fragmentBonusManager.getBonusMultiplier(kingdom, 'farms', 'production');
  }

  // Fallback: manually calculate from attunements
  const attunements = getKingdomAttunements(kingdom.fragment_bonuses || '{}');
  const farmAttunement = attunements.farms;

  if (!farmAttunement || !farmAttunement.passive) {
    return 1.0;
  }

  const productionModifier = farmAttunement.passive.production || 0;
  return 1.0 + productionModifier;
}

module.exports = {
  validateAttunement,
  applyAttunement,
  getAvailableAttunements,
  getAttunementStatus,
  getFarmProductionMultiplier,
};
