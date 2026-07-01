#!/usr/bin/env node

require('dotenv').config();

const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const { parseArgs } = require('util');

const DEFAULT_COUNT = 5000;
const DEFAULT_BATCH_SIZE = 250;
const USERNAME_PREFIX = 'loadtest_';
const KINGDOM_PREFIX = 'Loadtest Kingdom ';
const EMAIL_DOMAIN = 'loadtest.local';
const DEFAULT_PASSWORD = 'LoadTest1!';
const PASSWORD_SALT_ROUNDS = 10;

function createPlayerBatch(startIndex, size, passwordHash) {
  return Array.from({ length: size }, (_, offset) => {
    const sequence = startIndex + offset;
    const suffix = String(sequence).padStart(5, '0');
    return {
      username: `${USERNAME_PREFIX}${suffix}`,
      email: `${USERNAME_PREFIX}${suffix}@${EMAIL_DOMAIN}`,
      password: passwordHash,
      kingdomName: `${KINGDOM_PREFIX}${suffix}`,
    };
  });
}

function createInsertPlaceholders(rowCount, columnCount, startAt = 1) {
  const placeholders = [];
  let cursor = startAt;
  for (let row = 0; row < rowCount; row += 1) {
    const values = [];
    for (let column = 0; column < columnCount; column += 1) {
      values.push(`$${cursor}`);
      cursor += 1;
    }
    placeholders.push(`(${values.join(', ')})`);
  }
  return placeholders.join(', ');
}

async function insertPlayers(pool, batch) {
  const values = batch.flatMap((player) => [
    player.username,
    player.password,
    player.email,
    0,
    0,
    0,
  ]);

  const sql = `
    INSERT INTO players (username, password, email, is_admin, is_banned, is_ai)
    VALUES ${createInsertPlaceholders(batch.length, 6)}
    ON CONFLICT (username) DO NOTHING
    RETURNING id, username
  `;

  const result = await pool.query(sql, values);
  return result.rows;
}

async function insertKingdoms(pool, createdPlayers, batchMap) {
  if (!createdPlayers.length) return 0;

  const values = createdPlayers.flatMap((player) => {
    const source = batchMap.get(player.username);
    return [
      player.id,
      source.kingdomName,
      'human',
      'male',
      '',
      10000,
      4225,
      50000,
      5000,
      100,
      100,
      0,
      50,
      0,
      400,
      10,
      1,
      1,
      1,
      100,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
    ];
  });

  const sql = `
    INSERT INTO kingdoms (
      player_id, name, race, gender, region, gold, land, population, food,
      researchers, engineers, fighters, rangers, thralls, turns_stored,
      bld_farms, bld_schools, bld_barracks, bld_armories, bld_housing,
      bld_markets, bld_smithies, bld_mage_towers, bld_shrines, bld_outposts,
      bld_training, bld_mausoleums
    )
    VALUES ${createInsertPlaceholders(createdPlayers.length, 27)}
    ON CONFLICT (player_id) DO NOTHING
  `;

  const result = await pool.query(sql, values);
  return result.rowCount || 0;
}

async function insertExpeditions(pool, createdPlayers) {
  if (!createdPlayers.length) return 0;

  const playerIds = createdPlayers.map((player) => player.id);
  const kingdomResult = await pool.query(
    `
      SELECT id, player_id
      FROM kingdoms
      WHERE player_id = ANY($1)
    `,
    [playerIds],
  );

  if (!kingdomResult.rows.length) return 0;

  const values = kingdomResult.rows.flatMap((kingdom) => [
    kingdom.id,
    'scout',
    5,
    25,
    0,
    250,
  ]);

  const sql = `
    INSERT INTO expeditions (kingdom_id, type, turns_left, rangers, fighters, food_taken)
    VALUES ${createInsertPlaceholders(kingdomResult.rows.length, 6)}
  `;

  const result = await pool.query(sql, values);
  return result.rowCount || 0;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.');
  }

  const { values } = parseArgs({
    options: {
      count: { type: 'string' },
      batch: { type: 'string' },
    },
  });

  const requestedCount = Number.parseInt(values.count || String(DEFAULT_COUNT), 10);
  const batchSize = Number.parseInt(values.batch || String(DEFAULT_BATCH_SIZE), 10);
  if (!Number.isFinite(requestedCount) || requestedCount <= 0) {
    throw new Error(`Invalid --count value: ${values.count || ''}`);
  }
  if (!Number.isFinite(batchSize) || batchSize <= 0) {
    throw new Error(`Invalid --batch value: ${values.batch || ''}`);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 4,
    min: 0,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 15000,
  });

  try {
    const existingEligible = await pool.query(`
      SELECT COUNT(*)::int AS count
      FROM players p
      INNER JOIN kingdoms k ON k.player_id = p.id
      WHERE COALESCE(p.is_banned, 0) = 0
    `);
    const currentEligible = existingEligible.rows[0]?.count || 0;
    if (currentEligible >= requestedCount) {
      console.log(`Already have ${currentEligible} eligible player account(s); no seeding required.`);
      return;
    }

    const existingSeeded = await pool.query(
      `
        SELECT MAX(CAST(SUBSTRING(username FROM $1) AS INTEGER)) AS max_suffix
        FROM players
        WHERE username LIKE $2
      `,
      ['[0-9]+$', `${USERNAME_PREFIX}%`],
    );
    const nextSeedIndex = (existingSeeded.rows[0]?.max_suffix || 0) + 1;
    const missing = requestedCount - currentEligible;
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, PASSWORD_SALT_ROUNDS);

    let insertedPlayers = 0;
    let insertedKingdoms = 0;
    let insertedExpeditions = 0;
    let cursor = nextSeedIndex;

    while (insertedPlayers < missing) {
      const size = Math.min(batchSize, missing - insertedPlayers);
      const batch = createPlayerBatch(cursor, size, passwordHash);
      const batchMap = new Map(batch.map((row) => [row.username, row]));

      const createdPlayers = await insertPlayers(pool, batch);
      const createdCount = createdPlayers.length;
      insertedPlayers += createdCount;
      insertedKingdoms += await insertKingdoms(pool, createdPlayers, batchMap);
      insertedExpeditions += await insertExpeditions(pool, createdPlayers);
      cursor += size;

      console.log(
        `Seeded batch: +${createdCount} player(s), total inserted ${insertedPlayers}/${missing}.`,
      );
    }

    const finalEligible = await pool.query(`
      SELECT COUNT(*)::int AS count
      FROM players p
      INNER JOIN kingdoms k ON k.player_id = p.id
      WHERE COALESCE(p.is_banned, 0) = 0
    `);

    console.log(
      `Load-test seeding complete. Players inserted: ${insertedPlayers}, kingdoms inserted: ${insertedKingdoms}, expeditions inserted: ${insertedExpeditions}, eligible total: ${finalEligible.rows[0]?.count || 0}.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
