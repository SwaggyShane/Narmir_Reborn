/**
 * Fix kingdom 1's visibility to show its *correct* computed home hex.
 * (Previously hardcoded a stale col/row that could be wrong after map/seed changes.)
 * Run: node game/fix-kingdom-1-visibility.js
 */

require('dotenv').config();
const { initDb } = require('../db/schema');
const { cellIndex, encodeCellSet, decodeCellSet } = require('./visibility-cells');
const { getKingdomMapCoords } = require('./world-map-coords');
const { pixelToHex } = require('./hex-utils');

(async () => {
  const db = await initDb({ maxPool: 2, minPool: 1 });

  try {
    // Get current visibility + race
    const kingdom = await db.get('SELECT id, race, visibility FROM kingdoms WHERE id = 1');
    if (!kingdom) {
      console.log('Kingdom 1 not found');
      process.exit(1);
    }

    const currentVis = JSON.parse(kingdom.visibility || '{}');
    const currentBits = decodeCellSet(BigInt(currentVis.current_cells || '0'));
    console.log('Current visibility bits:', currentBits);

    // Compute the authoritative home hex for this kingdom (using its race + current world seed)
    const coords = getKingdomMapCoords({ id: 1, race: kingdom.race });
    const homeHex = pixelToHex(coords.map_x, coords.map_y);
    const homeHexBit = cellIndex(homeHex.col, homeHex.row);
    console.log(`Kingdom coords: x=${coords.map_x}, y=${coords.map_y}`);
    console.log(`Computed home hex: col=${homeHex.col}, row=${homeHex.row} (bit ${homeHexBit})`);

    // Preserve other fields (highest_completed_ring etc), just correct the cells to include home.
    // Use | so we don't wipe legitimately scouted cells; home is forced in.
    const homeBitmap = encodeCellSet([homeHexBit]);
    const correctedSeen = (BigInt(currentVis.seen_cells || '0') | homeBitmap).toString();
    const correctedCurrent = (BigInt(currentVis.current_cells || '0') | homeBitmap).toString();

    const newVis = JSON.stringify({
      ...currentVis,
      seen_cells: correctedSeen,
      current_cells: correctedCurrent,
      version: currentVis.version || 1,
    });

    await db.run('UPDATE kingdoms SET visibility = $1 WHERE id = $2', [newVis, 1]);

    // Verify
    const verify = await db.get('SELECT visibility FROM kingdoms WHERE id = 1');
    const verifyVis = JSON.parse(verify.visibility);
    const verifyBits = decodeCellSet(BigInt(verifyVis.current_cells));

    console.log('Updated visibility bits:', verifyBits);
    console.log('✓ Kingdom 1 visibility corrected to its computed home hex (preserved other bits)');

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
