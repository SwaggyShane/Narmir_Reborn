'use strict';

const { Pool } = require('pg');

function createPool(options = {}) {
  if (!process.env.DATABASE_URL) {
    throw new Error("[db] ❌ Critical: DATABASE_URL is not set! A persistent PostgreSQL database connection structure is strictly required.");
  }

  const defaultMax = Number.isInteger(options?.maxPool) ? options.maxPool : 20;
  const defaultMin = Number.isInteger(options?.minPool) ? options.minPool : 2;
  const maxPool = process.env.DATABASE_MAX_POOL ? parseInt(process.env.DATABASE_MAX_POOL, 10) : defaultMax;
  const minPool = process.env.DATABASE_MIN_POOL ? parseInt(process.env.DATABASE_MIN_POOL, 10) : defaultMin;

  if (isNaN(maxPool) || isNaN(minPool) || maxPool < 1 || minPool < 1 || maxPool < minPool) {
    throw new Error(`[db] Invalid pool configuration: max=${maxPool}, min=${minPool}. Both must be positive integers with max >= min`);
  }

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
    statement_timeout: 30000,
    idle_in_transaction_session_timeout: 60000,
    application_name: 'narmir-game',
    options: '-c client_encoding=UTF8',
  });

  pool.on('error', (err) => {
    console.error('[db] Unexpected pool error:', err.message);
  });

  // Log pool stats every 60 seconds if strained
  const poolStatsInterval = setInterval(() => {
    const available = pool.totalCount - pool.waitingCount;
    if (pool.waitingCount > 0 || available < pool.max / 2) {
      console.log(`[db] Pool stats — Total: ${pool.totalCount}, Available: ${available}, Waiting: ${pool.waitingCount}`);
    }
  }, 60000);
  if (poolStatsInterval.unref) poolStatsInterval.unref();

  process.on('SIGTERM', () => clearInterval(poolStatsInterval));
  process.on('SIGINT', () => clearInterval(poolStatsInterval));

  return pool;
}

async function connectWithValidation(pool) {
  console.log('[db] Connecting to PostgreSQL database...');
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
  return true;
}

module.exports = {
  createPool,
  connectWithValidation,
};
