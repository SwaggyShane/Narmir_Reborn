process.env.USE_COMBAT_V2 = '1';

const fs = require('fs');
const path = require('path');
const attunementManager = require('../game/attunement-manager');
const { SYNERGIES } = require('../game/fragment-synergies');
const FRAGMENT_BONUSES = require('../game/world-fragment-bonuses');

const ARGS = parseArgs(process.argv.slice(2));
const RUNS_PER_CASE = Number.parseInt(ARGS.runs || process.env.RUNS_PER_CASE || '100', 10);
const SEED = String(ARGS.seed || process.env.SWEEP_SEED || Date.now());
Math.random = createSeededRandom(SEED);

const enginePath = require.resolve('../game/engine');
delete require.cache[enginePath];
const engine = require('../game/engine');

const OUT_DIR = path.join(__dirname, '..', 'test-results');

const RACES = [
  'human',
  'dwarf',
  'high_elf',
  'orc',
  'dark_elf',
  'dire_wolf',
  'vampire',
  'ogre',
];

const WALL_TIERS = {
  none: {},
  light: {
    bld_walls: 40,
    wall_hp: 4000,
    bld_guard_towers: 4,
    bld_outposts: 4,
    wall_defense_type: 'stone',
  },
  fortified: {
    bld_walls: 100,
    wall_hp: 10000,
    bld_guard_towers: 10,
    bld_outposts: 10,
    wall_defense_type: 'fortified',
    wall_upgrades: JSON.stringify({ reinforced: true }),
  },
  citadel: {
    bld_walls: 250,
    wall_hp: 25000,
    bld_guard_towers: 30,
    bld_outposts: 30,
    bld_castles: 1,
    wall_defense_type: 'citadel',
    wall_upgrades: JSON.stringify({ reinforced: true, battlements: true, fortress_walls: true }),
    defense_upgrades: JSON.stringify({ fortified: true, keep: true, citadel: true }),
    tower_def_upgrades: JSON.stringify({ arrow_slits: true }),
    outpost_upgrades: JSON.stringify({ ranger_station: true }),
  },
};

const ARCHETYPES = {
  balanced: {
    units: { fighters: 1000, rangers: 250, mages: 100, clerics: 100, engineers: 100 },
    sent: { fighters: 1000, rangers: 250, mages: 100, clerics: 100, engineers: 100 },
  },
  fighter_heavy: {
    units: { fighters: 1500, rangers: 100, mages: 40, clerics: 80, engineers: 80 },
    sent: { fighters: 1500, rangers: 100, mages: 40, clerics: 80, engineers: 80 },
  },
  mage_heavy: {
    units: { fighters: 700, rangers: 150, mages: 300, clerics: 150, engineers: 80 },
    sent: { fighters: 700, rangers: 150, mages: 300, clerics: 150, engineers: 80 },
  },
  cleric_heavy: {
    units: { fighters: 850, rangers: 200, mages: 100, clerics: 300, engineers: 80 },
    sent: { fighters: 850, rangers: 200, mages: 100, clerics: 300, engineers: 80 },
  },
  covert_support: {
    units: { fighters: 850, rangers: 150, mages: 80, clerics: 80, thieves: 160, ninjas: 80, engineers: 80 },
    sent: { fighters: 850, rangers: 150, mages: 80, clerics: 80, thieves: 160, ninjas: 80, engineers: 80 },
  },
  siege: {
    units: {
      fighters: 900,
      rangers: 200,
      mages: 80,
      clerics: 100,
      thieves: 80,
      engineers: 160,
      war_machines: 80,
      ladders: 80,
    },
    sent: {
      fighters: 900,
      rangers: 200,
      mages: 80,
      clerics: 100,
      thieves: 80,
      engineers: 160,
      warMachines: 80,
      ladders: 80,
    },
  },
};

function levels(overrides = {}) {
  return JSON.stringify({
    fighters: { level: 25 },
    rangers: { level: 25 },
    mages: { level: 25 },
    clerics: { level: 25 },
    thralls: { level: 1 },
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
    name: 'Sweep Kingdom',
    race: 'human',
    land: 1000,
    turn: 500,
    turns_stored: 400,
    level: 20,
    xp: 10000,
    xp_sources: '{}',
    troop_levels: levels(),
    happiness: 100,
    injured_troops: '{}',
    training_allocation: '{}',
    discovered_kingdoms: '{}',
    weapons_stockpile: 10000,
    armor_stockpile: 10000,
    ladders: 0,
    thralls: 0,
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
    bld_guard_towers: 0,
    bld_outposts: 0,
    bld_castles: 0,
    wall_hp: 0,
    wall_defense_type: 'fortified',
    wall_upgrades: '{}',
    defense_upgrades: '{}',
    tower_def_upgrades: '{}',
    outpost_upgrades: '{}',
    ...overrides,
  };
}

function fragmentBonusesForSynergy(synergyId) {
  const synergy = SYNERGIES[synergyId];
  if (!synergy) {
    throw new Error(`Missing synergy: ${synergyId}`);
  }

  const fragmentBonuses = {};
  for (const [fragmentName, buildingType] of Object.entries(synergy.requiredFragments)) {
    const fragmentConfig = FRAGMENT_BONUSES[fragmentName]?.[buildingType];
    fragmentBonuses[buildingType] = {
      fragment: fragmentName,
      applied_turn: 1,
      passive: fragmentConfig?.passive || {},
      special: {
        name: fragmentConfig?.special?.name || '',
        desc: fragmentConfig?.special?.desc || '',
      },
    };
  }

  return fragmentBonuses;
}

function makeSynergyKingdom(synergyId, overrides = {}) {
  const kingdomState = kingdom({
    ...overrides,
    fragment_bonuses: JSON.stringify(fragmentBonusesForSynergy(synergyId)),
  });
  const activeSynergy = attunementManager.getActiveSynergy(kingdomState);
  if (!activeSynergy || activeSynergy.id !== synergyId) {
    throw new Error(`Failed to activate synergy ${synergyId}`);
  }
  return kingdomState;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function avg(total) {
  return Math.round((total / RUNS_PER_CASE) * 100) / 100;
}

function percent(value) {
  return Math.round(value * 1000) / 10;
}

function parseArgs(args) {
  return args.reduce((parsed, arg) => {
    if (!arg.startsWith('--')) return parsed;
    const [key, value = 'true'] = arg.slice(2).split('=');
    parsed[key] = value;
    return parsed;
  }, {});
}

function createSeededRandom(seedText) {
  let seed = 0;
  for (let i = 0; i < seedText.length; i++) {
    seed = (seed * 31 + seedText.charCodeAt(i)) >>> 0;
  }
  if (seed === 0) seed = 0x6d2b79f5;

  return function seededRandom() {
    seed += 0x6d2b79f5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function runCase(testCase) {
  const totals = {
    wins: 0,
    atkPower: 0,
    defPower: 0,
    attackerDeaths: 0,
    defenderDeaths: 0,
    attackerInjured: 0,
    defenderInjured: 0,
    criticalHits: 0,
    criticalKills: 0,
    wallDamage: 0,
    disabledWarMachines: 0,
    attackerCrewed: 0,
    attackerInactive: 0,
    defenderCrewed: 0,
    defenderInactive: 0,
    structureDefense: 0,
  };

  for (let i = 0; i < RUNS_PER_CASE; i++) {
    const attacker = clone(testCase.attacker);
    const defender = clone(testCase.defender);
    const result = engine.resolveMilitaryAttack(attacker, defender, clone(testCase.sent));
    const attackerDamage = result.report.injuredTroops?.attacker || {};
    const defenderDamage = result.report.injuredTroops?.defender || {};
    const attackerCrew = result.report.diagnostics?.attacker?.warMachines || {};
    const defenderCrew = result.report.diagnostics?.defender?.warMachines || {};
    const structureDefense = result.report.diagnostics?.defender?.structureDefense || {};

    totals.wins += result.win ? 1 : 0;
    totals.atkPower += result.report.atkPower || 0;
    totals.defPower += result.report.defPower || 0;
    totals.attackerDeaths += result.report.attackerKilled || 0;
    totals.defenderDeaths += result.report.defenderKilled || 0;
    totals.attackerInjured += attackerDamage.injuredTotal || 0;
    totals.defenderInjured += defenderDamage.injuredTotal || 0;
    totals.criticalHits += result.report.criticalHits || 0;
    totals.criticalKills += result.report.criticalKills || 0;
    totals.wallDamage += result.report.wallDamage || 0;
    totals.disabledWarMachines += result.report.disabledWarMachines || 0;
    totals.attackerCrewed += attackerCrew.crewed || 0;
    totals.attackerInactive += attackerCrew.inactive || 0;
    totals.defenderCrewed += defenderCrew.crewed || 0;
    totals.defenderInactive += defenderCrew.inactive || 0;
    totals.structureDefense += structureDefense.total || 0;
  }

  const winRate = percent(totals.wins / RUNS_PER_CASE);
  return {
    suite: testCase.suite,
    name: testCase.name,
    attackerRace: testCase.attacker.race,
    defenderRace: testCase.defender.race,
    attackerArchetype: testCase.attackerArchetype,
    defenderProfile: testCase.defenderProfile,
    wallTier: testCase.wallTier,
    runs: RUNS_PER_CASE,
    winRate,
    avgAtkPower: avg(totals.atkPower),
    avgDefPower: avg(totals.defPower),
    avgStructureDefense: avg(totals.structureDefense),
    avgAttackerDeaths: avg(totals.attackerDeaths),
    avgDefenderDeaths: avg(totals.defenderDeaths),
    avgAttackerInjured: avg(totals.attackerInjured),
    avgDefenderInjured: avg(totals.defenderInjured),
    avgCriticalHits: avg(totals.criticalHits),
    avgCriticalKills: avg(totals.criticalKills),
    avgWallDamage: avg(totals.wallDamage),
    avgDisabledWarMachines: avg(totals.disabledWarMachines),
    avgAttackerCrewed: avg(totals.attackerCrewed),
    avgAttackerInactive: avg(totals.attackerInactive),
    avgDefenderCrewed: avg(totals.defenderCrewed),
    avgDefenderInactive: avg(totals.defenderInactive),
    flags: flagsFor(winRate),
  };
}

function flagsFor(winRate) {
  const flags = [];
  if (winRate >= 75) flags.push('attacker_dominant');
  else if (winRate >= 65) flags.push('attacker_advantaged');
  if (winRate <= 25) flags.push('defender_dominant');
  else if (winRate <= 35) flags.push('defender_advantaged');
  return flags;
}

function makeAttacker(race, archetypeName) {
  const archetype = ARCHETYPES[archetypeName];
  const units = race === 'vampire'
    ? { ...archetype.units, thralls: (archetype.units.clerics || 0) + 250, clerics: 0 }
    : archetype.units;
  return kingdom({
    id: 100,
    name: `${race} ${archetypeName}`,
    race,
    __combatIsNight: true,
    ...units,
  });
}

function makeDefender(race, wallTier, profile = 'balanced') {
  const profileUnits = profile === 'machine_wall'
    ? { fighters: 1200, rangers: 250, mages: 100, clerics: 100, engineers: 120, war_machines: 0, ballistae: 80 }
    : { fighters: 1200, rangers: 250, mages: 100, clerics: 100, engineers: 120, war_machines: 0, ballistae: 0 };

  return kingdom({
    id: 200,
    name: `${race} ${wallTier} ${profile}`,
    race,
    __combatIsNight: true,
    ...profileUnits,
    ...(race === 'vampire' ? { thralls: profileUnits.clerics + 300, clerics: 0 } : {}),
    ...WALL_TIERS[wallTier],
  });
}

function addRaceMatrix(cases) {
  for (const attackerRace of RACES) {
    for (const defenderRace of RACES) {
      cases.push({
        suite: 'race_matrix_open_balanced',
        name: `${attackerRace}_balanced_vs_${defenderRace}_open`,
        attackerRace,
        defenderRace,
        attackerArchetype: 'balanced',
        defenderProfile: 'balanced',
        wallTier: 'none',
        attacker: makeAttacker(attackerRace, 'balanced'),
        defender: makeDefender(defenderRace, 'none'),
        sent: ARCHETYPES.balanced.sent,
      });
    }
  }
}

function addWallTierChecks(cases) {
  for (const attackerRace of RACES) {
    for (const wallTier of Object.keys(WALL_TIERS)) {
      cases.push({
        suite: 'wall_tier_checks',
        name: `${attackerRace}_siege_vs_human_${wallTier}`,
        attackerRace,
        defenderRace: 'human',
        attackerArchetype: 'siege',
        defenderProfile: 'balanced',
        wallTier,
        attacker: makeAttacker(attackerRace, 'siege'),
        defender: makeDefender('human', wallTier),
        sent: ARCHETYPES.siege.sent,
      });
    }
  }
}

function addArchetypeChecks(cases) {
  for (const attackerRace of RACES) {
    for (const attackerArchetype of Object.keys(ARCHETYPES)) {
      for (const defenderProfile of ['balanced', 'machine_wall']) {
        const wallTier = defenderProfile === 'machine_wall' ? 'fortified' : 'none';
        cases.push({
          suite: 'archetype_pressure_checks',
          name: `${attackerRace}_${attackerArchetype}_vs_human_${defenderProfile}`,
          attackerRace,
          defenderRace: 'human',
          attackerArchetype,
          defenderProfile,
          wallTier,
          attacker: makeAttacker(attackerRace, attackerArchetype),
          defender: makeDefender('human', wallTier, defenderProfile),
          sent: ARCHETYPES[attackerArchetype].sent,
        });
      }
    }
  }
}

function addSynergyChecks(cases) {
  cases.push({
    suite: 'fragment_synergy_checks',
    name: 'blessed_citadel_defender_vs_human_balanced',
    attackerRace: 'human',
    defenderRace: 'human',
    attackerArchetype: 'balanced',
    defenderProfile: 'blessed_citadel',
    wallTier: 'citadel',
    attacker: makeAttacker('human', 'balanced'),
    defender: makeSynergyKingdom('blessed-citadel', {
      id: 301,
      name: 'Blessed Citadel Defender',
      race: 'human',
      ...WALL_TIERS.citadel,
    }),
    sent: ARCHETYPES.balanced.sent,
  });

  cases.push({
    suite: 'fragment_synergy_checks',
    name: 'void_convergence_attacker_vs_human_balanced',
    attackerRace: 'human',
    defenderRace: 'human',
    attackerArchetype: 'void_convergence',
    defenderProfile: 'balanced',
    wallTier: 'none',
    attacker: makeSynergyKingdom('void-convergence', {
      id: 302,
      name: 'Void Convergence Attacker',
      race: 'dark_elf',
      fighters: 1200,
      rangers: 250,
      mages: 200,
      clerics: 100,
      engineers: 100,
      war_machines: 20,
      __combatIsNight: true,
    }),
    defender: makeDefender('human', 'none'),
    sent: { fighters: 1200, rangers: 250, mages: 200, clerics: 100, engineers: 100, warMachines: 20 },
  });

  cases.push({
    suite: 'fragment_synergy_checks',
    name: 'primordial_awakening_attacker_vs_human_balanced',
    attackerRace: 'human',
    defenderRace: 'human',
    attackerArchetype: 'primordial_awakening',
    defenderProfile: 'balanced',
    wallTier: 'none',
    attacker: makeSynergyKingdom('primordial-awakening', {
      id: 303,
      name: 'Primordial Awakening Attacker',
      race: 'orc',
      fighters: 1400,
      rangers: 200,
      mages: 150,
      clerics: 80,
      engineers: 80,
      war_machines: 30,
      __combatIsNight: true,
    }),
    defender: makeDefender('human', 'none'),
    sent: { fighters: 1400, rangers: 200, mages: 150, clerics: 80, engineers: 80, warMachines: 30 },
  });

  cases.push({
    suite: 'fragment_synergy_checks',
    name: 'infernal_crucible_war_machine_build_vs_human_balanced',
    attackerRace: 'dwarf',
    defenderRace: 'human',
    attackerArchetype: 'infernal_crucible',
    defenderProfile: 'balanced',
    wallTier: 'none',
    attacker: makeSynergyKingdom('infernal-crucible', {
      id: 304,
      name: 'Infernal Crucible Dwarf',
      race: 'dwarf',
      fighters: 1000,
      rangers: 250,
      mages: 100,
      clerics: 100,
      engineers: 100,
      war_machines: 60,
      troop_levels: levels({ engineers: { level: 25 } }),
      __combatIsNight: true,
    }),
    defender: makeDefender('human', 'none'),
    sent: { fighters: 1000, rangers: 250, mages: 100, clerics: 100, engineers: 100, warMachines: 60 },
  });
}

function summarize(results) {
  const bySuite = {};
  const byAttackerRace = {};
  const byDefenderRace = {};
  const flagged = [];

  for (const result of results) {
    addSummary(bySuite, result.suite, result.winRate);
    addSummary(byAttackerRace, result.attackerRace, result.winRate);
    addSummary(byDefenderRace, result.defenderRace, result.winRate);
    if (result.flags.length > 0) flagged.push(result);
  }

  return {
    bySuite: finishSummary(bySuite),
    byAttackerRace: finishSummary(byAttackerRace),
    byDefenderRace: finishSummary(byDefenderRace),
    flaggedCases: flagged
      .sort((a, b) => Math.abs(50 - b.winRate) - Math.abs(50 - a.winRate))
      .slice(0, 25)
      .map((result) => ({
        name: result.name,
        suite: result.suite,
        winRate: result.winRate,
        flags: result.flags,
        avgAtkPower: result.avgAtkPower,
        avgDefPower: result.avgDefPower,
      })),
  };
}

function addSummary(target, key, winRate) {
  if (!target[key]) target[key] = { count: 0, total: 0, min: 100, max: 0 };
  target[key].count++;
  target[key].total += winRate;
  target[key].min = Math.min(target[key].min, winRate);
  target[key].max = Math.max(target[key].max, winRate);
}

function finishSummary(summary) {
  return Object.fromEntries(Object.entries(summary).map(([key, value]) => [
    key,
    {
      cases: value.count,
      avgWinRate: Math.round((value.total / value.count) * 10) / 10,
      minWinRate: value.min,
      maxWinRate: value.max,
    },
  ]));
}

function writeReports(report) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(OUT_DIR, `combat-v2-broad-sweep-${stamp}.json`);
  const mdPath = path.join(OUT_DIR, `combat-v2-broad-sweep-${stamp}.md`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(mdPath, renderMarkdown(report));
  return { jsonPath, mdPath };
}

function renderMarkdown(report) {
  const lines = [
    '# Combat V2 Broad Balance Sweep',
    '',
    `Generated: ${report.generatedAt}`,
    `Runs per case: ${report.runsPerCase}`,
    `Seed: ${report.seed}`,
    `Total cases: ${report.caseCount}`,
    '',
    '## Suite Summary',
    '',
    '| Suite | Cases | Avg Attacker Win % | Min | Max |',
    '| --- | ---: | ---: | ---: | ---: |',
  ];

  for (const [suite, row] of Object.entries(report.summary.bySuite)) {
    lines.push(`| ${suite} | ${row.cases} | ${row.avgWinRate} | ${row.minWinRate} | ${row.maxWinRate} |`);
  }

  lines.push('', '## Attacker Race Summary', '');
  lines.push('| Race | Cases | Avg Attacker Win % | Min | Max |');
  lines.push('| --- | ---: | ---: | ---: | ---: |');
  for (const [race, row] of Object.entries(report.summary.byAttackerRace)) {
    lines.push(`| ${race} | ${row.cases} | ${row.avgWinRate} | ${row.minWinRate} | ${row.maxWinRate} |`);
  }

  lines.push('', '## Defender Race Summary', '');
  lines.push('| Race | Cases | Avg Attacker Win % | Min | Max |');
  lines.push('| --- | ---: | ---: | ---: | ---: |');
  for (const [race, row] of Object.entries(report.summary.byDefenderRace)) {
    lines.push(`| ${race} | ${row.cases} | ${row.avgWinRate} | ${row.minWinRate} | ${row.maxWinRate} |`);
  }

  lines.push('', '## Flagged Cases', '');
  if (report.summary.flaggedCases.length === 0) {
    lines.push('No cases crossed the broad anomaly bands.');
  } else {
    lines.push('| Case | Suite | Win % | Flags | Atk Power | Def Power |');
    lines.push('| --- | --- | ---: | --- | ---: | ---: |');
    for (const result of report.summary.flaggedCases) {
      lines.push(`| ${result.name} | ${result.suite} | ${result.winRate} | ${result.flags.join(', ')} | ${result.avgAtkPower} | ${result.avgDefPower} |`);
    }
  }

  lines.push('', '## Raw Data', '');
  lines.push('See the sibling JSON report for every case and metric.');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

const cases = [];
addRaceMatrix(cases);
addWallTierChecks(cases);
addArchetypeChecks(cases);
addSynergyChecks(cases);

const results = cases.map(runCase);
const report = {
  runsPerCase: RUNS_PER_CASE,
  seed: SEED,
  generatedAt: new Date().toISOString(),
  caseCount: cases.length,
  summary: summarize(results),
  results,
};

const files = writeReports(report);
console.log(JSON.stringify({
  runsPerCase: report.runsPerCase,
  seed: report.seed,
  caseCount: report.caseCount,
  generatedAt: report.generatedAt,
  files,
  summary: report.summary,
}, null, 2));
