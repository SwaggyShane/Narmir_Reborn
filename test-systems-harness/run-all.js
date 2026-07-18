#!/usr/bin/env node
'use strict';

/**
 * Comprehensive systems viability harness for Narmir Reborn.
 *
 * Layers:
 *   01  Endpoint inventory — every system has routes wired
 *   02  Module surface     — core game modules load + export API
 *   03  Engine commands    — combat, covert, spells, hire, turn, etc. via command-handler
 *   04  DB integration     — seed kingdoms, persist combat/covert/spell/turn/hire
 *   05  HTTP live          — optional; SYSTEMS_HTTP_BASE or --http
 *
 * Usage:
 *   npm run test:systems
 *   npm run test:systems -- --http
 *   SYSTEMS_HTTP_BASE=http://localhost:3000 npm run test:systems:http
 *   node test-systems-harness/run-all.js --only=03,04
 *   node test-systems-harness/lib/inventory.js
 */

const path = require('path');
const fs = require('fs');

// Load .env early
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}

const { SystemsReport } = require('./lib/report');

const SUITES = [
  require('./suites/01-endpoint-inventory'),
  require('./suites/02-module-surface'),
  require('./suites/03-engine-commands'),
  require('./suites/04-db-integration'),
  require('./suites/05-http-live'),
];

function parseArgs(argv) {
  const args = { http: false, only: null, help: false };
  for (const a of argv) {
    if (a === '--http') args.http = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else if (a.startsWith('--only=')) args.only = a.slice('--only=').length ? a.slice(7).split(',').map((s) => s.trim()) : null;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage: node test-systems-harness/run-all.js [--http] [--only=01,03]
  --http     Enable suite 05 against SYSTEMS_HTTP_BASE (default http://localhost:3000)
  --only=    Comma list of suite prefixes (01, 02, 03, 04, 05)
Env:
  DATABASE_URL         Required for suite 04
  SYSTEMS_HTTP_BASE    Base URL for suite 05
  USE_COMBAT_V2=1      Preferred for combat checks
`);
    process.exit(0);
  }

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     NARMIR REBORN — SYSTEMS VIABILITY HARNESS              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`  time: ${new Date().toISOString()}`);
  console.log(`  db:   ${process.env.DATABASE_URL ? 'DATABASE_URL set' : 'no DATABASE_URL (suite 04 skips)'}`);
  console.log(`  http: ${args.http || process.env.SYSTEMS_HTTP_BASE ? (process.env.SYSTEMS_HTTP_BASE || 'http://localhost:3000') : 'disabled'}`);

  const report = new SystemsReport();
  let suites = SUITES;
  if (args.only) {
    suites = SUITES.filter((s) => args.only.some((o) => s.name.startsWith(o) || s.name.includes(o)));
    if (!suites.length) {
      console.error('No suites matched --only');
      process.exit(2);
    }
  }

  for (const suite of suites) {
    try {
      await suite.run(report, { enabled: args.http || !!process.env.SYSTEMS_HTTP_BASE });
    } catch (err) {
      report.fail(suite.name, 'suite crashed', err.stack || err.message);
    }
  }

  const summary = report.printMatrix();

  // Write machine-readable report
  const outDir = path.join(__dirname, '..', 'logs');
  try {
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `systems-viability-${Date.now()}.json`);
    fs.writeFileSync(
      outFile,
      JSON.stringify(
        {
          ok: summary.ok,
          summary,
          results: report.results,
          at: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    console.log(`Report written: ${outFile}`);
  } catch (err) {
    console.warn('Could not write JSON report:', err.message);
  }

  process.exit(summary.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
