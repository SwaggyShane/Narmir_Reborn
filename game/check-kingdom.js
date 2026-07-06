require('dotenv').config();
const { initDb } = require('../db/schema');
const { pixelToHex } = require('./hex-utils');
const { cellIndex, cellIndexToColRow } = require('./visibility-cells');
const { getKingdomMapCoords } = require('./world-map-coords');

(async () => {
  try {
    const db = await initDb({ maxPool: 5, minPool: 1 });
    
    const result = await db.pool.query(`
      SELECT id, name, race, visibility FROM kingdoms WHERE id = 1;
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ Kingdom 1 not found');
      process.exit(1);
    }
    
    const k = result.rows[0];
    console.log('\n=== KINGDOM 1 (Stolice) ===');
    console.log(`Name: ${k.name}`);
    console.log(`Race: ${k.race}`);
    
    // Parse visibility
    const vis = JSON.parse(k.visibility);
    console.log('\nVisibility state:');
    console.log(`  seen_cells: ${vis.seen_cells}`);
    console.log(`  current_cells: ${vis.current_cells}`);
    
    // Calculate expected home hex
    const coords = getKingdomMapCoords({ id: 1, race: k.race });
    console.log(`\nKingdom coordinates: x=${coords.map_x}, y=${coords.map_y}`);
    
    const homeHex = pixelToHex(coords.map_x, coords.map_y);
    console.log(`Home hex: col=${homeHex.col}, row=${homeHex.row}`);
    
    const homeIndex = cellIndex(homeHex.col, homeHex.row);
    console.log(`Home hex cellIndex: ${homeIndex}`);
    
    // Check what bits are set in seen_cells
    if (vis.seen_cells && vis.seen_cells !== '0') {
      const bitmap = BigInt(vis.seen_cells);
      const bits = [];
      for (let i = 0; i < 512; i++) {
        if ((bitmap & (1n << BigInt(i))) !== 0n) {
          bits.push(i);
        }
      }
      console.log(`\nSet bit indices in seen_cells: ${bits.join(', ')}`);
      
      console.log('\nDecoded hexes:');
      bits.forEach(bit => {
        const decoded = cellIndexToColRow(bit);
        console.log(`  Bit ${bit} → col=${decoded.col}, row=${decoded.row}`);
      });
    } else {
      console.log('\n❌ seen_cells is 0 - home hex was NOT recalculated!');
      console.log('Expected home hex to be recalculated automatically when map loads.');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err);
    process.exit(1);
  }
})();
