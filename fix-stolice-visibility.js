const { Pool } = require('pg');
const { getKingdomMapCoords } = require('./game/world-map-coords');
const { pixelToHex, encodeCellSet, cellIndex } = require('./game/visibility-migration');

const pool = new Pool({
  connectionString: 'postgresql://narmir_dev:narmir_local_dev@localhost:5432/narmir_local'
});

(async () => {
  try {
    // Get Stolice kingdom
    const kingdom = await pool.query(
      "SELECT id, race, visibility FROM kingdoms WHERE name = 'Stolice'"
    );

    if (kingdom.rows.length === 0) {
      console.log('Kingdom not found');
      process.exit(1);
    }

    const k = kingdom.rows[0];
    console.log('Found kingdom:', k.id, 'race:', k.race);

    // Parse current visibility
    const current = JSON.parse(k.visibility);
    console.log('Current visibility:');
    console.log('  seen_cells:', current.seen_cells);
    console.log('  current_cells:', current.current_cells);

    // Get the home hex
    const homeCoords = getKingdomMapCoords({ id: k.id, race: k.race });
    console.log('Home coordinates:', homeCoords);

    // Calculate home hex bitmap
    const homeHex = pixelToHex(homeCoords.map_x, homeCoords.map_y);
    console.log('Home hex:', homeHex.col, homeHex.row);
    const homeIdx = cellIndex(homeHex.col, homeHex.row);
    const homeBitmap = encodeCellSet([homeIdx]);
    console.log('Home hex bitmap:', homeBitmap.toString());

    // Fix: keep seen_cells, reset current_cells to home only
    const fixed = {
      seen_cells: current.seen_cells,  // Keep discoveries
      current_cells: homeBitmap.toString(),  // Reset to home hex
      version: current.version || 1
    };

    // Update database
    await pool.query(
      'UPDATE kingdoms SET visibility = $1 WHERE id = $2',
      [JSON.stringify(fixed), k.id]
    );

    console.log('\nFixed! New visibility:');
    console.log('  seen_cells:', fixed.seen_cells, '(unchanged)');
    console.log('  current_cells:', fixed.current_cells, '(reset to home hex)');
    console.log('\nYou can now reload the game and test the modal map.');

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
