#!/usr/bin/env node
/**
 * Narmir-shaped architecture acceptance gate.
 *
 * Runs the live definition-of-done checks:
 *   1. Command boundary (routes do not call forbidden engine mutators)
 *   2. Game-table validation (command types, scout/trek/terrain tables)
 *   3. Module smoke: CommandHandler, safeEmit, honesty modules load
 *
 * Usage: node scripts/architecture-acceptance.js
 *        npm run architecture:accept
 *
 * Exit 0 = architecture acceptance passed for the Narmir-shaped definition.
 * Does NOT imply production deploy.
 */

'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

// Guard against index.js re-growing into a boot-orchestration monolith again —
// it was ~172 lines before the A1 boot refactor (lib/bootstrap.js, lib/shutdown.js,
// lib/error-handlers.js single-owner). New boot concerns belong under lib/, not here.
const ENTRYPOINT_LINE_LIMIT = 60;

function checkEntrypointSize() {
  console.log('\n[entrypoint size]');
  const entrypoint = path.join(root, 'index.js');
  const lines = fs.readFileSync(entrypoint, 'utf8').split(/\r?\n/).length;
  if (lines > ENTRYPOINT_LINE_LIMIT) {
    console.error(`  FAIL: index.js is ${lines} lines (limit ${ENTRYPOINT_LINE_LIMIT}). New boot concerns go in lib/, not index.js.`);
    process.exit(1);
  }
  console.log(`  ok: index.js is ${lines} lines (limit ${ENTRYPOINT_LINE_LIMIT})`);
}

function runNode(scriptRel) {
  const script = path.join(root, scriptRel);
  const r = spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) {
    console.error(`architecture-acceptance: FAILED (${scriptRel} exit ${r.status})`);
    process.exit(r.status || 1);
  }
}

function smokeModules() {
  console.log('\n[module smoke]');
  const ch = require('../game/command-handler');
  if (!ch.COMMAND_TYPES || !ch.COMMAND_TYPES.length) {
    console.error('  FAIL: COMMAND_TYPES empty');
    process.exit(1);
  }
  console.log(`  ok: COMMAND_TYPES (${ch.COMMAND_TYPES.length})`);

  if (typeof ch.handle !== 'function' || typeof ch.assignRegion !== 'function') {
    console.error('  FAIL: CommandHandler missing handle/assignRegion');
    process.exit(1);
  }
  console.log('  ok: handle + assignRegion');

  const { safeEmit, prepareSocketPayload } = require('../game/safe-socket-emit');
  if (typeof safeEmit !== 'function' || typeof prepareSocketPayload !== 'function') {
    console.error('  FAIL: safe-socket-emit exports');
    process.exit(1);
  }
  console.log('  ok: safeEmit');

  // Honesty modules must load without elevation-only hard deps failing
  require('../game/passive-scout-finds');
  require('../game/epic-trek-discovery');
  require('../game/terrain-scout');
  require('../game/kingdom-discovery-resolve');
  require('../game/passive-resource-node-spawn');
  console.log('  ok: honesty modules load');
}

function main() {
  console.log('architecture-acceptance: Narmir-shaped definition of done');
  console.log(`cwd: ${root}`);

  runNode('scripts/check-command-boundary.js');
  runNode('scripts/validate-game-tables.js');
  smokeModules();
  checkEntrypointSize();

  console.log('\nPASSED: architecture acceptance (local; not a production deploy)');
  process.exit(0);
}

main();
