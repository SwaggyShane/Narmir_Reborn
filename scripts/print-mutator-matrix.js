#!/usr/bin/env node
/**
 * Mutator policy plan M5-A: print-only matrix candidate generator.
 *
 * Scans routes/kingdom-*.js + routes/hero.js for every mutating
 * (POST/PUT/PATCH/DELETE) route, and reports whether CommandHandler.handle(
 * is called anywhere in that route's body. This automates the manual
 * per-route read done for docs/dev/MUTATOR_POLICY_PLAN.md M3 (2026-07-22) so
 * the next refresh doesn't require re-reading every route by hand.
 *
 * This is a print-only aid, not a source of truth: it flags "CH call found
 * in body" vs "no CH call found" — a human still classifies Policy A vs B vs
 * a fence, and still writes the result into game/COMMAND_COVERAGE.md. Do not
 * wire this into CI or auto-edit the matrix from it.
 *
 * Usage: node scripts/print-mutator-matrix.js
 *        npm run print:mutator-matrix
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const ROUTES_DIR = path.join(ROOT_DIR, 'routes');

const FILES = [
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
  'hero.js',
];

const ROUTE_RE = /router\.(post|put|patch|delete)\(\s*(['"`])([^'"`]+)\2/;

function findRouteStarts(src) {
  const lines = src.split(/\r?\n/);
  const routes = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(ROUTE_RE);
    if (m) routes.push({ line: i, method: m[1].toUpperCase(), routePath: m[3] });
  }
  return routes;
}

/**
 * Body span = brace-depth-matched extent of the route's own callback, not
 * "until the next router.X( line". The naive next-line heuristic produces
 * real false positives: a file with only one router.post spans to EOF and
 * picks up unrelated helper functions below it; adjacent routes can bleed
 * into each other if one has a short body. Confirmed both during M5-A
 * development (2026-07-22) before shipping this script.
 */
function extractRouteBody(src, startLine) {
  const lines = src.split(/\r?\n/);
  let depth = 0;
  let started = false;
  const bodyLines = [];
  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === '{') { depth++; started = true; }
      else if (ch === '}') { depth--; }
    }
    bodyLines.push(line);
    if (started && depth <= 0) break;
  }
  return bodyLines.join('\n');
}

function scanFile(file) {
  const full = path.join(ROUTES_DIR, file);
  if (!fs.existsSync(full)) return { file, error: 'missing' };
  const src = fs.readFileSync(full, 'utf8');
  const routes = findRouteStarts(src);

  const results = routes.map((r) => {
    const body = extractRouteBody(src, r.line);
    const hasCH = /commandHandler\.handle\s*\(/.test(body);
    const typeMatch = body.match(/type:\s*['"`]([a-z-]+)['"`]/);
    return {
      method: r.method,
      routePath: r.routePath,
      line: r.line + 1,
      hasCH,
      chType: hasCH && typeMatch ? typeMatch[1] : null,
    };
  });

  return { file, routes: results };
}

function main() {
  let totalRoutes = 0;
  let totalCH = 0;

  console.log('# Mutator matrix candidates (print-only, M5-A)');
  console.log(`# Generated ${new Date().toISOString().slice(0, 10)} by scripts/print-mutator-matrix.js`);
  console.log('# Human review required before pasting into game/COMMAND_COVERAGE.md.\n');

  for (const file of FILES) {
    const { routes, error } = scanFile(file);
    if (error) {
      console.log(`## routes/${file} — ${error}\n`);
      continue;
    }
    console.log(`## routes/${file} (${routes.length} mutating routes)\n`);
    for (const r of routes) {
      const label = r.hasCH ? `CH${r.chType ? ':' + r.chType : ' (type not statically found)'}` : 'direct (verify txn manually)';
      console.log(`- ${label} | ${r.method} ${r.routePath} (line ${r.line})`);
    }
    console.log('');
    totalRoutes += routes.length;
    totalCH += routes.filter((r) => r.hasCH).length;
  }

  console.log(`# Total: ${totalRoutes} mutating routes, ${totalCH} with a commandHandler.handle( call in body, ${totalRoutes - totalCH} without.`);
  console.log('# "direct" here just means no CH call was found in the route\'s text span — still confirm');
  console.log('# db.withTransaction usage and Policy B classification by reading the route, same as M3.');
}

main();
