/**
 * 🔴 CRITICAL: DO NOT DELETE OR MOVE THIS FILE 🔴
 *
 * Combat Resolver v2 - Comprehensive combat execution
 * Handles individual troop HP, walls, ladders, ninjas, thieves, clerics, war machines
 *
 * STATUS: Complete but intentionally NOT integrated. Marked for future integration.
 * IMPORTANCE: This is a major system overhaul that must be done correctly.
 * All other work must be completed before integration begins.
 * See plan: /root/.claude/plans/combat-redesign-integration.md
 *
 * TODO: Replace engine.js combat with executeCombat() from this file.
 * See combat-new.js header for full integration checklist.
 * Status: Complete but unintegrated — never wired into the active game loop.
 */

const config = require('./config');
const combatCalc = require('./combat-new');
const { getTerrainModifiers, getTerrainDisplayName } = require('./terrain');

const TROOP_TYPES = ['thralls', 'fighters', 'rangers', 'mages', 'clerics', 'ninjas', 'thieves', 'engineers', 'war_machines'];
const WEAPON_EQUIPPED_TYPES = ['fighters', 'rangers', 'clerics', 'ninjas', 'thieves', 'engineers'];
const ARMOR_EQUIPPED_TYPES = ['fighters', 'rangers', 'mages', 'clerics', 'ninjas', 'thieves', 'engineers'];
const CRIT_CONFIG = {
  thralls: { chance: 0.01, multiplier: 2.0 },
  fighters: { chance: 0.05, multiplier: 3.0 },
  rangers: { chance: 0.08, multiplier: 3.0 },
  mages: { chance: 0.06, multiplier: 3.2 },
  clerics: { chance: 0.03, multiplier: 2.5 },
  ninjas: { chance: 0.15, multiplier: 4.0 },
  thieves: { chance: 0.10, multiplier: 3.0 },
  engineers: { chance: 0.02, multiplier: 2.0 },
  war_machines: { chance: 0.12, multiplier: 5.0 },
};
const CLERIC_COMBAT_DAMAGE_MULT = 0.75;
const EQUIPMENT_CONFIG = {
  weapons: { stockpile: 'weapons_stockpile', research: 'res_weapons' },
  armor: { stockpile: 'armor_stockpile', research: 'res_armor' },
};

function isVampire(kingdom) {
  return kingdom?.race === 'vampire';
}

function isVampireDayDefense(kingdom) {
  return isVampire(kingdom) && kingdom.__vampireDayDefense === true;
}

/**
 * Execute full combat between attacker and defender
 * Returns detailed results with injuries, wall damage, deaths, etc.
 */
function executeCombat(_db, attacker, defender, combatType, targetFocus, _engineerLevel = 1) {
  const result = {
    win: false,
    outcome: 'repelled',
    attackerUpdates: {},
    defenderUpdates: {},
    report: {
      combatType,
      targetFocus,
      attackerKilled: 0,
      defenderKilled: 0,
      wallDamage: 0,
      injuredTroops: {},
      ninjaAssassinations: [],
      thiefSabotage: [],
      diagnostics: {},
    },
  };

  // Parse current troop states
  const attackerInjured = combatCalc.parseInjuredTroops(attacker.injured_troops);
  const defenderInjured = combatCalc.parseInjuredTroops(defender.injured_troops);

  const effectiveDefender = { ...defender };
  if (attacker.thieves > 0 && defender.war_machines > 0) {
    const sabotage = executeThiefSabotage(attacker.thieves);
    const avgReduction = sabotage.reduce((sum, item) => sum + item.reduction, 0) / sabotage.length;
    const cappedReduction = Math.min(0.75, avgReduction);
    const disabledWarMachines = Math.min(defender.war_machines, Math.floor(defender.war_machines * cappedReduction));
    effectiveDefender.war_machines = Math.max(0, defender.war_machines - disabledWarMachines);
    result.report.thiefSabotage = sabotage;
    result.report.disabledWarMachines = disabledWarMachines;
  }

  // Calculate combat power for attacker and defender
  const {
    attackerPower,
    defenderPower,
    diagnostics,
  } = calculateCombatPower(attacker, effectiveDefender, combatType);
  result.report.diagnostics = diagnostics;

  // Determine if attacker wins
  const distancePenalty = calculateTargetDistance(targetFocus);
  const adjustedAttackerPower = attackerPower * distancePenalty;
  const winChance = adjustedAttackerPower / (adjustedAttackerPower + defenderPower);

  result.win = Math.random() < winChance;
  result.outcome = result.win ? 'victory' : 'repelled';
  result.report.winChance = winChance;

  // Phase 3: record terrain for reports
  result.report.attackerTerrain = getTerrainDisplayName(attacker.terrain || 'plains');
  result.report.defenderTerrain = getTerrainDisplayName(defender.terrain || 'plains');

  if (!result.win) {
    // Attacker repelled - attacker takes the heavier damage.
    const attackerDamageReport = applyIndividualUnitAttacks(
      attackerInjured,
      attacker,
      effectiveDefender,
      combatType,
      'defender',
      0.08,
      targetFocus
    );
    const defenderDamageReport = applyIndividualUnitAttacks(
      defenderInjured,
      defender,
      attacker,
      combatType,
      'attacker',
      0.02 * distancePenalty,
      targetFocus
    );
    const attackerRescues = isVampire(attacker) ? [] : applyClericHealing(
      attackerInjured,
      attacker.clerics,
      parseTroopLevel(attacker.troop_levels, 'clerics')
    );
    const defenderRescues = isVampire(defender) ? [] : applyClericHealing(
      defenderInjured,
      defender.clerics,
      parseTroopLevel(defender.troop_levels, 'clerics')
    );
    reconcileDamageReport(attackerDamageReport, attackerInjured);
    reconcileDamageReport(defenderDamageReport, defenderInjured);
    result.report.clericRescues = [...attackerRescues, ...defenderRescues];
    result.report.clericRescuesBySide = { attacker: attackerRescues, defender: defenderRescues };
    result.report.attackerKilled = attackerDamageReport.deadTotal;
    result.report.defenderKilled = defenderDamageReport.deadTotal;
    result.report.injuredTroops.attacker = attackerDamageReport;
    result.report.injuredTroops.defender = defenderDamageReport;
    applyEquipmentStockpileLosses(result.attackerUpdates, attacker, attackerDamageReport);
    applyEquipmentStockpileLosses(result.defenderUpdates, defender, defenderDamageReport);
    awardLostEquipmentToDefender(result.defenderUpdates, defender, attackerDamageReport, defenderDamageReport);
    if (isVampire(defender)) {
      result.report.vampireReanimation = applyVampireReanimation(
        defender,
        result.defenderUpdates,
        attackerDamageReport,
        defenderDamageReport
      );
    }
  } else {
    // Attacker wins - apply both sides' casualties
    const attackerDamageReport = applyIndividualUnitAttacks(
      attackerInjured,
      attacker,
      effectiveDefender,
      combatType,
      'defender',
      0.05,
      targetFocus
    );
    const defenderDamageReport = applyIndividualUnitAttacks(
      defenderInjured,
      defender,
      attacker,
      combatType,
      'attacker',
      0.15 * distancePenalty,
      targetFocus
    );
    const attackerRescues = isVampire(attacker) ? [] : applyClericHealing(
      attackerInjured,
      attacker.clerics,
      parseTroopLevel(attacker.troop_levels, 'clerics')
    );
    const defenderRescues = isVampire(defender) ? [] : applyClericHealing(
      defenderInjured,
      defender.clerics,
      parseTroopLevel(defender.troop_levels, 'clerics')
    );
    reconcileDamageReport(attackerDamageReport, attackerInjured);
    reconcileDamageReport(defenderDamageReport, defenderInjured);
    result.report.clericRescues = [...attackerRescues, ...defenderRescues];
    result.report.clericRescuesBySide = { attacker: attackerRescues, defender: defenderRescues };

    result.report.attackerKilled = attackerDamageReport.deadTotal;
    result.report.defenderKilled = defenderDamageReport.deadTotal;
    result.report.injuredTroops.attacker = attackerDamageReport;
    result.report.injuredTroops.defender = defenderDamageReport;
    applyEquipmentStockpileLosses(result.attackerUpdates, attacker, attackerDamageReport);
    applyEquipmentStockpileLosses(result.defenderUpdates, defender, defenderDamageReport);
    awardLostEquipmentToDefender(result.defenderUpdates, defender, attackerDamageReport, defenderDamageReport);
    if (isVampire(attacker)) {
      result.report.vampireReanimation = applyVampireReanimation(
        attacker,
        result.attackerUpdates,
        defenderDamageReport,
        attackerDamageReport
      );
    }

    // Handle special mechanics on victory
    if (result.win) {
      // Wall damage from ladders
      if (defender.bld_walls > 0 && attacker.engineers > 0 && attacker.ladders > 0) {
        const wallDamage = applyWallDamage(attacker, defender);
        result.report.wallDamage = wallDamage;
        result.defenderUpdates.wall_hp = Math.max(0, (defender.wall_hp || 0) - wallDamage);
      }

      // Ninja assassinations
      if (attacker.ninjas > 0) {
        const assassinations = executeNinjaAssassinations(
          defenderInjured,
          defender,
          attacker.ninjas,
          attacker.troop_levels?.ninjas || 1,
          defender.troop_levels
        );
        result.report.ninjaAssassinations = assassinations;
      }

    }
  }

  // Store injured troops in updates
  clearBattleMarkers(attackerInjured);
  clearBattleMarkers(defenderInjured);
  result.attackerUpdates.injured_troops = combatCalc.serializeInjuredTroops(attackerInjured);
  result.defenderUpdates.injured_troops = combatCalc.serializeInjuredTroops(defenderInjured);

  // Calculate total alive troops for summary
  result.report.attackerLiving = getTotalLivingTroops(attacker, attackerInjured);
  result.report.defenderLiving = getTotalLivingTroops(defender, defenderInjured);

  return result;
}

/**
 * Calculate combat power for a kingdom
 * Includes all troop types, research, happiness, etc.
 * Restricts units based on combatType (military, covert, magic)
 */
function calculateCombatPower(kingdom, opponent, combatType) {
  const happinessMult = calculateHappinessMult(kingdom.happiness !== undefined && kingdom.happiness !== null ? kingdom.happiness : 50);
  const defenderHappiness = calculateHappinessMult(opponent.happiness !== undefined && opponent.happiness !== null ? opponent.happiness : 50);
  const attackerEquipment = calculateEquipmentCoverage(kingdom);
  const defenderEquipment = calculateEquipmentCoverage(opponent);

  const diagnostics = {
    attacker: buildCombatBudget(kingdom, combatType, 'attacker', happinessMult, attackerEquipment),
    defender: buildCombatBudget(opponent, combatType, 'defender', defenderHappiness, defenderEquipment),
  };

  let power = 0;

  // Restrict units based on combat type
  if (combatType === 'military') {
    // Military: fighters, rangers, war machines
    if (kingdom.thralls > 0) {
      const roleMult = isVampireDayDefense(kingdom) ? 4.5 : 0.55;
      const hpMult = isVampireDayDefense(kingdom) ? 5.0 : 1.0;
      const dmg = combatCalc.calculateIndividualTroopDmg('thralls', 0, 1, 1.0);
      power += kingdom.thralls * dmg * roleMult * hpMult * happinessMult;
    }

    if (kingdom.fighters > 0) {
      const troopLevel = parseTroopLevel(kingdom.troop_levels, 'fighters');
      const weaponResearch = getEquippedWeaponResearch(kingdom, 'fighters', attackerEquipment);
      const dmg = combatCalc.calculateIndividualTroopDmg('fighters', weaponResearch, troopLevel, getTroopRaceModifier(kingdom, 'fighters', 'military'));
      power += kingdom.fighters * dmg * happinessMult;
    }

    if (kingdom.rangers > 0) {
      const troopLevel = parseTroopLevel(kingdom.troop_levels, 'rangers');
      const weaponResearch = getEquippedWeaponResearch(kingdom, 'rangers', attackerEquipment);
      const dmg = combatCalc.calculateIndividualTroopDmg('rangers', weaponResearch, troopLevel, getTroopRaceModifier(kingdom, 'rangers', 'military'));
      power += kingdom.rangers * dmg * 0.7 * happinessMult;
    }

    if (kingdom.mages > 0) {
      const troopLevel = parseTroopLevel(kingdom.troop_levels, 'mages');
      const dmg = combatCalc.calculateIndividualTroopDmg('mages', kingdom.res_attack_magic || 100, troopLevel, getTroopRaceModifier(kingdom, 'mages', 'magic'));
      power += kingdom.mages * dmg * 2.5 * happinessMult;
    }

    if (kingdom.clerics > 0) {
      const troopLevel = parseTroopLevel(kingdom.troop_levels, 'clerics');
      const weaponResearch = getEquippedWeaponResearch(kingdom, 'clerics', attackerEquipment);
      const dmg = combatCalc.calculateIndividualTroopDmg('clerics', weaponResearch, troopLevel, getTroopRaceModifier(kingdom, 'clerics', 'military'));
      power += kingdom.clerics * dmg * CLERIC_COMBAT_DAMAGE_MULT * happinessMult;
    }

    if (kingdom.war_machines > 0) {
      const warMachineResearch = kingdom.res_war_machines || 100;
      const troopLevel = parseTroopLevel(kingdom.troop_levels, 'war_machines');
      const crew = calculateWarMachineCrew(kingdom);
      const dmg = combatCalc.calculateIndividualTroopDmg('war_machines', warMachineResearch, troopLevel, getRaceBonus(kingdom, 'war_machines'));
      power += crew.crewed * dmg;
    }
  } else if (combatType === 'covert') {
    // Covert: ninjas and thieves
    if (kingdom.ninjas > 0) {
      const troopLevel = parseTroopLevel(kingdom.troop_levels, 'ninjas');
      const weaponResearch = getEquippedWeaponResearch(kingdom, 'ninjas', attackerEquipment);
      const dmg = combatCalc.calculateIndividualTroopDmg('ninjas', weaponResearch, troopLevel, getTroopRaceModifier(kingdom, 'ninjas', 'covert'));
      power += kingdom.ninjas * dmg * happinessMult;
    }

    if (kingdom.thieves > 0) {
      const troopLevel = parseTroopLevel(kingdom.troop_levels, 'thieves');
      const weaponResearch = getEquippedWeaponResearch(kingdom, 'thieves', attackerEquipment);
      const dmg = combatCalc.calculateIndividualTroopDmg('thieves', weaponResearch, troopLevel, getTroopRaceModifier(kingdom, 'thieves', 'covert'));
      power += kingdom.thieves * dmg * happinessMult;
    }
  } else if (combatType === 'magic') {
    // Magic: mages only
    const attackMagicResearch = kingdom.res_attack_magic || 100;
    if (kingdom.mages > 0) {
      const troopLevel = parseTroopLevel(kingdom.troop_levels, 'mages');
      const dmg = combatCalc.calculateIndividualTroopDmg('mages', attackMagicResearch, troopLevel, getTroopRaceModifier(kingdom, 'mages', 'magic'));
      power += kingdom.mages * dmg * 2.5 * happinessMult;
    }
  }

  const attackerPower = power;

  // Defender side - uses same combat restrictions
  let defenderPower = 0;
  const defenseResearch = opponent.res_defense_magic || 100;

  if (combatType === 'military') {
    // Defender uses military troops
    if (opponent.thralls > 0) {
      const roleMult = isVampireDayDefense(opponent) ? 4.5 : 0.55;
      const hpMult = isVampireDayDefense(opponent) ? 5.0 : 1.0;
      const dmg = combatCalc.calculateIndividualTroopDmg('thralls', 0, 1, 1.0);
      defenderPower += opponent.thralls * dmg * roleMult * hpMult * defenderHappiness;
    }

    if (opponent.fighters > 0) {
      const troopLevel = parseTroopLevel(opponent.troop_levels, 'fighters');
      const opponentWeaponResearch = getEquippedWeaponResearch(opponent, 'fighters', defenderEquipment);
      const dmg = combatCalc.calculateIndividualTroopDmg('fighters', opponentWeaponResearch, troopLevel, getTroopRaceModifier(opponent, 'fighters', 'military'));
      defenderPower += opponent.fighters * dmg * 0.8 * defenderHappiness;
    }

    if (opponent.rangers > 0) {
      const troopLevel = parseTroopLevel(opponent.troop_levels, 'rangers');
      const opponentWeaponResearch = getEquippedWeaponResearch(opponent, 'rangers', defenderEquipment);
      const dmg = combatCalc.calculateIndividualTroopDmg('rangers', opponentWeaponResearch, troopLevel, getTroopRaceModifier(opponent, 'rangers', 'military'));
      defenderPower += opponent.rangers * dmg * 0.7 * defenderHappiness;
    }

    if (opponent.mages > 0) {
      const troopLevel = parseTroopLevel(opponent.troop_levels, 'mages');
      const dmg = combatCalc.calculateIndividualTroopDmg('mages', opponent.res_defense_magic || 100, troopLevel, getTroopRaceModifier(opponent, 'mages', 'magic'));
      defenderPower += opponent.mages * dmg * 1.5 * defenderHappiness;
    }

    if (opponent.clerics > 0) {
      const troopLevel = parseTroopLevel(opponent.troop_levels, 'clerics');
      const opponentWeaponResearch = getEquippedWeaponResearch(opponent, 'clerics', defenderEquipment);
      const dmg = combatCalc.calculateIndividualTroopDmg('clerics', opponentWeaponResearch, troopLevel, getTroopRaceModifier(opponent, 'clerics', 'military'));
      defenderPower += opponent.clerics * dmg * CLERIC_COMBAT_DAMAGE_MULT * defenderHappiness;
    }

    if (opponent.war_machines > 0) {
      const warMachineResearch = opponent.res_war_machines || 100;
      const troopLevel = parseTroopLevel(opponent.troop_levels, 'war_machines');
      const crew = calculateWarMachineCrew(opponent);
      const dmg = combatCalc.calculateIndividualTroopDmg('war_machines', warMachineResearch, troopLevel, getRaceBonus(opponent, 'war_machines'));
      defenderPower += crew.crewed * dmg * defenderHappiness;
    }
  } else if (combatType === 'covert') {
    // Defender uses covert defense (less effective)
    if (opponent.ninjas > 0) {
      const troopLevel = parseTroopLevel(opponent.troop_levels, 'ninjas');
      const opponentWeaponResearch = getEquippedWeaponResearch(opponent, 'ninjas', defenderEquipment);
      const dmg = combatCalc.calculateIndividualTroopDmg('ninjas', opponentWeaponResearch, troopLevel, getTroopRaceModifier(opponent, 'ninjas', 'covert'));
      defenderPower += opponent.ninjas * dmg * 0.5 * defenderHappiness;
    }
  } else if (combatType === 'magic') {
    // Defender uses magic defense
    if (opponent.mages > 0) {
      const troopLevel = parseTroopLevel(opponent.troop_levels, 'mages');
      const dmg = combatCalc.calculateIndividualTroopDmg('mages', defenseResearch, troopLevel, getTroopRaceModifier(opponent, 'mages', 'magic'));
      defenderPower += opponent.mages * dmg * 1.5 * defenderHappiness;
    }
  }

  const structureDefense = calculateStructureDefensePower(opponent);
  defenderPower += structureDefense.total;
  diagnostics.defender.structureDefense = structureDefense;

  diagnostics.attacker.totalDmg = attackerPower;
  diagnostics.defender.totalDmg = defenderPower;

  // Phase 3: Apply terrain combat modifiers
  const attackerTerrain = getTerrainModifiers(kingdom.terrain || 'plains');
  const defenderTerrain = getTerrainModifiers(opponent.terrain || 'plains');
  attackerPower = Math.round(attackerPower * (attackerTerrain.combatAtk || 1));
  defenderPower = Math.round(defenderPower * (defenderTerrain.combatDef || 1));
  diagnostics.attacker.terrain = getTerrainDisplayName(kingdom.terrain || 'plains');
  diagnostics.attacker.terrainMod = attackerTerrain.combatAtk || 1;
  diagnostics.defender.terrain = getTerrainDisplayName(opponent.terrain || 'plains');
  diagnostics.defender.terrainMod = defenderTerrain.combatDef || 1;

  return { attackerPower, defenderPower, diagnostics };
}

/**
 * Calculate distance penalty based on target focus
 * Returns percentage penalty (0-0.4 for distances 0-4)
 */
function calculateTargetDistance(targetFocus) {
  const distances = {
    fighters: combatCalc.COMBAT_LINES.FRONT,
    clerics: combatCalc.COMBAT_LINES.SECOND,
    rangers: combatCalc.COMBAT_LINES.THIRD,
    mages: combatCalc.COMBAT_LINES.BACK,
  };
  const distance = distances[targetFocus] || 0;
  return combatCalc.calculateDistancePenalty(distance);
}

/**
 * Apply one-unit-at-a-time combat hits.
 * Healthy troop counts stay aggregated in storage, but combat expands units in memory so
 * each attack damages one target and overkill does not spill into a pooled damage budget.
 */
function applyIndividualUnitAttacks(injuredTroops, targetKingdom, sourceKingdom, combatType, side, intensity, targetFocus) {
  const sourceEquipment = calculateEquipmentCoverage(sourceKingdom);
  const targetEquipment = calculateEquipmentCoverage(targetKingdom);
  const report = {
    damage: 0,
    attackCount: 0,
    sourceByType: {},
    deadTotal: 0,
    injuredTotal: 0,
    deadByType: {},
    injuredByType: {},
    weaponsLost: 0,
    armorLost: 0,
    weaponsLostQuality: 0,
    armorLostQuality: 0,
    weaponsLostByType: {},
    armorLostByType: {},
    criticalHits: 0,
    criticalHitsByType: {},
    criticalKills: 0,
  };
  const healthyTargetedByType = {};
  const attackers = buildIndividualAttackers(sourceKingdom, combatType, side, sourceEquipment);
  const safeIntensity = Math.max(0, intensity || 0);

  for (const attacker of attackers) {
    const attacks = getParticipatingAttackCount(attacker.count, safeIntensity);
    if (attacks <= 0 || attacker.dmg <= 0) continue;
    report.sourceByType[attacker.type] = (report.sourceByType[attacker.type] || 0) + attacks;

    for (let i = 0; i < attacks; i++) {
      const targetType = chooseHitTarget(targetKingdom, injuredTroops, combatType, targetFocus);
      if (!targetType) break;
      applySingleUnitHit(
        injuredTroops,
        targetKingdom,
        targetType,
        attacker.dmg,
        report,
        targetEquipment,
        healthyTargetedByType,
        attacker
      );
    }
  }

  return report;
}

function getParticipatingAttackCount(count, intensity) {
  if (count <= 0 || intensity <= 0) return 0;
  return Math.max(1, Math.min(count, Math.floor(count * intensity)));
}

function buildIndividualAttackers(kingdom, combatType, side, equipment = calculateEquipmentCoverage(kingdom)) {
  const happinessMult = calculateHappinessMult(kingdom.happiness !== undefined && kingdom.happiness !== null ? kingdom.happiness : 50);
  const attackers = [];
  const addAttacker = (troopType, count, roleMultiplier = 1.0, researchOverride = null) => {
    if (count <= 0) return;
    const category = getCombatCategoryForTroop(troopType);
    const level = parseTroopLevel(kingdom.troop_levels, troopType);
    const raceModifier = troopType === 'war_machines'
      ? getRaceBonus(kingdom, 'war_machines')
      : getTroopRaceModifier(kingdom, troopType, category);
    const research = researchOverride ?? getDamageResearchForTroop(kingdom, troopType, combatType, side, equipment);
    const dmg = combatCalc.calculateIndividualTroopDmg(troopType, research, level, raceModifier) * roleMultiplier * happinessMult;
    attackers.push({
      type: troopType,
      count,
      dmg,
      critChance: getCriticalChance(kingdom, troopType),
      critMultiplier: getCriticalMultiplier(troopType),
    });
  };

  if (combatType === 'military') {
    addAttacker('thralls', kingdom.thralls || 0, isVampireDayDefense(kingdom) && side === 'defender' ? 4.5 : 0.55);
    addAttacker('fighters', kingdom.fighters || 0, side === 'defender' ? 0.8 : 1.0);
    addAttacker('rangers', kingdom.rangers || 0, 0.7);
    addAttacker('mages', kingdom.mages || 0, side === 'defender' ? 1.5 : 2.5, side === 'defender' ? kingdom.res_defense_magic || 100 : kingdom.res_attack_magic || 100);
    addAttacker('clerics', kingdom.clerics || 0, CLERIC_COMBAT_DAMAGE_MULT);
    addAttacker('war_machines', calculateWarMachineCrew(kingdom).crewed, 1.0, kingdom.res_war_machines || 100);
  } else if (combatType === 'covert') {
    addAttacker('ninjas', kingdom.ninjas || 0);
    addAttacker('thieves', kingdom.thieves || 0);
  } else if (combatType === 'magic') {
    addAttacker('mages', kingdom.mages || 0, side === 'defender' ? 1.5 : 2.5, side === 'defender' ? kingdom.res_defense_magic || 100 : kingdom.res_attack_magic || 100);
  }

  return attackers;
}

function getCriticalChance(kingdom, troopType) {
  const base = CRIT_CONFIG[troopType]?.chance || 0.05;
  const level = parseTroopLevel(kingdom.troop_levels, troopType);
  const levelBonus = Math.min(0.10, Math.max(0, level - 10) * 0.0025);
  return Math.min(0.35, base + levelBonus);
}

function getCriticalMultiplier(troopType) {
  return CRIT_CONFIG[troopType]?.multiplier || 3.0;
}

function chooseHitTarget(kingdom, injuredTroops, combatType, targetFocus) {
  const priorities = getTargetPriorities(combatType, targetFocus);
  for (const troopType of priorities) {
    if ((kingdom[troopType] || 0) > 0) return troopType;
  }
  for (const troopType of priorities) {
    if ((injuredTroops[troopType] || []).some((troop) => troop.hp > 0)) return troopType;
  }
  return null;
}

function getTargetPriorities(combatType, targetFocus) {
  const military = ['thralls', 'fighters', 'rangers', 'clerics', 'mages', 'engineers', 'war_machines', 'ninjas', 'thieves'];
  const covert = ['ninjas', 'thieves', 'rangers', 'mages', 'clerics', 'thralls', 'fighters', 'engineers'];
  const magic = ['mages', 'clerics', 'rangers', 'thralls', 'fighters', 'engineers', 'war_machines'];
  const base = combatType === 'covert' ? covert : combatType === 'magic' ? magic : military;
  if (!targetFocus || !base.includes(targetFocus)) return base;
  return [targetFocus, ...base.filter((troopType) => troopType !== targetFocus)];
}

function applySingleUnitHit(injuredTroops, kingdom, troopType, damage, report, equipment, healthyTargetedByType, attacker) {
  const livingInjured = injuredTroops[troopType]?.find((troop) => troop.hp > 0);
  const crit = rollCriticalHit(attacker);
  const effectiveDamage = crit ? damage * attacker.critMultiplier : damage;
  report.damage += effectiveDamage;
  report.attackCount++;
  if (crit) {
    report.criticalHits++;
    report.criticalHitsByType[attacker.type] = (report.criticalHitsByType[attacker.type] || 0) + 1;
  }

  if ((kingdom[troopType] || 0) > 0) {
    const maxHp = combatCalc.calculateIndividualTroopHp(
      troopType,
      getEquippedArmorResearch(kingdom, troopType, equipment),
      parseTroopLevel(kingdom.troop_levels, troopType),
      getTroopRaceModifier(kingdom, troopType, getCombatCategoryForTroop(troopType))
    );
    let currentHp = Math.max(0, maxHp - effectiveDamage);
    const criticalKill = shouldCriticalKill(crit, currentHp, maxHp);
    if (criticalKill) currentHp = 0;
    const targetIndex = healthyTargetedByType[troopType] || 0;
    healthyTargetedByType[troopType] = targetIndex + 1;
    const hasWeapon = targetIndex < (equipment.weaponEquippedByType[troopType] || 0);
    const hasArmor = targetIndex < (equipment.armorEquippedByType[troopType] || 0);
    const weaponQuality = hasWeapon ? equipment.weaponsQualityResearch : 0;
    const armorQuality = hasArmor ? equipment.armorQualityResearch : 0;
    kingdom[troopType] = Math.max(0, kingdom[troopType] - 1);
    combatCalc.recordInjuredTroop(injuredTroops, troopType, currentHp, maxHp);
    const recorded = injuredTroops[troopType]?.[injuredTroops[troopType].length - 1];
    if (recorded) {
      recorded.battle_touched = true;
      if (criticalKill) recorded.critical_kill = true;
      if (hasWeapon) recorded.equipped_weapon = true;
      if (hasArmor) recorded.equipped_armor = true;
      if (weaponQuality > 0) recorded.weapon_quality = weaponQuality;
      if (armorQuality > 0) recorded.armor_quality = armorQuality;
    }
    recordHitOutcome(report, troopType, currentHp, hasWeapon, hasArmor, weaponQuality, armorQuality, true, criticalKill);
    return;
  }

  if (livingInjured) {
    livingInjured.battle_touched = true;
    livingInjured.hp = Math.max(0, livingInjured.hp - effectiveDamage);
    const criticalKill = shouldCriticalKill(crit, livingInjured.hp, livingInjured.max_hp);
    if (criticalKill) {
      livingInjured.hp = 0;
      livingInjured.critical_kill = true;
    }
    recordHitOutcome(
      report,
      troopType,
      livingInjured.hp,
      livingInjured.equipped_weapon === true,
      livingInjured.equipped_armor === true,
      livingInjured.weapon_quality || 0,
      livingInjured.armor_quality || 0,
      false,
      criticalKill
    );
  }
}

function reconcileDamageReport(report, injuredTroops) {
  report.deadTotal = 0;
  report.injuredTotal = 0;
  report.deadByType = {};
  report.injuredByType = {};
  report.criticalKills = 0;
  report.weaponsLost = 0;
  report.weaponsLostQuality = 0;
  report.weaponsLostByType = {};
  report.armorLost = 0;
  report.armorLostQuality = 0;
  report.armorLostByType = {};

  for (const [troopType, troops] of Object.entries(injuredTroops || {})) {
    for (const troop of troops || []) {
      if (!troop.battle_touched) continue;
      if (troop.hp <= 0) {
        report.deadTotal++;
        report.deadByType[troopType] = (report.deadByType[troopType] || 0) + 1;
        if (troop.critical_kill) report.criticalKills++;
        if (troop.equipped_weapon) {
          report.weaponsLost++;
          report.weaponsLostQuality += troop.weapon_quality || 0;
          report.weaponsLostByType[troopType] = (report.weaponsLostByType[troopType] || 0) + 1;
        }
        if (troop.equipped_armor) {
          report.armorLost++;
          report.armorLostQuality += troop.armor_quality || 0;
          report.armorLostByType[troopType] = (report.armorLostByType[troopType] || 0) + 1;
        }
      } else {
        report.injuredTotal++;
        report.injuredByType[troopType] = (report.injuredByType[troopType] || 0) + 1;
      }
    }
  }
}

function clearBattleMarkers(injuredTroops) {
  for (const troops of Object.values(injuredTroops || {})) {
    for (const troop of troops || []) {
      delete troop.battle_touched;
      delete troop.critical_kill;
    }
  }
}

function applyVampireReanimation(vampire, updates, enemyDamageReport, ownDamageReport) {
  const raisedByType = {};
  const enemyDeadByType = enemyDamageReport.deadByType || {};

  for (const [troopType, dead] of Object.entries(enemyDeadByType)) {
    if (troopType === 'war_machines') continue;
    const raised = Math.floor((dead || 0) * 0.35);
    if (raised <= 0) continue;
    const targetType = troopType === 'clerics' ? 'thralls' : troopType;
    raisedByType[targetType] = (raisedByType[targetType] || 0) + raised;
  }

  for (const [troopType, raised] of Object.entries(raisedByType)) {
    vampire[troopType] = Math.max(0, (vampire[troopType] || 0) + raised);
    updates[troopType] = vampire[troopType];
  }

  return {
    raisedByType,
    totalRaised: Object.values(raisedByType).reduce((sum, count) => sum + count, 0),
    enemyDead: enemyDamageReport.deadTotal || 0,
    ownDead: ownDamageReport.deadTotal || 0,
    rate: { enemy: 0.35, own: 0 },
  };
}

function rollCriticalHit(attacker) {
  return Math.random() < (attacker.critChance || 0);
}

function shouldCriticalKill(crit, currentHp, maxHp) {
  if (!crit) return false;
  if (currentHp <= 0) return true;
  const hpPercent = currentHp / Math.max(1, maxHp);
  if (hpPercent <= 0.25) return Math.random() < 0.65;
  if (hpPercent <= 0.50) return Math.random() < 0.25;
  return false;
}

function recordHitOutcome(report, troopType, currentHp, hasWeapon, hasArmor, weaponQuality, armorQuality, wasNewInjury, criticalKill = false) {
  if (currentHp <= 0) {
    report.deadTotal++;
    report.deadByType[troopType] = (report.deadByType[troopType] || 0) + 1;
    if (criticalKill) report.criticalKills++;
    if (hasWeapon) {
      report.weaponsLost++;
      report.weaponsLostQuality += weaponQuality || 0;
      report.weaponsLostByType[troopType] = (report.weaponsLostByType[troopType] || 0) + 1;
    }
    if (hasArmor) {
      report.armorLost++;
      report.armorLostQuality += armorQuality || 0;
      report.armorLostByType[troopType] = (report.armorLostByType[troopType] || 0) + 1;
    }
    return;
  }

  if (wasNewInjury) {
    report.injuredTotal++;
    report.injuredByType[troopType] = (report.injuredByType[troopType] || 0) + 1;
  }
}

function applyEquipmentStockpileLosses(updates, kingdom, damageReport) {
  const weaponsLost = damageReport.weaponsLost || 0;
  const armorLost = damageReport.armorLost || 0;
  if (weaponsLost > 0) {
    updates.weapons_stockpile = Math.max(0, (kingdom.weapons_stockpile || 0) - weaponsLost);
  }
  if (armorLost > 0) {
    updates.armor_stockpile = Math.max(0, (kingdom.armor_stockpile || 0) - armorLost);
  }
  if (weaponsLost > 0 || armorLost > 0) {
    const equipmentLevels = parseEquipmentLevels(kingdom);
    if (weaponsLost > 0) {
      equipmentLevels.weapons = reduceEquipmentProfile(kingdom, 'weapons', weaponsLost);
    }
    if (armorLost > 0) {
      equipmentLevels.armor = reduceEquipmentProfile(kingdom, 'armor', armorLost);
    }
    updates.equipment_levels = JSON.stringify(equipmentLevels);
  }
}

function awardLostEquipmentToDefender(updates, defender, attackerDamageReport, defenderDamageReport) {
  const weaponsRecovered = (attackerDamageReport.weaponsLost || 0) + (defenderDamageReport.weaponsLost || 0);
  const armorRecovered = (attackerDamageReport.armorLost || 0) + (defenderDamageReport.armorLost || 0);
  const equipmentLevels = parseJson(updates.equipment_levels, parseEquipmentLevels(defender));
  if (weaponsRecovered > 0) {
    updates.weapons_stockpile = (updates.weapons_stockpile ?? (defender.weapons_stockpile || 0)) + weaponsRecovered;
    equipmentLevels.weapons = diluteEquipmentProfile(
      equipmentLevels.weapons || getEquipmentProfile(defender, 'weapons'),
      updates.weapons_stockpile - weaponsRecovered,
      weaponsRecovered,
      (attackerDamageReport.weaponsLostQuality || 0) + (defenderDamageReport.weaponsLostQuality || 0)
    );
  }
  if (armorRecovered > 0) {
    updates.armor_stockpile = (updates.armor_stockpile ?? (defender.armor_stockpile || 0)) + armorRecovered;
    equipmentLevels.armor = diluteEquipmentProfile(
      equipmentLevels.armor || getEquipmentProfile(defender, 'armor'),
      updates.armor_stockpile - armorRecovered,
      armorRecovered,
      (attackerDamageReport.armorLostQuality || 0) + (defenderDamageReport.armorLostQuality || 0)
    );
  }
  if (weaponsRecovered > 0 || armorRecovered > 0) {
    updates.equipment_levels = JSON.stringify(equipmentLevels);
  }
}

/**
 * Apply wall damage from ladder engineers
 */
function applyWallDamage(attacker, defender) {
  const maxWallHp = combatCalc.calculateWallHp(defender.bld_walls || 0, defender.wall_defense_type || 'fortified');
  const hitChance = combatCalc.calculateEngineerHitChance(parseTroopLevel(attacker.troop_levels, 'engineers'));
  const hit = Math.random() < hitChance;

  if (hit) {
    const newWallHp = combatCalc.applyLadderDamage(defender.wall_hp || 0, maxWallHp);
    return (defender.wall_hp || 0) - newWallHp;
  }

  return 0;
}

/**
 * Execute ninja assassinations
 * Can target both injured and healthy troops
 */
function executeNinjaAssassinations(defenderInjured, defender, ninjaCount, ninjaLevel, defenderTroopLevels) {
  const assassinations = [];

  const targets = ['clerics', 'mages', 'rangers']; // Priority targets
  for (const target of targets) {
    if (assassinations.length >= ninjaCount) break;

    const successChance = combatCalc.calculateNinjaAssassinationChance(
      ninjaLevel,
      parseTroopLevel(defenderTroopLevels, target)
    );

    if (Math.random() < successChance) {
      assassinations.push({ target, success: true });

      // Target injured troops first, then healthy
      if (defenderInjured[target] && defenderInjured[target].length > 0) {
        defenderInjured[target].pop(); // Remove one injured troop
      } else if (defender[target] && defender[target] > 0) {
        defender[target]--; // Remove one healthy troop
      }
    }
  }

  return assassinations;
}

/**
 * Execute thief sabotage on war machines
 */
function executeThiefSabotage(thiefCount) {
  const sabotages = [];
  for (let i = 0; i < thiefCount; i++) {
    const reduction = combatCalc.calculateThiefSabotage();
    sabotages.push({ reduction });
  }
  return sabotages;
}

function calculateStructureDefensePower(kingdom) {
  const wallUpgrades = parseJson(kingdom.wall_upgrades, {});
  const defenseUpgrades = parseJson(kingdom.defense_upgrades, {});
  const towerUpgrades = parseJson(kingdom.tower_def_upgrades, {});
  const outpostUpgrades = parseJson(kingdom.outpost_upgrades, {});

  const wallRaceMult = config.WALL_STRENGTH_MULT?.[kingdom.race] || 1.0;
  const towerRaceMult = config.TOWER_DETECT_MULT?.[kingdom.race] || 1.0;
  const outpostRaceMult = config.OUTPOST_RANGER_MULT?.[kingdom.race] || 1.0;
  const defenseTierMult =
    (defenseUpgrades.citadel ? 1.15 : 1.0) *
    (defenseUpgrades.keep ? 1.10 : 1.0) *
    (defenseUpgrades.fortified ? 1.05 : 1.0);
  const wallUpgradeMult =
    (wallUpgrades.reinforced ? 1.25 : 1.0) *
    (wallUpgrades.battlements ? 1.10 : 1.0) *
    (wallUpgrades.fortress_walls ? 1.20 : 1.0);

  const wallHp = Math.max(0, kingdom.wall_hp || 0);
  const walls = Math.max(0, kingdom.bld_walls || 0);
  const wallBase = wallHp > 0 ? wallHp : combatCalc.calculateWallHp(walls, kingdom.wall_defense_type || 'fortified');
  const wallPower = Math.round(wallBase * 1.25 * wallRaceMult * wallUpgradeMult * defenseTierMult);

  const guardTowers = Math.max(0, kingdom.bld_guard_towers || 0);
  const towerPower = Math.round(
    guardTowers *
    75 *
    towerRaceMult *
    (towerUpgrades.arrow_slits ? 1.2 : 1.0) *
    (wallUpgrades.battlements ? 1.2 : 1.0)
  );

  const outposts = Math.max(0, kingdom.bld_outposts || 0);
  const rangersOnPatrol = Math.min(kingdom.rangers || 0, outposts * 20);
  const outpostPower = Math.round(
    (outposts * 45 + rangersOnPatrol * 10 * getTroopRaceModifier(kingdom, 'rangers', 'military')) *
    outpostRaceMult *
    (outpostUpgrades.ranger_station ? 1.25 : 1.0)
  );

  const castlePower = Math.round(Math.max(0, kingdom.bld_castles || 0) * 1500 * defenseTierMult);
  const ballistaSlots = walls > 0 ? Math.min(kingdom.ballistae || 0, Math.ceil(walls / 2)) : 0;
  const ballistaPower = Math.round(
    ballistaSlots *
    250 *
    ((kingdom.res_war_machines || 100) / 100) *
    getRaceBonus(kingdom, 'war_machines') *
    (wallUpgrades.fortress_walls ? 1.5 : wallUpgrades.battlements ? 1.2 : 1.0)
  );

  return {
    total: wallPower + towerPower + outpostPower + castlePower + ballistaPower,
    wallPower,
    towerPower,
    outpostPower,
    castlePower,
    ballistaPower,
    wallMachinePower: ballistaPower,
    wallHp,
    walls,
    wallRaceMult,
    wallUpgradeMult,
    defenseTierMult,
    ballistae: ballistaSlots,
    wallMachines: ballistaSlots,
  };
}

function buildCombatBudget(kingdom, combatType, side, happinessMultiplier, equipment = calculateEquipmentCoverage(kingdom)) {
  const budget = {
    side,
    race: kingdom.race,
    happinessMultiplier,
    hpByType: {},
    dmgByType: {},
    countByType: {},
    raceModifierByType: {},
    research: {
      armor: kingdom.res_armor || 100,
      weapons: kingdom.res_weapons || 100,
      war_machines: kingdom.res_war_machines || 100,
      attack_magic: kingdom.res_attack_magic || 100,
      defense_magic: kingdom.res_defense_magic || 100,
    },
    equipment,
    warMachines: calculateWarMachineCrew(kingdom),
    totalHp: 0,
    totalDmg: 0,
  };

  for (const troopType of TROOP_TYPES) {
    const count = kingdom[troopType] || 0;
    if (count <= 0) continue;

    const category = getCombatCategoryForTroop(troopType);
    const raceModifier = getTroopRaceModifier(kingdom, troopType, category);
    const level = parseTroopLevel(kingdom.troop_levels, troopType);
    const hp = combatCalc.calculateIndividualTroopHp(
      troopType,
      getEquippedArmorResearch(kingdom, troopType, equipment),
      level,
      raceModifier
    );
    const dmgResearch = getDamageResearchForTroop(kingdom, troopType, combatType, side, equipment);
    const dmg = combatCalc.calculateIndividualTroopDmg(
      troopType,
      dmgResearch,
      level,
      troopType === 'war_machines' ? getRaceBonus(kingdom, 'war_machines') : raceModifier
    );

    const thrallDayMult = troopType === 'thralls' && isVampireDayDefense(kingdom) ? 5.0 : 1.0;
    const effectiveCount = troopType === 'war_machines' ? budget.warMachines.crewed : count;
    budget.countByType[troopType] = count;
    budget.hpByType[troopType] = Math.round(hp * count * thrallDayMult);
    budget.dmgByType[troopType] = Math.round(dmg * effectiveCount * (troopType === 'thralls' && isVampireDayDefense(kingdom) ? 4.5 : 1.0));
    budget.raceModifierByType[troopType] = raceModifier;
    budget.totalHp += budget.hpByType[troopType];
  }

  return budget;
}

function getDamageResearchForTroop(kingdom, troopType, combatType, side, equipment = calculateEquipmentCoverage(kingdom)) {
  if (troopType === 'war_machines') return kingdom.res_war_machines || 100;
  if (troopType === 'mages' && combatType === 'magic') {
    return side === 'defender' ? kingdom.res_defense_magic || 100 : kingdom.res_attack_magic || 100;
  }
  if (troopType === 'mages') {
    return side === 'defender' ? kingdom.res_defense_magic || 100 : kingdom.res_attack_magic || 100;
  }
  return getEquippedWeaponResearch(kingdom, troopType, equipment);
}

function getCombatCategoryForTroop(troopType) {
  if (troopType === 'mages') return 'magic';
  if (troopType === 'ninjas' || troopType === 'thieves') return 'covert';
  return 'military';
}

function calculateEquipmentCoverage(kingdom) {
  const weaponsProfile = getEquipmentProfile(kingdom, 'weapons');
  const armorProfile = getEquipmentProfile(kingdom, 'armor');
  const equipment = {
    weaponsStockpile: Math.max(0, kingdom.weapons_stockpile || 0),
    armorStockpile: Math.max(0, kingdom.armor_stockpile || 0),
    weaponsQuality: weaponsProfile,
    armorQuality: armorProfile,
    weaponsQualityResearch: equipmentProfileToResearch(weaponsProfile),
    armorQualityResearch: equipmentProfileToResearch(armorProfile),
    weaponEquippedByType: {},
    armorEquippedByType: {},
    weaponCoverageByType: {},
    armorCoverageByType: {},
    totalWeaponUsers: 0,
    totalArmorUsers: 0,
    totalWeaponsEquipped: 0,
    totalArmorEquipped: 0,
  };

  let weaponsRemaining = equipment.weaponsStockpile;
  let armorRemaining = equipment.armorStockpile;

  for (const troopType of TROOP_TYPES) {
    const count = Math.max(0, kingdom[troopType] || 0);

    if (WEAPON_EQUIPPED_TYPES.includes(troopType)) {
      const equipped = Math.min(count, weaponsRemaining);
      weaponsRemaining -= equipped;
      equipment.weaponEquippedByType[troopType] = equipped;
      equipment.weaponCoverageByType[troopType] = count > 0 ? equipped / count : 0;
      equipment.totalWeaponUsers += count;
      equipment.totalWeaponsEquipped += equipped;
    }

    if (ARMOR_EQUIPPED_TYPES.includes(troopType)) {
      const equipped = Math.min(count, armorRemaining);
      armorRemaining -= equipped;
      equipment.armorEquippedByType[troopType] = equipped;
      equipment.armorCoverageByType[troopType] = count > 0 ? equipped / count : 0;
      equipment.totalArmorUsers += count;
      equipment.totalArmorEquipped += equipped;
    }
  }

  equipment.weaponCoverage = equipment.totalWeaponUsers > 0 ? equipment.totalWeaponsEquipped / equipment.totalWeaponUsers : 0;
  equipment.armorCoverage = equipment.totalArmorUsers > 0 ? equipment.totalArmorEquipped / equipment.totalArmorUsers : 0;
  return equipment;
}

function getEquippedWeaponResearch(kingdom, troopType, equipment) {
  if (!WEAPON_EQUIPPED_TYPES.includes(troopType)) return 0;
  return equipment.weaponsQualityResearch * (equipment.weaponCoverageByType[troopType] || 0);
}

function getEquippedArmorResearch(kingdom, troopType, equipment) {
  if (!ARMOR_EQUIPPED_TYPES.includes(troopType)) return 0;
  return equipment.armorQualityResearch * (equipment.armorCoverageByType[troopType] || 0);
}

function equipmentXpForLevel(level) {
  if (level <= 1) return 0;
  if (level <= 10) return level * 100;
  if (level <= 25) return level * 300;
  if (level <= 50) return level * 800;
  if (level <= 75) return level * 2000;
  return level * 5000;
}

function parseEquipmentLevels(kingdom) {
  return parseJson(kingdom.equipment_levels, {});
}

function getEquipmentProfile(kingdom, kind) {
  const equipmentLevels = parseEquipmentLevels(kingdom);
  const profile = equipmentLevels[kind];
  const configForKind = EQUIPMENT_CONFIG[kind];
  const count = Math.max(0, kingdom[configForKind.stockpile] || 0);
  if (profile && typeof profile === 'object') {
    return {
      level: Math.max(1, Number(profile.level) || 1),
      xp: Math.max(0, Number(profile.xp) || 0),
      count: Math.max(0, Number(profile.count) || count),
    };
  }

  return {
    level: Math.max(1, Math.floor((kingdom[configForKind.research] || 100) / 10)),
    xp: 0,
    count,
  };
}

function equipmentProfileToAbsoluteXp(profile) {
  return equipmentXpForLevel(profile.level) + (profile.xp || 0);
}

function equipmentProfileToResearch(profile) {
  const level = Math.max(1, profile.level || 1);
  const nextNeeded = equipmentXpForLevel(level + 1);
  const currentNeeded = equipmentXpForLevel(level);
  const span = Math.max(1, nextNeeded - currentNeeded);
  const progress = Math.max(0, Math.min(1, (profile.xp || 0) / span));
  return (level + progress) * 10;
}

function qualityResearchToAbsoluteXp(qualityResearch) {
  const qualityLevel = Math.max(1, qualityResearch / 10);
  const level = Math.max(1, Math.floor(qualityLevel));
  const progress = qualityLevel - level;
  const currentNeeded = equipmentXpForLevel(level);
  const nextNeeded = equipmentXpForLevel(level + 1);
  return Math.floor(currentNeeded + (nextNeeded - currentNeeded) * progress);
}

function profileFromAbsoluteXp(absoluteXp, count) {
  let level = 1;
  while (level < 100 && absoluteXp >= equipmentXpForLevel(level + 1)) level++;
  return {
    level,
    xp: Math.max(0, Math.floor(absoluteXp - equipmentXpForLevel(level))),
    count,
  };
}

function reduceEquipmentProfile(kingdom, kind, removedCount) {
  const profile = getEquipmentProfile(kingdom, kind);
  return {
    ...profile,
    count: Math.max(0, profile.count - removedCount),
  };
}

function diluteEquipmentProfile(existingProfile, existingCount, incomingCount, incomingQualityTotal) {
  const safeExistingCount = Math.max(0, existingCount || 0);
  const safeIncomingCount = Math.max(0, incomingCount || 0);
  const newCount = safeExistingCount + safeIncomingCount;
  if (newCount <= 0) return { level: 1, xp: 0, count: 0 };

  const existingAbsolute = equipmentProfileToAbsoluteXp(existingProfile);
  const incomingAverageQuality = safeIncomingCount > 0 ? incomingQualityTotal / safeIncomingCount : 10;
  const incomingAbsolute = qualityResearchToAbsoluteXp(incomingAverageQuality);
  const newAverageXp = Math.floor(
    ((existingAbsolute * safeExistingCount) + (incomingAbsolute * safeIncomingCount)) / newCount
  );
  return profileFromAbsoluteXp(newAverageXp, newCount);
}

function calculateWarMachineCrew(kingdom) {
  const owned = kingdom.war_machines || 0;
  const engineerLevel = parseTroopLevel(kingdom.troop_levels, 'engineers');
  const engineersAvailable = Math.max(0, kingdom.engineers || 0);
  const crewRequired = wmCrewRequired(kingdom.race, engineerLevel);
  const crewed = Math.min(owned, Math.floor(engineersAvailable / crewRequired));

  return {
    owned,
    crewed,
    inactive: Math.max(0, owned - crewed),
    engineersAvailable,
    engineerLevel,
    crewRequired,
  };
}

function wmCrewRequired(race, engineerLevel) {
  if (race === 'dwarf' && engineerLevel >= 25) return 1;
  return config.WM_CREW_REQUIRED?.[race] || 3;
}

/**
 * Apply cleric healing during combat to prevent lethality
 */
function applyClericHealing(injuredTroops, clericCount, clericLevel = 1) {
  const rescued = [];
  const count = Math.max(0, clericCount || 0);
  const level = Math.max(1, clericLevel || 1);
  const rescueChance = Math.min(0.65, 0.12 + (count / 1400) + (level / 220));
  let remaining = Math.max(0, Math.floor(count * 0.12));

  // Find dead or heavily injured troops and attempt battlefield triage.
  for (const troopType of Object.keys(injuredTroops)) {
    if (remaining <= 0) break;

    const troops = injuredTroops[troopType];
    for (let i = troops.length - 1; i >= 0 && remaining > 0; i--) {
      const troop = troops[i];
      const injuryState = combatCalc.getInjuryState(troop.hp, troop.max_hp);

      const eligible =
        troop.hp <= 0 ||
        injuryState === combatCalc.INJURY_STATES.HEAVILY_INJURED;
      const chance = troop.hp <= 0 ? rescueChance : rescueChance * 0.5;
      if (eligible && Math.random() < chance) {
        combatCalc.preventLethality(injuredTroops, troopType, i);
        rescued.push({ troopType, hp: troops[i].hp });
        remaining--;
      }
    }
  }

  return rescued;
}

/**
 * Helper: Get total living troops from kingdom + injured pool
 */
function getTotalLivingTroops(kingdom, injuredTroops) {
  let total = 0;
  const troopTypes = ['thralls', 'fighters', 'rangers', 'mages', 'clerics', 'ninjas', 'thieves', 'engineers', 'war_machines'];

  for (const troopType of troopTypes) {
    const healthy = kingdom[troopType] || 0;
    const injured = combatCalc.getLivingTroopCount(injuredTroops, troopType);
    total += healthy + injured;
  }

  return total;
}

/**
 * Helper: Parse troop level from JSON
 */
function parseTroopLevel(troopLevels, troopType) {
  if (troopType === 'thralls') return 1;
  try {
    const levels = typeof troopLevels === 'string' ? JSON.parse(troopLevels || '{}') : troopLevels || {};
    const entry = levels[troopType];
    if (!entry) return 1;
    if (typeof entry === 'number') return entry;
    if (typeof entry.level === 'number') return entry.level;
    return 1;
  } catch {
    return 1;
  }
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/**
 * Helper: Get race bonus
 */
function getRaceBonus(kingdom, category) {
  return config.RACE_BONUSES?.[kingdom.race]?.[category] || 1.0;
}

function getTroopRaceModifier(kingdom, troopType, fallbackCategory) {
  if (troopType === 'thralls') return 1.0;
  return config.TROOP_RACE_BONUS?.[kingdom.race]?.[troopType] || getRaceBonus(kingdom, fallbackCategory);
}

/**
 * Helper: Calculate combat multiplier from happiness
 */
function calculateHappinessMult(happiness) {
  const mult = 0.5 + (happiness / 120);
  return Math.max(0.5, Math.min(1.5, mult));
}

module.exports = {
  executeCombat,
  calculateCombatPower,
  calculateTargetDistance,
  applyIndividualUnitAttacks,
  applyWallDamage,
  executeNinjaAssassinations,
  executeThiefSabotage,
  applyClericHealing,
  calculateStructureDefensePower,
  buildCombatBudget,
  calculateWarMachineCrew,
  wmCrewRequired,
};
