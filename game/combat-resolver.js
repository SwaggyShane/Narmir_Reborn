/**
 * Combat Resolver v2 - Comprehensive combat execution
 * Handles individual troop HP, walls, ladders, ninjas, thieves, clerics, war machines
 */

const combatCalc = require('./combat-new');

/**
 * Execute full combat between attacker and defender
 * Returns detailed results with injuries, wall damage, deaths, etc.
 */
async function executeCombat(db, attacker, defender, combatType, targetFocus, engineerLevel = 1) {
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
    },
  };

  // Parse current troop states
  const attackerInjured = combatCalc.parseInjuredTroops(attacker.injured_troops);
  const defenderInjured = combatCalc.parseInjuredTroops(defender.injured_troops);

  // Calculate combat power for attacker and defender
  const { attackerPower, defenderPower } = calculateCombatPower(attacker, defender, combatType);

  // Determine if attacker wins
  const distancePenalty = calculateTargetDistance(targetFocus);
  const adjustedAttackerPower = attackerPower * distancePenalty;
  const winChance = adjustedAttackerPower / (adjustedAttackerPower + defenderPower);

  result.win = Math.random() < winChance;
  result.outcome = result.win ? 'victory' : 'repelled';
  result.report.winChance = winChance;

  if (!result.win) {
    // Attacker repelled - apply defender casualties only
    const defenderCasualties = Math.floor(defenderPower * 0.02); // 2% casualties on repel
    applyDamageToTroops(defenderInjured, defender, defenderCasualties, result);
    result.report.defenderKilled = defenderCasualties;
  } else {
    // Attacker wins - apply both sides' casualties
    const attackerCasualties = Math.floor(adjustedAttackerPower * 0.05); // 5% attacker losses
    const defenderCasualties = Math.floor(adjustedAttackerPower * 0.15); // 15% defender losses

    applyDamageToTroops(attackerInjured, attacker, attackerCasualties, result);
    applyDamageToTroops(defenderInjured, defender, defenderCasualties, result);

    result.report.attackerKilled = attackerCasualties;
    result.report.defenderKilled = defenderCasualties;

    // Handle special mechanics on victory
    if (result.win) {
      // Wall damage from ladders
      if (defender.bld_walls > 0 && attacker.engineers > 0) {
        const wallDamage = applyWallDamage(defender);
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

      // Thief sabotage of war machines
      if (attacker.thieves > 0 && defender.war_machines > 0) {
        const sabotage = executeThiefSabotage(attacker.thieves);
        result.report.thiefSabotage = sabotage;
        // TODO: Apply war machine effectiveness reduction
      }
    }
  }

  // Apply cleric healing during combat (prevent lethality)
  if (result.win && attacker.clerics > 0) {
    const rescued = applyClericHealing(defenderInjured, attacker.clerics);
    result.report.clericRescues = rescued;
  }

  // Store injured troops in updates
  result.attackerUpdates.injured_troops = combatCalc.serializeInjuredTroops(attackerInjured);
  result.defenderUpdates.injured_troops = combatCalc.serializeInjuredTroops(defenderInjured);

  // Calculate total alive troops for summary
  result.report.attackerLiving = getTotalLivingTroops(attacker, attackerInjured);
  result.report.defenderLiving = getTotalLivingTroops(defender, defenderInjured);

  return result;
}

/**
 * Calculate combat power for a kingdom
 * Includes all troop types, research, morale, etc.
 * Restricts units based on combatType (military, covert, magic)
 */
function calculateCombatPower(kingdom, opponent, combatType) {
  const moraleMult = calculateMorale(kingdom.morale);
  const raceMil = getRaceBonus(kingdom.race, 'military');
  const raceMag = getRaceBonus(kingdom.race, 'magic');

  let power = 0;

  const weaponResearch = kingdom.res_weapons || 100;
  const armorResearch = kingdom.res_armor || 100;

  // Restrict units based on combat type
  if (combatType === 'military') {
    // Military: fighters, rangers, war machines
    if (kingdom.fighters > 0) {
      const troopLevel = parseTroopLevel(kingdom.troop_levels, 'fighters');
      const dmg = combatCalc.calculateIndividualTroopDmg('fighters', weaponResearch, troopLevel, raceMil);
      power += kingdom.fighters * dmg * moraleMult;
    }

    if (kingdom.rangers > 0) {
      const troopLevel = parseTroopLevel(kingdom.troop_levels, 'rangers');
      const dmg = combatCalc.calculateIndividualTroopDmg('rangers', weaponResearch, troopLevel, raceMil);
      power += kingdom.rangers * dmg * 0.7 * moraleMult;
    }

    if (kingdom.war_machines > 0) {
      const warMachineResearch = kingdom.res_war_machines || 100;
      const troopLevel = parseTroopLevel(kingdom.troop_levels, 'war_machines');
      const dmg = combatCalc.calculateIndividualTroopDmg('war_machines', warMachineResearch, troopLevel, 1.0);
      power += kingdom.war_machines * dmg;
    }
  } else if (combatType === 'covert') {
    // Covert: ninjas and thieves
    if (kingdom.ninjas > 0) {
      const troopLevel = parseTroopLevel(kingdom.troop_levels, 'ninjas');
      const dmg = combatCalc.calculateIndividualTroopDmg('ninjas', weaponResearch, troopLevel, raceMil);
      power += kingdom.ninjas * dmg * moraleMult;
    }

    if (kingdom.thieves > 0) {
      const troopLevel = parseTroopLevel(kingdom.troop_levels, 'thieves');
      const dmg = combatCalc.calculateIndividualTroopDmg('thieves', weaponResearch, troopLevel, raceMil);
      power += kingdom.thieves * dmg * moraleMult;
    }
  } else if (combatType === 'magic') {
    // Magic: mages only
    const attackMagicResearch = kingdom.res_attack_magic || 100;
    if (kingdom.mages > 0) {
      const troopLevel = parseTroopLevel(kingdom.troop_levels, 'mages');
      const dmg = combatCalc.calculateIndividualTroopDmg('mages', attackMagicResearch, troopLevel, raceMag);
      power += kingdom.mages * dmg * 2.5 * moraleMult;
    }
  }

  const attackerPower = power;

  // Defender side - uses same combat restrictions
  let defenderPower = 0;
  const defenseResearch = opponent.res_defense_magic || 100;
  const opponentWeaponResearch = opponent.res_weapons || 100;
  const opponentArmorResearch = opponent.res_armor || 100;
  const defenderMorale = calculateMorale(opponent.morale);

  if (combatType === 'military') {
    // Defender uses military troops
    if (opponent.fighters > 0) {
      const troopLevel = parseTroopLevel(opponent.troop_levels, 'fighters');
      const dmg = combatCalc.calculateIndividualTroopDmg('fighters', opponentWeaponResearch, troopLevel, getRaceBonus(opponent.race, 'military'));
      defenderPower += opponent.fighters * dmg * 0.8 * defenderMorale;
    }

    if (opponent.rangers > 0) {
      const troopLevel = parseTroopLevel(opponent.troop_levels, 'rangers');
      const dmg = combatCalc.calculateIndividualTroopDmg('rangers', opponentWeaponResearch, troopLevel, getRaceBonus(opponent.race, 'military'));
      defenderPower += opponent.rangers * dmg * 0.7 * defenderMorale;
    }

    if (opponent.war_machines > 0) {
      const warMachineResearch = opponent.res_war_machines || 100;
      const troopLevel = parseTroopLevel(opponent.troop_levels, 'war_machines');
      const dmg = combatCalc.calculateIndividualTroopDmg('war_machines', warMachineResearch, troopLevel, 1.0);
      defenderPower += opponent.war_machines * dmg * defenderMorale;
    }
  } else if (combatType === 'covert') {
    // Defender uses covert defense (less effective)
    if (opponent.ninjas > 0) {
      const troopLevel = parseTroopLevel(opponent.troop_levels, 'ninjas');
      const dmg = combatCalc.calculateIndividualTroopDmg('ninjas', opponentWeaponResearch, troopLevel, getRaceBonus(opponent.race, 'military'));
      defenderPower += opponent.ninjas * dmg * 0.5 * defenderMorale;
    }
  } else if (combatType === 'magic') {
    // Defender uses magic defense
    if (opponent.mages > 0) {
      const troopLevel = parseTroopLevel(opponent.troop_levels, 'mages');
      const dmg = combatCalc.calculateIndividualTroopDmg('mages', defenseResearch, troopLevel, getRaceBonus(opponent.race, 'magic'));
      defenderPower += opponent.mages * dmg * 1.5 * defenderMorale;
    }
  }

  // Walls always provide defense
  if (opponent.wall_hp && opponent.wall_hp > 0) {
    defenderPower += opponent.wall_hp * 0.1;
  }

  return { attackerPower, defenderPower };
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
 * Apply damage to troops, converting them to injured state
 * Decrements healthy troop counts and moves to injured pool
 */
function applyDamageToTroops(injuredTroops, kingdom, totalDamage, result) {
  let remaining = totalDamage;

  // Priority: Apply damage to all troop types
  const troopTypes = ['fighters', 'rangers', 'mages', 'clerics', 'ninjas', 'thieves', 'engineers', 'war_machines'];

  for (const troopType of troopTypes) {
    if (remaining <= 0) break;
    if (!kingdom[troopType] || kingdom[troopType] <= 0) continue;

    const base = combatCalc.TROOP_BASE_STATS[troopType];
    const avgHp = combatCalc.calculateIndividualTroopHp(
      troopType,
      kingdom.res_armor || 100,
      parseTroopLevel(kingdom.troop_levels, troopType),
      getRaceBonus(kingdom.race, 'military')
    );

    const troopsAffected = Math.min(kingdom[troopType], Math.ceil(remaining / avgHp));

    for (let i = 0; i < troopsAffected && remaining > 0; i++) {
      const damageToTroop = Math.min(remaining, avgHp);
      const currentHp = Math.max(0, avgHp - damageToTroop);

      injuredTroops = combatCalc.recordInjuredTroop(injuredTroops, troopType, currentHp, avgHp);
      remaining -= damageToTroop;
    }

    // Decrement healthy troop count to avoid duplication
    if (troopsAffected > 0) {
      kingdom[troopType] = Math.max(0, kingdom[troopType] - troopsAffected);
    }
  }

  return injuredTroops;
}

/**
 * Apply wall damage from ladder engineers
 */
function applyWallDamage(defender) {
  const maxWallHp = combatCalc.calculateWallHp(defender.bld_walls || 0, defender.wall_defense_type || 'fortified');
  const hitChance = combatCalc.calculateEngineerHitChance(defender.engineers || 1);
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

/**
 * Apply cleric healing during combat to prevent lethality
 */
function applyClericHealing(injuredTroops, clericCount) {
  const rescued = [];
  let remaining = clericCount;

  // Find heavily injured troops and heal them
  for (const troopType of Object.keys(injuredTroops)) {
    if (remaining <= 0) break;

    const troops = injuredTroops[troopType];
    for (let i = troops.length - 1; i >= 0 && remaining > 0; i--) {
      const troop = troops[i];
      const injuryState = combatCalc.getInjuryState(troop.hp, troop.max_hp);

      if (injuryState === combatCalc.INJURY_STATES.HEAVILY_INJURED || troop.hp <= 0) {
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
  const troopTypes = ['fighters', 'rangers', 'mages', 'clerics', 'ninjas', 'thieves', 'engineers', 'war_machines'];

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
  try {
    const levels = JSON.parse(troopLevels || '{}');
    return levels[troopType] || 1;
  } catch {
    return 1;
  }
}

/**
 * Helper: Get race bonus
 */
function getRaceBonus(race, category) {
  const bonuses = {
    dwarf: { construction: 1.2, economy: 1.2, war_machines: 1.25, military: 1.0 },
    high_elf: { magic: 1.3, research: 1.2, military: 0.9, economy: 1.05 },
    orc: { military: 1.25, fighters: 1.6, research: 0.8, magic: 0.7 },
    dark_elf: { stealth: 1.4, military: 0.9, economy: 0.9 },
    human: { military: 1.05, magic: 1.05, economy: 1.1 },
    dire_wolf: { fighters: 1.8, military: 1.2, economy: 0.7, magic: 0.6 },
  };
  return bonuses[race]?.[category] || 1.0;
}

/**
 * Helper: Calculate morale multiplier
 */
function calculateMorale(morale) {
  if (morale >= 80) return 1.3;
  if (morale >= 60) return 1.2;
  if (morale >= 40) return 1.1;
  if (morale >= 20) return 0.9;
  return 0.7;
}

module.exports = {
  executeCombat,
  calculateCombatPower,
  calculateTargetDistance,
  applyDamageToTroops,
  applyWallDamage,
  executeNinjaAssassinations,
  executeThiefSabotage,
  applyClericHealing,
};
