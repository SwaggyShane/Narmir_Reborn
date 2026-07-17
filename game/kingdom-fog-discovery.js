/**
 * Deterministic fog-based kingdom discovery.
 *
 * Design: there is no dice roll for finding another kingdom. Fog of war is
 * binary — if a hex has had its fog removed (seen or currently visible) and
 * another kingdom's home sits on that hex, it is discovered. This replaces
 * the old percentage-roll "kingdom_signal" passive-scout outcome.
 *
 * Runs once per turn whenever scouts are actively allocated (mirroring the
 * scout-progress gate in engine.js), independent of ring completion — a
 * kingdom whose fog is already fully uncovered (e.g. the DISABLE_FOG_OF_WAR
 * test bypass) still needs this to fire every turn, since it won't get a
 * fresh "ring completed" event to hang the check on.
 */

'use strict';

const { getKingdomVisibility } = require('./visibility');
const { getKingdomMapCoords } = require('./world-map-coords');
const { pixelToHex } = require('./hex-utils');
const { bitmapHasCell } = require('./visibility-cells');
const { mergeKingdomDiscovery } = require('./kingdom-discovery-resolve');
const { safeJsonParse } = require('../utils/helpers');

/**
 * Fire-and-forget, like revealRingHexes: visibility/DB reads are async and
 * engine.js's processTurn() is not, so this writes discovered_kingdoms
 * directly instead of folding into the synchronous turn `updates` object.
 *
 * @param {object} db
 * @param {number} kingdomId
 * @returns {Promise<Array>} discoveries applied this call (for logging/tests)
 */
async function checkFogDiscoveries(db, kingdomId) {
  if (!db || !kingdomId) return [];

  const kingdom = await db.get(
    'SELECT id, race, visibility, active_effects, discovered_kingdoms FROM kingdoms WHERE id = $1',
    [kingdomId],
  );
  if (!kingdom) return [];

  const { seenCells, currentCells } = await getKingdomVisibility(db, kingdom);
  const combined = seenCells | currentCells;
  if (combined === 0n) return [];

  const others = await db.all(
    'SELECT id, name, race FROM kingdoms WHERE id != $1',
    [kingdomId],
  );

  let disc = safeJsonParse(kingdom.discovered_kingdoms, {}, 'kingdom-fog-discovery');
  if (!disc || typeof disc !== 'object') disc = {};

  const discoveries = [];
  for (const other of others) {
    if (disc[other.id] || disc[String(other.id)]) continue;

    let hex;
    try {
      const { map_x, map_y } = getKingdomMapCoords(other);
      hex = pixelToHex(map_x, map_y);
    } catch {
      continue;
    }

    let visible = false;
    try {
      visible = bitmapHasCell(combined, hex.col, hex.row);
    } catch {
      continue; // hex outside the valid cell-index range — treat as not visible
    }
    if (!visible) continue;

    const merged = mergeKingdomDiscovery(
      { discovered_kingdoms: JSON.stringify(disc) },
      {},
      other,
      { source: 'scout' },
    );
    if (merged.applied) {
      disc = JSON.parse(merged.discovered_kingdoms);
      discoveries.push(merged);
    }
  }

  if (discoveries.length > 0) {
    await db.run('UPDATE kingdoms SET discovered_kingdoms = $1 WHERE id = $2', [
      JSON.stringify(disc),
      kingdomId,
    ]);
  }

  return discoveries;
}

module.exports = { checkFogDiscoveries };
