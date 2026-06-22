require('dotenv').config();

const { initDb, repairJsonRows } = require('../db/schema');

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to run the JSON repair command.');
  }
  const db = await initDb();
  const result = await repairJsonRows(db);
  console.log(`[repair-json] Fixed ${result.fixedCells} JSON cells across ${result.fixedRows} rows.`);
}

main().catch((err) => {
  console.error('[repair-json] Failed:', err);
  process.exitCode = 1;
});
