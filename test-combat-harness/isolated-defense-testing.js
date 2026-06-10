/**
 * Isolated Defense Component Testing
 *
 * Tests each defensive component in isolation to identify which ones
 * are overpowered. Follows this progression:
 *
 * Phase A: Walls only (no towers/castles/outposts)
 * Phase B: Ladders vs walls (confirms ladders actually move win rates)
 * Phase C: Castles only (no walls/towers/outposts)
 * Phase D: Towers + outposts only
 * Phase E: Full defensive stack
 */

const engine = require('../game/engine');
const fs = require('fs');
const path = require('path');

const races = ['human', 'orc', 'dwarf', 'dark_elf', 'dire_wolf', 'ogre'];
const BATTLES_PER_MATCHUP = 20;

function mkTroops(units, lvl) {
  const out = {};
  for (const [unit, count] of Object.entries(units)) {
    if (count > 0) out[unit] = { level: lvl, xp: 0, count };
  }
  return JSON.stringify(out);
}

function buildKingdom(race, units, lvl, buildings, ladderCount = 0) {
  return {
    id: Math.random(),
    name: `${race}-kingdom`,
    race,
    turn: 500,
    land: 1000,
    happiness: 60,
    prestige_level: 0,

    // Units — attacker gets ladders if specified
    fighters:     units.fighters     || 0,
    rangers:      units.rangers      || 0,
    mages:        units.mages        || 0,
    war_machines: units.war_machines || 0,
    engineers:    units.engineers    || 0,
    clerics:      units.clerics      || 0,
    ninjas:       units.ninjas       || 0,
    thieves:      units.thieves      || 0,
    ladders:      ladderCount,           // ← KEY FIX: owned ladders = what you plan to send

    // Research at baseline
    res_weapons:       500,
    res_armor:         500,
    res_military:      500,
    res_attack_magic:  500,
    res_defense_magic: 500,
    res_war_machines:  500,

    // Stockpiles
    weapons_stockpile: units.fighters || 0,
    armor_stockpile:   units.fighters || 0,

    // Buildings
    bld_walls:        buildings.walls        || 0,
    bld_castles:      buildings.castles      || 0,
    bld_guard_towers: buildings.towers       || 0,
    bld_outposts:     buildings.outposts     || 0,
    wall_hp: (buildings.walls || 0) > 0 ? 100 : 0,

    troop_levels: mkTroops(units, lvl),
    heroes: [],

    // JSON fields
    fragment_bonuses:    '{}',
    milestone_bonuses:   '{}',
    alliance_buffs:      '{}',
    defense_upgrades:    '{}',
    wall_upgrades:       '{}',
    mausoleum_upgrades:  '{}',
    shrine_upgrades:     '{}',
    discovered_kingdoms: '{}',
    injured_troops:      '{}',
    active_effects:      '{}',
  };
}

function runBattles(atkRace, defRace, atkUnits, defUnits, lvl, defBuildings, atkLadders = 0) {
  const sent = {
    fighters:    atkUnits.fighters     || 0,
    rangers:     atkUnits.rangers      || 0,
    mages:       atkUnits.mages        || 0,
    warMachines: atkUnits.war_machines || 0,
    engineers:   atkUnits.engineers    || 0,
    clerics:     atkUnits.clerics      || 0,
    ninjas:      atkUnits.ninjas       || 0,
    thieves:     atkUnits.thieves      || 0,
    ladders:     atkLadders,
  };

  let wins = 0, totalAtkLoss = 0, totalDefLoss = 0;

  for (let i = 0; i < BATTLES_PER_MATCHUP; i++) {
    const atk = buildKingdom(atkRace, atkUnits, lvl, {}, atkLadders);
    const def = buildKingdom(defRace, defUnits, lvl, defBuildings);
    const result = engine.resolveMilitaryAttack(atk, def, sent, [], []);
    if (result.win) wins++;
    const r = result.report || {};
    totalAtkLoss += (r.atkFightersLost || 0) + (r.atkRangersLost || 0);
    totalDefLoss += (r.defFightersLost || 0) + (r.defRangersLost || 0);
  }

  return {
    winRate: (wins / BATTLES_PER_MATCHUP * 100).toFixed(1),
    avgAtkLoss: (totalAtkLoss / BATTLES_PER_MATCHUP).toFixed(1),
    avgDefLoss: (totalDefLoss / BATTLES_PER_MATCHUP).toFixed(1),
    casualtyRatio: totalAtkLoss > 0 ? (totalDefLoss / totalAtkLoss).toFixed(2) : 'N/A',
  };
}

function runPhase(label, description, atkUnits, defUnits, lvl, defBuildings, atkLadders = 0) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${label}: ${description}`);
  console.log(`  Attacker: ${JSON.stringify(atkUnits)}${atkLadders ? ` + ${atkLadders} ladders` : ''}`);
  console.log(`  Defender: ${JSON.stringify(defUnits)} + buildings: ${JSON.stringify(defBuildings)}`);
  console.log(`  Level: ${lvl} | ${BATTLES_PER_MATCHUP} battles per matchup`);
  console.log('='.repeat(60));

  const rows = [];
  let totalWins = 0, totalBattles = 0;

  for (const ar of races) {
    for (const dr of races) {
      const r = runBattles(ar, dr, atkUnits, defUnits, lvl, defBuildings, atkLadders);
      rows.push({ atk: ar, def: dr, ...r });
      totalWins += parseFloat(r.winRate);
      totalBattles++;
    }
    console.log('');
  }

  // Print table
  console.log(`${'Attacker'.padEnd(12)} ${'Defender'.padEnd(12)} ${'WinRate'.padEnd(9)} ${'AtkLoss'.padEnd(9)} ${'DefLoss'.padEnd(9)} Ratio`);
  console.log('-'.repeat(65));
  for (const row of rows) {
    console.log(
      `${row.atk.padEnd(12)} ${row.def.padEnd(12)} ${(row.winRate + '%').padEnd(9)} ${row.avgAtkLoss.padEnd(9)} ${row.avgDefLoss.padEnd(9)} ${row.casualtyRatio}x`
    );
  }

  const avgWinRate = (totalWins / totalBattles).toFixed(1);
  console.log(`\n→ Overall avg attacker win rate: ${avgWinRate}%`);
  const flag = avgWinRate > 35 && avgWinRate < 65 ? '✅ Balanced' : avgWinRate <= 35 ? '❌ Defense too strong' : '⚠️ Offense too strong';
  console.log(`→ ${flag}\n`);

  return rows;
}

async function runAllPhases() {
  console.log('ISOLATED DEFENSE COMPONENT TESTING');
  console.log('====================================\n');

  const baseAtk  = { fighters: 500 };
  const baseDef  = { fighters: 500 };
  const LVL = 50;

  // Phase A: No buildings at all (baseline)
  runPhase('Phase A', 'Baseline — no buildings',
    baseAtk, baseDef, LVL, { walls: 0, castles: 0, towers: 0, outposts: 0 });

  // Phase B: Walls only
  runPhase('Phase B', 'Walls only (10 walls, no ladders)',
    baseAtk, baseDef, LVL, { walls: 10, castles: 0, towers: 0, outposts: 0 });

  // Phase C: Ladders vs walls — confirms ladder bypass works
  runPhase('Phase C', 'Ladders vs walls (10 walls, 10 ladders)',
    { ...baseAtk }, baseDef, LVL, { walls: 10, castles: 0, towers: 0, outposts: 0 }, 10);

  // Phase D: Castles only
  runPhase('Phase D', 'Castles only (2 castles, no walls)',
    baseAtk, baseDef, LVL, { walls: 0, castles: 2, towers: 0, outposts: 0 });

  // Phase E: Towers + outposts only
  runPhase('Phase E', 'Guard towers + outposts only (10 towers, 10 outposts)',
    baseAtk, baseDef, LVL, { walls: 0, castles: 0, towers: 10, outposts: 10 });

  // Phase F: Full defensive stack
  runPhase('Phase F', 'Full stack (10 walls, 2 castles, 10 towers, 10 outposts)',
    baseAtk, baseDef, LVL, { walls: 10, castles: 2, towers: 10, outposts: 10 });

  // Phase G: Full stack with ladders
  runPhase('Phase G', 'Full stack + ladders (10 walls, 2 castles, 10 towers, 10 outposts + 10 ladders)',
    { ...baseAtk }, baseDef, LVL, { walls: 10, castles: 2, towers: 10, outposts: 10 }, 10);
}

runAllPhases().catch(console.error);
