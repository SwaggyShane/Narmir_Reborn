/**
 * combat.js
 * Military combat resolution: resolveMilitaryAttack and resolveMilitaryAttackV2Adapter.
 * Extracted from game/engine.js - zero-change backward compatibility.
 */

const { PRESTIGE_MODIFIERS } = require('./config');
const USE_COMBAT_V2 = process.env.USE_COMBAT_V2 === "1";
const { safeJsonParse } = require('../utils/helpers');
const { raceBonus } = require('./lib/race-bonus');
const fragmentBonusManager = require('./fragment-bonus-manager');
const { effectiveTroopLevel, unitLevelMult, awardTroopXp, getAvailableUnits } = require('./lib/troops');
const { applyWarmachineDamage } = require('./lib/defense');
const { awardXp } = require('./xp');
const { getHeroPower } = require('./heroes');
const { wallDefensePower, towerDetectionPower, outpostRangerPower } = require('./defense');
const { isNight, happinessCombatMult, wmCrewRequired } = require('./combat-helpers');
const combatResolverV2 = require('./combat-resolver');

function moraleMult(morale) {
  if (morale < 50) return 0.8 + (morale / 50) * 0.1; // 0.80ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“0.90
  if (morale < 100) return 0.9 + ((morale - 50) / 50) * 0.1; // 0.90ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“1.00
  return Math.min(1.2, 1.0 + ((morale - 100) / 100) * 0.1); // 1.00ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“1.20 (capped at 1.20)
}

function sumRecordValues(record = {}) {
  return Object.values(record).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

const COMBAT_NEWS_UNIT_LABELS = {
  thralls: "Thralls",
  fighters: "Fighters",
  rangers: "Rangers",
  mages: "Mages",
  clerics: "Clerics",
  ninjas: "Ninjas",
  thieves: "Thieves",
  engineers: "Engineers",
  war_machines: "War Machines",
};

const COMBAT_NEWS_UNIT_ORDER = [
  "thralls",
  "fighters",
  "rangers",
  "mages",
  "clerics",
  "ninjas",
  "thieves",
  "engineers",
  "war_machines",
];

function normalizeCombatUnits(units = {}) {
  return {
    thralls: units.thralls || 0,
    fighters: units.fighters || 0,
    rangers: units.rangers || 0,
    mages: units.mages || 0,
    clerics: units.clerics || 0,
    ninjas: units.ninjas || 0,
    thieves: units.thieves || 0,
    engineers: units.engineers || 0,
    war_machines: units.war_machines || units.warMachines || 0,
  };
}

function formatCombatUnitCounts(units = {}, labels = COMBAT_NEWS_UNIT_LABELS) {
  const normalized = normalizeCombatUnits(units);
  const parts = COMBAT_NEWS_UNIT_ORDER
    .filter((unit) => normalized[unit] > 0)
    .map((unit) => `${(normalized[unit] || 0).toLocaleString()} ${labels[unit] || COMBAT_NEWS_UNIT_LABELS[unit]}`);
  return parts.length ? parts.join(", ") : "None";
}

function formatCombatBuildingsLost(report = {}) {
  const parts = [];
  if (report.wallsDestroyed > 0) parts.push(`${report.wallsDestroyed.toLocaleString()} Walls`);
  if (report.defBldLost > 0) parts.push(`${report.defBldLost.toLocaleString()} Buildings`);
  if (report.buildingDamaged) parts.push(String(report.buildingDamaged).replace(/_/g, " "));
  return parts.length ? parts.join(", ") : "None";
}

function formatCombatV2NewsBlurb(attacker, defender, report, perspective = "attacker") {
  const fmt = (value) => (Number(value) || 0).toLocaleString();
  const attackerName = attacker?.name || "The attacking host";
  const defenderName = defender?.name || "the defending kingdom";
  const land = report.landTransferred || 0;
  const attackerLost = report.injuredTroops?.attacker?.deadByType || {
    thralls: report.atkThrallsLost,
    fighters: report.atkFightersLost,
    rangers: report.atkRangersLost,
    mages: report.atkMagesLost,
    clerics: report.atkClericsLost,
    ninjas: report.atkNinjasLost,
    thieves: report.atkThievesLost,
    engineers: report.atkEngineersLost,
    war_machines: report.atkWmLost,
  };
  const defenderLost = report.injuredTroops?.defender?.deadByType || {
    thralls: report.defThrallsLost,
    fighters: report.defFightersLost,
    rangers: report.defRangersLost,
    mages: report.defMagesLost,
    clerics: report.defClericsLost,
    ninjas: report.defNinjasLost,
    thieves: report.defThievesLost,
    engineers: report.defEngineersLost,
    war_machines: report.defWmLost,
  };
  const attackerInjured = report.atkInjuredByType || report.injuredTroops?.attacker?.injuredByType || {};
  const defenderInjured = report.defInjuredByType || report.injuredTroops?.defender?.injuredByType || {};
  const attackerDeaths = report.attackerKilled || sumRecordValues(attackerLost);
  const defenderDeaths = report.defenderKilled || sumRecordValues(defenderLost);
  const criticalKills = report.criticalKills ||
    (report.injuredTroops?.attacker?.criticalKills || 0) +
    (report.injuredTroops?.defender?.criticalKills || 0);
  const criticalHits = report.criticalHits ||
    (report.injuredTroops?.attacker?.criticalHits || 0) +
    (report.injuredTroops?.defender?.criticalHits || 0);
  const sabotage = report.thiefSabotage || report.disabledWarMachines || 0;
  const wallDamage = report.wallDamage || 0;
  const defenderUnitLabels = {
    ...COMBAT_NEWS_UNIT_LABELS,
    war_machines: "Ballistae",
  };

  const title = perspective === "defender" ? "Defense report" : "Attack report";
  const outcome = report.win ? "Attacker victory" : "Defender held";
  const landLine = perspective === "defender"
    ? `Land loss: ${report.win ? `${fmt(land)} acres lost` : "None"}`
    : `Land gained: ${report.win ? `${fmt(land)} acres captured` : "None"}`;
  const detailParts = [];
  if (sabotage > 0) detailParts.push(`${fmt(sabotage)} ballistae disabled`);
  if (wallDamage > 0) detailParts.push(`${fmt(wallDamage)} wall HP damaged`);
  const siegeLine = detailParts.length ? `Siege notes: ${detailParts.join("; ")}` : "Siege notes: None";

  return [
    `${title}: ${attackerName} vs ${defenderName}`,
    `Outcome: ${outcome}`,
    landLine,
    `Troops engaged - Attacker: ${formatCombatUnitCounts(report.sent)}`,
    `Troops engaged - Defender: ${formatCombatUnitCounts(report.defenderEngaged, defenderUnitLabels)}`,
    `Troops lost - Attacker: ${formatCombatUnitCounts(attackerLost)} (${fmt(attackerDeaths)} total)`,
    `Troops lost - Defender: ${formatCombatUnitCounts(defenderLost, defenderUnitLabels)} (${fmt(defenderDeaths)} total)`,
    `Troops injured - Attacker: ${formatCombatUnitCounts(attackerInjured)}`,
    `Troops injured - Defender: ${formatCombatUnitCounts(defenderInjured, defenderUnitLabels)}`,
    `Critical hits: ${fmt(criticalHits)} hits, ${fmt(criticalKills)} killing blows`,
    `Buildings lost: ${formatCombatBuildingsLost(report)}`,
    siegeLine,
  ].join("\n");
}

function calcBullyPenalty(attacker, defender) {
  const landRatio = (attacker.land || 1) / Math.max(1, defender.land || 1);
  const fighterRatio =
    (attacker.fighters || 1) / Math.max(1, defender.fighters || 1);
  let bullyRatio = Math.max(landRatio, fighterRatio * 0.5);
  let bullyPenalty = 1.0;
  let bullyMsg = null;
  let shameEvent = null;
  if (bullyRatio >= 8) {
    bullyPenalty = 0.4;
    bullyMsg = "ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Your kingdom is disgraced attacking such a weak foe.";
    shameEvent = `ÃƒÂ°Ã…Â¸Ã¢â‚¬ËœÃ¢â‚¬Ëœ ${attacker.name} has attacked the much weaker ${defender.name}. The world watches in disgust.`;
  } else if (bullyRatio >= 4) {
    bullyPenalty = 0.6;
    bullyMsg = "ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Morale suffers ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â this is slaughter, not war.";
  } else if (bullyRatio >= 2) {
    bullyPenalty = 0.8;
    bullyMsg = "ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Your troops lack motivation fighting a weaker foe.";
  }
  return { bullyRatio, bullyPenalty, bullyMsg, shameEvent };
}

function calcClericHeal(kingdom, clerics, denominator, heroes, shrineKey) {
  let heal = Math.min(0.35, (clerics / Math.max(denominator, 1)) * 0.08 * raceBonus(kingdom, 'magic'));
  const shrineUpgrades = safeJsonParse(kingdom[shrineKey], {}, 'calcClericHeal:shrine_upgrades');
  if (shrineUpgrades.healing_aura) heal = Math.min(0.7, heal + 0.1);
  if (shrineUpgrades.sanctuary) heal = Math.min(0.7, heal + 0.15);
  heroes.forEach((h) => {
    if (h.class === 'paladin') heal = Math.min(0.7, heal + 0.1);
    if (h.class === 'warlord') heal = Math.min(0.7, heal + 0.15);
  });
  return heal;
}

function applyReanimation(win, attacker, defender, kills, attackerUpdates, defenderUpdates) {
  const { atkSoldierKills, atkTotalKills, atkClericKills, atkClericsLost, defSoldierKills, defTotalKills, defClericKills, defClericsLost } = kills;
  let atkConversionAdded = 0;
  let defConversionAdded = 0;
  let necroMsg = "";
  if (win) {
    const convRate = attacker.race === "vampire" ? 0.3 : 0.05;
    const isVampire = attacker.race === "vampire";

    if (isVampire) {
      // Fallen soldiers -> Vampire troops (fighters)
      atkConversionAdded = Math.floor(atkSoldierKills * convRate);
      if (atkConversionAdded > 0) {
        attackerUpdates.fighters =
          (attackerUpdates.fighters || attacker.fighters || 0) + atkConversionAdded;
      }

      // Fallen clerics (enemy and own) -> Thralls
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
        necroMsg = `ÃƒÂ°Ã…Â¸Ã‚Â§Ã¢â‚¬Âº Blood Magic raised ${atkConversionAdded} soldiers as new troops and some Thralls from the fallen.`;
      }
    } else {
      atkConversionAdded = Math.floor(atkTotalKills * convRate);
      if (atkConversionAdded > 0) {
        attackerUpdates.fighters =
          (attackerUpdates.fighters || attacker.fighters || 0) +
          atkConversionAdded;
        necroMsg = `ÃƒÂ°Ã…Â¸Ã‚ÂÃ‚Â³ÃƒÂ¯Ã‚Â¸Ã‚Â ${atkConversionAdded} enemy troops surrendered and joined your ranks.`;
      }
    }
  } else {
    const convRate = defender.race === "vampire" ? 0.3 : 0.05;
    const isVampire = defender.race === "vampire";

    if (isVampire) {
      // Fallen soldiers -> Vampire troops (fighters)
      defConversionAdded = Math.floor(defSoldierKills * convRate);
      if (defConversionAdded > 0) {
        defenderUpdates.fighters =
          (defenderUpdates.fighters || defender.fighters || 0) + defConversionAdded;
      }

      // Fallen clerics (enemy and own) -> Thralls
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
        necroMsg = `ÃƒÂ°Ã…Â¸Ã‚Â§Ã¢â‚¬Âº Blood Magic raised ${defConversionAdded} soldiers as new troops and some Thralls from the fallen.`;
      }
    } else {
      defConversionAdded = Math.floor(defTotalKills * convRate);
      if (defConversionAdded > 0) {
        defenderUpdates.fighters =
          (defenderUpdates.fighters || defender.fighters || 0) +
          defConversionAdded;
        necroMsg = `ÃƒÂ°Ã…Â¸Ã‚ÂÃ‚Â³ÃƒÂ¯Ã‚Â¸Ã‚Â ${defConversionAdded} enemy troops surrendered and joined your ranks.`;
      }
    }
  }
  return necroMsg;
}

function calcMoraleChanges(win, powerRatio, bullyRatio, attacker, defender) {
  const victoryMargin = Math.min(2.0, Math.max(0.1, powerRatio));
  let atkMoraleChange, defMoraleChange;
  if (win) {
    atkMoraleChange = Math.floor(5 + Math.min(10, victoryMargin * 5));
    defMoraleChange = -Math.max(
      5,
      Math.floor(Math.min(20, victoryMargin * 10)),
    );
    // Bully shame ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â attacker loses morale too at high ratios
    if (bullyRatio >= 8) atkMoraleChange -= 15;
    if (bullyRatio >= 4) atkMoraleChange -= 5;
  } else {
    atkMoraleChange = -Math.floor(
      5 + Math.min(15, (1 / Math.max(0.1, powerRatio)) * 8),
    );
    defMoraleChange = Math.floor(
      5 + Math.min(10, (1 / Math.max(0.1, powerRatio)) * 5),
    );
  }
  const MORALE_FLOOR = 0;
  const newAtkMorale = Math.max(
    MORALE_FLOOR,
    Math.min(
      200,
      (attacker.morale !== undefined && attacker.morale !== null
        ? attacker.morale
        : 100) + atkMoraleChange,
    ),
  );
  const newDefMorale = Math.max(
    MORALE_FLOOR,
    Math.min(
      200,
      (defender.morale !== undefined && defender.morale !== null
        ? defender.morale
        : 100) + defMoraleChange,
    ),
  );
  return { atkMoraleChange, defMoraleChange, newAtkMorale, newDefMorale };
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
  const fmt = (n) => (n || 0).toLocaleString();
  const steps = [];
  const attackerUpdates = {};
  const defenderUpdates = {
    last_attack_turn: defender.turn || 0 // Record when this kingdom was attacked
  };
  // sentUnits: { fighters, rangers, mages, warMachines, ninjas, thieves, clerics, engineers, ladders }
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

  const { bullyRatio, bullyPenalty, bullyMsg, shameEvent } = calcBullyPenalty(attacker, defender);

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Morale multipliers ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  const atkMoraleMult = happinessCombatMult(attacker.happiness !== undefined && attacker.happiness !== null ? attacker.happiness : 50);
  const defMoraleMult = happinessCombatMult(defender.happiness !== undefined && defender.happiness !== null ? defender.happiness : 50);

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Research, race and level helpers ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
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

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Step 1: Defending troops (exclude training fields) ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
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
      thrallMult += 0.5; // +10% to the 5.0 multiplier
    }
    defAvail.clerics = Math.floor(defAvail.clerics * thrallMult);

    daylightPenaltyMsg =
      "ÃƒÂ¢Ã‹Å“Ã¢â€šÂ¬ÃƒÂ¯Ã‚Â¸Ã‚Â Daylight penalty: Only Thralls defend the Vampire stronghold during the day, but with massive fervor!";
  }

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Step 1b: Thief sabotage ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â disable some defender war machines ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
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
      icon: "ÃƒÂ°Ã…Â¸Ã‚Â¥Ã‚Â·",
    });
  }

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Step 2: Ninja pre-battle strike ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
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
    // Defender ninjas intercept at 50% effectiveness
    const interceptRate = Math.min(0.5, defAvail.ninjas * 0.001 * defNinjaLvl);
    ninjaIntercepted = Math.floor(rawKills * interceptRate);
    ninjaKills = Math.max(0, rawKills - ninjaIntercepted);
    steps.push({
      phase: "Stealth",
      title: "Ninja Strike",
      msg: `Ninjas struck the defense line causing ${ninjaKills} casualties (${ninjaIntercepted} intercepted).`,
      icon: "ÃƒÂ°Ã…Â¸Ã¢â‚¬â€Ã‚Â¡ÃƒÂ¯Ã‚Â¸Ã‚Â",
    });
  }
  const defFightersAfterNinja = Math.max(0, defAvail.fighters - ninjaKills);

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Step 2b: Flank Maneuver ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
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
        icon: "ÃƒÂ¢Ã¢â‚¬Â Ã‚ÂªÃƒÂ¯Ã‚Â¸Ã‚Â",
      });
    }
  }

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Step 3: Ranger opening volley ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
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
      icon: "ÃƒÂ°Ã…Â¸Ã‚ÂÃ‚Â¹",
    });
  const defFightersAfterVolley = Math.max(
    0,
    defFightersAfterNinja - rangerKills - flankKills,
  );

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Step 4: Attack power ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
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
  const atkRangerRace = raceBonus(attacker, "military"); // rangers share military bonus

  // Fighter power ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â front line
  const atkFighterPower =
    sent.fighters * atkWeapon * atkTactics * atkRaceMil * atkFighterLvl;
  // Ranger power ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â always ranged, lower per-unit than fighters
  const atkRangerPower =
    sent.rangers * 0.7 * atkTactics * atkRangerRace * atkRangerLvl;
  // Mage power ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â back line, high per-unit
  const atkMagePower =
    sent.mages *
    2.5 *
    ((attacker.res_attack_magic || 100) / 100) *
    atkRaceMag *
    atkMageLvl;
  // War machines ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â scaled by crew sufficiency
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

  // Hero power ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â attacker
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
    if (h.class === "blood_shaman") atkBloodShamanMult *= 1.1; // +10% total military
    if (h.class === "alpha") atkPackLeaderMult *= 1.5; // rangers
  });

  const atkPowerRaw =
    (atkFighterPower +
      atkRangerPower * atkPackLeaderMult +
      atkMagePower * atkMageMult +
      wmPower * atkWmMult +
      atkHeroPower) *
    atkMoraleMult *
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
      " ÃƒÂ¢Ã‹Å“Ã¢â€šÂ¬ÃƒÂ¯Ã‚Â¸Ã‚Â Daylight penalty: Your troops are lethargic and ineffective during the day!";
  }

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Step 5: Defense power ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
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

  // Fighter wall
  const defFighterPower =
    defFightersAfterVolley * defArmor * defTactics * defRaceMil * defFighterLvl;
  // Ranger fire from outposts/towers ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â rangers defend from walls, scaled by structures
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
  // Mage barrier
  const defMagePower =
    defAvail.mages *
    1.5 *
    ((defender.res_defense_magic || 100) / 100) *
    defRaceMag *
    defMageLvl;
  // War machine garrison ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â crewed by engineers at home
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
  // Engineer garrison repair bonus
  const defEngBonus =
    Math.floor(defAvail.engineers / 10) *
    50 *
    defEngMult *
    raceBonus(defender, "construction");
  // Wall defense power (includes warmachines mounted on walls)
  const defWallPowerRaw = wallDefensePower(defender);
  // Ladders scale against the number of walls: each active ladder bypasses one wall's share
  // of defense, capped at 20% total reduction (defenders still man the battlements)
  const defWalls = defender.bld_walls || 0;
  const ladderBypass =
    defWalls > 0 ? Math.min(0.2, laddersActive / defWalls) : 0;
  const defWallPower = Math.floor(defWallPowerRaw * (1 - ladderBypass));
  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Step 1b: Ladder assault ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  if (laddersActive > 0 && defWalls > 0) {
    const bypassPct = Math.round(ladderBypass * 100);
    steps.push({
      phase: "Siege",
      title: "ÃƒÂ°Ã…Â¸Ã‚ÂªÃ…â€œ Ladder Assault",
      msg: `${laddersActive} ÃƒÂ°Ã…Â¸Ã‚ÂªÃ…â€œ ladders scaled the walls (crewed by engineers), bypassing ${bypassPct}% of wall defenses!`,
      icon: "ÃƒÂ°Ã…Â¸Ã‚ÂªÃ…â€œ",
    });
  } else if (laddersActive > 0) {
    steps.push({
      phase: "Siege",
      title: "ÃƒÂ°Ã…Â¸Ã‚ÂªÃ…â€œ Ladder Party",
      msg: `ÃƒÂ°Ã…Â¸Ã‚ÂªÃ…â€œ Ladders were raised but the enemy has no walls to scale.`,
      icon: "ÃƒÂ°Ã…Â¸Ã‚ÂªÃ…â€œ",
    });
  }

  // Outpost ranger patrol power
  const defOutpostPower = outpostRangerPower(defender);
  // Guard tower detection power (adds to structural defense)
  const defTowerPower = towerDetectionPower(defender);
  // Structure defense (castles) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 500 defense per castle (max 10 = 5000)
  const castleDefenseMult = fragmentBonusManager.getBonusMultiplier(defender, 'castles', 'defense');
  const defStructures = Math.floor((defender.bld_castles || 0) * 500 * castleDefenseMult);
  // Defense tier bonuses
  const defUpgrades = safeJsonParse(
    defender.defense_upgrades,
    {},
    "resolveMilitaryAttack:defense_upgrades",
  );
  let defTierMult = 1.0;
  if (defUpgrades.fortified) defTierMult += 0.05;
  if (defUpgrades.keep) defTierMult += 0.1;
  if (defUpgrades.citadel) defTierMult += 0.15;

  // Hero power ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â defender
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
      defSiegebreakerStructureMult *= 2.0; // Impenetrable Bastion buff
    }
    if (h.class === "archmage") defMageMult *= 1.25;
    if (h.class === "warlord") defWarlordMult *= 1.25;
    if (h.class === "blood_shaman") defBloodShamanMult *= 1.1; // +10% total military
    if (h.class === "alpha") defPackLeaderMult *= 1.5; // rangers
    if (h.class === "lunar_sentinel") defLunarSentinelMult *= 1.5; // Moonbeam Shield - magic def
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
    defMoraleMult *
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

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Step 6: Battle resolution ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  const variance = 0.8 + Math.random() * 0.4;
  const win = atkPower * variance > defPowerFinal;
  const powerRatio = atkPower / Math.max(1, defPowerFinal);
  steps.push({
    phase: "Clash",
    title: "Main Assault",
    msg: `Attacker Power (${Math.round(atkPower)}) vs Defender Power (${Math.round(defPowerFinal)}).`,
    icon: "ÃƒÂ¢Ã…Â¡Ã¢â‚¬ÂÃƒÂ¯Ã‚Â¸Ã‚Â",
  });

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Step 7: Casualties ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  // Clerics reduce own-side losses
  const atkClericHeal = calcClericHeal(attacker, attacker.clerics || 0, sent.fighters + sent.rangers, attackerHeroes, 'shrine_upgrades');
  const defClericHeal = calcClericHeal(defender, defAvail.clerics, defAvail.fighters || 1, defenderHeroes, 'shrine_upgrades');

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
      icon: "ÃƒÂ¢Ã…â€œÃ‚Â¨",
    });
  }

  // Dark Elf stealth reduces attacker losses
  const atkStealthBonus = raceBonus(attacker, "stealth") > 1 ? 0.85 : 1.0;

  const atkFighterLossPct = win
    ? 0.04 + Math.random() * 0.08
    : 0.2 + Math.random() * 0.25;
  const atkRangerLossPct = win
    ? 0.02 + Math.random() * 0.04
    : 0.1 + Math.random() * 0.12; // ranged = safer
  const atkMageLossPct = win
    ? 0.01 + Math.random() * 0.03
    : 0.05 + Math.random() * 0.08; // back line = safest

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

  // Track specific ninja/ranger opening kills separately for the report if desired,
  // but they are already included in the losses above (mostly).
  // Actually, defFightersLost in original code was defFightersAfterVolley * pct.
  // I'll keep the ninjaKills and rangerKills as a separate "bonus" to the losses for clarity.
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

  // Land transfer
  // Actually, requested straight "-10% land loss on defeat" means multiplier, or flat %?
  // 10% land loss * (1 - 0.05) for fortified? Let's do:
  let defLandLossMult = 1.0;
  if (defUpgrades.fortified) defLandLossMult -= 0.05;
  if (defUpgrades.keep) defLandLossMult -= 0.1;
  if (defUpgrades.citadel) defLandLossMult -= 0.15;

  // Also Reinforced Walls do -10%
  const wallUpgrades = safeJsonParse(
    defender.wall_upgrades,
    {},
    "resolveMilitaryAttack:wall_upgrades",
  );
  if (wallUpgrades.reinforced) defLandLossMult -= 0.1;

  const landTransferred = win
    ? Math.floor(defender.land * 0.1 * Math.max(0.1, defLandLossMult))
    : 0;

  // Warmachine damage ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â walls take damage on win, no walls = building damage
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
          icon: "ÃƒÂ°Ã…Â¸Ã‚Â§Ã‚Â±",
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
          icon: "ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â¥",
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

  let necroMsg = "";

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Step 8: Morale changes & Discovery ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  const { atkMoraleChange, defMoraleChange, newAtkMorale, newDefMorale } = calcMoraleChanges(win, powerRatio, bullyRatio, attacker, defender);

  // The attacker is always discovered by the defender (map drop)
  const defDisc = safeJsonParse(
    defender.discovered_kingdoms,
    {},
    "resolveMilitaryAttack:defender_discovered_kingdoms",
  );
  defDisc[attacker.id] = { found: true, mapped: true }; // Attackers leave maps
  defenderUpdates.discovered_kingdoms = JSON.stringify(defDisc);

  const atkLines = [];
  const defLines = [];

  // Chance to find a location map on a corpse from the loser's kingdom
  const baseChance = 0.08;
  const winner = win ? attacker : defender;
  const loser = win ? defender : attacker;
  const winnerUpdates = win ? attackerUpdates : defenderUpdates;
  const loserUpdates = win ? defenderUpdates : attackerUpdates;

  // Check if loser has Dwarven Star-Metal or Dragon Scale protecting maps
  const loserFragment = fragmentBonusManager.getFragmentForBuilding(loser, 'libraries');
  const canStealMaps = !loserFragment || (loserFragment.fragment !== 'Dwarven Star-Metal' && loserFragment.fragment !== 'Dragon Scale');

  const lootRaceBonus =
    winner.race === "orc" || winner.race === "dire_wolf" ? 1.5 : 1.0;
  if (canStealMaps && Math.random() < baseChance * lootRaceBonus) {
    const winnerDisc = safeJsonParse(
      winnerUpdates.discovered_kingdoms || winner.discovered_kingdoms,
      {},
      "resolveMilitaryAttack:winner_disc",
    );
    const loserDisc = safeJsonParse(
      loserUpdates.discovered_kingdoms || loser.discovered_kingdoms,
      {},
      "resolveMilitaryAttack:loser_disc",
    );

    // Find maps the loser has that the winner does NOT have
    const mappedIds = Object.keys(loserDisc).filter(
      (id) =>
        loserDisc[id]?.mapped && !winnerDisc[id]?.mapped && id != winner.id,
    );

    if (mappedIds.length > 0) {
      const stolenId = mappedIds[Math.floor(Math.random() * mappedIds.length)];
      // Add to winner
      winnerDisc[stolenId] = { found: true, mapped: true };
      winnerUpdates.discovered_kingdoms = JSON.stringify(winnerDisc);
      // Remove from loser
      delete loserDisc[stolenId];
      loserUpdates.discovered_kingdoms = JSON.stringify(loserDisc);

      if (win) {
        atkLines.push(
          `ÃƒÂ°Ã…Â¸Ã¢â‚¬â€Ã‚ÂºÃƒÂ¯Ã‚Â¸Ã‚Â You looted a location map of a mysterious kingdom from a fallen soldier's corpse.`,
        );
      } else {
        defLines.push(
          `ÃƒÂ°Ã…Â¸Ã¢â‚¬â€Ã‚ÂºÃƒÂ¯Ã‚Â¸Ã‚Â Your guards recovered a location map from a fallen enemy soldier.`,
        );
      }
    }
  }

  // Increment defender maps if they don't have one to the attacker or just as a bonus?
  // User says: "Anytime you are attacked, the attacker leaves behind a map with their location on it."
  // This implies the 'maps' resource should increment.
  defenderUpdates.maps = (defender.maps || 0) + 1;

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Build updates ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  Object.assign(attackerUpdates, {
    fighters: Math.max(0, attacker.fighters - atkFightersLost),
    rangers: Math.max(0, attacker.rangers - atkRangersLost),
    mages: Math.max(0, attacker.mages - atkMagesLost),
    ninjas: Math.max(0, attacker.ninjas - atkNinjasLost),
    thieves: Math.max(0, attacker.thieves - atkThievesLost),
    clerics: Math.max(0, (attacker.clerics || 0) - atkClericsLost),
    engineers: Math.max(0, (attacker.engineers || 0) - atkEngineersLost),
    war_machines: Math.max(0, (attacker.war_machines || 0) - atkWmLost),
    land: attacker.land + landTransferred,
    morale: newAtkMorale,
    weapons_stockpile: Math.max(
      0,
      (attacker.weapons_stockpile || 0) -
        Math.floor(weaponsEquipped * atkFighterLossPct),
    ),
  });
  Object.assign(defenderUpdates, {
    fighters: Math.max(0, defender.fighters - defFightersLost),
    rangers: Math.max(0, defender.rangers - defRangersLost),
    mages: Math.max(0, defender.mages - defMagesLost),
    ninjas: Math.max(0, defender.ninjas - defNinjasLost),
    thieves: Math.max(0, defender.thieves - defThievesLost),
    clerics: Math.max(0, (defender.clerics || 0) - defClericsLost),
    engineers: Math.max(0, (defender.engineers || 0) - defEngineersLost),
    war_machines: Math.max(0, (defender.war_machines || 0) - defWmLost),
    land: Math.max(0, defender.land - landTransferred),
    morale: newDefMorale,
  });

  // Reanimation / conversion of casualties (after base troop updates)
  necroMsg = applyReanimation(win, attacker, defender, {
    atkSoldierKills, atkTotalKills, atkClericKills, atkClericsLost,
    defSoldierKills, defTotalKills, defClericKills, defClericsLost,
  }, attackerUpdates, defenderUpdates);

  // XP
  const atkTroopXpF = awardTroopXp(attacker, "fighters", win ? 30 : 10);
  const atkTroopXpR = awardTroopXp(
    { ...attacker, troop_levels: atkTroopXpF.troop_levels },
    "rangers",
    win ? 20 : 8,
  );
  const defTroopXp = awardTroopXp(defender, "fighters", win ? 10 : 20);
  attackerUpdates.troop_levels = atkTroopXpR.troop_levels;
  defenderUpdates.troop_levels = defTroopXp.troop_levels;

  const atkXp = awardXp(attacker, win ? "combat_win" : "combat_loss", 1);
  const defXp = awardXp(defender, win ? "combat_loss" : "combat_win", 1);
  attackerUpdates.xp = atkXp.xp;
  attackerUpdates.level = atkXp.level;
  defenderUpdates.xp = defXp.xp;
  defenderUpdates.level = defXp.level;

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Battle report ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  const report = {
    win,
    landTransferred,
    powerRatio: Math.round(powerRatio * 100) / 100,
    atkPower: Math.round(atkPower),
    defPower: Math.round(defPower),
    sent,
    atkFightersLost,
    atkRangersLost,
    atkMagesLost,
    atkNinjasLost,
    atkClericsLost,
    atkThievesLost,
    atkEngineersLost,
    atkWmLost,
    defFightersLost,
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
    atkMoraleChange,
    defMoraleChange,
    bullyMsg,
    shameEvent,
    steps,
  };

  // Capture building damage details
  if (win && warmachineUpdates.bld_walls !== undefined) {
    const wallsLost = (defender.bld_walls || 0) - warmachineUpdates.bld_walls;
    if (wallsLost > 0) report.wallsDestroyed = wallsLost;
  }
  if (win && !defender.bld_walls) {
    const dmgCols = Object.keys(warmachineUpdates).filter(
      (k) => k.startsWith("bld_") && warmachineUpdates[k] < (defender[k] || 0),
    );
    if (dmgCols.length > 0) {
      report.buildingsDamaged = dmgCols.map((c) => ({
        type: c.replace("bld_", "").replace(/_/g, " "),
        lost: (defender[c] || 0) - warmachineUpdates[c],
      }));
    }
  }

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Event messages ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  if (ninjaKills > 0)
    atkLines.push(
      `Ninjas eliminated ${ninjaKills} defenders before the battle.`,
    );
  if (rangerKills > 0)
    atkLines.push(`Rangers volley killed ${rangerKills} defenders.`);
  if (thiefSabotage > 0)
    atkLines.push(`Thieves disabled ${thiefSabotage} enemy war machines.`);
  if (daylightPenaltyMsg) atkLines.push(daylightPenaltyMsg);
  if (necroMsg) atkLines.push(necroMsg);
  if (bullyMsg) atkLines.push(bullyMsg);

  // Add summary step to replay
  const atkSummaryParts = [];
  if (atkFightersLost > 0)
    atkSummaryParts.push(`${fmt(atkFightersLost)} fighters`);
  if (atkRangersLost > 0)
    atkSummaryParts.push(`${fmt(atkRangersLost)} rangers`);
  if (atkMagesLost > 0) atkSummaryParts.push(`${fmt(atkMagesLost)} mages`);
  if (atkClericsLost > 0)
    atkSummaryParts.push(`${fmt(atkClericsLost)} clerics`);
  if (atkNinjasLost > 0) atkSummaryParts.push(`${fmt(atkNinjasLost)} ninjas`);
  if (atkThievesLost > 0)
    atkSummaryParts.push(`${fmt(atkThievesLost)} thieves`);
  if (atkEngineersLost > 0)
    atkSummaryParts.push(`${fmt(atkEngineersLost)} engineers`);
  if (atkWmLost > 0) atkSummaryParts.push(`${fmt(atkWmLost)} war machines`);

  const defSummaryParts = [];
  if (defFightersLost > 0)
    defSummaryParts.push(`${fmt(defFightersLost)} fighters`);
  if (defRangersLost > 0)
    defSummaryParts.push(`${fmt(defRangersLost)} rangers`);
  if (defMagesLost > 0) defSummaryParts.push(`${fmt(defMagesLost)} mages`);
  if (defClericsLost > 0)
    defSummaryParts.push(`${fmt(defClericsLost)} clerics`);
  if (defNinjasLost > 0) defSummaryParts.push(`${fmt(defNinjasLost)} ninjas`);
  if (defThievesLost > 0)
    defSummaryParts.push(`${fmt(defThievesLost)} thieves`);
  if (defEngineersLost > 0)
    defSummaryParts.push(`${fmt(defEngineersLost)} engineers`);
  if (defWmLost > 0) defSummaryParts.push(`${fmt(defWmLost)} war machines`);

  let summaryMsg =
    `Battle Concluded. ${win ? "Attacker" : "Defender"} victory.\n\n` +
    `Attacker Losses: ${atkSummaryParts.join(", ") || "None"}\n` +
    `Defender Losses: ${defSummaryParts.join(", ") || "None"}`;

  if (landTransferred > 0)
    summaryMsg += `\nLand Seized: ${fmt(landTransferred)} acres.`;
  if (report.buildingsDamaged) {
    summaryMsg += `\nBuildings Destroyed: ${report.buildingsDamaged.map((b) => `${fmt(b.lost)} ${b.type}`).join(", ")}`;
  } else if (report.wallsDestroyed) {
    summaryMsg += `\nWalls Destroyed: ${fmt(report.wallsDestroyed)}`;
  }

  steps.push({
    phase: "Summary",
    title: "Casualty Report",
    msg: summaryMsg,
    icon: "ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã…â€œ",
  });

  const atkLossesTitle =
    atkSummaryParts.slice(0, 2).join(", ") +
    (atkSummaryParts.length > 2 ? "..." : "");
  const defLossesTitle =
    defSummaryParts.slice(0, 2).join(", ") +
    (defSummaryParts.length > 2 ? "..." : "");

  const atkEvent = win
    ? `ÃƒÂ¢Ã…Â¡Ã¢â‚¬ÂÃƒÂ¯Ã‚Â¸Ã‚Â You attacked ${defender.name} and won! Captured ${fmt(landTransferred)} acres. Losses: ${atkLossesTitle || "None"}.`
    : `ÃƒÂ¢Ã…Â¡Ã¢â‚¬ÂÃƒÂ¯Ã‚Â¸Ã‚Â Attack on ${defender.name} was repelled. Losses: ${atkLossesTitle || "None"}.`;

  const defEvent = win
    ? `ÃƒÂ¢Ã…Â¡Ã¢â‚¬ÂÃƒÂ¯Ã‚Â¸Ã‚Â ${attacker.name} attacked and broke through! You lost ${fmt(landTransferred)} acres. Losses: ${defLossesTitle || "None"}.`
    : `ÃƒÂ¢Ã…Â¡Ã¢â‚¬ÂÃƒÂ¯Ã‚Â¸Ã‚Â ${attacker.name} attacked but was repelled. Losses: ${defLossesTitle || "None"}.`;

  const finalAtkEvent = [atkEvent, ...atkLines].filter(Boolean).join(" ");
  const finalDefEvent = [defEvent, ...defLines].filter(Boolean).join(" ");

  return {
    win,
    report,
    attackerUpdates,
    defenderUpdates,
    atkEvent: finalAtkEvent,
    defEvent: finalDefEvent,
    shameEvent,
  };
}

module.exports = {
  moraleMult,
  sumRecordValues,
  normalizeCombatUnits,
  formatCombatUnitCounts,
  formatCombatBuildingsLost,
  formatCombatV2NewsBlurb,
  resolveMilitaryAttack,
  resolveMilitaryAttackV2Adapter,
};
