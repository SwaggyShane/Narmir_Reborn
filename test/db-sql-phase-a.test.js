/**
 * Phase A: runtime SQL uses PG-native dialect; translator only maps placeholders.
 */
const assert = require('assert');

function translateSqlForPg(sql) {
  let paramIndex = 1;
  return sql.replace(/\?/g, () => `$${paramIndex++}`);
}

const { EPOCH_NOW, EPOCH_NOW_TEXT } = require('../lib/db-sql');

assert.match(EPOCH_NOW, /EXTRACT\(EPOCH FROM NOW\(\)\)/);
assert.match(EPOCH_NOW_TEXT, /CAST\(/);

const regenSql = translateSqlForPg('UPDATE kingdoms SET turns_stored = LEAST(?, turns_stored + ?)');
assert.ok(regenSql.includes('LEAST'), 'LEAST should pass through untranslated');
assert.ok(regenSql.includes('$1') && regenSql.includes('$2'), 'placeholders mapped');

const legacyMin = translateSqlForPg('UPDATE kingdoms SET turns_stored = MIN(?, turns_stored + ?)');
assert.ok(legacyMin.includes('MIN('), 'MIN must not be auto-translated');
assert.ok(!legacyMin.includes('LEAST'), 'MIN must not become LEAST in translator');

console.log('db-sql Phase A checks passed');