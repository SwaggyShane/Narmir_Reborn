require('dotenv').config();
const { initDb } = require('./db/schema');
const { safeJsonParse } = require('./utils/helpers');
const { cellIndexToColRow } = require('./game/visibility-cells');

(async () => {
  const db = await initDb();
  const k11 = await db.get('SELECT id, race, visibility FROM kingdoms WHERE id = 11');

  if (!k11) {
    console.log('Kingdom 11 not found');
    process.exit(1);
  }

  const vis = safeJsonParse(k11.visibility, { seen_cells: '0', current_cells: '0' });
  console.log('Kingdom 11 visibility after stride migration:');
  console.log(`  race: ${k11.race}`);
  console.log(`  seen_cells: ${vis.seen_cells}`);
  console.log(`  current_cells: ${vis.current_cells}`);

  if (vis.seen_cells && vis.seen_cells !== '0') {
    const bitmap = BigInt(vis.seen_cells);
    let index = 0;
    let found = false;
    while ((1n << BigInt(index)) <= bitmap && index < 10000) {
      if ((bitmap & (1n << BigInt(index))) !== 0n) {
        const { col, row } = cellIndexToColRow(index);
        console.log(`  First visible cell: index=${index} -> hex (${col}, ${row})`);
        found = true;
        break;
      }
      index++;
    }
    if (!found) console.log('  (no visible cells found)');
  } else {
    console.log('  (empty - will be re-initialized on next load)');
  }

  process.exit(0);
})();
