/**
 * Phase A: runtime SQL uses PG-native dialect; translator no longer rewrites scalar MIN/MAX.
 */
const assert = require('assert');

// Mirror translateSqlForPg MIN/MAX removal — only ? placeholder + boot unixepoch remain.
function translateSqlForPg(sql) {
  let translated = sql;
  translated = translated.replace(/CAST\(unixepoch\(\) AS TEXT\)/gi, "CAST(date_part('epoch', now())::integer AS TEXT)");
  translated = translated.replace(/unixepoch\(\)/gi, "date_part('epoch', now())::integer");
  let paramIndex = 1;
  translated = translated.replace(/\?/g, () => `$${paramIndex++}`);
  return translated;
}

const { EPOCH_NOW, EPOCH_NOW_TEXT } = require('../lib/db-sql');

assert.match(EPOCH_NOW, /EXTRACT\(EPOCH FROM NOW\(\)\)/);
assert.match(EPOCH_NOW_TEXT, /CAST\(/);

const regenSql = translateSqlForPg('UPDATE kingdoms SET turns_stored = LEAST(?, turns_stored + ?)');
assert.ok(regenSql.includes('LEAST'), 'LEAST should pass through untranslated');

const legacyMin = translateSqlForPg('UPDATE kingdoms SET turns_stored = MIN(?, turns_stored + ?)');
assert.ok(legacyMin.includes('MIN('), 'scalar MIN must not be auto-translated after Phase A');
assert.ok(!legacyMin.includes('LEAST'), 'MIN must not become LEAST in translator');

console.log('db-sql Phase A checks passed');