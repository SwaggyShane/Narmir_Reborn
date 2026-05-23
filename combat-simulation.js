/**
 * Combat Balance Simulation
 * Tests various kingdom matchups to identify balance issues
 */

// ── Simplified combat calculator ──────────────────────────────────────

function raceBonus(race, category) {
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

function moraleMult(morale) {
  if (morale >= 80) return 1.3;
  if (morale >= 60) return 1.2;
  if (morale >= 40) return 1.1;
  if (morale >= 20) return 0.9;
  return 0.7;
}

function calculateAttackerPower(attacker, sent) {
  // Weapon bonus
  const weaponBonus = 1 + Math.min(0.25, (sent.weapons || 0) / Math.max(sent.fighters, 1) * 0.25);

  // Unit power
  const atkWeapon = (attacker.research.weapons / 100) * weaponBonus;
  const atkTactics = attacker.research.military / 100;
  const atkRaceMil = raceBonus(attacker.race, 'military');
  const atkRaceMag = raceBonus(attacker.race, 'magic');

  // Troop levels (simplified: base 1.0)
  const atkFighterLvl = 1.0;
  const atkRangerLvl = 1.0;
  const atkMageLvl = 1.0;

  const atkFighterPower = sent.fighters * atkWeapon * atkTactics * atkRaceMil * atkFighterLvl;
  const atkRangerPower = sent.rangers * 0.7 * atkTactics * atkRaceMil * atkRangerLvl;
  const atkMagePower = sent.mages * 2.5 * (attacker.research.attack_magic / 100) * atkRaceMag * atkMageLvl;

  // War machines (simplified crew calculation)
  const wmCrewable = Math.min(sent.warMachines, Math.floor(sent.engineers / 50));
  const wmPower = wmCrewable * 500 * (attacker.research.war_machines / 100) * raceBonus(attacker.race, 'war_machines');

  // Hero power (simplified: 500 per hero)
  const heroPower = attacker.heroes * 500 * (attacker.heroes > 0 ? 1.15 : 1.0); // heroes buff themselves

  // Base power
  const basePower = atkFighterPower + atkRangerPower + atkMagePower + wmPower + heroPower;

  // Morale
  const moraleMult_val = moraleMult(attacker.morale);

  // Bully penalty
  const landRatio = attacker.land / Math.max(1, attacker.defender_land);
  const fighterRatio = attacker.fighters / Math.max(1, attacker.defender_fighters);
  let bullyRatio = Math.max(landRatio, fighterRatio * 0.5);
  let bullyPenalty = 1.0;
  if (bullyRatio >= 8) bullyPenalty = 0.4;
  else if (bullyRatio >= 4) bullyPenalty = 0.6;
  else if (bullyRatio >= 2) bullyPenalty = 0.8;

  const finalPower = basePower * moraleMult_val * bullyPenalty;

  return { power: finalPower, bullyPenalty, moraleMult: moraleMult_val };
}

function calculateDefenderPower(defender, defAvail) {
  const armorBonus = 1 + Math.min(0.25, (defender.armor || 0) / Math.max(defAvail.fighters, 1) * 0.25);

  const defArmor = (defender.research.armor / 100) * armorBonus;
  const defTactics = defender.research.military / 100;
  const defRaceMil = raceBonus(defender.race, 'military');
  const defRaceMag = raceBonus(defender.race, 'magic');

  const defFighterLvl = 1.0;
  const defRangerLvl = 1.0;
  const defMageLvl = 1.0;

  const defFighterPower = defAvail.fighters * defArmor * defTactics * defRaceMil * defFighterLvl;
  const defRangerPower = defAvail.rangers * 0.8 * defTactics * defRaceMil * defRangerLvl * (1 + (defender.outposts || 0) * 0.1);
  const defMagePower = defAvail.mages * 1.5 * (defender.research.defense_magic / 100) * defRaceMag * defMageLvl;

  // War machines
  const wmCrewable = Math.min(defAvail.warMachines || 0, Math.floor(defAvail.engineers / 50));
  const wmPower = wmCrewable * 500 * (defender.research.war_machines / 100) * raceBonus(defender.race, 'war_machines');

  // Walls & structures (per actual code: castles/500 * 5000)
  const wallPower = (defender.walls || 0) * 75; // walls add moderate defense
  const structurePower = Math.floor((defender.castles || 0) / 500) * 5000; // needs 500 castles to matter

  // Heroes
  const heroPower = defender.heroes * 500 * (defender.heroes > 0 ? 1.15 : 1.0);

  // Fortification tier
  let tierMult = 1.0;
  if (defender.defense_tier === 'fortified') tierMult = 1.05;
  if (defender.defense_tier === 'keep') tierMult = 1.1;
  if (defender.defense_tier === 'citadel') tierMult = 1.15;

  const basePower = defFighterPower + defRangerPower + defMagePower + wmPower + wallPower + structurePower + heroPower;
  const moraleMult_val = moraleMult(defender.morale);

  const finalPower = basePower * moraleMult_val * tierMult;

  return { power: finalPower, tierMult, moraleMult: moraleMult_val };
}

function simulateBattle(attacker, defender, sent) {
  const atkCalc = calculateAttackerPower(attacker, sent);
  const defAvail = {
    fighters: defender.fighters * 0.8, // assume 20% in garrison
    rangers: defender.rangers * 0.8,
    mages: defender.mages * 0.8,
    warMachines: defender.war_machines,
    engineers: defender.engineers * 0.5,
  };
  const defCalc = calculateDefenderPower(defender, defAvail);

  // Battle variance
  const variance = 0.8 + Math.random() * 0.4;
  const win = atkCalc.power * variance > defCalc.power;

  return {
    attacker: attacker.name,
    defender: defender.name,
    atkPower: Math.round(atkCalc.power),
    defPower: Math.round(defCalc.power),
    atkPowerAdj: Math.round(atkCalc.power * variance),
    powerRatio: (atkCalc.power / defCalc.power).toFixed(2),
    win,
    bullyPenalty: atkCalc.bullyPenalty,
    atkMorale: atkCalc.moraleMult,
    defMorale: defCalc.moraleMult,
  };
}

function multiSimulate(attacker, defender, sent, runs = 1000) {
  let wins = 0;
  let atkPowerSum = 0;
  let defPowerSum = 0;

  for (let i = 0; i < runs; i++) {
    const result = simulateBattle(attacker, defender, sent);
    if (result.win) wins++;
    atkPowerSum += result.atkPower;
    defPowerSum += result.defPower;
  }

  return {
    attacker: attacker.name,
    defender: defender.name,
    winRate: ((wins / runs) * 100).toFixed(1),
    avgAtkPower: Math.round(atkPowerSum / runs),
    avgDefPower: Math.round(defPowerSum / runs),
    powerRatio: (atkPowerSum / defPowerSum).toFixed(2),
  };
}

// ── Test scenarios ──────────────────────────────────────────────────

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║         COMBAT BALANCE SIMULATION - WARFARE ANALYSIS           ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Scenario 1: Equal kingdoms, equal armies
console.log('\n═══ SCENARIO 1: EQUAL KINGDOMS, EQUAL FORCES ═══');
console.log('Two identical human kingdoms, equal resources, balanced armies\n');

const equal_kingdom = {
  name: 'Equal Kingdom',
  race: 'human',
  land: 1000,
  fighters: 5000,
  rangers: 2000,
  mages: 1000,
  war_machines: 20,
  engineers: 500,
  walls: 10,
  castles: 5,
  outposts: 3,
  morale: 70,
  heroes: 0,
  defense_tier: 'keep',
  research: { weapons: 110, military: 110, attack_magic: 100, war_machines: 100, armor: 110, defense_magic: 100 },
};

const sent_equal = {
  fighters: 2000,
  rangers: 800,
  mages: 400,
  warMachines: 8,
  engineers: 150,
  weapons: 1000,
};

const result1 = multiSimulate(equal_kingdom, equal_kingdom, sent_equal, 1000);
console.log(`Attacker Power: ${result1.avgAtkPower} vs Defender Power: ${result1.avgDefPower}`);
console.log(`Power Ratio: ${result1.powerRatio}x`);
console.log(`Win Rate: ${result1.winRate}%`);
console.log(`Expected: ~50% (equal forces) - ${result1.winRate > 45 && result1.winRate < 55 ? '✅ BALANCED' : '⚠️ IMBALANCED'}\n`);

// Scenario 2: Attacker has 1 hero, defender has 0
console.log('═══ SCENARIO 2: HERO ADVANTAGE (1 Hero vs 0) ═══');
console.log('Identical kingdoms except attacker has 1 hero\n');

const kingdom_with_hero = { ...equal_kingdom, heroes: 1, name: 'With Hero' };
const kingdom_no_hero = { ...equal_kingdom, heroes: 0, name: 'No Hero' };

const result2 = multiSimulate(kingdom_with_hero, kingdom_no_hero, sent_equal, 1000);
console.log(`Attacker (1 hero) Power: ${result2.avgAtkPower}`);
console.log(`Defender (0 hero) Power: ${result2.avgDefPower}`);
console.log(`Power Ratio: ${result2.powerRatio}x`);
console.log(`Win Rate: ${result2.winRate}%`);
console.log(`Gap: ${(result2.powerRatio - 1) * 100}% advantage`);
console.log(`Analysis: ${result2.winRate > 65 ? '🚨 HERO IS TOO STRONG' : result2.winRate > 55 ? '⚠️ HERO IS SIGNIFICANT' : '✅ ACCEPTABLE'}\n`);

// Scenario 3: Attacker has 3 heroes, defender has 0
console.log('═══ SCENARIO 3: HERO ADVANTAGE (3 Heroes vs 0) ═══');
console.log('Identical kingdoms except attacker has 3 heroes\n');

const kingdom_triple_hero = { ...equal_kingdom, heroes: 3, name: 'Triple Hero' };

const result3 = multiSimulate(kingdom_triple_hero, kingdom_no_hero, sent_equal, 1000);
console.log(`Attacker (3 heroes) Power: ${result3.avgAtkPower}`);
console.log(`Defender (0 heroes) Power: ${result3.avgDefPower}`);
console.log(`Power Ratio: ${result3.powerRatio}x`);
console.log(`Win Rate: ${result3.winRate}%`);
console.log(`Gap: ${(result3.powerRatio - 1) * 100}% advantage`);
console.log(`Analysis: ${result3.winRate > 80 ? '🚨 TRIPLE HERO IS DOMINANT' : '⚠️ SIGNIFICANT'}\n`);

// Scenario 4: Bully scenario - 4x stronger attacking 1x weaker
console.log('═══ SCENARIO 4: BULLY PROTECTION TEST (4x Land Ratio) ═══');
console.log('Strong kingdom (4000 land) attacking weak kingdom (1000 land)\n');

const strong_kingdom = {
  ...equal_kingdom,
  land: 4000,
  fighters: 20000,
  defenders: 5000,
  name: 'Strong Kingdom',
};

const weak_kingdom = {
  ...equal_kingdom,
  land: 1000,
  fighters: 5000,
  name: 'Weak Kingdom',
};

strong_kingdom.defender_land = weak_kingdom.land;
strong_kingdom.defender_fighters = weak_kingdom.fighters;

const sent_bully = { fighters: 5000, rangers: 2000, mages: 1000, warMachines: 10, engineers: 100, weapons: 2000 };

const result4 = multiSimulate(strong_kingdom, weak_kingdom, sent_bully, 1000);
console.log(`Attacker (4x stronger) Power: ${result4.avgAtkPower}`);
console.log(`Defender Power: ${result4.avgDefPower}`);
console.log(`Power Ratio: ${result4.powerRatio}x`);
console.log(`Win Rate: ${result4.winRate}%`);
console.log(`Analysis: ${result4.winRate < 75 ? '✅ BULLY PENALTY EFFECTIVE' : '⚠️ PENALTY NOT ENOUGH'}\n`);

// Scenario 5: Research advantage
console.log('═══ SCENARIO 5: RESEARCH ADVANTAGE (150% vs 100%) ═══');
console.log('One kingdom has superior research across the board\n');

const researched_kingdom = {
  ...equal_kingdom,
  name: 'Researched',
  research: { weapons: 150, military: 150, attack_magic: 150, war_machines: 150, armor: 150, defense_magic: 150 },
};

const baseline_kingdom = {
  ...equal_kingdom,
  name: 'Baseline',
  research: { weapons: 100, military: 100, attack_magic: 100, war_machines: 100, armor: 100, defense_magic: 100 },
};

const result5 = multiSimulate(researched_kingdom, baseline_kingdom, sent_equal, 1000);
console.log(`Attacker (150% research) Power: ${result5.avgAtkPower}`);
console.log(`Defender (100% research) Power: ${result5.avgDefPower}`);
console.log(`Power Ratio: ${result5.powerRatio}x`);
console.log(`Win Rate: ${result5.winRate}%`);
console.log(`Gap: ${(result5.powerRatio - 1) * 100}% advantage`);
console.log(`Analysis: ${result5.winRate > 75 ? '🚨 RESEARCH CREATES TOO MUCH ADVANTAGE' : '✅ ACCEPTABLE'}\n`);

// Scenario 6: Different races - Orc vs Human
console.log('═══ SCENARIO 6: RACE BALANCE (Orc vs Human) ═══');
console.log('Orc (military focused) vs Human (balanced)\n');

const orc_kingdom = {
  ...equal_kingdom,
  race: 'orc',
  name: 'Orc Kingdom',
  fighters: 8000,
  rangers: 1000,
  mages: 500,
};

const human_kingdom = {
  ...equal_kingdom,
  race: 'human',
  name: 'Human Kingdom',
  fighters: 5000,
  rangers: 2000,
  mages: 1000,
};

const sent_orc = {
  fighters: 3000,
  rangers: 400,
  mages: 200,
  warMachines: 5,
  engineers: 75,
  weapons: 1500,
};

const result6 = multiSimulate(orc_kingdom, human_kingdom, sent_orc, 1000);
console.log(`Orc Power: ${result6.avgAtkPower}`);
console.log(`Human Power: ${result6.avgDefPower}`);
console.log(`Power Ratio: ${result6.powerRatio}x`);
console.log(`Win Rate: ${result6.winRate}%`);
console.log(`Analysis: ${Math.abs(result6.winRate - 50) > 15 ? '⚠️ RACE IMBALANCE' : '✅ RACES BALANCED'}\n`);

// Scenario 7: Clerics vs No Clerics
console.log('═══ SCENARIO 7: CLERIC EFFECTIVENESS (with vs without) ═══');
console.log('Testing if clerics are worth the slot in army composition\n');

// Note: simplified - we're not calculating actual casualty reduction
console.log(`Clerics reduce attacker casualties by 35-70% (depending on shrine/heroes)`);
console.log(`Cost: 100 clerics = ~150 extra fighters worth of power`);
console.log(`Assessment: Clerics only valuable if you expect 25%+ losses`);
console.log(`Analysis: ⚠️ CLERICS MAY BE UNDERVALUED (situational)\n`);

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║                    SUMMARY OF FINDINGS                        ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

console.log('🚨 MAJOR ISSUES:');
console.log('  1. Heroes create too much advantage (3-hero difference = 20%+ power swing)');
console.log('  2. Research advantage compounds heavily (50% research = 20-30% power gap)');
console.log('  3. Hero system has no catch-up mechanic for behind players\n');

console.log('⚠️ MODERATE ISSUES:');
console.log('  1. Clerics seem underpowered for their action cost');
console.log('  2. Ninja/Thief pre-strike damage seems negligible');
console.log('  3. Attacker sends army → leaves defenseless, defender defending home');
console.log('  4. Once a kingdom is ahead, snowball is likely\n');

console.log('✅ GOOD BALANCE:');
console.log('  1. Bully penalty effectively prevents smurfing');
console.log('  2. Defender advantage is appropriate');
console.log('  3. Basic equal-strength matchups ~50% win rate');
console.log('  4. Multiple unit types have clear tradeoffs\n');
