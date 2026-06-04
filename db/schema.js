// Translate SQLite-specific SQL syntax to PostgreSQL syntax
function translateSqlForPg(sql) {
  if (typeof sql !== 'string') return sql;
  let translated = sql;

  // Replace DATETIME with TIMESTAMP
  translated = translated.replace(/\bDATETIME\b/gi, "TIMESTAMP");

  // INSERT OR REPLACE / INSERT OR IGNORE translations.
  // Each block is an independent `if` (not else-if) so multiple patterns in the
  // same statement are all handled and new tables added here won't silently fall
  // through due to an earlier else-if match.

  if (/INSERT\s+OR\s+REPLACE\s+INTO\s+server_state/i.test(translated)) {
    translated = translated.replace(
      /INSERT\s+OR\s+REPLACE\s+INTO\s+server_state\s*\((.*?)\)\s*VALUES\s*\((.*?)\)/i,
      "INSERT INTO server_state ($1) VALUES ($2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value"
    );
  }

  if (/INSERT\s+OR\s+REPLACE\s+INTO\s+market_prices/i.test(translated)) {
    translated = translated.replace(/INSERT\s+OR\s+REPLACE\s+INTO\s+market_prices/i, "INSERT INTO market_prices");
    if (!/ON\s+CONFLICT/i.test(translated)) {
      translated = translated.replace(
        /VALUES\s*\((.*?)\)/i,
        "VALUES ($1) ON CONFLICT (id) DO UPDATE SET current_price = EXCLUDED.current_price, base_price = EXCLUDED.base_price, updated_at = EXCLUDED.updated_at"
      );
    }
  }

  if (/INSERT\s+OR\s+IGNORE\s+INTO\s+regions/i.test(translated)) {
    translated = translated.replace(/INSERT\s+OR\s+IGNORE\s+INTO\s+regions/i, "INSERT INTO regions");
    if (!/ON\s+CONFLICT/i.test(translated)) translated += " ON CONFLICT (name) DO NOTHING";
  }

  if (/INSERT\s+OR\s+REPLACE\s+INTO\s+regions/i.test(translated)) {
    translated = translated.replace(/INSERT\s+OR\s+REPLACE\s+INTO\s+regions/i, "INSERT INTO regions");
    if (!/ON\s+CONFLICT/i.test(translated)) {
      translated = translated.replace(
        /VALUES\s*\((.*?)\)/i,
        "VALUES ($1) ON CONFLICT (name) DO UPDATE SET owner_alliance_id = EXCLUDED.owner_alliance_id, contest_alliance_id = EXCLUDED.contest_alliance_id, contest_progress = EXCLUDED.contest_progress, bonus_type = EXCLUDED.bonus_type, lore = EXCLUDED.lore, updated_at = EXCLUDED.updated_at"
      );
    }
  }

  if (/INSERT\s+OR\s+IGNORE\s+INTO\s+market_prices/i.test(translated)) {
    translated = translated.replace(/INSERT\s+OR\s+IGNORE\s+INTO\s+market_prices/i, "INSERT INTO market_prices");
    if (!/ON\s+CONFLICT/i.test(translated)) translated += " ON CONFLICT (id) DO NOTHING";
  }

  if (/INSERT\s+OR\s+IGNORE\s+INTO\s+server_state/i.test(translated)) {
    translated = translated.replace(/INSERT\s+OR\s+IGNORE\s+INTO\s+server_state/i, "INSERT INTO server_state");
    if (!/ON\s+CONFLICT/i.test(translated)) translated += " ON CONFLICT (key) DO NOTHING";
  }

  if (/INSERT\s+OR\s+IGNORE\s+INTO\s+events/i.test(translated)) {
    translated = translated.replace(/INSERT\s+OR\s+IGNORE\s+INTO\s+events/i, "INSERT INTO events");
    if (!/ON\s+CONFLICT/i.test(translated)) translated += " ON CONFLICT (key) DO NOTHING";
  }

  // AUTOINCREMENT type translation
  translated = translated.replace(/INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi, "SERIAL PRIMARY KEY");

  // unixepoch() translation
  translated = translated.replace(/unixepoch\(\)/gi, "date_part('epoch', now())::integer");
  translated = translated.replace(/CAST\(unixepoch\(\) AS TEXT\)/gi, "CAST(date_part('epoch', now())::integer AS TEXT)");

  // Translate scalar MIN(...) and MAX(...) to LEAST and GREATEST
  translated = translated.replace(/MIN\(([^)]*,[^)]*)\)/gi, "LEAST($1)");
  translated = translated.replace(/MAX\(([^)]*,[^)]*)\)/gi, "GREATEST($1)");

  // Translate parameter query markers ? to $1, $2...
  let paramIndex = 1;
  translated = translated.replace(/\?/g, () => `$${paramIndex++}`);

  return translated;
}

// Cache numeric field names for efficient conversion (PostgreSQL NUMERIC/INTEGER returns strings)
// Covers all INTEGER/REAL columns across kingdoms, expeditions, heroes, resource_nodes, trade_routes,
// news, and other frequently queried tables so callers get JS numbers, not strings.
const NUMERIC_FIELDS = [
  // Core kingdom economy
  'gold', 'mana', 'food', 'land', 'population', 'morale', 'tax',
  // Turns / time
  'turn', 'turns_stored', 'last_turn_at', 'created_at', 'updated_at',
  'food_surplus_turns', 'food_shortage_turns', 'turn_num',
  // XP / levels
  'xp', 'level', 'prestige_level', 'progress',
  // Units
  'fighters', 'rangers', 'clerics', 'mages', 'thieves', 'ninjas',
  'researchers', 'engineers', 'engineer_level', 'engineer_xp', 'scribes', 'thralls',
  // Military equipment
  'war_machines', 'weapons_stockpile', 'armor_stockpile', 'ladders',
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
const transactionStorage = new AsyncLocalStorage();

// PostgreSQL adapter mimicking the sqlite / sqlite3 interface
class PgDbAdapter {
  constructor(pool, isPgMem = false) {
    this.pool = pool;
    this.transactionDepth = 0;
    this.isPgMem = isPgMem;
    this.transactionStorage = transactionStorage;
  }

  async get(sql, params) {
    const store = transactionStorage.getStore();
    const isStoreActive = store && !store.released;
    const connection = isStoreActive ? store.client : this.pool;

    if (/PRAGMA\s+table_info\((.*?)\)/i.test(sql)) {
      const match = sql.match(/PRAGMA\s+table_info\((.*?)\)/i);
      const tableName = match[1].replace(/['"`]/g, '').trim();
      try {
        const pgResult = await connection.query(`
          SELECT column_name AS name 
          FROM information_schema.columns 
          WHERE table_name = $1
        `, [tableName]);
        return pgResult.rows;
      } catch (err) {
        console.error("[db] PostgreSQL table_info failed for table:", tableName);
        throw err;
      }
    }

    if (/PRAGMA\s+user_version/i.test(sql)) {
      return { user_version: 0 };
    }

    const translatedSql = translateSqlForPg(sql);
    try {
      const res = await connection.query(translatedSql, params || []);
      return convertNumericFields(res.rows[0]);
    } catch (err) {
      console.error("[db] PostgreSQL get failed for statement:", translatedSql, "with params:", params);
      throw err;
    }
  }

  async all(sql, params) {
    const store = transactionStorage.getStore();
    const isStoreActive = store && !store.released;
    const connection = isStoreActive ? store.client : this.pool;

    if (/PRAGMA\s+table_info\((.*?)\)/i.test(sql)) {
      const match = sql.match(/PRAGMA\s+table_info\((.*?)\)/i);
      const tableName = match[1].replace(/['"`]/g, '').trim();
      try {
        const pgResult = await connection.query(`
          SELECT column_name AS name 
          FROM information_schema.columns 
          WHERE table_name = $1
        `, [tableName]);
        return pgResult.rows;
      } catch (err) {
        console.error("[db] PostgreSQL table_info failed for table:", tableName);
        throw err;
      }
    }

    const translatedSql = translateSqlForPg(sql);
    try {
      const res = await connection.query(translatedSql, params || []);
      return res.rows.map(convertNumericFields);
    } catch (err) {
      console.error("[db] PostgreSQL all failed for statement:", translatedSql, "with params:", params);
      throw err;
    }
  }

  async run(sql, params) {
    let translatedSql = translateSqlForPg(sql);
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
        try {
          await client.query('BEGIN');
          // Start async context for all nested queries to reuse this client
          transactionStorage.enterWith({ client, depth: 1, released: false });
          return { lastID: null, changes: 0 };
        } catch (err) {
          client.release();
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
        console.warn('[db] Cleaning up orphaned transaction — releasing connection');
        store.released = true;
        store.client.release();
        transactionStorage.enterWith(null);
      } catch (err) {
        console.error('[db] Error releasing orphaned transaction:', err.message);
      }
    }
  }

  async exec(sql) {
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    for (const statement of statements) {
      if (/^PRAGMA/gi.test(statement)) {
        continue;
      }
      let translated = translateSqlForPg(statement);
      if (this.isPgMem && translated) {
        // pg-mem doesn't support nested casts inside column defaults
        translated = translated.replace(/DEFAULT\s+\(date_part\('epoch',\s*now\(\)\)::integer\)/gi, "DEFAULT 1770000000");
        translated = translated.replace(/DEFAULT\s+date_part\('epoch',\s*now\(\)\)::integer/gi, "DEFAULT 1770000000");
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

async function initDb() {
  if (_db) return _db;

  if (!process.env.DATABASE_URL) {
    throw new Error("[db] ❌ Critical: DATABASE_URL is not set! A persistent PostgreSQL database connection structure is strictly required.");
  }

  const { Pool } = require('pg');
  const maxPool = process.env.DATABASE_MAX_POOL ? parseInt(process.env.DATABASE_MAX_POOL, 10) : 100;
  const minPool = process.env.DATABASE_MIN_POOL ? parseInt(process.env.DATABASE_MIN_POOL, 10) : 2;

  if (isNaN(maxPool) || isNaN(minPool) || maxPool < 1 || minPool < 1 || maxPool < minPool) {
    throw new Error(`[db] Invalid pool configuration: max=${maxPool}, min=${minPool}. Both must be positive integers with max >= min`);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: (!process.env.DATABASE_URL.includes('localhost') && !process.env.DATABASE_URL.includes('127.0.0.1') && !process.env.DATABASE_URL.includes('0.0.0.0'))
      ? { rejectUnauthorized: false }
      : false,
    max: maxPool,
    min: minPool,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    statement_timeout: 120000,
    application_name: 'narmir-game',
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

  await _db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS players (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      username    TEXT    NOT NULL UNIQUE,
      password    TEXT    NOT NULL,
      email       TEXT    UNIQUE,
      is_admin    INTEGER NOT NULL DEFAULT 0,
      is_banned   INTEGER NOT NULL DEFAULT 0,
      is_ai       INTEGER NOT NULL DEFAULT 0,
      ban_reason  TEXT,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS kingdoms (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id   INTEGER NOT NULL UNIQUE REFERENCES players(id),
      name        TEXT    NOT NULL,
      race        TEXT    NOT NULL DEFAULT 'human',
      gold        INTEGER NOT NULL DEFAULT 10000,
      land        INTEGER NOT NULL DEFAULT 500,
      population  INTEGER NOT NULL DEFAULT 50000,
      morale      INTEGER NOT NULL DEFAULT 100,
      happiness   INTEGER NOT NULL DEFAULT 50,
      last_attack_turn INTEGER NOT NULL DEFAULT 0,
      rebellion_cooldown INTEGER NOT NULL DEFAULT 0,
      tax         INTEGER NOT NULL DEFAULT 42,
      mana        INTEGER NOT NULL DEFAULT 5000,
      food        INTEGER NOT NULL DEFAULT 0,
      turn        INTEGER NOT NULL DEFAULT 0,
      last_turn_at INTEGER NOT NULL DEFAULT (unixepoch()),
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
      created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS alliances (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL UNIQUE,
      leader_id   INTEGER NOT NULL REFERENCES kingdoms(id),
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS alliance_members (
      alliance_id INTEGER NOT NULL REFERENCES alliances(id),
      kingdom_id  INTEGER NOT NULL REFERENCES kingdoms(id),
      pledge      INTEGER NOT NULL DEFAULT 3,
      joined_at   INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (alliance_id, kingdom_id)
    );
    CREATE TABLE IF NOT EXISTS news (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      kingdom_id  INTEGER NOT NULL REFERENCES kingdoms(id),
      type        TEXT    NOT NULL,
      message     TEXT    NOT NULL,
      turn_num    INTEGER NOT NULL DEFAULT 0,
      is_read     INTEGER NOT NULL DEFAULT 0,
      combat_log_id INTEGER,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS war_log (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      action_type     TEXT    NOT NULL,
      attacker_id     INTEGER REFERENCES kingdoms(id),
      attacker_name   TEXT,
      defender_id     INTEGER REFERENCES kingdoms(id),
      defender_name   TEXT,
      outcome         TEXT    NOT NULL,
      detail          TEXT,
      obscured        INTEGER NOT NULL DEFAULT 0,
      created_at      INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_war_log_time ON war_log(created_at DESC);
    CREATE TABLE IF NOT EXISTS expeditions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      kingdom_id  INTEGER NOT NULL REFERENCES kingdoms(id),
      type        TEXT    NOT NULL,
      turns_left  INTEGER NOT NULL,
      rangers     INTEGER NOT NULL DEFAULT 0,
      fighters    INTEGER NOT NULL DEFAULT 0,
      rewards     TEXT,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_exp_kingdom ON expeditions(kingdom_id);
    CREATE TABLE IF NOT EXISTS combat_log (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      attacker_id     INTEGER NOT NULL REFERENCES kingdoms(id),
      defender_id     INTEGER NOT NULL REFERENCES kingdoms(id),
      type            TEXT    NOT NULL,
      attacker_won    INTEGER NOT NULL DEFAULT 0,
      land_transferred INTEGER NOT NULL DEFAULT 0,
      detail          TEXT,
      created_at      INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      kingdom_id  INTEGER NOT NULL REFERENCES kingdoms(id),
      room        TEXT    NOT NULL DEFAULT 'global',
      message     TEXT    NOT NULL,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS server_state (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS heroes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      kingdom_id  INTEGER NOT NULL REFERENCES kingdoms(id),
      name        TEXT    NOT NULL,
      class       TEXT    NOT NULL,
      level       INTEGER NOT NULL DEFAULT 1,
      xp          REAL NOT NULL DEFAULT 0,
      abilities   TEXT    NOT NULL DEFAULT '[]',
      status      TEXT    NOT NULL DEFAULT 'idle',
      hp          INTEGER NOT NULL DEFAULT 100,
      max_hp      INTEGER NOT NULL DEFAULT 100,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_heroes_kingdom ON heroes(kingdom_id);
    CREATE INDEX IF NOT EXISTS idx_news_kingdom    ON news(kingdom_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_combat_attacker ON combat_log(attacker_id);
    CREATE INDEX IF NOT EXISTS idx_combat_defender ON combat_log(defender_id);
    CREATE INDEX IF NOT EXISTS idx_chat_room       ON chat_messages(room, created_at);
    CREATE INDEX IF NOT EXISTS idx_kingdoms_player ON kingdoms(player_id);
    CREATE INDEX IF NOT EXISTS idx_kingdoms_land   ON kingdoms(land DESC);
    CREATE INDEX IF NOT EXISTS idx_kingdoms_player_turn ON kingdoms(player_id, turn DESC);
    CREATE INDEX IF NOT EXISTS idx_expeditions_kingdom ON expeditions(kingdom_id, turns_left);
    CREATE INDEX IF NOT EXISTS idx_war_log_defender ON war_log(defender_id);
    CREATE INDEX IF NOT EXISTS idx_war_log_attacker ON war_log(attacker_id);
    CREATE INDEX IF NOT EXISTS idx_war_log_both    ON war_log(attacker_id, defender_id);
    CREATE INDEX IF NOT EXISTS idx_news_turn        ON news(kingdom_id, turn_num DESC);
    CREATE TABLE IF NOT EXISTS spy_reports (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      kingdom_id          INTEGER NOT NULL REFERENCES kingdoms(id),
      target_id           INTEGER NOT NULL REFERENCES kingdoms(id),
      target_name         TEXT    NOT NULL,
      outcome             TEXT    NOT NULL,
      report              TEXT,
      shared_to_alliance  INTEGER NOT NULL DEFAULT 0,
      created_at          INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_spy_reports_kingdom ON spy_reports(kingdom_id);
    CREATE INDEX IF NOT EXISTS idx_spy_reports_target  ON spy_reports(target_id);
    CREATE INDEX IF NOT EXISTS idx_spy_reports_created ON spy_reports(created_at DESC);
  `);

  // ── Migrations — safe, idempotent, never crash on duplicate ─────────────────
  async function getTableColumns(table) {
    try {
      const result = await _db.all(`PRAGMA table_info(${table})`);
      if (!result || !Array.isArray(result)) {
        console.warn(`[db] Migration: column check returned invalid result for ${table}`);
        return [];
      }
      return result.map(c => c.name);
    } catch (e) {
      console.error(`[db] Migration: error fetching columns for ${table}:`, e.message);
      return [];
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
    CREATE INDEX IF NOT EXISTS idx_news_created    ON news(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_exp_turns       ON expeditions(turns_left);
  `);

  // Batch column checks by table for performance (single schema fetch per table)
  const kingdomsCols = await getTableColumns('kingdoms');
  if (!kingdomsCols.includes('turns_stored'))        await addColumn('kingdoms', 'turns_stored',        'INTEGER NOT NULL DEFAULT 400)', kingdomsCols);
  if (!kingdomsCols.includes('alliance_buffs'))      await addColumn('kingdoms', 'alliance_buffs',      "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('goals'))               await addColumn('kingdoms', 'goals',               "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('research_allocation')) await addColumn('kingdoms', 'research_allocation', "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('build_queue'))         await addColumn('kingdoms', 'build_queue',         "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('build_progress'))      await addColumn('kingdoms', 'build_progress',      "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('research_progress'))   await addColumn('kingdoms', 'research_progress',   "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('mage_research_progress')) await addColumn('kingdoms', 'mage_research_progress', "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('build_allocation'))    await addColumn('kingdoms', 'build_allocation',    "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('resource_build_allocation')) await addColumn('kingdoms', 'resource_build_allocation', "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('prestige_level'))      await addColumn('kingdoms', 'prestige_level',      'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
  if (!kingdomsCols.includes('trade_routes'))       await addColumn('kingdoms', 'trade_routes',       'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
  if (!kingdomsCols.includes('tools_hammers'))       await addColumn('kingdoms', 'tools_hammers',       'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
  if (!kingdomsCols.includes('tools_scaffolding'))   await addColumn('kingdoms', 'tools_scaffolding',   'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
  if (!kingdomsCols.includes('tools_blueprints'))    await addColumn('kingdoms', 'tools_blueprints',    'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
  if (!kingdomsCols.includes('scaffolding_stored'))  await addColumn('kingdoms', 'scaffolding_stored',  'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
  if (!kingdomsCols.includes('hammers_stored'))      await addColumn('kingdoms', 'hammers_stored',      'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
  if (!kingdomsCols.includes('xp'))                  await addColumn('kingdoms', 'xp',                  'REAL NOT NULL DEFAULT 0)', kingdomsCols);
  if (!kingdomsCols.includes('xp_sources'))          await addColumn('kingdoms', 'xp_sources',          'TEXT NOT NULL DEFAULT \'{"turn":0,"gold":0,"combat_win":0,"combat_loss":0,"research":0,"construction":0,"exploration":0,"spell_cast":0,"covert_op":0}\')', kingdomsCols);
  if (!kingdomsCols.includes('level'))               await addColumn('kingdoms', 'level',               'INTEGER NOT NULL DEFAULT 1)', kingdomsCols);
  if (!kingdomsCols.includes('troop_levels'))        await addColumn('kingdoms', 'troop_levels',        "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('training_allocation')) await addColumn('kingdoms', 'training_allocation', "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('weapons_stockpile'))   await addColumn('kingdoms', 'weapons_stockpile',   'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
  if (!kingdomsCols.includes('armor_stockpile'))     await addColumn('kingdoms', 'armor_stockpile',     'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
  if (!kingdomsCols.includes('ladders'))             await addColumn('kingdoms', 'ladders',             'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
  if (!kingdomsCols.includes('description'))         await addColumn('kingdoms', 'description',         'TEXT)', kingdomsCols);
  if (!kingdomsCols.includes('collected_lore'))      await addColumn('kingdoms', 'collected_lore',      "TEXT NOT NULL DEFAULT '[]'", kingdomsCols);
  if (!kingdomsCols.includes('last_lore_id'))        await addColumn('kingdoms', 'last_lore_id',        'TEXT)', kingdomsCols);
  if (!kingdomsCols.includes('collected_events'))    await addColumn('kingdoms', 'collected_events',    "TEXT NOT NULL DEFAULT '[]'", kingdomsCols);
  if (!kingdomsCols.includes('last_event_id'))       await addColumn('kingdoms', 'last_event_id',       'TEXT)', kingdomsCols);
  if (!kingdomsCols.includes('achievements'))        await addColumn('kingdoms', 'achievements',        "TEXT NOT NULL DEFAULT '[]'", kingdomsCols);
  if (!kingdomsCols.includes('active_trade_routes'))   await addColumn('kingdoms', 'active_trade_routes', "TEXT NOT NULL DEFAULT '[]'", kingdomsCols);
  if (!kingdomsCols.includes('milestones_claimed'))  await addColumn('kingdoms', 'milestones_claimed',  "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('milestone_bonuses'))   await addColumn('kingdoms', 'milestone_bonuses',   "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('milestone_title'))     await addColumn('kingdoms', 'milestone_title',     "TEXT NOT NULL DEFAULT ''", kingdomsCols);
  if (!kingdomsCols.includes('injured_troops'))       await addColumn('kingdoms', 'injured_troops',       "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('wall_hp'))              await addColumn('kingdoms', 'wall_hp',              'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
  if (!kingdomsCols.includes('wall_defense_type'))    await addColumn('kingdoms', 'wall_defense_type',    "TEXT NOT NULL DEFAULT ''", kingdomsCols);

  const playerCols = await getTableColumns('players');
  if (!playerCols.includes('email')) await addColumn('players', 'email', 'TEXT');

  const allianceCols = await getTableColumns('alliances');
  if (!allianceCols.includes('vault_gold'))  await addColumn('alliances', 'vault_gold', 'INTEGER NOT NULL DEFAULT 0');
  if (!allianceCols.includes('projects'))    await addColumn('alliances', 'projects', "TEXT NOT NULL DEFAULT '{}'");
  if (!allianceCols.includes('vault_log'))   await addColumn('alliances', 'vault_log', "TEXT NOT NULL DEFAULT '[]'");

  await _db.run(`
    CREATE TABLE IF NOT EXISTS trade_routes (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      kingdom_id      INTEGER NOT NULL REFERENCES kingdoms(id),
      partner_id      INTEGER NOT NULL REFERENCES kingdoms(id),
      distance        INTEGER NOT NULL DEFAULT 0,
      stability       INTEGER NOT NULL DEFAULT 100,
      efficiency      REAL    NOT NULL DEFAULT 1.0,
      last_raid_at    INTEGER DEFAULT 0,
      created_at      INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_trade_routes_k ON trade_routes(kingdom_id)`);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_trade_routes_p ON trade_routes(partner_id)`);
  // Composite index for common queries: find routes between two kingdoms
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_trade_routes_composite ON trade_routes(kingdom_id, partner_id)`);

  await _db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id         INTEGER NOT NULL REFERENCES players(id),
      recipient_id      INTEGER NOT NULL REFERENCES players(id),
      content           TEXT NOT NULL,
      is_read           INTEGER NOT NULL DEFAULT 0,
      created_at        INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  await _db.run(`CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)`);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id)`);

  await _db.run(`
    CREATE TABLE IF NOT EXISTS bounties (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      placer_id         INTEGER NOT NULL REFERENCES players(id),
      target_id         INTEGER NOT NULL REFERENCES kingdoms(id),
      amount            INTEGER NOT NULL,
      status            TEXT NOT NULL DEFAULT 'active',
      claimed_by_id     INTEGER REFERENCES kingdoms(id),
      created_at        INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  await _db.run(`CREATE INDEX IF NOT EXISTS idx_bounties_target ON bounties(target_id, status)`);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_bounties_active ON bounties(status, amount DESC)`);

  await _db.run(`
    CREATE TABLE IF NOT EXISTS lore_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  await _db.run(`
    CREATE TABLE IF NOT EXISTS random_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  await _db.run(`
    CREATE TABLE IF NOT EXISTS junk_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  await _db.run(`
    CREATE TABLE IF NOT EXISTS tax_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
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
      created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at        INTEGER NOT NULL DEFAULT (unixepoch())
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
    await _db.run('INSERT OR IGNORE INTO regions (name, bonus_type) VALUES (?, ?)', [name, bonus]);
  }

  const pCols = (await _db.all('PRAGMA table_info(players)')).map(c => c.name);
  if (!pCols.includes('is_admin'))   await addColumn('players', 'is_admin',   'INTEGER NOT NULL DEFAULT 0');
  if (!pCols.includes('is_banned'))  await addColumn('players', 'is_banned',  'INTEGER NOT NULL DEFAULT 0');
  if (!pCols.includes('ban_reason')) await addColumn('players', 'ban_reason', 'TEXT');
  if (!pCols.includes('is_ai'))      await addColumn('players', 'is_ai',      'INTEGER NOT NULL DEFAULT 0');

  const nCols = (await _db.all('PRAGMA table_info(news)')).map(c => c.name);
  if (!nCols.includes('turn_num')) await addColumn('news', 'turn_num', 'INTEGER NOT NULL DEFAULT 0');
  if (!nCols.includes('combat_log_id')) await addColumn('news', 'combat_log_id', 'INTEGER');

  if (!pCols.includes('is_chat_mod'))  await addColumn('players', 'is_chat_mod',  'INTEGER NOT NULL DEFAULT 0');
  if (!pCols.includes('chat_banned'))  await addColumn('players', 'chat_banned',  'INTEGER NOT NULL DEFAULT 0');
  if (!pCols.includes('chat_ban_reason')) await addColumn('players', 'chat_ban_reason', 'TEXT');
  if (!pCols.includes('chat_color'))  await addColumn('players', 'chat_color',  "TEXT DEFAULT NULL");
  if (!pCols.includes('chat_name'))   await addColumn('players', 'chat_name',   "TEXT DEFAULT NULL");

  await _db.run(`
    CREATE TABLE IF NOT EXISTS suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER,
      kingdom_id INTEGER,
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await _db.run(`
    CREATE TABLE IF NOT EXISTS admin_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_name TEXT,
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await _db.run(`
    CREATE TABLE IF NOT EXISTS wishlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT,
      description TEXT,
      completed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  const cmCols = (await _db.all('PRAGMA table_info(chat_messages)').catch(() => [])).map(c => c.name);
  if (!cmCols.includes('username')) await addColumn('chat_messages', 'username', 'TEXT NOT NULL DEFAULT \'\'');
  if (!cmCols.includes('player_id')) await addColumn('chat_messages', 'player_id', 'INTEGER NOT NULL DEFAULT 0');
  if (!cmCols.includes('deleted'))  await addColumn('chat_messages', 'deleted',  'INTEGER NOT NULL DEFAULT 0');

  // Allow NULL kingdom_id for Discord relay messages from unlinked users
  try {
    // Try PostgreSQL syntax first
    await _db.run('ALTER TABLE chat_messages ALTER COLUMN kingdom_id DROP NOT NULL');
    console.log('✅ Made kingdom_id nullable for Discord relay messages');
  } catch (e) {
    try {
      // Fallback to SQLite table recreation if PostgreSQL syntax fails
      const cmInfo = await _db.all('PRAGMA table_info(chat_messages)').catch(() => []);
      const kingdomIdCol = cmInfo.find(c => c.name === 'kingdom_id');
      if (kingdomIdCol && kingdomIdCol.notnull) {
        await _db.exec(`
          CREATE TABLE chat_messages_new (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            kingdom_id  INTEGER REFERENCES kingdoms(id),
            player_id   INTEGER NOT NULL DEFAULT 0,
            username    TEXT NOT NULL DEFAULT '',
            room        TEXT    NOT NULL DEFAULT 'global',
            message     TEXT    NOT NULL,
            deleted     INTEGER NOT NULL DEFAULT 0,
            created_at  INTEGER NOT NULL DEFAULT (unixepoch())
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
    };
    const existing = await _db.all('SELECT id, race FROM kingdoms');
    for (const k of existing) {
      await _db.run('UPDATE kingdoms SET region = ? WHERE id = ?', [RACE_REGIONS[k.race] || 'The Unknown Lands', k.id]);
    }
  }
  if (!kingdomsCols.includes('smithy_allocation'))          await addColumn('kingdoms', 'smithy_allocation',          "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('hammer_turns_used'))          await addColumn('kingdoms', 'hammer_turns_used',          'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
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
  if (!kingdomsCols.includes('bld_housing'))             await addColumn('kingdoms', 'bld_housing',             'INTEGER NOT NULL DEFAULT 100)', kingdomsCols);
  if (!kingdomsCols.includes('mage_tower_allocation'))   await addColumn('kingdoms', 'mage_tower_allocation',   "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('shrine_allocation'))       await addColumn('kingdoms', 'shrine_allocation',       "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('scribes'))             await addColumn('kingdoms', 'scribes',             'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
  if (!kingdomsCols.includes('bld_libraries'))       await addColumn('kingdoms', 'bld_libraries',       'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
  if (!kingdomsCols.includes('wounded_troops'))      await addColumn('kingdoms', 'wounded_troops',      "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('bld_taverns'))         await addColumn('kingdoms', 'bld_taverns',         'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
  if (!kingdomsCols.includes('bld_granaries'))       await addColumn('kingdoms', 'bld_granaries',       'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
  if (!kingdomsCols.includes('granary_upgrades'))    await addColumn('kingdoms', 'granary_upgrades',    "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('bld_mage_towers'))     await addColumn('kingdoms', 'bld_mage_towers',     'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
  if (!kingdomsCols.includes('world_fragments'))      await addColumn('kingdoms', 'world_fragments',     "TEXT NOT NULL DEFAULT '[]'", kingdomsCols);
  if (!kingdomsCols.includes('hybrid_blueprints'))    await addColumn('kingdoms', 'hybrid_blueprints',   "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('fragment_bonuses'))     await addColumn('kingdoms', 'fragment_bonuses',    "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('fortified_blueprints')) await addColumn('kingdoms', 'fortified_blueprints','INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
  if (!kingdomsCols.includes('fortified_buildings'))  await addColumn('kingdoms', 'fortified_buildings', "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('library_allocation'))  await addColumn('kingdoms', 'library_allocation',  "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('library_progress'))    await addColumn('kingdoms', 'library_progress',    "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('tower_progress'))      await addColumn('kingdoms', 'tower_progress',      "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('scrolls'))             await addColumn('kingdoms', 'scrolls',             "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('maps'))                await addColumn('kingdoms', 'maps',                'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
  if (!kingdomsCols.includes('blueprints_stored'))   await addColumn('kingdoms', 'blueprints_stored',   'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
  if (!kingdomsCols.includes('certified_blueprints_stored')) await addColumn('kingdoms', 'certified_blueprints_stored', 'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
  if (!kingdomsCols.includes('active_effects'))      await addColumn('kingdoms', 'active_effects',      "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);

  if (!kingdomsCols.includes('bld_walls'))          await addColumn('kingdoms', 'bld_walls',          'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
  if (!kingdomsCols.includes('wall_upgrades'))      await addColumn('kingdoms', 'wall_upgrades',      "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('tower_def_upgrades')) await addColumn('kingdoms', 'tower_def_upgrades', "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('outpost_upgrades'))   await addColumn('kingdoms', 'outpost_upgrades',   "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('defense_upgrades'))   await addColumn('kingdoms', 'defense_upgrades',   "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);

  // Legacy data migration: if defence_upgrades exists but defense_upgrades is empty, copy it
  if (kingdomsCols.includes('defence_upgrades') && kingdomsCols.includes('defense_upgrades')) {
    const migrationName = '001_migrate_defence_to_defense_upgrades';
    const existing = await _db.get('SELECT id FROM migrations WHERE name = ?', [migrationName]);
    if (!existing) {
      await _db.run(`UPDATE kingdoms SET defense_upgrades = defence_upgrades WHERE defense_upgrades = '{}' AND defence_upgrades != '{}'`);
      await _db.run('INSERT INTO migrations (name) VALUES (?)', [migrationName]);
      console.log('[db] Migration applied:', migrationName);
    }
  }
  if (!kingdomsCols.includes('tower_upgrades'))    await addColumn('kingdoms', 'tower_upgrades',    "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('school_upgrades'))   await addColumn('kingdoms', 'school_upgrades',   "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('shrine_upgrades'))   await addColumn('kingdoms', 'shrine_upgrades',   "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('library_upgrades'))  await addColumn('kingdoms', 'library_upgrades',  "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('research_focus'))    await addColumn('kingdoms', 'research_focus',     "TEXT NOT NULL DEFAULT '[]'", kingdomsCols);
  if (!kingdomsCols.includes('divine_sanctuary_used')) await addColumn('kingdoms', 'divine_sanctuary_used', 'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
  if (!kingdomsCols.includes('farm_upgrades'))       await addColumn('kingdoms', 'farm_upgrades',       "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('market_upgrades'))     await addColumn('kingdoms', 'market_upgrades',     "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('tavern_upgrades'))     await addColumn('kingdoms', 'tavern_upgrades',     "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('bank_upgrades'))       await addColumn('kingdoms', 'bank_upgrades',       "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('bank_deposits'))       await addColumn('kingdoms', 'bank_deposits',       "TEXT NOT NULL DEFAULT '[]'", kingdomsCols);
  if (!kingdomsCols.includes('ledger'))              await addColumn('kingdoms', 'ledger',              "TEXT NOT NULL DEFAULT '[]'", kingdomsCols);
  if (!kingdomsCols.includes('bld_mausoleums'))      await addColumn('kingdoms', 'bld_mausoleums',      'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
  if (!kingdomsCols.includes('thralls'))             await addColumn('kingdoms', 'thralls',             'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
  if (!kingdomsCols.includes('mausoleum_upgrades'))   await addColumn('kingdoms', 'mausoleum_upgrades',   "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('mausoleum_allocation')) await addColumn('kingdoms', 'mausoleum_allocation', "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);

  // Data migration: tools_* -> *_stored
  const toolsMigrationName = '002_migrate_tools_to_stored';
  const toolsMigrationExists = await _db.get('SELECT id FROM migrations WHERE name = ?', [toolsMigrationName]);
  if (!toolsMigrationExists) {
    if (kingdomsCols.includes('tools_scaffolding') && kingdomsCols.includes('scaffolding_stored')) {
      await _db.run("UPDATE kingdoms SET scaffolding_stored = tools_scaffolding WHERE scaffolding_stored = 0 AND tools_scaffolding > 0");
    }
    if (kingdomsCols.includes('tools_hammers') && kingdomsCols.includes('hammers_stored')) {
      await _db.run("UPDATE kingdoms SET hammers_stored = tools_hammers WHERE hammers_stored = 0 AND tools_hammers > 0");
    }
    await _db.run('INSERT INTO migrations (name) VALUES (?)', [toolsMigrationName]);
    console.log('[db] Migration applied:', toolsMigrationName);
  }

  if (!kingdomsCols.includes('food_shortage_turns')) await addColumn('kingdoms', 'food_shortage_turns', 'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
  if (!kingdomsCols.includes('food_surplus_turns'))  await addColumn('kingdoms', 'food_surplus_turns',  'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
  if (!kingdomsCols.includes('mercenaries'))         await addColumn('kingdoms', 'mercenaries',         "TEXT NOT NULL DEFAULT '[]'", kingdomsCols);

  // Trade offers table
  await _db.exec(`
    CREATE TABLE IF NOT EXISTS trade_offers (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id     INTEGER NOT NULL REFERENCES kingdoms(id),
      sender_name   TEXT    NOT NULL,
      receiver_id   INTEGER NOT NULL REFERENCES kingdoms(id),
      receiver_name TEXT    NOT NULL,
      offer         TEXT    NOT NULL,
      request       TEXT    NOT NULL,
      status        TEXT    NOT NULL DEFAULT 'pending',
      created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
      expires_at    INTEGER NOT NULL DEFAULT (unixepoch() + 3600)
    );
    CREATE INDEX IF NOT EXISTS idx_trade_offers_receiver ON trade_offers(receiver_id, status);
    CREATE INDEX IF NOT EXISTS idx_trade_offers_sender   ON trade_offers(sender_id, status);
  `);

  // Mercenaries table
  await _db.exec(`
    CREATE TABLE IF NOT EXISTS mercenaries (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      kingdom_id      INTEGER NOT NULL REFERENCES kingdoms(id),
      unit_type       TEXT    NOT NULL,
      level           INTEGER NOT NULL,
      count           INTEGER NOT NULL,
      tier            TEXT    NOT NULL,
      hired_at_turn   INTEGER NOT NULL DEFAULT 0,
      duration_turns  INTEGER NOT NULL DEFAULT 20,
      upkeep_per_turn INTEGER NOT NULL DEFAULT 0,
      created_at      INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_mercs_kingdom ON mercenaries(kingdom_id);
  `);

  await _db.exec(`
    CREATE TABLE IF NOT EXISTS war_log (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      action_type     TEXT    NOT NULL,
      attacker_id     INTEGER REFERENCES kingdoms(id),
      attacker_name   TEXT,
      defender_id     INTEGER REFERENCES kingdoms(id),
      defender_name   TEXT,
      outcome         TEXT    NOT NULL,
      detail          TEXT,
      obscured        INTEGER NOT NULL DEFAULT 0,
      created_at      INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_war_log_time ON war_log(created_at DESC);
  `);

  // ── Season & events migrations ────────────────────────────────────────────────
  if (!kingdomsCols.includes('last_event_at'))         await addColumn('kingdoms', 'last_event_at',         'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
  if (!kingdomsCols.includes('active_event'))          await addColumn('kingdoms', 'active_event',          "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('discovered_kingdoms'))   await addColumn('kingdoms', 'discovered_kingdoms',   "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);
  if (!kingdomsCols.includes('location_maps_wip'))     await addColumn('kingdoms', 'location_maps_wip',     "TEXT NOT NULL DEFAULT '[]'", kingdomsCols);

  // Market Prices table procedural check
  await _db.exec(`
    CREATE TABLE IF NOT EXISTS market_prices (
      id            TEXT PRIMARY KEY,
      current_price REAL NOT NULL,
      base_price    REAL NOT NULL,
      updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
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
    ['land',    5000.0, 5000.0]
  ];
  for (const [id, current, base] of freshDefaultPrices) {
    await _db.run('INSERT OR IGNORE INTO market_prices (id, current_price, base_price) VALUES (?, ?, ?)', [id, current, base]);
  }

  // Events table
  await _db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      key         TEXT    NOT NULL UNIQUE,
      name        TEXT    NOT NULL,
      description TEXT    NOT NULL,
      season      TEXT    NOT NULL DEFAULT 'all',
      effect_type TEXT    NOT NULL DEFAULT 'morale',
      effect_value REAL   NOT NULL DEFAULT 5,
      effect_duration INTEGER NOT NULL DEFAULT 1,
      race_only   TEXT    DEFAULT NULL,
      is_positive INTEGER NOT NULL DEFAULT 1,
      is_active   INTEGER NOT NULL DEFAULT 1,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  // Event log table
  await _db.exec(`
    CREATE TABLE IF NOT EXISTS event_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      kingdom_id  INTEGER NOT NULL REFERENCES kingdoms(id),
      kingdom_name TEXT   NOT NULL,
      event_key   TEXT    NOT NULL,
      event_name  TEXT    NOT NULL,
      season      TEXT    NOT NULL,
      fired_at    INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_event_log_fired ON event_log(fired_at DESC);
    CREATE INDEX IF NOT EXISTS idx_event_log_kingdom ON event_log(kingdom_id);
  `);

  // Seed season state
  await _db.run(`INSERT OR IGNORE INTO server_state (key, value) VALUES ('current_season', 'spring')`);
  await _db.run(`INSERT OR IGNORE INTO server_state (key, value) VALUES ('season_started_at', CAST(unixepoch() AS TEXT))`);

  // Seed default events
  const defaultEvents = [
    // Spring
    ['spring_bloom',      'Spring Bloom',         'Warm rains encourage growth.',                  'spring', 'farm_yield', 0.10, 5, null, 1],
    ['spring_floods',     'Spring Floods',         'Rising rivers damage farmland.',                'spring', 'morale',   -5,   3, null, 0],
    ['pollination_boom',  'Pollination Boom',      'A great flowering swells the population.',      'spring', 'population', 500, 1, null, 1],
    ['warm_winds',        'Warm Winds',            'A pleasant breeze lifts spirits.',              'spring', 'morale',    5,   1, null, 1],
    // Summer
    ['abundant_harvest',  'Abundant Harvest',      'Exceptional sun yields record crops.',          'summer', 'food',      0.15, 1, null, 1],
    ['heat_wave',         'Heat Wave',             'Scorching heat wilts crops and morale.',        'summer', 'farm_yield',-0.10,3, null, 0],
    ['travelling_merch',  'Travelling Merchants',  'Exotic goods boost market income.',             'summer', 'gold',      0.02, 3, null, 1],
    ['border_skirmish',   'Border Skirmish',       'Bandits raid your outlying farms.',             'summer', 'food',     -0.05,1, null, 0],
    // Fall
    ['harvest_festival',  'Harvest Festival',      'The kingdom celebrates a bountiful autumn.',    'fall',   'morale',    10,  1, null, 1],
    ['early_frost',       'Early Frost',           'An unexpected frost kills late crops.',         'fall',   'farm_yield',-0.15,2, null, 0],
    ['trade_boom',        'Trade Boom',            'Merchants flock to your markets.',              'fall',   'gold',      0.05, 3, null, 1],
    ['rat_infestation',   'Rat Infestation',       'Vermin consume stored food.',                   'fall',   'food',     -0.10,1, null, 0],
    // Winter
    ['blizzard',          'Blizzard',              'A fierce storm cripples farms and morale.',     'winter', 'farm_yield',-0.20,2, null, 0],
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
    await _db.run(`INSERT OR IGNORE INTO events (key,name,description,season,effect_type,effect_value,effect_duration,race_only,is_positive) VALUES (?,?,?,?,?,?,?,?,?)`,
      [key,name,description,season,effect_type,effect_value,effect_duration,race_only,is_positive]);
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
      await _db.run("INSERT INTO random_events (content) VALUES (?)", [e]);
    }
  }

  const hasTaxEvents = await _db.get("SELECT 1 FROM tax_events LIMIT 1");
  if (!hasTaxEvents) {
    const defaultTaxEvents = [
      'Citizens held a spontaneous parade in your honor. +Morale!',
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
      'A traveling scholar decided to settle here, impressed by the high morale.',
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
      await _db.run("INSERT INTO tax_events (content) VALUES (?)", [e]);
    }
  }

  const loreColsRes = await _db.all("PRAGMA table_info(lore_entries)");
  const loreCols = loreColsRes.map(c => c.name);
  if (!loreCols.includes('title')) await addColumn('lore_entries', 'title', "TEXT NOT NULL DEFAULT ''");
  if (!loreCols.includes('category')) await addColumn('lore_entries', 'category', "TEXT NOT NULL DEFAULT 'general'");
  if (!loreCols.includes('key_id')) await addColumn('lore_entries', 'key_id', "TEXT NOT NULL DEFAULT ''");

  const oldLore = await _db.get("SELECT 1 FROM lore_entries WHERE category IS NULL OR category = 'general' LIMIT 1");
  if (oldLore) {
    await _db.run("DELETE FROM lore_entries"); // We will wipe and seed from the full game/lore.js
  }

  const hasLore = await _db.get("SELECT 1 FROM lore_entries LIMIT 1");
  if (!hasLore) {
    const LORE_SEED = require('../game/lore');
    for (const cat of Object.keys(LORE_SEED)) {
      for (const item of LORE_SEED[cat]) {
        await _db.run("INSERT INTO lore_entries (key_id, category, title, content) VALUES (?, ?, ?, ?)", [item.id, cat, item.title, item.msg]);
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
      { category: 'Combat', desc: 'Generals — train commanding officers that boost army morale during battles' },
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
      { category: 'Gameplay', desc: 'Prisoners of War — ransom captured enemy troops for gold or execute for morale' },
      { category: 'Combat', desc: 'Naval Trade Routes — ocean routes for faster gold generation but higher risk' }
    ];
    for (const w of defaultWishlist) {
      await _db.run("INSERT INTO wishlist (category, description) VALUES (?, ?)", [w.category, w.desc]);
    }
  }

  // Seed default server_state row for regen tracking
  await _db.run(`
    INSERT OR IGNORE INTO server_state (key, value)
    VALUES ('last_regen_at', CAST(unixepoch() AS TEXT))
  `);

  try {
    await _db.run("UPDATE players SET is_admin = 1 WHERE username = 'Stieny'");
    console.log("[db] Promoted Stieny to admin automatically");
  } catch {
    // Ignore error
  }

  // ── Resource Gathering System Migrations ─────────────────────────────────────
  // Re-read cols since earlier migrations may have added columns
  const cols2 = (await _db.all('PRAGMA table_info(kingdoms)')).map(c => c.name);

  // Resource stockpile columns
  if (!cols2.includes('wood'))               await addColumn('kingdoms', 'wood',               'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
  if (!cols2.includes('stone'))              await addColumn('kingdoms', 'stone',              'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
  if (!cols2.includes('iron'))               await addColumn('kingdoms', 'iron',               'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
  if (!cols2.includes('coal'))               await addColumn('kingdoms', 'coal',               'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
  if (!cols2.includes('steel'))              await addColumn('kingdoms', 'steel',              'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);

  // Wood buildings
  if (!cols2.includes('bld_woodyard'))       await addColumn('kingdoms', 'bld_woodyard',       'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
  if (!cols2.includes('bld_lumber_camp'))    await addColumn('kingdoms', 'bld_lumber_camp',    'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
  if (!cols2.includes('bld_sawmill'))        await addColumn('kingdoms', 'bld_sawmill',        'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);

  // Stone buildings
  if (!cols2.includes('bld_gravel_pit'))     await addColumn('kingdoms', 'bld_gravel_pit',     'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
  if (!cols2.includes('bld_blockfield'))     await addColumn('kingdoms', 'bld_blockfield',     'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
  if (!cols2.includes('bld_stone_quarry'))   await addColumn('kingdoms', 'bld_stone_quarry',   'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);

  // Iron buildings
  if (!cols2.includes('bld_open_pit'))       await addColumn('kingdoms', 'bld_open_pit',       'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
  if (!cols2.includes('bld_strip_mine'))     await addColumn('kingdoms', 'bld_strip_mine',     'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);
  if (!cols2.includes('bld_deep_mine'))      await addColumn('kingdoms', 'bld_deep_mine',      'INTEGER NOT NULL DEFAULT 0)', kingdomsCols);

  // Items inventory (JSON array)
  if (!cols2.includes('items'))              await addColumn('kingdoms', 'items',              "TEXT NOT NULL DEFAULT '[]'", kingdomsCols);

  // Resource sequence (bracket lock tracking)
  if (!cols2.includes('resource_sequence'))  await addColumn('kingdoms', 'resource_sequence',  "TEXT NOT NULL DEFAULT '{}'", kingdomsCols);

  // Magic schools - school selection and school-specific spellbook
  if (!cols2.includes('school_of_magic'))   await addColumn('kingdoms', 'school_of_magic',   "TEXT", kingdomsCols);
  if (!cols2.includes('school_spellbook'))  await addColumn('kingdoms', 'school_spellbook',  "INTEGER NOT NULL DEFAULT 0", kingdomsCols);

  // Resource nodes table
  await _db.run(`
    CREATE TABLE IF NOT EXISTS resource_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id),
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      distance INTEGER NOT NULL,
      richness INTEGER NOT NULL,
      discovered_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_resource_nodes_kingdom ON resource_nodes(kingdom_id)`);

  // Admin goal definitions table (overrides defaults from game/goals.js)
  await _db.run(`
    CREATE TABLE IF NOT EXISTS admin_goal_definitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tier TEXT NOT NULL,
      goal_id TEXT NOT NULL,
      label TEXT NOT NULL,
      min_target INTEGER NOT NULL,
      max_target INTEGER NOT NULL,
      prize_type TEXT NOT NULL,
      prize_multiplier NUMERIC NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tier, goal_id)
    )
  `);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_admin_goals_tier ON admin_goal_definitions(tier, active)`);

  // Admin game constants override table
  await _db.run(`
    CREATE TABLE IF NOT EXISTS admin_game_constants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section TEXT NOT NULL,
      constant_key TEXT NOT NULL,
      override_value TEXT NOT NULL,
      data_type TEXT NOT NULL DEFAULT 'number',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(section, constant_key)
    )
  `);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_admin_constants_section ON admin_game_constants(section)`);

  // Resource expeditions table
  await _db.run(`
    CREATE TABLE IF NOT EXISTS resource_expeditions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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

  // Discord integration tables
  await _db.run(`
    CREATE TABLE IF NOT EXISTS discord_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL UNIQUE REFERENCES players(id),
      discord_user_id TEXT NOT NULL UNIQUE,
      discord_username TEXT NOT NULL,
      linked_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_discord_links_player ON discord_links(player_id)`);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_discord_links_discord_user ON discord_links(discord_user_id)`);

  await _db.run(`
    CREATE TABLE IF NOT EXISTS chat_sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_message_id INTEGER REFERENCES chat_messages(id),
      discord_message_id TEXT,
      direction TEXT NOT NULL,
      synced_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_chat_sync_log_game_msg ON chat_sync_log(game_message_id)`);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_chat_sync_log_discord_msg ON chat_sync_log(discord_message_id)`);

  await _db.run(`
    CREATE TABLE IF NOT EXISTS discord_sync_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL UNIQUE,
      channel_name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      sync_both_directions INTEGER NOT NULL DEFAULT 1,
      game_room TEXT NOT NULL DEFAULT 'global',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_discord_sync_config_channel ON discord_sync_config(channel_id)`);

  await _db.run(`
    CREATE TABLE IF NOT EXISTS discord_link_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      discord_user_id TEXT NOT NULL,
      discord_username TEXT NOT NULL,
      game_username TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_discord_link_tokens_token ON discord_link_tokens(token)`);
  await _db.run(`CREATE INDEX IF NOT EXISTS idx_discord_link_tokens_expires ON discord_link_tokens(expires_at)`);

  return _db;
}

let _kingdomCols = null;

async function getKingdomCols() {
  if (!_kingdomCols) {
    const rows = await _db.all("PRAGMA table_info(kingdoms)");
    _kingdomCols = new Set(rows.map(r => r.name));
  }
  return _kingdomCols;
}

async function applyKingdomUpdates(kingdomId, updates) {
  if (!updates || Object.keys(updates).length === 0) return [];
  const validCols = await getKingdomCols();
  const safe = Object.fromEntries(
    Object.entries(updates).filter(([col, val]) => validCols.has(col) && val !== undefined && val !== null)
  );
  if (Object.keys(safe).length === 0) return [];
  const cols = Object.keys(safe).map(k => `${k} = ?`).join(', ');
  const vals = [...Object.values(safe), kingdomId];
  await _db.run(`UPDATE kingdoms SET ${cols} WHERE id = ?`, vals);
  return Object.keys(safe);
}

module.exports = { initDb, applyKingdomUpdates };
