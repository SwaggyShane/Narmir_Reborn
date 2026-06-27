// game/lib/combat-wrappers.js
// Combat resolution wrappers: orchestrate military attacks and unit losses.
// Pure functions (deterministic given kingdom state, RNG seeded externally).
// Requires access to combat-resolver, heroes, defense, troops, config modules.

const { safeJsonParse } = require('../../utils/helpers');
const { isNight, calcDiscoveryChance } = require('./data-transformations');
const { happinessCombatMult, formatCombatV2NewsBlurb } = require('./combat-helpers');
const {
  effectiveTroopLevel,
  getAvailableUnits,
  unitLevelMult,
} = require('./troops');
const { raceBonus } = require('./race-bonus');
const fragmentBonusManager = require('../fragment-bonus-manager');
const { applyWarmachineDamage } = require('./defense');
const heroesMod = require('../heroes');
const defenseMod = require('../defense');
const combatResolverV2 = require('../combat-resolver');

const { getHeroPower } = heroesMod;
const { wallDefensePower, towerDetectionPower, outpostRangerPower } = defenseMod;

// Import constants from config
const xpMod = require('../xp');
const { awardXp } = xpMod;

const config = require('../config');
const {
  PRESTIGE_MODIFIERS,
  WM_CREW_REQUIRED,
} = config;

const USE_COMBAT_V2 = process.env.USE_COMBAT_V2 === "1";
const HAPPINESS_FLOOR = 0;

function wmCrewRequired(race, engineerLevel) {
  let base = WM_CREW_REQUIRED[race] || 3;
  if (race === "dwarf" && engineerLevel >= 25) base = 1;
  return base;
}

function resolveMilitaryAttackV2Adapter(
  attacker,
  defender,
  sentUnits,
  attackerHeroes = [],
  defenderHeroes = [],
) {
  attacker.heroes = attackerHeroes;
  defender.heroes = defenderHeroes;
  const combatIsNight =
    typeof attacker.__combatIsNight === "boolean"
      ? attacker.__combatIsNight
      : typeof defender.__combatIsNight === "boolean"
        ? defender.__combatIsNight
        : isNight();
  const attackerIsVampire = attacker.race === "vampire";
  const defenderIsVampire = defender.race === "vampire";
  const defenderUsesDayThralls = defenderIsVampire && !combatIsNight;
  const attackingThralls = attackerIsVampire ? Math.max(0, attacker.thralls || 0) : 0;
  const defendingThralls = defenderIsVampire ? Math.max(0, defender.thralls || 0) : 0;

  const sent = {
    thralls: attackingThralls,
    fighters: Math.min(sentUnits.fighters || 0, attacker.fighters || 0),
    rangers: Math.min(sentUnits.rangers || 0, attacker.rangers || 0),
    mages: Math.min(sentUnits.mages || 0, attacker.mages || 0),
    warMachines: Math.min(sentUnits.warMachines || 0, attacker.war_machines || 0),
    ninjas: Math.min(sentUnits.ninjas || 0, attacker.ninjas || 0),
    thieves: Math.min(sentUnits.thieves || 0, attacker.thieves || 0),
    clerics: Math.min(sentUnits.clerics || 0, attacker.clerics || 0),
    engineers: Math.min(sentUnits.engineers || 0, attacker.engineers || 0),
    ladders: Math.min(sentUnits.ladders || 0, attacker.ladders || 0),
  };

  if (
    sent.fighters <= 0 &&
    sent.rangers <= 0 &&
    sent.mages <= 0 &&
    sent.ninjas <= 0
  ) {
    return { error: "Send at least some combat troops" };
  }

  const v2Attacker = {
    ...attacker,
    thralls: sent.thralls,
    fighters: sent.fighters,
    rangers: sent.rangers,
    mages: sent.mages,
    war_machines: sent.warMachines,
    ninjas: sent.ninjas,
    thieves: sent.thieves,
    clerics: sent.clerics,
    engineers: sent.engineers,
    ladders: sent.ladders,
  };
  const v2Defender = {
    ...defender,
    __vampireDayDefense: defenderUsesDayThralls,
    thralls: defendingThralls,
    fighters: defenderUsesDayThralls ? 0 : getAvailableUnits(defender, "fighters"),
    rangers: defenderUsesDayThralls ? 0 : getAvailableUnits(defender, "rangers"),
    mages: defenderUsesDayThralls ? 0 : getAvailableUnits(defender, "mages"),
    ninjas: defenderUsesDayThralls ? 0 : getAvailableUnits(defender, "ninjas"),
    thieves: defenderUsesDayThralls ? 0 : getAvailableUnits(defender, "thieves"),
    clerics: defenderUsesDayThralls ? 0 : getAvailableUnits(defender, "clerics"),
    engineers: defenderUsesDayThralls ? 0 : getAvailableUnits(defender, "engineers"),
    war_machines: defenderUsesDayThralls ? 0 : (defender.war_machines || 0),
  };
  const defenderAvailable = {
    thralls: v2Defender.thralls,
    fighters: v2Defender.fighters,
    rangers: v2Defender.rangers,
    mages: v2Defender.mages,
    ninjas: v2Defender.ninjas,
    thieves: v2Defender.thieves,
    clerics: v2Defender.clerics,
    engineers: v2Defender.engineers,
    war_machines: v2Defender.war_machines || 0,
  };

  const v2Result = combatResolverV2.executeCombat(
    null,
    v2Attacker,
    v2Defender,
    "military",
    "fighters",
  );

  const attackerUpdates = {
    ...v2Result.attackerUpdates,
    thralls: Math.max(0, (attacker.thralls || 0) - (sent.thralls - v2Attacker.thralls)),
    fighters: Math.max(0, (attacker.fighters || 0) - (sent.fighters - v2Attacker.fighters)),
    rangers: Math.max(0, (attacker.rangers || 0) - (sent.rangers - v2Attacker.rangers)),
    mages: Math.max(0, (attacker.mages || 0) - (sent.mages - v2Attacker.mages)),
    ninjas: Math.max(0, (attacker.ninjas || 0) - (sent.ninjas - v2Attacker.ninjas)),
    thieves: Math.max(0, (attacker.thieves || 0) - (sent.thieves - v2Attacker.thieves)),
    clerics: Math.max(0, (attacker.clerics || 0) - (sent.clerics - v2Attacker.clerics)),
    engineers: Math.max(0, (attacker.engineers || 0) - (sent.engineers - v2Attacker.engineers)),
    war_machines: Math.max(0, (attacker.war_machines || 0) - (sent.warMachines - v2Attacker.war_machines)),
  };

  const defenderUpdates = {
    ...v2Result.defenderUpdates,
    last_attack_turn: defender.turn || 0,
    thralls: Math.max(0, (defender.thralls || 0) - (defenderAvailable.thralls - v2Defender.thralls)),
    fighters: Math.max(0, (defender.fighters || 0) - (defenderAvailable.fighters - v2Defender.fighters)),
    rangers: Math.max(0, (defender.rangers || 0) - (defenderAvailable.rangers - v2Defender.rangers)),
    mages: Math.max(0, (defender.mages || 0) - (defenderAvailable.mages - v2Defender.mages)),
    ninjas: Math.max(0, (defender.ninjas || 0) - (defenderAvailable.ninjas - v2Defender.ninjas)),
    thieves: Math.max(0, (defender.thieves || 0) - (defenderAvailable.thieves - v2Defender.thieves)),
    clerics: Math.max(0, (defender.clerics || 0) - (defenderAvailable.clerics - v2Defender.clerics)),
    engineers: Math.max(0, (defender.engineers || 0) - (defenderAvailable.engineers - v2Defender.engineers)),
    war_machines: Math.max(0, v2Defender.war_machines || 0),
  };

  const landTransferred = v2Result.win ? Math.floor((defender.land || 0) * 0.1) : 0;
  if (landTransferred > 0) {
    attackerUpdates.land = (attacker.land || 0) + landTransferred;
    defenderUpdates.land = Math.max(0, (defender.land || 0) - landTransferred);
  }

  const atkXp = awardXp(attacker, v2Result.win ? "combat_win" : "combat_loss", 1);
  const defXp = awardXp(defender, v2Result.win ? "combat_loss" : "combat_win", 1);
  attackerUpdates.xp = atkXp.xp;
  attackerUpdates.level = atkXp.level;
  defenderUpdates.xp = defXp.xp;
  defenderUpdates.level = defXp.level;

  const attackerDead = v2Result.report.injuredTroops?.attacker?.deadByType || {};
  const defenderDead = v2Result.report.injuredTroops?.defender?.deadByType || {};
  const attackerInjured = v2Result.report.injuredTroops?.attacker?.injuredByType || {};
  const defenderInjured = v2Result.report.injuredTroops?.defender?.injuredByType || {};
  const defenderEngaged = {
    ...defenderAvailable,
    war_machines: v2Result.report.diagnostics?.defender?.structureDefense?.ballistae || 0,
  };
  const wallHpBefore = defender.wall_hp || 0;
  const wallHpAfter = defenderUpdates.wall_hp ?? wallHpBefore;

  const report = {
    ...v2Result.report,
    win: v2Result.win,
    sent,
    defenderEngaged,
    landTransferred,
    combatSystem: "v2",
    atkPower: Math.round(v2Result.report.diagnostics?.attacker?.totalDmg || 0),
    defPower: Math.round(v2Result.report.diagnostics?.defender?.totalDmg || 0),
    powerRatio: Math.round(
      ((v2Result.report.diagnostics?.attacker?.totalDmg || 0) /
        Math.max(1, v2Result.report.diagnostics?.defender?.totalDmg || 0)) *
        100,
    ) / 100,
    atkFightersLost: attackerDead.fighters || 0,
    atkThrallsLost: attackerDead.thralls || 0,
    atkRangersLost: attackerDead.rangers || 0,
    atkMagesLost: attackerDead.mages || 0,
    atkNinjasLost: attackerDead.ninjas || 0,
    atkClericsLost: attackerDead.clerics || 0,
    atkThievesLost: attackerDead.thieves || 0,
    atkEngineersLost: attackerDead.engineers || 0,
    atkWmLost: attackerDead.war_machines || 0,
    defFightersLost: defenderDead.fighters || 0,
    defThrallsLost: defenderDead.thralls || 0,
    defRangersLost: defenderDead.rangers || 0,
    defMagesLost: defenderDead.mages || 0,
    defNinjasLost: defenderDead.ninjas || 0,
    defClericsLost: defenderDead.clerics || 0,
    defThievesLost: defenderDead.thieves || 0,
    defEngineersLost: defenderDead.engineers || 0,
    defWmLost: defenderDead.war_machines || 0,
    atkInjuredByType: attackerInjured,
    defInjuredByType: defenderInjured,
    ninjaKills: v2Result.report.ninjaAssassinations?.filter((a) => a.success).length || 0,
    rangerKills: 0,
    flankKills: 0,
    thiefSabotage: v2Result.report.disabledWarMachines || 0,
    criticalHits:
      (v2Result.report.injuredTroops?.attacker?.criticalHits || 0) +
      (v2Result.report.injuredTroops?.defender?.criticalHits || 0),
    criticalKills:
      (v2Result.report.injuredTroops?.attacker?.criticalKills || 0) +
      (v2Result.report.injuredTroops?.defender?.criticalKills || 0),
    wallsDestroyed: 0,
    wallHpBefore,
    wallHpAfter,
    wallDamage: v2Result.report.wallDamage || 0,
    steps: [
      {
        phase: "Diagnostics",
        title: "Combat V2",
        msg: "Experimental HP/DMG combat resolved behind USE_COMBAT_V2.",
        icon: "V2",
      },
      {
        phase: "Power",
        title: "HP/DMG Budget",
        msg: `Attacker DMG ${Math.round(v2Result.report.diagnostics?.attacker?.totalDmg || 0)} vs Defender DMG ${Math.round(v2Result.report.diagnostics?.defender?.totalDmg || 0)}.`,
        icon: "V2",
      },
      {
        phase: "Summary",
        title: "Casualty Report",
        msg: `Attacker deaths: ${v2Result.report.attackerKilled || 0}. Defender deaths: ${v2Result.report.defenderKilled || 0}. Critical kills: ${
          (v2Result.report.injuredTroops?.attacker?.criticalKills || 0) +
          (v2Result.report.injuredTroops?.defender?.criticalKills || 0)
        }.`,
        icon: "V2",
      },
    ],
  };

  const atkEvent = formatCombatV2NewsBlurb(attacker, defender, report, "attacker");
  const defEvent = formatCombatV2NewsBlurb(attacker, defender, report, "defender");

  return {
    win: v2Result.win,
    report,
    attackerUpdates,
    defenderUpdates,
    atkEvent,
    defEvent,
  };
}

function resolveMilitaryAttack(
  attacker,
  defender,
  sentUnits,
  attackerHeroes = [],
  defenderHeroes = [],
) {
  attacker.heroes = attackerHeroes;
  defender.heroes = defenderHeroes;
  if (USE_COMBAT_V2) {
    return resolveMilitaryAttackV2Adapter(
      attacker,
      defender,
      sentUnits,
      attackerHeroes,
      defenderHeroes,
    );
  }
  const steps = [];
  const attackerUpdates = {};
  const defenderUpdates = {
    last_attack_turn: defender.turn || 0
  };
  const sent = {
    fighters: Math.min(sentUnits.fighters || 0, attacker.fighters || 0),
    rangers: Math.min(sentUnits.rangers || 0, attacker.rangers || 0),
    mages: Math.min(sentUnits.mages || 0, attacker.mages || 0),
    warMachines: Math.min(
      sentUnits.warMachines || 0,
      attacker.war_machines || 0,
    ),
    ninjas: Math.min(sentUnits.ninjas || 0, attacker.ninjas || 0),
    thieves: Math.min(sentUnits.thieves || 0, attacker.thieves || 0),
    clerics: Math.min(sentUnits.clerics || 0, attacker.clerics || 0),
    engineers: Math.min(sentUnits.engineers || 0, attacker.engineers || 0),
    ladders: Math.min(sentUnits.ladders || 0, attacker.ladders || 0),
  };
  const laddersActive = sent.ladders;
  if (
    sent.fighters <= 0 &&
    sent.rangers <= 0 &&
    sent.mages <= 0 &&
    sent.ninjas <= 0
  )
    return { error: "Send at least some combat troops" };

  const landRatio = (attacker.land || 1) / Math.max(1, defender.land || 1);
  const fighterRatio =
    (attacker.fighters || 1) / Math.max(1, defender.fighters || 1);
  let bullyRatio = Math.max(landRatio, fighterRatio * 0.5);
  let bullyPenalty = 1.0;
  let bullyMsg = null;
  let shameEvent = null;
  if (bullyRatio >= 8) {
    bullyPenalty = 0.4;
    bullyMsg = "⚠️ Your kingdom is disgraced attacking such a weak foe.";
    shameEvent = `👑 ${attacker.name} has attacked the much weaker ${defender.name}. The world watches in disgust.`;
  } else if (bullyRatio >= 4) {
    bullyPenalty = 0.6;
    bullyMsg = "⚠️ Happiness suffers — this is slaughter, not war.";
  } else if (bullyRatio >= 2) {
    bullyPenalty = 0.8;
    bullyMsg = "⚠️ Your troops lack motivation fighting a weaker foe.";
  }

  const atkHappinessMult = happinessCombatMult(attacker.happiness !== undefined && attacker.happiness !== null ? attacker.happiness : 50);
  const defHappinessMult = happinessCombatMult(defender.happiness !== undefined && defender.happiness !== null ? defender.happiness : 50);

  const atkFighterLvl = effectiveTroopLevel(attacker, "fighters") / 50;
  const atkRangerLvl = effectiveTroopLevel(attacker, "rangers") / 50;
  const atkMageLvl = effectiveTroopLevel(attacker, "mages") / 50;
  const atkNinjaLvl = effectiveTroopLevel(attacker, "ninjas") / 50;
  let atkThiefLvl = effectiveTroopLevel(attacker, "thieves") / 50;
  const defFighterLvl = effectiveTroopLevel(defender, "fighters") / 50;
  const defRangerLvl = effectiveTroopLevel(defender, "rangers") / 50;
  const defMageLvl = effectiveTroopLevel(defender, "mages") / 50;
  const defNinjaLvl = effectiveTroopLevel(defender, "ninjas") / 50;

  const night = isNight();
  if (attacker.race === "vampire" && night) atkThiefLvl *= 1.5;

  const defAvail = {
    fighters: getAvailableUnits(defender, "fighters"),
    rangers: getAvailableUnits(defender, "rangers"),
    mages: getAvailableUnits(defender, "mages"),
    ninjas: getAvailableUnits(defender, "ninjas"),
    thieves: getAvailableUnits(defender, "thieves"),
    clerics: getAvailableUnits(defender, "clerics"),
    engineers: getAvailableUnits(defender, "engineers"),
  };

  let daylightPenaltyMsg = null;
  if (defender.race === "vampire" && !night) {
    defAvail.fighters = 0;
    defAvail.rangers = 0;
    defAvail.mages = 0;
    defAvail.ninjas = 0;
    defAvail.thieves = 0;

    let thrallMult = 5.0;
    const defMausUpg = safeJsonParse(defender.mausoleum_upgrades, {}, "auto:mausoleum_upgrades");
    if (defMausUpg.night_watch) {
      thrallMult += 0.5;
    }
    defAvail.clerics = Math.floor(defAvail.clerics * thrallMult);

    daylightPenaltyMsg =
      "☀️ Daylight penalty: Only Thralls defend the Vampire stronghold during the day, but with massive fervor!";
  }

  let defWmActive = defender.war_machines || 0;
  let thiefSabotage = 0;
  if (sent.thieves > 0) {
    const sabotageChance = Math.min(
      0.4,
      sent.thieves * 0.001 * atkThiefLvl * raceBonus(attacker, "stealth"),
    );
    const disabledWm = Math.floor(defWmActive * sabotageChance);
    defWmActive = Math.max(0, defWmActive - disabledWm);
    thiefSabotage = disabledWm;
    steps.push({
      phase: "Sabotage",
      title: "Thief Sabotage",
      msg: `Thieves disabled ${disabledWm} defending war machines.`,
      icon: "🥷",
    });
  }

  let ninjaKills = 0;
  let ninjaIntercepted = 0;
  if (sent.ninjas > 0) {
    const strikeRate =
      0.01 +
      Math.min(
        0.03,
        sent.ninjas * 0.0001 * atkNinjaLvl * raceBonus(attacker, "stealth"),
      );
    const rawKills = Math.floor(defAvail.fighters * strikeRate);
    const interceptRate = Math.min(0.5, defAvail.ninjas * 0.001 * defNinjaLvl);
    ninjaIntercepted = Math.floor(rawKills * interceptRate);
    ninjaKills = Math.max(0, rawKills - ninjaIntercepted);
    steps.push({
      phase: "Stealth",
      title: "Ninja Strike",
      msg: `Ninjas struck the defense line causing ${ninjaKills} casualties (${ninjaIntercepted} intercepted).`,
      icon: "🗡️",
    });
  }
  const defFightersAfterNinja = Math.max(0, defAvail.fighters - ninjaKills);

  let flankKills = 0;
  const flankPower = (sent.ninjas * 2 + sent.rangers * 0.5) * atkNinjaLvl;
  if (flankPower > 50) {
    const flankChance = 0.15 + sent.ninjas * 0.001;
    if (Math.random() < flankChance) {
      flankKills = Math.floor(flankPower * (0.5 + Math.random() * 0.5));
      steps.push({
        phase: "Tactical",
        title: "Flank Maneuver",
        msg: `Your swift units flanked the enemy, causing ${flankKills} casualties behind the main line!`,
        icon: "↪️",
      });
    }
  }

  const rangerVolleyRate =
    (0.02 + Math.min(0.05, sent.rangers * 0.00005)) *
    atkRangerLvl *
    raceBonus(attacker, "military");
  const rangerKills = Math.floor(defFightersAfterNinja * rangerVolleyRate);
  if (rangerKills > 0)
    steps.push({
      phase: "Ranged",
      title: "Opening Volley",
      msg: `Rangers fired a volley causing ${rangerKills} casualties.`,
      icon: "🏹",
    });
  const defFightersAfterVolley = Math.max(
    0,
    defFightersAfterNinja - rangerKills - flankKills,
  );

  const weaponsEquipped = Math.min(
    sent.fighters,
    attacker.weapons_stockpile || 0,
  );
  const weaponBonus = 1 + (weaponsEquipped / Math.max(sent.fighters, 1)) * 0.25;
  const weaponsResearchMult = fragmentBonusManager.getBonusMultiplier(attacker, 'weapons', 'damage');
  const atkWeapon = ((attacker.res_weapons || 100) / 100) * weaponBonus * weaponsResearchMult;
  const atkTactics = (attacker.res_military || 100) / 100;
  const atkRaceMil = raceBonus(attacker, "military");
  const atkRaceMag = raceBonus(attacker, "magic");
  const atkRangerRace = raceBonus(attacker, "military");

  const atkFighterPower =
    sent.fighters * atkWeapon * atkTactics * atkRaceMil * atkFighterLvl;
  const atkRangerPower =
    sent.rangers * 0.7 * atkTactics * atkRangerRace * atkRangerLvl;
  const atkMagePower =
    sent.mages *
    2.5 *
    ((attacker.res_attack_magic || 100) / 100) *
    atkRaceMag *
    atkMageLvl;
  const engLvl = effectiveTroopLevel(attacker, "engineers");
  const atkEngMult = unitLevelMult(attacker, "engineers");
  const crewNeeded = wmCrewRequired(attacker.race, engLvl);
  const engAvail = Math.max(0, attacker.engineers || 0);
  const wmCrewable = Math.min(
    sent.warMachines,
    Math.floor(engAvail / crewNeeded),
  );
  const warMachinesDamageMult = fragmentBonusManager.getBonusMultiplier(attacker, 'war_machines', 'damage');
  const warMachinesPowerMult = fragmentBonusManager.getBonusMultiplier(attacker, 'war_machines', 'power');
  const wmPower =
    wmCrewable *
    500 *
    ((attacker.res_war_machines || 100) / 100) *
    raceBonus(attacker, "war_machines") *
    atkEngMult *
    warMachinesDamageMult *
    warMachinesPowerMult;

  let atkHeroPower = 0;
  let atkWmMult = 1.0;
  let atkMageMult = 1.0;
  let atkWarlordMult = 1.0;
  let atkBloodShamanMult = 1.0;
  let atkPackLeaderMult = 1.0;

  attackerHeroes.forEach((h) => {
    atkHeroPower += getHeroPower(h);
    if (h.class === "siegebreaker") atkWmMult *= 1.35;
    if (h.class === "archmage") atkMageMult *= 1.25;
    if (h.class === "warlord") atkWarlordMult *= 1.25;
    if (h.class === "blood_shaman") atkBloodShamanMult *= 1.1;
    if (h.class === "alpha") atkPackLeaderMult *= 1.5;
  });

  const atkPowerRaw =
    (atkFighterPower +
      atkRangerPower * atkPackLeaderMult +
      atkMagePower * atkMageMult +
      wmPower * atkWmMult +
      atkHeroPower) *
    atkHappinessMult *
    bullyPenalty *
    atkWarlordMult *
    atkBloodShamanMult;
  const atkPrestigeMult = (attacker.prestige_level > 0)
    ? (PRESTIGE_MODIFIERS[Math.min(attacker.prestige_level, 5)]?.combat || 1.0)
    : 1.0;

  const atkMb = safeJsonParse(attacker.milestone_bonuses, {}, "combat:atkMb");
  let atkPower = atkPowerRaw * (1 + (atkMb.attack_pct || 0) / 100) * atkPrestigeMult * 1.0 * 1.0;

  if (attacker.race === "vampire" && !night) {
    const atkMausUpg = safeJsonParse(attacker.mausoleum_upgrades, {}, "auto:mausoleum_upgrades");
    const atkPenaltyMult = atkMausUpg.night_watch ? 0.2 : 0.1;
    atkPower = Math.floor(atkPowerRaw * atkPenaltyMult * 1.0 * 1.0);
    if (!daylightPenaltyMsg) daylightPenaltyMsg = "";
    daylightPenaltyMsg +=
      " ☀️ Daylight penalty: Your troops are lethargic and ineffective during the day!";
  }

  const armorEquipped = Math.min(
    defFightersAfterVolley,
    defender.armor_stockpile || 0,
  );
  const armorBonus =
    1 + (armorEquipped / Math.max(defFightersAfterVolley, 1)) * 0.25;
  const armorResearchMult = fragmentBonusManager.getBonusMultiplier(defender, 'armor', 'defense');
  const defArmor = ((defender.res_armor || 100) / 100) * armorBonus * armorResearchMult;
  const defTactics = (defender.res_military || 100) / 100;
  const defRaceMil = raceBonus(defender, "military");
  const defRaceMag = raceBonus(defender, "magic");

  const defFighterPower =
    defFightersAfterVolley * defArmor * defTactics * defRaceMil * defFighterLvl;
  const outpostBonus =
    (defender.bld_outposts || 0) * 0.1 +
    (defender.bld_guard_towers || 0) * 0.05;
  const defRangerPower =
    defAvail.rangers *
    0.8 *
    defTactics *
    raceBonus(defender, "military") *
    defRangerLvl *
    Math.max(1, outpostBonus);
  const defMagePower =
    defAvail.mages *
    1.5 *
    ((defender.res_defense_magic || 100) / 100) *
    defRaceMag *
    defMageLvl;
  const defEngLvl = effectiveTroopLevel(defender, "engineers");
  const defEngMult = unitLevelMult(defender, "engineers");
  const defCrewNeeded = wmCrewRequired(defender.race, defEngLvl);
  const defWmCrewable = Math.min(
    defWmActive,
    Math.floor(defAvail.engineers / defCrewNeeded),
  );
  const defWarMachinesDamageMult = fragmentBonusManager.getBonusMultiplier(defender, 'war_machines', 'damage');
  const defWarMachinesPowerMult = fragmentBonusManager.getBonusMultiplier(defender, 'war_machines', 'power');
  const defWmPower =
    defWmCrewable *
    500 *
    ((defender.res_war_machines || 100) / 100) *
    raceBonus(defender, "war_machines") *
    defEngMult *
    defWarMachinesDamageMult *
    defWarMachinesPowerMult;
  const defEngBonus =
    Math.floor(defAvail.engineers / 10) *
    50 *
    defEngMult *
    raceBonus(defender, "construction");
  const defWallPowerRaw = wallDefensePower(defender);
  const defWalls = defender.bld_walls || 0;
  const ladderBypass =
    defWalls > 0 ? Math.min(0.2, laddersActive / defWalls) : 0;
  const defWallPower = Math.floor(defWallPowerRaw * (1 - ladderBypass));
  if (laddersActive > 0 && defWalls > 0) {
    const bypassPct = Math.round(ladderBypass * 100);
    steps.push({
      phase: "Siege",
      title: "🪜 Ladder Assault",
      msg: `${laddersActive} 🪜 ladders scaled the walls (crewed by engineers), bypassing ${bypassPct}% of wall defenses!`,
      icon: "🪜",
    });
  } else if (laddersActive > 0) {
    steps.push({
      phase: "Siege",
      title: "🪜 Ladder Party",
      msg: `🪜 Ladders were raised but the enemy has no walls to scale.`,
      icon: "🪜",
    });
  }

  const defOutpostPower = outpostRangerPower(defender);
  const defTowerPower = towerDetectionPower(defender);
  const castleDefenseMult = fragmentBonusManager.getBonusMultiplier(defender, 'castles', 'defense');
  const defStructures = Math.floor((defender.bld_castles || 0) * 500 * castleDefenseMult);
  const defUpgrades = safeJsonParse(
    defender.defense_upgrades,
    {},
    "resolveMilitaryAttack:defense_upgrades",
  );
  let defTierMult = 1.0;
  if (defUpgrades.fortified) defTierMult += 0.05;
  if (defUpgrades.keep) defTierMult += 0.1;
  if (defUpgrades.citadel) defTierMult += 0.15;

  let defHeroPower = 0;
  let defWmMult = 1.0;
  let defMageMult = 1.0;
  let defWarlordMult = 1.0;
  let defBloodShamanMult = 1.0;
  let defPackLeaderMult = 1.0;
  let defLunarSentinelMult = 1.0;
  let defSiegebreakerStructureMult = 1.0;

  defenderHeroes.forEach((h) => {
    defHeroPower += getHeroPower(h);
    if (h.class === "siegebreaker") {
      defWmMult *= 1.35;
      defSiegebreakerStructureMult *= 2.0;
    }
    if (h.class === "archmage") defMageMult *= 1.25;
    if (h.class === "warlord") defWarlordMult *= 1.25;
    if (h.class === "blood_shaman") defBloodShamanMult *= 1.1;
    if (h.class === "alpha") defPackLeaderMult *= 1.5;
    if (h.class === "lunar_sentinel") defLunarSentinelMult *= 1.5;
  });

  const defPower =
    (defFighterPower +
      defRangerPower * defPackLeaderMult +
      defMagePower * defMageMult * defLunarSentinelMult +
      defWmPower * defWmMult +
      defEngBonus +
      (defWallPower + defOutpostPower + defTowerPower + defStructures) *
        defSiegebreakerStructureMult +
      defHeroPower) *
    defHappinessMult *
    defTierMult *
    defWarlordMult *
    defBloodShamanMult *
    raceBonus(defender, "defense");

  const defMb = safeJsonParse(defender.milestone_bonuses, {}, "combat:defMb");
  const defMilestoneMult = 1 + (defMb.defense_pct || 0) / 100;

  const defPrestigeMult = (defender.prestige_level > 0)
    ? (PRESTIGE_MODIFIERS[Math.min(defender.prestige_level, 5)]?.combat || 1.0)
    : 1.0;

  const defPowerFinal = defPower * defMilestoneMult * defPrestigeMult * 1.0 * 1.0;

  const variance = 0.8 + Math.random() * 0.4;
  const win = atkPower * variance > defPowerFinal;
  const powerRatio = atkPower / Math.max(1, defPowerFinal);
  steps.push({
    phase: "Clash",
    title: "Main Assault",
    msg: `Attacker Power (${Math.round(atkPower)}) vs Defender Power (${Math.round(defPowerFinal)}).`,
    icon: "⚔️",
  });

  let atkClericHeal = Math.min(
    0.35,
    ((attacker.clerics || 0) / Math.max(sent.fighters + sent.rangers, 1)) *
      0.08 *
      raceBonus(attacker, "magic"),
  );

  const atkShrineUpgrades = safeJsonParse(attacker.shrine_upgrades, {}, "auto:shrine_upgrades");
  if (atkShrineUpgrades.healing_aura) atkClericHeal = Math.min(0.7, atkClericHeal + 0.1);
  if (atkShrineUpgrades.sanctuary) atkClericHeal = Math.min(0.7, atkClericHeal + 0.15);
  let defClericHeal = Math.min(
    0.35,
    (defAvail.clerics / Math.max(defAvail.fighters || 1, 1)) *
      0.08 *
      raceBonus(defender, "magic"),
  );

  const defShrineUpgrades = safeJsonParse(defender.shrine_upgrades, {}, "auto:shrine_upgrades");
  if (defShrineUpgrades.healing_aura) defClericHeal = Math.min(0.7, defClericHeal + 0.1);
  if (defShrineUpgrades.sanctuary) defClericHeal = Math.min(0.7, defClericHeal + 0.15);

  attackerHeroes.forEach((h) => {
    if (h.class === "paladin")
      atkClericHeal = Math.min(0.7, atkClericHeal + 0.1);
    if (h.class === "warlord")
      atkClericHeal = Math.min(0.7, atkClericHeal + 0.15);
  });

  defenderHeroes.forEach((h) => {
    if (h.class === "paladin")
      defClericHeal = Math.min(0.7, defClericHeal + 0.1);
    if (h.class === "warlord")
      defClericHeal = Math.min(0.7, defClericHeal + 0.15);
  });

  if (atkClericHeal > 0 || defClericHeal > 0) {
    let healMsg = "";
    if (atkClericHeal > 0)
      healMsg += `Attacker clerics reduced casualties by ${Math.round(atkClericHeal * 100)}%. `;
    if (defClericHeal > 0)
      healMsg += `Defender clerics reduced casualties by ${Math.round(defClericHeal * 100)}%.`;
    steps.push({
      phase: "Healing",
      title: "Divine Intervention",
      msg: healMsg.trim(),
      icon: "✨",
    });
  }

  const atkStealthBonus = raceBonus(attacker, "stealth") > 1 ? 0.85 : 1.0;

  const atkFighterLossPct = win
    ? 0.04 + Math.random() * 0.08
    : 0.2 + Math.random() * 0.25;
  const atkRangerLossPct = win
    ? 0.02 + Math.random() * 0.04
    : 0.1 + Math.random() * 0.12;
  const atkMageLossPct = win
    ? 0.01 + Math.random() * 0.03
    : 0.05 + Math.random() * 0.08;

  const defFighterLossPct = win
    ? 0.15 + Math.random() * 0.2
    : 0.05 + Math.random() * 0.08;
  const defRangerLossPct = win
    ? 0.08 + Math.random() * 0.12
    : 0.02 + Math.random() * 0.04;
  const defMageLossPct = win
    ? 0.06 + Math.random() * 0.1
    : 0.01 + Math.random() * 0.03;

  const atkFigLost = Math.floor(
    sent.fighters * atkFighterLossPct * atkStealthBonus * (1 - atkClericHeal),
  );
  const atkRanLost = Math.floor(
    sent.rangers * atkRangerLossPct * atkStealthBonus * (1 - atkClericHeal),
  );
  const atkMagLost = Math.floor(sent.mages * atkMageLossPct * atkStealthBonus);
  const atkCleLost = Math.floor(sent.clerics * (win ? 0.01 : 0.08));
  const atkNinLost = Math.floor(sent.ninjas * (win ? 0.05 : 0.15));
  const atkThiLost = Math.floor(sent.thieves * (win ? 0.02 : 0.1));
  const atkEngLost = Math.floor(sent.engineers * (win ? 0.01 : 0.05));
  const atkWmLost = win
    ? 0
    : Math.floor(sent.warMachines * (0.02 + Math.random() * 0.06));

  const defFigLost = Math.floor(
    defAvail.fighters * defFighterLossPct * (1 - defClericHeal),
  );
  const defRanLost = Math.floor(
    defAvail.rangers * defRangerLossPct * (1 - defClericHeal),
  );
  const defMagLost = Math.floor(defAvail.mages * defMageLossPct);
  const defCleLost = Math.floor(defAvail.clerics * (win ? 0.1 : 0.02));
  const defNinLost = Math.floor(defAvail.ninjas * (win ? 0.15 : 0.05));
  const defThiLost = Math.floor(defAvail.thieves * (win ? 0.08 : 0.03));
  const defEngLost = Math.floor(defAvail.engineers * (win ? 0.08 : 0.02));
  const defWmLost = win
    ? Math.floor(defWmActive * (0.03 + Math.random() * 0.07))
    : 0;

  const defFightersLost = defFigLost + ninjaKills + rangerKills;
  const defRangersLost = defRanLost;
  const defMagesLost = defMagLost;
  const defClericsLost = defCleLost;
  const defNinjasLost = defNinLost;
  const defThievesLost = defThiLost;
  const defEngineersLost = defEngLost;

  const atkFightersLost = atkFigLost;
  const atkRangersLost = atkRanLost;
  const atkMagesLost = atkMagLost;
  const atkClericsLost = atkCleLost;
  const atkNinjasLost = atkNinLost;
  const atkThievesLost = atkThiLost;
  const atkEngineersLost = atkEngLost;

  let defLandLossMult = 1.0;
  if (defUpgrades.fortified) defLandLossMult -= 0.05;
  if (defUpgrades.keep) defLandLossMult -= 0.1;
  if (defUpgrades.citadel) defLandLossMult -= 0.15;

  const wallUpgrades = safeJsonParse(
    defender.wall_upgrades,
    {},
    "resolveMilitaryAttack:wall_upgrades",
  );
  if (wallUpgrades.reinforced) defLandLossMult -= 0.1;

  const landTransferred = win
    ? Math.floor(defender.land * 0.1 * Math.max(0.1, defLandLossMult))
    : 0;

  const warmachineUpdates = applyWarmachineDamage(attacker, defender, win);
  Object.assign(defenderUpdates, warmachineUpdates);
  if (win) {
    if (warmachineUpdates.bld_walls !== undefined) {
      const wallsLost = (defender.bld_walls || 0) - warmachineUpdates.bld_walls;
      if (wallsLost > 0) {
        steps.push({
          phase: "Siege",
          title: "Wall Breach",
          msg: `Your war machines battered the fortifications, destroying ${wallsLost} walls!`,
          icon: "🧱",
        });
      }
    } else {
      const dmgCol = Object.keys(warmachineUpdates).find(
        (k) =>
          k.startsWith("bld_") && warmachineUpdates[k] < (defender[k] || 0),
      );
      if (dmgCol) {
        const buildingName = dmgCol.replace("bld_", "").replace(/_/g, " ");
        const amt = (defender[dmgCol] || 0) - warmachineUpdates[dmgCol];
        steps.push({
          phase: "Siege",
          title: "Building Damage",
          msg: `With the walls down, your troops razed ${amt} ${buildingName}!`,
          icon: "🔥",
        });
      }
    }
  }

  const atkTotalKills =
    ninjaKills + rangerKills + defFightersLost + defClericsLost;
  const defTotalKills =
    atkFightersLost +
    atkRangersLost +
    atkMagesLost +
    atkNinjasLost +
    atkClericsLost;

  const atkClericKills = defClericsLost;
  const defClericKills = atkClericsLost;

  const atkSoldierKills = atkTotalKills - atkClericKills;
  const defSoldierKills = defTotalKills - defClericKills;

  let atkConversionAdded = 0;
  let defConversionAdded = 0;
  let necroMsg = "";
  if (win) {
    const convRate = attacker.race === "vampire" ? 0.3 : 0.05;
    const isVampire = attacker.race === "vampire";

    if (isVampire) {
      atkConversionAdded = Math.floor(atkSoldierKills * convRate);
      if (atkConversionAdded > 0) {
        attackerUpdates.fighters =
          (attacker.fighters || 0) + atkConversionAdded;
      }

      const thrallsFromClerics = Math.floor(
        (atkClericKills + atkClericsLost) * convRate,
      );
      if (thrallsFromClerics > 0) {
        const current = attacker.thralls || 0;
        let mauUpg = {};
        try {
          mauUpg = safeJsonParse(attacker.mausoleum_upgrades, {}, "auto:mausoleum_upgrades");
        } catch {}
        const perMau = 100 + (mauUpg.soul_vault ? 50 : 0);
        const cap = (attacker.bld_mausoleums || 0) * perMau;

        const added = Math.min(thrallsFromClerics, Math.max(0, cap - current));
        if (added > 0) {
          attackerUpdates.thralls = current + added;
        }
      }

      if (
        atkConversionAdded > 0 ||
        Math.floor((atkClericKills + atkClericsLost) * convRate) > 0
      ) {
        necroMsg = `🧛 Blood Magic raised ${atkConversionAdded} soldiers as new troops and some Thralls from the fallen.`;
      }
    } else {
      atkConversionAdded = Math.floor(atkTotalKills * convRate);
      if (atkConversionAdded > 0) {
        attackerUpdates.fighters =
          (attackerUpdates.fighters || attacker.fighters || 0) +
          atkConversionAdded;
        necroMsg = `🏳️ ${atkConversionAdded} enemy troops surrendered and joined your ranks.`;
      }
    }
  } else {
    const convRate = defender.race === "vampire" ? 0.3 : 0.05;
    const isVampire = defender.race === "vampire";

    if (isVampire) {
      defConversionAdded = Math.floor(defSoldierKills * convRate);
      if (defConversionAdded > 0) {
        defenderUpdates.fighters =
          (defender.fighters || 0) + defConversionAdded;
      }

      const thrallsFromClerics = Math.floor(
        (defClericKills + defClericsLost) * convRate,
      );
      if (thrallsFromClerics > 0) {
        const current = defender.thralls || 0;
        let mauUpg = {};
        try {
          mauUpg = safeJsonParse(defender.mausoleum_upgrades, {}, "auto:mausoleum_upgrades");
        } catch {}
        const perMau = 100 + (mauUpg.soul_vault ? 50 : 0);
        const cap = (defender.bld_mausoleums || 0) * perMau;

        const added = Math.min(thrallsFromClerics, Math.max(0, cap - current));
        if (added > 0) {
          defenderUpdates.thralls = current + added;
        }
      }

      if (
        defConversionAdded > 0 ||
        Math.floor((defClericKills + defClericsLost) * convRate) > 0
      ) {
        necroMsg = `🧛 Blood Magic raised ${defConversionAdded} soldiers as new troops and some Thralls from the fallen.`;
      }
    } else {
      defConversionAdded = Math.floor(defTotalKills * convRate);
      if (defConversionAdded > 0) {
        defenderUpdates.fighters =
          (defenderUpdates.fighters || defender.fighters || 0) +
          defConversionAdded;
        necroMsg = `🏳️ ${defConversionAdded} enemy troops surrendered and joined your ranks.`;
      }
    }
  }

  const victoryMargin = Math.min(2.0, Math.max(0.1, powerRatio));
  let atkHappinessChange, defHappinessChange;
  if (win) {
    atkHappinessChange = Math.floor(5 + Math.min(10, victoryMargin * 5));
    defHappinessChange = -Math.max(
      5,
      Math.floor(Math.min(20, victoryMargin * 10)),
    );
    if (bullyRatio >= 8) atkHappinessChange -= 15;
    if (bullyRatio >= 4) atkHappinessChange -= 5;
  } else {
    atkHappinessChange = -Math.floor(
      5 + Math.min(15, (1 / Math.max(0.1, powerRatio)) * 8),
    );
    defHappinessChange = Math.floor(
      5 + Math.min(10, (1 / Math.max(0.1, powerRatio)) * 5),
    );
  }
  const newAtkHappiness = Math.max(
    HAPPINESS_FLOOR,
    Math.min(
      200,
      (attacker.happiness !== undefined && attacker.happiness !== null
        ? attacker.happiness
        : 100) + atkHappinessChange,
    ),
  );
  const newDefHappiness = Math.max(
    HAPPINESS_FLOOR,
    Math.min(
      200,
      (defender.happiness !== undefined && defender.happiness !== null
        ? defender.happiness
        : 100) + defHappinessChange,
    ),
  );

  const defDisc = safeJsonParse(
    defender.discovered_kingdoms,
    {},
    "resolveMilitaryAttack:defender_discovered_kingdoms",
  );
  defDisc[attacker.id] = { found: true, mapped: true };
  defenderUpdates.discovered_kingdoms = JSON.stringify(defDisc);

  const atkLines = [];
  const defLines = [];

  const baseChance = 0.08;
  const winnerUpdates = win ? attackerUpdates : defenderUpdates;

  const loser = win ? defender : attacker;
  const loserFragment = fragmentBonusManager.getFragmentForBuilding(loser, 'libraries');
  const canStealMaps = !loserFragment || (loserFragment.fragment !== 'Dwarven Star-Metal' && loserFragment.fragment !== 'Dragon Scale');

  const lootRaceBonus =
    (win ? attacker.race : defender.race) === "orc" || (win ? attacker.race : defender.race) === "dire_wolf" ? 1.5 : 1.0;
  if (canStealMaps && Math.random() < baseChance * lootRaceBonus) {
    const winner = win ? attacker : defender;
    const winnerDisc = safeJsonParse(
      winnerUpdates.discovered_kingdoms || winner.discovered_kingdoms,
      {},
      "resolveMilitaryAttack:winner_discovered_kingdoms",
    );
    winnerDisc[loser.id] = { found: true, mapped: true };
    winnerUpdates.discovered_kingdoms = JSON.stringify(winnerDisc);
    atkLines.push("📜 A location map was recovered from the fallen!");
    defLines.push("📜 A location map was stolen from the battlefield!");
  }

  const discChance = calcDiscoveryChance(
    win ? attacker : defender,
    win ? defender : attacker,
  );
  if (Math.random() < discChance) {
    const discoverer = win ? attacker : defender;
    const discovered = win ? defender : attacker;
    const discovererDisc = safeJsonParse(
      winnerUpdates.discovered_kingdoms || discoverer.discovered_kingdoms,
      {},
      "resolveMilitaryAttack:discoverer_discovered_kingdoms",
    );
    discovererDisc[discovered.id] = { found: true, mapped: false };
    winnerUpdates.discovered_kingdoms = JSON.stringify(discovererDisc);
    atkLines.push("🔭 You discovered a new kingdom!");
  }

  const report = {
    win,
    sent,
    defenderEngaged: defAvail,
    landTransferred,
    combatSystem: "legacy",
    atkPower: Math.round(atkPower),
    defPower: Math.round(defPowerFinal),
    powerRatio: Math.round((atkPower / Math.max(1, defPowerFinal)) * 100) / 100,
    atkFightersLost,
    atkThrallsLost: 0,
    atkRangersLost,
    atkMagesLost,
    atkNinjasLost,
    atkClericsLost,
    atkThievesLost,
    atkEngineersLost,
    atkWmLost,
    defFightersLost,
    defThrallsLost: 0,
    defRangersLost,
    defMagesLost,
    defNinjasLost,
    defClericsLost,
    defThievesLost,
    defEngineersLost,
    defWmLost,
    ninjaKills,
    rangerKills,
    flankKills,
    thiefSabotage,
    criticalHits: 0,
    criticalKills: 0,
    wallsDestroyed: 0,
    wallHpBefore: defender.wall_hp || 0,
    wallHpAfter: defenderUpdates.wall_hp ?? (defender.wall_hp || 0),
    wallDamage: 0,
    steps,
  };

  attackerUpdates.fighters = Math.max(0, (attacker.fighters || 0) - atkFightersLost + (atkConversionAdded || 0));
  attackerUpdates.rangers = Math.max(0, (attacker.rangers || 0) - atkRangersLost);
  attackerUpdates.mages = Math.max(0, (attacker.mages || 0) - atkMagesLost);
  attackerUpdates.ninjas = Math.max(0, (attacker.ninjas || 0) - atkNinjasLost);
  attackerUpdates.clerics = Math.max(0, (attacker.clerics || 0) - atkCleLost);
  attackerUpdates.thieves = Math.max(0, (attacker.thieves || 0) - atkThiLost);
  attackerUpdates.engineers = Math.max(0, (attacker.engineers || 0) - atkEngLost);
  attackerUpdates.war_machines = Math.max(0, (attacker.war_machines || 0) - atkWmLost);
  attackerUpdates.happiness = newAtkHappiness;
  attackerUpdates.xp = awardXp(attacker, win ? "combat_win" : "combat_loss", 1).xp;
  attackerUpdates.level = awardXp(attacker, win ? "combat_win" : "combat_loss", 1).level;

  if (landTransferred > 0) {
    attackerUpdates.land = (attacker.land || 0) + landTransferred;
    defenderUpdates.land = Math.max(0, (defender.land || 0) - landTransferred);
  }

  defenderUpdates.fighters = Math.max(0, (defender.fighters || 0) - defFightersLost + (defConversionAdded || 0));
  defenderUpdates.rangers = Math.max(0, (defender.rangers || 0) - defRangersLost);
  defenderUpdates.mages = Math.max(0, (defender.mages || 0) - defMagesLost);
  defenderUpdates.ninjas = Math.max(0, (defender.ninjas || 0) - defNinjasLost);
  defenderUpdates.clerics = Math.max(0, (defender.clerics || 0) - defCleLost);
  defenderUpdates.thieves = Math.max(0, (defender.thieves || 0) - defThiLost);
  defenderUpdates.engineers = Math.max(0, (defender.engineers || 0) - defEngLost);
  defenderUpdates.war_machines = Math.max(0, (defender.war_machines || 0) - defWmLost);
  defenderUpdates.happiness = newDefHappiness;
  defenderUpdates.xp = awardXp(defender, win ? "combat_loss" : "combat_win", 1).xp;
  defenderUpdates.level = awardXp(defender, win ? "combat_loss" : "combat_win", 1).level;

  const atkEvent = [
    win ? "✅ VICTORY!" : "❌ DEFEAT!",
    `Power: ${Math.round(atkPower)} vs ${Math.round(defPowerFinal)}`,
    `Casualties: ${atkFightersLost + atkRangersLost + atkMagesLost} troops lost.`,
    landTransferred > 0 ? `📍 Conquered ${landTransferred} land!` : null,
    bullyMsg,
    necroMsg,
    ...atkLines,
  ].filter(Boolean).join(" ");

  const defEvent = [
    win ? "❌ DEFEAT!" : "✅ VICTORY!",
    `Power: ${Math.round(atkPower)} vs ${Math.round(defPowerFinal)}`,
    `Casualties: ${defFightersLost + defRangersLost + defMagesLost} troops lost.`,
    landTransferred > 0 ? `📍 Lost ${landTransferred} land!` : null,
    shameEvent || null,
    daylightPenaltyMsg,
    necroMsg,
    ...defLines,
  ].filter(Boolean).join(" ");

  return {
    win,
    report,
    attackerUpdates,
    defenderUpdates,
    atkEvent,
    defEvent,
  };
}

module.exports = {
  resolveMilitaryAttack,
  resolveMilitaryAttackV2Adapter,
  wmCrewRequired,
};
