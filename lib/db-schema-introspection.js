/**
 * PostgreSQL schema introspection (replaces SQLite PRAGMA table_info).
 */

const TABLE_NAME_RE = /^[a-z_][a-z0-9_]*$/i;

function assertValidTableName(table) {
  if (!TABLE_NAME_RE.test(table)) {
    throw new Error(`[db] Invalid table name for schema introspection: ${table}`);
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} connection
 * @param {string} table
 * @returns {Promise<Array<{ name: string, notnull: boolean }>>}
 */
async function queryTableColumns(connection, table) {
  assertValidTableName(table);
  const result = await connection.query(
    `SELECT column_name AS name,
            (is_nullable = 'NO') AS notnull
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table],
  );
  return result.rows;
}

module.exports = {
  TABLE_NAME_RE,
  assertValidTableName,
  queryTableColumns,
};