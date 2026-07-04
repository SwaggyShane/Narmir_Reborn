/**
 * Epic Trek location discovery mechanics.
 *
 * When a kingdom travels along an Epic Trek path, each hex crossed has a
 * random chance to reveal kingdoms, nodes, artifacts, etc. Uses same
 * discovery probability as Deep Expedition.
 */

'use strict';

/**
 * Determine if a kingdom is discovered in a given hex.
 * Uses seeded random based on hex position and kingdom data to ensure
 * consistency across multiple path traversals.
 *
 * Discovery chance: ~30% per hex (tuned from Deep Expedition formula).
 *
 * @param {number} hexCol - Hex column
 * @param {number} hexRow - Hex row
 * @param {object} kingdom - Kingdom object (for kingdom_id seed)
 * @returns {object|null} Discovery object or null if no discovery
 */
function rollKingdomDiscovery(hexCol, hexRow, kingdom) {
  if (!kingdom || !kingdom.id) return null;

  // Simple seeded random: hash hex position + kingdom_id
  // In production, use a seeded RNG for determinism
  const seed = (hexCol * 1000 + hexRow) ^ kingdom.id;
  const pseudo = Math.sin(seed) * 10000;
  const rand = pseudo - Math.floor(pseudo);

  // 30% discovery chance per hex
  if (rand > 0.3) return null;

  return {
    type: 'kingdom',
    hex_col: hexCol,
    hex_row: hexRow,
    discovered_turn: kingdom.turn || 0,
  };
}

/**
 * Determine if a location (artifact, loot, etc.) is discovered in a hex.
 *
 * Discovery chance: ~15% per hex.
 *
 * @param {number} hexCol - Hex column
 * @param {number} hexRow - Hex row
 * @param {object} kingdom - Kingdom object
 * @returns {object|null} Discovery object or null if no discovery
 */
function rollLocationDiscovery(hexCol, hexRow, kingdom) {
  if (!kingdom || !kingdom.id) return null;

  const seed = (hexCol * 2000 + hexRow + 7) ^ (kingdom.id * 13);
  const pseudo = Math.cos(seed * 0.5) * 10000;
  const rand = pseudo - Math.floor(pseudo);

  // 15% discovery chance per hex
  if (rand > 0.15) return null;

  return {
    type: 'location',
    hex_col: hexCol,
    hex_row: hexRow,
    discovered_turn: kingdom.turn || 0,
  };
}

/**
 * Process all discoveries along an Epic Trek path.
 * Called after expedition completes to reveal what was found.
 *
 * @param {Array} pathHexes - List of {col, row} hexes along path
 * @param {object} kingdom - Kingdom object
 * @returns {Array} Array of discovery results
 */
function processPathDiscoveries(pathHexes, kingdom) {
  if (!Array.isArray(pathHexes) || pathHexes.length === 0) {
    return [];
  }

  const discoveries = [];

  for (const hex of pathHexes) {
    const kingdomDisc = rollKingdomDiscovery(hex.col, hex.row, kingdom);
    if (kingdomDisc) discoveries.push(kingdomDisc);

    const locationDisc = rollLocationDiscovery(hex.col, hex.row, kingdom);
    if (locationDisc) discoveries.push(locationDisc);
  }

  return discoveries;
}

module.exports = {
  rollKingdomDiscovery,
  rollLocationDiscovery,
  processPathDiscoveries,
};
