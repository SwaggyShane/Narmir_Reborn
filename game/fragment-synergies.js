/**
 * World Fragment Synergies System
 * Defines 10 transformative synergy combinations that activate when specific fragment sets are attuned
 * across ALL required buildings in a kingdom. Only ONE synergy can be active at a time.
 */

const SYNERGIES = {
  'infernal-forge': {
    id: 'infernal-forge',
    name: 'Infernal Forge',
    emoji: '🔥⚒️',
    description: 'Volcanic fury meets draconic power—weapons forged in this crucible burn with ancient fire',
    requiredFragments: ['Volcanic Rock', 'Dragon Scale'],
    requiredBuildings: ['smithies', 'training', 'barracks'],
    minAttunedBuildings: 3,
    passiveBonuses: {
      smithies: { quality: 0.75, production: 0.50, speed: 0.40 },
      training: { speed: 1.0, power: 0.60, output: 0.50 },
      barracks: { training: 0.75, capacity: 0.50, power: 0.40 },
    },
    specialEffects: {
      name: 'Flaming Weapons',
      desc: 'All forged weapons gain fire property (+25% vs undead, +15% vs cold-resistant enemies)',
      mechanic: 'combat_fire_bonus',
      value: 0.25,
    },
  },

  'natures-bounty': {
    id: 'natures-bounty',
    name: "Nature's Bounty",
    emoji: '🌿🌾',
    description: 'Life force flows through land, crops flourish eternally, and joy blooms naturally',
    requiredFragments: ['Ancient Elven Wood', 'Tears of the World Tree'],
    requiredBuildings: ['farms', 'granaries', 'shrines'],
    minAttunedBuildings: 3,
    passiveBonuses: {
      farms: { production: 1.0, stability: 0.50, consumption: -0.30 },
      granaries: { capacity: 0.50, decay_reduction: 0.75, stability: 0.40 },
      shrines: { healing: 0.50, morale: 0.75, happiness: 1.0 },
    },
    specialEffects: {
      name: 'Eternal Harvest',
      desc: 'Unharvested crops never spoil, population auto-heals 1 citizen per turn, happiness +50%',
      mechanic: 'passive_healing_and_growth',
      healPerTurn: 1,
      happinessBoost: 0.50,
    },
  },

  'arcane-nexus': {
    id: 'arcane-nexus',
    name: 'Arcane Nexus',
    emoji: '🔮✨',
    description: 'All magical knowledge converges into a singular point of cosmic power and enlightenment',
    requiredFragments: ['Abyssal Crystal', 'Dwarven Star-Metal'],
    requiredBuildings: ['mage_towers', 'libraries', 'vaults'],
    minAttunedBuildings: 3,
    passiveBonuses: {
      mage_towers: { mana: 1.5, manaRegen: 0.80, power: 1.0 },
      libraries: { research_speed: 0.80, stability: 0.60, research_failure: -0.40 },
      vaults: { capacity: 0.75, gold_security: 0.50, economy_output: 0.40 },
    },
    specialEffects: {
      name: 'Research Archive & Mana Overflow',
      desc: 'Discovered research can be archived for 50% cost reuse; mana overflow grants +30% INT to all units',
      mechanic: 'research_archive_and_mana_overflow',
      intBoost: 0.30,
      archiveCostReduction: 0.50,
    },
  },

  'divine-ascension': {
    id: 'divine-ascension',
    name: 'Divine Ascension',
    emoji: '✨⛪',
    description: 'Divine blessing infuses every structure, walls become unbreachable sanctuaries',
    requiredFragments: ['Celestial Feather', 'Dwarven Star-Metal'],
    requiredBuildings: ['shrines', 'walls', 'training'],
    minAttunedBuildings: 3,
    passiveBonuses: {
      shrines: { healing: 2.0, morale: 1.0, happiness: 0.75 },
      walls: { health: 1.0, defense: 1.0, stability: 0.60 },
      training: { power: 0.75, speed: 0.50, holy_resistance: 0.40 },
    },
    specialEffects: {
      name: 'Blessed Walls & Holy Resistance',
      desc: 'Walls become blessed (cannot be breached for 3 turns once per conquest); units gain +40% holy resistance',
      mechanic: 'blessed_walls_and_holy_resistance',
      wallImmunityTurns: 3,
      holyResistance: 0.40,
    },
  },

  'cosmic-chaos': {
    id: 'cosmic-chaos',
    name: 'Cosmic Chaos',
    emoji: '🌌⚡',
    description: 'Reality bends to chaos—unpredictability becomes an engine of power and transformation',
    requiredFragments: ['Void Essence', 'Abyssal Crystal'],
    requiredBuildings: ['guard_towers', 'mage_towers', 'vaults'],
    minAttunedBuildings: 3,
    passiveBonuses: {
      guard_towers: { detection: 0.80, power: 2.0, reach: 0.60 },
      mage_towers: { mana: 1.0, critical_chance: 2.0, power: 1.0 },
      vaults: { capacity: 0.60, chaos_events: 0.50, economy_output: 0.50 },
    },
    specialEffects: {
      name: 'Destiny Reroll & Chaos Tech Boost',
      desc: 'Critical strike chance +200% for spells; can reroll one random event once per 10 turns; chaos events grant +30% to one random tech',
      mechanic: 'destiny_reroll_and_chaos_boost',
      criticalChanceBoost: 2.0,
      techBoost: 0.30,
      destinyRerollCooldown: 10,
    },
  },

  'primordial-might': {
    id: 'primordial-might',
    name: 'Primordial Might',
    emoji: '🦴💪',
    description: 'Ancient titans rise again—units swell to enormous size, dwarfing normal warriors',
    requiredFragments: ['Titan Bone', 'Dragon Scale'],
    requiredBuildings: ['barracks', 'war_machines', 'outposts'],
    minAttunedBuildings: 3,
    passiveBonuses: {
      barracks: { training: 1.5, capacity: 1.0, power: 1.0 },
      war_machines: { damage: 1.5, capacity: 0.75, aoe_damage: 0.50 },
      outposts: { power: 1.0, effectiveness: 1.0, scouts: 0.60 },
    },
    specialEffects: {
      name: 'Titanic Size & AOE Conquest',
      desc: 'Units gain titanic size (garrison 3x soldiers per building); war machines deal AOE damage to adjacent territories on conquest',
      mechanic: 'titanic_size_and_aoe_conquest',
      garrisonMultiplier: 3.0,
      aoeDamageRadius: 1,
      aoeDamageMultiplier: 0.50,
    },
  },

  'bloodmoon-ritual': {
    id: 'bloodmoon-ritual',
    name: 'Bloodmoon Ritual',
    emoji: '🩸🌙',
    description: 'Dark pact sealed in blood—power incarnate at terrible cost to society and stability',
    requiredFragments: ['Cursed Bloodstone', 'Void Essence'],
    requiredBuildings: [],
    minAttunedBuildings: 5,
    passiveBonuses: {
      [null]: { power: 3.0, stability: -0.40 },
    },
    specialEffects: {
      name: 'Blood Conquest & Darkness',
      desc: 'Combat power +300% but stability -40%; conquest always succeeds but costs -50 population; darkness events summon 3 shadow units per event',
      mechanic: 'bloodmoon_conquest_and_darkness',
      powerBoost: 3.0,
      conqueryCost: -50,
      shadowUnitsPerEvent: 3,
      stabilityPenalty: -0.40,
    },
  },

  'eternal-recursion': {
    id: 'eternal-recursion',
    name: 'Eternal Recursion',
    emoji: '♻️📚',
    description: 'Knowledge and craft spiral endlessly—yesterday\'s solutions become tomorrow\'s blueprints',
    requiredFragments: ['Dwarven Star-Metal', 'Ancient Elven Wood'],
    requiredBuildings: ['libraries', 'granaries', 'smithies'],
    minAttunedBuildings: 3,
    passiveBonuses: {
      libraries: { research_speed: 1.2, research_failure: -0.50, knowledge_seeds: 0.40 },
      granaries: { capacity: 0.75, production: 0.50, decay_reduction: 0.50 },
      smithies: { production: 1.2, speed: 0.75, quality: 0.60 },
    },
    specialEffects: {
      name: 'Knowledge Seeds & Batch Repeat',
      desc: 'Research never fails; can repeat last successful production batch at 50% cost next turn; libraries generate craftable recipes',
      mechanic: 'knowledge_seeds_and_batch_repeat',
      batchRepeatCostReduction: 0.50,
      recipeGenerationChance: 0.20,
    },
  },

  'stellar-harmony': {
    id: 'stellar-harmony',
    name: 'Stellar Harmony',
    emoji: '⭐💫',
    description: 'Perfect balance between all forces—civilization ascends to unprecedented unity and strength',
    requiredFragments: ['Celestial Feather', 'Tears of the World Tree', 'Dragon Scale'],
    requiredBuildings: ['shrines', 'farms', 'training'],
    minAttunedBuildings: 3,
    passiveBonuses: {
      shrines: { healing: 0.60, morale: 0.75, happiness: 0.50 },
      farms: { production: 0.60, stability: 0.50, growth: 0.40 },
      training: { speed: 0.60, power: 0.75, output: 0.50 },
    },
    specialEffects: {
      name: 'Cross-Healing & Harmony Trait',
      desc: 'All buildings heal each other (10% overflow as healing to all citizens); units gain harmony trait (heal teammates 5 HP/turn when idle)',
      mechanic: 'stellar_harmony_healing',
      healingOverflowPercent: 0.10,
      harmonyUnitHeal: 5,
    },
  },

  'void-touched-ascendancy': {
    id: 'void-touched-ascendancy',
    name: 'Void-Touched Ascendancy',
    emoji: '🌌✨',
    description: 'Paradox mastered—reality shatters and reforms at your command, curses become blessings',
    requiredFragments: ['Void Essence', 'Cursed Bloodstone', 'Celestial Feather'],
    requiredBuildings: ['guard_towers', 'mage_towers', 'shrines'],
    minAttunedBuildings: 3,
    passiveBonuses: {
      guard_towers: { power: 2.5, detection: 1.0, reach: 0.80 },
      mage_towers: { mana: 1.5, power: 2.5, manaRegen: 0.75 },
      shrines: { healing: 1.0, morale: 1.0, happiness: 0.75 },
    },
    specialEffects: {
      name: 'Reality Rifts & Curse Blessing',
      desc: 'Spell damage +250%; cursed events become blessings (reroll instantly); reality rifts teleport enemy units 1 tile away once per battle; happiness penalties grant +100% mana',
      mechanic: 'void_touched_paradox',
      spellDamageBoost: 2.50,
      manaFromCursePenalty: 1.0,
      riftTeleportRadius: 1,
    },
  },
};

/**
 * Get synergy by ID
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
 * Detect which synergies are currently active in a kingdom
 * Only checks without filtering to "one active"—caller decides activation logic
 */
function detectActiveSynergies(kingdom) {
  const attunements = kingdom.fragment_bonuses
    ? (typeof kingdom.fragment_bonuses === 'string'
        ? JSON.parse(kingdom.fragment_bonuses)
        : kingdom.fragment_bonuses)
    : {};

  const activeSynergies = [];

  for (const synergy of Object.values(SYNERGIES)) {
    if (isSynergyActive(synergy, attunements)) {
      activeSynergies.push(synergy);
    }
  }

  return activeSynergies;
}

/**
 * Check if a specific synergy is active based on current attunements
 */
function isSynergyActive(synergy, attunements) {
  const attuned = Object.values(attunements).map(a => a?.fragment).filter(f => f);

  const hasAllRequiredFragments = synergy.requiredFragments.every(frag =>
    attuned.includes(frag)
  );

  if (!hasAllRequiredFragments) return false;

  if (synergy.requiredBuildings.length === 0) {
    return attuned.filter(f => synergy.requiredFragments.includes(f)).length >= synergy.minAttunedBuildings;
  }

  const attuned_buildings = Object.entries(attunements)
    .filter(([, att]) => att && synergy.requiredFragments.includes(att.fragment))
    .map(([building]) => building);

  const hasAllRequiredBuildings = synergy.requiredBuildings.every(building =>
    attuned_buildings.includes(building)
  );

  return hasAllRequiredBuildings;
}

/**
 * Get the single active synergy for a kingdom (enforces one-per-kingdom rule)
 * Returns first active synergy in registry order, or null if none active
 */
function getActiveSynergy(kingdom) {
  const active = detectActiveSynergies(kingdom);
  return active.length > 0 ? active[0] : null;
}

/**
 * Get synergy bonuses for a specific building
 * Returns multiplier object if synergy active and building has bonuses, else empty object
 * Falls back to null key for global bonuses that apply to all buildings
 */
function getSynergyBonusMultiplier(synergy, buildingType) {
  if (!synergy || !synergy.passiveBonuses) return {};
  return synergy.passiveBonuses[buildingType] || synergy.passiveBonuses[null] || synergy.passiveBonuses['null'] || {};
}

/**
 * Check if synergy meets UI hint criteria (close to activation)
 * Used for "Synergy Possible" UI hints
 */
function isNearSynergyActivation(kingdom, synergy) {
  const attunements = kingdom.fragment_bonuses
    ? (typeof kingdom.fragment_bonuses === 'string'
        ? JSON.parse(kingdom.fragment_bonuses)
        : kingdom.fragment_bonuses)
    : {};

  const attuned = Object.values(attunements).map(a => a?.fragment).filter(f => f);
  const requiredCount = synergy.requiredFragments.length;
  const haveCount = synergy.requiredFragments.filter(frag => attuned.includes(frag)).length;

  return haveCount >= requiredCount - 1;
}

module.exports = {
  SYNERGIES,
  getSynergy,
  getAllSynergies,
  detectActiveSynergies,
  isSynergyActive,
  getActiveSynergy,
  getSynergyBonusMultiplier,
  isNearSynergyActivation,
};
