require('dotenv').config();
const { initDb } = require('../db/schema');
const { pixelToHex } = require('./hex-utils');
const { cellIndex, encodeCellSet } = require('./visibility-cells');
const { getKingdomMapCoords } = require('./world-map-coords');

(async () => {
  try {
    const db = await initDb({ maxPool: 5, minPool: 1 });
    
    const k = { id: 1, race: 'dwarf' };
    
    // Calculate home hex
    const coords = getKingdomMapCoords(k);
    const homeHex = pixelToHex(coords.map_x, coords.map_y);
    const homeIndex = cellIndex(homeHex.col, homeHex.row);
    
    console.log(`\n=== FIXING KINGDOM 1 VISIBILITY ===`);
    console.log(`Home coordinates: x=${coords.map_x}, y=${coords.map_y}`);
    console.log(`Home hex: col=${homeHex.col}, row=${homeHex.row}`);
    console.log(`Home cellIndex: ${homeIndex}`);
    
    // Create bitmap with home hex revealed
    const bitmap = encodeCellSet([homeIndex]);
    console.log(`Bitmap value: ${bitmap.toString()}`);
    
    // Save to database
    const visibilityJson = JSON.stringify({
      seen_cells: bitmap.toString(),
      current_cells: bitmap.toString(),
      version: 1
    });
    
    const result = await db.pool.query(
      'UPDATE kingdoms SET visibility = $1 WHERE id = $2',
      [visibilityJson, 1]
    );
    
    console.log(`\n✅ Updated ${result.rowCount} kingdom`);
    console.log(`\nVisibility saved:${visibilityJson}`);
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
