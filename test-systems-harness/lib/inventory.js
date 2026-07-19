'use strict';

/**
 * Static endpoint inventory — scans routes/*.js for Express router handlers.
 * Maps game systems → required HTTP endpoints and reports gaps.
 */

const fs = require('fs');
const path = require('path');

const ROUTES_DIR = path.join(__dirname, '..', '..', 'routes');

/** System → required method+path pairs (path relative to mount prefix). */
const SYSTEM_ENDPOINTS = {
  auth: [
    ['POST', '/register'],
    ['POST', '/login'],
    ['POST', '/logout'],
    ['GET', '/me'],
  ],
  combat: [
    ['POST', '/attack'],
    ['GET', '/war-log'],
    ['GET', '/defense/overview'],
  ],
  spells: [
    ['POST', '/spell'],
  ],
  covert: [
    ['POST', '/covert'],
    ['GET', '/spy-reports'],
  ],
  economy: [
    ['GET', '/market/prices'],
    ['POST', '/market/buy'],
    ['POST', '/market/sell'],
    ['POST', '/economy/bank-deposit'],
    ['POST', '/economy/bank-withdraw'],
    ['GET', '/economy/overview'],
    ['POST', '/economy/hire-mercs'],
    ['GET', '/trade-routes/list'],
  ],
  build: [
    ['POST', '/build'],
    ['POST', '/build-queue'],
    ['POST', '/demolish'],
    ['POST', '/training-allocation'],
  ],
  research: [
    ['POST', '/research'],
    ['POST', '/research-allocation'],
    ['POST', '/select-school'],
    ['GET', '/studies/overview'],
  ],
  turn: [
    ['POST', '/turn'],
  ],
  hire: [
    ['POST', '/hire'],
  ],
  exploration: [
    ['POST', '/expedition/start'],
    ['GET', '/expedition/list'],
    ['POST', '/expedition/hunting'],
    ['POST', '/expedition/prospecting'],
    ['POST', '/expedition/land-expansion'],
    ['POST', '/expedition/epic-trek'],
    ['GET', '/goals'],
  ],
  heroes: [
    ['GET', '/list'],
    ['GET', '/classes'],
    ['POST', '/recruit'],
  ],
  profile: [
    ['GET', '/me'],
    ['GET', '/rankings'],
  ],
  alliance: [
    ['GET', '/list'],
    ['GET', '/my'],
    ['POST', '/create'],
  ],
  forum: [
    ['GET', '/index'],
    ['GET', '/boards'],
  ],
  messages: [
    ['GET', '/'],
    ['POST', '/'],
  ],
  bounties: [
    ['GET', '/bounties'],
    ['POST', '/bounties'],
  ],
  defense: [
    ['GET', '/defense/overview'],
    ['POST', '/fire'],
  ],
  attunements: [
    ['GET', '/attunements'],
    ['GET', '/available-attunements'],
    ['POST', '/attune-fragment'],
  ],
  synergies: [
    ['GET', '/synergy-status'],
    ['POST', '/activate-synergy-ability'],
  ],
  happiness: [
    ['GET', '/happiness-status'],
  ],
  forge: [
    ['POST', '/smithy/forge-tools'],
    ['POST', '/smithy/buy-hammers'],
  ],
  admin: [
    ['GET', '/kingdoms'],
    ['GET', '/stats'],
    ['POST', '/test-kingdoms/setup'],
  ],
};

/** Mount prefixes used in lib/setup-routes.js (best-effort mapping for docs). */
const FILE_MOUNT = {
  'auth.js': '/api/auth',
  'kingdom.js': '/api/kingdom',
  'kingdom-build.js': '/api/kingdom',
  'kingdom-warfare.js': '/api/kingdom',
  'kingdom-economy.js': '/api/kingdom',
  'kingdom-research.js': '/api/kingdom',
  'kingdom-profile.js': '/api/kingdom',
  'kingdom-exploration.js': '/api/kingdom',
  'kingdom-turn.js': '/api/kingdom',
  'kingdom-forge.js': '/api/kingdom',
  'kingdom-prestige.js': '/api/kingdom',
  'kingdom-gameplay.js': '/api/kingdom',
  'hero.js': '/api/hero',
  'admin.js': '/api/admin',
  'admin-actions.js': '/api',
  'discord.js': '/api/discord',
  'alliance.js': '/api/alliance',
  'forum.js': '/api/forum',
  'messages.js': '/api/messages',
  'bounties.js': '/api/world',
  'public.js': '/api',
  'feedback.js': '/api',
  'test-results.js': '/api',
};

const ROUTE_RE = /router\.(get|post|put|delete|patch)\(\s*['"`]([^'"`]+)['"`]/gi;

function scanRouteFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const endpoints = [];
  let m;
  const re = new RegExp(ROUTE_RE.source, 'gi');
  while ((m = re.exec(text)) !== null) {
    endpoints.push({
      method: m[1].toUpperCase(),
      path: m[2],
    });
  }
  return endpoints;
}

function scanAllRoutes() {
  const files = fs.readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.js'));
  /** @type {Array<{file: string, method: string, path: string, mount: string, fullPath: string}>} */
  const all = [];
  for (const file of files) {
    const filePath = path.join(ROUTES_DIR, file);
    const mount = FILE_MOUNT[file] || '/api';
    for (const ep of scanRouteFile(filePath)) {
      all.push({
        file,
        method: ep.method,
        path: ep.path,
        mount,
        fullPath: `${mount}${ep.path === '/' ? '' : ep.path}`.replace(/\/+/g, '/'),
      });
    }
  }
  return all;
}

/**
 * Build a multimap of METHOD path → files defining it (within same mount family).
 */
function indexByMethodPath(all) {
  const map = new Map();
  for (const ep of all) {
    const key = `${ep.method} ${ep.path}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(ep);
  }
  return map;
}

/**
 * Check SYSTEM_ENDPOINTS against scanned routes.
 * Paths are matched against any file (path only, not full mount) so kingdom/*
 * routes work regardless of which kingdom-*.js owns them.
 */
function checkSystemCoverage(all) {
  const byPath = new Map();
  for (const ep of all) {
    const key = `${ep.method} ${ep.path}`;
    if (!byPath.has(key)) byPath.set(key, []);
    byPath.get(key).push(ep);
  }

  const report = {};
  for (const [system, required] of Object.entries(SYSTEM_ENDPOINTS)) {
    report[system] = { required: required.length, present: [], missing: [] };
    for (const [method, p] of required) {
      const key = `${method} ${p}`;
      if (byPath.has(key)) {
        report[system].present.push({ method, path: p, files: byPath.get(key).map((e) => e.file) });
      } else {
        report[system].missing.push({ method, path: p });
      }
    }
  }
  return report;
}

function printInventory() {
  const all = scanAllRoutes();
  console.log(`Scanned ${all.length} route handlers in routes/\n`);
  const byFile = {};
  for (const ep of all) {
    if (!byFile[ep.file]) byFile[ep.file] = [];
    byFile[ep.file].push(ep);
  }
  for (const file of Object.keys(byFile).sort()) {
    console.log(`${file} (${byFile[file].length})  mount=${FILE_MOUNT[file] || '?'}`);
    for (const ep of byFile[file]) {
      console.log(`  ${ep.method.padEnd(6)} ${ep.fullPath}`);
    }
  }
  console.log('\n--- System coverage ---');
  const coverage = checkSystemCoverage(all);
  for (const [system, row] of Object.entries(coverage)) {
    const ok = row.missing.length === 0;
    console.log(
      `${ok ? '✓' : '✗'} ${system}: ${row.present.length}/${row.required} endpoints`,
    );
    for (const m of row.missing) {
      console.log(`    missing: ${m.method} ${m.path}`);
    }
  }
  return { all, coverage };
}

if (require.main === module) {
  printInventory();
}

module.exports = {
  SYSTEM_ENDPOINTS,
  FILE_MOUNT,
  scanAllRoutes,
  checkSystemCoverage,
  printInventory,
  indexByMethodPath,
};
