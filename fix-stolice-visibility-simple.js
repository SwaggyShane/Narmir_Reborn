const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://narmir_dev:narmir_local_dev@localhost:5432/narmir_local'
});

(async () => {
  try {
    const kingdom = await pool.query(
      "SELECT id, race, visibility FROM kingdoms WHERE name = 'Stolice'"
    );

    if (kingdom.rows.length === 0) {
      console.log('Kingdom not found');
      process.exit(1);
    }

    const k = kingdom.rows[0];
    console.log('Found kingdom:', k.id, 'race:', k.race);

    const current = JSON.parse(k.visibility);

    // Hardcoded home hex for dwarf: (5, 8)
    // The home bitmap should be very small - just the home hex bit set
    // For now, let's just set current_cells to '0' to start fresh
    // OR calculate it properly

    // From the server code, home bitmap for dwarf should be just the home hex
    // We'll calculate it: the home hex is (5, 8), which maps to a cell index
    // Cell index = (row + OFFSET) * STRIDE + (col + OFFSET)
    // With STRIDE=48, OFFSET=8:
    // idx = (8 + 8) * 48 + (5 + 8) = 16 * 48 + 13 = 768 + 13 = 781
    const homeIdx = 781;
    const homeBitmap = (1n << BigInt(homeIdx)).toString();

    console.log('Setting current_cells to home hex bitmap:', homeBitmap);

    const fixed = {
      seen_cells: current.seen_cells,  // Keep all discoveries
      current_cells: homeBitmap,       // Reset to just home hex
      version: current.version || 1
    };

    await pool.query(
      'UPDATE kingdoms SET visibility = $1 WHERE id = $2',
      [JSON.stringify(fixed), k.id]
    );

    console.log('\n✓ Fixed! Visibility corrected.');
    console.log('Reload the game and test the modal map now.');

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
