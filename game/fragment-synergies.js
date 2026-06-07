/**
 * World Fragment Synergies System
 * Defines 10 transformative synergy combinations requiring all 10 world fragments
 * placed in specific building configurations to activate
 */

const SYNERGIES = {
  'infernal-crucible': {
    id: 'infernal-crucible',
    name: 'Infernal Crucible',
    emoji: '🔥⚒️',
    description: 'Chaos of creation and destruction; birth requires sacrifice',
    requiredFragments: {
      'Volcanic Rock': 'smithies',
      'Dragon Scale': 'barracks',
      'Dwarven Star-Metal': 'armories',
      'Titan Bone': 'war_machines',
      'Abyssal Crystal': 'vaults',
      'Celestial Feather': 'guard_towers',
      'Ancient Elven Wood': 'markets',
      'Tears of the World Tree': 'taverns',
      'Cursed Bloodstone': 'mausoleums',
      'Void Essence': 'mage_towers',
    },
    passive: {
      name: 'Forge Enhancement',
      desc: 'All weapons/armor crafted are +50% more potent in combat',
      effects: { weapon_potency: 0.50, armor_potency: 0.50 },
    },
    active: {
      name: 'Forge of Gods',
      desc: 'Instantly upgrade all troops to next rank',
      cooldown_days: 1,
      cost: { population_percent: 0.50, stability: -50 },
      penalty_duration_days: 7,
    },
  },

  'eternal-harvest': {
    id: 'eternal-harvest',
    name: 'Eternal Harvest',
    emoji: '🌿🌾',
    description: 'Life and growth; nature\'s cycles of feast and famine',
    requiredFragments: {
      'Ancient Elven Wood': 'farms',
      'Tears of the World Tree': 'granaries',
      'Celestial Feather': 'shrines',
      'Volcanic Rock': 'housing',
      'Dwarven Star-Metal': 'libraries',
      'Dragon Scale': 'training',
      'Abyssal Crystal': 'schools',
      'Cursed Bloodstone': 'mausoleums',
      'Void Essence': 'taverns',
      'Titan Bone': 'walls',
    },
    passive: {
      name: 'Bountiful Growth',
      desc: 'Food production +40%, population growth +25%',
      effects: { food_production: 0.40, population_growth: 0.25 },
    },
    active: {
      name: 'Bountiful Year',
      desc: 'Fill all food storage & gain +50 population, but crops fail for 14 days',
      cooldown_days: 7,
      benefit: { food_storage_fill: true, population_gain: 50 },
      penalty: { food_production: -0.80 },
      penalty_duration_days: 14,
    },
  },

  'arcane-singularity': {
    id: 'arcane-singularity',
    name: 'Arcane Singularity',
    emoji: '🔮✨',
    description: 'Knowledge as power; the price of ultimate understanding',
    requiredFragments: {
      'Abyssal Crystal': 'mage_towers',
      'Dwarven Star-Metal': 'libraries',
      'Celestial Feather': 'shrines',
      'Void Essence': 'guard_towers',
      'Dragon Scale': 'training',
      'Volcanic Rock': 'schools',
      'Ancient Elven Wood': 'markets',
      'Titan Bone': 'castles',
      'Cursed Bloodstone': 'granaries',
      'Tears of the World Tree': 'housing',
    },
    passive: {
      name: 'Arcane Acceleration',
      desc: 'Research speed +50%, mana regen +30%',
      effects: { research_speed: 0.50, mana_regen: 0.30 },
    },
    active: {
      name: 'Spell Cascade',
      desc: 'Cast powerful AOE spell on nearby territories',
      cooldown_days: 3,
      cost: { mana_all: true, mana_regen_drain: 0 },
      penalty_duration_days: 14,
    },
  },

  'blessed-citadel': {
    id: 'blessed-citadel',
    name: 'Blessed Citadel',
    emoji: '⛪✨',
    description: 'Protection through faith; vulnerability after overextension',
    requiredFragments: {
      'Celestial Feather': 'walls',
      'Dwarven Star-Metal': 'guard_towers',
      'Ancient Elven Wood': 'shrines',
      'Volcanic Rock': 'housing',
      'Dragon Scale': 'barracks',
      'Tears of the World Tree': 'taverns',
      'Abyssal Crystal': 'vaults',
      'Cursed Bloodstone': 'training',
      'Void Essence': 'mausoleums',
      'Titan Bone': 'armories',
    },
    passive: {
      name: 'Divine Protection',
      desc: 'Defense +35%, happiness +25%',
      effects: { defense: 0.35, happiness: 25 },
    },
    active: {
      name: 'Divine Wrath',
      desc: 'Block all incoming attacks for 2 days, but defense drops after',
      cooldown_days: 2,
      shield_duration_days: 2,
      penalty: { defense: -0.60 },
      penalty_duration_days: 5,
    },
  },

  'void-convergence': {
    id: 'void-convergence',
    name: 'Void Convergence',
    emoji: '🌌⚡',
    description: 'Chaos and power; unstable but devastating',
    requiredFragments: {
      'Void Essence': 'mage_towers',
      'Abyssal Crystal': 'guard_towers',
      'Cursed Bloodstone': 'vaults',
      'Dragon Scale': 'barracks',
      'Volcanic Rock': 'war_machines',
      'Dwarven Star-Metal': 'outposts',
      'Celestial Feather': 'markets',
      'Ancient Elven Wood': 'training',
      'Titan Bone': 'walls',
      'Tears of World Tree': 'schools',
    },
    passive: {
      name: 'Chaotic Power',
      desc: 'Combat power +60%, happiness -25%',
      effects: { combat_power: 0.60, happiness: -25 },
    },
    active: {
      name: 'Reality Tear',
      desc: 'Instantly conquer adjacent territory, but lose troops & stability',
      cooldown_days: 5,
      cost: { troops_percent: 0.50, stability: -40 },
      penalty_duration_days: 10,
    },
  },

  'primordial-awakening': {
    id: 'primordial-awakening',
    name: 'Primordial Awakening',
    emoji: '🦴💪',
    description: 'Ancient power awakening; overwhelming but consuming',
    requiredFragments: {
      'Titan Bone': 'barracks',
      'Dragon Scale': 'war_machines',
      'Volcanic Rock': 'training',
      'Dwarven Star-Metal': 'walls',
      'Ancient Elven Wood': 'housing',
      'Abyssal Crystal': 'guard_towers',
      'Celestial Feather': 'armories',
      'Cursed Bloodstone': 'smithies',
      'Void Essence': 'outposts',
      'Tears of the World Tree': 'granaries',
    },
    passive: {
      name: 'Ancient Might',
      desc: 'Troop capacity +40%, unit damage +25%',
      effects: { troop_capacity: 0.40, unit_damage: 0.25 },
    },
    active: {
      name: 'Colossal Form',
      desc: 'All troops +100% damage & +2x health for 4 days, high consumption',
      cooldown_days: 4,
      benefit: { troop_damage: 1.0, troop_health: 1.0 },
      benefit_duration_days: 4,
      cost: { resource_consumption_multiplier: 4.0, happiness: -30 },
    },
  },

  'bloodmoon-ascension': {
    id: 'bloodmoon-ascension',
    name: 'Bloodmoon Ascension',
    emoji: '🩸🌙',
    description: 'Dark pacts for power; gain at terrible human cost',
    requiredFragments: {
      'Cursed Bloodstone': 'mausoleums',
      'Void Essence': 'vaults',
      'Abyssal Crystal': 'smithies',
      'Dragon Scale': 'barracks',
      'Volcanic Rock': 'war_machines',
      'Ancient Elven Wood': 'markets',
      'Dwarven Star-Metal': 'libraries',
      'Celestial Feather': 'shrines',
      'Titan Bone': 'outposts',
      'Tears of the World Tree': 'farms',
    },
    passive: {
      name: 'Dark Pact',
      desc: 'Gold income +50%, happiness -30%',
      effects: { gold_income: 0.50, happiness: -30 },
    },
    active: {
      name: 'Life Drain',
      desc: 'Steal resources from adjacent territory, but lose population & stability',
      cooldown_days: 7,
      steal: { gold: 100, food: 50, mana: 20 },
      cost: { population: 60, stability: -35 },
      penalty_duration_days: 7,
    },
  },

  'recursive-knowledge': {
    id: 'recursive-knowledge',
    name: 'Recursive Knowledge',
    emoji: '♻️📚',
    description: 'Time and knowledge loops; breakthrough followed by stagnation',
    requiredFragments: {
      'Dwarven Star-Metal': 'libraries',
      'Ancient Elven Wood': 'schools',
      'Abyssal Crystal': 'mage_towers',
      'Celestial Feather': 'shrines',
      'Volcanic Rock': 'smithies',
      'Dragon Scale': 'training',
      'Cursed Bloodstone': 'granaries',
      'Void Essence': 'markets',
      'Titan Bone': 'castles',
      'Tears of the World Tree': 'housing',
    },
    passive: {
      name: 'Recursive Efficiency',
      desc: 'Research cost -30%, production speed +20%',
      effects: { research_cost_reduction: 0.30, production_speed: 0.20 },
    },
    active: {
      name: 'Temporal Echo',
      desc: 'Instantly complete all current research & production, but research locked 21 days',
      cooldown_days: 14,
      benefit: { complete_all_research: true, complete_all_production: true },
      penalty: { research_locked: true },
      penalty_duration_days: 21,
    },
  },

  'celestial-harmony': {
    id: 'celestial-harmony',
    name: 'Celestial Harmony',
    emoji: '⭐🌈',
    description: 'Perfect balance; the highs come before catastrophic lows',
    requiredFragments: {
      'Celestial Feather': 'shrines',
      'Tears of the World Tree': 'farms',
      'Dwarven Star-Metal': 'housing',
      'Ancient Elven Wood': 'granaries',
      'Dragon Scale': 'training',
      'Volcanic Rock': 'walls',
      'Abyssal Crystal': 'libraries',
      'Cursed Bloodstone': 'taverns',
      'Void Essence': 'guard_towers',
      'Titan Bone': 'markets',
    },
    passive: {
      name: 'Harmonic Balance',
      desc: 'All stats +15%, no penalties',
      effects: { all_stats: 0.15 },
    },
    active: {
      name: 'Cosmic Alignment',
      desc: 'All resources +30%, production +30%, happiness +40 for 3 days, then crash for 7 days',
      cooldown_days: 10,
      benefit: { resources: 0.30, production: 0.30, happiness: 40 },
      benefit_duration_days: 3,
      penalty: { all_stats: -0.50 },
      penalty_duration_days: 7,
    },
  },

  'entropy-unbound': {
    id: 'entropy-unbound',
    name: 'Entropy Unbound',
    emoji: '🌌💀',
    description: 'Destruction and entropy; ultimate power means ultimate chaos',
    requiredFragments: {
      'Void Essence': 'guard_towers',
      'Cursed Bloodstone': 'walls',
      'Abyssal Crystal': 'vaults',
      'Volcanic Rock': 'outposts',
      'Titan Bone': 'mausoleums',
      'Dragon Scale': 'war_machines',
      'Ancient Elven Wood': 'mage_towers',
      'Dwarven Star-Metal': 'armories',
      'Celestial Feather': 'training',
      'Tears of the World Tree': 'libraries',
    },
    passive: {
      name: 'Entropic Destruction',
      desc: 'Combat power +80%, all production -50%, happiness -35%',
      effects: { combat_power: 0.80, production: -0.50, happiness: -35 },
    },
    active: {
      name: 'Cataclysm',
      desc: 'Destroy everything in 2-territory radius, but catastrophic penalties',
      cooldown_days: 14,
      devastation_radius: 2,
      cost: { stability: -80, building_damage_percent: 0.40 },
      penalty_duration_days: 14,
    },
  },
};

/**
 * Get a synergy by ID
 */
function getSynergy(synergyId) {
  return SYNERGIES[synergyId] || null;
}

/**
 * Get all synergies
 */
function getAllSynergies() {
  return Object.values(SYNERGIES);
}

/**
 * Check if a synergy is active based on current fragment placements
 */
function detectActiveSynergy(fragmentPlacements) {
  for (const synergy of Object.values(SYNERGIES)) {
    if (isSynergyActive(synergy, fragmentPlacements)) {
      return synergy;
    }
  }
  return null;
}

/**
 * Check if a specific synergy's requirements are met
 */
function isSynergyActive(synergy, fragmentPlacements) {
  for (const [fragmentName, requiredBuilding] of Object.entries(synergy.requiredFragments)) {
    const placed = fragmentPlacements[requiredBuilding];
    if (!placed || placed !== fragmentName) {
      return false;
    }
  }
  return true;
}

/**
 * Get synergies that are close to activation (missing 1-2 fragments)
 */
function getNearActivationSynergies(fragmentPlacements) {
  const near = [];

  for (const synergy of Object.values(SYNERGIES)) {
    let missing = 0;
    for (const [fragmentName, requiredBuilding] of Object.entries(synergy.requiredFragments)) {
      const placed = fragmentPlacements[requiredBuilding];
      if (!placed || placed !== fragmentName) {
        missing++;
      }
    }

    if (missing > 0 && missing <= 2) {
      near.push({ synergy, missingCount: missing });
    }
  }

  return near;
}

/**
 * Get which synergies a specific building+fragment combo contributes to
 */
function getContributingSynergies(buildingType, fragmentName) {
  const contributing = [];

  for (const synergy of Object.values(SYNERGIES)) {
    if (synergy.requiredFragments[fragmentName] === buildingType) {
      contributing.push(synergy);
    }
  }

  return contributing;
}

module.exports = {
  SYNERGIES,
  getSynergy,
  getAllSynergies,
  detectActiveSynergy,
  isSynergyActive,
  getNearActivationSynergies,
  getContributingSynergies,
};
