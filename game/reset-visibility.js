require('dotenv').config();

const { initDb } = require('../db/schema');

(async () => {
  try {
    const db = await initDb({ maxPool: 5, minPool: 1 });
    
    console.log('✅ Connected to database');
    console.log('Resetting visibility bitmaps for all kingdoms...\n');
    
    const result = await db.pool.query(`
      UPDATE kingdoms 
      SET visibility = '{"seen_cells":"0","current_cells":"0","version":1}'
      WHERE visibility IS NOT NULL;
    `);
    
    console.log(`✅ Updated ${result.rowCount} kingdoms\n`);
    
    const verify = await db.pool.query(`
      SELECT COUNT(*) as reset_count 
      FROM kingdoms 
      WHERE visibility = '{"seen_cells":"0","current_cells":"0","version":1}';
    `);
    
    console.log(`✅ Verification: ${verify.rows[0].reset_count} kingdoms have visibility reset to zero`);
    console.log('✅ Migration complete - home hex visibility will auto-calculate on next visit\n');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
