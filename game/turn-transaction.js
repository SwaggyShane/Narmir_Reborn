// game/turn-transaction.js
// Slice 4: Transaction wrapper for atomic turn processing (Phase 2, Tier 3).
// Ensures that if anything fails, the entire turn is rolled back.
// Collects events into outbox for guaranteed delivery.

const eventBus = require('./event-bus');

/**
 * Wrap a turn execution in an explicit database transaction.
 *
 * Pattern:
 * 1. BEGIN transaction
 * 2. Execute processTurn
 * 3. Write updates to kingdoms table
 * 4. INSERT events to outbox table
 * 5. COMMIT (atomic: all-or-nothing)
 * 6. Async: Process outbox events (won't block turn response)
 *
 * @param {object} db - Database connection
 * @param {object} kingdom - Kingdom state
 * @param {function} processTurn - Callback to execute within transaction
 * @returns {object} { updates, events }
 */
async function executeTurnInTransaction(db, kingdom, processTurn) {
  const startTime = Date.now();

  try {
    // 1. BEGIN transaction
    console.log(`[turn-tx-${kingdom.id}] BEGIN`);
    await db.run('BEGIN');

    // 2. Execute processTurn callback
    console.log(`[turn-tx-${kingdom.id}] processTurn`);
    const { updates, events } = await processTurn();

    // 3. Write updates to database
    console.log(`[turn-tx-${kingdom.id}] apply updates`);
    const sqlUpdates = buildUpdateSQL(updates);
    await db.run(sqlUpdates.sql, [...sqlUpdates.params, kingdom.id]);

    // 4. INSERT events to outbox (for guaranteed delivery)
    console.log(`[turn-tx-${kingdom.id}] write outbox (${events.length} events)`);
    if (events.length > 0) {
      for (const event of events) {
        await db.run(
          `INSERT INTO outbox (event_type, payload, created_at)
           VALUES ($1, $2, NOW())`,
          [event.type, JSON.stringify(event)]
        );
      }
    }

    // 5. COMMIT (atomic)
    console.log(`[turn-tx-${kingdom.id}] COMMIT`);
    await db.run('COMMIT');

    const elapsedMs = Date.now() - startTime;
    console.log(`[turn-tx-${kingdom.id}] Success (${elapsedMs}ms)`);

    // 6. Async: Process outbox events (don't block)
    // In real impl, this would be a background job
    // For now, just note that events are guaranteed to be in DB

    return { updates, events, transactionTime: elapsedMs };

  } catch (error) {
    // Any error: ROLLBACK everything
    console.error(`[turn-tx-${kingdom.id}] ERROR: ${error.message}`);
    try {
      await db.run('ROLLBACK');
    } catch (rbErr) {
      console.error(`[turn-tx-${kingdom.id}] ROLLBACK failed: ${rbErr.message}`);
    }
    throw error;
  }
}

/**
 * Build SQL UPDATE statement from updates object.
 * @param {object} updates - { field: value, ... }
 * @returns {object} { sql: "UPDATE...", params: [...] }
 */
function buildUpdateSQL(updates) {
  const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'player_id');
  if (fields.length === 0) {
    return { sql: 'UPDATE kingdoms SET updated_at = NOW() WHERE id = $1', params: [] };
  }

  const setClauses = fields.map((field, idx) => {
    const value = updates[field];
    // Stringify JSON fields
    const jsonFields = ['troop_levels', 'build_queue', 'active_effects', 'collected_lore'];
    if (jsonFields.includes(field) && typeof value === 'object') {
      return `${field} = $${idx + 1}::jsonb`;
    }
    return `${field} = $${idx + 1}`;
  });

  const params = fields.map(field => {
    const value = updates[field];
    const jsonFields = ['troop_levels', 'build_queue', 'active_effects', 'collected_lore'];
    if (jsonFields.includes(field) && typeof value === 'object') {
      return JSON.stringify(value);
    }
    return value;
  });

  const sql = `UPDATE kingdoms SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${fields.length + 1}`;

  return { sql, params };
}

/**
 * Initialize outbox table (migration).
 * @param {object} db - Database connection
 */
async function initializeOutboxTable(db) {
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS outbox (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(255) NOT NULL,
        payload JSONB NOT NULL,
        processed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        processed_at TIMESTAMP
      )
    `);
    console.log('[outbox] Table initialized');
  } catch (err) {
    console.error('[outbox] Failed to initialize:', err.message);
  }
}

module.exports = {
  executeTurnInTransaction,
  buildUpdateSQL,
  initializeOutboxTable,
};
