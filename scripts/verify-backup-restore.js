#!/usr/bin/env node

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { Pool } = require('pg');

const DEFAULT_BACKUP_DIR = path.resolve(process.cwd(), 'backups');
const DEFAULT_RESTORE_DB = 'narmir_restore_verify';
const isWindows = process.platform === 'win32';
const POSTGRES_BIN_FALLBACK = isWindows
  ? path.join('C:', 'Program Files', 'PostgreSQL', '18', 'bin')
  : '/usr/lib/postgresql/18/bin';

function parseConnectionString(connectionString) {
  const url = new URL(connectionString);
  return {
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    host: url.hostname,
    port: url.port || '5432',
    database: url.pathname.replace(/^\//, ''),
  };
}

function resolvePgBinary(binaryName) {
  const exeName = isWindows ? `${binaryName}.exe` : binaryName;
  if (process.env.PG_BIN_DIR) {
    return path.join(process.env.PG_BIN_DIR, exeName);
  }
  return path.join(POSTGRES_BIN_FALLBACK, exeName);
}

function runProcess(binary, args, env = process.env, stdinValue = null) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd: process.cwd(),
      env,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`${path.basename(binary)} exited with code ${code}\n${stderr || stdout}`));
      }
    });

    if (stdinValue != null) {
      child.stdin.write(stdinValue);
    }
    child.stdin.end();
  });
}

async function queryCounts(connectionString) {
  const pool = new Pool({ connectionString });
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM players) AS players,
        (SELECT COUNT(*)::int FROM kingdoms) AS kingdoms,
        (SELECT COUNT(*)::int FROM expeditions) AS expeditions,
        (SELECT COUNT(*)::int FROM resource_expeditions) AS resource_expeditions
    `);
    return result.rows[0];
  } finally {
    await pool.end();
  }
}

async function tableCount(connectionString) {
  const pool = new Pool({ connectionString });
  try {
    const result = await pool.query(`
      SELECT COUNT(*)::int AS count
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `);
    return result.rows[0]?.count || 0;
  } finally {
    await pool.end();
  }
}

async function currentRoleCapabilities(connectionString) {
  const pool = new Pool({ connectionString });
  try {
    const result = await pool.query(`
      SELECT rolcreatedb
      FROM pg_roles
      WHERE rolname = current_user
    `);
    return {
      canCreateDatabase: Boolean(result.rows[0]?.rolcreatedb),
    };
  } finally {
    await pool.end();
  }
}

async function querySchemaCounts(connectionString, schemaName) {
  const pool = new Pool({ connectionString });
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM ${schemaName}.players) AS players,
        (SELECT COUNT(*)::int FROM ${schemaName}.kingdoms) AS kingdoms,
        (SELECT COUNT(*)::int FROM ${schemaName}.expeditions) AS expeditions,
        (SELECT COUNT(*)::int FROM ${schemaName}.resource_expeditions) AS resource_expeditions
    `);
    return result.rows[0];
  } finally {
    await pool.end();
  }
}

async function schemaTableCount(connectionString, schemaName) {
  const pool = new Pool({ connectionString });
  try {
    const result = await pool.query(`
      SELECT COUNT(*)::int AS count
      FROM information_schema.tables
      WHERE table_schema = $1
    `, [schemaName]);
    return result.rows[0]?.count || 0;
  } finally {
    await pool.end();
  }
}

async function dropSchema(connectionString, schemaName) {
  const pool = new Pool({ connectionString });
  try {
    await pool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
  } finally {
    await pool.end();
  }
}

function rewriteBackupForSchemaRestore(sqlText, schemaName) {
  return [
    `DROP SCHEMA IF EXISTS ${schemaName} CASCADE;`,
    `CREATE SCHEMA ${schemaName};`,
    sqlText
      .replace(/SET search_path = public, pg_catalog;/g, `SET search_path = ${schemaName}, pg_catalog;`)
      .replace(/\bpublic\./g, `${schemaName}.`),
  ].join('\n');
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.');
  }

  const connection = parseConnectionString(process.env.DATABASE_URL);
  const backupDir = process.env.BACKUP_DIR ? path.resolve(process.env.BACKUP_DIR) : DEFAULT_BACKUP_DIR;
  const restoreDbName = process.env.RESTORE_DATABASE_NAME || DEFAULT_RESTORE_DB;
  const backupFile = path.join(backupDir, `roadmap_restore_verify_${Date.now()}.sql`);
  const pgDump = resolvePgBinary('pg_dump');
  const psql = resolvePgBinary('psql');
  const createdb = resolvePgBinary('createdb');
  const dropdb = resolvePgBinary('dropdb');

  fs.mkdirSync(backupDir, { recursive: true });

  const env = {
    ...process.env,
    PGPASSWORD: connection.password,
  };

  const adminArgs = [
    '--host', connection.host,
    '--port', String(connection.port),
    '--username', connection.user,
  ];

  const sourceCounts = await queryCounts(process.env.DATABASE_URL);
  const capabilities = await currentRoleCapabilities(process.env.DATABASE_URL);

  console.log(`Creating backup artifact at ${backupFile}...`);
  await runProcess(pgDump, [
    ...adminArgs,
    '--format=plain',
    '--file', backupFile,
    connection.database,
  ], env);

  let restoredCounts;
  let restoredTableCount;
  let restoreTarget;

  if (capabilities.canCreateDatabase) {
    console.log(`Refreshing restore database ${restoreDbName}...`);
    await runProcess(dropdb, [...adminArgs, '--if-exists', restoreDbName], env).catch(() => null);
    await runProcess(createdb, [...adminArgs, restoreDbName], env);

    console.log(`Restoring backup into ${restoreDbName}...`);
    await runProcess(psql, [
      ...adminArgs,
      '--dbname', restoreDbName,
      '--file', backupFile,
    ], env);

    const restoreConnectionString = `postgresql://${encodeURIComponent(connection.user)}:${encodeURIComponent(connection.password)}@${connection.host}:${connection.port}/${restoreDbName}`;
    restoredCounts = await queryCounts(restoreConnectionString);
    restoredTableCount = await tableCount(restoreConnectionString);
    restoreTarget = { type: 'database', name: restoreDbName };
  } else {
    const schemaName = `restore_verify_${Date.now()}`;
    const schemaRestoreFile = path.join(backupDir, `${schemaName}.sql`);
    const backupSql = fs.readFileSync(backupFile, 'utf8');
    fs.writeFileSync(schemaRestoreFile, rewriteBackupForSchemaRestore(backupSql, schemaName), 'utf8');

    console.log(`Restoring backup into scratch schema ${schemaName}...`);
    await runProcess(psql, [
      ...adminArgs,
      '--dbname', connection.database,
      '--file', schemaRestoreFile,
    ], env);

    restoredCounts = await querySchemaCounts(process.env.DATABASE_URL, schemaName);
    restoredTableCount = await schemaTableCount(process.env.DATABASE_URL, schemaName);
    restoreTarget = { type: 'schema', name: schemaName, file: schemaRestoreFile };
  }

  const mismatch = Object.keys(sourceCounts).find((key) => sourceCounts[key] !== restoredCounts[key]);
  if (mismatch) {
    throw new Error(`Restore verification mismatch on ${mismatch}: source=${sourceCounts[mismatch]} restored=${restoredCounts[mismatch]}`);
  }

  if (restoreTarget.type === 'schema') {
    await dropSchema(process.env.DATABASE_URL, restoreTarget.name);
  }

  console.log(JSON.stringify({
    backupFile,
    restoreTarget,
    tableCount: restoredTableCount,
    sourceCounts,
    restoredCounts,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
