require('dotenv').config();
const { initDb } = require('./db/schema');
const { cellIndex, encodeCellSet } = require('./game/visibility-cells');

(async () => {
  const db = await initDb();
  const bitmap = encodeCellSet([cellIndex(1, 5)]);
  const newVis = JSON.stringify({
    seen_cells: bitmap.toString(),
    current_cells: bitmap.toString(),
    version: 1,
  });
  await db.run('UPDATE kingdoms SET visibility = $1 WHERE id = $2', [newVis, 11]);
  console.log('✓ Kingdom 11 visibility fixed');
  process.exit(0);
})();