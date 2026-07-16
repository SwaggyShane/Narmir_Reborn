/**
 * Spawn a world resource node from passive scout finds.
 * Called from commitTurnResults when updates._spawn_resource_node is set.
 */

'use strict';

const { getKingdomMapCoords } = require('./world-map-coords');
const { hexCenter, pixelToHex, getHexesInRadius } = require('./hex-utils');
const { isWaterPoint } = require('./world-regions');
const { getTerrainForRace } = require('./terrain');

// Optional: elevation-lane hex grid cache. This lane must load without it.
function hexGridApi() {
  try {
    return require('./world-hex-grid-cache');
  } catch {
    return { hasHexGrid: () => false, getTerrainAt: () => null };
  }
}

const VALID_TYPES = new Set(['wood', 'stone', 'iron', 'gold']);

/**
 * @param {object} db
 * @param {object} kingdom - row with id, race
 * @param {string} nodeType
 * @returns {Promise<{ ok: boolean, map_x?: number, map_y?: number, type?: string, error?: string }>}
 */
async function spawnPassiveScoutResourceNode(db, kingdom, nodeType) {
  if (!db || !kingdom || !kingdom.id) {
    return { ok: false, error: 'missing kingdom' };
  }
  const type = VALID_TYPES.has(nodeType) ? nodeType : 'wood';
  try {
    const home = getKingdomMapCoords(kingdom);
    const homeHex = pixelToHex(home.map_x, home.map_y);
    // Place in rings 2–4 so it's discoverable but not under the home hex
    const candidates = getHexesInRadius(homeHex.col, homeHex.row, 4).filter((h) => {
      const d = Math.max(Math.abs(h.col - homeHex.col), Math.abs(h.row - homeHex.row));
      // ring distance approx — keep non-home
      return !(h.col === homeHex.col && h.row === homeHex.row);
    });
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    let coords = null;
    let terrain = getTerrainForRace(kingdom.race) || 'plains';
    for (const hex of shuffled) {
      const center = hexCenter(hex.col, hex.row);
      if (isWaterPoint(center.x, center.y)) continue;
      const grid = hexGridApi();
      if (grid.hasHexGrid()) {
        const t = grid.getTerrainAt(hex.col, hex.row);
        if (t === 'ocean' || t === 'lake') continue;
        if (t) terrain = t;
      }
      coords = { x: Math.round(center.x), y: Math.round(center.y) };
      break;
    }
    if (!coords) {
      coords = {
        x: Math.round(home.map_x + 40),
        y: Math.round(home.map_y + 40),
      };
    }

    const name = `${type.charAt(0).toUpperCase()}${type.slice(1)} Deposit`;
    await db.run(
      `INSERT INTO resource_nodes (name, type, distance, richness, map_x, map_y, terrain)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [name, type, 800, 1, coords.x, coords.y, terrain],
    );
    return { ok: true, map_x: coords.x, map_y: coords.y, type };
  } catch (err) {
    console.error('[passive-resource-node] spawn failed:', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = {
  spawnPassiveScoutResourceNode,
  VALID_TYPES,
};
