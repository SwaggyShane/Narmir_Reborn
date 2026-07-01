/**
 * Phase D: convert SQLite ? placeholders to PostgreSQL $1, $2, ... in SQL string literals.
 * Full-file scan; strict SQL detection; skips dynamic placeholder builders.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const skipDirs = new Set(['node_modules', 'client', '.git', 'dist', 'build']);
const skipFiles = new Set([
  'scripts/migrate-pg-placeholders.js',
  'scripts/count-sql-placeholders.js',
  'test/db-sql-phase-a.test.js',
  'test/db-schema-phase-c.test.js',
  'tools/security-auditor/sql-injection-analyzer.js',
  'game/combat.js',
  'game/effects.js',
  'game/lib/gameplay.js',
]);

const targetDirs = ['db', 'routes', 'lib', 'game', 'cache.js', 'index.js', 'discord-bot.js', 'test-combat-harness', 'scripts'];

const sqlHints = /\b(SELECT|INSERT|UPDATE|DELETE|WHERE|VALUES|SET|FROM|JOIN|INTO|LIMIT|ORDER BY|RETURNING|OFFSET|ON CONFLICT)\b/i;

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name.endsWith('.js')) out.push(p);
  }
  return out;
}

function isTargetFile(rel) {
  return targetDirs.some((t) => rel === t || rel.startsWith(`${t}/`) || rel.startsWith(`${t}\\`));
}

function isLikelySql(text) {
  return sqlHints.test(text) || /= \?/.test(text) || /\(\s*\?/.test(text) || /,\s*\?/.test(text);
}

function renumberQuestionMarks(text, start = 1) {
  let idx = start;
  const sql = text.replace(/\?/g, () => `$${idx++}`);
  return { sql, nextIndex: idx };
}

function processTemplateLiteral(content, startPos) {
  let i = startPos + 1;
  let paramIdx = 1;
  let out = '`';

  while (i < content.length) {
    if (content[i] === '\\') {
      out += content[i] + (content[i + 1] || '');
      i += 2;
      continue;
    }
    if (content[i] === '`') {
      out += '`';
      return { result: out, end: i + 1 };
    }
    if (content[i] === '$' && content[i + 1] === '{') {
      let depth = 1;
      let j = i + 2;
      while (j < content.length && depth > 0) {
        if (content[j] === '{') depth++;
        else if (content[j] === '}') depth--;
        j++;
      }
      out += content.slice(i, j);
      i = j;
      continue;
    }

    let j = i;
    while (j < content.length) {
      if (content[j] === '\\') {
        j += 2;
        continue;
      }
      if (content[j] === '`' || (content[j] === '$' && content[j + 1] === '{')) break;
      j++;
    }

    const chunk = content.slice(i, j);
    if (chunk.includes('?') && isLikelySql(chunk)) {
      const { sql, nextIndex } = renumberQuestionMarks(chunk, paramIdx);
      out += sql;
      paramIdx = nextIndex;
    } else {
      out += chunk;
    }
    i = j;
  }

  return { result: out, end: i };
}

function processQuotedLiteral(content, startPos, quote) {
  let i = startPos + 1;
  while (i < content.length) {
    if (content[i] === '\\') {
      i += 2;
      continue;
    }
    if (content[i] === quote) {
      const literal = content.slice(startPos, i + 1);
      const inner = literal.slice(1, -1);
      if (inner.includes('?') && isLikelySql(inner)) {
        const { sql } = renumberQuestionMarks(inner);
        return { result: quote + sql + quote, end: i + 1 };
      }
      return { result: literal, end: i + 1 };
    }
    i++;
  }
  return { result: content.slice(startPos), end: content.length };
}

function trySkipRegex(content, startPos) {
  if (content[startPos] !== '/') return null;
  const prev = content.slice(Math.max(0, startPos - 30), startPos);
  if (!/[=([,!?:&|+\-*%\s;]$/.test(prev) && !/\breturn\s$/.test(prev) && !/\bcase\s$/.test(prev)) {
    return null;
  }

  let i = startPos + 1;
  while (i < content.length) {
    if (content[i] === '\\') {
      i += 2;
      continue;
    }
    if (content[i] === '/') {
      i++;
      while (i < content.length && /[gimsuy]/.test(content[i])) i++;
      return { result: content.slice(startPos, i), end: i };
    }
    if (content[i] === '\n') break;
    i++;
  }
  return null;
}

function transformContent(content) {
  let out = '';
  let i = 0;

  while (i < content.length) {
    const ch = content[i];

    if (ch === '/' && content[i + 1] === '/') {
      const end = content.indexOf('\n', i);
      out += content.slice(i, end === -1 ? content.length : end + 1);
      i = end === -1 ? content.length : end + 1;
      continue;
    }

    if (ch === '/' && content[i + 1] === '*') {
      const end = content.indexOf('*/', i);
      out += content.slice(i, end + 2);
      i = end + 2;
      continue;
    }

    const regex = trySkipRegex(content, i);
    if (regex) {
      out += regex.result;
      i = regex.end;
      continue;
    }

    if (ch === '`') {
      const t = processTemplateLiteral(content, i);
      out += t.result;
      i = t.end;
      continue;
    }

    if (ch === "'" || ch === '"') {
      const q = processQuotedLiteral(content, i, ch);
      out += q.result;
      i = q.end;
      continue;
    }

    out += ch;
    i++;
  }

  return out;
}

function patchInterpolatedConstants(content) {
  const constCounts = {};
  const constRe = /const\s+([A-Z][A-Z0-9_]*)\s*=\s*`([\s\S]*?)`;/g;
  let m;
  while ((m = constRe.exec(content)) !== null) {
    const matches = m[2].match(/\$\d+/g) || [];
    const max = matches.reduce((acc, tok) => Math.max(acc, parseInt(tok.slice(1), 10)), 0);
    if (max > 0) constCounts[m[1]] = max;
  }

  let patched = content;
  for (const [name, count] of Object.entries(constCounts)) {
    const next = count + 1;
    patched = patched.replace(
      new RegExp(`\\$\\{${name}\\}([^\\n\`]*?)\\?`, 'g'),
      (_, tail) => `\${${name}}${tail.replace('?', `$${next}`)}`,
    );
  }
  return patched;
}

function migrateFile(filePath) {
  const rel = path.relative(root, filePath).replace(/\\/g, '/');
  if (skipFiles.has(rel) || !isTargetFile(rel)) return { rel, changed: false };

  const original = fs.readFileSync(filePath, 'utf8');
  let next = transformContent(original);
  next = patchInterpolatedConstants(next);

  if (next !== original) {
    fs.writeFileSync(filePath, next, 'utf8');
    return { rel, changed: true };
  }
  return { rel, changed: false };
}

const files = walk(root);
const changed = [];
for (const f of files) {
  const result = migrateFile(f);
  if (result.changed) changed.push(result.rel);
}

console.log(`Migrated ${changed.length} files`);
for (const rel of changed.sort()) console.log(`  ${rel}`);