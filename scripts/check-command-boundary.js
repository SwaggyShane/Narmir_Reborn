#!/usr/bin/env node
/**
 * Architecture Slice A: Command boundary guard.
 *
 * Fails if player-facing kingdom routes (and auth/hero/admin), or
 * game/sockets.js (A5-4, 2026-07-19 — previously unscanned entirely), call
 * engine mutators directly instead of CommandHandler. Allowlisted:
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

const ROOT_DIR = path.join(__dirname, '..');
const ROUTES_DIR = path.join(ROOT_DIR, 'routes');

/** Files under routes/ that must not call forbidden engine mutators */
const STRICT_FILES = [
  'kingdom-attunements.js',
  'kingdom-build.js',
  'kingdom-economy.js',
  'kingdom-exploration.js',
  'kingdom-forge.js',
  'kingdom-gameplay.js',
  'kingdom-prestige.js',
  'kingdom-profile.js',
  'kingdom-research.js',
  'kingdom-social.js',
  'kingdom-turn.js',
  'kingdom-warfare.js',
  'kingdom-worldmap.js',
  'auth.js',
  'hero.js',
  'admin.js',
  'admin-kingdoms.js',
  'admin-ai.js',
  'admin-events.js',
  'admin-lore.js',
  'admin-goals.js',
  'admin-config.js',
  'admin-audit.js',
];

/**
 * Files outside routes/ that must also not call forbidden engine mutators
 * (A5-4, 2026-07-19) — game/sockets.js used to bypass this check entirely,
 * calling engine.resolveMilitaryAttack/castSpell/covert* directly. Those
 * dead socket handlers were removed (A5-5); this scan is what would have
 * caught the gap in the first place, and now catches any regression.
 * Paths are relative to the repo root.
 */
const STRICT_FILES_ABSOLUTE = [
  'game/sockets.js',
];

/**
 * Mutator / turn entry points that belong on CommandHandler.
 * Match on identifier call form after stripping comments roughly.
 */
const FORBIDDEN = [
  { re: /\bengine\.processTurn\s*\(/, name: 'engine.processTurn' },
  { re: /\bengine\.resolveMilitaryAttack\s*\(/, name: 'engine.resolveMilitaryAttack' },
  { re: /\bengine\.castSpell\s*\(/, name: 'engine.castSpell' },
  { re: /\bengine\.covertSpy\s*\(/, name: 'engine.covertSpy' },
  { re: /\bengine\.covertLoot\s*\(/, name: 'engine.covertLoot' },
  { re: /\bengine\.covertAssassinate\s*\(/, name: 'engine.covertAssassinate' },
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

function scanFile(full, label, failures) {
  if (!fs.existsSync(full)) {
    failures.push(`missing file: ${label}`);
    return;
  }
  const raw = fs.readFileSync(full, 'utf8');
  const code = stripComments(raw);
  const lines = code.split(/\r?\n/);

  // After closeout: no direct engine require in these files. Match both
  // require forms — '../game/engine' (from routes/) and './engine' (from
  // within game/ itself, e.g. game/sockets.js).
  if (/\brequire\s*\(\s*['"](\.\.\/game\/engine|\.\/engine)['"]\s*\)/.test(code)) {
    failures.push(`${label}: still requires engine.js (use command-handler)`);
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { re, name } of FORBIDDEN) {
      if (re.test(line)) {
        failures.push(`${label}:${i + 1}: forbidden ${name}`);
      }
    }
  }
}

function main() {
  const failures = [];

  for (const file of STRICT_FILES) {
    scanFile(path.join(ROUTES_DIR, file), file, failures);
  }
  for (const relPath of STRICT_FILES_ABSOLUTE) {
    scanFile(path.join(ROOT_DIR, relPath), relPath, failures);
  }

  if (failures.length) {
    console.error('check-command-boundary: FAILED');
    for (const f of failures) console.error(`  ${f}`);
    process.exit(1);
  }

  const total = STRICT_FILES.length + STRICT_FILES_ABSOLUTE.length;
  console.log('check-command-boundary: ok');
  console.log(`  scanned ${total} files (${STRICT_FILES.length} routes/, ${STRICT_FILES_ABSOLUTE.length} other); no forbidden engine mutators`);
  process.exit(0);
}

main();
