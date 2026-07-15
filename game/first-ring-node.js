/**
 * Seeds one resource node within ring-1 (the kingdom's home hex or one of
 * its 6 immediate neighbors) of a newly created kingdom, so it's
 * discoverable almost immediately via the cheapest scout ring — not tied
 * to any of the region's shared world-seeded nodes, a dedicated one just
 * for this kingdom.
 */

'use strict';

const { getKingdomMapCoords } = require('./world-map-coords');
const { hexCenter, pixelToHex, getHexesInRadius } = require('./hex-utils');
const { isWaterPoint } = require('./world-regions');

const RACE_TO_TERRAIN = {
  dwarf: 'mountains',
  high_elf: 'forest',
  wood_elf: 'forest',
  orc: 'plains',
  human: 'plains',
  dire_wolf: 'hills',
  vampire: 'swamp',
  dark_elf: 'hills',
  ogre: 'mountains',
};

function pickRandomNodeType() {
  const roll = Math.random();
  if (roll < 0.35) return 'wood';
  if (roll < 0.65) return 'stone';
  if (roll < 0.90) return 'iron';
  return 'gold';
}

/**
 * @param {object} db - Database connection
 * @param {number} kingdomId
 * @param {string} race
 */
async function seedFirstRingNode(db, kingdomId, race) {
  try {
    const home = getKingdomMapCoords({ id: kingdomId, race });
    const homeHex = pixelToHex(home.map_x, home.map_y);
    const candidates = getHexesInRadius(homeHex.col, homeHex.row, 1);

    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    let coords = null;
    for (const hex of shuffled) {
      const center = hexCenter(hex.col, hex.row);
      if (!isWaterPoint(center.x, center.y)) {
        coords = { x: Math.round(center.x), y: Math.round(center.y) };
        break;
      }
    }
    if (!coords) {
      // Fallback: the kingdom's own position is guaranteed non-water
      // (getKingdomMapCoords already enforces that).
      coords = { x: home.map_x, y: home.map_y };
    }

    const type = pickRandomNodeType();
    const terrain = RACE_TO_TERRAIN[race] || 'plains';
    // Shortest possible expedition distance — this node exists specifically
    // to be found almost immediately, not to be a long-haul target.
    const distance = 600;

    // World-owned (kingdom_id NULL), same as every other seeded resource
    // node — discoverable by anyone who scouts the hex, not privately
    // reserved for this kingdom.
    await db.run(
      `INSERT INTO resource_nodes (name, type, distance, richness, map_x, map_y, terrain)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [`${type.charAt(0).toUpperCase()}${type.slice(1)} Discovery`, type, distance, 1, coords.x, coords.y, terrain],
    );
  } catch (err) {
    console.error(`[first-ring-node] Failed to seed node for kingdom ${kingdomId}:`, err.message);
  }
}

module.exports = { seedFirstRingNode };
