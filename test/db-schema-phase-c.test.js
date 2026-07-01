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

assert.ok(!schemaSource.includes('function translateSqlForPg'), 'Phase D removed translateSqlForPg');

console.log('db-schema Phase C checks passed');