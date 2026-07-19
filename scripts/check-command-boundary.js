#!/usr/bin/env node
/**
 * Architecture Slice A: Command boundary guard.
 *
 * Fails if player-facing kingdom routes (and auth/hero) call engine mutators
 * directly instead of CommandHandler. Allowlisted:
 *   - require() of engine only where needed for pure helpers (none expected
 *     after closeout in kingdom-*, auth, hero)
 *   - public.js bootstrap constants (not scanned)
 *   - comments
 *
 * Usage: node scripts/check-command-boundary.js
 *        npm run check:command-boundary
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROUTES_DIR = path.join(__dirname, '..', 'routes');

/** Files that must not call forbidden engine mutators */
const STRICT_FILES = [
  'kingdom-build.js',
  'kingdom-economy.js',
  'kingdom-exploration.js',
  'kingdom-forge.js',
  'kingdom-gameplay.js',
  'kingdom-prestige.js',
  'kingdom-profile.js',
  'kingdom-research.js',
  'kingdom-turn.js',
  'kingdom-warfare.js',
  'auth.js',
  'hero.js',
  'admin.js',
];

/**
 * Mutator / turn entry points that belong on CommandHandler.
 * Match on identifier call form after stripping comments roughly.
 */
const FORBIDDEN = [
  { re: /\bengine\.processTurn\s*\(/, name: 'engine.processTurn' },
  { re: /\bengine\.resolveMilitaryAttack\s*\(/, name: 'engine.resolveMilitaryAttack' },
  { re: /\bengine\.castSpell\s*\(/, name: 'engine.castSpell' },
  { re: /\bengine\.resolveExpeditions\s*\(/, name: 'engine.resolveExpeditions' },
  { re: /\bengine\.resolveResourceHarvests\s*\(/, name: 'engine.resolveResourceHarvests' },
  { re: /\bengine\.assignRegion\s*\(/, name: 'engine.assignRegion' },
  { re: /\bengine\.BUILDING_LAND_COST\b/, name: 'engine.BUILDING_LAND_COST' },
  { re: /\bengine\.HERO_CLASSES\b/, name: 'engine.HERO_CLASSES' },
  { re: /\bengine\.prestige\s*\(/, name: 'engine.prestige' },
  { re: /\bengine\.hireUnits\s*\(/, name: 'engine.hireUnits' },
  { re: /\bengine\.recruitHero\s*\(/, name: 'engine.recruitHero' },
];

function stripComments(src) {
  // Block comments then line comments (good enough for route files)
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function main() {
  const failures = [];

  for (const file of STRICT_FILES) {
    const full = path.join(ROUTES_DIR, file);
    if (!fs.existsSync(full)) {
      failures.push(`missing route file: ${file}`);
      continue;
    }
    const raw = fs.readFileSync(full, 'utf8');
    const code = stripComments(raw);
    const lines = code.split(/\r?\n/);

    // After closeout: no direct engine require in these files
    if (/\brequire\s*\(\s*['"]\.\.\/game\/engine['"]\s*\)/.test(code)) {
      failures.push(`${file}: still requires ../game/engine (use command-handler)`);
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const { re, name } of FORBIDDEN) {
        if (re.test(line)) {
          failures.push(`${file}:${i + 1}: forbidden ${name}`);
        }
      }
    }
  }

  if (failures.length) {
    console.error('check-command-boundary: FAILED');
    for (const f of failures) console.error(`  ${f}`);
    process.exit(1);
  }

  console.log('check-command-boundary: ok');
  console.log(`  scanned ${STRICT_FILES.length} route files; no forbidden engine mutators`);
  process.exit(0);
}

main();
