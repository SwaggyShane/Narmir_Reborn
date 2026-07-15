require('dotenv').config();
const { initDb } = require('../db/schema');

(async () => {
  const db = await initDb({ maxPool: 2, minPool: 1 });
  
  const result = await db.pool.query(`SELECT id, visibility FROM kingdoms WHERE id = 1`);
  const k = result.rows[0];
  
  const vis = JSON.parse(k.visibility);
  const bitmap = BigInt(vis.seen_cells);
  
  console.log('Database visibility for kingdom 1:');
  console.log(`seen_cells: ${vis.seen_cells}`);
  
  // Find all set bits
  const bits = [];
  for (let i = 0; i < 1000; i++) {
    if ((bitmap & (1n << BigInt(i))) !== 0n) {
      bits.push(i);
    }
  }
  
  console.log(`\nSet bits: ${bits.join(', ')}`);
  
  // Decode col=5, row=4 (should be 589)
  const idx589 = (12 * 48) + 13;
  console.log(`\nBit 589 is ${(bitmap & (1n << BigInt(idx589))) !== 0n ? 'SET' : 'NOT SET'}`);
  console.log(`Bit 633 is ${(bitmap & (1n << BigInt(633))) !== 0n ? 'SET' : 'NOT SET'}`);
  
  process.exit(0);
})();
