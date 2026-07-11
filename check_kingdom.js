require('dotenv').config();
const pg = require('pg');
const url = process.env.DATABASE_URL || 'postgresql://narmir_dev:narmir_local_dev@localhost:5432/narmir_local';

const client = new pg.Client(url);

client.connect().then(async () => {
  const result = await client.query(
    "SELECT id, name FROM kingdoms WHERE name ILIKE $1 OR name ILIKE $2 LIMIT 5",
    ['%Stieny%', '%Stolice%']
  );
  
  console.log('Found kingdoms:');
  result.rows.forEach(k => console.log(`  ID: ${k.id}, Name: "${k.name}"`));
  
  await client.end();
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
