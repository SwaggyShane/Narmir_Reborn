/**
 * In-memory cache for the current world's generation seed (db.world_state).
 *
 * Kingdom/node placement (game/world-map-coords.js) needs this seed on
 * every call, including hot paths like GET /world-map that map over
 * hundreds of kingdoms per request. Rather than making placement async and
 * fetching from the DB per call, the seed is loaded once at server boot
 * (index.js, after initDb()) and cached here. This alpha resets by wiping
 * the DB and restarting the process (see scripts/admin-wipe-players.js),
 * not via a live in-process reload, so a boot-time load is sufficient —
 * there is no requirement to pick up a seed change without a restart.
 */

'use strict';

let cachedSeed = null;

/**
 * Load the world seed from the DB and cache it. Call once at server boot,
 * after initDb(). If the row is somehow missing (should not happen — the
 * schema migration inserts a default row), falls back to a fixed seed
 * rather than throwing, so a missing row can't take down boot — but logs a
 * warning, since silently falling back would mean every world after that
 * point renders with the exact same fixed layout, defeating the entire
 * point of this phase without anyone noticing until a player mentions it.
 */
async function loadWorldSeed(db) {
  const row = await db.get('SELECT seed FROM world_state WHERE id = 1');
  if (!row) {
    console.warn('[world-seed] world_state row (id=1) is missing — falling back to a fixed seed. Every kingdom/node placement will use the same deterministic layout until this is fixed. Check that the schema migration ran.');
    cachedSeed = 1n;
  } else {
    cachedSeed = BigInt(row.seed);
  }
  return cachedSeed;
}

/**
 * Synchronous accessor for the cached seed. Throws if called before
 * loadWorldSeed() has run — placement code should never silently fall back
 * to an un-seeded default, since that would defeat the point of per-world
 * randomization.
 */
function getWorldSeed() {
  if (cachedSeed === null) {
    throw new Error('[world-seed] getWorldSeed() called before loadWorldSeed() — call loadWorldSeed(db) once at boot first.');
  }
  return cachedSeed;
}

/**
 * Test-only escape hatch: set the cached seed directly without touching the
 * DB, so unit tests can exercise placement determinism/variation without a
 * database connection.
 */
function setWorldSeedForTests(seed) {
  cachedSeed = BigInt(seed);
}

module.exports = {
  loadWorldSeed,
  getWorldSeed,
  setWorldSeedForTests,
};
