// Phase D complete: all SQL uses native PostgreSQL $1, $2, ... placeholders.

// Cache numeric field names for efficient conversion (PostgreSQL NUMERIC/INTEGER returns strings)
// Covers all INTEGER/REAL columns across kingdoms, expeditions, heroes, resource_nodes, trade_routes,
// news, and other frequently queried tables so callers get JS numbers, not strings.
const NUMERIC_FIELDS = [
  // Core kingdom economy
  'gold', 'mana', 'food', 'land', 'population', 'happiness', 'tax',
  // Turns / time
  'turn', 'turns_stored', 'last_turn_at', 'created_at', 'updated_at',
  'food_surplus_turns', 'food_shortage_turns', 'turn_num',
  // Forum
  'post_count', 'last_post_at', 'deleted_at',
  // Forum Moderation
  'expires_at', 'reviewed_at',
  // XP / levels
  'xp', 'level', 'prestige_level', 'progress',
  // Units
  'fighters', 'rangers', 'clerics', 'mages', 'thieves', 'ninjas',
  'researchers', 'engineers', 'engineer_level', 'engineer_xp', 'scribes', 'thralls',
  // Military equipment
  'war_machines', 'ballistae', 'weapons_stockpile', 'armor_stockpile', 'ladders',
  // Research
  'res_economy', 'res_weapons', 'res_armor', 'res_military', 'res_spellbook',
  'res_attack_magic', 'res_defense_magic', 'res_entertainment',
  'res_construction', 'res_war_machines', 'school_spellbook',
  // Buildings (base schema)
  'bld_farms', 'bld_granaries', 'bld_barracks', 'bld_outposts',
  'bld_guard_towers', 'bld_schools', 'bld_armories', 'bld_vaults',
  'bld_smithies', 'bld_markets', 'bld_mage_towers', 'bld_shrines',
  'bld_training', 'bld_castles', 'bld_housing', 'bld_libraries',
  // Buildings (migrations)
  'bld_taverns', 'bld_mausoleums', 'bld_woodyard', 'bld_lumber_camp',
  'bld_blockfield', 'bld_stone_quarry', 'bld_strip_mine',
  // Tools / crafting stockpiles
  'tools_hammers', 'tools_scaffolding', 'tools_blueprints',
  'hammers_stored', 'scaffolding_stored',
  // Inventory / resources
  'maps', 'blueprints_stored', 'wood', 'stone', 'iron', 'coal', 'steel',
  // Heroes
  'hp', 'max_hp',
  // Expeditions / resource nodes / trade routes
  'turns_left', 'population_sent', 'distance', 'richness', 'stability',
  'food_taken', 'arrive_at', 'depart_at', 'harvest_ends_at', 'return_at',
  // Misc / admin goals
  'count', 'wall_hp', 'prize_multiplier',
  // Happiness tracking
  'happiness_value', 'food_component', 'entertainment_component',
  'safety_component', 'prosperity_component', 'race_modifier',
  'tax_component', 'overcrowding_component', 'recovery_rate',
  'effects_component', 'synergy_component', 'fragment_component',
];

function convertNumericFields(row) {
  if (!row) return row;
  for (const field of NUMERIC_FIELDS) {
    if (typeof row[field] === 'string') {
      row[field] = parseFloat(row[field]);
    }
  }
  return row;
}

const { AsyncLocalStorage } = require('async_hooks');
const { queryTableColumns } = require('../lib/db-schema-introspection');
const { EPOCH_NOW_TEXT } = require('../lib/db-sql');
const { pgSetClause } = require('../lib/pg-placeholders');
const transactionStorage = new AsyncLocalStorage();

function resolveDbConnection(db) {
  const store = transactionStorage.getStore();
  const isStoreActive = store && !store.released;
  return isStoreActive ? store.client : db.pool;
}

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

async function fetchTableColumnInfo(table, db = _db) {
  if (!db) return [];
  try {
    const connection = resolveDbConnection(db);
    return await queryTableColumns(connection, table);
  } catch (e) {
    console.error(`[db] Migration: error fetching columns for ${table}:`, e.message);
    return [];
  }
}

async function getTableColumns(table, db = _db) {
  const rows = await fetchTableColumnInfo(table, db);
  return rows.map((c) => c.name);
}

const JSON_REPAIR_SPECS = {
  kingdoms: {
    alliance_buffs: { kind: 'object', fallback: {} },
    goals: { kind: 'object', fallback: {} },
    research_allocation: { kind: 'object', fallback: {} },
    build_queue: { kind: 'object', fallback: {} },
    build_progress: { kind: 'object', fallback: {} },
    research_progress: { kind: 'object', fallback: {} },
    mage_research_progress: { kind: 'object', fallback: {} },
    build_allocation: { kind: 'object', fallback: {} },
    resource_build_allocation: { kind: 'object', fallback: {} },
    xp_sources: {
      kind: 'object',
      fallback: { turn: 0, gold: 0, combat_win: 0, combat_loss: 0, research: 0, construction: 0, exploration: 0, spell_cast: 0, covert_op: 0 }
    },
    troop_levels: { kind: 'object', fallback: {} },
    equipment_levels: { kind: 'object', fallback: {} },
    training_allocation: { kind: 'object', fallback: {} },
    library_allocation: { kind: 'object', fallback: {} },
    wounded_troops: { kind: 'object', fallback: {} },
    library_progress: { kind: 'object', fallback: {} },
    tower_progress: { kind: 'object', fallback: {} },
    scrolls: { kind: 'object', fallback: {} },
    active_effects: { kind: 'object', fallback: {} },
    collected_lore: { kind: 'array', fallback: [] },
    collected_events: { kind: 'array', fallback: [] },
    achievements: { kind: 'array', fallback: [] },
    active_trade_routes: { kind: 'array', fallback: [] },
    milestones_claimed: { kind: 'object', fallback: {} },
    milestone_bonuses: { kind: 'object', fallback: {} },
    injured_troops: { kind: 'object', fallback: {} },
    smithy_allocation: { kind: 'object', fallback: {} },
    racial_bonuses_unlocked: { kind: 'object', fallback: {} },
    mage_tower_allocation: { kind: 'object', fallback: {} },
    shrine_allocation: { kind: 'object', fallback: {} },
    granary_upgrades: { kind: 'object', fallback: {} },
    world_fragments: { kind: 'array', fallback: [] },
    hybrid_blueprints: { kind: 'object', fallback: {} },
    fragment_bonuses: { kind: 'object', fallback: {} },
    fortified_buildings: { kind: 'object', fallback: {} },
    wall_upgrades: { kind: 'object', fallback: {} },
    tower_def_upgrades: { kind: 'object', fallback: {} },
    outpost_upgrades: { kind: 'object', fallback: {} },
    defense_upgrades: { kind: 'object', fallback: {} },
    tower_upgrades: { kind: 'object', fallback: {} },
    school_upgrades: { kind: 'object', fallback: {} },
    shrine_upgrades: { kind: 'object', fallback: {} },
    library_upgrades: { kind: 'object', fallback: {} },
    research_focus: { kind: 'array', fallback: [] },
    farm_upgrades: { kind: 'object', fallback: {} },
    market_upgrades: { kind: 'object', fallback: {} },
    tavern_upgrades: { kind: 'object', fallback: {} },
    bank_upgrades: { kind: 'object', fallback: {} },
    bank_deposits: { kind: 'array', fallback: [] },
    ledger: { kind: 'array', fallback: [] },
    mausoleum_upgrades: { kind: 'object', fallback: {} },
    mausoleum_allocation: { kind: 'object', fallback: {} },
    mercenaries: { kind: 'array', fallback: [] },
    active_event: { kind: 'object', fallback: {} },
    discovered_kingdoms: { kind: 'object', fallback: {} },
    location_maps_wip: { kind: 'array', fallback: [] },
    items: { kind: 'array', fallback: [] },
    resource_sequence: { kind: 'object', fallback: {} }
  },
  alliances: {
    projects: { kind: 'object', fallback: {} },
    vault_log: { kind: 'array', fallback: [] }
  },
  heroes: {
    abilities: { kind: 'array', fallback: [] }
  },
  resource_expeditions: {
    loot: { kind: 'object', fallback: {} }
  }
};

function cloneJsonFallback(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseJsonCandidate(raw) {
  if (raw === null || raw === undefined) return null;
  let current = raw;
  let depth = 0;
  while (typeof current === 'string' && depth < 3) {
    const text = current.trim();
    if (!text) return null;
    try {
      current = JSON.parse(text);
    } catch {
      return null;
    }
    depth += 1;
  }
  return current;
}

function normalizeJsonForRepair(raw, spec) {
  const fallback = cloneJsonFallback(spec.fallback);

  if (raw === null || raw === undefined) return JSON.stringify(fallback);

  const parsed = parseJsonCandidate(raw);
  if (parsed === null) return JSON.stringify(fallback);

  const matchesKind = spec.kind === 'array'
    ? Array.isArray(parsed)
    : spec.kind === 'object'
      ? parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      : true;

  if (!matchesKind) return JSON.stringify(fallback);

  try {
    const normalized = JSON.stringify(parsed);
    if (!normalized) return JSON.stringify(fallback);
    return normalized;
  } catch {
    return JSON.stringify(fallback);
  }
}

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
      console.log("[db] ✅ PostgreSQL connected successfully! Connection established.");
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

  await _db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE TABLE IF NOT EXISTS players (
      id          SERIAL PRIMARY KEY,
      username    TEXT    NOT NULL UNIQUE,
      password    TEXT    NOT NULL,
      email       TEXT    UNIQUE,
      is_admin    INTEGER NOT NULL DEFAULT 0,
      is_banned   INTEGER NOT NULL DEFAULT 0,
      is_ai       INTEGER NOT NULL DEFAULT 0,
      ban_reason  TEXT,
      created_at  INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE TABLE IF NOT EXISTS kingdoms (
      id          SERIAL PRIMARY KEY,
      player_id   INTEGER NOT NULL UNIQUE REFERENCES players(id),
      name        TEXT    NOT NULL,
      race        TEXT    NOT NULL DEFAULT 'human',
      gender      TEXT    NOT NULL DEFAULT 'male',
      gold        BIGINT NOT NULL DEFAULT 10000,
      land        INTEGER NOT NULL DEFAULT 500,
      population  INTEGER NOT NULL DEFAULT 50000,
      happiness   INTEGER NOT NULL DEFAULT 50,
      last_attack_turn INTEGER NOT NULL DEFAULT 0,
      rebellion_cooldown INTEGER NOT NULL DEFAULT 0,
      tax         INTEGER NOT NULL DEFAULT 42,
      mana        INTEGER NOT NULL DEFAULT 5000,
      food        INTEGER NOT NULL DEFAULT 0,
      turn        INTEGER NOT NULL DEFAULT 0,
      last_turn_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER),
      turns_stored INTEGER NOT NULL DEFAULT 400,
      res_economy       INTEGER NOT NULL DEFAULT 100,
      res_weapons       INTEGER NOT NULL DEFAULT 100,
      res_armor         INTEGER NOT NULL DEFAULT 100,
      res_military      INTEGER NOT NULL DEFAULT 100,
      res_spellbook     INTEGER NOT NULL DEFAULT 0,
      res_attack_magic  INTEGER NOT NULL DEFAULT 100,
      res_defense_magic INTEGER NOT NULL DEFAULT 100,
      res_entertainment INTEGER NOT NULL DEFAULT 100,
      res_construction  INTEGER NOT NULL DEFAULT 100,
      res_war_machines  INTEGER NOT NULL DEFAULT 100,
      bld_farms         INTEGER NOT NULL DEFAULT 200,
      bld_granaries     INTEGER NOT NULL DEFAULT 0,
      bld_barracks      INTEGER NOT NULL DEFAULT 0,
      bld_outposts      INTEGER NOT NULL DEFAULT 0,
      bld_guard_towers  INTEGER NOT NULL DEFAULT 0,
      bld_schools       INTEGER NOT NULL DEFAULT 0,
      bld_armories      INTEGER NOT NULL DEFAULT 0,
      bld_vaults        INTEGER NOT NULL DEFAULT 0,
      bld_smithies      INTEGER NOT NULL DEFAULT 0,
      bld_markets       INTEGER NOT NULL DEFAULT 0,
      bld_mage_towers    INTEGER NOT NULL DEFAULT 0,
      bld_shrines       INTEGER NOT NULL DEFAULT 0,
      mage_tower_allocation TEXT NOT NULL DEFAULT '{}',
      shrine_allocation TEXT NOT NULL DEFAULT '{}',
      bld_training      INTEGER NOT NULL DEFAULT 0,
      bld_castles       INTEGER NOT NULL DEFAULT 0,
      bld_housing       INTEGER NOT NULL DEFAULT 100,
      fighters    INTEGER NOT NULL DEFAULT 0,
      rangers     INTEGER NOT NULL DEFAULT 0,
      clerics     INTEGER NOT NULL DEFAULT 0,
      mages       INTEGER NOT NULL DEFAULT 0,
      thieves     INTEGER NOT NULL DEFAULT 0,
      ninjas      INTEGER NOT NULL DEFAULT 0,
      researchers INTEGER NOT NULL DEFAULT 0,
      engineers   INTEGER NOT NULL DEFAULT 0,
      engineer_level INTEGER NOT NULL DEFAULT 1,
      engineer_xp    INTEGER NOT NULL DEFAULT 0,
      war_machines     INTEGER NOT NULL DEFAULT 0,
      ballistae        INTEGER NOT NULL DEFAULT 0,
      weapons_stockpile INTEGER NOT NULL DEFAULT 0,
      armor_stockpile   INTEGER NOT NULL DEFAULT 0,
      ladders          INTEGER NOT NULL DEFAULT 0,
      research_allocation TEXT NOT NULL DEFAULT '{}',
      build_queue       TEXT NOT NULL DEFAULT '{}',
      build_progress    TEXT NOT NULL DEFAULT '{}',
      build_allocation  TEXT NOT NULL DEFAULT '{}',
      resource_build_allocation TEXT NOT NULL DEFAULT '{}',
      tools_hammers     INTEGER NOT NULL DEFAULT 0,
      tools_scaffolding INTEGER NOT NULL DEFAULT 0,
      tools_blueprints  INTEGER NOT NULL DEFAULT 0,
      scaffolding_stored INTEGER NOT NULL DEFAULT 0,
      hammers_stored     INTEGER NOT NULL DEFAULT 0,
      xp                REAL NOT NULL DEFAULT 0,
      xp_sources        TEXT NOT NULL DEFAULT '{"turn":0,"gold":0,"combat_win":0,"combat_loss":0,"research":0,"construction":0,"exploration":0,"spell_cast":0,"covert_op":0}',
      level             INTEGER NOT NULL DEFAULT 1,
      troop_levels      TEXT NOT NULL DEFAULT '{}',
      equipment_levels  TEXT NOT NULL DEFAULT '{}',
      training_allocation TEXT NOT NULL DEFAULT '{}',
      scribes     INTEGER NOT NULL DEFAULT 0,
      bld_libraries     INTEGER NOT NULL DEFAULT 0,
      library_allocation TEXT NOT NULL DEFAULT '{}',
      wounded_troops TEXT NOT NULL DEFAULT '{}',
      library_progress   TEXT NOT NULL DEFAULT '{}',
      tower_progress     TEXT NOT NULL DEFAULT '{}',
      scrolls           TEXT NOT NULL DEFAULT '{}',
      maps              INTEGER NOT NULL DEFAULT 0,
      blueprints_stored INTEGER NOT NULL DEFAULT 0,
      active_effects    TEXT NOT NULL DEFAULT '{}',
      coal              INTEGER NOT NULL DEFAULT 0,
      steel             INTEGER NOT NULL DEFAULT 0,
      school_of_magic   TEXT,
      school_spellbook  INTEGER NOT NULL DEFAULT 0,
      created_at  INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER),
      updated_at  INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE TABLE IF NOT EXISTS alliances (
      id          SERIAL PRIMARY KEY,
      name        TEXT    NOT NULL UNIQUE,
      leader_id   INTEGER NOT NULL REFERENCES kingdoms(id),
      created_at  INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE TABLE IF NOT EXISTS alliance_members (
      alliance_id INTEGER NOT NULL REFERENCES alliances(id),
      kingdom_id  INTEGER NOT NULL REFERENCES kingdoms(id),
      pledge      INTEGER NOT NULL DEFAULT 3,
      joined_at   INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER),
      PRIMARY KEY (alliance_id, kingdom_id)
    );
    CREATE TABLE IF NOT EXISTS news (
      id          SERIAL PRIMARY KEY,
      kingdom_id  INTEGER NOT NULL REFERENCES kingdoms(id),
      type        TEXT    NOT NULL,
      message     TEXT    NOT NULL,
      turn_num    INTEGER NOT NULL DEFAULT 0,
      is_read     INTEGER NOT NULL DEFAULT 0,
      combat_log_id INTEGER,
      created_at  INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE TABLE IF NOT EXISTS war_log (
      id              SERIAL PRIMARY KEY,
      action_type     TEXT    NOT NULL,
      attacker_id     INTEGER REFERENCES kingdoms(id),
      attacker_name   TEXT,
      defender_id     INTEGER REFERENCES kingdoms(id),
      defender_name   TEXT,
      outcome         TEXT    NOT NULL,
      detail          TEXT,
      obscured        INTEGER NOT NULL DEFAULT 0,
      created_at      INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE INDEX IF NOT EXISTS idx_war_log_time ON war_log(created_at DESC);
    CREATE TABLE IF NOT EXISTS expeditions (
      id          SERIAL PRIMARY KEY,
      kingdom_id  INTEGER NOT NULL REFERENCES kingdoms(id),
      type        TEXT    NOT NULL,
      turns_left  INTEGER NOT NULL,
      rangers     INTEGER NOT NULL DEFAULT 0,
      fighters    INTEGER NOT NULL DEFAULT 0,
      rewards     TEXT,
      created_at  INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE INDEX IF NOT EXISTS idx_exp_kingdom ON expeditions(kingdom_id);
    CREATE TABLE IF NOT EXISTS combat_log (
      id              SERIAL PRIMARY KEY,
      attacker_id     INTEGER NOT NULL REFERENCES kingdoms(id),
      defender_id     INTEGER NOT NULL REFERENCES kingdoms(id),
      type            TEXT    NOT NULL,
      attacker_won    INTEGER NOT NULL DEFAULT 0,
      land_transferred INTEGER NOT NULL DEFAULT 0,
      detail          TEXT,
      created_at      INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id          SERIAL PRIMARY KEY,
      kingdom_id  INTEGER REFERENCES kingdoms(id),
      player_id   INTEGER NOT NULL DEFAULT 0,
      username    TEXT    NOT NULL DEFAULT '',
      room        TEXT    NOT NULL DEFAULT 'global',
      message     TEXT    NOT NULL,
      deleted     INTEGER NOT NULL DEFAULT 0,
      created_at  INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE TABLE IF NOT EXISTS server_state (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS heroes (
      id          SERIAL PRIMARY KEY,
      kingdom_id  INTEGER NOT NULL REFERENCES kingdoms(id),
      name        TEXT    NOT NULL,
      class       TEXT    NOT NULL,
      level       INTEGER NOT NULL DEFAULT 1,
      xp          REAL NOT NULL DEFAULT 0,
      abilities   TEXT    NOT NULL DEFAULT '[]',
      status      TEXT    NOT NULL DEFAULT 'idle',
      hp          INTEGER NOT NULL DEFAULT 100,
      max_hp      INTEGER NOT NULL DEFAULT 100,
      created_at  INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    -- idx_heroes_kingdom_status(kingdom_id, status) below serves kingdom_id-only
    -- lookups too (leftmost-prefix rule), so a separate kingdom_id-only index would
    -- just add write overhead. runTurn() filters idle heroes every turn by both
    -- columns, and rosters have no hard cap, so the composite index avoids a status
    -- filter pass as they grow.
    DROP INDEX IF EXISTS idx_heroes_kingdom;
    CREATE INDEX IF NOT EXISTS idx_heroes_kingdom_status ON heroes(kingdom_id, status);
    -- kingdom_id is the 2nd column of alliance_members' composite PK, so it can't be
    -- used for kingdom_id-only lookups (every turn + every socket connect). Index it.
    CREATE INDEX IF NOT EXISTS idx_alliance_members_kingdom ON alliance_members(kingdom_id);
    CREATE INDEX IF NOT EXISTS idx_news_kingdom    ON news(kingdom_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_combat_attacker ON combat_log(attacker_id);
    CREATE INDEX IF NOT EXISTS idx_combat_defender ON combat_log(defender_id);
    CREATE INDEX IF NOT EXISTS idx_chat_room       ON chat_messages(room, created_at);
    CREATE INDEX IF NOT EXISTS idx_kingdoms_player ON kingdoms(player_id);
    CREATE INDEX IF NOT EXISTS idx_kingdoms_land   ON kingdoms(land DESC);
    CREATE INDEX IF NOT EXISTS idx_kingdoms_rank_sort ON kingdoms(land DESC, level DESC, population DESC, id ASC);
    CREATE INDEX IF NOT EXISTS idx_kingdoms_name_lower ON kingdoms(LOWER(name));
    CREATE INDEX IF NOT EXISTS idx_chat_room_visible_created ON chat_messages(room, deleted, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_kingdoms_turn   ON kingdoms(turn);
    CREATE INDEX IF NOT EXISTS idx_news_kingdom_created ON news(kingdom_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_kingdoms_player_turn ON kingdoms(player_id, turn DESC);
    CREATE INDEX IF NOT EXISTS idx_expeditions_kingdom ON expeditions(kingdom_id, turns_left);
    CREATE INDEX IF NOT EXISTS idx_war_log_defender ON war_log(defender_id);
    CREATE INDEX IF NOT EXISTS idx_war_log_attacker ON war_log(attacker_id);
    CREATE INDEX IF NOT EXISTS idx_war_log_both    ON war_log(attacker_id, defender_id);
    CREATE INDEX IF NOT EXISTS idx_news_turn        ON news(kingdom_id, turn_num DESC);
    CREATE TABLE IF NOT EXISTS spy_reports (
      id                  SERIAL PRIMARY KEY,
      kingdom_id          INTEGER NOT NULL REFERENCES kingdoms(id),
      target_id           INTEGER NOT NULL REFERENCES kingdoms(id),
      target_name         TEXT    NOT NULL,
      outcome             TEXT    NOT NULL,
      report              TEXT,
      shared_to_alliance  INTEGER NOT NULL DEFAULT 0,
      created_at          INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE INDEX IF NOT EXISTS idx_spy_reports_kingdom ON spy_reports(kingdom_id);
    CREATE INDEX IF NOT EXISTS idx_spy_reports_target  ON spy_reports(target_id);
    CREATE INDEX IF NOT EXISTS idx_spy_reports_created ON spy_reports(created_at DESC);
  `);

  // ── Migrations — safe, idempotent, never crash on duplicate ─────────────────
  async function getColumnType(table, column) {
    try {
      const result = await _db.all(
        `SELECT data_type AS type FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
        [table, column],
      );
      return result?.[0]?.type || null;
    } catch (e) {
      console.error(`[db] Migration: error fetching type for ${table}.${column}:`, e.message);
      return null;
    }
  }

  async function addColumn(table, col, def, colArray) {
    try {
      await _db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
      console.log(`[db] Migration: added ${col} to ${table}`);
      // Update the column array if provided so subsequent checks see the new column
      if (colArray && !colArray.includes(col)) {
        colArray.push(col);
      }
    } catch (e) {
      if (!e.message.includes('duplicate column') && !e.message.includes('already exists')) throw e;
      console.log(`[db] Migration: column ${col} already exists in ${table}`);
    }
  }

  // Ensure key indexes exist
  await _db.exec(`
    CREATE INDEX IF NOT EXISTS idx_kingdoms_player ON kingdoms(player_id);
    CREATE INDEX IF NOT EXISTS idx_kingdoms_land   ON kingdoms(land DESC);
    CREATE INDEX IF NOT EXISTS idx_kingdoms_rank_sort ON kingdoms(land DESC, level DESC, population DESC, id ASC);
    CREATE INDEX IF NOT EXISTS idx_kingdoms_name_lower ON kingdoms(LOWER(name));
    CREATE INDEX IF NOT EXISTS idx_news_created    ON news(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_exp_turns       ON expeditions(turns_left);
  `);

  // Batch column checks by table for performance (single schema fetch per table)
  const kingdomsCols = await getTableColumns('kingdoms');
  const kingdomGoldType = await getColumnType('kingdoms', 'gold');
  if (kingdomGoldType && kingdomGoldType.toLowerCase() !== 'bigint') {
    await _db.run('ALTER TABLE kingdoms ALTER COLUMN gold TYPE BIGINT USING gold::bigint');
    console.log('[db] Migration: converted kingdoms.gold to BIGINT');
  }
  if (!kingdomsCols.includes('turns_stored'))        await addColumn('kingdoms', 'turns_stored',        'INTEGER NOT NULL DEFAULT 400', kingdomsCols);
  if (!kingdomsCols.includes('alliance_buffs'))      await addColumn('kingdoms', 'alliance_buffs',      "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('goals'))               await addColumn('kingdoms', 'goals',               "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('research_allocation')) await addColumn('kingdoms', 'research_allocation', "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('build_queue'))         await addColumn('kingdoms', 'build_queue',         "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('build_progress'))      await addColumn('kingdoms', 'build_progress',      "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('research_progress'))   await addColumn('kingdoms', 'research_progress',   "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('mage_research_progress')) await addColumn('kingdoms', 'mage_research_progress', "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('build_allocation'))    await addColumn('kingdoms', 'build_allocation',    "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('resource_build_allocation')) await addColumn('kingdoms', 'resource_build_allocation', "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('prestige_level'))      await addColumn('kingdoms', 'prestige_level',      'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!kingdomsCols.includes('trade_routes'))       await addColumn('kingdoms', 'trade_routes',       'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!kingdomsCols.includes('tools_hammers'))       await addColumn('kingdoms', 'tools_hammers',       'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!kingdomsCols.includes('tools_scaffolding'))   await addColumn('kingdoms', 'tools_scaffolding',   'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!kingdomsCols.includes('tools_blueprints'))    await addColumn('kingdoms', 'tools_blueprints',    'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!kingdomsCols.includes('scaffolding_stored'))  await addColumn('kingdoms', 'scaffolding_stored',  'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!kingdomsCols.includes('hammers_stored'))      await addColumn('kingdoms', 'hammers_stored',      'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!kingdomsCols.includes('xp'))                  await addColumn('kingdoms', 'xp',                  'REAL NOT NULL DEFAULT 0', kingdomsCols);
  if (!kingdomsCols.includes('xp_sources'))          await addColumn('kingdoms', 'xp_sources',          'TEXT NOT NULL DEFAULT \'{"turn":0,"gold":0,"combat_win":0,"combat_loss":0,"research":0,"construction":0,"exploration":0,"spell_cast":0,"covert_op":0}\'', kingdomsCols);
  if (!kingdomsCols.includes('level'))               await addColumn('kingdoms', 'level',               'INTEGER NOT NULL DEFAULT 1', kingdomsCols);
  if (!kingdomsCols.includes('troop_levels'))        await addColumn('kingdoms', 'troop_levels',        "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('equipment_levels'))    await addColumn('kingdoms', 'equipment_levels',    "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('training_allocation')) await addColumn('kingdoms', 'training_allocation', "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('ballistae'))           await addColumn('kingdoms', 'ballistae',           'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!kingdomsCols.includes('weapons_stockpile'))   await addColumn('kingdoms', 'weapons_stockpile',   'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!kingdomsCols.includes('armor_stockpile'))     await addColumn('kingdoms', 'armor_stockpile',     'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!kingdomsCols.includes('ladders'))             await addColumn('kingdoms', 'ladders',             'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!kingdomsCols.includes('description'))         await addColumn('kingdoms', 'description',         'TEXT', kingdomsCols);
  if (!kingdomsCols.includes('collected_lore'))      await addColumn('kingdoms', 'collected_lore',      "TEXT NOT NULL DEFAULT '[]'", kingdomsCols);
  if (!kingdomsCols.includes('last_lore_id'))        await addColumn('kingdoms', 'last_lore_id',        'TEXT', kingdomsCols);
  if (!kingdomsCols.includes('collected_events'))    await addColumn('kingdoms', 'collected_events',    "TEXT NOT NULL DEFAULT '[]'", kingdomsCols);
  if (!kingdomsCols.includes('last_event_id'))       await addColumn('kingdoms', 'last_event_id',       'TEXT', kingdomsCols);
  if (!kingdomsCols.includes('achievements'))        await addColumn('kingdoms', 'achievements',        "TEXT NOT NULL DEFAULT '[]'", kingdomsCols);
  if (!kingdomsCols.includes('active_trade_routes'))   await addColumn('kingdoms', 'active_trade_routes', "TEXT NOT NULL DEFAULT '[]'", kingdomsCols);
  if (!kingdomsCols.includes('milestones_claimed'))  await addColumn('kingdoms', 'milestones_claimed',  "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('milestone_bonuses'))   await addColumn('kingdoms', 'milestone_bonuses',   "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('milestone_title'))     await addColumn('kingdoms', 'milestone_title',     "TEXT NOT NULL DEFAULT ''", kingdomsCols);
  if (!kingdomsCols.includes('injured_troops'))       await addColumn('kingdoms', 'injured_troops',       "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('wall_hp'))              await addColumn('kingdoms', 'wall_hp',              'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!kingdomsCols.includes('wall_defense_type'))    await addColumn('kingdoms', 'wall_defense_type',    "TEXT NOT NULL DEFAULT ''", kingdomsCols);

  const playerCols = await getTableColumns('players');
  if (!playerCols.includes('email')) await addColumn('players', 'email', 'TEXT');

  const allianceCols = await getTableColumns('alliances');
  if (!allianceCols.includes('vault_gold'))  await addColumn('alliances', 'vault_gold', 'INTEGER NOT NULL DEFAULT 0');
  if (!allianceCols.includes('projects'))    await addColumn('alliances', 'projects', "TEXT NOT NULL DEFAULT '{}'");
  if (!allianceCols.includes('vault_log'))   await addColumn('alliances', 'vault_log', "TEXT NOT NULL DEFAULT '[]'");

  await _db.run(`
    CREATE TABLE IF NOT EXISTS trade_routes (
      id              SERIAL PRIMARY KEY,
      kingdom_id      INTEGER NOT NULL REFERENCES kingdoms(id),
      partner_id      INTEGER NOT NULL REFERENCES kingdoms(id),
      distance        INTEGER NOT NULL DEFAULT 0,
      stability       INTEGER NOT NULL DEFAULT 100,
      efficiency      REAL    NOT NULL DEFAULT 1.0,
      last_raid_at    INTEGER DEFAULT 0,
      created_at      INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    )
  `);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_trade_routes_k ON trade_routes(kingdom_id)`);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_trade_routes_p ON trade_routes(partner_id)`);
  // Composite index for common queries: find routes between two kingdoms
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_trade_routes_composite ON trade_routes(kingdom_id, partner_id)`);

  await _db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id                SERIAL PRIMARY KEY,
      sender_id         INTEGER NOT NULL REFERENCES players(id),
      recipient_id      INTEGER NOT NULL REFERENCES players(id),
      content           TEXT NOT NULL,
      is_read           INTEGER NOT NULL DEFAULT 0,
      created_at        INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    )
  `);

  await _db.run(`CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)`);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id)`);

  await _db.run(`
    CREATE TABLE IF NOT EXISTS forum_boards (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL UNIQUE,
      description TEXT,
      order_index INTEGER NOT NULL DEFAULT 0,
      is_active   INTEGER NOT NULL DEFAULT 1,
      created_at  INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER),
      updated_at  INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    )
  `);

  await _db.run(`
    CREATE TABLE IF NOT EXISTS forum_topics (
      id            SERIAL PRIMARY KEY,
      board_id      INTEGER NOT NULL REFERENCES forum_boards(id),
      player_id     INTEGER NOT NULL REFERENCES players(id),
      title         TEXT NOT NULL,
      content       TEXT NOT NULL,
      post_count    INTEGER NOT NULL DEFAULT 1,
      last_post_at  INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER),
      is_pinned     INTEGER NOT NULL DEFAULT 0,
      is_locked     INTEGER NOT NULL DEFAULT 0,
      created_at    INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER),
      updated_at    INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    )
  `);

  await _db.run(`
    CREATE TABLE IF NOT EXISTS forum_posts (
      id            SERIAL PRIMARY KEY,
      topic_id      INTEGER NOT NULL REFERENCES forum_topics(id),
      player_id     INTEGER NOT NULL REFERENCES players(id),
      content       TEXT NOT NULL,
      is_deleted    INTEGER NOT NULL DEFAULT 0,
      deleted_at    INTEGER,
      created_at    INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER),
      updated_at    INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    )
  `);

  await _db.run(`CREATE INDEX IF NOT EXISTS idx_forum_boards_active ON forum_boards(is_active, order_index)`);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_forum_topics_board ON forum_topics(board_id)`);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_forum_topics_player ON forum_topics(player_id)`);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_forum_posts_topic ON forum_posts(topic_id)`);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_forum_posts_player ON forum_posts(player_id)`);

  // Forum Moderation Tables
  await _db.run(`
    CREATE TABLE IF NOT EXISTS forum_moderators (
      id            SERIAL PRIMARY KEY,
      player_id     INTEGER NOT NULL REFERENCES players(id),
      board_id      INTEGER NOT NULL REFERENCES forum_boards(id),
      assigned_by   INTEGER NOT NULL REFERENCES players(id),
      created_at    INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER),
      UNIQUE(player_id, board_id)
    )
  `);

  await _db.run(`
    CREATE TABLE IF NOT EXISTS forum_bans (
      id            SERIAL PRIMARY KEY,
      player_id     INTEGER NOT NULL REFERENCES players(id),
      board_id      INTEGER REFERENCES forum_boards(id),
      ban_type      TEXT NOT NULL,
      reason        TEXT,
      expires_at    INTEGER,
      banned_by     INTEGER NOT NULL REFERENCES players(id),
      created_at    INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    )
  `);

  await _db.run(`
    CREATE TABLE IF NOT EXISTS forum_reports (
      id            SERIAL PRIMARY KEY,
      post_id       INTEGER NOT NULL REFERENCES forum_posts(id),
      reporter_id   INTEGER NOT NULL REFERENCES players(id),
      status        TEXT NOT NULL DEFAULT 'open',
      reviewed_by   INTEGER REFERENCES players(id),
      action_taken  TEXT,
      created_at    INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER),
      reviewed_at   INTEGER
    )
  `);

  await _db.run(`
    CREATE TABLE IF NOT EXISTS forum_moderation_log (
      id            SERIAL PRIMARY KEY,
      moderator_id  INTEGER NOT NULL REFERENCES players(id),
      action        TEXT NOT NULL,
      target_type   TEXT NOT NULL,
      target_id     INTEGER NOT NULL,
      reason        TEXT,
      created_at    INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    )
  `);

  await _db.run(`CREATE INDEX IF NOT EXISTS idx_forum_moderators_player ON forum_moderators(player_id)`);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_forum_moderators_board ON forum_moderators(board_id)`);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_forum_bans_player ON forum_bans(player_id)`);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_forum_bans_expires ON forum_bans(expires_at)`);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_forum_reports_status ON forum_reports(status)`);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_forum_reports_post ON forum_reports(post_id)`);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_forum_moderation_log_mod ON forum_moderation_log(moderator_id)`);

  const forumBoardCols = await getTableColumns('forum_boards');
  if (!forumBoardCols.includes('category_key')) await addColumn('forum_boards', 'category_key', 'TEXT', forumBoardCols);
  if (!forumBoardCols.includes('category_label')) await addColumn('forum_boards', 'category_label', 'TEXT', forumBoardCols);
  if (!forumBoardCols.includes('category_order')) await addColumn('forum_boards', 'category_order', 'INTEGER DEFAULT 0', forumBoardCols);

  await _db.run(`
    CREATE TABLE IF NOT EXISTS forum_profiles (
      player_id     INTEGER PRIMARY KEY REFERENCES players(id),
      avatar_mode   TEXT NOT NULL DEFAULT 'initials',
      avatar_url    TEXT,
      updated_at    INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    )
  `);

  await _db.run(`
    CREATE TABLE IF NOT EXISTS bounties (
      id                SERIAL PRIMARY KEY,
      placer_id         INTEGER NOT NULL REFERENCES players(id),
      target_id         INTEGER NOT NULL REFERENCES kingdoms(id),
      amount            INTEGER NOT NULL,
      status            TEXT NOT NULL DEFAULT 'active',
      claimed_by_id     INTEGER REFERENCES kingdoms(id),
      created_at        INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    )
  `);

  await _db.run(`CREATE INDEX IF NOT EXISTS idx_bounties_target ON bounties(target_id, status)`);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_bounties_active ON bounties(status, amount DESC)`);

  await _db.run(`
    CREATE TABLE IF NOT EXISTS lore_entries (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    )
  `);

  await _db.run(`
    CREATE TABLE IF NOT EXISTS random_events (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    )
  `);

  await _db.run(`
    CREATE TABLE IF NOT EXISTS junk_events (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    )
  `);

  await _db.run(`
    CREATE TABLE IF NOT EXISTS tax_events (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    )
  `);

  await _db.run(`
    CREATE TABLE IF NOT EXISTS regions (
      name              TEXT PRIMARY KEY,
      owner_alliance_id INTEGER REFERENCES alliances(id),
      contest_alliance_id INTEGER REFERENCES alliances(id),
      contest_progress  INTEGER NOT NULL DEFAULT 0,
      bonus_type        TEXT,
      lore              TEXT,
      created_at        INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER),
      updated_at        INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    )
  `);

  // Initialize regions if they don't exist
  const REGION_DATA_LOCAL = [
    ['The Iron Holds',      'construction'],
    ['The Silverwood',      'magic'],
    ['The Bloodplains',     'military'],
    ['The Underspire',      'stealth'],
    ['The Heartlands',      'economy'],
    ['The Ashfang Wilds',   'military']
  ];
  for (const [name, bonus] of REGION_DATA_LOCAL) {
    await _db.run(
      'INSERT INTO regions (name, bonus_type) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
      [name, bonus],
    );
  }

  const pCols = await getTableColumns('players');
  if (!pCols.includes('is_admin'))   await addColumn('players', 'is_admin',   'INTEGER NOT NULL DEFAULT 0');
  if (!pCols.includes('is_banned'))  await addColumn('players', 'is_banned',  'INTEGER NOT NULL DEFAULT 0');
  if (!pCols.includes('ban_reason')) await addColumn('players', 'ban_reason', 'TEXT');
  if (!pCols.includes('is_ai'))      await addColumn('players', 'is_ai',      'INTEGER NOT NULL DEFAULT 0');

  const nCols = await getTableColumns('news');
  if (!nCols.includes('turn_num')) await addColumn('news', 'turn_num', 'INTEGER NOT NULL DEFAULT 0');
  if (!nCols.includes('combat_log_id')) await addColumn('news', 'combat_log_id', 'INTEGER');

  if (!pCols.includes('is_chat_mod'))  await addColumn('players', 'is_chat_mod',  'INTEGER NOT NULL DEFAULT 0');
  if (!pCols.includes('chat_banned'))  await addColumn('players', 'chat_banned',  'INTEGER NOT NULL DEFAULT 0');
  if (!pCols.includes('chat_ban_reason')) await addColumn('players', 'chat_ban_reason', 'TEXT');
  if (!pCols.includes('chat_color'))  await addColumn('players', 'chat_color',  "TEXT DEFAULT NULL");
  if (!pCols.includes('chat_name'))   await addColumn('players', 'chat_name',   "TEXT DEFAULT NULL");

  await _db.run(`
    CREATE TABLE IF NOT EXISTS suggestions (
      id SERIAL PRIMARY KEY,
      player_id INTEGER,
      kingdom_id INTEGER,
      message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await _db.run(`
    CREATE TABLE IF NOT EXISTS changelog_entries (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      body_md TEXT,
      category TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      source_id INTEGER,
      author_name TEXT,
      discord_sent INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    )
  `);

  const changelogCols = await getTableColumns('changelog_entries');
  if (changelogCols.length && !changelogCols.includes('body_md')) {
    await addColumn('changelog_entries', 'body_md', 'TEXT', changelogCols);
  }

  await _db.run(`
    CREATE TABLE IF NOT EXISTS bug_reports (
      id SERIAL PRIMARY KEY,
      player_id INTEGER,
      kingdom_id INTEGER,
      username TEXT,
      kingdom_name TEXT,
      category TEXT NOT NULL DEFAULT 'bug',
      message TEXT NOT NULL,
      context_panel TEXT,
      page_url TEXT,
      user_agent TEXT,
      console_log TEXT,
      discord_sent INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    )
  `);

  const bugReportCols = await getTableColumns('bug_reports');
  if (bugReportCols.length && !bugReportCols.includes('console_log')) {
    await addColumn('bug_reports', 'console_log', 'TEXT', bugReportCols);
  }

  await _db.run(`
    CREATE TABLE IF NOT EXISTS admin_notes (
      id SERIAL PRIMARY KEY,
      author_name TEXT,
      message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await _db.run(`
    CREATE TABLE IF NOT EXISTS wishlist (
      id SERIAL PRIMARY KEY,
      category TEXT,
      description TEXT,
      completed INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  const cmCols = await getTableColumns('chat_messages');
  if (!cmCols.includes('username')) await addColumn('chat_messages', 'username', 'TEXT NOT NULL DEFAULT \'\'');
  if (!cmCols.includes('player_id')) await addColumn('chat_messages', 'player_id', 'INTEGER NOT NULL DEFAULT 0');
  if (!cmCols.includes('deleted'))  await addColumn('chat_messages', 'deleted',  'INTEGER NOT NULL DEFAULT 0');

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

  if (!kingdomsCols.includes('region')) {
    await addColumn('kingdoms', 'region', "TEXT NOT NULL DEFAULT ''", kingdomsCols);
    // Backfill existing kingdoms
    const RACE_REGIONS = {
      dwarf:'The Iron Holds', high_elf:'The Silverwood', orc:'The Bloodplains',
      dark_elf:'The Underspire', human:'The Heartlands', dire_wolf:'The Ashfang Wilds',
      vampire:'The Crimson Vales', wood_elf:'The Wildwood', ogre:'The Shattered Peaks',
    };
    const existing = await _db.all('SELECT id, race FROM kingdoms');
    for (const k of existing) {
      await _db.run('UPDATE kingdoms SET region = $1 WHERE id = $2', [RACE_REGIONS[k.race] || 'The Unknown Lands', k.id]);
    }
  }
  if (!kingdomsCols.includes('smithy_allocation'))          await addColumn('kingdoms', 'smithy_allocation',          "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('hammer_turns_used'))          await addColumn('kingdoms', 'hammer_turns_used',          'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!kingdomsCols.includes('racial_bonuses_unlocked'))    await addColumn('kingdoms', 'racial_bonuses_unlocked',    "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);

  // Expeditions — seen flag so completed rows persist until frontend acknowledges
  const expCols = await getTableColumns('expeditions');
  if (!expCols.includes('seen')) {
    await addColumn('expeditions', 'seen', 'INTEGER NOT NULL DEFAULT 0');
    // Clean up any old stuck completed rows that predate the seen column
    await _db.run('DELETE FROM expeditions WHERE turns_left = 0');
  }
  if (!expCols.includes('food_taken')) {
    await addColumn('expeditions', 'food_taken', 'INTEGER NOT NULL DEFAULT 0');
  }

  // Expeditions — rewards_claimed column (prevent double-claiming on concurrent processing)
  const expCols2 = await getTableColumns('expeditions');
  if (expCols2.length > 0 && !expCols2.includes('rewards_claimed')) {
    await addColumn('expeditions', 'rewards_claimed', 'INTEGER NOT NULL DEFAULT 0');
  }

  // Resource expeditions — food_taken column
  const resExpCols = await getTableColumns('resource_expeditions');
  if (resExpCols.length > 0 && !resExpCols.includes('food_taken')) {
    await addColumn('resource_expeditions', 'food_taken', 'INTEGER NOT NULL DEFAULT 0');
  }
  if (!kingdomsCols.includes('bld_housing'))             await addColumn('kingdoms', 'bld_housing',             'INTEGER NOT NULL DEFAULT 100', kingdomsCols);
  if (!kingdomsCols.includes('mage_tower_allocation'))   await addColumn('kingdoms', 'mage_tower_allocation',   "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('shrine_allocation'))       await addColumn('kingdoms', 'shrine_allocation',       "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('scribes'))             await addColumn('kingdoms', 'scribes',             'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!kingdomsCols.includes('bld_libraries'))       await addColumn('kingdoms', 'bld_libraries',       'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!kingdomsCols.includes('wounded_troops'))      await addColumn('kingdoms', 'wounded_troops',      "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('bld_taverns'))         await addColumn('kingdoms', 'bld_taverns',         'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!kingdomsCols.includes('bld_granaries'))       await addColumn('kingdoms', 'bld_granaries',       'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!kingdomsCols.includes('granary_upgrades'))    await addColumn('kingdoms', 'granary_upgrades',    "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('bld_mage_towers'))     await addColumn('kingdoms', 'bld_mage_towers',     'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!kingdomsCols.includes('world_fragments'))      await addColumn('kingdoms', 'world_fragments',     "TEXT NOT NULL DEFAULT '[]'", kingdomsCols);
  if (!kingdomsCols.includes('hybrid_blueprints'))    await addColumn('kingdoms', 'hybrid_blueprints',   "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('fragment_bonuses'))     await addColumn('kingdoms', 'fragment_bonuses',    "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('fortified_blueprints')) await addColumn('kingdoms', 'fortified_blueprints','INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!kingdomsCols.includes('fortified_buildings'))  await addColumn('kingdoms', 'fortified_buildings', "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('library_allocation'))  await addColumn('kingdoms', 'library_allocation',  "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('library_progress'))    await addColumn('kingdoms', 'library_progress',    "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('tower_progress'))      await addColumn('kingdoms', 'tower_progress',      "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('scrolls'))             await addColumn('kingdoms', 'scrolls',             "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('maps'))                await addColumn('kingdoms', 'maps',                'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!kingdomsCols.includes('blueprints_stored'))   await addColumn('kingdoms', 'blueprints_stored',   'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!kingdomsCols.includes('certified_blueprints_stored')) await addColumn('kingdoms', 'certified_blueprints_stored', 'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!kingdomsCols.includes('active_effects'))      await addColumn('kingdoms', 'active_effects',      "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);

  if (!kingdomsCols.includes('bld_walls'))          await addColumn('kingdoms', 'bld_walls',          'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!kingdomsCols.includes('wall_upgrades'))      await addColumn('kingdoms', 'wall_upgrades',      "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('tower_def_upgrades')) await addColumn('kingdoms', 'tower_def_upgrades', "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('outpost_upgrades'))   await addColumn('kingdoms', 'outpost_upgrades',   "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('defense_upgrades'))   await addColumn('kingdoms', 'defense_upgrades',   "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);

  // Legacy data migration: if defence_upgrades exists but defense_upgrades is empty, copy it
  if (kingdomsCols.includes('defence_upgrades') && kingdomsCols.includes('defense_upgrades')) {
    const migrationName = '001_migrate_defence_to_defense_upgrades';
    const existing = await _db.get('SELECT id FROM migrations WHERE name = $1', [migrationName]);
    if (!existing) {
      await _db.run(`UPDATE kingdoms SET defense_upgrades = defence_upgrades WHERE defense_upgrades = '{}' AND defence_upgrades != '{}'`);
      await _db.run('INSERT INTO migrations (name) VALUES ($1)', [migrationName]);
      console.log('[db] Migration applied:', migrationName);
    }
  }
  if (!kingdomsCols.includes('tower_upgrades'))    await addColumn('kingdoms', 'tower_upgrades',    "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('school_upgrades'))   await addColumn('kingdoms', 'school_upgrades',   "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('shrine_upgrades'))   await addColumn('kingdoms', 'shrine_upgrades',   "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('library_upgrades'))  await addColumn('kingdoms', 'library_upgrades',  "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('research_focus'))    await addColumn('kingdoms', 'research_focus',     "TEXT NOT NULL DEFAULT '[]'", kingdomsCols);
  if (!kingdomsCols.includes('divine_sanctuary_used')) await addColumn('kingdoms', 'divine_sanctuary_used', 'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!kingdomsCols.includes('farm_upgrades'))       await addColumn('kingdoms', 'farm_upgrades',       "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('market_upgrades'))     await addColumn('kingdoms', 'market_upgrades',     "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('tavern_upgrades'))     await addColumn('kingdoms', 'tavern_upgrades',     "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('bank_upgrades'))       await addColumn('kingdoms', 'bank_upgrades',       "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('bank_deposits'))       await addColumn('kingdoms', 'bank_deposits',       "TEXT NOT NULL DEFAULT '[]'", kingdomsCols);
  if (!kingdomsCols.includes('ledger'))              await addColumn('kingdoms', 'ledger',              "TEXT NOT NULL DEFAULT '[]'", kingdomsCols);
  if (!kingdomsCols.includes('bld_mausoleums'))      await addColumn('kingdoms', 'bld_mausoleums',      'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!kingdomsCols.includes('thralls'))             await addColumn('kingdoms', 'thralls',             'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!kingdomsCols.includes('mausoleum_upgrades'))   await addColumn('kingdoms', 'mausoleum_upgrades',   "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('mausoleum_allocation')) await addColumn('kingdoms', 'mausoleum_allocation', "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);

  // Data migration: tools_* -> *_stored
  const toolsMigrationName = '002_migrate_tools_to_stored';
  const toolsMigrationExists = await _db.get('SELECT id FROM migrations WHERE name = $1', [toolsMigrationName]);
  if (!toolsMigrationExists) {
    if (kingdomsCols.includes('tools_scaffolding') && kingdomsCols.includes('scaffolding_stored')) {
      await _db.run("UPDATE kingdoms SET scaffolding_stored = tools_scaffolding WHERE scaffolding_stored = 0 AND tools_scaffolding > 0");
    }
    if (kingdomsCols.includes('tools_hammers') && kingdomsCols.includes('hammers_stored')) {
      await _db.run("UPDATE kingdoms SET hammers_stored = tools_hammers WHERE hammers_stored = 0 AND tools_hammers > 0");
    }
    await _db.run('INSERT INTO migrations (name) VALUES ($1)', [toolsMigrationName]);
    console.log('[db] Migration applied:', toolsMigrationName);
  }

  if (!kingdomsCols.includes('food_shortage_turns')) await addColumn('kingdoms', 'food_shortage_turns', 'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!kingdomsCols.includes('food_surplus_turns'))  await addColumn('kingdoms', 'food_surplus_turns',  'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!kingdomsCols.includes('mercenaries'))         await addColumn('kingdoms', 'mercenaries',         "TEXT NOT NULL DEFAULT '[]'", kingdomsCols);

  // Trade offers table
  await _db.exec(`
    CREATE TABLE IF NOT EXISTS trade_offers (
      id            SERIAL PRIMARY KEY,
      sender_id     INTEGER NOT NULL REFERENCES kingdoms(id),
      sender_name   TEXT    NOT NULL,
      receiver_id   INTEGER NOT NULL REFERENCES kingdoms(id),
      receiver_name TEXT    NOT NULL,
      offer         TEXT    NOT NULL,
      request       TEXT    NOT NULL,
      status        TEXT    NOT NULL DEFAULT 'pending',
      created_at    INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER),
      expires_at    INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER + 3600)
    );
    CREATE INDEX IF NOT EXISTS idx_trade_offers_receiver ON trade_offers(receiver_id, status);
    CREATE INDEX IF NOT EXISTS idx_trade_offers_sender   ON trade_offers(sender_id, status);
    CREATE INDEX IF NOT EXISTS idx_trade_offers_sender_recent ON trade_offers(sender_id, status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_trade_offers_receiver_recent ON trade_offers(receiver_id, status, created_at DESC);
    -- Sort-covering index for the sender-side query that lists ALL offers
    -- (no status filter): WHERE sender_id = $1 ORDER BY created_at DESC LIMIT 20
    -- The (sender_id, status, created_at) index above isn't sort-covering
    -- without a status equality predicate.
    CREATE INDEX IF NOT EXISTS idx_trade_offers_sender_created ON trade_offers(sender_id, created_at DESC);
  `);

  // Mercenaries table
  await _db.exec(`
    CREATE TABLE IF NOT EXISTS mercenaries (
      id              SERIAL PRIMARY KEY,
      kingdom_id      INTEGER NOT NULL REFERENCES kingdoms(id),
      unit_type       TEXT    NOT NULL,
      level           INTEGER NOT NULL,
      count           INTEGER NOT NULL,
      tier            TEXT    NOT NULL,
      hired_at_turn   INTEGER NOT NULL DEFAULT 0,
      duration_turns  INTEGER NOT NULL DEFAULT 20,
      upkeep_per_turn INTEGER NOT NULL DEFAULT 0,
      created_at      INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE INDEX IF NOT EXISTS idx_mercs_kingdom ON mercenaries(kingdom_id);
  `);

  await _db.exec(`
    CREATE TABLE IF NOT EXISTS war_log (
      id              SERIAL PRIMARY KEY,
      action_type     TEXT    NOT NULL,
      attacker_id     INTEGER REFERENCES kingdoms(id),
      attacker_name   TEXT,
      defender_id     INTEGER REFERENCES kingdoms(id),
      defender_name   TEXT,
      outcome         TEXT    NOT NULL,
      detail          TEXT,
      obscured        INTEGER NOT NULL DEFAULT 0,
      created_at      INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE INDEX IF NOT EXISTS idx_war_log_time ON war_log(created_at DESC);
  `);

  // ── Season & events migrations ────────────────────────────────────────────────
  if (!kingdomsCols.includes('last_event_at'))         await addColumn('kingdoms', 'last_event_at',         'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!kingdomsCols.includes('active_event'))          await addColumn('kingdoms', 'active_event',          "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('discovered_kingdoms'))   await addColumn('kingdoms', 'discovered_kingdoms',   "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('location_maps_wip'))     await addColumn('kingdoms', 'location_maps_wip',     "TEXT NOT NULL DEFAULT '[]'", kingdomsCols);

  // Market Prices table procedural check
  await _db.exec(`
    CREATE TABLE IF NOT EXISTS market_prices (
      id            TEXT PRIMARY KEY,
      current_price REAL NOT NULL,
      base_price    REAL NOT NULL,
      updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  const freshDefaultPrices = [
    ['food',    0.5, 0.5],
    ['wood',    1000.0, 1000.0],
    ['stone',   5000.0, 5000.0],
    ['iron',    10000.0, 10000.0],
    ['coal',    2000.0, 2000.0],
    ['steel',   20000.0, 20000.0],
    ['mana',    2.0, 2.0],
    ['weapons', 25.0, 25.0],
    ['armor',   25.0, 25.0],
    ['war_machines', 1000.0, 1000.0],
    ['ballistae', 1000.0, 1000.0],
    ['land',    5000.0, 5000.0]
  ];
  for (const [id, current, base] of freshDefaultPrices) {
    await _db.run(
      'INSERT INTO market_prices (id, current_price, base_price) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
      [id, current, base],
    );
  }

  // Events table
  await _db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id          SERIAL PRIMARY KEY,
      key         TEXT    NOT NULL UNIQUE,
      name        TEXT    NOT NULL,
      description TEXT    NOT NULL,
      season      TEXT    NOT NULL DEFAULT 'all',
      effect_type TEXT    NOT NULL DEFAULT 'happiness',
      effect_value REAL   NOT NULL DEFAULT 5,
      effect_duration INTEGER NOT NULL DEFAULT 1,
      race_only   TEXT    DEFAULT NULL,
      is_positive INTEGER NOT NULL DEFAULT 1,
      is_active   INTEGER NOT NULL DEFAULT 1,
      created_at  INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
  `);

  // Event log table
  await _db.exec(`
    CREATE TABLE IF NOT EXISTS event_log (
      id          SERIAL PRIMARY KEY,
      kingdom_id  INTEGER NOT NULL REFERENCES kingdoms(id),
      kingdom_name TEXT   NOT NULL,
      event_key   TEXT    NOT NULL,
      event_name  TEXT    NOT NULL,
      season      TEXT    NOT NULL,
      fired_at    INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    );
    CREATE INDEX IF NOT EXISTS idx_event_log_fired ON event_log(fired_at DESC);
    CREATE INDEX IF NOT EXISTS idx_event_log_kingdom ON event_log(kingdom_id);
  `);

  // Seed season state
  await _db.run(
    `INSERT INTO server_state (key, value) VALUES ('current_season', 'spring') ON CONFLICT (key) DO NOTHING`,
  );
  await _db.run(
    `INSERT INTO server_state (key, value) VALUES ('season_started_at', ${EPOCH_NOW_TEXT}) ON CONFLICT (key) DO NOTHING`,
  );

  // Seed default events
  const defaultEvents = [
    // Spring
    ['spring_bloom',      'Spring Bloom',         'Warm rains encourage growth.',                  'spring', 'farm_yield', 0.10, 5, null, 1],
    ['spring_floods',     'Spring Floods',         'Rising rivers damage farmland.',                'spring', 'happiness',   -5,   3, null, 0],
    ['pollination_boom',  'Pollination Boom',      'A great flowering swells the population.',      'spring', 'population', 500, 1, null, 1],
    ['warm_winds',        'Warm Winds',            'A pleasant breeze lifts spirits.',              'spring', 'happiness',    5,   1, null, 1],
    // Summer
    ['abundant_harvest',  'Abundant Harvest',      'Exceptional sun yields record crops.',          'summer', 'food',      0.15, 1, null, 1],
    ['heat_wave',         'Heat Wave',             'Scorching heat wilts crops and happiness.',     'summer', 'farm_yield',-0.10,3, null, 0],
    ['travelling_merch',  'Travelling Merchants',  'Exotic goods boost market income.',             'summer', 'gold',      0.02, 3, null, 1],
    ['border_skirmish',   'Border Skirmish',       'Bandits raid your outlying farms.',             'summer', 'food',     -0.05,1, null, 0],
    // Fall
    ['harvest_festival',  'Harvest Festival',      'The kingdom celebrates a bountiful autumn.',    'fall',   'happiness',    10,  1, null, 1],
    ['early_frost',       'Early Frost',           'An unexpected frost kills late crops.',         'fall',   'farm_yield',-0.15,2, null, 0],
    ['trade_boom',        'Trade Boom',            'Merchants flock to your markets.',              'fall',   'gold',      0.05, 3, null, 1],
    ['rat_infestation',   'Rat Infestation',       'Vermin consume stored food.',                   'fall',   'food',     -0.10,1, null, 0],
    // Winter
    ['blizzard',          'Blizzard',              'A fierce storm cripples farms and happiness.',  'winter', 'farm_yield',-0.20,2, null, 0],
    ['refugees',          'Refugees Arrive',       'Displaced families seek shelter.',              'winter', 'population', 1000,1, null, 1],
    ['winter_plague',     'Winter Plague',         'Disease spreads through the cold months.',      'winter', 'population',-0.02,1, null, 0],
    ['wolf_raids',        'Wolf Raids',            'Dire wolves raid border farms.',                'winter', 'food',     -0.08,1, null, 0],
    // Race-specific
    ['ice_trade',         'Ice Trade',             'Dwarven merchants profit from winter routes.',  'winter', 'gold',      0.05, 2, 'dwarf',    1],
    ['dire_wolf_hunt',    'Great Hunt',            'Dire Wolf hunters return laden with prey.',     'fall',   'food',      0.20, 1, 'dire_wolf', 1],
    ['elven_bloom',       'Elven Bloom',           'High Elf mages channel spring energy.',        'spring', 'mana',      0.15, 3, 'high_elf', 1],
    ['dark_elf_shadow',   'Shadow Markets',        'Dark Elf smugglers exploit the long nights.',  'winter', 'gold',      0.08, 2, 'dark_elf', 1],
    ['orc_rampage',       'Orc Rampage',           'Summer heat fuels Orcish aggression.',         'summer', 'military',  0.10, 2, 'orc',      1],
  ];
  for (const [key,name,description,season,effect_type,effect_value,effect_duration,race_only,is_positive] of defaultEvents) {
    await _db.run(
      `INSERT INTO events (key,name,description,season,effect_type,effect_value,effect_duration,race_only,is_positive) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (key) DO NOTHING`,
      [key, name, description, season, effect_type, effect_value, effect_duration, race_only, is_positive],
    );
  }

  const hasEvents = await _db.get("SELECT 1 FROM random_events LIMIT 1");
  if (!hasEvents) {
    const defaultRandomEvents = [
      'a suspiciously damp sock',
      'a map to a location that no longer exists',
      'a very confident fortune cookie with no fortune inside',
      'a half-eaten ration bar of unknown vintage',
      'a decorative rock (it does nothing)',
      'a pamphlet titled "10 Reasons Orcs Are Actually Quite Misunderstood"',
      'a jar of mysterious grey paste (do not eat)',
      'a slightly bent sword that the previous owner called "Destiny"',
      'a tiny flag from a kingdom that fell 300 years ago',
      'a love letter addressed to someone named Grimbold',
      'a collection of 47 different types of dirt',
      'a boot (just the one)',
      'a certificate of participation from the Third Annual Swamp Festival',
      'a wheel of cheese that has achieved sentience (probably)',
      'a bag of magic beans that are, on closer inspection, just beans',
      'a very thorough guide to knitting (no one in your kingdom knows how to read)',
      'a suspicious smell that follows rangers home',
      'a crystal ball showing only static',
      'an extremely detailed painting of a cloud',
      'a dwarf\'s shopping list (mostly cheese)',
      'a torch that only works in daylight',
      'a book called "How To Stop Being Poor" — all pages blank',
      'a rusty key to an unknown lock',
      'a proclamation declaring your kingdom "pretty good, probably"',
      'a coupon for 10% off at an inn that burned down decades ago',
    ];
    for (const e of defaultRandomEvents) {
      await _db.run("INSERT INTO random_events (content) VALUES ($1)", [e]);
    }
  }

  const hasTaxEvents = await _db.get("SELECT 1 FROM tax_events LIMIT 1");
  if (!hasTaxEvents) {
    const defaultTaxEvents = [
      'Citizens held a spontaneous parade in your honor. +Happiness!',
      'A grateful merchant left a small chest of exotic spices at the keep.',
      'Happy farmers brought in an unexpected surplus harvest this turn.',
      'The local bard wrote a popular song praising your generosity.',
      'A wealthy citizen made a voluntary donation to the treasury.',
      'Children are playing in the streets, pretending to be you. It is adorable.',
      'A baker sent a massive, intricately decorated cake to the castle.',
      'Local craftsmen repaired the city gates for free out of gratitude.',
      'A passing trade caravan heard of your fairness and gave a discount on goods.',
      'A minor skirmish in the market was broken up peacefully by happy citizens.',
      'The militia actually showed up to training with a smile today.',
      'A rare flower bloomed in the plaza, which the locals view as a blessing on your reign.',
      'Citizens volunteered to clean the slums, improving public health.',
      'A traveling scholar decided to settle here, impressed by the high happiness.',
      'Toasted effigies of rival lords were burned in a joyful festival.',
      'Someone anonymously paid off the debts of several poor families.',
      'A mysterious benefactor repaired the old bell tower.',
      'A group of rangers brought back extra pelts as a gift for the crown.',
      'The town square is bustling with cheerful traders and artisans.',
      'The tavern is giving out free ale in your name tonight!',
      'You found a small bag of gold coins left on the throne as a tribute.',
      'A guild of artisans crafted a new banner for your kingdom.',
      'The local clergy reported unusually high attendance and high spirits.',
      'A flock of doves settled on the castle walls, seen as a good omen.',
      'The citizens built a small, slightly crooked statue of you in the park.'
    ];
    for (const e of defaultTaxEvents) {
      await _db.run("INSERT INTO tax_events (content) VALUES ($1)", [e]);
    }
  }

  const loreCols = await getTableColumns('lore_entries');
  if (!loreCols.includes('title')) await addColumn('lore_entries', 'title', "TEXT NOT NULL DEFAULT ''");
  if (!loreCols.includes('category')) await addColumn('lore_entries', 'category', "TEXT NOT NULL DEFAULT 'general'");
  if (!loreCols.includes('key_id')) await addColumn('lore_entries', 'key_id', "TEXT NOT NULL DEFAULT ''");

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
    const LORE_SEED = require('../game/lore');
    for (const cat of Object.keys(LORE_SEED)) {
      const hasCat = await _db.get("SELECT 1 FROM lore_entries WHERE category = $1 LIMIT 1", [cat]);
      if (hasCat) continue;
      for (const item of LORE_SEED[cat]) {
        await _db.run("INSERT INTO lore_entries (key_id, category, title, content) VALUES ($1, $2, $3, $4)", [item.id, cat, item.title, item.msg]);
      }
    }
  }

  const hasWishlist = await _db.get("SELECT 1 FROM wishlist LIMIT 1");
  if (!hasWishlist) {
    const defaultWishlist = [
      { category: 'Gameplay', desc: 'Spell casting target history — remember last target per spell' },
      { category: 'Gameplay', desc: 'Diplomacy — formal non-aggression pacts and tribute' },
      { category: 'Gameplay', desc: 'Resource loans — player-run debt and interest mechanics' },
      { category: 'Combat', desc: 'Alliance war — alliances can declare war on each other' },
      { category: 'Combat', desc: 'Artifact hunting — high-risk expeditions for unique items' },
      { category: 'Combat', desc: 'Naval combat — build ships to contest ocean territories' },
      { category: 'Economy', desc: 'Auction house — bid on unique gear and captured heroes' },
      { category: 'Economy', desc: 'Prestige economy — prestige kingdoms get permanent market bonuses' },
      { category: 'World', desc: 'More races — Gnome (inventor), Troll (regenerating), Halfling (stealth)' },
      { category: 'World', desc: 'Dungeons & Raids — PvE multi-kingdom boss battles' },
      { category: 'World', desc: 'Resource biomes — specific lands granting unique materials' },
      { category: 'Polish & Management', desc: 'Custom kingdom banner/sigil generator' },
      { category: 'Polish & Management', desc: 'Full iOS / Android PWA wrapping' },
      { category: 'Polish & Management', desc: 'Dark/light/high-contrast theme toggles' },
      { category: 'Polish & Management', desc: 'Email/Push notifications — optional alerts for attacks, expedition return' },
      { category: 'Polish & Management', desc: 'Step-by-step interactive new player tutorial' },
      { category: 'Economy', desc: 'Caravans — physical trade routes that can be ambushed' },
      { category: 'Combat', desc: 'Generals — train commanding officers that boost army happiness during battles' },
      { category: 'World', desc: 'Weather Systems — dynamic weather impacting crop yields and battle visibility' },
      { category: 'Gameplay', desc: 'Espionage Network — permanent passive intel gathering on nearby kingdoms' },
      { category: 'Combat', desc: 'Mercenary Guilds — hire specialized factions with unique unit types' },
      { category: 'Polish & Management', desc: 'Global Market History — graphs showing price fluctuations over time' },
      { category: 'World', desc: 'Dynamic World Events — comets, earthquakes, eclipses that provide global modifiers' },
      { category: 'Gameplay', desc: 'Religion/Pantheon — worship different gods for diverse domain bonuses' },
      { category: 'Combat', desc: 'Terrain Advantages — defending in mountains, forests, or plains affects combat stats' },
      { category: 'Gameplay', desc: 'Laws & Edicts — enact kingdom-wide policies with pros and cons' },
      { category: 'Economy', desc: 'Smuggling Rings — illegal market trades that bypass taxes' },
      { category: 'World', desc: 'Wandering Beasts — powerful monsters that attack random kingdoms until defeated' },
      { category: 'Polish & Management', desc: 'Customizable Palace UI — visually upgrade the player dashboard as level increases' },
      { category: 'Gameplay', desc: 'Prisoners of War — ransom captured enemy troops for gold or execute for happiness' },
      { category: 'Combat', desc: 'Naval Trade Routes — ocean routes for faster gold generation but higher risk' }
    ];
    for (const w of defaultWishlist) {
      await _db.run("INSERT INTO wishlist (category, description) VALUES ($1, $2)", [w.category, w.desc]);
    }
  }

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

  // ── Resource Gathering System Migrations ─────────────────────────────────────
  // Re-read cols since earlier migrations may have added columns
  const cols2 = await getTableColumns('kingdoms');

  // Resource stockpile columns
  if (!cols2.includes('wood'))               await addColumn('kingdoms', 'wood',               'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!cols2.includes('stone'))              await addColumn('kingdoms', 'stone',              'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!cols2.includes('iron'))               await addColumn('kingdoms', 'iron',               'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!cols2.includes('coal'))               await addColumn('kingdoms', 'coal',               'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!cols2.includes('steel'))              await addColumn('kingdoms', 'steel',              'INTEGER NOT NULL DEFAULT 0', kingdomsCols);

  // Wood buildings
  if (!cols2.includes('bld_woodyard'))       await addColumn('kingdoms', 'bld_woodyard',       'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!cols2.includes('bld_lumber_camp'))    await addColumn('kingdoms', 'bld_lumber_camp',    'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!cols2.includes('bld_sawmill'))        await addColumn('kingdoms', 'bld_sawmill',        'INTEGER NOT NULL DEFAULT 0', kingdomsCols);

  // Stone buildings
  if (!cols2.includes('bld_gravel_pit'))     await addColumn('kingdoms', 'bld_gravel_pit',     'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!cols2.includes('bld_blockfield'))     await addColumn('kingdoms', 'bld_blockfield',     'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!cols2.includes('bld_stone_quarry'))   await addColumn('kingdoms', 'bld_stone_quarry',   'INTEGER NOT NULL DEFAULT 0', kingdomsCols);

  // Iron buildings
  if (!cols2.includes('bld_open_pit'))       await addColumn('kingdoms', 'bld_open_pit',       'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!cols2.includes('bld_strip_mine'))     await addColumn('kingdoms', 'bld_strip_mine',     'INTEGER NOT NULL DEFAULT 0', kingdomsCols);
  if (!cols2.includes('bld_deep_mine'))      await addColumn('kingdoms', 'bld_deep_mine',      'INTEGER NOT NULL DEFAULT 0', kingdomsCols);

  // Items inventory (JSON array)
  if (!cols2.includes('items'))              await addColumn('kingdoms', 'items',              "TEXT NOT NULL DEFAULT '[]'", kingdomsCols);

  // Resource sequence (bracket lock tracking)
  if (!cols2.includes('resource_sequence'))  await addColumn('kingdoms', 'resource_sequence',  "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);

  // Magic schools - school selection and school-specific spellbook
  if (!cols2.includes('school_of_magic'))   await addColumn('kingdoms', 'school_of_magic',   "TEXT", kingdomsCols);
  if (!cols2.includes('school_spellbook'))  await addColumn('kingdoms', 'school_spellbook',  "INTEGER NOT NULL DEFAULT 0", kingdomsCols);

  // Custom player portrait
  if (!cols2.includes('custom_portrait'))   await addColumn('kingdoms', 'custom_portrait',   "TEXT", kingdomsCols);

  // Resource nodes table
  await _db.run(`
    CREATE TABLE IF NOT EXISTS resource_nodes (
      id SERIAL PRIMARY KEY,
      kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id),
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      distance INTEGER NOT NULL,
      richness INTEGER NOT NULL,
      discovered_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    )
  `);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_resource_nodes_kingdom ON resource_nodes(kingdom_id)`);

  const resourceNodeCols = await getTableColumns('resource_nodes');
  if (!resourceNodeCols.includes('map_x')) await addColumn('resource_nodes', 'map_x', 'INTEGER', resourceNodeCols);
  if (!resourceNodeCols.includes('map_y')) await addColumn('resource_nodes', 'map_y', 'INTEGER', resourceNodeCols);
  if (!resourceNodeCols.includes('terrain')) {
    await addColumn('resource_nodes', 'terrain', 'TEXT', resourceNodeCols);
    await _db.run(`UPDATE resource_nodes SET terrain = 'plains' WHERE terrain IS NULL OR terrain = ''`);
  }

  // Admin goal definitions table (overrides defaults from game/goals.js)
  await _db.run(`
    CREATE TABLE IF NOT EXISTS admin_goal_definitions (
      id SERIAL PRIMARY KEY,
      tier TEXT NOT NULL,
      goal_id TEXT NOT NULL,
      label TEXT NOT NULL,
      min_target INTEGER NOT NULL,
      max_target INTEGER NOT NULL,
      prize_type TEXT NOT NULL,
      prize_multiplier NUMERIC NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tier, goal_id)
    )
  `);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_admin_goals_tier ON admin_goal_definitions(tier, active)`);

  // Admin game constants override table
  await _db.run(`
    CREATE TABLE IF NOT EXISTS admin_game_constants (
      id SERIAL PRIMARY KEY,
      section TEXT NOT NULL,
      constant_key TEXT NOT NULL,
      override_value TEXT NOT NULL,
      data_type TEXT NOT NULL DEFAULT 'number',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(section, constant_key)
    )
  `);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_admin_constants_section ON admin_game_constants(section)`);

  // Resource expeditions table
  await _db.run(`
    CREATE TABLE IF NOT EXISTS resource_expeditions (
      id SERIAL PRIMARY KEY,
      kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id),
      node_id INTEGER NOT NULL REFERENCES resource_nodes(id),
      population_sent INTEGER NOT NULL,
      depart_at INTEGER NOT NULL,
      arrive_at INTEGER NOT NULL,
      harvest_ends_at INTEGER,
      return_at INTEGER,
      status TEXT NOT NULL DEFAULT 'outbound',
      loot TEXT NOT NULL DEFAULT '{}'
    )
  `);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_res_expeditions_kingdom ON resource_expeditions(kingdom_id, status)`);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_res_expeditions_kingdom_recent ON resource_expeditions(kingdom_id, status, depart_at DESC)`);
  // Covers the `WHERE kingdom_id = ? AND status != 'completed' ORDER BY depart_at DESC`
  // query in the GET /resource-expeditions hot path. The (kingdom_id, status, ...)
  // index above can't satisfy the inequality status filter as a sort-covering
  // index — this one can, since the sort key is the leading non-keyed column.
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_res_expeditions_kingdom_depart ON resource_expeditions(kingdom_id, depart_at DESC)`);

  // Discord integration tables
  await _db.run(`
    CREATE TABLE IF NOT EXISTS discord_links (
      id SERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL UNIQUE REFERENCES players(id),
      discord_user_id TEXT NOT NULL UNIQUE,
      discord_username TEXT NOT NULL,
      linked_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER),
      updated_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    )
  `);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_discord_links_player ON discord_links(player_id)`);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_discord_links_discord_user ON discord_links(discord_user_id)`);

  await _db.run(`
    CREATE TABLE IF NOT EXISTS chat_sync_log (
      id SERIAL PRIMARY KEY,
      game_message_id INTEGER REFERENCES chat_messages(id),
      discord_message_id TEXT,
      direction TEXT NOT NULL,
      synced_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    )
  `);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_chat_sync_log_game_msg ON chat_sync_log(game_message_id)`);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_chat_sync_log_discord_msg ON chat_sync_log(discord_message_id)`);

  await _db.run(`
    CREATE TABLE IF NOT EXISTS discord_sync_config (
      id SERIAL PRIMARY KEY,
      channel_id TEXT NOT NULL UNIQUE,
      channel_name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      sync_both_directions INTEGER NOT NULL DEFAULT 1,
      game_room TEXT NOT NULL DEFAULT 'global',
      created_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER),
      updated_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    )
  `);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_discord_sync_config_channel ON discord_sync_config(channel_id)`);

  // Fog of War Phase 1.5: single-row table holding the current world's
  // generation seed. Kingdom/node placement (game/world-map-coords.js) reads
  // this seed alongside kingdomId/race to stay stable within a world but
  // randomize across resets — replacing the previous fully-deterministic
  // REGION_SEEDS arrays that let players memorize optimal routes across
  // alpha resets. Regenerated by scripts/admin-wipe-players.js on wipe.
  await _db.run(`
    CREATE TABLE IF NOT EXISTS world_state (
      id INTEGER PRIMARY KEY DEFAULT 1,
      seed BIGINT NOT NULL,
      generated_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER),
      CONSTRAINT world_state_singleton CHECK (id = 1)
    )
  `);
  await _db.run(`
    INSERT INTO world_state (id, seed)
    VALUES (1, FLOOR(RANDOM() * 9007199254740991)::BIGINT)
    ON CONFLICT (id) DO NOTHING
  `);

  // Load it into the in-memory cache immediately, here inside initDb() —
  // not later in index.js's boot sequence — because backfillResourceNodeMapCoords()
  // below (and anything else initDb() itself invokes) needs it via
  // game/world-map-coords.js, which reads the cache synchronously and
  // throws if it hasn't been loaded yet. Deferring this to after initDb()
  // returns would crash boot the first time a fresh DB actually has
  // resource_nodes rows needing a coordinate backfill.
  await require('../game/world-seed').loadWorldSeed(_db);

  await _db.run(`
    CREATE TABLE IF NOT EXISTS discord_link_tokens (
      id SERIAL PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      discord_user_id TEXT NOT NULL,
      discord_username TEXT NOT NULL,
      game_username TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    )
  `);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_discord_link_tokens_token ON discord_link_tokens(token)`);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_discord_link_tokens_expires ON discord_link_tokens(expires_at)`);

  await _db.run(`
    CREATE TABLE IF NOT EXISTS test_results (
      id SERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL REFERENCES players(id),
      player_name TEXT NOT NULL,
      test_key TEXT NOT NULL,
      test_group TEXT NOT NULL,
      test_name TEXT NOT NULL,
      passed INTEGER,
      comment TEXT,
      submitted_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    )
  `);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_test_results_key ON test_results(test_key)`);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_test_results_player ON test_results(player_id)`);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_test_results_submitted ON test_results(submitted_at DESC)`);

  // Happiness tracking tables
  await _db.run(`
    CREATE TABLE IF NOT EXISTS happiness_history (
      id SERIAL PRIMARY KEY,
      kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id),
      turn INTEGER NOT NULL,
      happiness_value INTEGER NOT NULL,
      food_component INTEGER DEFAULT 0,
      entertainment_component INTEGER DEFAULT 0,
      safety_component INTEGER DEFAULT 0,
      prosperity_component INTEGER DEFAULT 0,
      race_modifier INTEGER DEFAULT 0,
      tax_component INTEGER DEFAULT 0,
      overcrowding_component INTEGER DEFAULT 0,
      recovery_rate REAL DEFAULT 0,
      effects_component INTEGER DEFAULT 0,
      synergy_component INTEGER DEFAULT 0,
      fragment_component INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER),
      UNIQUE(kingdom_id, turn)
    )
  `);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_happiness_history_kingdom_turn ON happiness_history(kingdom_id, turn DESC)`);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_happiness_history_kingdom_created ON happiness_history(kingdom_id, created_at DESC)`);

  const happinessHistoryCols = await getTableColumns('happiness_history');
  if (!happinessHistoryCols.includes('tax_component')) await addColumn('happiness_history', 'tax_component', 'INTEGER DEFAULT 0', happinessHistoryCols);
  if (!happinessHistoryCols.includes('overcrowding_component')) await addColumn('happiness_history', 'overcrowding_component', 'INTEGER DEFAULT 0', happinessHistoryCols);
  if (!happinessHistoryCols.includes('recovery_rate')) await addColumn('happiness_history', 'recovery_rate', 'REAL DEFAULT 0', happinessHistoryCols);
  if (!happinessHistoryCols.includes('effects_component')) await addColumn('happiness_history', 'effects_component', 'INTEGER DEFAULT 0', happinessHistoryCols);
  if (!happinessHistoryCols.includes('synergy_component')) await addColumn('happiness_history', 'synergy_component', 'INTEGER DEFAULT 0', happinessHistoryCols);
  if (!happinessHistoryCols.includes('fragment_component')) await addColumn('happiness_history', 'fragment_component', 'INTEGER DEFAULT 0', happinessHistoryCols);

  await _db.run(`
    CREATE TABLE IF NOT EXISTS happiness_events (
      id SERIAL PRIMARY KEY,
      kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id),
      turn INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      old_happiness INTEGER,
      new_happiness INTEGER,
      component TEXT,
      delta INTEGER,
      description TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    )
  `);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_happiness_events_kingdom_turn ON happiness_events(kingdom_id, turn DESC)`);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_happiness_events_kingdom_created ON happiness_events(kingdom_id, created_at DESC)`);

  // Synergy cooldown tracking
  await _db.exec(`
    CREATE TABLE IF NOT EXISTS synergy_cooldowns (
      id SERIAL PRIMARY KEY,
      kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id),
      synergy_id TEXT NOT NULL,
      cooldown_until INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER),
      updated_at INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER),
      UNIQUE(kingdom_id, synergy_id)
    );
    CREATE INDEX IF NOT EXISTS idx_synergy_cooldowns_kingdom ON synergy_cooldowns(kingdom_id);
    CREATE INDEX IF NOT EXISTS idx_synergy_cooldowns_until ON synergy_cooldowns(cooldown_until);
  `);

  // Audit scheduling tables
  await _db.run(`
    CREATE TABLE IF NOT EXISTS audit_schedules (
      id            SERIAL PRIMARY KEY,
      created_by    INTEGER NOT NULL REFERENCES players(id),
      frequency     TEXT NOT NULL DEFAULT 'weekly',
      is_enabled    INTEGER NOT NULL DEFAULT 1,
      next_run_at   INTEGER,
      last_run_at   INTEGER,
      created_at    INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER),
      updated_at    INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    )
  `);

  await _db.run(`
    CREATE TABLE IF NOT EXISTS audit_history (
      id            SERIAL PRIMARY KEY,
      schedule_id   INTEGER REFERENCES audit_schedules(id),
      run_at        INTEGER NOT NULL,
      status        TEXT NOT NULL DEFAULT 'success',
      findings_count INTEGER NOT NULL DEFAULT 0,
      findings      TEXT,
      error_message TEXT,
      duration_ms   INTEGER,
      created_at    INTEGER NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER)
    )
  `);

  // Audit notification settings
  await _db.exec(`
    CREATE TABLE IF NOT EXISTS audit_notification_settings (
      id SERIAL PRIMARY KEY,
      notify_on_new_issues BOOLEAN DEFAULT TRUE,
      min_severity TEXT DEFAULT 'MEDIUM',
      discord_channel_id TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Ensure at least one settings record exists
  const notifSettings = await _db.get('SELECT id FROM audit_notification_settings LIMIT 1');
  if (!notifSettings) {
    await _db.run(`
      INSERT INTO audit_notification_settings (notify_on_new_issues, min_severity, created_at, updated_at)
      VALUES (true, 'MEDIUM', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
  }

  await _db.run(`CREATE INDEX IF NOT EXISTS idx_audit_schedules_enabled ON audit_schedules(is_enabled, next_run_at)`);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_audit_history_schedule ON audit_history(schedule_id, run_at DESC)`);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_audit_history_status ON audit_history(status, created_at DESC)`);

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

let _kingdomCols = null;

async function getKingdomCols() {
  if (!_kingdomCols) {
    _kingdomCols = new Set(await getTableColumns('kingdoms'));
  }
  return _kingdomCols;
}

async function applyKingdomUpdates(kingdomId, updates) {
  if (!updates || Object.keys(updates).length === 0) return [];
  const validCols = await getKingdomCols();
  const safe = Object.fromEntries(
    Object.entries(updates).filter(([col, val]) => validCols.has(col) && val !== undefined && val !== null)
  );
  if (Object.keys(safe).length === 0) {
    console.warn('[applyKingdomUpdates] No valid columns to update', { kingdomId, updates, validCols: Array.from(validCols).slice(0, 10) });
    return [];
  }
  const cols = Object.keys(safe);
  const setClause = pgSetClause(cols);
  const vals = [...Object.values(safe), kingdomId];
  if (process.env.NODE_ENV !== 'production') {
    console.log('[applyKingdomUpdates] Updating', { kingdomId, fields: cols, safe });
  }
  await _db.run(`UPDATE "kingdoms" SET ${setClause} WHERE id = $${cols.length + 1}`, vals);
  return Object.keys(safe);
}

module.exports = { initDb, applyKingdomUpdates, repairJsonRows };
