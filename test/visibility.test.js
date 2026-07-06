'use strict';

const assert = require('assert');
const {
  parseVisibility,
  serializeVisibility,
  getInitialVisibility,
} = require('../game/visibility');
const { cellIndex, decodeCellSet } = require('../game/visibility-cells');
const { pixelToHex } = require('../game/hex-utils');
const { getKingdomMapCoords } = require('../game/world-map-coords');
const { setWorldSeedForTests } = require('../game/world-seed');

setWorldSeedForTests(424242n);

// --- parseVisibility: default fallback for missing/empty column ---
const defaults = parseVisibility(null);
assert.strictEqual(defaults.seenCells, 0n, 'null visibility parses to an empty seen_cells bitmap');
assert.strictEqual(defaults.currentCells, 0n, 'null visibility parses to an empty current_cells bitmap');
assert.strictEqual(defaults.version, 1, 'null visibility parses to schema version 1');
console.log('parseVisibility: missing column falls back to empty bitmaps at current schema version');

// --- parseVisibility: real stored value round-trips through BigInt ---
const stored = JSON.stringify({ seen_cells: '13', current_cells: '5', version: 1 });
const parsed = parseVisibility(stored);
assert.strictEqual(parsed.seenCells, 13n, 'stored seen_cells string parses to the matching BigInt');
assert.strictEqual(parsed.currentCells, 5n, 'stored current_cells string parses to the matching BigInt');
console.log('parseVisibility: stored JSON-in-TEXT value parses correctly to BigInts');

// --- serializeVisibility: inverse of parseVisibility ---
const roundTripped = serializeVisibility(parsed);
assert.strictEqual(roundTripped.seen_cells, '13', 'serializeVisibility must produce the exact decimal string back');
assert.strictEqual(roundTripped.current_cells, '5', 'serializeVisibility must produce the exact decimal string back');
const reparsed = parseVisibility(JSON.stringify(roundTripped));
assert.deepStrictEqual(reparsed, parsed, 'parse -> serialize -> parse must be a no-op');
console.log('serializeVisibility: round-trips exactly through parseVisibility');

// --- getInitialVisibility: home hex only, matches the kingdom's actual
// rendered position (same hex-cell-based check used throughout Phase 1/1.5) ---
const kingdom = { id: 42, race: 'human' };
const initial = getInitialVisibility(kingdom);
assert.strictEqual(initial.seenCells, initial.currentCells, 'initial seen_cells and current_cells must be identical (home hex only)');
const decoded = decodeCellSet(initial.seenCells);
assert.strictEqual(decoded.length, 1, 'initial visibility must contain exactly one cell (the home hex)');

const { map_x, map_y } = getKingdomMapCoords(kingdom);
const homeHex = pixelToHex(map_x, map_y);
assert.strictEqual(decoded[0], cellIndex(homeHex.col, homeHex.row), 'the one seen cell must be the kingdom\'s actual home hex');
console.log('getInitialVisibility: home hex only, matching the kingdom\'s real map position');

// --- Different kingdoms (different races/positions) get different home cells ---
const dwarfInitial = getInitialVisibility({ id: 42, race: 'dwarf' });
assert.notStrictEqual(dwarfInitial.seenCells, initial.seenCells, 'different races must get different home-hex visibility');
console.log('getInitialVisibility: differs correctly across races/positions');

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

  const { initDb } = require('../db/schema');
  const { getKingdomVisibility, updateKingdomVisibility } = require('../game/visibility');
  const { bitmapAddCell, bitmapHasCell } = require('../game/visibility-cells');
  const db = await initDb();
  const suffix = `p2_vis_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const username = `p2_vis_${suffix}`;
  const kingdomName = `P2 Visibility ${suffix}`;

  let playerId;
  let kingdomId;

  try {
    await db.run(
      'INSERT INTO players (username, password, email) VALUES ($1, $2, $3)',
      [username, 'p2-test-hash', `${username}@local.test`],
    );
    const player = await db.get('SELECT id FROM players WHERE username = $1', [username]);
    playerId = player.id;

    await db.run(
      `INSERT INTO kingdoms (player_id, name, race, turn, land, gold, fighters)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [playerId, kingdomName, 'human', 1, 100, 1000, 0],
    );
    const row = await db.get('SELECT id, race, visibility FROM kingdoms WHERE player_id = $1', [playerId]);
    kingdomId = row.id;

    // Fresh kingdom should default to "0"/"0" per the schema column default,
    // NOT already home-hex-seeded (that only happens on first read).
    assert.strictEqual(row.visibility, '{"seen_cells":"0","current_cells":"0","version":1}', 'fresh kingdom row must have the raw unseeded default');

    // First read must lazily seed home-hex visibility AND persist it.
    const lazyInit = await getKingdomVisibility(db, row);
    assert.notStrictEqual(lazyInit.seenCells, 0n, 'lazy init must set a non-empty seen_cells bitmap');
    const afterLazyInit = await db.get('SELECT visibility FROM kingdoms WHERE id = $1', [kingdomId]);
    const persisted = JSON.parse(afterLazyInit.visibility);
    assert.strictEqual(persisted.seen_cells, lazyInit.seenCells.toString(), 'lazy init result must be persisted to the row, not just returned');
    console.log('DB: lazy-init seeds home hex on first read and persists it');

    // Second read must NOT re-seed (idempotent) — same value both times.
    const secondRead = await getKingdomVisibility(db, { id: kingdomId, race: 'human', visibility: afterLazyInit.visibility });
    assert.strictEqual(secondRead.seenCells, lazyInit.seenCells, 'second read must return the same already-seeded value, not reseed');
    console.log('DB: lazy-init is idempotent on subsequent reads');

    // updateKingdomVisibility: read-modify-write under lock.
    const result = await updateKingdomVisibility(db, kingdomId, (current) => ({
      seenCells: bitmapAddCell(current.seenCells, 5, 3),
      currentCells: current.currentCells,
      version: current.version,
    }));
    assert.ok(result.seenCells > lazyInit.seenCells, 'updateKingdomVisibility must persist the added cell');
    const afterUpdate = await db.get('SELECT visibility FROM kingdoms WHERE id = $1', [kingdomId]);
    assert.strictEqual(JSON.parse(afterUpdate.visibility).seen_cells, result.seenCells.toString(), 'updateKingdomVisibility result must match what is actually in the DB');
    console.log('DB: updateKingdomVisibility persists a read-modify-write correctly');

    // Concurrent updates must not lose either write — the whole point of
    // row-locking via db.withTransaction (which correctly scopes the
    // AsyncLocalStorage context for its callback's full lifetime, unlike
    // the manual BEGIN/COMMIT db.run() pattern still used elsewhere in the
    // codebase — see updateKingdomVisibility's docstring).
    const beforeConcurrent = db.activeTxns.size;
    await Promise.all([
      updateKingdomVisibility(db, kingdomId, (current) => ({
        ...current,
        seenCells: bitmapAddCell(current.seenCells, 1, 1),
      })),
      updateKingdomVisibility(db, kingdomId, (current) => ({
        ...current,
        seenCells: bitmapAddCell(current.seenCells, 2, 2),
      })),
    ]);
    assert.strictEqual(db.activeTxns.size, beforeConcurrent, 'both transactions must be fully released, not leaked, after completing');
    const finalRow = await db.get('SELECT visibility FROM kingdoms WHERE id = $1', [kingdomId]);
    const finalSeen = BigInt(JSON.parse(finalRow.visibility).seen_cells);
    assert.ok(bitmapHasCell(finalSeen, 1, 1), 'concurrent update 1 must not be lost to a race with update 2');
    assert.ok(bitmapHasCell(finalSeen, 2, 2), 'concurrent update 2 must not be lost to a race with update 1');
    console.log('DB: concurrent updateKingdomVisibility calls do not lose either write, and leak no connections');
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

// --- fog_of_war debuff override (Phase 4 slice) ---
(async () => {
  const { getKingdomVisibility: getVis } = require('../game/visibility');
  const preSeen = '123456789012345';
  const preVis = JSON.stringify({ seen_cells: preSeen, current_cells: preSeen, version: 1 });
  const debuffRow = {
    id: 42,
    race: 'human',
    visibility: preVis,
    active_effects: JSON.stringify({ fog_of_war: { turns_left: 2, type: 'fog_of_war' } })
  };
  const visDebuff = await getVis(null, debuffRow); // active_effects present: no DB fetch path
  const home = getInitialVisibility({ id: 42, race: 'human' });
  assert.strictEqual(visDebuff.currentCells, home.currentCells, 'fog_of_war debuff must force currentCells to home-only initial');
  // seen must still contain the home hex (always-visible rule) but otherwise be left alone (debuff does not clear prior seen)
  const expectedSeenUnderDebuff = (BigInt(preSeen) | home.seenCells).toString();
  assert.strictEqual(visDebuff.seenCells.toString(), expectedSeenUnderDebuff, 'fog_of_war debuff must leave seenCells untouched except to ensure home hex is present');
  console.log('getKingdomVisibility: fog_of_war debuff forces current to home, preserves seen (home bit guaranteed)');

  // no debuff: keeps the passed current (plus home guarantee)
  const normalRow = { id: 42, race: 'human', visibility: preVis, active_effects: JSON.stringify({}) };
  const visNormal = await getVis(null, normalRow);
  const expectedCurrentNormal = (BigInt(preSeen) | home.seenCells).toString();  // home uses .seenCells but value same as initial current
  assert.strictEqual(visNormal.currentCells.toString(), expectedCurrentNormal, 'absent fog_of_war must preserve the row currentCells (plus guarantee home is in current)');
  console.log('getKingdomVisibility: no fog_of_war preserves currentCells from row (home bit guaranteed)');
})().catch((err) => {
  console.error('debuff visibility test failed:', err);
  process.exit(1);
});

(async () => {
  await runDbPersistenceCheck();
  console.log('visibility checks passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
