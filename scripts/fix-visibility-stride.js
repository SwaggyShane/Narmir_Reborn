#!/usr/bin/env node
/**
 * Admin script: Migrate visibility bitmaps from stride-32 to stride-48.
 *
 * Run after updating CELL_INDEX_STRIDE in visibility-cells.js
 * Usage: node scripts/fix-visibility-stride.js
 */

require('dotenv').config();
const { initDb } = require('../db/schema');
const { migrateVisibilityBitmap } = require('../game/migrate-visibility-stride');
const { safeJsonParse } = require('../utils/helpers');

(async () => {
  const db = await initDb();

  try {
    console.log('🔄 Fetching all kingdoms with visibility data...');
    const kingdoms = await db.all(
      'SELECT id, visibility FROM kingdoms WHERE visibility IS NOT NULL AND visibility != \'0\''
    );

    if (kingdoms.length === 0) {
      console.log('✅ No kingdoms with visibility data to migrate');
      process.exit(0);
    }

    console.log(`Found ${kingdoms.length} kingdoms to migrate\n`);

    let migrated = 0;
    let unchanged = 0;
    let errors = 0;

    for (const kingdom of kingdoms) {
      const vis = safeJsonParse(kingdom.visibility, { seen_cells: '0', current_cells: '0', version: 1 }, 'auto:visibility');

      // Migrate both seen_cells and current_cells
      const newSeenCells = migrateVisibilityBitmap(vis.seen_cells || '0');
      const newCurrentCells = migrateVisibilityBitmap(vis.current_cells || '0');

      // Check if anything changed
      if (newSeenCells === (vis.seen_cells || '0') && newCurrentCells === (vis.current_cells || '0')) {
        unchanged++;
        continue;
      }

      const newVis = JSON.stringify({
        seen_cells: newSeenCells,
        current_cells: newCurrentCells,
        version: vis.version || 1,
      });

      try {
        await db.run('UPDATE kingdoms SET visibility = $1 WHERE id = $2', [newVis, kingdom.id]);
        migrated++;
        if (kingdom.id === 11) {
          console.log(`  ✓ K11: seen_cells ${vis.seen_cells || '0'} → ${newSeenCells}`);
        }
      } catch (err) {
        console.error(`  ✗ K${kingdom.id}: ${err.message}`);
        errors++;
      }
    }

    console.log(`\n📊 Migration complete:`);
    console.log(`  • Migrated: ${migrated}`);
    console.log(`  • Unchanged: ${unchanged}`);
    console.log(`  • Errors: ${errors}`);

    const k11 = kingdoms.find(k => k.id === 11);
    if (k11 && migrated > 0) {
      console.log(`\n✅ Kingdom 11 visibility migrated! Restart the server and check the fog of war.`);
    }

    process.exit(errors > 0 ? 1 : 0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
})();
