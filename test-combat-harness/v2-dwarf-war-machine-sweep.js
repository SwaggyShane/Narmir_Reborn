process.env.USE_COMBAT_V2 = '1';

const enginePath = require.resolve('../game/engine');
delete require.cache[enginePath];
const engine = require('../game/engine');

const RUNS_PER_CASE = 200;

function levels(overrides = {}) {
  return JSON.stringify({
    fighters: { level: 25 },
    rangers: { level: 25 },
    mages: { level: 25 },
    clerics: { level: 25 },
    thieves: { level: 25 },
    ninjas: { level: 25 },
    engineers: { level: 25 },
    war_machines: { level: 25 },
    ...overrides,
  });
}

function kingdom(overrides = {}) {
  return {
    id: 1,
    name: 'Kingdom',
    race: 'human',
    land: 1000,
    turn: 500,
    turns_stored: 400,
    level: 20,
    xp: 10000,
    xp_sources: '{}',
    troop_levels: levels(),
    happiness: 70,
    morale: 100,
    injured_troops: '{}',
    training_allocation: '{}',
    discovered_kingdoms: '{}',
    weapons_stockpile: 10000,
    armor_stockpile: 10000,
    ladders: 0,
    fighters: 1000,
    rangers: 250,
    mages: 100,
    clerics: 100,
    ninjas: 0,
    thieves: 0,
    engineers: 100,
    war_machines: 0,
    ballistae: 0,
    res_weapons: 150,
    res_armor: 150,
    res_military: 150,
    res_war_machines: 150,
    res_attack_magic: 150,
    res_defense_magic: 150,
    bld_walls: 0,
    wall_hp: 0,
    wall_defense_type: 'fortified',
    ...overrides,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function runCase(testCase) {
  const totals = {
    wins: 0,
    atkPower: 0,
    defPower: 0,
    attackerDeaths: 0,
    defenderDeaths: 0,
    wallDamage: 0,
    disabledWarMachines: 0,
    attackerCrewed: 0,
    attackerInactive: 0,
    defenderCrewed: 0,
    defenderInactive: 0,
    attackerInjured: 0,
    defenderInjured: 0,
  };

  for (let i = 0; i < RUNS_PER_CASE; i++) {
    const attacker = clone(testCase.attacker);
    const defender = clone(testCase.defender);
    const result = engine.resolveMilitaryAttack(attacker, defender, clone(testCase.sent));
    const attackerDamage = result.report.injuredTroops?.attacker || {};
    const defenderDamage = result.report.injuredTroops?.defender || {};
    const attackerCrew = result.report.diagnostics?.attacker?.warMachines || {};
    const defenderCrew = result.report.diagnostics?.defender?.warMachines || {};

    totals.wins += result.win ? 1 : 0;
    totals.atkPower += result.report.atkPower || 0;
    totals.defPower += result.report.defPower || 0;
    totals.attackerDeaths += result.report.attackerKilled || 0;
    totals.defenderDeaths += result.report.defenderKilled || 0;
    totals.wallDamage += result.report.wallDamage || 0;
    totals.disabledWarMachines += result.report.disabledWarMachines || 0;
    totals.attackerCrewed += attackerCrew.crewed || 0;
    totals.attackerInactive += attackerCrew.inactive || 0;
    totals.defenderCrewed += defenderCrew.crewed || 0;
    totals.defenderInactive += defenderCrew.inactive || 0;
    totals.attackerInjured += attackerDamage.injuredTotal || 0;
    totals.defenderInjured += defenderDamage.injuredTotal || 0;
  }

  return {
    name: testCase.name,
    runs: RUNS_PER_CASE,
    winRate: percent(totals.wins / RUNS_PER_CASE),
    avgAtkPower: avg(totals.atkPower),
    avgDefPower: avg(totals.defPower),
    avgAttackerDeaths: avg(totals.attackerDeaths),
    avgDefenderDeaths: avg(totals.defenderDeaths),
    avgAttackerInjured: avg(totals.attackerInjured),
    avgDefenderInjured: avg(totals.defenderInjured),
    avgWallDamage: avg(totals.wallDamage),
    avgDisabledWarMachines: avg(totals.disabledWarMachines),
    avgAttackerCrewed: avg(totals.attackerCrewed),
    avgAttackerInactive: avg(totals.attackerInactive),
    avgDefenderCrewed: avg(totals.defenderCrewed),
    avgDefenderInactive: avg(totals.defenderInactive),
    notes: testCase.notes,
  };
}

function avg(total) {
  return Math.round((total / RUNS_PER_CASE) * 100) / 100;
}

function percent(value) {
  return Math.round(value * 1000) / 10;
}

const baselineDefender = kingdom({
  id: 2,
  name: 'Baseline Human Defender',
  race: 'human',
  fighters: 1200,
  rangers: 250,
  mages: 100,
  clerics: 100,
  engineers: 100,
  war_machines: 0,
});

const walledDefender = kingdom({
  ...baselineDefender,
  name: 'Walled Human Defender',
  bld_walls: 100,
  wall_hp: 10000,
  wall_defense_type: 'fortified',
});

const machineDefender = kingdom({
  ...walledDefender,
  name: 'Ballista Wall Defender',
  engineers: 100,
  war_machines: 0,
  ballistae: 60,
});

const cases = [
  {
    name: 'human_baseline_vs_human_no_walls',
    notes: 'Control: no walls, no war-machine pressure.',
    attacker: kingdom({ id: 10, name: 'Human Attacker', race: 'human' }),
    defender: baselineDefender,
    sent: { fighters: 1000, rangers: 250, mages: 100, clerics: 100 },
  },
  {
    name: 'dwarf_no_machines_vs_human_no_walls',
    notes: 'Dwarf troop/race control without machines.',
    attacker: kingdom({ id: 11, name: 'Dwarf Attacker', race: 'dwarf' }),
    defender: baselineDefender,
    sent: { fighters: 1000, rangers: 250, mages: 100, clerics: 100 },
  },
  {
    name: 'dwarf_l24_60_machines_100_engineers_no_walls',
    notes: 'Level 24 dwarf: 2 engineers per machine, only 50 of 60 machines crewed.',
    attacker: kingdom({
      id: 12,
      name: 'Dwarf L24 Machines',
      race: 'dwarf',
      engineers: 100,
      war_machines: 60,
      troop_levels: levels({ engineers: { level: 24 } }),
    }),
    defender: baselineDefender,
    sent: { fighters: 1000, rangers: 250, mages: 100, clerics: 100, engineers: 100, warMachines: 60 },
  },
  {
    name: 'dwarf_l25_60_machines_100_engineers_no_walls',
    notes: 'Level 25 dwarf: solo crew, all 60 machines crewed.',
    attacker: kingdom({
      id: 13,
      name: 'Dwarf L25 Machines',
      race: 'dwarf',
      engineers: 100,
      war_machines: 60,
      troop_levels: levels({ engineers: { level: 25 } }),
    }),
    defender: baselineDefender,
    sent: { fighters: 1000, rangers: 250, mages: 100, clerics: 100, engineers: 100, warMachines: 60 },
  },
  {
    name: 'dwarf_l25_60_machines_vs_fortified_walls_no_ladders',
    notes: 'Checks whether wall HP dominates without ladder participation.',
    attacker: kingdom({
      id: 14,
      name: 'Dwarf L25 Machines No Ladders',
      race: 'dwarf',
      engineers: 100,
      war_machines: 60,
      troop_levels: levels({ engineers: { level: 25 } }),
    }),
    defender: walledDefender,
    sent: { fighters: 1000, rangers: 250, mages: 100, clerics: 100, engineers: 100, warMachines: 60 },
  },
  {
    name: 'dwarf_l25_60_machines_vs_fortified_walls_with_ladders',
    notes: 'Checks ladder/wall engagement with level-25 dwarf machines.',
    attacker: kingdom({
      id: 15,
      name: 'Dwarf L25 Machines Ladders',
      race: 'dwarf',
      engineers: 100,
      war_machines: 60,
      ladders: 50,
      troop_levels: levels({ engineers: { level: 25 } }),
    }),
    defender: walledDefender,
    sent: { fighters: 1000, rangers: 250, mages: 100, clerics: 100, engineers: 100, warMachines: 60, ladders: 50 },
  },
  {
    name: 'dwarf_l25_vs_walled_defender_ballistae_no_thieves',
    notes: 'Fixed defensive ballistae active; no mobile-machine sabotage.',
    attacker: kingdom({
      id: 16,
      name: 'Dwarf L25 No Thieves',
      race: 'dwarf',
      engineers: 100,
      war_machines: 60,
      ladders: 50,
      troop_levels: levels({ engineers: { level: 25 } }),
    }),
    defender: machineDefender,
    sent: { fighters: 1000, rangers: 250, mages: 100, clerics: 100, engineers: 100, warMachines: 60, ladders: 50 },
  },
  {
    name: 'dwarf_l25_vs_walled_defender_ballistae_with_thieves',
    notes: 'Same as above, with thieves present; ballistae are fixed defenses.',
    attacker: kingdom({
      id: 17,
      name: 'Dwarf L25 Thieves',
      race: 'dwarf',
      thieves: 100,
      engineers: 100,
      war_machines: 60,
      ladders: 50,
      troop_levels: levels({ engineers: { level: 25 }, thieves: { level: 25 } }),
    }),
    defender: machineDefender,
    sent: { fighters: 1000, rangers: 250, mages: 100, clerics: 100, thieves: 100, engineers: 100, warMachines: 60, ladders: 50 },
  },
];

const results = cases.map(runCase);
console.log(JSON.stringify({
  runsPerCase: RUNS_PER_CASE,
  generatedAt: new Date().toISOString(),
  results,
}, null, 2));
