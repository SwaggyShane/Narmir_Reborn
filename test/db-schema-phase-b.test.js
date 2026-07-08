/**
 * Phase B: schema introspection uses information_schema, not PRAGMA emulation.
 */
const assert = require('assert');
const { assertValidTableName, TABLE_NAME_RE } = require('../lib/db-schema-introspection');

assert.ok(TABLE_NAME_RE.test('kingdoms'));
assert.ok(TABLE_NAME_RE.test('forum_boards'));

assert.throws(
  () => assertValidTableName('kingdoms; DROP TABLE players'),
  /Invalid table name/,
);

// Adapter must not intercept PRAGMA — callers use getTableColumns instead.
const adapterSource = require('fs').readFileSync(require('path').join(__dirname, '../db/schema.js'), 'utf8');
assert.ok(!/PRAGMA\s+table_info/i.test(adapterSource), 'PgDbAdapter and boot must not use PRAGMA table_info');
assert.ok(!/PRAGMA\s+user_version/i.test(adapterSource), 'PgDbAdapter must not emulate PRAGMA user_version');

const columnUtilsSource = require('fs').readFileSync(require('path').join(__dirname, '../db/column-utils.js'), 'utf8');
assert.ok(columnUtilsSource.includes('queryTableColumns'), 'column utils (used by schema boot) should use information_schema helper via queryTableColumns');

console.log('db-schema Phase B checks passed');