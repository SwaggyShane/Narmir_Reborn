'use strict';

const { getTableColumns } = require('./column-utils');
const { pgSetClause } = require('../lib/pg-placeholders');

let _kingdomCols = null;
let defaultDb = null;

function setDefaultDb(db) {
  defaultDb = db;
}

async function getKingdomCols() {
  if (!_kingdomCols) {
    const cols = await getTableColumns('kingdoms');
    _kingdomCols = new Set(cols);
  }
  return _kingdomCols;
}

async function applyKingdomUpdates(kingdomId, updates, db = null) {
  if (!updates || Object.keys(updates).length === 0) return [];
  // Force refresh cache if scout_progress is in updates but not in cached columns
  if (updates.scout_progress !== undefined && _kingdomCols && !_kingdomCols.has('scout_progress')) {
    console.warn('[applyKingdomUpdates] scout_progress not in cache, forcing refresh');
    _kingdomCols = null;
  }
  const validCols = await getKingdomCols();
  const safe = Object.fromEntries(
    Object.entries(updates).filter(([col, val]) => validCols.has(col) && val !== undefined && val !== null)
  );
  if (Object.keys(safe).length === 0) {
    console.warn('[applyKingdomUpdates] No valid columns to update', { kingdomId, updates, validCols: Array.from(validCols).slice(0, 10) });
    return [];
  }
  const cols = Object.keys(safe);
  const setClause = pgSetClause(cols);
  const vals = [...Object.values(safe), kingdomId];
  const sql = `UPDATE "kingdoms" SET ${setClause} WHERE id = $${cols.length + 1}`;
  if (process.env.NODE_ENV !== 'production') {
    console.log('[applyKingdomUpdates] Updating', { kingdomId, fields: cols, sql, vals });
  }
  const dbConnection = db || defaultDb;
  try {
    const result = await dbConnection.run(sql, vals);
    if (process.env.NODE_ENV !== 'production') {
      console.log('[applyKingdomUpdates] UPDATE completed', { kingdomId, rowsAffected: result?.rowCount || 'unknown', usedTxDb: !!db });
    }
  } catch (err) {
    console.error('[applyKingdomUpdates] UPDATE failed', { kingdomId, sql, err: err.message });
    throw err;
  }
  return Object.keys(safe);
}

module.exports = { applyKingdomUpdates, setDefaultDb, getKingdomCols };
