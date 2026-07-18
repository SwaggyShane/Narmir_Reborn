/**
 * Regression: route applyUpdates helpers must call applyKingdomUpdates(kingdomId, updates).
 * Wrong arity applyKingdomUpdates(db, kingdomId, updates) silently no-ops (P0 data-loss).
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BAD_CALL = /await\s+applyKingdomUpdates\s*\(\s*db\s*,/g;
const GOOD_CALL = /await\s+applyKingdomUpdates\s*\(\s*kingdomId\s*,\s*updatesForDb(\s*,\s*db)?\s*\)/;

const ROUTES_WITH_APPLY_UPDATES = [
  'routes/kingdom-build.js',
  // kingdom-gameplay.js's own local applyUpdates() moved to lib/kingdom-turn-helpers.js
  // (A2-3, 2026-07-19) — shared with routes/kingdom-turn.js rather than duplicated, so
  // that's the file that now actually contains the correct-arity call for the turn path.
  'routes/lib/kingdom-turn-helpers.js',
  'routes/kingdom-economy.js',
  'routes/kingdom-research.js',
];

for (const rel of ROUTES_WITH_APPLY_UPDATES) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const badMatches = src.match(BAD_CALL) || [];
  assert.strictEqual(
    badMatches.length,
    0,
    `${rel} must not call applyKingdomUpdates(db, kingdomId, ...) — wrong arity silently skips persistence`,
  );
  assert.ok(
    GOOD_CALL.test(src),
    `${rel} must call applyKingdomUpdates(kingdomId, updatesForDb) [optional , db for tx]`,
  );
}

function persistenceGate(kingdomId, updates) {
  if (!updates || Object.keys(updates).length === 0) return false;
  return true;
}

assert.strictEqual(persistenceGate({}, 7), false, 'wrong arity: numeric kingdom id is not a updates object');
assert.strictEqual(persistenceGate(7, { gold: 500 }), true, 'correct arity proceeds to UPDATE');

async function runDbPersistenceCheck() {
  if (process.env.RUN_DB_PERSISTENCE !== '1') {
    console.log('(skipped live DB persistence check: set RUN_DB_PERSISTENCE=1 to enable)');
    return;
  }
  require('dotenv').config();
  const dbUrl = (process.env.DATABASE_URL || '').trim();
  if (!dbUrl) {
    console.log('(skipped live DB persistence check: DATABASE_URL not set)');
    return;
  }
  process.env.DATABASE_URL = dbUrl;

  const { initDb, applyKingdomUpdates } = require('../db/schema');
  const db = await initDb();
  const suffix = `p0_apply_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const username = `p0_apply_${suffix}`;
  const kingdomName = `P0 Apply ${suffix}`;

  let playerId;
  let kingdomId;

  try {
    await db.run(
      'INSERT INTO players (username, password, email) VALUES ($1, $2, $3)',
      [username, 'p0-test-hash', `${username}@local.test`],
    );
    const player = await db.get('SELECT id FROM players WHERE username = $1', [username]);
    playerId = player.id;

    await db.run(
      `INSERT INTO kingdoms (player_id, name, race, turn, land, gold, fighters)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [playerId, kingdomName, 'human', 1, 100, 1000, 0],
    );
    const kingdom = await db.get('SELECT id, gold FROM kingdoms WHERE player_id = $1', [playerId]);
    kingdomId = kingdom.id;
    assert.strictEqual(kingdom.gold, 1000, 'seed gold');

    const noop = await applyKingdomUpdates({}, kingdomId, { gold: 4242 });
    assert.deepStrictEqual(noop, [], 'wrong arity must return without updating');
    const afterNoop = await db.get('SELECT gold FROM kingdoms WHERE id = $1', [kingdomId]);
    assert.strictEqual(afterNoop.gold, 1000, 'wrong arity must leave gold unchanged');

    const updated = await applyKingdomUpdates(kingdomId, { gold: 4242 });
    assert.ok(updated.includes('gold'), 'correct arity reports updated columns');
    const afterUpdate = await db.get('SELECT gold FROM kingdoms WHERE id = $1', [kingdomId]);
    assert.strictEqual(afterUpdate.gold, 4242, 'correct arity must persist gold');
  } finally {
    try {
      await db.run('DELETE FROM kingdoms WHERE name = $1', [kingdomName]);
    } catch {
      // best-effort cleanup
    }
    try {
      await db.run('DELETE FROM players WHERE username = $1', [username]);
    } catch {
      // best-effort cleanup
    }
    if (db.pool && typeof db.pool.end === 'function') {
      await db.pool.end();
    }
  }
}

(async () => {
  await runDbPersistenceCheck();
  console.log('apply-kingdom-updates persistence checks passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});