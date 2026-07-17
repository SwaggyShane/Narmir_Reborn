'use strict';

const { getTableColumns } = require('./column-utils');
const { pgSetClause } = require('../lib/pg-placeholders');

let _kingdomCols = null;
let defaultDb = null;

const KINGDOMS_COLS_SQL = `
  SELECT column_name AS name
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'kingdoms'
  ORDER BY ordinal_position
`;

function setDefaultDb(db) {
  defaultDb = db;
}

/**
 * Load kingdoms column names. Never cache an empty set (that silently no-ops
 * every applyKingdomUpdates call — fatal for prestige wipe).
 * Prefers the caller's db adapter so rebirth TX does not depend on column-utils
 * global _db / a second AsyncLocalStorage instance.
 */
async function loadKingdomColumnNames(db) {
  // 1) Introspect via the same adapter that will run the UPDATE
  if (db) {
    try {
      if (typeof db.all === 'function') {
        const rows = await db.all(KINGDOMS_COLS_SQL);
        if (rows?.length) return rows.map((r) => r.name);
      }
      if (typeof db.get === 'function' && typeof db.run === 'function') {
        // Some adapters only expose run/query-like helpers via pool
      }
      if (db.pool && typeof db.pool.query === 'function') {
        const r = await db.pool.query(KINGDOMS_COLS_SQL);
        if (r.rows?.length) return r.rows.map((row) => row.name);
      }
      if (typeof db.query === 'function') {
        const r = await db.query(KINGDOMS_COLS_SQL);
        if (r.rows?.length) return r.rows.map((row) => row.name);
      }
    } catch (e) {
      console.warn('[applyKingdomUpdates] db introspect failed:', e.message);
    }
  }

  // 2) Fall back to column-utils (server boot sets its db)
  try {
    const cols = await getTableColumns('kingdoms');
    if (cols?.length) return cols;
  } catch (e) {
    console.warn('[applyKingdomUpdates] getTableColumns failed:', e.message);
  }

  return [];
}

async function getKingdomCols(db = null) {
  if (_kingdomCols && _kingdomCols.size > 0) return _kingdomCols;

  const names = await loadKingdomColumnNames(db || defaultDb);
  if (!names.length) {
    // Do not cache empty — next call retries
    throw new Error(
      '[applyKingdomUpdates] kingdoms column list empty (schema introspection failed). Cannot apply updates safely.',
    );
  }
  _kingdomCols = new Set(names);
  return _kingdomCols;
}

async function applyKingdomUpdates(kingdomId, updates, db = null) {
  if (!updates || Object.keys(updates).length === 0) return [];
  const dbConnection = db || defaultDb;
  if (!dbConnection) {
    throw new Error('[applyKingdomUpdates] no db connection');
  }

  // Force refresh cache if scout_progress is in updates but not in cached columns
  if (updates.scout_progress !== undefined && _kingdomCols && !_kingdomCols.has('scout_progress')) {
    console.warn('[applyKingdomUpdates] scout_progress not in cache, forcing refresh');
    _kingdomCols = null;
  }

  const validCols = await getKingdomCols(dbConnection);
  const safe = Object.fromEntries(
    Object.entries(updates).filter(([col, val]) => validCols.has(col) && val !== undefined && val !== null),
  );
  if (Object.keys(safe).length === 0) {
    console.warn('[applyKingdomUpdates] No valid columns to update', {
      kingdomId,
      updateKeys: Object.keys(updates).slice(0, 20),
      validColsSample: Array.from(validCols).slice(0, 10),
    });
    return [];
  }
  const cols = Object.keys(safe);
  const setClause = pgSetClause(cols);
  const vals = [...Object.values(safe), kingdomId];
  const sql = `UPDATE "kingdoms" SET ${setClause} WHERE id = $${cols.length + 1}`;
  if (process.env.NODE_ENV !== 'production') {
    console.log('[applyKingdomUpdates] Updating', { kingdomId, fieldCount: cols.length });
  }
  try {
    const result = await dbConnection.run(sql, vals);
    if (process.env.NODE_ENV !== 'production') {
      console.log('[applyKingdomUpdates] UPDATE completed', {
        kingdomId,
        rowsAffected: result?.rowCount || 'unknown',
        usedTxDb: !!db,
      });
    }
  } catch (err) {
    console.error('[applyKingdomUpdates] UPDATE failed', { kingdomId, err: err.message });
    throw err;
  }
  return Object.keys(safe);
}

/** Test helper: clear column cache between suites. */
function clearKingdomColsCache() {
  _kingdomCols = null;
}

module.exports = {
  applyKingdomUpdates,
  setDefaultDb,
  getKingdomCols,
  clearKingdomColsCache,
};
