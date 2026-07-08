#!/usr/bin/env node
/**
 * Admin script to wipe all human player accounts.
 * Preserves admin and AI accounts.
 *
 * Usage: ADMIN_SECRET=your_secret node admin-wipe-players.js
 * Note: Pass secret via environment variable only (not command-line args for security)
 */

require('dotenv').config();
const { Pool } = require('pg');

const ADMIN_SECRET = process.env.ADMIN_SECRET;
const CONFIRM_SECRET = process.env.CONFIRM_SECRET;

if (!ADMIN_SECRET) {
  console.error('❌ Error: ADMIN_SECRET environment variable is required');
  process.exit(1);
}

// Require explicit confirmation via environment variable for safety
if (CONFIRM_SECRET !== ADMIN_SECRET) {
  console.error('❌ Error: Must set CONFIRM_SECRET=ADMIN_SECRET to confirm wipe');
  console.error('   Usage: ADMIN_SECRET=xxx CONFIRM_SECRET=xxx node admin-wipe-players.js');
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
      WHERE is_admin = 0    `);

    console.log(`Found ${playersToDelete.rows.length} human player account(s):`);
    playersToDelete.rows.forEach(row => {
      console.log(`  • ${row.username}`);
    });

    if (playersToDelete.rows.length === 0) {
      console.log('\n✅ No accounts to delete');
      await client.query('ROLLBACK');
      return;
    }

    // Delete all dependent records in order (foreign key constraints)
    const tables = [
      { name: 'messages', col: 'sender_id' },
      { name: 'messages', col: 'recipient_id' },
      { name: 'bounties', col: 'posted_by' },
      { name: 'chat_messages', col: 'player_id' },
      { name: 'heroes', col: 'player_id' },
      { name: 'news', col: 'player_id' },
      { name: 'kingdoms', col: 'player_id' },
    ];

    let totalDeleted = 0;
    for (const table of tables) {
      try {
        const result = await client.query(`
          DELETE FROM ${table.name}
          WHERE ${table.col} IN (
            SELECT id FROM players
            WHERE is_admin = 0          )
        `);
        if (result.rowCount > 0) {
          console.log(`✅ Deleted ${result.rowCount} record(s) from ${table.name}`);
          totalDeleted += result.rowCount;
        }
      } catch (err) {
        // Table might not exist or might already be empty
        if (!err.message.includes('does not exist')) {
          throw err;
        }
      }
    }

    // Delete the player accounts
    const playersDeleted = await client.query(`
      DELETE FROM players
      WHERE is_admin = 0    `);
    console.log(`✅ Deleted ${playersDeleted.rowCount} player account(s)`);
    totalDeleted += playersDeleted.rowCount;

    await client.query('COMMIT');
    console.log(`\n🎉 Successfully wiped all human player accounts (${totalDeleted} total records deleted)`);

    // Fog of War Phase 1.5: regenerate the world seed so kingdom/resource-node
    // placement (game/world-map-coords.js) produces a different layout after
    // this reset. The running server process caches the seed in memory and
    // only reloads it at boot (game/world-seed.js), so this alone has no
    // effect until the server is restarted — expected for this alpha, which
    // resets via wipe + restart together, not a live reload.
    const newSeed = await client.query(`
      UPDATE world_state SET seed = FLOOR(RANDOM() * 9007199254740991)::BIGINT, generated_at = FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER
      WHERE id = 1
      RETURNING seed
    `);
    if (newSeed.rows.length) {
      console.log(`🌱 World seed regenerated: ${newSeed.rows[0].seed} (restart the server to apply)`);
    } else {
      console.warn('⚠️  world_state row missing — world seed was not regenerated. Restart will keep the previous layout.');
    }

    // Show remaining accounts
    const remaining = await client.query(`
      SELECT username, is_admin FROM players ORDER BY username
    `);
    console.log(`\n📋 Remaining accounts (${remaining.rows.length}):`);
    remaining.rows.forEach(row => {
      const type = row.is_admin ? 'ADMIN' : 'PLAYER';
      console.log(`  [${type}] ${row.username}`);
    });

  } catch (err) {
    try {
      await client.query('ROLLBACK');
      // eslint-disable-next-line no-unused-vars
    } catch (_rollbackErr) {
      // Ignore rollback errors
    }
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    try {
      await pool.end();
    } catch (poolErr) {
      console.error('Warning: Error closing connection pool:', poolErr.message);
    }
  }
}

wipePlayerAccounts();
