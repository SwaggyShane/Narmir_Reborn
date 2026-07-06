/**
 * Fix kingdom 1's visibility to show home hex (col=1, row=5).
 * Run: node game/fix-kingdom-1-visibility.js
 */

require('dotenv').config();
const { initDb } = require('../db/schema');
const { cellIndex, encodeCellSet, decodeCellSet } = require('./visibility-cells');

(async () => {
  const db = await initDb({ maxPool: 2, minPool: 1 });

  try {
    // Get current visibility
    const result = await db.pool.query('SELECT id, visibility FROM kingdoms WHERE id = 1');
    if (result.rows.length === 0) {
      console.log('Kingdom 1 not found');
      process.exit(1);
    }

    const currentVis = JSON.parse(result.rows[0].visibility);
    const currentBits = decodeCellSet(BigInt(currentVis.current_cells));
    console.log('Current visibility bits:', currentBits);

    // Set to home hex (col=1, row=5 = bit 633)
    const homeHexBit = cellIndex(1, 5);
    console.log(`Home hex: col=1, row=5 = bit ${homeHexBit}`);

    const bitmap = encodeCellSet([homeHexBit]);
    const newVis = JSON.stringify({
      seen_cells: bitmap.toString(),
      current_cells: bitmap.toString(),
      version: 1,
    });

    await db.pool.query('UPDATE kingdoms SET visibility = $1 WHERE id = 1', [newVis]);

    // Verify
    const verify = await db.pool.query('SELECT visibility FROM kingdoms WHERE id = 1');
    const verifyVis = JSON.parse(verify.rows[0].visibility);
    const verifyBits = decodeCellSet(BigInt(verifyVis.current_cells));

    console.log('Updated visibility bits:', verifyBits);
    console.log('✓ Kingdom 1 visibility fixed to home hex');

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
