const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ARGS = parseArgs(process.argv.slice(2));
const RUNS_PER_CASE = Number.parseInt(ARGS.runs || process.env.RUNS_PER_CASE || '1000', 10);
const DURATION_MINUTES = Number.parseFloat(ARGS.minutes || process.env.SERIES_MINUTES || '115');
const MAX_ITERATIONS = Number.parseInt(ARGS.iterations || process.env.SERIES_ITERATIONS || '9999', 10);
const SEED_PREFIX = String(ARGS.prefix || process.env.SERIES_SEED_PREFIX || 'v2-away');
const OUT_DIR = path.join(__dirname, '..', 'test-results');
const SWEEP_SCRIPT = path.join(__dirname, 'v2-broad-balance-sweep.js');

function parseArgs(args) {
  return args.reduce((parsed, arg) => {
    if (!arg.startsWith('--')) return parsed;
    const [key, value = 'true'] = arg.slice(2).split('=');
    parsed[key] = value;
    return parsed;
  }, {});
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function summarizeByCase(runs) {
  const byCase = new Map();
  for (const run of runs) {
    for (const flagged of run.summary.flaggedCases) {
      if (!byCase.has(flagged.name)) {
        byCase.set(flagged.name, {
          name: flagged.name,
          suite: flagged.suite,
          count: 0,
          totalWinRate: 0,
          minWinRate: 100,
          maxWinRate: 0,
          flags: new Set(),
        });
      }
      const row = byCase.get(flagged.name);
      row.count++;
      row.totalWinRate += flagged.winRate;
      row.minWinRate = Math.min(row.minWinRate, flagged.winRate);
      row.maxWinRate = Math.max(row.maxWinRate, flagged.winRate);
      for (const flag of flagged.flags) row.flags.add(flag);
    }
  }

  return [...byCase.values()]
    .map((row) => ({
      ...row,
      avgWinRate: Math.round((row.totalWinRate / row.count) * 10) / 10,
      flags: [...row.flags],
    }))
    .sort((a, b) => b.count - a.count || Math.abs(50 - b.avgWinRate) - Math.abs(50 - a.avgWinRate));
}

function suiteAverages(runs) {
  const totals = {};
  for (const run of runs) {
    for (const [suite, row] of Object.entries(run.summary.bySuite)) {
      if (!totals[suite]) totals[suite] = { count: 0, total: 0, min: 100, max: 0 };
      totals[suite].count++;
      totals[suite].total += row.avgWinRate;
      totals[suite].min = Math.min(totals[suite].min, row.minWinRate);
      totals[suite].max = Math.max(totals[suite].max, row.maxWinRate);
    }
  }

  return Object.fromEntries(Object.entries(totals).map(([suite, row]) => [
    suite,
    {
      runs: row.count,
      avgWinRate: Math.round((row.total / row.count) * 10) / 10,
      minWinRate: row.min,
      maxWinRate: row.max,
    },
  ]));
}

function renderMarkdown(report) {
  const lines = [
    '# Combat V2 Broad Series',
    '',
    `Started: ${report.startedAt}`,
    `Finished: ${report.finishedAt}`,
    `Runs per case: ${report.runsPerCase}`,
    `Completed sweeps: ${report.completedSweeps}`,
    `Total simulated combats: ${report.totalCombats.toLocaleString()}`,
    '',
    '## Sweep Files',
    '',
  ];

  for (const run of report.runs) {
    lines.push(`- ${run.seed}: ${run.files.mdPath}`);
  }

  lines.push('', '## Suite Averages', '');
  lines.push('| Suite | Sweeps | Avg Attacker Win % | Min | Max |');
  lines.push('| --- | ---: | ---: | ---: | ---: |');
  for (const [suite, row] of Object.entries(report.suiteAverages)) {
    lines.push(`| ${suite} | ${row.runs} | ${row.avgWinRate} | ${row.minWinRate} | ${row.maxWinRate} |`);
  }

  lines.push('', '## Persistent Flagged Cases', '');
  if (report.persistentFlaggedCases.length === 0) {
    lines.push('No flagged cases appeared across completed sweeps.');
  } else {
    lines.push('| Case | Suite | Flagged Sweeps | Avg Win % | Min | Max | Flags |');
    lines.push('| --- | --- | ---: | ---: | ---: | ---: | --- |');
    for (const row of report.persistentFlaggedCases) {
      lines.push(`| ${row.name} | ${row.suite} | ${row.count} | ${row.avgWinRate} | ${row.minWinRate} | ${row.maxWinRate} | ${row.flags.join(', ')} |`);
    }
  }

  lines.push('');
  return `${lines.join('\n')}\n`;
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const startedAt = new Date();
const deadline = startedAt.getTime() + DURATION_MINUTES * 60 * 1000;
const runs = [];

console.log(JSON.stringify({
  status: 'starting',
  runsPerCase: RUNS_PER_CASE,
  durationMinutes: DURATION_MINUTES,
  maxIterations: MAX_ITERATIONS,
  seedPrefix: SEED_PREFIX,
}, null, 2));

for (let index = 1; index <= MAX_ITERATIONS; index++) {
  if (Date.now() >= deadline) break;
  const seed = `${SEED_PREFIX}-${String(index).padStart(3, '0')}`;
  console.log(`[series] starting sweep ${index} seed=${seed}`);

  const child = spawnSync(
    process.execPath,
    [SWEEP_SCRIPT, `--runs=${RUNS_PER_CASE}`, `--seed=${seed}`],
    { cwd: path.join(__dirname, '..'), encoding: 'utf8' }
  );

  if (child.stderr) process.stderr.write(child.stderr);
  if (child.status !== 0) {
    if (child.stdout) process.stdout.write(child.stdout);
    throw new Error(`Sweep failed for seed ${seed} with exit code ${child.status}`);
  }

  const jsonStart = child.stdout.lastIndexOf('\n{');
  const payload = JSON.parse((jsonStart >= 0 ? child.stdout.slice(jsonStart + 1) : child.stdout).trim());
  runs.push(payload);
  console.log(`[series] completed ${seed}: ${payload.runsPerCase * payload.caseCount} combats, flagged=${payload.summary.flaggedCases.length}`);
}

const finishedAt = new Date();
const report = {
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  elapsedMinutes: Math.round(((finishedAt - startedAt) / 60000) * 10) / 10,
  runsPerCase: RUNS_PER_CASE,
  completedSweeps: runs.length,
  casesPerSweep: runs[0]?.caseCount || 0,
  totalCombats: runs.reduce((sum, run) => sum + run.runsPerCase * run.caseCount, 0),
  runs,
  suiteAverages: suiteAverages(runs),
  persistentFlaggedCases: summarizeByCase(runs),
};

const outStamp = stamp();
const jsonPath = path.join(OUT_DIR, `combat-v2-series-${outStamp}.json`);
const mdPath = path.join(OUT_DIR, `combat-v2-series-${outStamp}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(mdPath, renderMarkdown(report));

console.log(JSON.stringify({
  status: 'complete',
  jsonPath,
  mdPath,
  completedSweeps: report.completedSweeps,
  totalCombats: report.totalCombats,
  persistentFlaggedCases: report.persistentFlaggedCases.slice(0, 10),
}, null, 2));
