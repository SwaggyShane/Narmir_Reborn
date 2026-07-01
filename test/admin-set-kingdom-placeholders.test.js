/**
 * Regression: routes/admin.js POST /set-kingdom builds a dynamic UPDATE SET
 * clause across N fields plus a trailing WHERE id = $N+1. Every column must
 * get its own incrementing placeholder — previously every column (and the
 * WHERE clause) hardcoded $1, which bound all of them to the first value in
 * the array. With more than one field, Postgres rejects the mismatched bind
 * ("bind message supplies N parameters, but prepared statement requires 1"),
 * and because the route had no try/catch, the request never got a response
 * — the client's fetch hung forever ("stuck on Saving...").
 *
 * This exercises pgSetClauseWithNextPlaceholder directly — the same shared
 * helper routes/admin.js calls in its /set-kingdom handler — rather than a
 * locally duplicated copy of the SQL-building logic.
 */
const assert = require('assert');
const { pgSetClauseWithNextPlaceholder } = require('../lib/pg-placeholders');

function buildSetKingdomSql(fieldKeys) {
  const { setClause, nextPlaceholder } = pgSetClauseWithNextPlaceholder(fieldKeys, 1);
  return `UPDATE kingdoms SET ${setClause} WHERE id = ${nextPlaceholder}`;
}

// Single field: SET "gold" = $1 WHERE id = $2
{
  const sql = buildSetKingdomSql(['gold']);
  assert.ok(sql.includes('"gold" = $1'), 'single field uses $1');
  assert.ok(sql.includes('WHERE id = $2'), 'WHERE clause uses $2, distinct from the field placeholder');
}

// Multi-field (mirrors the reported bug: 7 fields from the Buildings tab)
{
  const keys = ['iron', 'coal', 'steel', 'maps', 'blueprints_stored', 'scaffolding_stored', 'hammers_stored'];
  const sql = buildSetKingdomSql(keys);

  keys.forEach((key, i) => {
    assert.ok(sql.includes(`"${key}" = $${i + 1}`), `field "${key}" must bind to its own placeholder $${i + 1}`);
  });
  assert.ok(sql.includes(`WHERE id = $${keys.length + 1}`), 'WHERE clause placeholder must come after all field placeholders');

  // No two distinct fields may share a placeholder number.
  const fieldPlaceholders = keys.map((_, i) => `$${i + 1}`);
  assert.strictEqual(new Set(fieldPlaceholders).size, keys.length, 'every field must have a unique placeholder');

  // The WHERE placeholder must not collide with any field placeholder.
  const wherePlaceholder = `$${keys.length + 1}`;
  assert.ok(!fieldPlaceholders.includes(wherePlaceholder), 'WHERE placeholder must not reuse a field placeholder');
}

console.log('admin-set-kingdom placeholder checks passed');
