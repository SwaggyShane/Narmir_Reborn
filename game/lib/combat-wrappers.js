// game/lib/combat-wrappers.js
// Combat resolution wrappers: orchestrate military attacks and unit losses.
// Pure functions (deterministic given kingdom state, RNG seeded externally).
// Requires access to combat-resolver, heroes, defense, troops, config modules.

const { safeJsonParse } = require('../../utils/helpers');
const { isNight, calcDiscoveryChance } = require('./data-transformations');
const { formatCombatV2NewsBlurb } = require('./combat-helpers');
const { getAvailableUnits } = require('./troops');
const fragmentBonusManager = require('../fragment-bonus-manager');
const combatResolverV2 = require('../combat-resolver');
const { getFlag } = require('../feature-flags');
const { hasElevationGrid, getElevationGrid } = require('../world-elevation-cache');
const { getKingdomElevationLevel } = require('../world-elevation');

// Import constants from config
const xpMod = require('../xp');
const { awardXp } = xpMod;

const config = require('../config');
const { WM_CREW_REQUIRED } = config;

// Combat V2 is the only military path (legacy aggregate combat removed 2026-07-16).
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

  // Attach elevation_level so combat-resolver's calculateElevationBonus can fire.
  if (getFlag('FEATURE_ELEVATION_COMBAT') && hasElevationGrid()) {
    const grid = getElevationGrid();
    attacker.elevation_level = getKingdomElevationLevel(attacker, grid);
    defender.elevation_level = getKingdomElevationLevel(defender, grid);
  }

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

  // Post-combat happiness (resolver reads happiness as power input but does not write outcomes).
  const powerRatio =
    (v2Result.report.diagnostics?.attacker?.totalDmg || 0) /
    Math.max(1, v2Result.report.diagnostics?.defender?.totalDmg || 0);
  const landRatio = (attacker.land || 1) / Math.max(1, defender.land || 1);
  const fighterRatio = (attacker.fighters || 1) / Math.max(1, defender.fighters || 1);
  const bullyRatio = Math.max(landRatio, fighterRatio * 0.5);
  const victoryMargin = Math.min(2.0, Math.max(0.1, powerRatio));
  let atkHappinessChange;
  let defHappinessChange;
  if (v2Result.win) {
    atkHappinessChange = Math.floor(5 + Math.min(10, victoryMargin * 5));
    defHappinessChange = -Math.max(5, Math.floor(Math.min(20, victoryMargin * 10)));
    if (bullyRatio >= 8) atkHappinessChange -= 15;
    if (bullyRatio >= 4) atkHappinessChange -= 5;
  } else {
    atkHappinessChange = -Math.floor(5 + Math.min(15, (1 / Math.max(0.1, powerRatio)) * 8));
    defHappinessChange = Math.floor(5 + Math.min(10, (1 / Math.max(0.1, powerRatio)) * 5));
  }
  attackerUpdates.happiness = Math.max(
    HAPPINESS_FLOOR,
    Math.min(200, (attacker.happiness !== undefined && attacker.happiness !== null ? attacker.happiness : 100) + atkHappinessChange),
  );
  defenderUpdates.happiness = Math.max(
    HAPPINESS_FLOOR,
    Math.min(200, (defender.happiness !== undefined && defender.happiness !== null ? defender.happiness : 100) + defHappinessChange),
  );

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
    powerRatio: Math.round(powerRatio * 100) / 100,
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
        msg: "HP/DMG combat resolved via Combat V2 (default path as of 2026-07-15).",
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

  // Kingdom discovery / location maps (must live on the V2 path — sole combat resolver)
  applyPostCombatDiscovery({
    win: v2Result.win,
    attacker,
    defender,
    attackerUpdates,
    defenderUpdates,
  });

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

/**
 * Post-combat discovery:
 * - Defender always maps the attacker (attackers "leave a map")
 * - Chance to steal a third-party mapped kingdom from the loser's book
 * - Chance for winner to learn the loser's existence (found, not mapped)
 */
function applyPostCombatDiscovery({ win, attacker, defender, attackerUpdates, defenderUpdates }) {
  const defDisc = safeJsonParse(
    defenderUpdates.discovered_kingdoms || defender.discovered_kingdoms,
    {},
    "combat-v2:defender_discovered_kingdoms",
  ) || {};
  defDisc[attacker.id] = {
    found: true,
    mapped: true,
    name: attacker.name,
  };
  defenderUpdates.discovered_kingdoms = JSON.stringify(defDisc);

  const baseChance = 0.08;
  const winner = win ? attacker : defender;
  const loser = win ? defender : attacker;
  const winnerUpdates = win ? attackerUpdates : defenderUpdates;
  const loserUpdates = win ? defenderUpdates : attackerUpdates;

  const loserFragment = fragmentBonusManager.getFragmentForBuilding(loser, "libraries");
  const canStealMaps =
    !loserFragment ||
    (loserFragment.fragment !== "Dwarven Star-Metal" &&
      loserFragment.fragment !== "Dragon Scale");

  const lootRaceBonus =
    winner.race === "orc" || winner.race === "dire_wolf" ? 1.5 : 1.0;

  if (canStealMaps && Math.random() < baseChance * lootRaceBonus) {
    const winnerDisc =
      safeJsonParse(
        winnerUpdates.discovered_kingdoms || winner.discovered_kingdoms,
        {},
        "combat-v2:winner_disc",
      ) || {};
    const loserDisc =
      safeJsonParse(
        loserUpdates.discovered_kingdoms || loser.discovered_kingdoms,
        {},
        "combat-v2:loser_disc",
      ) || {};

    const mappedIds = Object.keys(loserDisc).filter(
      (id) =>
        loserDisc[id]?.mapped &&
        !winnerDisc[id]?.mapped &&
        String(id) !== String(winner.id),
    );

    if (mappedIds.length > 0) {
      const stolenId = mappedIds[Math.floor(Math.random() * mappedIds.length)];
      const entry = loserDisc[stolenId] || {};
      winnerDisc[stolenId] = {
        found: true,
        mapped: true,
        name: entry.name,
      };
      delete loserDisc[stolenId];
      winnerUpdates.discovered_kingdoms = JSON.stringify(winnerDisc);
      loserUpdates.discovered_kingdoms = JSON.stringify(loserDisc);
    }
  }

  const discChance = calcDiscoveryChance(winner);
  if (Math.random() < discChance) {
    const discovererDisc =
      safeJsonParse(
        winnerUpdates.discovered_kingdoms || winner.discovered_kingdoms,
        {},
        "combat-v2:discoverer_disc",
      ) || {};
    if (!discovererDisc[loser.id]?.found) {
      discovererDisc[loser.id] = {
        found: true,
        mapped: false,
        name: loser.name,
      };
      winnerUpdates.discovered_kingdoms = JSON.stringify(discovererDisc);
    }
  }
}

function resolveMilitaryAttack(
  attacker,
  defender,
  sentUnits,
  attackerHeroes = [],
  defenderHeroes = [],
) {
  return resolveMilitaryAttackV2Adapter(
    attacker,
    defender,
    sentUnits,
    attackerHeroes,
    defenderHeroes,
  );
}

module.exports = {
  resolveMilitaryAttack,
  resolveMilitaryAttackV2Adapter,
  wmCrewRequired,
};
