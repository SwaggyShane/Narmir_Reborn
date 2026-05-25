#!/usr/bin/env node
/**
 * Admin script to wipe all human player accounts.
 * Preserves admin and AI accounts.
 *
 * Usage: ADMIN_SECRET=your_secret node admin-wipe-players.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const ADMIN_SECRET = process.env.ADMIN_SECRET;
if (!ADMIN_SECRET) {
  console.error('❌ Error: ADMIN_SECRET environment variable is required');
  process.exit(1);
}

if (process.argv[2] !== ADMIN_SECRET) {
  console.error('❌ Error: Invalid admin secret');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function wipePlayerAccounts() {
  const client = await pool.connect();
  try {
    console.log('🗑️  Starting player account wipe...\n');

    await client.query('BEGIN');

    // Get count of accounts to delete
    const playersToDelete = await client.query(`
      SELECT id, username FROM players
      WHERE is_admin = 0 AND is_ai = 0
    `);

    console.log(`Found ${playersToDelete.rows.length} human player account(s):`);
    playersToDelete.rows.forEach(row => {
      console.log(`  • ${row.username}`);
    });

    if (playersToDelete.rows.length === 0) {
      console.log('\n✅ No accounts to delete');
      await client.query('ROLLBACK');
      return;
    }

    // Delete kingdoms first (foreign key constraint)
    const kingdomsDeleted = await client.query(`
      DELETE FROM kingdoms
      WHERE player_id IN (
        SELECT id FROM players
        WHERE is_admin = 0 AND is_ai = 0
      )
    `);
    console.log(`\n✅ Deleted ${kingdomsDeleted.rowCount} kingdom(s)`);

    // Delete the player accounts
    const playersDeleted = await client.query(`
      DELETE FROM players
      WHERE is_admin = 0 AND is_ai = 0
    `);
    console.log(`✅ Deleted ${playersDeleted.rowCount} player account(s)`);

    await client.query('COMMIT');
    console.log('\n🎉 Successfully wiped all human player accounts');

    // Show remaining accounts
    const remaining = await client.query(`
      SELECT username, is_admin, is_ai FROM players ORDER BY username
    `);
    console.log(`\n📋 Remaining accounts (${remaining.rows.length}):`);
    remaining.rows.forEach(row => {
      const type = row.is_admin ? 'ADMIN' : row.is_ai ? 'AI' : 'ERROR';
      console.log(`  [${type}] ${row.username}`);
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

wipePlayerAccounts();
