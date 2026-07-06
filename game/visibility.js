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
  console.log(`[K${kingdom?.id}-VIS] getKingdomMapCoords(race=${kingdom?.race}) -> (${map_x}, ${map_y}) -> hex (${hex.col}, ${hex.row})`);
  const bitmap = encodeCellSet([cellIndex(hex.col, hex.row)]);
  return { seenCells: bitmap, currentCells: bitmap, version: DEFAULT_VISIBILITY.version };
}

/**
 * Read a kingdom's visibility, lazily seeding it to "home hex only" and
 * persisting that if it has never been set (seen_cells === 0).
 * The passed `kingdom` should include id (race is required for correct
 * home hex via getKingdomMapCoords; fetched if missing).
 */
async function getKingdomVisibility(db, kingdom) {
  if (!kingdom || !kingdom.id) {
    return { seenCells: 0n, currentCells: 0n, version: DEFAULT_VISIBILITY.version };
  }

  // Ensure we have `race` for correct home-hex computation in getInitialVisibility / getKingdomMapCoords.
  // Some call sites (e.g. early /world-map paths) historically omitted it, causing home hex to be
  // seeded using the wrong RACE_HOMES anchor (defaulting to 'human'). This made the always-visible
  // home hex land at a different hex than the kingdom's actual position.
  let k = kingdom;
  if (!k.race && db) {
    const fresh = await db.get('SELECT id, race, visibility, active_effects FROM kingdoms WHERE id = $1', [kingdom.id]);
    if (fresh) {
      k = { ...k, ...fresh };
    }
  }

  const current = parseVisibility(k.visibility);
  let initial = null;
  if (current.seenCells === 0n) {
    initial = getInitialVisibility(k);
    await db.run(
      'UPDATE kingdoms SET visibility = $1 WHERE id = $2',
      [JSON.stringify(serializeVisibility(initial)), k.id],
    );
    current.seenCells = initial.seenCells;
    current.currentCells = initial.currentCells;
    current.version = initial.version;
  }

  // Apply fog_of_war debuff (if active): reduces currentCells to debuffRadius (locked 0 = home hex only).
  // Does not touch seenCells. active_effects may have been pre-fetched above.
  let activeEffectsStr = k.active_effects;
  if (!activeEffectsStr && db && k.id) {
    const row = await db.get('SELECT active_effects FROM kingdoms WHERE id = $1', [k.id]);
    activeEffectsStr = row ? row.active_effects : '{}';
  }
  const effects = safeJsonParse(activeEffectsStr || '{}', {}, 'auto:active_effects');
  if (effects.fog_of_war) {
    if (!initial) initial = getInitialVisibility(k);
    current.currentCells = initial.currentCells;
  }

  // Guarantee: the kingdom's own home hex is always present in seen_cells and current_cells.
  // This is the locked rule ("own kingdom always visible", "Ring 0 = home hex only (always visible)").
  // Defensive against prior bad seeds (wrong race at init time), manual edits, or any path that
  // failed to include the home bit. Uses the authoritative coords for *this* k (with race).
  if (!initial) {
    initial = getInitialVisibility(k);
  }
  const preSeen = current.seenCells;
  const preCurrent = current.currentCells;
  current.seenCells = current.seenCells | initial.seenCells;
  if (!effects.fog_of_war) {
    current.currentCells = current.currentCells | initial.currentCells;
  }

  // One-time persist of the home bit if it was missing (repairs kingdoms that were seeded
  // with the wrong home hex due to missing `race` in the SELECT passed to getKingdomVisibility).
  // Only writes when actually changed, and only outside of fog debuff current override (fog
  // intentionally shrinks current; we still ensure seen has home).
  if ((current.seenCells !== preSeen || current.currentCells !== preCurrent) && db && k.id) {
    // Fire-and-forget async repair with proper error handling to avoid unhandled rejections.
    // Safe write that preserves any extra fields in the visibility JSON (e.g. highest_completed_ring
    // or future keys) by patching only the cell strings on the raw object.
    db.get('SELECT visibility FROM kingdoms WHERE id = $1', [k.id])
      .then((rawRow) => {
        const raw = safeJsonParse(rawRow ? rawRow.visibility : null, {}, 'auto:visibility-repair');
        raw.seen_cells = current.seenCells.toString();
        raw.current_cells = current.currentCells.toString();
        if (!raw.version) raw.version = current.version || DEFAULT_VISIBILITY.version;
        return db.run('UPDATE kingdoms SET visibility = $1 WHERE id = $2', [JSON.stringify(raw), k.id]);
      })
      .catch((err) => {
        console.warn('[visibility] home bit repair write failed (non-fatal):', err.message);
      });
  }

  return current;
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

/**
 * Reveal all hexes in a completed scout ring for a kingdom.
 * Adds all hexes at distance=ring from home to seen_cells (permanent discovery).
 * Uses atomic transaction to prevent concurrent visibility loss.
 *
 * @param {object} db - Database connection
 * @param {number} kingdomId - Kingdom ID
 * @param {object} kingdom - Kingdom object (for map coordinates)
 * @param {number} ring - Completed ring number (1-17)
 * @returns {Promise} Resolves when visibility is updated
 */
async function revealRingHexes(db, kingdomId, kingdom, ring) {
  if (!kingdom || !kingdomId || !ring || ring < 1 || ring > 17) {
    return null;
  }

  try {
    const { getRingHexes } = require('./scout-rings');

    const { map_x, map_y } = getKingdomMapCoords(kingdom);
    const hex = pixelToHex(map_x, map_y);
    const homeHex = `${hex.col},${hex.row}`;

    const ringHexes = getRingHexes(homeHex, ring);
    if (!ringHexes || ringHexes.length === 0) {
      return null;
    }

    return updateKingdomVisibility(db, kingdomId, (current) => {
      const cellIndicesToReveal = ringHexes.map(hexKey => {
        if (typeof hexKey === 'string') {
          const [c, r] = hexKey.split(',').map(Number);
          return cellIndex(c, r);
        }
        return cellIndex(hexKey.col, hexKey.row);
      });
      let newSeenCells = current.seenCells;

      for (const idx of cellIndicesToReveal) {
        if (idx >= 0) {
          newSeenCells |= BigInt(1) << BigInt(idx);
        }
      }

      return {
        seenCells: newSeenCells,
        currentCells: current.currentCells,
        version: current.version,
      };
    });
  } catch (err) {
    console.error(`[visibility] Failed to reveal ring ${ring} for kingdom ${kingdomId}:`, err.message);
    return null;
  }
}

module.exports = {
  parseVisibility,
  serializeVisibility,
  getInitialVisibility,
  getKingdomVisibility,
  updateKingdomVisibility,
  revealRingHexes,
};
