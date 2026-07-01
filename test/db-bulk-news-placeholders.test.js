/**
 * Regression: multi-row news INSERT must allocate distinct $N ranges per row.
 */
const assert = require('assert');
const { pgValueTuples } = require('../lib/pg-placeholders');

const NEWS_COLS = 4;

function buildBulkNewsSql(rowCount) {
  return `INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ${pgValueTuples(rowCount, NEWS_COLS)}`;
}

assert.strictEqual(pgValueTuples(1, 4), '($1,$2,$3,$4)');
assert.strictEqual(pgValueTuples(2, 4), '($1,$2,$3,$4),($5,$6,$7,$8)');
assert.strictEqual(pgValueTuples(3, 4), '($1,$2,$3,$4),($5,$6,$7,$8),($9,$10,$11,$12)');

const twoRowSql = buildBulkNewsSql(2);
assert.ok(!twoRowSql.includes('($1,$2,$3,$4),($1,$2,$3,$4)'), 'rows must not reuse $1-$4');
assert.ok(twoRowSql.includes('$5'), 'second row starts at $5');

const placeholders = buildBulkNewsSql(3).match(/\$(\d+)/g) || [];
const maxIndex = Math.max(...placeholders.map((m) => parseInt(m.slice(1), 10)));
assert.strictEqual(maxIndex, 12, 'three news rows need $1..$12');

console.log('db-bulk-news placeholder checks passed');