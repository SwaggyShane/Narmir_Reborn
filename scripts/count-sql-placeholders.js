const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const skip = new Set(['node_modules', 'client', '.git', 'dist', 'build']);
const sqlHints = /\b(SELECT|INSERT|UPDATE|DELETE|WHERE|VALUES|SET|FROM|JOIN|INTO|LIMIT|ORDER BY)\b/i;
const dbCall = /\.(get|all|run|exec|query)\s*\(/;

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name.endsWith('.js')) out.push(p);
  }
  return out;
}

function countPlaceholdersInStrings(line) {
  let total = 0;
  let sites = 0;
  const patterns = [
    /'([^'\\]|\\.)*'/g,
    /"([^"\\]|\\.)*"/g,
    /`([^`\\]|\\.)*`/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(line)) !== null) {
      const s = m[0].slice(1, -1);
      if (!sqlHints.test(s) && !/=\s*\?/.test(s) && !/\(\?/.test(s)) continue;
      const c = (s.match(/\?/g) || []).length;
      if (c) {
        total += c;
        sites++;
      }
    }
  }
  return { total, sites };
}

const files = walk(root);
const fileStats = {};
let totalPlaceholders = 0;
let totalCallSites = 0;

for (const f of files) {
  const rel = path.relative(root, f).replace(/\\/g, '/');
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  let ph = 0;
  let sites = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('?')) continue;

    const context = [lines[i - 1] || '', line, lines[i + 1] || ''].join('\n');
    const hasSql = sqlHints.test(context);
    const hasDb = dbCall.test(context);
    const isTranslatorTest = /translateSqlForPg|placeholder/i.test(context);

    if (!hasSql && !hasDb && !isTranslatorTest) continue;

    const counted = countPlaceholdersInStrings(line);
    ph += counted.total;
    sites += counted.sites;

    if (/=\s*\?/.test(line) && /setClause|cols|Object\.keys|map\(/.test(line)) {
      const dyn = (line.match(/=\s*\?/g) || []).length;
      ph += dyn;
      sites++;
    }
  }

  if (ph > 0) {
    fileStats[rel] = { placeholders: ph, callSites: sites };
    totalPlaceholders += ph;
    totalCallSites += sites;
  }
}

const byDir = {};
for (const [f, s] of Object.entries(fileStats)) {
  const d = f.includes('/') ? f.slice(0, f.lastIndexOf('/')) : '(root)';
  if (!byDir[d]) byDir[d] = { files: [], ph: 0, sites: 0 };
  byDir[d].files.push({ file: f, ...s });
  byDir[d].ph += s.placeholders;
  byDir[d].sites += s.callSites;
}

console.log('TOTAL_FILES', Object.keys(fileStats).length);
console.log('TOTAL_PLACEHOLDERS', totalPlaceholders);
console.log('TOTAL_CALL_SITES', totalCallSites);
console.log('---BY_DIR---');
for (const d of Object.keys(byDir).sort((a, b) => byDir[b].ph - byDir[a].ph)) {
  const x = byDir[d];
  console.log(`${d}: ${x.files.length} files, ${x.ph} ?, ${x.sites} sites`);
}
console.log('---FILES---');
for (const [f, s] of Object.entries(fileStats).sort((a, b) => b[1].placeholders - a[1].placeholders)) {
  console.log(`${f}: ${s.placeholders} ?, ${s.callSites} sites`);
}