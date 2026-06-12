// Covert operations: spy, loot, assassinate, sabotage
// These operate independently of other game domains.

const { safeJsonParse } = require('../utils/helpers');
const { unitLevelMult, awardTroopXp, racialUnitBonus } = require('./lib/troops');
const { raceBonus } = require('./lib/race-bonus');
const fragmentBonusManager = require('./fragment-bonus-manager');

function isNight() {
  const h = new Date().getUTCHours();
  return h >= 1 && h < 13; // 8PM EST to 8AM EST (EST is UTC-5)
}

const ASSASSINATE_TARGETS = new Set([
  'fighters', 'rangers', 'clerics', 'mages', 'thieves', 'ninjas',
  'researchers', 'engineers', 'scribes', 'thralls',
]);

function covertSpy(spy, target, unitsSent) {
  let thiefLvMult = unitLevelMult(spy, 'thieves');
  if (spy.race === 'vampire' && isNight()) thiefLvMult *= 1.5;
  const stealthMulti =
    raceBonus(spy, 'stealth') * raceBonus(spy, 'covert') * thiefLvMult;

  let targetThiefLvMult = unitLevelMult(target, 'thieves');
  if (target.race === 'vampire' && isNight()) targetThiefLvMult *= 1.5;
  const targetStealthMulti = raceBonus(target, 'stealth') * targetThiefLvMult;

  const spyMb = safeJsonParse(spy.milestone_bonuses, {}, 'covertSpy:mb');
  const spyMilestoneMult = 1 + (spyMb.covert_pct || 0) / 100;
  const atkPower = unitsSent * stealthMulti * spyMilestoneMult;
  const defPower =
    (target.thieves || 0) * targetStealthMulti +
    (target.bld_guard_towers || 0) * 5 +
    1;

  const ratio = atkPower / defPower;

  if (ratio <= 1.0) {
    const failSeverity = 1 - Math.max(0, ratio);
    const catchRate = Math.min(0.25, Math.max(0.01, failSeverity * 0.25));
    const caught = Math.floor(unitsSent * catchRate);

    const wittyResponses = [
      'Your thieves tripped over their own cloaks.',
      'The enemy thieves were expecting you. A complete trap.',
      'A complete disaster! Your thieves forgot to whisper.',
      'They walked right through the front gate... and straight into the dungeon.',
      'Turns out, dressing as a bush doesn\'t work inside a castle.',
    ];
    let witty =
      wittyResponses[Math.floor(Math.random() * wittyResponses.length)];

    return {
      success: false,
      spyUpdates: { thieves: Math.max(0, (spy.thieves || 0) - caught) },
      targetUpdates: {},
      spyEvent: `Spy mission on ${target.name} failed — ${caught} thieves caught. ${witty}`,
      targetEvent: `${spy.name} attempted to spy on you — caught ${caught} thieves!`,
    };
  }

  let tier = 1;
  let noiseLevel = 0.3;
  if (ratio > 2.5) {
    tier = 3;
    noiseLevel = 0.15;
  } else if (ratio > 1.5) {
    tier = 2;
    noiseLevel = 0.25;
  }

  function noise(n) {
    if (n === undefined || n === null) return 0;
    const adjust = 1 + (Math.random() * 2 - 1) * noiseLevel;
    return Math.max(0, Math.floor(n * adjust));
  }

  const report = {};
  report.tier = tier;
  report.name = target.name;
  report.race = target.race;

  if (tier >= 1) {
    report.fighters = noise(target.fighters);
    report.rangers = noise(target.rangers);
  }

  if (tier >= 2) {
    report.mages = noise(target.mages);
    report.clerics = noise(target.clerics);
    report.thieves = noise(target.thieves);
    report.ninjas = noise(target.ninjas);
    report.engineers = noise(target.engineers);
    report.scribes = noise(target.scribes);
    report.researchers = noise(target.researchers);
    report.gold = noise(target.gold);
    report.food = noise(target.food);
    report.land = noise(target.land);
  }

  if (tier >= 3) {
    report.war_machines = noise(target.war_machines);
    const bldCols = [
      'bld_farm',
      'bld_barracks',
      'bld_housing',
      'bld_tavern',
      'bld_market',
      'bld_smithy',
      'bld_library',
      'bld_school',
      'bld_mage_tower',
      'bld_shrine',
      'bld_vault',
      'bld_mausoleum',
      'bld_walls',
      'bld_outpost',
      'bld_guard_towers',
      'bld_castle',
    ];
    for (const c of bldCols) {
      report[c] = noise(target[c]);
    }
  }

  const tXp = awardTroopXp(spy, 'thieves', tier * 8 + 4);

  let targetEvent = null;
  if (tier === 1 && Math.random() < 0.5) {
    targetEvent = `Rumors suggest spies from ${spy.name} were scouting your borders.`;
  }

  return {
    success: true,
    report,
    spyUpdates: { troop_levels: tXp.troop_levels },
    targetUpdates: {},
    spyEvent: `Spy report on ${target.name} retrieved! (Tier ${tier} Intel)`,
    targetEvent,
  };
}

function covertLoot(thief, target, requestedLootType, thievesSent) {
  if (thievesSent > (thief.thieves || 0)) return { error: 'Not enough thieves' };
  let thiefLvMult = unitLevelMult(thief, 'thieves');
  if (thief.race === 'vampire' && isNight()) thiefLvMult *= 1.5;
  const lootMb = safeJsonParse(thief.milestone_bonuses, {}, 'covertLoot:mb');
  const lootMilestoneMult = 1 + (lootMb.covert_pct || 0) / 100;
  const stealthMulti =
    raceBonus(thief, 'stealth') * raceBonus(thief, 'covert') * thiefLvMult * lootMilestoneMult;
  // Parse target vault fragment once — used for espionage_shield, gold_security, hoard_protection
  const targetVaultFrag = fragmentBonusManager.getFragmentForBuilding(target, 'vaults');
  const tVaultPassive = targetVaultFrag?.passive || {};
  const vaultEspionageShield = 1.0 + (tVaultPassive.espionage_shield || 0);
  // Parse target armory fragment once — used for espionage_guard, infiltration_defense
  const targetArmoryFrag = fragmentBonusManager.getFragmentForBuilding(target, 'armories');
  const tArmoryPassive = targetArmoryFrag?.passive || {};
  const armoryEspionageGuard = 1.0 + (tArmoryPassive.espionage_guard || 0);
  const armoryInfiltrationDefense = 1.0 + (tArmoryPassive.infiltration_defense || 0);
  // Combine espionage_guard and infiltration_defense into single multiplier for armory defense
  const armoryDefenseMult = Math.max(armoryEspionageGuard, armoryInfiltrationDefense);
  const success =
    (thief.thieves || 0) * stealthMulti >
    (target.fighters || 0) * 0.015 +
      (target.bld_guard_towers || 0) * 3 +
      (target.bld_armories || 0) * 10 * armoryDefenseMult +
      (target.bld_vaults || 0) * 10 * vaultEspionageShield;
  if (!success) {
    return {
      success: false,
      thiefUpdates: { thieves: (thief.thieves || 0) - Math.floor(thievesSent * 0.25) },
      targetUpdates: {},
      thiefEvent: `Loot attempt on ${target.name} failed. Thieves captured.`,
      targetEvent: `Thieves were caught attempting to loot your kingdom.`,
    };
  }

  const RESEARCH_TYPES = ['res_economy', 'res_weapons', 'res_armor', 'res_military', 'res_spellbook', 'res_attack_magic', 'res_defense_magic', 'res_entertainment', 'res_construction', 'res_war_machines'];
  const RESOURCE_TYPES = ['wood', 'stone', 'iron'];

  // Normalize: if a specific sub-type was passed directly, map it to its parent category
  let lootType = requestedLootType;
  let actualLootType = lootType;
  if (RESEARCH_TYPES.includes(lootType)) {
    actualLootType = lootType;
    lootType = 'research';
  } else if (RESOURCE_TYPES.includes(lootType)) {
    actualLootType = lootType;
    lootType = 'resources';
  } else if (!lootType || lootType === 'random') {
    const lootCategories = ['gold', 'food', 'war_machines', 'maps', 'blueprints', 'hammers', 'research', 'resources', 'trade_routes'];
    lootType = lootCategories[Math.floor(Math.random() * lootCategories.length)];
    actualLootType = lootType;
  }

  // For grouped categories, randomly select the specific sub-type
  if (lootType === 'research' && actualLootType === 'research') {
    actualLootType = RESEARCH_TYPES[Math.floor(Math.random() * RESEARCH_TYPES.length)];
  } else if (lootType === 'resources' && actualLootType === 'resources') {
    actualLootType = RESOURCE_TYPES[Math.floor(Math.random() * RESOURCE_TYPES.length)];
  }

  const targetUpdates = {};
  let stolen = 0,
    desc = '';

  const bankUpgrades = safeJsonParse(
    target.bank_upgrades,
    {},
    'covertLoot:bank_upgrades',
  );
  let goldFloor = 0;
  if (bankUpgrades.iron_treasury) {
    goldFloor = Math.floor((target.gold || 0) * 0.25);
  }

  let hoardBurnLoss = 0; // thieves burned by Dragon Scale vault hoard_protection

  // Level scales loot amount
  if (actualLootType === 'gold') {
    stolen = Math.floor(thievesSent * (50 + Math.random() * 50) * thiefLvMult);
    stolen = Math.min(stolen, Math.floor((target.gold || 0) * 0.05));

    // Dwarven Star-Metal vaults prevent the treasury from being looted entirely
    if (targetVaultFrag && targetVaultFrag.fragment === 'Dwarven Star-Metal') {
      stolen = 0;
      desc = `0 gold — protected by Star-Metal gear locks`;
    } else {
      // gold_security passive reduces theft amount (capped at 95% reduction)
      const goldSecReduction = Math.max(0, Math.min(0.95, tVaultPassive.gold_security || 0));
      stolen = Math.floor(stolen * (1.0 - goldSecReduction));

      // Protect gold floor
      if ((target.gold || 0) - stolen < goldFloor) {
        stolen = (target.gold || 0) - goldFloor;
        if (stolen < 0) stolen = 0;
      }

      if (stolen > 0) {
        targetUpdates.gold = (target.gold || 0) - stolen;
      }
      desc = `${stolen.toLocaleString()} gold`;

      // Dragon Scale hoard_protection: draconic curse burns 50% of thievesSent on success
      if (targetVaultFrag && targetVaultFrag.fragment === 'Dragon Scale' && stolen > 0) {
        hoardBurnLoss = Math.floor(thievesSent * 0.50);
        if (hoardBurnLoss > 0) {
          desc += ` (draconic curse burned ${hoardBurnLoss} thief/thieves)`;
        }
      }
    }
  } else if (actualLootType === 'war_machines') {
    stolen = Math.floor(thievesSent * 0.01 * thiefLvMult);
    stolen = Math.min(stolen, target.war_machines || 0);
    targetUpdates.war_machines = Math.max(0, (target.war_machines || 0) - stolen);
    desc = `${stolen} war machine(s)`;
  } else if (actualLootType === 'food') {
    stolen = Math.floor(
      thievesSent * (100 + Math.random() * 100) * thiefLvMult,
    );
    stolen = Math.min(stolen, Math.floor((target.food || 0) * 0.1));

    // Dragon Scale granaries block 100% of food theft
    const granaryFragment = fragmentBonusManager.getFragmentForBuilding(target, 'granaries');
    if (granaryFragment && granaryFragment.fragment === 'Dragon Scale') {
      stolen = 0;
      desc = `0 food — protected by draconic scales`;
    } else {
      targetUpdates.food = Math.max(0, (target.food || 0) - stolen);
      desc = `${stolen.toLocaleString()} food`;
    }
  } else if (actualLootType === 'maps') {
    const targetFragment = fragmentBonusManager.getFragmentForBuilding(target, 'libraries');
    const hasProtection = targetFragment && (targetFragment.fragment === 'Dwarven Star-Metal' || targetFragment.fragment === 'Dragon Scale');

    if (hasProtection) {
      stolen = 0;
      desc = `0 map(s) — protected by ancient magic`;
    } else {
      stolen = Math.floor(thievesSent * 0.05 * thiefLvMult);
      stolen = Math.min(stolen, target.maps || 0);
      targetUpdates.maps = (target.maps || 0) - stolen;
      desc = `${stolen} map(s)`;
    }
  } else if (actualLootType === 'blueprints') {
    stolen = Math.floor(thievesSent * 0.01 * thiefLvMult);
    stolen = Math.min(stolen, target.blueprints_stored || 0);

    // Dwarven Star-Metal mausoleums protect blueprints from theft
    const mausoleumFragment = fragmentBonusManager.getFragmentForBuilding(target, 'mausoleums');
    if (mausoleumFragment && mausoleumFragment.fragment === 'Dwarven Star-Metal') {
      stolen = 0;
      desc = `0 blueprint(s) — protected by Star-Metal safeguards`;
    } else {
      targetUpdates.blueprints_stored = (target.blueprints_stored || 0) - stolen;
      desc = `${stolen} blueprint(s)`;
    }
  } else if (actualLootType === 'hammers') {
    stolen = Math.floor(thievesSent * 0.05 * thiefLvMult);
    stolen = Math.min(stolen, target.hammers_stored || 0);
    targetUpdates.hammers_stored = (target.hammers_stored || 0) - stolen;
    desc = `${stolen} hammer(s)`;
  } else if (lootType === 'research') {
    stolen = Math.floor(thievesSent * 0.2 * thiefLvMult);
    stolen = Math.min(stolen, target[actualLootType] || 0);
    const resName = actualLootType.replace('res_', '').replace(/_/g, ' ');
    targetUpdates[actualLootType] = Math.max(0, (target[actualLootType] || 0) - stolen);
    desc = `${stolen} ${resName} research points`;
  } else if (lootType === 'resources') {
    stolen = Math.floor(thievesSent * (30 + Math.random() * 30) * thiefLvMult);
    stolen = Math.min(stolen, Math.floor((target[actualLootType] || 0) * 0.1));
    targetUpdates[actualLootType] = Math.max(0, (target[actualLootType] || 0) - stolen);
    desc = `${stolen.toLocaleString()} ${actualLootType}`;
  } else if (actualLootType === 'trade_routes') {
    stolen = Math.floor(thievesSent * 0.02 * thiefLvMult);
    stolen = Math.min(stolen, target.trade_routes || 0);
    targetUpdates.trade_routes = Math.max(0, (target.trade_routes || 0) - stolen);
    desc = `${stolen} trade route(s)`;
  }

  const tXp = awardTroopXp(thief, 'thieves', 20);
  const thiefUpdates = { troop_levels: tXp.troop_levels };
  if (hoardBurnLoss > 0) {
    thiefUpdates.thieves = Math.max(0, (thief.thieves || 0) - hoardBurnLoss);
  }
  return {
    success: true,
    stolen,
    lootType,
    actualLootType,
    thiefUpdates,
    targetUpdates,
    thiefEvent: `Looted ${desc} from ${target.name}.`,
    targetEvent: `Thieves infiltrated your kingdom and stole ${desc}.`,
  };
}

function covertAssassinate(assassin, target, ninjasSent, unitType) {
  if (ninjasSent > (assassin.ninjas || 0)) return { error: 'Not enough ninjas' };
  if (!ASSASSINATE_TARGETS.has(unitType)) return { error: 'Invalid unit type' };
  let ninjaLvMult = unitLevelMult(assassin, 'ninjas');
  if (assassin.race === 'vampire') ninjaLvMult *= 1.1;
  const assMb = safeJsonParse(assassin.milestone_bonuses, {}, 'covertAssassinate:mb');
  const assMilestoneMult = 1 + (assMb.covert_pct || 0) / 100;
  const stealthMulti =
    raceBonus(assassin, 'stealth') * raceBonus(assassin, 'covert') * ninjaLvMult * assMilestoneMult;
  const success =
    (assassin.ninjas || 0) * stealthMulti * 1.2 >
    (target[unitType] || 0) * 0.01 + (target.bld_guard_towers || 0) * 2;

  if (!success) {
    return {
      success: false,
      assassinUpdates: {
        ninjas: (assassin.ninjas || 0) - Math.floor(ninjasSent * 0.2),
      },
      targetUpdates: {},
      assassinEvent: `Assassination of ${unitType} in ${target.name} failed. Ninjas compromised.`,
      targetEvent: `Enemy ninjas were caught attempting to assassinate your ${unitType}!`,
    };
  }

  const killed = Math.floor(
    ninjasSent * (10 + Math.random() * 10) * ninjaLvMult,
  );
  const targetUpdates = { [unitType]: Math.max(0, (target[unitType] || 0) - killed) };

  // Vampire racial bonus
  let vampireBonusStr = '';
  const assassinUpdates = {
    ninjas: assassin.ninjas,
  };
  if (assassin.race === 'vampire') {
    // 50% chance to acquire troops as thralls instead of just assassinating them
    if (Math.random() < 0.5) {
      const thrallsGained = Math.floor(killed * 0.25);
      if (thrallsGained > 0) {
        const cap = ((assassin.bld_mausoleums || 0) * 100);
        const current = assassin.thralls || 0;
        const added = Math.min(thrallsGained, Math.max(0, cap - current));
        if (added > 0) {
          assassinUpdates.thralls = current + added;
          vampireBonusStr = ` (Vampiric Bite converted ${added} into Thralls)`;
        }
      }
    }
  }

  // Dark Elf racial bonus: level 5+ ninjas leave no trace
  const darkElfBonus = racialUnitBonus(assassin, 'ninjas');
  const silent = darkElfBonus.silentAssassination;

  const nXp = awardTroopXp(assassin, 'ninjas', 30);
  Object.assign(assassinUpdates, { troop_levels: nXp.troop_levels });

  return {
    success: true,
    killed,
    silent,
    assassinUpdates,
    targetUpdates,
    assassinEvent: `Assassinated ${killed.toLocaleString()} ${unitType} in ${target.name}.${silent ? ' No trace left.' : ''}${vampireBonusStr}`,
    targetEvent: silent
      ? null
      : `${assassin.name}'s ninjas assassinated ${killed.toLocaleString()} of your ${unitType}.`,
  };
}

function covertSabotage(assassin, target, ninjasSent, bldType) {
  if (ninjasSent > (assassin.ninjas || 0)) return { error: 'Not enough ninjas' };

  const BLD_MAP = {
    farms: 'bld_farms',
    granaries: 'bld_granaries',
    smithies: 'bld_smithies',
    mage_towers: 'bld_mage_towers',
    barracks: 'bld_barracks',
    libraries: 'bld_libraries',
    schools: 'bld_schools',
    armories: 'bld_armories',
    housing: 'bld_housing',
    markets: 'bld_markets',
    shrines: 'bld_shrines',
    outposts: 'bld_outposts',
    training: 'bld_training',
    guard_towers: 'bld_guard_towers',
    vaults: 'bld_vaults',
    castles: 'bld_castles',
    taverns: 'bld_taverns',
    mausoleums: 'bld_mausoleums',
    walls: 'bld_walls',
    war_machines: 'war_machines',
  };
  const col = BLD_MAP[bldType];
  if (!col) return { error: 'Invalid building type' };

  let ninjaLvMult = unitLevelMult(assassin, 'ninjas');
  if (assassin.race === 'vampire') ninjaLvMult *= 1.1;
  const stealthMulti =
    raceBonus(assassin, 'stealth') * raceBonus(assassin, 'covert') * ninjaLvMult;

  const success =
    (assassin.ninjas || 0) * stealthMulti * 1.2 >
    ((target.thieves || 0) * 0.015) + ((target.bld_guard_towers || 0) * (2 + ((target.thieves || 0) * 0.001)));

  if (!success) {
    const ninjasLost = Math.floor(ninjasSent * 0.2);
    return {
      success: false,
      ninjasLost,
      assassinUpdates: { ninjas: (assassin.ninjas || 0) - ninjasLost },
      targetUpdates: {},
      assassinEvent: `Sabotage of ${bldType} in ${target.name} failed. Ninjas compromised.`,
      targetEvent: `Enemy ninjas were caught attempting to sabotage your buildings!`,
    };
  }

  const destroyed = Math.floor(
    ninjasSent * (3 + Math.random() * 4) * ninjaLvMult,
  );
  const actualDestroyed = Math.min(target[col] || 0, destroyed);
  const targetUpdates = { [col]: ((target[col] || 0) - actualDestroyed) };

  const nXp = awardTroopXp(assassin, 'ninjas', 40);
  const assassinUpdates = {
    ninjas: assassin.ninjas,
    troop_levels: nXp.troop_levels,
  };

  // Dark Elf racial bonus: silent sabotage
  const darkElfBonus = racialUnitBonus(assassin, 'ninjas');
  const silent = darkElfBonus.silentAssassination;

  return {
    success: true,
    destroyed: actualDestroyed,
    silent,
    assassinUpdates,
    targetUpdates,
    assassinEvent: `Sabotaged ${actualDestroyed.toLocaleString()} ${bldType.replace(/_/g, ' ')} in ${target.name}.${silent ? ' No trace left.' : ''}`,
    targetEvent: silent
      ? null
      : `${assassin.name}'s ninjas sabotaged ${actualDestroyed.toLocaleString()} of your ${bldType.replace(/_/g, ' ')}.`,
  };
}

module.exports = {
  covertSpy,
  covertLoot,
  covertAssassinate,
  covertSabotage,
  ASSASSINATE_TARGETS,
};
