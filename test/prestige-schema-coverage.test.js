'use strict';
/**
 * Ensures every kingdoms column is accounted for by the prestige wipe map
 * (schema reflection).
 *
 * Run: node test/prestige-schema-coverage.test.js
 * Requires DATABASE_URL.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const {
  ZERO_FIELDS,
  EMPTY_JSON_STRING,
  KEEP_COLUMNS,
  STARTER_BUILDINGS,
  getMappedUpdateKeys,
} = require('../game/prestige/wipe');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}

if (!process.env.DATABASE_URL) {
  console.error('FAIL: DATABASE_URL required');
  process.exit(1);
}

/** Columns that are not gameplay-mutated by prestige (identity / system / optional future). */
const IGNORE_SYSTEM = new Set([
  // Filled by wipe formulas / starters — covered by getMappedUpdateKeys
]);

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const r = await pool.query(
    `SELECT column_name AS name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'kingdoms'
     ORDER BY ordinal_position`,
  );
  await pool.end();

  const cols = r.rows.map((row) => row.name);
  assert.ok(cols.length > 50, `expected many kingdoms columns, got ${cols.length}`);

  const mapped = new Set([
    ...getMappedUpdateKeys(),
    ...KEEP_COLUMNS,
    ...Object.keys(STARTER_BUILDINGS),
    ...ZERO_FIELDS,
    ...Object.keys(EMPTY_JSON_STRING),
    ...IGNORE_SYSTEM,
  ]);

  // Formula keys always present
  for (const k of [
    'prestige_level',
    'last_prestige_turn',
    'level',
    'xp',
    'land',
    'gold',
    'population',
    'food',
    'mana',
    'turn',
  ]) {
    assert.ok(mapped.has(k), `formula key missing from map: ${k}`);
  }

  const unmapped = cols.filter((c) => !mapped.has(c));
  if (unmapped.length) {
    console.error('Unmapped kingdoms columns (add to wipe ZERO/EMPTY/KEEP or IGNORE_SYSTEM):');
    for (const c of unmapped) console.error('  -', c);
    process.exit(1);
  }

  console.log(`✓ prestige schema coverage: ${cols.length} kingdoms columns all mapped`);
  console.log(`  mapped update keys: ${getMappedUpdateKeys().length}, keep: ${KEEP_COLUMNS.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
