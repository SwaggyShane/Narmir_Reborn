'use strict';

// Shared by routes/kingdom-turn.js and routes/kingdom-gameplay.js (news/discovery
// helpers used well beyond just the turn path — extracted here, not duplicated,
// during the A2-3 turn-router split, 2026-07-19).

const { applyKingdomUpdates } = require('../../db/schema');
const { decorateNewsMessage } = require('../../game/news-emoji');
const { pgValueTuples } = require('../../lib/pg-placeholders');

const MOJIBAKE_SIGNATURE = /[\u00C3\u00C2\u00E2\u00EF\u00F0\u00C5\uFFFD]/;

function repairMojibake(value) {
  if (value === null || value === undefined) return value;
  let text = String(value);
  if (!MOJIBAKE_SIGNATURE.test(text)) return text;
  for (let i = 0; i < 20; i++) {
    if (!MOJIBAKE_SIGNATURE.test(text)) break;
    let next;
    try {
      next = Buffer.from(text, "latin1").toString("utf8");
    } catch {
      break;
    }
    if (next === text) break;
    text = next;
  }
  text = text
    .replace(/\u00c2/g, "")
    .replace(/\u00e2\u20ac\u201d/g, "\u2014")
    .replace(/\u00e2\u20ac\u201c/g, "-")
    .replace(/\u00e2\u20ac\u00a2/g, "\u2022")
    .replace(/\u00e2\u20ac\u02dc|\u00e2\u20ac\u2122/g, "\u2019")
    .replace(/\u00e2\u20ac\u0153/g, "\u201c");
  return text;
}

function normalizeNewsRow(row) {
  if (!row || typeof row !== "object") return row;
  if (typeof row.message === "string") {
    return { ...row, message: decorateNewsMessage(row.message, repairMojibake) };
  }
  return row;
}

async function getRandomKingdom(db, selfId, excludedIds = [], columns = "id, name") {
  const forbidden = [selfId, ...excludedIds]
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
  const uniqueForbidden = [...new Set(forbidden)];
  const countRow = await db.get("SELECT COUNT(*) as c FROM kingdoms WHERE id != $1", [selfId]);
  const total = Number(countRow?.c || 0);
  if (total <= 0) return null;

  const exclusionSet = new Set(uniqueForbidden);

  for (let attempt = 0; attempt < 8; attempt++) {
    const offset = Math.floor(Math.random() * total);
    const row = await db.get(
      `SELECT ${columns} FROM kingdoms WHERE id != $1 LIMIT 1 OFFSET $2`,
      [selfId, offset],
    );
    if (!row) continue;
    if (!exclusionSet.has(Number(row.id))) return row;
  }

  return null;
}

async function applyUpdates(db, kingdomId, updates) {
  // Validate no numeric values are NaN/Infinity (corrupted data protection)
  // Dynamically check all values instead of maintaining a hardcoded field list
  // This ensures future fields (new troop types, resources, etc.) are automatically protected
  for (const [key, value] of Object.entries(updates)) {
    if (typeof value === 'number' && (isNaN(value) || !isFinite(value))) {
      console.error(`[applyUpdates] NaN/Infinity detected in field: ${key} = ${value}`);
      throw new Error(`Corrupted numeric data: ${key} contains NaN or Infinity`);
    }
  }

  // Stringify JSON fields that are kept as objects during processTurn
  const updatesForDb = { ...updates };
  if (updatesForDb.troop_levels && typeof updatesForDb.troop_levels === 'object') {
    updatesForDb.troop_levels = JSON.stringify(updatesForDb.troop_levels);
  }
  // Pass the transaction-aware db connection so updates happen inside the transaction context
  await applyKingdomUpdates(kingdomId, updatesForDb, db);
}

// Insert multiple news rows in a single query — much faster than N sequential inserts
async function bulkInsertNews(db, rows) {
  if (!rows || rows.length === 0) return;
  const placeholders = pgValueTuples(rows.length, 4);
  const values = rows.flatMap((r) => [
    r.kingdom_id,
    r.type || "system",
    decorateNewsMessage(r.message, repairMojibake),
    r.turn_num || 0,
  ]);
  await db.run(
    `INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ${placeholders}`,
    values,
  );
}

// Prune old news — keep only the most recent N rows per kingdom
async function pruneNews(db, kingdomId, keep = 200) {
  await db.run(
    `
    DELETE FROM news WHERE kingdom_id = $1 AND id NOT IN (
      SELECT id FROM news WHERE kingdom_id = $2 ORDER BY created_at DESC LIMIT $3
    )
  `,
    [kingdomId, kingdomId, keep],
  );
}

module.exports = {
  repairMojibake,
  normalizeNewsRow,
  getRandomKingdom,
  applyUpdates,
  bulkInsertNews,
  pruneNews,
};
