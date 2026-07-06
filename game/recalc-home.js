require('dotenv').config();
const { initDb } = require('../db/schema');
const { pixelToHex } = require('./hex-utils');
const { getKingdomMapCoords } = require('./world-map-coords');
const { cellIndex, cellIndexToColRow, encodeCellSet } = require('./visibility-cells');

(async () => {
  const db = await initDb({ maxPool: 2, minPool: 1 });
  
  const k = { id: 1, race: 'dwarf' };
  
  const coords = getKingdomMapCoords(k);
  console.log(`\nKingdom coordinates: x=${coords.map_x}, y=${coords.map_y}`);
  
  const hex = pixelToHex(coords.map_x, coords.map_y);
  console.log(`pixelToHex result: col=${hex.col}, row=${hex.row}`);
  
  const idx = cellIndex(hex.col, hex.row);
  console.log(`cellIndex(${hex.col}, ${hex.row}) = ${idx}`);
  
  // Verify: convert back
  const decoded = cellIndexToColRow(idx);
  console.log(`cellIndexToColRow(${idx}) = col=${decoded.col}, row=${decoded.row}`);
  
  // Create the correct bitmap
  const bitmap = encodeCellSet([idx]);
  console.log(`\nBitmap for home hex: ${bitmap.toString()}`);
  
  // Save it
  const visibilityJson = JSON.stringify({
    seen_cells: bitmap.toString(),
    current_cells: bitmap.toString(),
    version: 1
  });
  
  await db.pool.query(
    'UPDATE kingdoms SET visibility = $1 WHERE id = $2',
    [visibilityJson, 1]
  );
  
  console.log(`\n✅ Saved correct visibility bitmap to database`);
  process.exit(0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
