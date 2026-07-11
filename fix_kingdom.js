require('dotenv').config();
const pg = require('pg');
const url = process.env.DATABASE_URL || 'postgresql://narmir_dev:narmir_local_dev@localhost:5432/narmir_local';

const client = new pg.Client(url);

client.connect().then(async () => {
  const result = await client.query(
    "UPDATE kingdoms SET build_allocation = $1, resource_build_allocation = $1, training_allocation = $1, scout_allocation = 0 WHERE id = 1 RETURNING id, name",
    [JSON.stringify({})]
  );
  
  if (result.rows.length > 0) {
    console.log('✅ FIXED! Cleared all engineer allocations for:', result.rows[0].name);
  } else {
    console.log('❌ Kingdom not found');
  }
  
  await client.end();
}).catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
