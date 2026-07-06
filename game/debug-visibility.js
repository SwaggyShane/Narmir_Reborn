require('dotenv').config();
const { initDb } = require('../db/schema');
const { cellIndexToColRow } = require('./visibility-cells');

(async () => {
  try {
    const db = await initDb({ maxPool: 5, minPool: 1 });
    
    const result = await db.pool.query(`
      SELECT id, visibility FROM kingdoms WHERE id = 1;
    `);
    
    const k = result.rows[0];
    const vis = JSON.parse(k.visibility);
    
    console.log(`\n=== KINGDOM 1 VISIBILITY DEBUG ===`);
    console.log(`Raw seen_cells: ${vis.seen_cells}`);
    
    // Find all set bits in the bitmap
    const bitmap = BigInt(vis.seen_cells);
    const setBits = [];
    
    for (let i = 0; i < 1024; i++) {
      if ((bitmap & (1n << BigInt(i))) !== 0n) {
        setBits.push(i);
      }
    }
    
    console.log(`\nSet bits (up to 1024): ${setBits.join(', ')}`);
    
    if (setBits.length > 0) {
      console.log(`\nDecoded hexes (stride 48):`);
      setBits.forEach(bit => {
        const decoded = cellIndexToColRow(bit);
        console.log(`  Bit ${bit} → col=${decoded.col}, row=${decoded.row}`);
      });
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
