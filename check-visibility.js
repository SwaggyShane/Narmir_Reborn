const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://narmir_dev:narmir_local_dev@localhost:5432/narmir_local'
});

(async () => {
  try {
    const result = await pool.query(
      "SELECT id, name, race, visibility FROM kingdoms WHERE name = 'Stolice'"
    );
    if (result.rows.length === 0) {
      console.log('No kingdoms found');
    } else {
      const kingdom = result.rows[0];
      console.log('Kingdom:', kingdom.id, kingdom.name, kingdom.race);
      console.log('Visibility JSON:');
      console.log(JSON.stringify(JSON.parse(kingdom.visibility), null, 2));
    }
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
