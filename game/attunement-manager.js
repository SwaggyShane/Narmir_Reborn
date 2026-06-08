/**
 * Attunement Manager
 * Handles the logic for applying, validating, and managing world fragment attunements
 */

const {
  FRAGMENT_BONUSES,
  getKingdomAttunements,
} = require('./fragment-attunements');

const fragmentBonusManager = require('./fragment-bonus-manager');
const synergiesModule = require('./fragment-synergies');

/**
 * Validate that a fragment can be attuned to a building
 */
function validateAttunement(kingdom, fragmentName, buildingType) {
  // Check fragment exists in constants
  if (!FRAGMENT_BONUSES[fragmentName]) {
    return { error: `Fragment '${fragmentName}' does not exist` };
  }

  // Check kingdom owns and has studied this fragment
  let worldFragments = [];
  if (Array.isArray(kingdom.world_fragments)) {
    worldFragments = kingdom.world_fragments;
  } else if (typeof kingdom.world_fragments === 'string') {
    try {
      worldFragments = JSON.parse(kingdom.world_fragments || '[]') || [];
    } catch {
      worldFragments = [];
    }
  }

  const ownedFragment = Array.isArray(worldFragments)
    ? worldFragments.find(f => f && f.type === fragmentName)
    : null;

  if (!ownedFragment) {
    return { error: `Kingdom does not own fragment '${fragmentName}'` };
  }

  // Check if studied (object format only, string format is not studied)
  const isStudied = typeof ownedFragment === 'object' && ownedFragment.studied === true;
  if (!isStudied) {
    return { error: `Fragment '${fragmentName}' must be studied before attunement` };
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
    return { error: `${buildingType} already has fragment '${currentAttunements[buildingType].fragment}' attuned` };
  }

  // Check if fragment is already attuned elsewhere
  const alreadyAttunedBuilding = Object.entries(currentAttunements).find(
    ([_, att]) => att && att.fragment === fragmentName
  )?.[0];
  if (alreadyAttunedBuilding) {
    return { error: `Fragment '${fragmentName}' is already attuned to ${alreadyAttunedBuilding} (single fragment constraint)` };
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
 * Returns list of studied fragments that can be attuned
 */
function getAvailableAttunements(kingdom) {
  const currentAttunements = getKingdomAttunements(kingdom.fragment_bonuses || '{}');
  const available = [];

  // Get kingdom's owned fragments
  let worldFragments = [];
  if (Array.isArray(kingdom.world_fragments)) {
    worldFragments = kingdom.world_fragments;
  } else if (typeof kingdom.world_fragments === 'string') {
    try {
      worldFragments = JSON.parse(kingdom.world_fragments || '[]') || [];
    } catch {
      worldFragments = [];
    }
  }

  // Only include studied fragments (object format with studied: true)
  const studiedFragments = Array.isArray(worldFragments)
    ? worldFragments.filter(f => f && typeof f === 'object' && f.studied === true)
    : [];

  // For each studied fragment, check if it can be attuned
  for (const ownedFragment of studiedFragments) {
    const fragmentName = ownedFragment.type;
    const buildingBonuses = FRAGMENT_BONUSES[fragmentName];

    if (!buildingBonuses) {
      continue; // Fragment type not found in bonuses config
    }

    // Skip if fragment is already attuned
    const isAttuned = Object.values(currentAttunements).some(
      (att) => att && att.fragment === fragmentName
    );
    if (isAttuned) {
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

/**
 * Get the currently active synergy for a kingdom
 */
function getActiveSynergy(kingdom) {
  if (!kingdom) return null;
  const attunements = getKingdomAttunements(kingdom.fragment_bonuses || '{}');
  const fragmentPlacements = {};

  for (const [buildingType, attunement] of Object.entries(attunements)) {
    if (attunement && attunement.fragment) {
      fragmentPlacements[buildingType] = attunement.fragment;
    }
  }

  return synergiesModule.detectActiveSynergy(fragmentPlacements);
}

/**
 * Get synergies that are near activation (missing 1-2 fragments)
 * Used for UI hints
 */
function getNearActivationSynergies(kingdom) {
  if (!kingdom) return [];
  const attunements = getKingdomAttunements(kingdom.fragment_bonuses || '{}');
  const fragmentPlacements = {};

  for (const [buildingType, attunement] of Object.entries(attunements)) {
    if (attunement && attunement.fragment) {
      fragmentPlacements[buildingType] = attunement.fragment;
    }
  }

  return synergiesModule.getNearActivationSynergies(fragmentPlacements);
}

/**
 * Get synergies that a specific building+fragment combo contributes to
 * Used to show hints when attunement is applied
 */
function getContributingSynergies(buildingType, fragmentName) {
  return synergiesModule.getContributingSynergies(buildingType, fragmentName);
}

/**
 * Get all synergies
 */
function getAllSynergies() {
  return Object.values(synergiesModule.SYNERGIES);
}

/**
 * Get synergy status for UI display
 */
function getSynergyStatus(kingdom) {
  if (!kingdom) {
    return { activeSynergy: null, nearActivation: [] };
  }
  const activeSynergy = getActiveSynergy(kingdom);
  const nearActivation = getNearActivationSynergies(kingdom);

  return {
    activeSynergy: activeSynergy ? {
      id: activeSynergy.id,
      name: activeSynergy.name,
      emoji: activeSynergy.emoji,
      description: activeSynergy.description,
      passive: activeSynergy.passive,
      active: activeSynergy.active,
    } : null,
    nearActivation: nearActivation.map(item => ({
      id: item.synergy.id,
      name: item.synergy.name,
      emoji: item.synergy.emoji,
      description: item.synergy.description,
      passive: item.synergy.passive,
      active: item.synergy.active,
      missingFragments: item.missingCount,
    })),
  };
}

/**
 * Get synergy hints for a building type
 * Returns which synergies this building can contribute to
 */
function getBuildingSynergyHints(buildingType) {
  const hints = [];

  Object.values(synergiesModule.SYNERGIES).forEach(synergy => {
    if (synergy.requiredFragments && synergy.requiredFragments[buildingType]) {
      hints.push({
        synergy_id: synergy.id,
        synergy_name: synergy.name,
        emoji: synergy.emoji,
        fragment_name: synergy.requiredFragments[buildingType],
      });
    }
  });

  return hints;
}

/**
 * Get synergy contribution status for a specific building
 * Shows current progress toward synergies this building can contribute to
 */
function getBuildingContributionStatus(kingdom, buildingType) {
  if (!kingdom) return [];

  const hints = getBuildingSynergyHints(buildingType);

  // Get current attunements (returns array of attunements)
  const attunements = getAttunementStatus(kingdom);
  // Filter to only this building's attunements
  const buildingAttunements = attunements.filter(att => att.buildingType === buildingType);

  return hints.map(hint => {
    const isAttuned = buildingAttunements.some(att =>
      att.fragmentName === hint.fragment_name
    );

    return {
      ...hint,
      is_attuned: isAttuned,
      description: `Attune ${hint.fragment_name} to contribute to ${hint.synergy_name}`,
    };
  });
}

module.exports = {
  validateAttunement,
  applyAttunement,
  getAvailableAttunements,
  getAttunementStatus,
  getFarmProductionMultiplier,
  getActiveSynergy,
  getNearActivationSynergies,
  getContributingSynergies,
  getAllSynergies,
  getSynergyStatus,
  getBuildingSynergyHints,
  getBuildingContributionStatus,
};
