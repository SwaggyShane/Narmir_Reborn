require('dotenv').config();
const { initDb } = require('../db/schema');
const { pixelToHex } = require('./hex-utils');
const { getKingdomMapCoords } = require('./world-map-coords');
const { cellIndex, encodeCellSet } = require('./visibility-cells');

(async () => {
  const db = await initDb({ maxPool: 2, minPool: 1 });
  
  // Step 1: Clear ALL kingdoms' visibility
  await db.pool.query(`UPDATE kingdoms SET visibility = '{"seen_cells":"0","current_cells":"0","version":1}'`);
  console.log('✅ Cleared all kingdoms\' visibility\n');
  
  // Step 2: Recalculate and save kingdom 1's home hex
  const k = { id: 1, race: 'dwarf' };
  const coords = getKingdomMapCoords(k);
  const hex = pixelToHex(coords.map_x, coords.map_y);
  const idx = cellIndex(hex.col, hex.row);
  const bitmap = encodeCellSet([idx]);
  
  console.log(`Kingdom 1 (Stolice):`);
  console.log(`  Coordinates: x=${coords.map_x}, y=${coords.map_y}`);
  console.log(`  Home hex: col=${hex.col}, row=${hex.row}`);
  console.log(`  cellIndex: ${idx}`);
  console.log(`  Bitmap: ${bitmap.toString()}`);
  
  const visibilityJson = JSON.stringify({
    seen_cells: bitmap.toString(),
    current_cells: bitmap.toString(),
    version: 1
  });
  
  await db.pool.query(
    'UPDATE kingdoms SET visibility = $1 WHERE id = $2',
    [visibilityJson, 1]
  );
  
  console.log(`\n✅ Saved home hex to kingdom 1`);
  process.exit(0);
})().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
