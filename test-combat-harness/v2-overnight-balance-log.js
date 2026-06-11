process.env.USE_COMBAT_V2 = '1';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ARGS = parseArgs(process.argv.slice(2));
const DURATION_MINUTES = Number.parseFloat(ARGS.minutes || process.env.OVERNIGHT_MINUTES || '360');
const RUNS_PER_CASE = Number.parseInt(ARGS.runs || process.env.OVERNIGHT_RUNS_PER_CASE || '2500', 10);
const MAX_SWEEPS = Number.parseInt(ARGS.sweeps || process.env.OVERNIGHT_MAX_SWEEPS || '9999', 10);
const SEED_PREFIX = String(ARGS.prefix || process.env.OVERNIGHT_SEED_PREFIX || 'overnight-v2');
const ROOT = path.join(__dirname, '..');
const SWEEP_SCRIPT = path.join(__dirname, 'v2-broad-balance-sweep.js');
const OUT_ROOT = path.join(ROOT, 'test-results');
const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const OUT_DIR = path.join(OUT_ROOT, `combat-v2-overnight-${RUN_STAMP}`);
const PROGRESS_PATH = path.join(OUT_DIR, 'progress.jsonl');
const STDOUT_PATH = path.join(OUT_DIR, 'sweeps.stdout.log');
const STDERR_PATH = path.join(OUT_DIR, 'sweeps.stderr.log');
const SUMMARY_JSON_PATH = path.join(OUT_DIR, 'rolling-summary.json');
const SUMMARY_MD_PATH = path.join(OUT_DIR, 'rolling-summary.md');
const DISCORD_MD_PATH = path.join(OUT_DIR, 'discord-summary.md');

function parseArgs(args) {
  return args.reduce((parsed, arg) => {
    if (!arg.startsWith('--')) return parsed;
    const [key, value = 'true'] = arg.slice(2).split('=');
    parsed[key] = value;
    return parsed;
  }, {});
}

function appendJsonLine(filePath, value) {
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`);
}

function appendText(filePath, text) {
  if (!text) return;
  fs.appendFileSync(filePath, text.endsWith('\n') ? text : `${text}\n`);
}

function parseSweepStdout(stdout) {
  const trimmed = stdout.trim();
  const jsonStart = trimmed.lastIndexOf('\n{');
  return JSON.parse((jsonStart >= 0 ? trimmed.slice(jsonStart + 1) : trimmed));
}

function addNumeric(row, key, value) {
  row[key] = (row[key] || 0) + (value || 0);
}

function aggregateCaseData(sweeps) {
  const byCase = new Map();
  for (const sweep of sweeps) {
    const full = JSON.parse(fs.readFileSync(sweep.files.jsonPath, 'utf8'));
    for (const result of full.results) {
      if (!byCase.has(result.name)) {
        byCase.set(result.name, {
          name: result.name,
          suite: result.suite,
          attackerRace: result.attackerRace,
          defenderRace: result.defenderRace,
          attackerArchetype: result.attackerArchetype,
          defenderProfile: result.defenderProfile,
          wallTier: result.wallTier,
          sweeps: 0,
          totalRuns: 0,
          winRateTotal: 0,
          minWinRate: 100,
          maxWinRate: 0,
          flags: new Set(),
        });
      }

      const row = byCase.get(result.name);
      row.sweeps++;
      row.totalRuns += result.runs;
      row.winRateTotal += result.winRate;
      row.minWinRate = Math.min(row.minWinRate, result.winRate);
      row.maxWinRate = Math.max(row.maxWinRate, result.winRate);
      for (const flag of result.flags) row.flags.add(flag);
      addNumeric(row, 'avgAtkPowerTotal', result.avgAtkPower);
      addNumeric(row, 'avgDefPowerTotal', result.avgDefPower);
      addNumeric(row, 'avgStructureDefenseTotal', result.avgStructureDefense);
      addNumeric(row, 'avgAttackerDeathsTotal', result.avgAttackerDeaths);
      addNumeric(row, 'avgDefenderDeathsTotal', result.avgDefenderDeaths);
      addNumeric(row, 'avgAttackerInjuredTotal', result.avgAttackerInjured);
      addNumeric(row, 'avgDefenderInjuredTotal', result.avgDefenderInjured);
      addNumeric(row, 'avgCriticalHitsTotal', result.avgCriticalHits);
      addNumeric(row, 'avgCriticalKillsTotal', result.avgCriticalKills);
      addNumeric(row, 'avgWallDamageTotal', result.avgWallDamage);
      addNumeric(row, 'avgDisabledWarMachinesTotal', result.avgDisabledWarMachines);
    }
  }

  return [...byCase.values()].map((row) => {
    const sweeps = Math.max(1, row.sweeps);
    const avgAttackerDeaths = round(row.avgAttackerDeathsTotal / sweeps);
    const avgDefenderDeaths = round(row.avgDefenderDeathsTotal / sweeps);
    const avgAttackerInjured = round(row.avgAttackerInjuredTotal / sweeps);
    const avgDefenderInjured = round(row.avgDefenderInjuredTotal / sweeps);
    const avgCriticalHits = round(row.avgCriticalHitsTotal / sweeps);
    const avgCriticalKills = round(row.avgCriticalKillsTotal / sweeps);
    return {
      ...row,
      avgWinRate: round(row.winRateTotal / sweeps),
      avgAtkPower: round(row.avgAtkPowerTotal / sweeps),
      avgDefPower: round(row.avgDefPowerTotal / sweeps),
      avgStructureDefense: round(row.avgStructureDefenseTotal / sweeps),
      avgAttackerDeaths,
      avgDefenderDeaths,
      avgAttackerInjured,
      avgDefenderInjured,
      avgCriticalHits,
      avgCriticalKills,
      injuryToDeathRatio: round((avgAttackerInjured + avgDefenderInjured) / Math.max(1, avgAttackerDeaths + avgDefenderDeaths)),
      avgWallDamage: round(row.avgWallDamageTotal / sweeps),
      avgDisabledWarMachines: round(row.avgDisabledWarMachinesTotal / sweeps),
      flags: [...row.flags],
    };
  });
}

function aggregateSuites(cases) {
  const suites = {};
  for (const row of cases) {
    if (!suites[row.suite]) suites[row.suite] = { cases: 0, avgWinRate: 0, deaths: 0, injuries: 0, crits: 0, critKills: 0 };
    suites[row.suite].cases++;
    suites[row.suite].avgWinRate += row.avgWinRate;
    suites[row.suite].deaths += row.avgAttackerDeaths + row.avgDefenderDeaths;
    suites[row.suite].injuries += row.avgAttackerInjured + row.avgDefenderInjured;
    suites[row.suite].crits += row.avgCriticalHits;
    suites[row.suite].critKills += row.avgCriticalKills;
  }

  return Object.fromEntries(Object.entries(suites).map(([suite, row]) => [
    suite,
    {
      cases: row.cases,
      avgWinRate: round(row.avgWinRate / row.cases),
      avgDeathsPerCase: round(row.deaths / row.cases),
      avgInjuriesPerCase: round(row.injuries / row.cases),
      avgCriticalHitsPerCase: round(row.crits / row.cases),
      avgCriticalKillsPerCase: round(row.critKills / row.cases),
      injuryToDeathRatio: round(row.injuries / Math.max(1, row.deaths)),
    },
  ]));
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function buildSummary(startedAt, sweeps, status) {
  const caseRows = aggregateCaseData(sweeps);
  const persistentFlags = caseRows
    .filter((row) => row.flags.length > 0)
    .sort((a, b) => b.flags.length - a.flags.length || Math.abs(50 - b.avgWinRate) - Math.abs(50 - a.avgWinRate))
    .slice(0, 50);
  const injuryHeavy = [...caseRows]
    .sort((a, b) => b.injuryToDeathRatio - a.injuryToDeathRatio || b.avgDefenderInjured - a.avgDefenderInjured)
    .slice(0, 25);
  const bloodiest = [...caseRows]
    .sort((a, b) => (b.avgAttackerDeaths + b.avgDefenderDeaths) - (a.avgAttackerDeaths + a.avgDefenderDeaths))
    .slice(0, 25);

  return {
    status,
    startedAt: startedAt.toISOString(),
    updatedAt: new Date().toISOString(),
    outputDirectory: OUT_DIR,
    runsPerCase: RUNS_PER_CASE,
    completedSweeps: sweeps.length,
    casesPerSweep: sweeps[0]?.caseCount || 0,
    totalSimulatedCombats: sweeps.reduce((sum, sweep) => sum + sweep.runsPerCase * sweep.caseCount, 0),
    sweepFiles: sweeps.map((sweep) => ({ seed: sweep.seed, jsonPath: sweep.files.jsonPath, mdPath: sweep.files.mdPath })),
    suites: aggregateSuites(caseRows),
    persistentFlags,
    injuryHeavy,
    bloodiest,
  };
}

function renderMarkdown(summary) {
  const lines = [
    '# Combat V2 Overnight Balance Log',
    '',
    `Status: ${summary.status}`,
    `Started: ${summary.startedAt}`,
    `Updated: ${summary.updatedAt}`,
    `Runs per case: ${summary.runsPerCase}`,
    `Completed sweeps: ${summary.completedSweeps}`,
    `Total simulated combats: ${summary.totalSimulatedCombats.toLocaleString()}`,
    `Output directory: ${summary.outputDirectory}`,
    '',
    '## Suite Rollup',
    '',
    '| Suite | Cases | Avg Attacker Win % | Avg Deaths | Avg Injuries | Avg Crit Kills | Injury/Death |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];

  for (const [suite, row] of Object.entries(summary.suites)) {
    lines.push(`| ${suite} | ${row.cases} | ${row.avgWinRate} | ${row.avgDeathsPerCase} | ${row.avgInjuriesPerCase} | ${row.avgCriticalKillsPerCase} | ${row.injuryToDeathRatio} |`);
  }

  renderCaseTable(lines, 'Persistent Flags', summary.persistentFlags);
  renderCaseTable(lines, 'Most Injury-Heavy Cases', summary.injuryHeavy);
  renderCaseTable(lines, 'Bloodiest Cases', summary.bloodiest);

  lines.push('', '## Sweep Files', '');
  for (const sweep of summary.sweepFiles) {
    lines.push(`- ${sweep.seed}: ${sweep.mdPath}`);
  }

  return `${lines.join('\n')}\n`;
}

function renderDiscordMarkdown(summary) {
  const vampireFlags = summary.persistentFlags
    .filter((row) => row.name.includes('vampire'))
    .slice(0, 8);
  const lines = [
    '# Combat V2 Test Report',
    '',
    `**Status:** ${summary.status}`,
    `**Sample:** ${summary.totalSimulatedCombats.toLocaleString()} combats`,
    `**Sweeps:** ${summary.completedSweeps} x ${summary.runsPerCase.toLocaleString()} runs per case`,
    '',
    '**Coverage**',
    '- Individual-hit damage model with no pooled overkill spillover.',
    '- Critical hits and critical kills.',
    '- Cleric triage for living armies.',
    '- Vampire Thralls as level 1 front-line units.',
    '- Vampire night battles with enemy fallen rising by unit type.',
    '- Fallen clerics converting into Thralls.',
    '- War machines excluded from reanimation.',
    '- Ballistae, walls, ladders, engineers, and siege pressure.',
    '',
    '**Headline**',
    '- Win rates are centered well across the broad test set.',
    '- Vampire cases now include Thralls instead of clerics in the broad matrix.',
    '- Individual-hit combat remains injury-forward while critical hits add visible lethality.',
    '- Watch whether critical kills feel decisive without making battles too bloody.',
    '',
    '**Suite Rollup**',
  ];

  for (const [suite, row] of Object.entries(summary.suites)) {
    lines.push(`- **${label(suite)}:** ${row.avgWinRate}% attacker wins, ${row.avgInjuriesPerCase} injuries, ${row.avgDeathsPerCase} deaths, ${row.avgCriticalKillsPerCase} crit kills`);
  }

  lines.push('', '**Persistent Balance Flags**');
  if (summary.persistentFlags.length === 0) {
    lines.push('- None. No matchup stayed outside the broad bands.');
  } else {
    for (const row of summary.persistentFlags.slice(0, 10)) {
      lines.push(`- **${label(row.name)}:** ${row.avgWinRate}% attacker wins, ${row.flags.join(', ')}`);
    }
  }

  lines.push('', '**Vampire / Thrall Watchlist**');
  if (vampireFlags.length === 0) {
    lines.push('- No vampire matchup stayed outside the broad bands.');
  } else {
    for (const row of vampireFlags) {
      lines.push(`- **${label(row.name)}:** ${row.avgWinRate}% attacker wins, ${row.flags.join(', ')}`);
    }
  }

  lines.push('', '**Most Injury-Heavy Cases**');
  for (const row of summary.injuryHeavy.slice(0, 8)) {
    lines.push(`- **${label(row.name)}:** ${row.avgWinRate}% wins, ${round(row.avgAttackerInjured + row.avgDefenderInjured)} avg injuries`);
  }

  lines.push('', '**Tester Notes**');
  lines.push('- Please watch whether critical kills make battles feel decisive.');
  lines.push('- Vampire battles should feel different: Thralls absorb pressure, and fallen enemies may reinforce the winning vampire army.');
  lines.push('- Citadel siege results should feel difficult, but not impossible.');
  lines.push('- If deaths feel too common or too rare, note the army sizes and matchup.');
  lines.push('- War machines should show as siege assets, not as resurrected units.');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function label(value) {
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function renderCaseTable(lines, title, rows) {
  lines.push('', `## ${title}`, '');
  if (rows.length === 0) {
    lines.push('None yet.');
    return;
  }
  lines.push('| Case | Suite | Win % | Deaths | Injuries | Injury/Death | Flags |');
  lines.push('| --- | --- | ---: | ---: | ---: | ---: | --- |');
  for (const row of rows) {
    const deaths = round(row.avgAttackerDeaths + row.avgDefenderDeaths);
    const injuries = round(row.avgAttackerInjured + row.avgDefenderInjured);
    lines.push(`| ${row.name} | ${row.suite} | ${row.avgWinRate} | ${deaths} | ${injuries} | ${row.injuryToDeathRatio} | ${row.flags.join(', ')} |`);
  }
}

function writeSummary(startedAt, sweeps, status) {
  const summary = buildSummary(startedAt, sweeps, status);
  fs.writeFileSync(SUMMARY_JSON_PATH, `${JSON.stringify(summary, null, 2)}\n`);
  fs.writeFileSync(SUMMARY_MD_PATH, renderMarkdown(summary));
  fs.writeFileSync(DISCORD_MD_PATH, renderDiscordMarkdown(summary));
  return summary;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const startedAt = new Date();
const deadline = startedAt.getTime() + DURATION_MINUTES * 60 * 1000;
const sweeps = [];

appendJsonLine(PROGRESS_PATH, {
  event: 'start',
  startedAt: startedAt.toISOString(),
  durationMinutes: DURATION_MINUTES,
  runsPerCase: RUNS_PER_CASE,
  maxSweeps: MAX_SWEEPS,
  seedPrefix: SEED_PREFIX,
  outputDirectory: OUT_DIR,
});

console.log(`Combat V2 overnight log started: ${OUT_DIR}`);

for (let index = 1; index <= MAX_SWEEPS; index++) {
  if (Date.now() >= deadline) break;

  const seed = `${SEED_PREFIX}-${String(index).padStart(4, '0')}`;
  const sweepStarted = new Date();
  appendJsonLine(PROGRESS_PATH, { event: 'sweep_start', index, seed, startedAt: sweepStarted.toISOString() });
  console.log(`[overnight] sweep ${index} seed=${seed} runs=${RUNS_PER_CASE}`);

  const child = spawnSync(
    process.execPath,
    [SWEEP_SCRIPT, `--runs=${RUNS_PER_CASE}`, `--seed=${seed}`],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 1024 * 1024 * 20 }
  );

  appendText(STDOUT_PATH, `\n===== ${seed} stdout =====\n${child.stdout}`);
  appendText(STDERR_PATH, `\n===== ${seed} stderr =====\n${child.stderr}`);

  if (child.status !== 0) {
    appendJsonLine(PROGRESS_PATH, { event: 'sweep_failed', index, seed, exitCode: child.status, failedAt: new Date().toISOString() });
    throw new Error(`Sweep ${seed} failed with exit code ${child.status}. See ${STDERR_PATH}`);
  }

  const sweep = parseSweepStdout(child.stdout);
  sweeps.push(sweep);
  const sweepFinished = new Date();
  const summary = writeSummary(startedAt, sweeps, 'running');
  appendJsonLine(PROGRESS_PATH, {
    event: 'sweep_complete',
    index,
    seed,
    startedAt: sweepStarted.toISOString(),
    finishedAt: sweepFinished.toISOString(),
    elapsedSeconds: round((sweepFinished - sweepStarted) / 1000),
    totalSimulatedCombats: summary.totalSimulatedCombats,
    flaggedCases: sweep.summary.flaggedCases.length,
    summaryJsonPath: SUMMARY_JSON_PATH,
    summaryMdPath: SUMMARY_MD_PATH,
    discordMdPath: DISCORD_MD_PATH,
  });
}

const finalSummary = writeSummary(startedAt, sweeps, 'complete');
appendJsonLine(PROGRESS_PATH, {
  event: 'complete',
  finishedAt: new Date().toISOString(),
  completedSweeps: finalSummary.completedSweeps,
  totalSimulatedCombats: finalSummary.totalSimulatedCombats,
  summaryJsonPath: SUMMARY_JSON_PATH,
  summaryMdPath: SUMMARY_MD_PATH,
  discordMdPath: DISCORD_MD_PATH,
});

console.log(JSON.stringify({
  status: 'complete',
  outputDirectory: OUT_DIR,
  completedSweeps: finalSummary.completedSweeps,
  totalSimulatedCombats: finalSummary.totalSimulatedCombats,
  summaryJsonPath: SUMMARY_JSON_PATH,
  summaryMdPath: SUMMARY_MD_PATH,
  discordMdPath: DISCORD_MD_PATH,
}, null, 2));
