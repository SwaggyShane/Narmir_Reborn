const fragmentBonusManager = require('./fragment-bonus-manager');
const { getActiveSynergyCached } = require('./lib/synergy-cache');

const COMBAT_BUILDINGS = [
  'walls',
  'guard_towers',
  'outposts',
  'armories',
  'castles',
  'war_machines',
];

const SYNERGY_COMBAT_CAPS = {
  combat_power: 0.5,
  combat_damage: 0.5,
  troop_damage: 0.5,
  troop_health: 0.5,
  defense: 0.5,
  health: 0.5,
  damage: 0.5,
  power: 0.5,
  mana: 0.5,
  mana_regen: 0.5,
  spell_efficiency: 0.5,
  research_speed: 0.5,
};

function classifyEffect(effectKey) {
  if (!effectKey) return 'utility';
  if (['combat_power', 'combat_damage', 'troop_damage', 'damage', 'power', 'siege_output', 'ranged_offense'].includes(effectKey)) {
    return 'combat_offense';
  }
  if (['defense', 'health', 'troop_health', 'garrison_defense', 'defense_armor', 'defenses'].includes(effectKey)) {
    return 'combat_defense';
  }
  if (['research_speed', 'mana', 'mana_regen', 'spell_efficiency', 'decoding_speed'].includes(effectKey)) {
    return 'research';
  }
  if (['income', 'production', 'resources', 'economy_output', 'food_production'].includes(effectKey)) {
    return 'economy';
  }
  return 'utility';
}

function auditSynergyStack(kingdom) {
  const synergy = getActiveSynergyCached(kingdom);
  if (!synergy || !synergy.passive || !synergy.passive.effects) {
    return {
      active: null,
      totals: {
        combat_offense: 0,
        combat_defense: 0,
        research: 0,
        economy: 0,
        utility: 0,
      },
      effects: [],
      overages: [],
    };
  }

  const totals = {
    combat_offense: 0,
    combat_defense: 0,
    research: 0,
    economy: 0,
    utility: 0,
  };
  const effects = [];
  const overages = [];

  for (const [effectKey, rawValue] of Object.entries(synergy.passive.effects)) {
    const bucket = classifyEffect(effectKey);
    const value = Number(rawValue);
    const safeValue = Number.isFinite(value) ? value : 0;
    const cap = SYNERGY_COMBAT_CAPS[effectKey];
    const clampedDelta = typeof cap === 'number'
      ? Math.max(-cap, Math.min(cap, safeValue))
      : safeValue;

    effects.push({
      effectKey,
      bucket,
      rawValue: safeValue,
      clampedDelta,
      multiplier: 1.0 + clampedDelta,
    });

    totals[bucket] += clampedDelta;
    if (typeof cap === 'number' && safeValue !== clampedDelta) {
      overages.push({ effectKey, rawValue: safeValue, cap, clampedDelta });
    }
  }

  return {
    active: {
      id: synergy.id,
      name: synergy.name,
    },
    totals,
    effects,
    overages,
  };
}

function getCombatBalanceAudit(kingdom) {
  const fragmentAudit = fragmentBonusManager.getFragmentCombatAudit(kingdom);
  const synergyAudit = auditSynergyStack(kingdom);

  const combatBuildings = COMBAT_BUILDINGS.map(buildingType => {
    const fragment = fragmentBonusManager.getBuildingBonusDetails(kingdom, buildingType);
    if (!fragment.hasBonus) {
      return {
        buildingType,
        fragment: null,
        stats: [],
        fragmentMultiplier: 1.0,
      };
    }

    const stats = Object.entries(fragment.passive || {}).map(([statType, rawValue]) => {
      const value = Number(rawValue);
      const safeValue = Number.isFinite(value) ? value : 0;
      const bucket = fragmentBonusManager.classifyFragmentStat(statType);
      return {
        statType,
        bucket,
        rawValue: safeValue,
        multiplier: fragmentBonusManager.getBonusMultiplier(kingdom, buildingType, statType),
      };
    });

    const fragmentMultiplier = stats.reduce((product, stat) => product * stat.multiplier, 1.0);
    return {
      buildingType,
      fragment: fragment.fragment,
      stats,
      fragmentMultiplier,
    };
  });

  return {
    combatBuildings,
    fragmentAudit,
    synergyAudit,
    stackSummary: {
      fragmentCombatOffense: fragmentAudit.totals.combat_offense,
      fragmentCombatDefense: fragmentAudit.totals.combat_defense,
      synergyCombatOffense: synergyAudit.totals.combat_offense,
      synergyCombatDefense: synergyAudit.totals.combat_defense,
    },
  };
}

module.exports = {
  classifyEffect,
  auditSynergyStack,
  getCombatBalanceAudit,
};
