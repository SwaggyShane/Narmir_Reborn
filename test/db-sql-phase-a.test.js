/**
 * Phase A/D: runtime SQL uses PG-native dialect; no placeholder translator.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { EPOCH_NOW, EPOCH_NOW_TEXT } = require('../lib/db-sql');
const schemaSource = fs.readFileSync(path.join(__dirname, '../db/schema.js'), 'utf8');

assert.match(EPOCH_NOW, /EXTRACT\(EPOCH FROM NOW\(\)\)/);
assert.match(EPOCH_NOW_TEXT, /CAST\(/);
assert.ok(!schemaSource.includes('function translateSqlForPg'), 'translator removed in Phase D');

const regenSql = 'UPDATE kingdoms SET turns_stored = LEAST($1, turns_stored + $2)';
assert.ok(regenSql.includes('LEAST'), 'LEAST is PG-native');
assert.ok(regenSql.includes('$1') && regenSql.includes('$2'), 'native placeholders');

console.log('db-sql Phase A checks passed');