// Phase D complete: all SQL uses native PostgreSQL $1, $2, ... placeholders.

const { convertNumericFields } = require('./numeric-fields');

const { AsyncLocalStorage } = require('async_hooks');
const { EPOCH_NOW_TEXT } = require('../lib/db-sql');
const { pgSetClause } = require('../lib/pg-placeholders');
const { applyKingdomUpdates, setDefaultDb: setKingdomUpdateDb } = require('./kingdom-updates');
const { fetchTableColumnInfo, getTableColumns, getColumnType, addColumn, setDb: setColumnDb } = require('./column-utils');
const { JSON_REPAIR_SPECS, normalizeJsonForRepair } = require('./json-repair');
const transactionStorage = new AsyncLocalStorage();

// Marks a pg client that already has our transaction 'error' listener attached, so we
// add it exactly once per physical connection (not once per transaction reuse).
const TXN_ERR_HANDLER = Symbol('narmirTxnErrorHandler');

// PostgreSQL adapter preserving the small local database helper interface.
class PgDbAdapter {
  constructor(pool, isPgMem = false) {
    this.pool = pool;
    this.transactionDepth = 0;
    this.isPgMem = isPgMem;
    this.transactionStorage = transactionStorage;
    // Tracks every client checked out for a transaction: client -> { acquiredAt, store }.
    // A periodic reaper (see initDb) force-returns any client held longer than a safe
    // threshold, so a code path that forgets to COMMIT/ROLLBACK can never permanently
    // leak a pooled connection and exhaust Postgres.
    this.activeTxns = new Map();
  }

  async get(sql, params) {
    const store = transactionStorage.getStore();
    const isStoreActive = store && !store.released;
    const connection = isStoreActive ? store.client : this.pool;

    try {
      const res = await connection.query(sql, params || []);
      return convertNumericFields(res.rows[0]);
    } catch (err) {
      console.error("[db] PostgreSQL get failed for statement:", sql, "with params:", params);
      throw err;
    }
  }

  async all(sql, params) {
    const store = transactionStorage.getStore();
    const isStoreActive = store && !store.released;
    const connection = isStoreActive ? store.client : this.pool;

    try {
      const res = await connection.query(sql, params || []);
      return res.rows.map(convertNumericFields);
    } catch (err) {
      console.error("[db] PostgreSQL all failed for statement:", sql, "with params:", params);
      throw err;
    }
  }

  async run(sql, params) {
    let translatedSql = sql;
    const isBegin = /^\s*BEGIN\s+TRANSACTION/i.test(translatedSql);
    const isCommit = /^\s*COMMIT/i.test(translatedSql);
    const isRollback = /^\s*ROLLBACK/i.test(translatedSql);

    const store = transactionStorage.getStore();
    const isStoreActive = store && !store.released;

    if (isBegin) {
      if (isStoreActive) {
        // Nested transaction: track depth and use savepoint
        store.depth++;
        translatedSql = `SAVEPOINT sp_${store.depth}`;
      } else {
        // Acquire dedicated client from the pool for the duration of the transaction
        const client = await this.pool.connect();

        // CRITICAL: a client checked out for a transaction is NOT covered by
        // pool.on('error'). If a transaction is left idle (a forgotten COMMIT/ROLLBACK)
        // Postgres fires idle_in_transaction_session_timeout and sends a FATAL (code
        // 25P03) to this client. With no 'error' listener that event bubbles up as an
        // uncaught exception and the process-level handler exits — crash-looping the
        // server (exactly what was observed in production).
        //
        // We store the handler FUNCTION on the client (not a boolean flag) and replace
        // it on every checkout: remove any previous handler, then attach a fresh one
        // bound to THIS adapter. This guarantees exactly one listener (no leak) and, if
        // the adapter is ever re-instantiated (tests / hot-reload), the handler always
        // references the current adapter's activeTxns rather than a stale one.
        if (client[TXN_ERR_HANDLER]) {
          client.removeListener('error', client[TXN_ERR_HANDLER]);
        }
        const txnErrorHandler = (err) => {
          console.error(`[db] Transaction client error (connection terminated): ${err.code || ''} ${err.message}`);
          const info = this.activeTxns.get(client);
          if (info) {
            if (info.store) info.store.released = true;
            this.activeTxns.delete(client);
            // Return the dead connection to the pool WITH the error so pg discards it,
            // freeing the pool slot — otherwise the pool keeps counting this terminated
            // connection as checked-out and slowly exhausts. Only release while the
            // client is still mid-transaction (info present); an idle pooled client that
            // errors is handled by pool.on('error') and must not be double-released.
            try { client.release(err); } catch { /* already gone */ }
          }
        };
        client[TXN_ERR_HANDLER] = txnErrorHandler;
        client.on('error', txnErrorHandler);

        try {
          await client.query('BEGIN');
          // Start async context for all nested queries to reuse this client
          const txnStore = { client, depth: 1, released: false };
          this.activeTxns.set(client, { acquiredAt: Date.now(), store: txnStore });
          transactionStorage.enterWith(txnStore);
          return { lastID: null, changes: 0 };
        } catch (err) {
          this.activeTxns.delete(client);
          // Release with the error so pg destroys this connection rather than returning
          // a possibly half-begun transaction to the pool.
          try { client.release(err); } catch { /* already gone */ }
          throw err;
        }
      }
    } else if (isCommit) {
      if (isStoreActive) {
        if (store.depth > 1) {
          translatedSql = `RELEASE SAVEPOINT sp_${store.depth}`;
          store.depth--;
        } else {
          try {
            store.released = true;
            await store.client.query('COMMIT');
          } finally {
            this.activeTxns.delete(store.client);
            store.client.release();
            transactionStorage.enterWith(null);
          }
          return { lastID: null, changes: 0 };
        }
      } else {
        // No transaction started in this block, execute a no-op / warning-less BEGIN/COMMIT
        translatedSql = 'SELECT 1';
      }
    } else if (isRollback) {
      if (isStoreActive) {
        if (store.depth > 1) {
          translatedSql = `ROLLBACK TO SAVEPOINT sp_${store.depth}`;
          store.depth--;
        } else {
          try {
            store.released = true;
            await store.client.query('ROLLBACK');
          } finally {
            this.activeTxns.delete(store.client);
            store.client.release();
            transactionStorage.enterWith(null);
          }
          return { lastID: null, changes: 0 };
        }
      } else {
        // No transaction started in this block, execute a no-op
        translatedSql = 'SELECT 1';
      }
    }

    const isInsert = /^\s*INSERT\s+/i.test(translatedSql);

    if (isInsert && !/RETURNING/i.test(translatedSql)) {
      if (!/alliance_members/i.test(translatedSql) && !/server_state/i.test(translatedSql) && !/regions/i.test(translatedSql)) {
        translatedSql += " RETURNING id";
      }
    }

    try {
      const activeConnection = isStoreActive ? store.client : this.pool;
      const res = await activeConnection.query(translatedSql, params || []);
      const lastID = (res.rows && res.rows[0]) ? (res.rows[0].id || res.rows[0].alliance_id || null) : null;
      return {
        lastID: lastID,
        changes: res.rowCount
      };
    } catch (err) {
      console.error("[db] PostgreSQL run failed for statement:", translatedSql, "with params:", params);
      throw err;
    }
  }

  cleanupTransaction() {
    const store = transactionStorage.getStore();
    if (store && !store.released) {
      try {
        console.warn('[db] Cleaning up orphaned transaction — destroying connection');
        store.released = true;
        this.activeTxns.delete(store.client);
        // Release WITH an error so pg destroys the physical connection instead of
        // returning a client with an open, uncommitted transaction to the pool (which
        // the next query would silently reuse). Matches reapStaleTransactions.
        store.client.release(new Error('orphaned transaction — connection destroyed'));
        transactionStorage.enterWith(null);
      } catch (err) {
        console.error('[db] Error releasing orphaned transaction:', err.message);
      }
    }
  }

  async withTransaction(fn) {
    const store = transactionStorage.getStore();
    const isStoreActive = store && !store.released;

    if (isStoreActive) {
      store.depth += 1;
      const savepointName = `sp_${store.depth}`;
      try {
        await store.client.query(`SAVEPOINT ${savepointName}`);
        const result = await fn();
        await store.client.query(`RELEASE SAVEPOINT ${savepointName}`);
        store.depth -= 1;
        return result;
      } catch (err) {
        try {
          await store.client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
        } finally {
          store.depth -= 1;
        }
        throw err;
      }
    }

    const client = await this.pool.connect();

    if (client[TXN_ERR_HANDLER]) {
      client.removeListener('error', client[TXN_ERR_HANDLER]);
    }
    const txnErrorHandler = (err) => {
      console.error(`[db] Transaction client error (connection terminated): ${err.code || ''} ${err.message}`);
      const info = this.activeTxns.get(client);
      if (info) {
        if (info.store) info.store.released = true;
        this.activeTxns.delete(client);
        try { client.release(err); } catch { /* already gone */ }
      }
    };
    client[TXN_ERR_HANDLER] = txnErrorHandler;
    client.on('error', txnErrorHandler);

    const txnStore = { client, depth: 1, released: false };

    try {
      await client.query('BEGIN');
      this.activeTxns.set(client, { acquiredAt: Date.now(), store: txnStore });

      return await transactionStorage.run(txnStore, async () => {
        try {
          const result = await fn();
          await client.query('COMMIT');
          return result;
        } catch (err) {
          try {
            await client.query('ROLLBACK');
          } catch (rollbackErr) {
            console.error('[db] withTransaction rollback error:', rollbackErr.message);
          }
          throw err;
        } finally {
          txnStore.released = true;
          this.activeTxns.delete(client);
          client.release();
        }
      });
    } catch (err) {
      txnStore.released = true;
      this.activeTxns.delete(client);
      try { client.release(err); } catch { /* already gone */ }
      throw err;
    }
  }

  // Safety net: force-return any transaction client held longer than maxAgeMs.
  // The res.on('finish') cleanup cannot see transactions started via enterWith
  // (it runs in a different async context), so this reaper — which tracks clients
  // directly rather than via AsyncLocalStorage — is the reliable backstop that keeps
  // a forgotten COMMIT/ROLLBACK from permanently leaking a connection.
  reapStaleTransactions(maxAgeMs = 90000) {
    const now = Date.now();
    let reaped = 0;
    for (const [client, info] of this.activeTxns) {
      if (now - info.acquiredAt > maxAgeMs) {
        this.activeTxns.delete(client);
        if (info.store) info.store.released = true;
        try {
          // Release WITH an error so pg destroys the physical connection instead of
          // returning a possibly mid-transaction client to the pool. Postgres rolls
          // back on disconnect and the server-side slot is freed immediately.
          client.release(new Error('transaction reaped — held too long'));
        } catch {
          // already released / destroyed — nothing to do
        }
        reaped++;
      }
    }
    if (reaped > 0) {
      console.error(`[db] ⚠️ Reaped ${reaped} stale transaction connection(s) held >${maxAgeMs}ms — a route began a transaction without committing or rolling back. Connection(s) reclaimed.`);
    }
    return reaped;
  }

  async exec(sql) {
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    for (const statement of statements) {
      let translated = statement;
      if (this.isPgMem && translated) {
        // pg-mem doesn't support dynamic epoch defaults inside column definitions
        translated = translated.replace(
          /DEFAULT\s+\(FLOOR\(EXTRACT\(EPOCH FROM NOW\(\)\)\)::INTEGER(\s*\+\s*\d+)?\)/gi,
          'DEFAULT 1770000000',
        );
      }
      if (translated) {
        try {
          await this.pool.query(translated);
        } catch (err) {
          console.error("[db] PostgreSQL exec failed for statement:", translated);
          console.error("[db] PostgreSQL error details:", err);
          throw err;
        }
      }
    }
  }
}

let _db = null;

async function repairJsonRows(db = _db) {
  if (!db) throw new Error('[db] repairJsonRows requires an initialized database');

  let fixedRows = 0;
  let fixedCells = 0;
  const repairDetails = [];

  for (const [table, specs] of Object.entries(JSON_REPAIR_SPECS)) {
    const columns = await getTableColumns(table, db);
    if (!columns.length) continue;

    const jsonColumns = Object.keys(specs).filter(col => columns.includes(col));
    if (!jsonColumns.length) continue;

    const rowCount = await db.get(`SELECT COUNT(*) as count FROM "${table}"`);
    console.log(`[db] JSON repair: scanning ${table} (${rowCount?.count || 0} rows, ${jsonColumns.length} JSON columns)`);

    const quotedColumns = jsonColumns.map(col => `"${col}"`).join(', ');
    const rows = await db.all(`SELECT id, ${quotedColumns} FROM "${table}"`);
    const tableDetails = { table, scannedRows: rows.length, fixedRows: 0, fixedCells: 0, fixedColumns: {} };

    for (const row of rows) {
      const updates = {};
      for (const col of jsonColumns) {
        const normalized = normalizeJsonForRepair(row[col], specs[col]);
        if (normalized !== row[col]) {
          updates[col] = normalized;
          tableDetails.fixedColumns[col] = (tableDetails.fixedColumns[col] || 0) + 1;
        }
      }
      if (!Object.keys(updates).length) continue;

      const cols = Object.keys(updates);
      const setClause = pgSetClause(cols);
      const values = [...Object.values(updates), row.id];
      await db.run(`UPDATE "${table}" SET ${setClause} WHERE id = $${cols.length + 1}`, values);
      fixedRows += 1;
      tableDetails.fixedRows += 1;
      fixedCells += Object.keys(updates).length;
    }

    if (tableDetails.fixedRows > 0) {
      console.log(`[db] JSON repair: ${tableDetails.fixedRows} rows fixed in ${table}`);
      repairDetails.push(tableDetails);
    }
  }

  console.log(`[db] JSON repair complete: ${fixedRows} rows and ${fixedCells} cells repaired across ${repairDetails.length} tables`);
  return { fixedRows, fixedCells, details: repairDetails };
}

async function initDb(options = {}) {
  if (_db) return _db;

  if (!process.env.DATABASE_URL) {
    throw new Error("[db] ❌ Critical: DATABASE_URL is not set! A persistent PostgreSQL database connection structure is strictly required.");
  }

  const { Pool } = require('pg');
  // Railway Postgres allows ~100 total connections (minus a few reserved for the
  // superuser). Two things make a high per-instance cap dangerous:
  //   1. Zero-downtime deploys keep the OLD instance alive while the NEW one boots,
  //      so two app instances are briefly live at once — doubling the connection draw.
  //   2. pgAdmin4 / Railway monitoring hold additional background connections.
  // A default of 100 let a SINGLE instance saturate the entire database (and 2×100
  // during a deploy guaranteed "sorry, too many clients already"). 20 leaves headroom
  // for deploy overlap, pgAdmin4, and migrations. Override via DATABASE_MAX_POOL on
  // the *application* service (NOT the Postgres service — that container never reads it).
  // Callers can pass smaller defaults for low-traffic processes (e.g. the Discord bot,
  // which only polls chat and needs a handful of connections, not the web server's 20).
  // An explicit DATABASE_MAX_POOL/MIN env var still wins so ops can override per service.
  const defaultMax = Number.isInteger(options?.maxPool) ? options.maxPool : 20;
  const defaultMin = Number.isInteger(options?.minPool) ? options.minPool : 2;
  const maxPool = process.env.DATABASE_MAX_POOL ? parseInt(process.env.DATABASE_MAX_POOL, 10) : defaultMax;
  const minPool = process.env.DATABASE_MIN_POOL ? parseInt(process.env.DATABASE_MIN_POOL, 10) : defaultMin;

  if (isNaN(maxPool) || isNaN(minPool) || maxPool < 1 || minPool < 1 || maxPool < minPool) {
    throw new Error(`[db] Invalid pool configuration: max=${maxPool}, min=${minPool}. Both must be positive integers with max >= min`);
  }

  // Guard against a value high enough to exhaust Railway Postgres during a deploy
  // (old + new instance both live). This is a warning, not a hard cap — bigger plans
  // with a higher max_connections may legitimately want more.
  if (maxPool > 50) {
    console.warn(`[db] ⚠️ DATABASE_MAX_POOL=${maxPool} is high. During a Railway deploy two instances run at once (~${maxPool * 2} connections), which can exceed Postgres max_connections (~100) and cause "too many clients already".`);
  }
  console.log(`[db] Connection pool configured — max=${maxPool}, min=${minPool}`);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: (!process.env.DATABASE_URL.includes('localhost') && !process.env.DATABASE_URL.includes('127.0.0.1') && !process.env.DATABASE_URL.includes('0.0.0.0'))
      ? { rejectUnauthorized: false }
      : false,
    max: maxPool,
    min: minPool,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    // Keep TCP connections alive through proxies / load balancers (Railway, etc.)
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    // Abort any single query that runs longer than 30s — no game query should take
    // that long, and a stuck one would otherwise pin a connection (was 120s).
    statement_timeout: 30000,
    // Postgres-side backstop: kill any transaction left idle (BEGIN with no follow-up
    // COMMIT/ROLLBACK) after 60s. This frees the server slot even if the app process
    // were to hang, complementing the app-side reaper below.
    idle_in_transaction_session_timeout: 60000,
    application_name: 'narmir-game',
    // Force UTF-8 encoding on every connection to prevent emoji/special character
    // corruption when PostgreSQL's locale defaults differ from UTF-8.
    options: '-c client_encoding=UTF8',
  });

  // Monitor pool health
  pool.on('error', (err) => {
    console.error('[db] Unexpected pool error:', err.message);
  });

  // Log pool stats every 60 seconds if strained
  // Store interval ID for cleanup on shutdown to prevent process hang
  const poolStatsInterval = setInterval(() => {
    const available = pool.totalCount - pool.waitingCount;
    if (pool.waitingCount > 0 || available < pool.max / 2) {
      console.log(`[db] Pool stats — Total: ${pool.totalCount}, Available: ${available}, Waiting: ${pool.waitingCount}`);
    }
  }, 60000);
  if (poolStatsInterval.unref) poolStatsInterval.unref();

  // Ensure interval is cleared on shutdown to prevent dangling timers
  process.on('SIGTERM', () => clearInterval(poolStatsInterval));
  process.on('SIGINT', () => clearInterval(poolStatsInterval));

  let currentAttempt = 1;
  const maxAttempts = 5; // Robust retries to withstand transient server startups
  const delay = 2000;
  let connected = false;

  while (currentAttempt <= maxAttempts) {
    try {
      console.log(`[db] Connecting to PostgreSQL database (Attempt ${currentAttempt}/${maxAttempts})...`);
      const client = await pool.connect();
      try {
        await client.query('SELECT 1');
      } finally {
        client.release();
      }
      _db = new PgDbAdapter(pool);
      _db.bootComplete = false; // Flag to prevent pool shutdown during boot
      setColumnDb(_db);
      console.log("[db] ✅ PostgreSQL connected successfully! Connection established.");

      // Apply full DDL (CREATEs + indexes) now that we have a live adapter.
      // Extracted to db/ddl.js to reduce schema.js bloat.
      const { applySchema } = require('./ddl');
      await applySchema(_db);
      console.log('[db] Schema DDL applied (ddl.js)');

      connected = true;
      break;
    } catch (pgError) {
      console.error(`[db] PostgreSQL connection attempt ${currentAttempt} failed:`, pgError.message);
      if (currentAttempt < maxAttempts) {
        console.log(`[db] Retrying in ${delay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    currentAttempt++;
  }

  if (!connected) {
    throw new Error("[db] ❌ Critical: Failed to connect to PostgreSQL database after multiple attempts. Boot sequence aborted to preserve database persistence and prevent silent data loss.");
  }

  // Reaper: every 10s, force-return any transaction connection held too long. This is
  // the reliable backstop the res.on('finish') cleanup could not provide (that runs in
  // a different async context and never sees enterWith-scoped transactions). Guarantees
  // a forgotten COMMIT/ROLLBACK can never permanently exhaust the pool.
  //
  // The 40s threshold is deliberately BELOW the 60s idle_in_transaction_session_timeout
  // so the app reclaims a leaked connection cleanly before Postgres terminates it with a
  // FATAL. No legitimate game transaction runs for anywhere near 40s, so this never
  // interrupts real work. Postgres's 60s timeout remains only as a last-resort backstop
  // for the case where the Node event loop itself is wedged.
  const txnReaperInterval = setInterval(() => {
    try {
      _db.reapStaleTransactions(40000);
    } catch (err) {
      console.error('[db] Transaction reaper error:', err.message);
    }
  }, 10000);
  if (txnReaperInterval.unref) txnReaperInterval.unref();
  process.on('SIGTERM', () => clearInterval(txnReaperInterval));
  process.on('SIGINT', () => clearInterval(txnReaperInterval));

  // Graceful pool shutdown on container stop (Railway sends SIGTERM)
  // Track boot completion and shutdown attempts to avoid infinite deferral loops
  let shutdownAttempts = 0;
  let shutdownTimer = null;

  const shutdownPool = async () => {
    // Prevent concurrent shutdown attempts
    if (shutdownTimer) return;

    try {
      // Only close pool after boot is complete to avoid interrupting initialization
      // Limit deferral to 30 attempts (~30 seconds) to ensure process can exit
      if (_db && !_db.bootComplete && shutdownAttempts < 30) {
        shutdownAttempts++;
        console.log(`[db] SIGTERM during boot - deferring pool close (attempt ${shutdownAttempts}/30)`);
        // Set a timeout to check again in 1 second (allows boot to progress)
        shutdownTimer = setTimeout(() => {
          shutdownTimer = null;
          shutdownPool();
        }, 1000);
        return;
      }
      // Either boot is complete or we've exceeded retry limit - close pool now
      if (shutdownAttempts >= 30 && _db && !_db.bootComplete) {
        console.warn('[db] Boot did not complete within 30 seconds - forcing pool closure');
      }
      await pool.end();
      console.log('[db] Pool closed gracefully');
    } catch (e) {
      console.error('[db] Error closing pool:', e.message);
    }
  };

  process.on('SIGTERM', shutdownPool);
  process.on('SIGINT', shutdownPool);

  // Core schema CREATEs live in db/ddl.js (applySchema)


  // ── Migrations — safe, idempotent, never crash on duplicate ─────────────────
  // getColumnType and addColumn provided by column-utils require at top


  // Ensure key indexes exist
  await _db.exec(`
    CREATE INDEX IF NOT EXISTS idx_kingdoms_player ON kingdoms(player_id);
    CREATE INDEX IF NOT EXISTS idx_kingdoms_land   ON kingdoms(land DESC);
    CREATE INDEX IF NOT EXISTS idx_kingdoms_rank_sort ON kingdoms(land DESC, level DESC, population DESC, id ASC);
    CREATE INDEX IF NOT EXISTS idx_kingdoms_name_lower ON kingdoms(LOWER(name));
    CREATE INDEX IF NOT EXISTS idx_news_created    ON news(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_exp_turns       ON expeditions(turns_left);
  `);

  // Call the extracted initializers (helpers already wired above)
  const { initializeRegions, initializeAdditionalColumns, initializeKingdomColumns } = require('./init-data');
  await initializeRegions(_db);
  await initializeAdditionalColumns(_db, getTableColumns, addColumn);
  await initializeKingdomColumns(_db, getTableColumns, getColumnType, addColumn);
  setKingdomUpdateDb(_db);


  // (players email + alliances evolved cols now inside initializeAdditionalColumns in init-data.js)

  // regions DDL in ddl.js

  // Duplicate inits removed (now in initialize* + ddl.js)

  // Allow NULL kingdom_id for Discord relay messages from unlinked users
  try {
    // Try PostgreSQL syntax first
    await _db.run('ALTER TABLE chat_messages ALTER COLUMN kingdom_id DROP NOT NULL');
    console.log('✅ Made kingdom_id nullable for Discord relay messages');
  } catch {
    try {
      // Fallback table recreation path for older local schemas.
      const cmInfo = await fetchTableColumnInfo('chat_messages');
      const kingdomIdCol = cmInfo.find(c => c.name === 'kingdom_id');
      if (kingdomIdCol && kingdomIdCol.notnull) {
        await _db.exec(`
          CREATE TABLE chat_messages_new (
            id          SERIAL PRIMARY KEY,
            kingdom_id  INTEGER REFERENCES kingdoms(id),
            player_id   INTEGER NOT NULL DEFAULT 0,
            username    TEXT NOT NULL DEFAULT '',
            room        TEXT    NOT NULL DEFAULT 'global',
            message     TEXT    NOT NULL,
            deleted     INTEGER NOT NULL DEFAULT 0,
            created_at  INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
          );
          INSERT INTO chat_messages_new (id, kingdom_id, player_id, username, room, message, deleted, created_at)
          SELECT id, kingdom_id, player_id, username, room, message, deleted, created_at FROM chat_messages;
          DROP TABLE chat_messages;
          ALTER TABLE chat_messages_new RENAME TO chat_messages;
          CREATE INDEX idx_chat_room ON chat_messages(room, created_at);
        `);
        console.log('✅ Migrated chat_messages to allow NULL kingdom_id');
      }
    } catch (e2) {
      console.log('⚠️  kingdom_id nullable migration skipped:', e2.message);
    }
  }

  // Region column (data-driven in initializeKingdomColumns); backfill for existing kingdoms
  const RACE_REGIONS = {
    dwarf:'The Iron Holds', high_elf:'The Silverwood', orc:'The Bloodplains',
    dark_elf:'The Underspire', human:'The Heartlands', dire_wolf:'The Ashfang Wilds',
    vampire:'The Crimson Vales', wood_elf:'The Wildwood', ogre:'The Shattered Peaks',
  };
  const existing = await _db.all('SELECT id, race FROM kingdoms');
  for (const k of existing) {
    await _db.run('UPDATE kingdoms SET region = $1 WHERE id = $2', [RACE_REGIONS[k.race] || 'The Unknown Lands', k.id]);
  }


  // Expeditions columns handled in initializeAdditionalColumns (init-data)
  const expCols = await getTableColumns('expeditions');
  if (expCols.includes('seen')) {
    // Clean up any old stuck completed rows that predate the seen column (one-time)
    await _db.run('DELETE FROM expeditions WHERE turns_left = 0');
  }

  // Legacy data migration: if defence_upgrades exists but defense_upgrades is empty, copy it
  const kingdomsCols = await getTableColumns('kingdoms');
  if (kingdomsCols.includes('defence_upgrades') && kingdomsCols.includes('defense_upgrades')) {
    const migrationName = '001_migrate_defence_to_defense_upgrades';
    const existing = await _db.get('SELECT id FROM migrations WHERE name = $1', [migrationName]);
    if (!existing) {
      await _db.run(`UPDATE kingdoms SET defense_upgrades = defence_upgrades WHERE defense_upgrades = '{}' AND defence_upgrades != '{}'`);
      await _db.run('INSERT INTO migrations (name) VALUES ($1)', [migrationName]);
      console.log('[db] Migration applied:', migrationName);
    }
  }

  // Migration: convert scout_progress from INTEGER to NUMERIC to support fractional values
  const migrationName = '002_scout_progress_to_numeric';
  const existingMigration = await _db.get('SELECT id FROM migrations WHERE name = $1', [migrationName]);
  if (!existingMigration) {
    try {
      await _db.run(`ALTER TABLE kingdoms ALTER COLUMN scout_progress TYPE NUMERIC(10,2) USING scout_progress::NUMERIC(10,2)`);
      await _db.run('INSERT INTO migrations (name) VALUES ($1)', [migrationName]);
      console.log('[db] Migration applied:', migrationName);
    } catch (err) {
      console.warn('[db] Migration skipped (column may already be NUMERIC):', err.message);
    }
  }

  // Migration: make kingdom_id nullable in resource_nodes
  const resourceNodesMigration = '003_make_kingdom_id_nullable_in_resource_nodes';
  const existingResourceNodesMigration = await _db.get('SELECT id FROM migrations WHERE name = $1', [resourceNodesMigration]);
  if (!existingResourceNodesMigration) {
    try {
      await _db.run(`ALTER TABLE resource_nodes ALTER COLUMN kingdom_id DROP NOT NULL`);
      await _db.run('INSERT INTO migrations (name) VALUES ($1)', [resourceNodesMigration]);
      console.log('[db] Migration applied:', resourceNodesMigration);
    } catch (err) {
      console.warn('[db] Migration skipped (kingdom_id may already be nullable):', err.message);
    }
  }

  // Migration: add x and y columns for kingdom spawn coordinates
  const kingdomXYMigration = '004_add_kingdom_coordinates';
  const existingXYMigration = await _db.get('SELECT id FROM migrations WHERE name = $1', [kingdomXYMigration]);
  if (!existingXYMigration) {
    try {
      const kingdomsColsCheck = await getTableColumns('kingdoms');
      if (!kingdomsColsCheck.includes('x')) {
        await _db.run(`ALTER TABLE kingdoms ADD COLUMN x INTEGER NOT NULL DEFAULT 0`);
      }
      if (!kingdomsColsCheck.includes('y')) {
        await _db.run(`ALTER TABLE kingdoms ADD COLUMN y INTEGER NOT NULL DEFAULT 0`);
      }

      // Seed coordinates from RACE_HOMES based on race (kingdoms store race, not region name)
      const RACE_HOMES_MAP = {
        dwarf: { x: 400, y: 488 },
        high_elf: { x: 1155, y: 340 },
        wood_elf: { x: 1599, y: 467 },
        vampire: { x: 933, y: 701 },
        ogre: { x: 1777, y: 828 },
        dark_elf: { x: 1243, y: 913 },
        orc: { x: 1555, y: 1040 },
        human: { x: 666, y: 913 },
        dire_wolf: { x: 289, y: 849 },
      };

      const kingdoms = await _db.all('SELECT id, race FROM kingdoms');
      for (const k of kingdoms) {
        if (k.race && RACE_HOMES_MAP[k.race]) {
          const coords = RACE_HOMES_MAP[k.race];
          await _db.run('UPDATE kingdoms SET x = $1, y = $2 WHERE id = $3', [coords.x, coords.y, k.id]);
        }
      }

      await _db.run('INSERT INTO migrations (name) VALUES ($1)', [kingdomXYMigration]);
      console.log('[db] Migration applied:', kingdomXYMigration);
    } catch (err) {
      console.warn('[db] Migration skipped (columns may already exist):', err.message);
    }
  }

  // Trade offers table

  // market prices seeding now in init-data
  const { initializeMarketPrices } = require('./init-data');
  await initializeMarketPrices(_db);

  // Initialize fresh world FIRST: ensures world_state seed exists
  // (MUST be before initializeResourceNodes, which checks world_state)
  let seedJustCreated = false;
  try {
    const { initializeWorld } = require('../game/world-initialization');
    seedJustCreated = await initializeWorld(_db);
  } catch (err) {
    console.error('[db] World initialization failed:', err.message);
  }

  // Seed season state
  await _db.run(
    `INSERT INTO server_state (key, value) VALUES ('current_season', 'spring') ON CONFLICT (key) DO NOTHING`,
  );
  await _db.run(
    `INSERT INTO server_state (key, value) VALUES ('season_started_at', ${EPOCH_NOW_TEXT}) ON CONFLICT (key) DO NOTHING`,
  );

  // events seeding now in init-data
  const { initializeDefaultEvents, initializeResourceNodes } = require('./init-data');
  await initializeDefaultEvents(_db);
  await initializeResourceNodes(_db);

  // random/tax seeds now in init-data
  const { initializeRandomEvents, initializeTaxEvents } = require('./init-data');
  await initializeRandomEvents(_db);
  await initializeTaxEvents(_db);

  // Lore columns handled via initializeAdditionalColumns (init-data)

  // Legacy lore rows predate the key_id column (seeded rows always have one).
  // NOTE: do not detect legacy rows via category = 'general' — the seed itself
  // contains that category, and matching on it wiped admin lore edits on every boot.
  const oldLore = await _db.get("SELECT 1 FROM lore_entries WHERE key_id IS NULL OR key_id = '' LIMIT 1");
  if (oldLore) {
    await _db.run("DELETE FROM lore_entries"); // We will wipe and seed from the full game/lore.js
  }

  // Seed any lore category that has no rows yet — covers both a fresh database
  // and categories added to game/lore.js after the initial seed (e.g. vampire).
  {
    let LORE_SEED = {};
    try { LORE_SEED = require('../game/lore-data').LORE_SEED || {}; } catch {}
    if (!LORE_SEED || Object.keys(LORE_SEED).length === 0) {
      try { LORE_SEED = require('../game/lore').LORE_SEED || {}; } catch {}
    }
    for (const cat of Object.keys(LORE_SEED)) {
      const arr = LORE_SEED[cat];
      if (!Array.isArray(arr)) continue;
      const hasCat = await _db.get("SELECT 1 FROM lore_entries WHERE category = $1 LIMIT 1", [cat]);
      if (hasCat) continue;
      for (const item of arr) {
        await _db.run("INSERT INTO lore_entries (key_id, category, title, content) VALUES ($1, $2, $3, $4)", [item.id, cat, item.title, item.msg]);
      }
    }
  }

  // wishlist seeding now in init-data
  const { initializeWishlist } = require('./init-data');
  await initializeWishlist(_db);

  // Seed default server_state row for regen tracking
  await _db.run(`
    INSERT INTO server_state (key, value)
    VALUES ('last_regen_at', ${EPOCH_NOW_TEXT})
    ON CONFLICT (key) DO NOTHING
  `);

  try {
    await _db.run("UPDATE players SET is_admin = 1 WHERE username = 'Stieny'");
    console.log("[db] Promoted Stieny to admin automatically");
  } catch {
    // Ignore error
  }

  // ── Resource Gathering System Migrations ───────────────────────
  // Resource columns handled via initialize* (init-data)

  // Resource nodes columns handled via initializeAdditionalColumns (init-data)
  // backfill terrain if missing
  await _db.run(`UPDATE resource_nodes SET terrain = 'plains' WHERE terrain IS NULL OR terrain = ''`);

  // Load it into the in-memory cache immediately, here inside initDb() —
  // not later in index.js's boot sequence — because backfillResourceNodeMapCoords()
  // Load the world seed (either existing or newly created by initializeWorld above)
  // This seed is needed by anything below (and anything else initDb() itself invokes) via
  // game/world-map-coords.js, which reads the cache synchronously and
  // throws if it hasn't been loaded yet. Deferring this to after initDb()
  // returns would crash boot the first time a fresh DB actually has
  // resource_nodes rows needing a coordinate backfill.
  await require('../game/world-seed').loadWorldSeed(_db);

  // If seed was just created, run full resource initialization
  if (seedJustCreated) {
    try {
      const { initializeWorld } = require('../game/world-initialization');
      await initializeWorld(_db);
    } catch (err) {
      console.error('[db] World resource initialization failed:', err.message);
    }
  }

  try {
    const { backfillResourceNodeMapCoords } = require('../game/world-map-coords');
    const backfilledNodes = await backfillResourceNodeMapCoords(_db);
    if (backfilledNodes > 0) {
      console.log(`[db] Backfilled map coordinates for ${backfilledNodes} resource node(s)`);
    }
  } catch (err) {
    console.error('[db] Resource node map backfill failed:', err.message);
  }

  try {
    const { seedForumStructure } = require('../lib/forum-seed');
    await seedForumStructure(_db);
    console.log('[db] Forum categories and sub-boards seeded');
  } catch (err) {
    console.error('[db] Error seeding forum structure:', err.message);
  }

  return _db;
}

module.exports = { initDb, applyKingdomUpdates, repairJsonRows };
