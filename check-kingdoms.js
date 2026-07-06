require('dotenv').config();
const { initDb } = require('./db/schema');

(async () => {
  const db = await initDb();
  const count = await db.get('SELECT COUNT(*) as cnt FROM kingdoms');
  console.log(`Total kingdoms: ${count?.cnt || 'unknown'}`);
  
  const k11 = await db.get('SELECT id, player_id, race FROM kingdoms WHERE id = 11');
  console.log('Kingdom 11:', k11);
  
  const first5 = await db.all('SELECT id, player_id, race FROM kingdoms LIMIT 5');
  console.log('First 5 kingdoms:', first5);
  
  process.exit(0);
})();
