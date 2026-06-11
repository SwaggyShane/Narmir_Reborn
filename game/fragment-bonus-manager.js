/**
 * Fragment Bonus Manager
 * Handles application and retrieval of world fragment bonuses on buildings
 */

const FRAGMENT_BONUSES = require('./world-fragment-bonuses');

/**
 * Parse fragment bonuses JSON from kingdom data
 */
function parseFragmentBonuses(bonusesJson) {
  try {
    return JSON.parse(bonusesJson || '{}');
  } catch {
    return {};
  }
}

/**
 * Get all bonuses applied to a kingdom
 */
function getKingdomFragmentBonuses(kingdom) {
  return parseFragmentBonuses(kingdom.fragment_bonuses);
}

/**
 * Check if a building has a fragment applied
 */
function getFragmentForBuilding(kingdom, buildingType) {
  const bonuses = getKingdomFragmentBonuses(kingdom);
  return bonuses[buildingType] || null;
}

/**
 * Get bonus object for a specific fragment + building combination
 */
function getBonusConfig(fragmentName, buildingType) {
  if (!FRAGMENT_BONUSES[fragmentName]) return null;
  return FRAGMENT_BONUSES[fragmentName][buildingType] || null;
}

/**
 * Apply a fragment bonus to a building
 * Returns updated fragment_bonuses JSON
 */
function applyFragmentBonus(kingdom, fragmentName, buildingType) {
  const bonuses = getKingdomFragmentBonuses(kingdom);

  // Check if building already has a bonus
  if (bonuses[buildingType]) {
    return { error: `${buildingType} already has a fragment applied` };
  }

  // Check if fragment exists and has bonus for this building
  const bonusConfig = getBonusConfig(fragmentName, buildingType);
  if (!bonusConfig) {
    return { error: `No bonus config for ${fragmentName} on ${buildingType}` };
  }

  // Apply the bonus
  bonuses[buildingType] = {
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
    fragment_bonuses: JSON.stringify(bonuses),
    applied: bonuses[buildingType],
  };
}

/**
 * Get all available buildings with their potential bonuses
 * Used for display in selection modal
 */
function getAvailableBuildingsWithBonuses(kingdom, fragmentName) {
  const currentBonuses = getKingdomFragmentBonuses(kingdom);
  const fragmentConfig = FRAGMENT_BONUSES[fragmentName];

  if (!fragmentConfig) {
    return { error: `Fragment '${fragmentName}' not found` };
  }

  const available = [];

  // Get all building types from config
  for (const [buildingType, bonusConfig] of Object.entries(fragmentConfig)) {
    // Skip if building already has a fragment
    if (currentBonuses[buildingType]) {
      continue;
    }

    // Include building count from kingdom - handle column name mapping for non-standard columns
    let buildingKey = `bld_${buildingType}`;
    if (kingdom[buildingKey] === undefined) {
      // Special case mapping for items that don't follow bld_ prefix convention
      if (buildingType === 'weapons') buildingKey = 'weapons_stored';
      else if (buildingType === 'armor') buildingKey = 'armor_stored';
      else if (buildingType === 'war_machines') buildingKey = 'bld_war_machines';
      else if (buildingType === 'ladders') buildingKey = 'bld_ladders';
      else buildingKey = buildingType;
    }
    const buildingCount = kingdom[buildingKey] || 0;

    available.push({
      buildingType,
      name: formatBuildingName(buildingType),
      count: buildingCount,
      bonus: {
        name: bonusConfig.special?.name || 'Enhancement',
        desc: bonusConfig.special?.desc || '',
        passive: bonusConfig.passive || {},
      },
    });
  }

  // Sort by building count (descending) so most-used buildings are first
  available.sort((a, b) => b.count - a.count);

  return available;
}

/**
 * Calculate bonus multiplier for a specific building stat
 */
function getBonusMultiplier(kingdom, buildingType, statType) {
  const fragmentBonus = getFragmentForBuilding(kingdom, buildingType);
  if (!fragmentBonus) return 1.0;

  const passive = fragmentBonus.passive || {};
  const multiplier = passive[statType];

  if (multiplier === undefined) return 1.0;
  return 1.0 + multiplier; // passive values are deltas (e.g., 0.15 = +15%)
}

/**
 * Apply bonus multipliers to a stat
 */
function applyFragmentMultiplier(kingdom, buildingType, baseValue, statType) {
  const multiplier = getBonusMultiplier(kingdom, buildingType, statType);
  return baseValue * multiplier;
}

/**
 * Get special mechanic effect for a building if applicable
 */
function getSpecialEffect(kingdom, buildingType) {
  const fragmentBonus = getFragmentForBuilding(kingdom, buildingType);
  if (!fragmentBonus || !fragmentBonus.special) return null;

  return {
    name: fragmentBonus.special.name,
    description: fragmentBonus.special.desc,
    fragmentName: fragmentBonus.fragment,
  };
}

/**
 * Format building name for display
 */
function formatBuildingName(buildingType) {
  return buildingType
    .replace(/^bld_/, '')
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Get all bonuses for a building with their details
 */
function getBuildingBonusDetails(kingdom, buildingType) {
  const fragmentBonus = getFragmentForBuilding(kingdom, buildingType);
  if (!fragmentBonus) {
    return {
      hasBonus: false,
      fragment: null,
      bonuses: {},
    };
  }

  return {
    hasBonus: true,
    fragment: fragmentBonus.fragment,
    special: fragmentBonus.special,
    passive: fragmentBonus.passive,
    appliedTurn: fragmentBonus.applied_turn,
  };
}

module.exports = {
  parseFragmentBonuses,
  getKingdomFragmentBonuses,
  getFragmentForBuilding,
  getBonusConfig,
  applyFragmentBonus,
  getAvailableBuildingsWithBonuses,
  getBonusMultiplier,
  applyFragmentMultiplier,
  getSpecialEffect,
  formatBuildingName,
  getBuildingBonusDetails,
};
