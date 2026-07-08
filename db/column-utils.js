const { resolveDbConnection } = require('./transaction');
const { queryTableColumns } = require('../lib/db-schema-introspection');

let _db = null; // will be set by schema

async function fetchTableColumnInfo(table, db = _db) {
  if (!db) return [];
  try {
    const connection = resolveDbConnection(db);
    return await queryTableColumns(connection, table);
  } catch (e) {
    console.error(`[db] Migration: error fetching columns for ${table}:`, e.message);
    return [];
  }
}

async function getTableColumns(table, db = _db) {
  const rows = await fetchTableColumnInfo(table, db);
  return rows.map((c) => c.name);
}

function setDb(db) {
  _db = db;
}

async function getColumnType(table, column, db = _db) {
  try {
    const connection = resolveDbConnection(db);
    const result = await connection.query(
      `SELECT data_type AS type FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
      [table, column],
    );
    return result?.rows?.[0]?.type || null;
  } catch (e) {
    console.error(`[db] Migration: error fetching type for ${table}.${column}:`, e.message);
    return null;
  }
}

async function addColumn(table, col, def, colArray, db = _db) {
  try {
    const connection = resolveDbConnection(db);
    await connection.query(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
    console.log(`[db] Migration: added ${col} to ${table}`);
    if (colArray && !colArray.includes(col)) {
      colArray.push(col);
    }
  } catch (e) {
    if (!e.message.includes('duplicate column') && !e.message.includes('already exists')) throw e;
    console.log(`[db] Migration: column ${col} already exists in ${table}`);
  }
}

module.exports = {
  fetchTableColumnInfo,
  getTableColumns,
  getColumnType,
  addColumn,
  setDb
};
