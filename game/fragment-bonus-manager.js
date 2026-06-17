/**
 * Fragment Bonus Manager
 * Handles application and retrieval of world fragment bonuses on buildings
 */

const FRAGMENT_BONUSES = require('./world-fragment-bonuses');

const COMBAT_RELEVANT_STAT_CAPS = {
  combat_power: 0.5,
  combat_damage: 0.5,
  unit_damage: 0.5,
  troop_damage: 0.5,
  health: 0.5,
  defense: 0.5,
  defenses: 0.5,
  garrison_defense: 0.5,
  power: 0.5,
  defense_armor: 0.5,
  troop_health: 0.5,
  ranged_offense: 0.5,
  siege_output: 0.3,
};

const STAT_ALIASES = {
  manaRegen: ['mana_regen'],
  mana_regen: ['manaRegen'],
  research_speed: ['speed'],
  speed: ['research_speed'],
  damage: ['power'],
  power: ['damage'],
  unit_health: ['troop_health', 'health'],
  troop_health: ['unit_health', 'health'],
  defenses: ['defense'],
};

const FRAGMENT_STAT_BUCKETS = {
  combat_offense: new Set([
    'combat_power',
    'combat_damage',
    'unit_damage',
    'troop_damage',
    'power',
    'ranged_offense',
    'siege_output',
  ]),
  combat_defense: new Set([
    'health',
    'defense',
    'defenses',
    'garrison_defense',
    'defense_armor',
    'troop_health',
  ]),
  research: new Set([
    'research_speed',
    'decoding_speed',
    'spell_efficiency',
    'mana',
    'manaRegen',
    'mana_efficiency',
    'magic_output',
    'dark_magic_output',
  ]),
  economy: new Set([
    'income',
    'economy_output',
    'production',
    'consumption',
    'gold_security',
    'trade_stability',
    'metal_trading',
    'forest_trade',
    'dark_trade_gains',
    'shadow_trade',
    'raid_security',
    'raid_protection',
    'anti_theft_security',
    'espionage_guard',
    'espionage_shield',
  ]),
};

function classifyFragmentStat(statType) {
  if (!statType) return 'utility';
  for (const [bucket, stats] of Object.entries(FRAGMENT_STAT_BUCKETS)) {
    if (stats.has(statType)) return bucket;
  }
  return 'utility';
}

function getFragmentStatValue(passive, statType) {
  if (!passive || !statType) return undefined;
  if (passive[statType] !== undefined) return passive[statType];

  const aliases = STAT_ALIASES[statType] || [];
  for (const alias of aliases) {
    if (passive[alias] !== undefined) return passive[alias];
  }

  return undefined;
}

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
      if (buildingType === 'weapons') buildingKey = 'weapons_stockpile';
      else if (buildingType === 'armor') buildingKey = 'armor_stockpile';
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
  const multiplier = getFragmentStatValue(passive, statType);

  if (multiplier === undefined) return 1.0;
  const cap = COMBAT_RELEVANT_STAT_CAPS[statType] ?? COMBAT_RELEVANT_STAT_CAPS[STAT_ALIASES[statType]?.[0]];
  const clampedDelta = typeof cap === 'number'
    ? Math.max(-cap, Math.min(cap, multiplier))
    : multiplier;
  return 1.0 + clampedDelta; // passive values are deltas (e.g., 0.15 = +15%)
}

/**
 * Apply bonus multipliers to a stat
 */
function applyFragmentMultiplier(kingdom, buildingType, baseValue, statType) {
  const multiplier = getBonusMultiplier(kingdom, buildingType, statType);
  return baseValue * multiplier;
}

/**
 * Build a combat-balance audit for fragment bonuses.
 * Useful for reporting and testing how much combat-facing pressure
 * is being applied by the current fragment layout.
 */
function getFragmentCombatAudit(kingdom) {
  const bonuses = getKingdomFragmentBonuses(kingdom);
  const buildings = [];
  const totals = {
    combat_offense: 0,
    combat_defense: 0,
    research: 0,
    economy: 0,
    utility: 0,
  };

  for (const [buildingType, fragmentBonus] of Object.entries(bonuses)) {
    if (!fragmentBonus || !fragmentBonus.passive) continue;

    const stats = [];
    for (const [statType, rawValue] of Object.entries(fragmentBonus.passive)) {
      const bucket = classifyFragmentStat(statType);
      const cap = COMBAT_RELEVANT_STAT_CAPS[statType];
      const numericValue = Number(rawValue);
      const value = Number.isFinite(numericValue) ? numericValue : 0;
      const clampedDelta = typeof cap === 'number'
        ? Math.max(-cap, Math.min(cap, value))
        : value;
      const multiplier = 1.0 + clampedDelta;

      stats.push({
        statType,
        bucket,
        rawValue: value,
        clampedDelta,
        multiplier,
      });

      if (bucket in totals) {
        totals[bucket] += clampedDelta;
      } else {
        totals.utility += clampedDelta;
      }
    }

    if (stats.length > 0) {
      buildings.push({
        buildingType,
        fragment: fragmentBonus.fragment,
        stats,
      });
    }
  }

  return { totals, buildings };
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
  getFragmentStatValue,
  applyFragmentBonus,
  getAvailableBuildingsWithBonuses,
  getBonusMultiplier,
  applyFragmentMultiplier,
  classifyFragmentStat,
  getFragmentCombatAudit,
  getSpecialEffect,
  formatBuildingName,
  getBuildingBonusDetails,
};
