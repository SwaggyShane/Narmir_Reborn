#!/usr/bin/env node
/**
 * Migration: Fix INTEGER column types for PostgreSQL
 *
 * SQLite was lenient with type conversions, but PostgreSQL is strict.
 * This migration converts INTEGER columns that store decimal values to NUMERIC.
 *
 * Usage: node migrate-sqlite-to-postgres.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('🔧 Starting PostgreSQL migration...\n');

    await client.query('BEGIN');

    // Define columns to migrate: [table, column]
    const columnsToMigrate = [
      // kingdoms table - resource values
      ['kingdoms', 'gold'],
      ['kingdoms', 'mana'],
      ['kingdoms', 'turn'],
      ['kingdoms', 'xp'],
      ['kingdoms', 'research_progress'],
      ['kingdoms', 'population'],
      ['kingdoms', 'morale'],
      ['kingdoms', 'tax'],
      ['kingdoms', 'land'],
      ['kingdoms', 'food'],
      ['kingdoms', 'food_surplus_turns'],
      ['kingdoms', 'food_shortage_turns'],
      ['kingdoms', 'turns_stored'],
      // heroes table
      ['heroes', 'xp'],
      // expeditions table
      ['expeditions', 'progress'],
    ];

    for (const [table, column] of columnsToMigrate) {
      try {
        // Check if column exists and is INTEGER
        const result = await client.query(`
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_name = $1 AND column_name = $2
        `, [table, column]);

        if (result.rows.length === 0) {
          console.log(`⏭️  ${table}.${column} does not exist, skipping`);
          continue;
        }

        const currentType = result.rows[0].data_type;
        if (currentType === 'numeric' || currentType === 'NUMERIC') {
          console.log(`✅ ${table}.${column} is already NUMERIC`);
          continue;
        }

        // Alter the column type
        console.log(`🔄 Converting ${table}.${column} from ${currentType} to NUMERIC...`);

        // For columns with constraints, we may need to handle them carefully
        const alterSQL = `
          ALTER TABLE ${table}
          ALTER COLUMN ${column}
          TYPE NUMERIC USING ${column}::NUMERIC
        `;

        await client.query(alterSQL);
        console.log(`✅ Converted ${table}.${column} to NUMERIC`);

      } catch (err) {
        if (err.message.includes('does not exist')) {
          console.log(`⏭️  ${table}.${column} does not exist, skipping`);
        } else {
          console.error(`❌ Error converting ${table}.${column}:`, err.message);
          throw err;
        }
      }
    }

    await client.query('COMMIT');
    console.log('\n✅ Migration completed successfully!');
    console.log('\nSummary:');
    console.log('- All INTEGER columns that store decimal values are now NUMERIC');
    console.log('- This allows storing decimal values like 11608.156299');
    console.log('- Registration and turn processing should now work correctly');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
