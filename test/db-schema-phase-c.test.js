/**
 * Phase C: schema boot DDL is PG-native; translator only maps ? placeholders.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const schemaSource = fs.readFileSync(path.join(__dirname, '../db/schema.js'), 'utf8');

assert.ok(!/unixepoch\s*\(/i.test(schemaSource), 'schema.js must not use unixepoch()');
assert.ok(!/AUTOINCREMENT/i.test(schemaSource), 'schema.js must not use AUTOINCREMENT');
assert.ok(!/INSERT\s+OR\s+IGNORE/i.test(schemaSource), 'schema.js must not use INSERT OR IGNORE');
assert.ok(!/INSERT\s+OR\s+REPLACE/i.test(schemaSource), 'schema.js must not use INSERT OR REPLACE');
assert.ok(!/\bDATETIME\b/i.test(schemaSource), 'schema.js must not use DATETIME');
assert.ok(schemaSource.includes('SERIAL PRIMARY KEY'), 'schema uses SERIAL PRIMARY KEY');
assert.ok(schemaSource.includes('FLOOR(EXTRACT(EPOCH FROM NOW()))'), 'schema uses PG epoch defaults');

// translateSqlForPg is placeholder-only
const fnBody = schemaSource.slice(
  schemaSource.indexOf('function translateSqlForPg'),
  schemaSource.indexOf('// Cache numeric field names'),
);
assert.ok(!fnBody.includes('unixepoch'), 'translator must not rewrite unixepoch');
assert.ok(!fnBody.includes('AUTOINCREMENT'), 'translator must not rewrite AUTOINCREMENT');
assert.ok(!fnBody.includes('INSERT OR'), 'translator must not rewrite upsert dialect');
assert.ok(fnBody.includes('replace(/\\?/g'), 'translator maps ? placeholders');

console.log('db-schema Phase C checks passed');