/**
 * Phase D: native $N placeholders; translateSqlForPg removed.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const schemaSource = fs.readFileSync(path.join(__dirname, '../db/schema.js'), 'utf8');

assert.ok(!schemaSource.includes('function translateSqlForPg'), 'translateSqlForPg must be removed');
assert.ok(schemaSource.includes('connection.query(sql'), 'adapter passes SQL through unchanged');

const skipDirs = new Set(['node_modules', 'client', '.git', 'dist', 'build', 'test-combat-harness']);
const skipFiles = new Set([
  'tools/security-auditor/sql-injection-analyzer.js',
  'scripts/migrate-pg-placeholders.js',
  'scripts/count-sql-placeholders.js',
  'test/db-sql-phase-a.test.js',
  'test/db-schema-phase-c.test.js',
  'test/db-schema-phase-d.test.js',
]);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name.endsWith('.js')) out.push(p);
  }
  return out;
}

function sqlArgHasQuestionMark(line) {
  const callIdx = line.search(/db\.(get|all|run)\s*\(/);
  if (callIdx < 0) return false;
  const afterCall = line.slice(callIdx);
  const argStart = afterCall.indexOf('(') + 1;
  let depth = 1;
  let i = argStart;
  while (i < afterCall.length && depth > 0) {
    const ch = afterCall[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (depth === 1 && (ch === "'" || ch === '"' || ch === '`')) {
      const quote = ch;
      let j = i + 1;
      while (j < afterCall.length) {
        if (afterCall[j] === '\\') { j += 2; continue; }
        if (afterCall[j] === quote) break;
        j++;
      }
      const literal = afterCall.slice(i, j + 1);
      if (literal.includes('?')) return true;
      i = j + 1;
      continue;
    }
    i++;
  }
  return false;
}

const offenders = [];
for (const file of walk(path.join(__dirname, '..'))) {
  const rel = path.relative(path.join(__dirname, '..'), file).replace(/\\/g, '/');
  if (skipFiles.has(rel)) continue;
  const src = fs.readFileSync(file, 'utf8');
  if (!/db\.(get|all|run)\s*\(/.test(src)) continue;
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('?')) continue;
    if (sqlArgHasQuestionMark(line)) {
      offenders.push(`${rel}:${i + 1}`);
    }
  }
}

assert.deepStrictEqual(offenders, [], `SQL strings still use ? placeholders: ${offenders.join(', ')}`);

const { pgInList, pgSetClause } = require('../lib/pg-placeholders');
assert.strictEqual(pgInList(3), '$1, $2, $3');
assert.strictEqual(pgInList(2, 4), '$4, $5');
assert.strictEqual(pgSetClause(['gold', 'food']), '"gold" = $1, "food" = $2');

console.log('db-schema Phase D checks passed');