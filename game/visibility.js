/**
 * Fog of War Phase 2: kingdom-scoped visibility persistence.
 *
 * Storage: kingdoms.visibility (TEXT, JSON-in-TEXT convention) holds
 * { seen_cells, current_cells, version } where seen_cells/current_cells are
 * BigInt hex-cell bitmaps (game/visibility-cells.js) serialized as decimal
 * strings, since JSON can't carry BigInt directly.
 *
 * Initial visibility (locked decision): home hex only. Rather than touching
 * every kingdom-creation call site (routes/auth.js, routes/admin.js x2) to
 * set this explicitly, a fresh kingdom's visibility column defaults to
 * "0"/"0" (db/schema.js) and getKingdomVisibility() lazily seeds the home
 * hex into both fields the first time it's read, persisting the result so
 * later reads are consistent. This also uniformly backfills the ~5,000
 * pre-Phase-2 kingdoms in the local dev DB without a separate migration
 * script.
 */

'use strict';

const { safeJsonParse } = require('../utils/helpers');
const { migrateVisibility, DEFAULT_VISIBILITY } = require('./visibility-migration');
const { encodeCellSet, cellIndex } = require('./visibility-cells');
const { pixelToHex } = require('./hex-utils');
const { getKingdomMapCoords } = require('./world-map-coords');

/**
 * Parse a kingdom row's raw `visibility` column value into BigInts.
 * Accepts either the raw TEXT/JSON string or an already-parsed object
 * (repairJsonRows may have already normalized it by the time a route reads
 * the row) — safeJsonParse passes objects through unchanged.
 */
function parseVisibility(raw) {
  const parsed = safeJsonParse(raw, DEFAULT_VISIBILITY, 'auto:visibility');
  const migrated = migrateVisibility(parsed);
  return {
    seenCells: BigInt(migrated.seen_cells || '0'),
    currentCells: BigInt(migrated.current_cells || '0'),
    version: migrated.version,
  };
}

/**
 * Serialize a { seenCells, currentCells, version } object (BigInts) back
 * into the JSON-storable shape (decimal strings).
 */
function serializeVisibility({ seenCells, currentCells, version }) {
  return {
    seen_cells: seenCells.toString(),
    current_cells: currentCells.toString(),
    version,
  };
}

/**
 * Compute the "home hex only" initial visibility for a kingdom, given its
 * id/race (used to derive its continuous map position the same way
 * everywhere else in the app does).
 */
function getInitialVisibility(kingdom) {
  const { map_x, map_y } = getKingdomMapCoords(kingdom);
  const hex = pixelToHex(map_x, map_y);
  const bitmap = encodeCellSet([cellIndex(hex.col, hex.row)]);
  return { seenCells: bitmap, currentCells: bitmap, version: DEFAULT_VISIBILITY.version };
}

/**
 * Read a kingdom's visibility, lazily seeding it to "home hex only" and
 * persisting that if it has never been set (seen_cells === 0). `kingdom`
 * must include at least { id, race, visibility }.
 */
async function getKingdomVisibility(db, kingdom) {
  const current = parseVisibility(kingdom.visibility);
  if (current.seenCells !== 0n) {
    return current;
  }
  const initial = getInitialVisibility(kingdom);
  await db.run(
    'UPDATE kingdoms SET visibility = $1 WHERE id = $2',
    [JSON.stringify(serializeVisibility(initial)), kingdom.id],
  );
  return initial;
}

/**
 * Read-modify-write a kingdom's visibility under a row lock (BEGIN / SELECT
 * ... FOR UPDATE / UPDATE / COMMIT), the same pattern used throughout this
 * codebase (routes/hero.js, routes/kingdom-build.js, etc.) so concurrent
 * requests touching the same row can't silently clobber each other's
 * writes. `updater(current) -> next` receives and must return
 * { seenCells, currentCells, version } (BigInts).
 *
 * Uses db.withTransaction (not manual BEGIN/COMMIT db.run() calls) —
 * withTransaction wraps its callback in transactionStorage.run(), which
 * correctly scopes the AsyncLocalStorage context for the callback's full
 * lifetime. The manual BEGIN/COMMIT string pattern (db.run('BEGIN
 * TRANSACTION') ... db.run('COMMIT')) relies on transactionStorage
 * .enterWith() instead, which does NOT reliably propagate — confirmed via
 * direct tracing that the context is already lost by the very next
 * statement after BEGIN, meaning FOR UPDATE provides no real mutual
 * exclusion under that pattern. That's a pre-existing bug in the manual
 * pattern itself (still used elsewhere: routes/hero.js, kingdom-build.js,
 * kingdom-economy.js), flagged separately rather than fixed everywhere
 * here — this function sidesteps it entirely by using the already-correct
 * withTransaction helper instead.
 *
 * Returns the new visibility, or null if the kingdom doesn't exist.
 */
async function updateKingdomVisibility(db, kingdomId, updater) {
  return db.withTransaction(async () => {
    const row = await db.get(
      'SELECT id, race, visibility FROM kingdoms WHERE id = $1 FOR UPDATE',
      [kingdomId],
    );
    if (!row) {
      return null;
    }
    const current = await getKingdomVisibility(db, row);
    const next = updater(current);
    await db.run(
      'UPDATE kingdoms SET visibility = $1 WHERE id = $2',
      [JSON.stringify(serializeVisibility(next)), kingdomId],
    );
    return next;
  });
}

module.exports = {
  parseVisibility,
  serializeVisibility,
  getInitialVisibility,
  getKingdomVisibility,
  updateKingdomVisibility,
};
