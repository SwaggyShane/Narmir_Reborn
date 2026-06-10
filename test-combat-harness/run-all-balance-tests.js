/**
 * Combined Balance Test Runner
 *
 * Runs all three test harnesses and writes a single combined .md report:
 *   Phases 1-4: Fighters / Rangers / Mages at all levels (race vs race)
 *   Phases 5-8: War machines, ladders, defensive buildings
 *   Phases A-G: Isolated defensive component testing
 *
 * Usage (from project root):
 *   node test-combat-harness/run-all-balance-tests.js
 */

'use strict';

process.on('uncaughtException', (err) => {
  console.error('FATAL:', err.message);
  console.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
  process.exit(1);
});

const fs   = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

let AdvancedLevelTester, ExtendedLevelTester;
try {
  AdvancedLevelTester = require('./advanced-level-testing');
  ExtendedLevelTester = require('./advanced-level-testing-extended');
} catch (e) {
  console.error('Failed to load test modules:', e.message);
  process.exit(1);
}

async function runAll() {
  const startTime  = new Date();
  const timestamp  = startTime.toISOString().replace(/[:.]/g, '-');
  const outputDir  = path.join(__dirname, '..', 'test-results');
  const outputFile = path.join(outputDir, `combat-balance-full-${timestamp}.md`);

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  console.log('=== COMBINED BALANCE TEST RUNNER ===\n');

  // ── Phases 1-4 ────────────────────────────────────────────────────────────
  console.log('Running Phases 1-4: Unit levels & race combinations...');
  const basic = new AdvancedLevelTester();
  await basic.phase1_FightersOnly();
  await basic.phase2_FightersRangers();
  await basic.phase3_FullTroop();
  await basic.phase4_FullArmies();
  const basicMd = basic.buildMarkdownReport();
  console.log('  done\n');

  // ── Phases 5-8 ────────────────────────────────────────────────────────────
  console.log('Running Phases 5-8: War machines, ladders & buildings...');
  const extended = new ExtendedLevelTester();
  await extended.phase5_FightersWarMachines();
  await extended.phase6_LaddersVsWalls();
  await extended.phase7_DefensiveBuildings();
  await extended.phase8_FullCombat();
  const extendedMd = extended.buildMarkdownReport();
  console.log('  done\n');

  // ── Phases A-G ────────────────────────────────────────────────────────────
  console.log('Running Phases A-G: Isolated defense components...');
  const isolatedScript = path.join(__dirname, 'isolated-defense-testing.js');
  const result = spawnSync(process.execPath, [isolatedScript], {
    encoding: 'utf8',
    timeout: 180000,
  });
  const isolatedOutput = (result.stdout || '') + (result.stderr || '');
  if (result.status !== 0) {
    console.warn('  WARNING: isolated-defense-testing exited with code', result.status);
  }
  console.log('  done\n');

  // ── Build combined report ─────────────────────────────────────────────────
  const duration = ((new Date() - startTime) / 1000).toFixed(1);

  let combined  = `# Combat Balance Full Report\n\n`;
  combined     += `**Generated:** ${startTime.toISOString()}\n`;
  combined     += `**Duration:** ${duration}s\n\n`;
  combined     += `---\n\n`;
  combined     += basicMd;
  combined     += `\n\n---\n\n`;
  combined     += extendedMd;
  combined     += `\n\n---\n\n`;
  combined     += `# Isolated Defense Component Testing (Phases A-G)\n\n`;
  combined     += `\`\`\`\n${isolatedOutput.trim()}\n\`\`\`\n`;

  fs.writeFileSync(outputFile, combined, 'utf8');
  console.log(`Report saved to: test-results/combat-balance-full-${timestamp}.md`);
  console.log(`Done in ${duration}s`);
}

runAll().catch((err) => {
  console.error('ERROR:', err.message);
  console.error(err.stack);
  process.exit(1);
});
