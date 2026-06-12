// Defense domain: defense rating labels, wall/tower/outpost power calculations,
// and defense tier (Fortified/Keep/Citadel) progression checks.

const { safeJsonParse } = require('../utils/helpers');
const fragmentBonusManager = require('./fragment-bonus-manager');
const effectsProcessor = require('./synergy-effects-processor');
const { unitLevelMult } = require('./lib/troops');
const { raceBonus } = require('./lib/race-bonus');
const { getSynergyPassiveBonusMultiplier } = require('./lib/synergy-cache');
const config = require('./config');
const {
  WALL_STRENGTH_MULT,
  TOWER_DETECT_MULT,
  OUTPOST_RANGER_MULT,
  DEFENSE_TIERS,
} = config;

function defenseRating(k) {
  const defUpgrades = safeJsonParse(
    k.defense_upgrades,
    {},
    'defenseRating:defense_upgrades',
  );
  if (defUpgrades.citadel) return '👑 Citadel';
  if (defUpgrades.keep) return '🏰 Keep';
  if (defUpgrades.fortified) return '🛡️ Fortified';

  return '🔴 Undefended';
}

// Wall contribution to defense power
function wallDefensePower(k) {
  const walls = k.bld_walls;
  if (!walls) return 0;
  const race = k.race || 'human';
  const mult = WALL_STRENGTH_MULT[race] || 1.0;
  const wallUpgrades = safeJsonParse(
    k.wall_upgrades,
    {},
    'wallDefensePower:wall_upgrades',
  );
  const reinMult = wallUpgrades.reinforced ? 1.25 : 1.0;

  const aBuffs = safeJsonParse(
    k.alliance_buffs,
    {},
    'wallDefensePower:alliance_buffs',
  );
  const vaultWallMult =
    1.0 + (aBuffs.fortress_walls ? aBuffs.fortress_walls * 0.05 : 0);

  // Fragment bonus multipliers for walls (health, defense, intangibility)
  const wallHealthMult = fragmentBonusManager.getBonusMultiplier(k, 'walls', 'health');
  const wallDefenseMult = fragmentBonusManager.getBonusMultiplier(k, 'walls', 'defense');
  const effectiveWallMult = wallHealthMult * wallDefenseMult;

  // Synergy passive bonus for defense
  const synergyDefenseMult = getSynergyPassiveBonusMultiplier(k, 'defense');

  // Base: each wall = 100 defense power (scaled by race + upgrades)
  const wmOnWalls = Math.min(k.ballistae || 0, walls);
  const wmBonus =
    wmOnWalls *
    500 *
    ((k.res_war_machines ?? 100) / 100) *
    (wallUpgrades.fortress_walls ? 1.75 : wallUpgrades.battlements ? 1.2 : 1.0);
  let wallPower = Math.floor(walls * 100 * mult * reinMult * vaultWallMult * effectiveWallMult * synergyDefenseMult + wmBonus);

  // Apply active ability effects (synergy_penalty.defense and all_stats)
  wallPower = effectsProcessor.applyMultiplicativeEffects(k, wallPower, 'defense');

  return wallPower;
}

// Guard tower contribution — thief detection
function towerDetectionPower(k) {
  const towers = k.bld_guard_towers;
  if (!towers) return 0;
  const race = k.race || 'human';
  const mult = TOWER_DETECT_MULT[race] || 1.0;
  const twUpgrades = safeJsonParse(
    k.tower_def_upgrades,
    {},
    'towerDetectionPower:tower_def_upgrades',
  );
  const arrwMult = twUpgrades.arrow_slits ? 1.2 : 1.0;
  const btlMult = safeJsonParse(
    k.wall_upgrades,
    {},
    'towerDetectionPower:wall_upgrades',
  ).battlements
    ? 1.2
    : 1.0;
  const thievesOnWatch = Math.min(k.thieves || 0, towers * 10);
  const thiefLvlMult = unitLevelMult(k, 'thieves');
  const stealthMult = raceBonus(k, 'stealth');

  // Fragment bonus multipliers for guard towers (detection, power, reach)
  const towerDetectMult = fragmentBonusManager.getBonusMultiplier(k, 'guard_towers', 'detection');
  const towerPowerMult = fragmentBonusManager.getBonusMultiplier(k, 'guard_towers', 'power');
  const towerReachMult = fragmentBonusManager.getBonusMultiplier(k, 'guard_towers', 'reach');
  const effectiveTowerMult = towerDetectMult * towerPowerMult * towerReachMult;

  return Math.floor(
    (towers * 50 + thievesOnWatch * 15 * thiefLvlMult * stealthMult) *
      mult *
      arrwMult *
      btlMult *
      effectiveTowerMult,
  );
}

// Outpost contribution — ranger patrol defense
function outpostRangerPower(k) {
  const outposts = k.bld_outposts;
  if (!outposts) return 0;
  const race = k.race || 'human';
  const mult = OUTPOST_RANGER_MULT[race] || 1.0;
  const opUpgrades = safeJsonParse(
    k.outpost_upgrades,
    {},
    'outpostRangerPower:outpost_upgrades',
  );
  const stationMult = opUpgrades.ranger_station ? 1.25 : 1.0;
  const rangersOnPatrol = Math.min(k.rangers || 0, outposts * 20);
  const rangerLvlMult = unitLevelMult(k, 'rangers');
  const militaryMult = raceBonus(k, 'military');

  // Fragment bonus multipliers for outposts (effectiveness, scouts, power)
  const outpostEffectMult = fragmentBonusManager.getBonusMultiplier(k, 'outposts', 'effectiveness');
  const outpostScoutsMult = fragmentBonusManager.getBonusMultiplier(k, 'outposts', 'scouts');
  const outpostPowerMult = fragmentBonusManager.getBonusMultiplier(k, 'outposts', 'power');
  const effectiveOutpostMult = outpostEffectMult * outpostScoutsMult * outpostPowerMult;

  return Math.floor(
    (outposts * 30 + rangersOnPatrol * 10 * rangerLvlMult * militaryMult) *
      mult *
      stationMult *
      effectiveOutpostMult,
  );
}

// Check and award defense tiers
function checkDefenseTiers(k, events) {
  const updates = {};
  const defUpgrades = safeJsonParse(
    k.defense_upgrades,
    {},
    'checkDefenseTiers:defense_upgrades',
  );
  const tiers = DEFENSE_TIERS;

  const w = k.bld_walls;
  const t = k.bld_guard_towers;
  const o = k.bld_outposts;
  const c = k.bld_castles;

  const meetsFortified =
    w >= tiers.fortified.walls &&
    t >= tiers.fortified.guard_towers &&
    o >= tiers.fortified.outposts &&
    c >= tiers.fortified.castles;
  const meetsKeep =
    w >= tiers.keep.walls &&
    t >= tiers.keep.guard_towers &&
    o >= tiers.keep.outposts &&
    c >= tiers.keep.castles;
  const meetsCitadel =
    w >= tiers.citadel.walls &&
    t >= tiers.citadel.guard_towers &&
    o >= tiers.citadel.outposts &&
    c >= tiers.citadel.castles;

  let changed = false;

  if (meetsFortified && !defUpgrades.fortified) {
    defUpgrades.fortified = true;
    changed = true;
    events.push({
      type: 'system',
      message: `🛡️ Fortified! Your defenses are solidifying. +5% permanent defense power, -5% land loss on defeat.`,
    });
  } else if (!meetsFortified && defUpgrades.fortified) {
    defUpgrades.fortified = false;
    changed = true;
    events.push({
      type: 'system',
      message: `⚠️ Lost Fortified status! Your defenses have degraded.`,
    });
  }

  if (meetsKeep && !defUpgrades.keep) {
    defUpgrades.keep = true;
    changed = true;
    events.push({
      type: 'system',
      message: `🏰 Keep established! Your fortress is becoming formidable. +10% permanent defense power, -10% land loss on defeat.`,
    });
  } else if (!meetsKeep && defUpgrades.keep) {
    defUpgrades.keep = false;
    changed = true;
    events.push({
      type: 'system',
      message: `⚠️ Lost Keep status! Your fortress has been compromised.`,
    });
  }

  if (meetsCitadel && !defUpgrades.citadel) {
    defUpgrades.citadel = true;
    changed = true;
    events.push({
      type: 'system',
      message: `👑 Castle Citadel achieved! Your fortress stands among the greatest in Narmir. +15% permanent defense power, -15% land loss on defeat, warmachines on walls deal ×2 damage.`,
    });
  } else if (!meetsCitadel && defUpgrades.citadel) {
    defUpgrades.citadel = false;
    changed = true;
    events.push({
      type: 'system',
      message: `🏚️ Castle Citadel lost! Your fortress no longer meets the requirements for the Citadel bonus.`,
    });
  }

  if (changed) {
    updates.defense_upgrades = JSON.stringify(defUpgrades);
  }
  return updates;
}

module.exports = {
  defenseRating,
  wallDefensePower,
  towerDetectionPower,
  outpostRangerPower,
  checkDefenseTiers,
};
